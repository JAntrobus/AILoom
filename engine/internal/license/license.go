// Package license implements Ed25519-signed cryptographic license file loading,
// validation, and feature-gate checks for the AILoom engine.
//
// License hierarchy:
//
//	Community    – no license file; capped at 3 projects / 1 agent per workflow
//	Professional – multi-agent workflows, analytics, unlimited projects
//	Enterprise   – all Professional features + audit log, custom plugins,
//	               priority execution, advanced workflow branching
//
// The vendor's Ed25519 PUBLIC key is compiled into the binary (embeddedPublicKey).
// Only the corresponding PRIVATE key (kept secret by the vendor) can produce
// signatures that pass verification, making license forgery computationally
// infeasible.
package license

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

// embeddedPublicKey is the vendor's Ed25519 public key compiled into the binary.
// Rotate by re-running `./ailoom-licensegen keygen` and recompiling the engine.
//
// THIS KEY MUST MATCH THE PRIVATE KEY USED BY THE LICENSEGEN TOOL.
// DO NOT COMMIT THE PRIVATE KEY TO VERSION CONTROL.
var embeddedPublicKey = mustDecodeKey("6Jj63fVi0NSrODfNhYuKcI+qGMMRV2dlYzy9fEMCXzA=")

func mustDecodeKey(b64 string) ed25519.PublicKey {
	b, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		panic("ailoom: invalid embedded public key constant: " + err.Error())
	}
	return ed25519.PublicKey(b)
}

// ── Tier constants ─────────────────────────────────────────────────────────────

const (
	TierCommunity    = "community"    // no license file (default)
	TierProfessional = "professional" // paid
	TierEnterprise   = "enterprise"   // paid, premium
)

// ── Feature-flag constants ─────────────────────────────────────────────────────

const (
	// FeatureMultiAgent enables workflows with more than one agent step.
	FeatureMultiAgent = "multi_agent"
	// FeatureAnalytics enables run-history analytics and metrics endpoints.
	FeatureAnalytics = "analytics"
	// FeatureAdvancedWorkflow enables conditional branching in workflows.
	FeatureAdvancedWorkflow = "advanced_workflow"
	// FeatureAuditLog enables detailed, tamper-evident audit logging.
	FeatureAuditLog = "audit_log"
	// FeatureCustomPlugins allows loading third-party agent plugins.
	FeatureCustomPlugins = "custom_plugins"
	// FeaturePriorityExecution enables priority-queue scheduling for runs.
	FeaturePriorityExecution = "priority_execution"
)

// featuresForTier returns the canonical feature set for a given tier.
func featuresForTier(tier string) []string {
	switch tier {
	case TierProfessional:
		return []string{
			FeatureMultiAgent,
			FeatureAnalytics,
			FeatureAdvancedWorkflow,
		}
	case TierEnterprise:
		return []string{
			FeatureMultiAgent,
			FeatureAnalytics,
			FeatureAdvancedWorkflow,
			FeatureAuditLog,
			FeatureCustomPlugins,
			FeaturePriorityExecution,
		}
	default:
		return nil
	}
}

// ── License file types ─────────────────────────────────────────────────────────

