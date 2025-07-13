package main

import (
	"fmt"
	"log"
	"net/http"
	// skywell "github.com/saturn-vi/skywell/api/skywell"
)

func main() {
	fmt.Println("Server started!")

	go read()

	// returns ProfileView
	http.HandleFunc("/xrpc/dev.skywell.getActorProfile", func(w http.ResponseWriter, r *http.Request) {
	})

	// returns GetActorFiles_Output
	http.HandleFunc("/xrpc/dev.skywell.getActorFiles", func(w http.ResponseWriter, r *http.Request) {
	})

	log.Fatal(http.ListenAndServe(":8080", nil))
}
