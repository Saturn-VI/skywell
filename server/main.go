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

	slog.SetLogLoggerLevel(slog.LevelDebug)
	slog.Info("Initializing database...")
	db, client, err := initializeDB()

	if err != nil {
		panic("Failed to initialize database: " + err.Error())
	}

	slog.Info("Initializing HTTP server...")
	initializeHandleFuncs(db, ctx)

	handler := corsMiddleware(http.DefaultServeMux)
	server := &http.Server{Addr: port, Handler: handler}

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

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func initializeHandleFuncs(db *gorm.DB, ctx context.Context) {

	// returns ProfileView
	http.HandleFunc("/xrpc/dev.skywell.getActorProfile", func(w http.ResponseWriter, r *http.Request) {
		slog.Debug("Received request for /xrpc/dev.skywell.getActorProfile")
		pfv, stat, err := generateProfileView(r.URL.Query().Get("actor"), db, ctx)
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to generate profile view: %v", err.Error()))
			http.Error(w, "Internal Server Error (profile view generation)", stat)
			return
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

	// returns GetUriFromSlug_Output
	http.HandleFunc("/xrpc/dev.skywell.getFileFromSlug", func(w http.ResponseWriter, r *http.Request) {
		// based on slug, get:
		// URI, CID, and DID
		slog.Debug("Received request for /xrpc/dev.skywell.getUriFromSlug")
		s := r.URL.Query().Get("slug")
		if s == "" {
			http.Error(w, "Required parameter 'slug' missing", 400)
			return
		}
		fk := FileKey{}
		if err := db.Where("key = ?", s).First(&fk).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				http.Error(w, "No matching slug found", 404)
				return
			}
			slog.Debug(fmt.Sprintf("Failed to find file key: %v", err))
			http.Error(w, "Internal Server Error (file key lookup)", 500)
			return
		}
		fi := File{}
		if err := db.Where("id = ?", fk.File).First(&fi).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				http.Error(w, "No matching file found", 404)
				return
			}
			slog.Debug(fmt.Sprintf("Failed to find file: %v", err))
			http.Error(w, "Internal Server Error (file lookup)", 500)
			return
		}

		u := User{}
		if err := db.Where("id = ?", fi.UserID).First(&u).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				http.Error(w, "No matching user found", 404)
				return
			}
			slog.Debug(fmt.Sprintf("Failed to find user: %v", err))
			http.Error(w, "Internal Server Error (user lookup)", 500)
			return
		}

		pfv, stat, err := generateProfileView(string(u.DID), db, ctx)
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to generate profile view: %v", err.Error()))
			http.Error(w, "Internal Server Error (profile view generation)", stat)
			return
		}

		c, err := cid.Decode(fi.BlobRef.String())
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to decode blob CID: %v", err))
			http.Error(w, "Internal Server Error (decoding blob CID)", 500)
			return
		}

		br := util.LexBlob{
			Ref:      util.LexLink(c),
			MimeType: fi.MimeType,
			Size:     fi.Size,
		}

		// todo update to v0.1.9
		o := skywell.GetUriFromSlug_Output{
			Cid: br.Ref.String(),
			Uri: fi.URI.String(),
			Did: pfv.Did,
		}

		b, err := json.Marshal(o)
		if err != nil {
			slog.Error(fmt.Sprintf("Failed to marshal content: %v", err))
			http.Error(w, "Internal Server Error (marshaling content)", 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, "%s", b)
	})

	// returns GetActorFiles_Output
	// removing because of legal liability I guess?
	// TODO make authenticated
	/*
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
				return
			}
			lim, err := strconv.Atoi(r.URL.Query().Get("limit"))
			if err != nil {
				http.Error(w, "Invalid 'limit' parameter", 400)
				return
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
	*/
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
