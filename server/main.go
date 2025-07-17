package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"gorm.io/gorm"

	identity "github.com/bluesky-social/indigo/atproto/identity"
	syntax "github.com/bluesky-social/indigo/atproto/syntax"
	"github.com/bluesky-social/indigo/lex/util"
	"github.com/ipfs/go-cid"
	skywell "github.com/saturn-vi/skywell/api/skywell"
)

var port string = ":8080"

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// slog.SetLogLoggerLevel(slog.LevelDebug)
	slog.Info("Initializing database...")
	db, client, err := initializeDB()

	if err != nil {
		panic("Failed to initialize database: " + err.Error())
	}

	slog.Info("Initializing HTTP server...")
	initializeHandleFuncs(db, ctx)
	server := &http.Server{Addr: port, Handler: http.DefaultServeMux}

	slog.Info("Reading from Jetstream...")
	go read(db, client, ctx)

	go func() {
		slog.Info(fmt.Sprintf("Server started on %s!", port))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error(fmt.Sprintf("Server error: %v", err.Error()))
		}
	}()

	<-ctx.Done()
	slog.Info("Shutting down server...")

	sCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(sCtx); err != nil {
		slog.Error(fmt.Sprintf("Server failed to shutdown (???) %v", err.Error()))
	} else {
		slog.Info("Server shutdown gracefully.")
	}
}

func initializeHandleFuncs(db *gorm.DB, ctx context.Context) {

	// returns ProfileView
	http.HandleFunc("/xrpc/dev.skywell.getActorProfile", func(w http.ResponseWriter, r *http.Request) {
		pfv, stat, err := generateProfileView(r.URL.Query().Get("actor"), db, ctx)
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to generate profile view: %v", err.Error()))
			http.Error(w, "Internal Server Error (profile view generation)", stat)
		}
		b, err := json.Marshal(pfv)
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to marshal profile: %v", err.Error()))
			http.Error(w, "Internal Server Error (marshaling content)", 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, "%s", b)
	})

	// returns GetActorFiles_Output
	http.HandleFunc("/xrpc/dev.skywell.getActorFiles", func(w http.ResponseWriter, r *http.Request) {
		pfv, stat, err := generateProfileView(r.URL.Query().Get("actor"), db, ctx)
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to generate profile view: %v", err))
			http.Error(w, "Internal Server Error (profile view generation)", stat)
			return
		}
		did, err := syntax.ParseDID(pfv.Did)
		if err != nil {
			http.Error(w, "Invalid 'actor' parameter", 400)
		}
		lim, err := strconv.Atoi(r.URL.Query().Get("limit"))
		if err != nil {
			http.Error(w, "Invalid 'limit' parameter", 400)
		}
		c, fl, stat, err := generateFileList(r.URL.Query().Get("cursor"), lim, did, db)
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to generate file list: %v", err))
			http.Error(w, "Internal Server Error (file list generation)", stat)
			return
		}
		gaf_o := skywell.GetActorFiles_Output{
			Actor:    pfv,
			Cursor:   &c,
			Profiles: *fl, // TODO update when package updates
		}
		b, err := json.Marshal(gaf_o)
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to marshal content: %v", err))
			http.Error(w, "Internal Server Error (marshaling content)", 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, "%s", b)
	})

}

func generateProfileView(actor string, db *gorm.DB, ctx context.Context) (profileView *skywell.Defs_ProfileView, httpResponse int, err error) {
	if actor == "" {
		return nil, 400, fmt.Errorf("Required parameter 'actor' missing")
	}

	at, err := syntax.ParseAtIdentifier(actor)
	if err != nil {
		return nil, 400, fmt.Errorf("Invalid 'actor' parameter: %w", err)
	}

	id, err := identity.DefaultDirectory().Lookup(ctx, *at)
	user := User{}
	result := db.First(&user, "did = ?", id.DID.String())
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, 404, fmt.Errorf("Actor not found")
	} else if result.Error != nil {
		return nil, 500, fmt.Errorf("Failed to find actor: %w", result.Error)
	}
	afc, err := getActorFileCount(id.DID, db)
	if err != nil {
		return nil, 500, fmt.Errorf("Failed to get actor file count: %w", err)
	}
	profileView = &skywell.Defs_ProfileView{
		Avatar:      (*string)(&user.Avatar),
		Did:         id.DID.String(),
		DisplayName: &user.DisplayName,
		FileCount:   &afc,
		Handle:      id.Handle.String(),
	}

	return profileView, 200, nil
}

// cursor probably just a datetime
func generateFileList(c string, limit int, a syntax.DID, db *gorm.DB) (cursor string, fileviews *[]*skywell.Defs_FileView, httpResponse int, err error) {
	user := User{}
	result := db.First(&user, "did = ?", a.String())
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return "", nil, 404, fmt.Errorf("Actor not found")
	} else if result.Error != nil {
		return "", nil, 500, fmt.Errorf("Failed to find actor: %w", result.Error)
	}
	fileviews = &[]*skywell.Defs_FileView{}
	files := &[]File{} // so we can use Last() to get the cursor
	query := db.Model(&File{}).Where("user_id = ?", user.ID).Order("indexed_at DESC").Limit(limit)
	if c != "" {
		pint, err := strconv.ParseInt(c, 10, 64)
		if err != nil {
			return "", nil, 400, fmt.Errorf("Invalid 'cursor' parameter: %w", err)
		}
		dt := time.Unix(0, pint) // cursor is a nanosecond timestamp
		query = query.Where("indexed_at < ?", dt)
	}
	result = query.Find(files)
	if result.Error != nil {
		return "", nil, 500, fmt.Errorf("Failed to query files: %w", result.Error)
	}
	for _, f := range *files {
		c, err := cid.Decode(f.BlobRef.String())
		if err != nil {
			return "", nil, 500, fmt.Errorf("Failed to decode blob CID: %w", err)
		}
		*fileviews = append(*fileviews, &skywell.Defs_FileView{
			Blob: &util.LexBlob{
				Ref:      util.LexLink(c),
				MimeType: f.MimeType,
				Size:     f.Size,
			},
			CreatedAt:   f.CreatedAt.String(),
			Name:        f.Name,
			Description: &f.Description,
		})
	}
	if len(*files) == 0 {
		return "", fileviews, 200, nil
	}
	cursor = strconv.FormatInt(((*files)[len(*files)-1].IndexedAt), 10)
	return cursor, fileviews, 200, nil
}

var ua string = "Skywell AppView v0.1.0"

func userAgent() *string {
	return &ua
}
