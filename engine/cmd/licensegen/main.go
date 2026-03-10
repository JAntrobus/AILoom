// Command licensegen is the AILoom vendor tool for generating Ed25519 key pairs
// and issuing signed cryptographic license files.
//
// KEEP THE PRIVATE KEY SECRET.  Never commit vendor.key to version control.
//
// Subcommands:
//
//	keygen   – generate a new Ed25519 key pair
//	create   – issue a signed license file
//	verify   – verify an existing license file
//
// Examples:
//
//	./ailoom-licensegen keygen --pub public.key --priv vendor.key
//	./ailoom-licensegen create --priv vendor.key \
//	    --licensee "Acme Corp" --email admin@acme.com \
//	    --tier professional --expires 2026-12-31 \
//	    --out acme.ailoom.lic
//	./ailoom-licensegen verify --pub public.key --file acme.ailoom.lic
package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/JAntrobus/ailoom/engine/internal/license"
	"github.com/google/uuid"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}
	switch os.Args[1] {
	case "keygen":
		cmdKeygen(os.Args[2:])
	case "create":
		cmdCreate(os.Args[2:])
	case "verify":
		cmdVerify(os.Args[2:])
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand %q\n", os.Args[1])
		usage()
		os.Exit(1)
	}
}

func usage() {
	fmt.Println(`ailoom-licensegen – AILoom license management tool

Subcommands:
  keygen   generate a new Ed25519 key pair
  create   issue a signed license file
  verify   verify an existing license file

Run 'ailoom-licensegen <subcommand> -help' for flags.`)
}

// ── keygen ────────────────────────────────────────────────────────────────────

func cmdKeygen(args []string) {
	fs := flag.NewFlagSet("keygen", flag.ExitOnError)
	pubOut := fs.String("pub", "public.key", "output file for base64 public key")
	privOut := fs.String("priv", "vendor.key", "output file for base64 private key")
	_ = fs.Parse(args)

	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	must(err, "generating key pair")

	pubB64 := base64.StdEncoding.EncodeToString(pub)
	privB64 := base64.StdEncoding.EncodeToString(priv)

	must(os.WriteFile(*pubOut, []byte(pubB64+"\n"), 0644), "writing public key")
	must(os.WriteFile(*privOut, []byte(privB64+"\n"), 0600), "writing private key")

	fmt.Printf("✓ Key pair generated\n")
	fmt.Printf("  Public key  → %s\n", *pubOut)
	fmt.Printf("  Private key → %s  (KEEP SECRET)\n", *privOut)
	fmt.Printf("\nEmbed this public key in engine/internal/license/license.go:\n  %s\n", pubB64)
}

// ── create ────────────────────────────────────────────────────────────────────

func cmdCreate(args []string) {
	fs := flag.NewFlagSet("create", flag.ExitOnError)
	privFile := fs.String("priv", "vendor.key", "path to private key file")
	licensee := fs.String("licensee", "", "licensee name (required)")
	email := fs.String("email", "", "licensee email (required)")
	tier := fs.String("tier", "professional", "license tier: professional | enterprise")
	expires := fs.String("expires", "", "expiry date YYYY-MM-DD (required)")
	maxProjects := fs.Int("max-projects", 0, "max projects (0 = unlimited)")
	maxAgents := fs.Int("max-agents", 0, "max agents per workflow (0 = unlimited)")
	out := fs.String("out", "license.ailoom.lic", "output license file")
	_ = fs.Parse(args)

	if *licensee == "" || *email == "" || *expires == "" {
		fmt.Fprintln(os.Stderr, "error: --licensee, --email and --expires are required")
		fs.Usage()
		os.Exit(1)
	}

	// Load private key
	privRaw, err := os.ReadFile(*privFile)
	must(err, "reading private key")
	privBytes, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(privRaw)))
	must(err, "decoding private key")
	privKey := ed25519.PrivateKey(privBytes)

	// Parse expiry
	exp, err := time.Parse("2006-01-02", *expires)
	must(err, "parsing expiry date (use YYYY-MM-DD)")
	exp = exp.UTC().Add(23*time.Hour + 59*time.Minute + 59*time.Second)

	// Build features from tier
	var tierName string
	switch *tier {
	case license.TierProfessional, license.TierEnterprise:
		tierName = *tier
	default:
		fmt.Fprintf(os.Stderr, "unknown tier %q, using 'professional'\n", *tier)
		tierName = license.TierProfessional
	}

	featuresByTier := map[string][]string{
		license.TierProfessional: {
			license.FeatureMultiAgent, license.FeatureAnalytics, license.FeatureAdvancedWorkflow,
		},
		license.TierEnterprise: {
			license.FeatureMultiAgent, license.FeatureAnalytics, license.FeatureAdvancedWorkflow,
			license.FeatureAuditLog, license.FeatureCustomPlugins, license.FeaturePriorityExecution,
		},
	}

	payload := license.Payload{
		ID:          uuid.New().String(),
		Licensee:    *licensee,
		Email:       *email,
		Tier:        tierName,
		Features:    featuresByTier[tierName],
		MaxProjects: *maxProjects,
		MaxAgents:   *maxAgents,
		IssuedAt:    time.Now().UTC(),
		ExpiresAt:   exp,
	}

	sig, err := license.Sign(payload, privKey)
	must(err, "signing payload")

	lf := license.File{Payload: payload, Signature: sig}
	jsonBytes, err := json.MarshalIndent(lf, "", "  ")
	must(err, "marshalling license")

	b64 := base64.StdEncoding.EncodeToString(jsonBytes)
	content := "-----BEGIN AILOOM LICENSE-----\n" + b64 + "\n-----END AILOOM LICENSE-----\n"

	must(os.WriteFile(*out, []byte(content), 0644), "writing license file")

	fmt.Printf("✓ License created → %s\n", *out)
	fmt.Printf("  Licensee : %s <%s>\n", payload.Licensee, payload.Email)
	fmt.Printf("  Tier     : %s\n", payload.Tier)
	fmt.Printf("  Features : %s\n", strings.Join(payload.Features, ", "))
	fmt.Printf("  Expires  : %s\n", exp.Format("2006-01-02"))
}

// ── verify ────────────────────────────────────────────────────────────────────

func cmdVerify(args []string) {
	fs := flag.NewFlagSet("verify", flag.ExitOnError)
	file := fs.String("file", "", "license file to verify (required)")
	_ = fs.Parse(args)

	if *file == "" {
		fmt.Fprintln(os.Stderr, "error: --file is required")
		os.Exit(1)
	}

	lic, err := license.Load(*file)
	if err != nil {
		fmt.Fprintf(os.Stderr, "✗ INVALID: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("✓ LICENSE VALID")
	fmt.Println(lic.Summary())
	fmt.Printf("  Features: %s\n", strings.Join(lic.Payload.Features, ", "))
}

func must(err error, msg string) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "error %s: %v\n", msg, err)
		os.Exit(1)
	}
}
