package main

import (
	"context"
	"crypto/sha256"
	b64 "encoding/base64"
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

type FileKey struct {
	gorm.Model
	gorm.DeletedAt `gorm:"index"`
	Key            string `gorm:"uniqueIndex"`
	File           uint   `gorm:"uniqueIndex:idx_file_key"`
}

type File struct {
	gorm.Model
	gorm.DeletedAt `gorm:"index"`
	URI            syntax.URI `gorm:"uniqueIndex"`
	UserID         uint
	User           User `gorm:"foreignKey:UserID"`
	CreatedAt      syntax.Datetime
	IndexedAt      int64 `gorm:"index"`
	Name           string
	Description    string
	BlobRef        syntax.CID
	MimeType       string
	Size           int64
}

const SLUG_LENGTH int = 6 // enough entropy for anyone

func initializeDB() (db *gorm.DB, client *xrpc.Client, err error) {
	db, err = gorm.Open(sqlite.Open("database.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), // Disable GORM logging
	})
	if err != nil {
		return nil, nil, err
	}
	db.AutoMigrate(&File{})
	db.AutoMigrate(&User{})
	db.AutoMigrate(&FileKey{})

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
		slog.Error("Failed to parse DID", "error", err)
		return
	}
	err = updateUserProfile(did, db, client, ctx)
	if err != nil {
		slog.Error("Failed to update user profile", "error", err)
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
			slog.Error("Failed to unmarshal to file", "error", err)
			return
		}
		uri, err := syntax.ParseURI(fmt.Sprintf("at://%s/%s/%s", evt.Did, evt.Commit.Collection, evt.Commit.RKey))
		if err != nil {
			slog.Error("Failed to parse URI", "error", err)
			return
		}

		// get user
		var user User
		result := db.First(&user, "did = ?", evt.Did)
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			// user not found, create user
			slog.Debug(fmt.Sprintf("Failed to find user with DID %s, creating user", evt.Did))
			h, d, a, err := getUserData(syntax.DID(evt.Did), client, ctx)
			if err != nil {
				slog.Error("Failed to get user data", "error", err)
				return
			}
			user = User{
				DID:         syntax.DID(evt.Did),
				Handle:      h,
				DisplayName: d,
				Avatar:      a,
			}

			if err := db.Create(&user).Error; err != nil {
				slog.Error("Failed to create user", "error", err)
				return
			}
		}

		pt, err := syntax.ParseDatetime(r.CreatedAt)
		if err != nil {
			slog.Error("Failed to parse createdAt", "err", err)
			return
		}

		pc, err := syntax.ParseCID(r.Blob.Ref.String())
		if err != nil {
			slog.Error("Failed to parse blobRef", "error", err)
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

		fk, err := generateSlug(db, file.BlobRef, file.URI)

		if err != nil {
			slog.Error("Failed to generate slug", "error", err)
			return
		}

		filekey := FileKey{
			Key:  fk,
			File: file.ID,
		}

		switch evt.Commit.Operation {
		case jetstream.CommitOperationCreate, jetstream.CommitOperationUpdate:
			err := db.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "uri"}},
				DoUpdates: clause.AssignmentColumns([]string{"name", "description", "blob_ref", "mime_type", "size"}),
			}).Create(&file).Error
			if err != nil {
				slog.Error("Failed to create or update file", "error", err)
				return
			}
			err = db.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "file"}},
				DoNothing: true,
			}).Create(&filekey).Error
			if err != nil {
				slog.Error("Failed to create file key", "error", err)
				return
			}
			slog.Debug(fmt.Sprintf("Created file with name %s from DID %s and slug %s", file.Name, evt.Did, filekey.Key))
		case jetstream.CommitOperationDelete:

			var fd File
			if err := db.Where("uri = ?", uri.String()).First(&fd).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					slog.Warn("Attempted to delete a file that does not exist in the DB", "uri", uri.String())
				} else {
					slog.Error("Failed to query file for deletion", "uri", uri.String(), "error", err)
				}
				return
			}
			var fk FileKey
			if err := db.Where("file_id = ?", fd.ID).First(&fk).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					slog.Warn("Attempted to delete a file key that does not exist in the DB", "file_id", fd.ID)
				} else {
					slog.Error("Failed to query file key for deletion", "file_id", fd.ID, "error", err)
				}
				return
			}

			err = db.Transaction(func(tx *gorm.DB) error {
				if err := tx.Delete(&fd).Error; err != nil {
					return err
				}
				if err := tx.Delete(&fk).Error; err != nil {
					return err
				}
				return nil
			})

			if err != nil {
				slog.Error("Failed to delete file", "error", err)
				return
			}

			slog.Debug(fmt.Sprintf("Deleted file with name %s from DID %s and slug %s", fd.Name, evt.Did, fk.Key))
		default:
			slog.Info(fmt.Sprintf("Unknown commit operation: %s", evt.Commit.Operation))
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
			slog.Error("Failed to update user profile", "error", err)
			return
		}

	default:
		slog.Info(fmt.Sprintf("Unknown collection: %s", evt.Commit.Collection))
	}
}

func generateSlug(db *gorm.DB, cid syntax.CID, uri syntax.URI) (slug string, err error) {
	hasher := sha256.New()
	hasher.Reset()

	// slug comprised of blob CID and then the URI
	// because hashes are more influenced by earlier bytes,
	// we put the blob CID first
	// because most files will probably be unique
	// then the URI is after
	// so basically, data in order is:
	// cid (bunch of random data) + at:// + did (same sometimes, mostly unique) + collection (always same) + rkey (based on time, mostly unique)
	hasher.Write([]byte(cid.String()))
	hasher.Write([]byte(uri.String()))

	b := b64.StdEncoding.EncodeToString(hasher.Sum(nil))
	tb := b[:SLUG_LENGTH]

	counter := 0
	cb := tb

	fk := FileKey{}

	for {
		err := db.First(&fk, "key = ?", string(cb)).Error

		if errors.Is(err, gorm.ErrRecordNotFound) {
			return string(cb), nil // found a unique slug
		}

		if err != nil {
			return "", err
		}

		counter++
		cb = fmt.Sprintf("%s%d", string(tb), counter)
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
	handle, displayName, avatarURI, err := getUserData(did, client, ctx)
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

func getUserData(did syntax.DID, client *xrpc.Client, ctx context.Context) (handle syntax.Handle, displayName string, avatarURI syntax.URI, err error) {
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
