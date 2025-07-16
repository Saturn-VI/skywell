package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"gorm.io/gorm"

	identity "github.com/bluesky-social/indigo/atproto/identity"
	syntax "github.com/bluesky-social/indigo/atproto/syntax"
	skywell "github.com/saturn-vi/skywell/api/skywell"
)

func main() {
	fmt.Println("Initializing database...")
	err := initializeDB()
	if err != nil {
		panic("Failed to initialize database: " + err.Error())
	}

	go read()

	// returns ProfileView
	http.HandleFunc("/xrpc/dev.skywell.getActorProfile", func(w http.ResponseWriter, r *http.Request) {
		pfv, stat, err := generateProfileView(r.URL.Query().Get("actor"))
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to generate profile view: %w", err.Error()), stat)
		}
		b, err := json.Marshal(pfv)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to marshal profile: %w", err.Error()), 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, "%s", b)
	})

	// var r skywell.GetActorFiles_Output

	// returns GetActorFiles_Output
	http.HandleFunc("/xrpc/dev.skywell.getActorFiles", func(w http.ResponseWriter, r *http.Request) {
		pfv, stat, err := generateProfileView(r.URL.Query().Get("actor"))
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to generate profile view: %w", err.Error()), stat)
			return
		}
		atid, err := syntax.ParseAtIdentifier(r.URL.Query().Get("actor"))
		if err != nil {
			http.Error(w, fmt.Sprintf("Invalid 'actor' parameter: %w", err.Error), 400)
		}
		lim, err := strconv.Atoi(r.URL.Query().Get("limit"))
		if err != nil {
			http.Error(w, fmt.Sprintf("Invalid 'limit' parameter: %w", err.Error), 400)
		}
		c, fl, stat, err := generateFileList(r.URL.Query().Get("cursor"), lim, *atid)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to generate file list: %w", err.Error()), stat)
			return
		}
		gaf_o := skywell.GetActorFiles_Output{
			Actor:    pfv,
			Cursor:   &c,
			Profiles: *fl, // TODO update when package updates
		}
		b, err := json.Marshal(gaf_o)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to marshal content: %w", err.Error()), 500)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, "%s", b)

	})

	fmt.Println("Server started!")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func generateProfileView(actor string) (profileView *skywell.Defs_ProfileView, httpResponse int, err error) {
	if actor == "" {
		return nil, 400, fmt.Errorf("Required parameter 'actor' missing")
	}

	at, err := syntax.ParseAtIdentifier(actor)
	if err != nil {
		return nil, 400, fmt.Errorf("Invalid 'actor' parameter: %w", err.Error())
	}

	id, err := identity.DefaultDirectory().Lookup(ctx, *at)
	user := User{}
	result := db.First(&user, "did = ?", id.DID.String())
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, 404, fmt.Errorf("Actor not found")
	} else if result.Error != nil {
		return nil, 500, fmt.Errorf("Failed to find actor: %s", result)
	}
	afc, err := getActorFileCount(id.DID)
	if err != nil {
		return nil, 500, fmt.Errorf("Failed to get actor file count: %s", err.Error())
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
func generateFileList(c string, limit int, a syntax.AtIdentifier) (cursor string, files *[]*skywell.Defs_FileView, httpResponse int, err error) {
	did, err := a.AsDID()
	if err != nil {
		return "", nil, 400, fmt.Errorf("Invalid 'actor' parameter: %w", err.Error())
	}
	user := User{}
	result := db.First(&user, "did = ?", did.String())
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return "", nil, 404, fmt.Errorf("Actor not found")
	} else if result.Error != nil {
		return "", nil, 500, fmt.Errorf("Failed to find actor: %s", result)
	}
	files = &[]*skywell.Defs_FileView{}
	query := db.Model(&File{}).Where("user_id = ?", user.ID).Order("created_at DESC").Limit(limit)
	if c == "" {
		// no cursor, just get the latest files
	} else {
		dt, err := time.Parse(layout string, value string) // it has to be a valid datetime
		if err != nil {
			return "", nil, 400, fmt.Errorf("Invalid 'cursor' parameter: %w", err.Error())
		}
	}

}

func userAgent() *string {
	str := "Skywell AppView v0.1.0"
	return &str
}