// Payload is the signed body of a license file.
// Any change to a field value invalidates the Ed25519 signature.
type Payload struct {
	ID          string    `json:"id"`
	Licensee    string    `json:"licensee"`
	Email       string    `json:"email"`
	Tier        string    `json:"tier"`
	Features    []string  `json:"features"`
	MaxProjects int       `json:"max_projects"` // <=0 means unlimited
	MaxAgents   int       `json:"max_agents"`   // <=0 means unlimited per workflow
	IssuedAt    time.Time `json:"issued_at"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// File is the on-disk JSON representation of a license.
type File struct {
	Payload   Payload `json:"payload"`
	Signature string  `json:"signature"` // base64url Ed25519 sig over canonical JSON(Payload)
}

// ── License (runtime) ─────────────────────────────────────────────────────────

// License is a validated, in-memory license ready for feature-gate checks.
type License struct {
	Payload Payload
	feats   map[string]bool
}

// Community returns a default Community-tier pseudo-license with no paid features.
func Community() *License {
	return &License{
		Payload: Payload{
			Tier:        TierCommunity,
			MaxProjects: 3,
			MaxAgents:   1, // single-agent workflows only
		},
		feats: map[string]bool{},
	}
}

// HasFeature returns true when the active license grants the named feature flag.
func (l *License) HasFeature(feature string) bool {
	return l.feats[feature]
}

// MaxProjectsAllowed returns the configured project cap (0 = unlimited).
func (l *License) MaxProjectsAllowed() int { return l.Payload.MaxProjects }

// MaxAgentsPerWorkflow returns the configured per-workflow agent cap (0 = unlimited).
func (l *License) MaxAgentsPerWorkflow() int { return l.Payload.MaxAgents }

// IsExpired returns true when the license has passed its ExpiresAt date.
func (l *License) IsExpired() bool {
	if l.Payload.ExpiresAt.IsZero() {
		return false
	}
	return time.Now().UTC().After(l.Payload.ExpiresAt.UTC())
}

// Summary returns a human-readable summary string for logging / the API.
func (l *License) Summary() string {
	if l.Payload.Tier == TierCommunity || l.Payload.Licensee == "" {
		return "AILoom Community Edition (no license file)"
	}
	return fmt.Sprintf("AILoom %s – licensed to %s <%s>, expires %s",
		strings.Title(l.Payload.Tier), //nolint:staticcheck
		l.Payload.Licensee,
		l.Payload.Email,
		l.Payload.ExpiresAt.Format("2006-01-02"),
	)
}

// ── Loading ────────────────────────────────────────────────────────────────────

// Load reads and validates a license file.
//
// If path is empty or the file does not exist, Community() is returned without
// error so the engine degrades gracefully rather than failing to start.
//
// Returns an error (and Community) when the file exists but is malformed,
// tampered with, or expired.
func Load(path string) (*License, error) {
	if path == "" {
		return Community(), nil
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Community(), nil
		}
		return Community(), fmt.Errorf("reading license file %q: %w", path, err)
	}
	lic, err := parse(raw)
	if err != nil {
		return Community(), err
	}
	return lic, nil
}

// parse decodes, verifies and constructs a License from raw file bytes.
func parse(raw []byte) (*License, error) {
	// Strip optional PEM-style wrapper (-----BEGIN/END AILOOM LICENSE-----)
	s := strings.TrimSpace(string(raw))
	s = strings.TrimPrefix(s, "-----BEGIN AILOOM LICENSE-----")
	s = strings.TrimSuffix(s, "-----END AILOOM LICENSE-----")
	s = strings.TrimSpace(s)

	// Outer envelope may be plain JSON or base64-wrapped JSON
	var jsonBytes []byte
	if b, err := base64.StdEncoding.DecodeString(s); err == nil {
		jsonBytes = b
	} else {
		jsonBytes = []byte(s)
	}

	var lf File
	if err := json.Unmarshal(jsonBytes, &lf); err != nil {
		return nil, fmt.Errorf("malformed license file: %w", err)
	}

	// Re-serialise the payload with sorted keys to get the canonical bytes that
	// were signed.  json.Marshal already produces sorted keys in Go.
	payloadBytes, err := json.Marshal(lf.Payload)
	if err != nil {
		return nil, fmt.Errorf("re-encoding payload for verification: %w", err)
	}

	// Decode the signature (accept both base64url and standard encoding)
	sigBytes, err := base64.URLEncoding.DecodeString(lf.Signature)
	if err != nil {
		sigBytes, err = base64.StdEncoding.DecodeString(lf.Signature)
		if err != nil {
			return nil, fmt.Errorf("invalid signature encoding in license file: %w", err)
		}
	}

	// Verify the Ed25519 signature against the compiled-in public key
	if !ed25519.Verify(embeddedPublicKey, payloadBytes, sigBytes) {
		return nil, errors.New(
			"license signature verification failed: the license file is invalid, " +
				"tampered with, or was not issued by the authorised vendor",
		)
	}

	// Expiry check
	if !lf.Payload.ExpiresAt.IsZero() && time.Now().UTC().After(lf.Payload.ExpiresAt.UTC()) {
		return nil, fmt.Errorf("license expired on %s", lf.Payload.ExpiresAt.Format("2006-01-02"))
	}

	// Build feature map
	feats := make(map[string]bool, len(lf.Payload.Features))
	for _, f := range lf.Payload.Features {
		feats[f] = true
	}

	return &License{Payload: lf.Payload, feats: feats}, nil
}

// Sign produces an Ed25519 signature over the canonical JSON encoding of p
// using the provided private key.  Used only by the licensegen tool.
func Sign(p Payload, privKey ed25519.PrivateKey) (string, error) {
	b, err := json.Marshal(p)
	if err != nil {
		return "", err
	}
	sig := ed25519.Sign(privKey, b)
	return base64.URLEncoding.EncodeToString(sig), nil
}
