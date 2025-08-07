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

	"github.com/bluesky-social/indigo/atproto/auth"
	identity "github.com/bluesky-social/indigo/atproto/identity"
	syntax "github.com/bluesky-social/indigo/atproto/syntax"
	"github.com/bluesky-social/indigo/lex/util"
	"github.com/ipfs/go-cid"
	skywell "github.com/saturn-vi/skywell/api/skywell"
)

const PORT string = ":4999"
const SKYWELL_DID syntax.DID = "did:plc:tsaj4ffwyj5z6rjqaxmg5cp4"
const SKYWELL_SERVICE_ID string = "#skywell_server"
const USER_AGENT string = "Skywell AppView v0.1.12"

var cacheDir identity.CacheDirectory = identity.NewCacheDirectory(identity.DefaultDirectory(), 0, 0, 0, 0)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	slog.SetLogLoggerLevel(slog.LevelDebug)
	slog.Info("Initializing database...")
	db, client, err := initializeDB()

	if err != nil {
		slog.Error("Failed to initialize database", "error", err)
		panic("Failed to initialize database: " + err.Error())
	}

	slog.Info("Initializing HTTP server...")
	initializeHandleFuncs(db, ctx)

	handler := corsMiddleware(http.DefaultServeMux)
	server := &http.Server{Addr: PORT, Handler: handler}

	slog.Info("Reading from Jetstream...")
	go read(db, client, ctx)

	go func() {
		slog.Info("Server started!", "port", PORT)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server error", "error", err, "port", PORT)
		}
	}()

	<-ctx.Done()
	slog.Info("Shutting down server...")

	sCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(sCtx); err != nil {
		slog.Error("Server failed to shutdown (???)", "error", err)
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
		slog.Debug("Received request", "endpoint", "/xrpc/dev.skywell.getActorProfile", "remote_addr", r.RemoteAddr)
		actor := r.URL.Query().Get("actor")
		if actor == "" {
			slog.Warn("Missing required parameter", "endpoint", "/xrpc/dev.skywell.getActorProfile", "parameter", "actor")
			http.Error(w, "Required parameter 'actor' missing", 400)
			return
		}
		did, err := syntax.ParseDID(actor)
		if err != nil {
			slog.Error("Failed to parse DID", "actor", actor, "error", err, "endpoint", "/xrpc/dev.skywell.getActorProfile")
			http.Error(w, "Invalid 'actor' parameter", 400)
			return
		}
		view, stat, err := generateProfileView(did, db, ctx)
		if err != nil {
			slog.Error("Failed to generate profile view", "did", did.String(), "status", stat, "error", err)
			http.Error(w, "Internal Server Error (profile view generation)", stat)
			return
		}
		b, err := json.Marshal(view)
		if err != nil {
			slog.Error("Failed to marshal profile", "did", did.String(), "error", err)
			http.Error(w, "Internal Server Error (marshaling content)", 500)
			return
		}
		slog.Debug("Returning profile response", "actor", actor, "did", did.String(), "response_size", len(b))
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, "%s", b)
	})

	// returns GetFileFromSlug_Output
	http.HandleFunc("/xrpc/dev.skywell.getFileFromSlug", func(w http.ResponseWriter, r *http.Request) {
		// based on slug, get:
		// URI, CID, and DID
		slog.Debug("Received request", "endpoint", "/xrpc/dev.skywell.getFileFromSlug", "remote_addr", r.RemoteAddr)
		slug := r.URL.Query().Get("slug")
		if slug == "" {
			slog.Warn("Missing required parameter", "endpoint", "/xrpc/dev.skywell.getFileFromSlug", "parameter", "slug")
			http.Error(w, "Required parameter 'slug' missing", 400)
			return
		}
		fk := FileKey{}
		if err := db.Where("key = ?", slug).First(&fk).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				slog.Debug("File key not found", "slug", slug)
				http.Error(w, "No matching slug found", 404)
				return
			}
			slog.Error("Failed to find file key", "slug", slug, "error", err)
			http.Error(w, "Internal Server Error (file key lookup)", 500)
			return
		}
		fi := File{}
		if err := db.Where("id = ?", fk.File).First(&fi).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				slog.Debug("File not found", "file_id", fk.File, "slug", slug)
				http.Error(w, "No matching file found", 404)
				return
			}
			slog.Error("Failed to find file", "file_id", fk.File, "slug", slug, "error", err)
			http.Error(w, "Internal Server Error (file lookup)", 500)
			return
		}
		u := User{}
		if err := db.Where("id = ?", fi.UserID).First(&u).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				slog.Debug("User not found", "user_id", fi.UserID, "file_id", fi.ID, "slug", slug)
				http.Error(w, "No matching user found", 404)
				return
			}
			slog.Error("Failed to find user", "user_id", fi.UserID, "file_id", fi.ID, "slug", slug, "error", err)
			http.Error(w, "Internal Server Error (user lookup)", 500)
			return
		}

		profile, stat, err := generateProfileView(u.DID, db, ctx)
		if err != nil {
			slog.Error("Failed to generate profile view", "did", u.DID.String(), "status", stat, "slug", slug, "error", err)
			http.Error(w, "Internal Server Error (profile view generation)", stat)
			return
		}

		fileView, stat, err := generateFileView(fi.ID, db)
		if err != nil {
			slog.Error("Failed to generate file view", "file_id", fi.ID, "status", stat, "slug", slug, "error", err)
			http.Error(w, "Internal Server Error (file view generation)", stat)
			return
		}

		o := skywell.GetFileFromSlug_Output{
			Cid:   fi.CID.String(),
			Uri:   fi.URI.String(),
			File:  fileView,
			Actor: profile,
		}

		b, err := json.Marshal(o)
		if err != nil {
			slog.Error("Failed to marshal file response", "slug", slug, "file_id", fi.ID, "error", err)
			http.Error(w, "Internal Server Error (marshaling content)", 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		slog.Debug("Returning file response", "slug", slug, "file_id", fi.ID, "response_size", len(b))
		fmt.Fprintf(w, "%s", b)
	})

	// returns GetActorFiles_Output
	http.HandleFunc("/xrpc/dev.skywell.getActorFiles", func(w http.ResponseWriter, r *http.Request) {
		slog.Debug("Received request", "endpoint", "/xrpc/dev.skywell.getActorFiles", "remote_addr", r.RemoteAddr)
		did, err := verifyJWT(ctx, r)
		if err != nil {
			slog.Error("Failed to verify JWT", "error", err, "remote_addr", r.RemoteAddr)
			http.Error(w, "Internal Server Error (JWT verification)", 500)
			return
		}
		a := r.URL.Query().Get("actor")
		if a == "" {
			slog.Warn("Missing required parameter", "endpoint", "/xrpc/dev.skywell.getActorFiles", "parameter", "actor", "did", did.String())
			http.Error(w, "Required parameter 'actor' missing", 400)
			return
		}
		if did.String() != a {
			slog.Error("JWT issuer mismatch", "jwt_iss", did.String(), "actor_param", a)
			http.Error(w, "JWT 'iss' does not match 'actor' parameter", 403)
			return
		}
		profile, stat, err := generateProfileView(did, db, ctx)
		if err != nil {
			slog.Error("Failed to generate profile view", "did", did.String(), "status", stat, "error", err)
			http.Error(w, "Internal Server Error (profile view generation)", stat)
			return
		}
		var limit int = 50 // default limit
		if l := r.URL.Query().Get("limit"); l != "" {
			limit, err = strconv.Atoi(l)
			if err != nil {
				slog.Error("Invalid limit parameter", "limit_param", l, "did", did.String(), "error", err)
				http.Error(w, "Invalid 'limit' parameter", 400)
				return
			}
		}
		c, files, stat, err := generateFileList(r.URL.Query().Get("cursor"), limit, did, db)
		if err != nil {
			slog.Error("Failed to generate file list", "did", did.String(), "limit", limit, "status", stat, "error", err)
			http.Error(w, "Internal Server Error (file list generation)", stat)
			return
		}
		resp := skywell.GetActorFiles_Output{
			Actor:  profile,
			Cursor: &c,
			Files:  *files,
		}

		b, err := json.Marshal(resp)
		if err != nil {
			slog.Error("Failed to marshal actor files response", "did", did.String(), "file_count", len(*files), "error", err)
			http.Error(w, "Internal Server Error (marshaling content)", 500)
			return
		}
		slog.Debug("Returning actor files response", "did", did.String(), "file_count", len(*files), "response_size", len(b))
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, "%s", b)
	})
}

