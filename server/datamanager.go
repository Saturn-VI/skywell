package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	bsky "github.com/bluesky-social/indigo/api/bsky"
	syntax "github.com/bluesky-social/indigo/atproto/syntax"
	util "github.com/bluesky-social/indigo/lex/util"
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

var r util.LexBlob
var l util.LexLink

type File struct {
	gorm.Model
	URI         syntax.URI `gorm:"uniqueIndex"`
	UserID      uint
	User        User `gorm:"foreignKey:UserID"`
	CreatedAt   syntax.Datetime
	IndexedAt   syntax.Datetime `gorm:"index"`
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
		Client:   &http.Client{},
		Host: "https://public.api.bsky.app",
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

	user := User{
		DID: syntax.DID(evt.Did),
	}
	result := db.First(&user, "did = ?", evt.Did)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		// they haven't made any files
		// we don't care about them
		return
	} else if result.Error != nil {
		fmt.Println(fmt.Errorf("Failed to find user with DID %s: %w", evt.Did, result.Error))
	}
	handle, displayName, avatarURI, err := getUserData(syntax.DID(evt.Did))
	if err != nil {
		fmt.Println(fmt.Errorf("Failed to get user data: %w", err))
	}
	user.Handle = handle
	user.DisplayName = displayName
	user.Avatar = avatarURI
	if err := db.Save(&user).Error; err != nil {
		fmt.Println(fmt.Errorf("Failed to save user: %w", err))
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
		}

		pc, err := syntax.ParseCID(r.Blob.Ref.String())
		if err != nil {
			fmt.Println(fmt.Errorf("Failed to parse blobRef: %w", err))
			return
		}

		file := File{
			URI:         uri,
			UserID:      user.ID,
			CreatedAt:   pt,
			IndexedAt:   syntax.DatetimeNow(),
			Name:        r.Name,
			Description: *r.Description,
			BlobRef:     pc,
			MimeType:    r.Blob.MimeType,
			Size:        r.Blob.Size,
		}

		switch evt.Commit.Operation {
		case jetstream.CommitOperationCreate, jetstream.CommitOperationUpdate:
			db.Save(&file)
		case jetstream.CommitOperationDelete:
			db.Delete(&File{}, "uri = ?", uri) // only need URI (primary key) to delete)
		default:
			fmt.Println(fmt.Errorf("Unknown commit operation: %s", evt.Commit.Operation))
		}

	case "app.bsky.actor.profile":
		if evt.Commit.Operation == jetstream.CommitOperationDelete {
			return // no need to handle delete for profile
		}

		user := User{
			DID: syntax.DID(evt.Did),
		}
		result := db.First(&user, "did = ?", evt.Did)
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			// they haven't made any files
			// we don't care about them
			return
		} else if result.Error != nil {
			fmt.Println(fmt.Errorf("Failed to find user with DID %s: %w", evt.Did, result.Error))
		}
		handle, displayName, avatarURI, err := getUserData(syntax.DID(evt.Did))
		if err != nil {
			fmt.Println(fmt.Errorf("Failed to get user data: %w", err))
		}
		user.Handle = handle
		user.DisplayName = displayName
		user.Avatar = avatarURI
		if err := db.Save(&user).Error; err != nil {
			fmt.Println(fmt.Errorf("Failed to save user: %w", err))
		}

	default:
		fmt.Println(fmt.Errorf("Unknown collection: %s", evt.Commit.Collection))
	}
}

func getUserData(did syntax.DID) (handle syntax.Handle, displayName string, avatarURI syntax.URI, err error) {
	r, err := bsky.ActorGetProfile(ctx, client, did.String())
	if err != nil {
		return "", "", "", fmt.Errorf("failed to get user profile: %w", err)
	}
	h, err := syntax.ParseHandle(r.Handle)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to parse handle: %w", err)
	}
	a, err := syntax.ParseURI(*r.Avatar)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to parse avatar URI: %w", err)
	}
	return h, *r.DisplayName, a, nil

}
