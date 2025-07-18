package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"

	bsky "github.com/bluesky-social/indigo/api/bsky"
	syntax "github.com/bluesky-social/indigo/atproto/syntax"
	xrpc "github.com/bluesky-social/indigo/xrpc"
	jetstream "github.com/bluesky-social/jetstream/pkg/models"
	skywell "github.com/saturn-vi/skywell/api/skywell"
)

type User struct {
	gorm.Model
	DID         syntax.DID `gorm:"uniqueIndex;column:did"`
	Handle      syntax.Handle
	Avatar      syntax.URI
	DisplayName string
}

type File struct {
	gorm.Model
	URI         syntax.URI `gorm:"uniqueIndex"`
	UserID      uint
	User        User `gorm:"foreignKey:UserID"`
	CreatedAt   syntax.Datetime
	IndexedAt   int64 `gorm:"index"`
	Name        string
	Description string
	BlobRef     syntax.CID
	MimeType    string
	Size        int64
}

func initializeDB() (db *gorm.DB, client *xrpc.Client, err error) {
	db, err = gorm.Open(sqlite.Open("database.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), // Disable GORM logging
	})
	if err != nil {
		return nil, nil, err
	}
	db.AutoMigrate(&File{})
	db.AutoMigrate(&User{})

	client = &xrpc.Client{
		Client:    &http.Client{},
		Host:      "https://public.api.bsky.app",
		UserAgent: userAgent(),
	}
	return db, client, nil
}

func updateIdentity(evt jetstream.Event, db *gorm.DB, client *xrpc.Client, ctx context.Context) {
	// updateIdentity called when identity cache should be purged
	if evt.Kind != jetstream.EventKindIdentity {
		return
	}

	did, err := syntax.ParseDID(evt.Did)
	if err != nil {
		slog.Error(fmt.Sprintf("Failed to parse DID: %v", err))
		return
	}
	err = updateUserProfile(did, db, client, ctx)
	if err != nil {
		slog.Error(fmt.Sprintf("Failed to update user profile: %v", err))
		return
	}
}

func updateAccount(evt jetstream.Event) {
	// updateAccount called on account status change, e.g. active, inactive, or takendown
	if evt.Kind != jetstream.EventKindAccount {
		return
	}
	// TODO implement
	// we don't care about it yet though
}

func updateRecord(evt jetstream.Event, db *gorm.DB, client *xrpc.Client, ctx context.Context) {
	// updateRecord called on commit to repo
	if evt.Kind != jetstream.EventKindCommit {
		return
	}

	switch evt.Commit.Collection {
	case "dev.skywell.file":
		var r skywell.File
		err := json.Unmarshal(evt.Commit.Record, &r)
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to unmarshal to file: %v", err))
			return
		}
		uri, err := syntax.ParseURI(fmt.Sprintf("at://%s/%s/%s", evt.Did, evt.Commit.Collection, evt.Commit.RKey))
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to parse URI: %v", err))
			return
		}

		// get user
		var user User
		result := db.First(&user, "did = ?", evt.Did)
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			// user not found, create user
			slog.Debug(fmt.Sprintf("Failed to find user with DID %s, creating user", evt.Did))
			h, d, a, err := getUserData(syntax.DID(evt.Did), db, client, ctx)
			if err != nil {
				slog.Error(fmt.Sprintf("Failed to get user data: %v", err))
				return
			}
			user = User{
				DID:         syntax.DID(evt.Did),
				Handle:      h,
				DisplayName: d,
				Avatar:      a,
			}

			if err := db.Create(&user).Error; err != nil {
				slog.Error(fmt.Sprintf("Failed to create user: %v", err))
				return
			}
		}

		pt, err := syntax.ParseDatetime(r.CreatedAt)
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to parse createdAt: %v", err))
			return
		}

		pc, err := syntax.ParseCID(r.Blob.Ref.String())
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to parse blobRef: %v", err))
			return
		}

		file := File{
			URI:       uri,
			UserID:    user.ID,
			CreatedAt: pt,
			IndexedAt: syntax.DatetimeNow().Time().UnixNano(),
			Name:      r.Name,
			BlobRef:   pc,
			MimeType:  r.Blob.MimeType,
			Size:      r.Blob.Size,
		}

		if r.Description != nil {
			file.Description = *r.Description
		}

		switch evt.Commit.Operation {
		case jetstream.CommitOperationCreate, jetstream.CommitOperationUpdate:
			err := db.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "uri"}},
				DoUpdates: clause.AssignmentColumns([]string{"name", "description", "blob_ref", "mime_type", "size"}),
			}).Create(&file).Error
			if err != nil {
				slog.Error(fmt.Sprintf("Failed to create or update file: %v", err))
				return
			}
			slog.Debug(fmt.Sprintf("Created file with name %s from DID %s", file.Name, evt.Did))
		case jetstream.CommitOperationDelete:
			db.Delete(&File{}, "uri = ?", uri.String()) // only need URI (primary key) to delete)
		default:
			slog.Error(fmt.Sprintf("Unknown commit operation: %s", evt.Commit.Operation))
		}

	case "app.bsky.actor.profile":
		if evt.Commit.Operation == jetstream.CommitOperationDelete {
			return // no need to handle delete for profile
		}

		did, err := syntax.ParseDID(evt.Did)
		if err != nil {
			slog.Debug(fmt.Sprintf("Failed to parse DID: %v", err))
			return
		}
		err = updateUserProfile(did, db, client, ctx)
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to update user profile: %v", err))
			return
		}

	default:
		slog.Error(fmt.Sprintf("Unknown collection: %s", evt.Commit.Collection))
	}
}

func updateUserProfile(did syntax.DID, db *gorm.DB, client *xrpc.Client, ctx context.Context) error {

	user := User{
		DID: did,
	}
	result := db.First(&user, "did = ?", did.String())
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		// they haven't made any files
		// we don't care about them
		return nil
	} else if result.Error != nil {
		return result.Error
	}
	handle, displayName, avatarURI, err := getUserData(did, db, client, ctx)
	if err != nil {
		return err
	}
	user.Handle = handle
	user.DisplayName = displayName
	user.Avatar = avatarURI
	if err := db.Save(&user).Error; err != nil {
		return err
	}
	return nil
}

func getActorFileCount(did syntax.DID, db *gorm.DB) (count int64, err error) {
	user := User{}
	result := db.First(&user, "did = ?", did.String())
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return 0, fmt.Errorf("user with DID %s not found", did)
	} else if result.Error != nil {
		return 0, fmt.Errorf("failed to find user with DID %s: %w", did, result.Error)
	}
	count = 0
	result = db.Model(&File{}).Where("user_id = ?", user.ID).Count(&count)
	if result.Error != nil {
		return 0, fmt.Errorf("failed to count files for user with DID %s: %w", did, result.Error)
	}
	return count, nil
}

func getUserData(did syntax.DID, db *gorm.DB, client *xrpc.Client, ctx context.Context) (handle syntax.Handle, displayName string, avatarURI syntax.URI, err error) {
	r, err := bsky.ActorGetProfile(ctx, client, did.String())
	if err != nil {
		return "", "", "", fmt.Errorf("failed to get user profile: %w", err)
	}
	handle, err = syntax.ParseHandle(r.Handle)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to parse handle: %w", err)
	}

	if r.Avatar != nil {
		a, err := syntax.ParseURI(*r.Avatar)
		if err == nil {
			avatarURI = a
		}
	}

	if r.DisplayName != nil {
		displayName = *r.DisplayName
	} else {
		displayName = r.Handle
	}
	return handle, displayName, avatarURI, nil
}