func verifyJWT(ctx context.Context, r *http.Request) (did syntax.DID, err error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return "", fmt.Errorf("Authorization header missing")
	}

	if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
		return "", fmt.Errorf("Invalid Authorization header format")
	}

	tokStr := authHeader[7:]

	slog.Debug("Processing JWT token", "token", tokStr, "token_length", len(tokStr))

	validator := &auth.ServiceAuthValidator{
		Audience:        SKYWELL_DID.String(),
		Dir:             &cacheDir,
		TimestampLeeway: 10 * time.Second,
	}

	issuerDID, err := validator.Validate(ctx, tokStr, nil)
	if err != nil {
		slog.Error("JWT validation failed", "error", err)
		return "", fmt.Errorf("JWT validation failed: %w", err)
	}

	slog.Debug("JWT validated successfully", "issuer", issuerDID, "audience", SKYWELL_DID)
	return issuerDID, nil
}

func generateFileView(fileID uint, db *gorm.DB) (fileView *skywell.Defs_FileView, httpResponse int, err error) {
	file := File{}
	result := db.First(&file, "id = ?", fileID)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, 404, fmt.Errorf("File not found")
	} else if result.Error != nil {
		return nil, 500, fmt.Errorf("Failed to find file: %w", result.Error)
	}

	c, err := cid.Decode(file.BlobRef.String())
	if err != nil {
		return nil, 500, fmt.Errorf("Failed to decode blob CID: %w", err)
	}

	fileView = &skywell.Defs_FileView{
		Blob: &util.LexBlob{
			Ref:      util.LexLink(c),
			MimeType: file.MimeType,
			Size:     file.Size,
		},
		CreatedAt:   file.CreatedAt.String(),
		Name:        file.Name,
		Description: &file.Description,
	}

	return fileView, 200, nil
}

func generateProfileView(did syntax.DID, db *gorm.DB, ctx context.Context) (profileView *skywell.Defs_ProfileView, httpResponse int, err error) {
	id, err := cacheDir.Lookup(ctx, did.AtIdentifier())
	if err != nil {
		slog.Error("Failed to lookup DID in cache", "did", did.String(), "error", err)
		return nil, 500, fmt.Errorf("Failed to lookup DID in cache: %w", err)
	}
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
		fk := FileKey{}
		if err := db.Where("file = ?", f.ID).First(&fk).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				slog.Debug("No file key found", "file_id", f.ID)
				continue
			}
			return "", nil, 500, fmt.Errorf("Failed to find file key: %w", err)
		}
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
			Slug:        fk.Key,
			Description: &f.Description,
		})
	}
	if len(*files) == 0 {
		return "", fileviews, 200, nil
	}
	cursor = strconv.FormatInt(((*files)[len(*files)-1].IndexedAt), 10)
	return cursor, fileviews, 200, nil
}

func userAgent() *string {
	str := USER_AGENT
	return &str
}
