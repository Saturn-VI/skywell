package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

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

var db *gorm.DB
var client *xrpc.Client
var ctx context.Context

func initializeDB() (err error) {
	db, err = gorm.Open(sqlite.Open("database.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), // Disable GORM logging
	})
	if err != nil {
		return err
	}
	db.AutoMigrate(&File{})
	db.AutoMigrate(&User{})

	client = &xrpc.Client{
		Client:    &http.Client{},
		Host:      "https://public.api.bsky.app",
		UserAgent: userAgent(),
	}
	ctx = context.Background()
	return nil
}

func updateIdentity(evt jetstream.Event) {
	// updateIdentity called when identity cache should be purged
	if evt.Kind != jetstream.EventKindIdentity {
		return
	}

	did, err := syntax.ParseDID(evt.Did)
	if err != nil {
		fmt.Println(fmt.Errorf("Failed to parse DID: %w", err))
		return
	}
	err = updateUserProfile(did)
	if err != nil {
		fmt.Println(fmt.Errorf("Failed to update user profile: %w", err))
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

func updateRecord(evt jetstream.Event) {
	// updateRecord called on commit to repo
	if evt.Kind != jetstream.EventKindCommit {
		return
	}

	switch evt.Commit.Collection {
	case "dev.skywell.file":
		var r skywell.File
		err := json.Unmarshal(evt.Commit.Record, &r)
		if err != nil {
			fmt.Println(fmt.Errorf("Failed to unmarshal to file: %w", err))
			return
		}
		uri, err := syntax.ParseURI(fmt.Sprintf("at://%s/%s/%s", evt.Did, evt.Commit.Collection, evt.Commit.RKey))
		if err != nil {
			fmt.Println(fmt.Errorf("Failed to parse URI: %w", err))
			return
		}

		// get user
		var user User
		result := db.First(&user, "did = ?", evt.Did)
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			// user not found, create user
			fmt.Printf("Failed to find user with DID %s, creating user\n", evt.Did)
			h, d, a, err := getUserData(syntax.DID(evt.Did))
			if err != nil {
				fmt.Println(fmt.Errorf("Failed to get user data: %w", err))
				return
			}
			user = User{
				DID:         syntax.DID(evt.Did),
				Handle:      h,
				DisplayName: d,
				Avatar:      a,
			}

			if err := db.Create(&user).Error; err != nil {
				fmt.Println(fmt.Errorf("Failed to create user: %w", err))
				return
			}
		}

		pt, err := syntax.ParseDatetime(r.CreatedAt)
		if err != nil {
			fmt.Println(fmt.Errorf("Failed to parse createdAt: %w", err))
			return
		}

		pc, err := syntax.ParseCID(r.Blob.Ref.String())
		if err != nil {
			fmt.Println(fmt.Errorf("Failed to parse blobRef: %w", err))
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
				fmt.Println(fmt.Errorf("Failed to create or update file: %w", err))
			}
		case jetstream.CommitOperationDelete:
			db.Delete(&File{}, "uri = ?", uri.String()) // only need URI (primary key) to delete)
		default:
			fmt.Println(fmt.Errorf("Unknown commit operation: %s", evt.Commit.Operation))
		}

	case "app.bsky.actor.profile":
		if evt.Commit.Operation == jetstream.CommitOperationDelete {
			return // no need to handle delete for profile
		}

		did, err := syntax.ParseDID(evt.Did)
		if err != nil {
			fmt.Println(fmt.Errorf("Failed to parse DID: %w", err))
			return
		}
		err = updateUserProfile(did)
		if err != nil {
			fmt.Println(fmt.Errorf("Failed to update user profile: %w", err))
			return
		}

	default:
		fmt.Println(fmt.Errorf("Unknown collection: %s", evt.Commit.Collection))
	}
}

func updateUserProfile(did syntax.DID) error {

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
	handle, displayName, avatarURI, err := getUserData(did)
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

func getActorFileCount(did syntax.DID) (count int64, err error) {
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

func getUserData(did syntax.DID) (handle syntax.Handle, displayName string, avatarURI syntax.URI, err error) {
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
