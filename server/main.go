package main

import (
	"fmt"
	"log"
	"net/http"
	// skywell "github.com/saturn-vi/skywell/api/skywell"
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
	})

	// returns GetActorFiles_Output
	http.HandleFunc("/xrpc/dev.skywell.getActorFiles", func(w http.ResponseWriter, r *http.Request) {
	})

	fmt.Println("Server started!")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func userAgent() *string {
	str := "Skywell AppView v0.1.0"
	return &str
}
