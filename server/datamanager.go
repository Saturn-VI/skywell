package main

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	b58 "github.com/mr-tron/base58"
	"github.com/saturn-vi/skywell/api/skywell"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"

	"github.com/bluesky-social/indigo/api/bsky"
	"github.com/bluesky-social/indigo/atproto/syntax"
	"github.com/bluesky-social/indigo/xrpc"
	jetstream "github.com/bluesky-social/jetstream/pkg/models"
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
	Uri         syntax.URI `gorm:"uniqueIndex"`
	Cid         syntax.CID
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

const SlugLength int = 6 // enough entropy for anyone

func initializeDB() (db *gorm.DB, client *xrpc.Client, err error) {
	db, err = gorm.Open(sqlite.Open("database.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), // Disable GORM logging
	})
	if err != nil {
		return nil, nil, err
	}
	err = db.AutoMigrate(&File{})
	if err != nil {
		return nil, nil, err
	}
	err = db.AutoMigrate(&User{})
	if err != nil {
		return nil, nil, err
	}
	err = db.AutoMigrate(&FileKey{})
	if err != nil {
		return nil, nil, err
	}

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
		jetstreamLogger.Error("Failed to parse DID", "did", evt.Did, "error", err)
		return
	}
	err = cacheDir.Purge(ctx, did.AtIdentifier())
	if err != nil {
		jetstreamLogger.Error("Failed to purge cache entry", "did", did.AtIdentifier(), "error", err)
		return
	}
	err = updateUserProfile(did, false, db, client, ctx)
	if err != nil {
		jetstreamLogger.Error("Failed to update user profile", "did", evt.Did, "error", err)
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
		uri, err := syntax.ParseURI(fmt.Sprintf("at://%s/%s/%s", evt.Did, evt.Commit.Collection, evt.Commit.RKey))
		if err != nil {
			jetstreamLogger.Error("Failed to parse URI", "did", evt.Did, "error", err)
			return
		}

		// get user
		var user User
		result := db.First(&user, "did = ?", evt.Did)
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			// user not found, create user
			dbLogger.Debug("User not found, creating new user", "did", evt.Did)
			h, d, a, err := getUserData(syntax.DID(evt.Did), client, ctx)
			if err != nil {
				jetstreamLogger.Error("Failed to get user data", "did", evt.Did, "error", err)
				return
			}
			user = User{
				DID:         syntax.DID(evt.Did),
				Handle:      h,
				DisplayName: d,
				Avatar:      a,
			}

			if err := db.Create(&user).Error; err != nil {
				dbLogger.Error("Failed to create user", "did", evt.Did, "handle", h.String(), "error", err)
				return
			}
		}

		switch evt.Commit.Operation {
		case jetstream.CommitOperationCreate, jetstream.CommitOperationUpdate:
			var r skywell.File
			err = json.Unmarshal(evt.Commit.Record, &r)
			if err != nil {
				jetstreamLogger.Error("Failed to unmarshal to file", "did", evt.Did, "error", err)
				return
			}

			cid, err := syntax.ParseCID(evt.Commit.CID)
			if err != nil {
				jetstreamLogger.Error("Failed to parse CID", "cid", r.BlobRef.Ref.String(), "uri", uri.String(), "did", evt.Did, "error", err)
				return
			}

			pt, err := syntax.ParseDatetime(r.CreatedAt)
			if err != nil {
				jetstreamLogger.Error("Failed to parse createdAt", "created_at", r.CreatedAt, "uri", uri.String(), "did", evt.Did, "error", err)
				return
			}

			if r.BlobRef == nil {
				jetstreamLogger.Error("BlobRef is nil", "uri", uri.String(), "did", evt.Did)
				return
			}
			pc, err := syntax.ParseCID(r.BlobRef.Ref.String())
			if err != nil {
				jetstreamLogger.Error("Failed to parse blobRef", "blob_ref", r.BlobRef.Ref.String(), "uri", uri.String(), "did", evt.Did, "error", err)
				return
			}

			file := File{
				Uri:       uri,
				Cid:       cid,
				UserID:    user.ID,
				CreatedAt: pt,
				IndexedAt: syntax.DatetimeNow().Time().UnixNano(),
				Name:      r.Name,
				BlobRef:   pc,
				MimeType:  r.BlobRef.MimeType,
				Size:      r.BlobRef.Size,
			}

			if r.Description != nil {
				file.Description = *r.Description
			}

			fk, err := generateSlug(db, file.BlobRef, file.Uri)

			if err != nil {
				dbLogger.Error("Failed to generate slug", "file_name", file.Name, "user_id", user.ID, "uri", uri.String(), "did", evt.Did, "error", err)
				return
			}

			filekey := FileKey{
				Key:  fk,
				File: 0,
			}

			err = db.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "uri"}},
				DoUpdates: clause.AssignmentColumns([]string{"name", "description", "blob_ref", "mime_type", "size"}),
			}).Create(&file).Error
			if err != nil {
				dbLogger.Error("Failed to create or update file", "file_name", file.Name, "user_id", user.ID, "uri", uri.String(), "did", evt.Did, "error", err)
				return
			}
			filekey.File = file.ID // set the file ID after file is created/updated
			dbLogger.Debug("Creating filekey", "key", filekey.Key, "file_id", file.ID, "user_id", user.ID, "did", evt.Did)
			err = db.Clauses(clause.OnConflict{
				DoNothing: true,
			}).Create(&filekey).Error
			if err != nil {
				dbLogger.Error("Failed to create file key", "key", filekey.Key, "file_id", file.ID, "user_id", user.ID, "did", evt.Did, "error", err)
				return
			}
			jetstreamLogger.Info("Created file", "file_id", file.ID, "file_name", file.Name, "slug", filekey.Key, "did", evt.Did)
		case jetstream.CommitOperationDelete:
			var fd File
			if err := db.Where("uri = ?", uri.String()).First(&fd).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					dbLogger.Warn("Attempted to delete non-existent file", "uri", uri.String(), "did", evt.Did)
				} else {
					dbLogger.Error("Failed to query file for deletion", "uri", uri.String(), "did", evt.Did, "error", err)
				}
				return
			}

			var fk FileKey
			if err := db.Where("file = ?", fd.ID).First(&fk).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					dbLogger.Warn("Attempted to delete non-existent file key", "file_id", fd.ID, "did", evt.Did)
				} else {
					dbLogger.Error("Failed to query file key for deletion", "file_id", fd.ID, "did", evt.Did, "error", err)
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
				dbLogger.Error("Failed to delete file", "file_id", fd.ID, "file_name", fd.Name, "slug", fk.Key, "did", evt.Did, "error", err)
				return
			}

			jetstreamLogger.Info("Deleted file", "file_id", fd.ID, "file_name", fd.Name, "slug", fk.Key, "did", evt.Did)
		default:
			jetstreamLogger.Warn("Unknown commit operation", "operation", evt.Commit.Operation, "collection", evt.Commit.Collection, "did", evt.Did)
		}

	case "app.bsky.actor.profile":
		if evt.Commit.Operation == jetstream.CommitOperationDelete {
			return // no need to handle delete for profile
		}

		did, err := syntax.ParseDID(evt.Did)
		if err != nil {
			jetstreamLogger.Error("Failed to parse DID for profile update", "did", evt.Did, "error", err)
			return
		}
		err = updateUserProfile(did, false, db, client, ctx)
		if err != nil {
			jetstreamLogger.Error("Failed to update user profile", "did", evt.Did, "error", err)
			return
		}

	default:
		jetstreamLogger.Warn("Unknown collection", "collection", evt.Commit.Collection, "operation", evt.Commit.Operation, "did", evt.Did)
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

	b := b58.Encode(hasher.Sum(nil))
	tb := b[:SlugLength]

	counter := 0
	cb := tb

	fk := FileKey{}

	for {
		err := db.First(&fk, "key = ?", cb).Error

		if errors.Is(err, gorm.ErrRecordNotFound) {
			return cb, nil // found a unique slug
		}

		if err != nil {
			return "", err
		}

		counter++
		cb = fmt.Sprintf("%s%d", tb, counter)
	}
}

func updateUserProfile(did syntax.DID, forceIndex bool, db *gorm.DB, client *xrpc.Client, ctx context.Context) error {

	user := User{
		DID: did,
	}
	err := db.First(&user, "did = ?", did.String()).Error
	// if we're forcing an  index, we don't worry about record not found
	if !forceIndex && errors.Is(err, gorm.ErrRecordNotFound) {
		// they haven't made any files
		// we don't care about them
		return nil
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
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
