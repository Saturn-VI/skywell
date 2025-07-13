package main

import (
	"fmt"
	"net/http"

	// skywell "github.com/saturn-vi/skywell/api/skywell"
)

func main() {
	fmt.Println("Server started!")

	// returns ProfileView
	http.HandleFunc("/xrpc/dev.skywell.getActorProfile", func(w http.ResponseWriter, r *http.Request) {

	})

	// returns FileView[]
	http.HandleFunc("/xrpc/dev.skywell.getActorFiles", func(w http.ResponseWriter, r *http.Request) {

	})
}
