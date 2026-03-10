// Command engine is the AILoom compiled engine binary.
//
// It loads and validates a cryptographic license file, then starts the HTTP API
// server on the configured port.
//
// Usage:
//
//	./ailoom-engine [--license path/to/license.lic] [--port 8000]
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"

	"github.com/JAntrobus/ailoom/engine/internal/license"
	"github.com/JAntrobus/ailoom/engine/internal/runner"
	"github.com/JAntrobus/ailoom/engine/internal/server"
	"github.com/JAntrobus/ailoom/engine/internal/store"
)

func main() {
	licPath := flag.String("license", "", "path to .ailoom.lic license file (optional)")
	port := flag.Int("port", 8000, "HTTP listen port")
	flag.Parse()

	// ── License ──────────────────────────────────────────────────────────────
	lic, err := license.Load(*licPath)
	if err != nil {
		log.Printf("⚠  License error: %v", err)
		log.Printf("   Falling back to Community edition.")
		lic = license.Community()
	}
	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════════════╗")
	fmt.Printf( "║  AILoom Engine                                               ║\n")
	fmt.Printf( "║  %-60s║\n", lic.Summary())
	fmt.Println("╚══════════════════════════════════════════════════════════════╝")
	fmt.Println()

	// ── Store, runner, server ─────────────────────────────────────────────────
	s := store.New()
	r := runner.New(s, lic)
	srv := server.New(s, lic, r)

	addr := fmt.Sprintf(":%d", *port)
	log.Printf("AILoom engine listening on %s", addr)
	if err := http.ListenAndServe(addr, srv); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
