// Package server implements the AILoom HTTP API.
//
// All endpoints match the Python FastAPI contract so the React frontend works
// unchanged.  Additional endpoints expose license and feature information.
package server

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/JAntrobus/ailoom/engine/internal/license"
	"github.com/JAntrobus/ailoom/engine/internal/runner"
	"github.com/JAntrobus/ailoom/engine/internal/store"
)

// Server holds the HTTP mux and all dependencies.
type Server struct {
	mux    *http.ServeMux
	store  *store.Store
	lic    *license.License
	runner *runner.Runner
}

// New wires up all routes and returns a ready-to-serve Server.
func New(s *store.Store, lic *license.License, r *runner.Runner) *Server {
	srv := &Server{mux: http.NewServeMux(), store: s, lic: lic, runner: r}
	srv.routes()
	return srv
}

// ServeHTTP implements http.Handler, adding CORS headers to every response.
func (srv *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	log.Printf("%s %s", r.Method, r.URL.Path)
	srv.mux.ServeHTTP(w, r)
}

func (srv *Server) routes() {
	// Stats & license
	srv.mux.HandleFunc("GET /api/stats", srv.handleStats)
	srv.mux.HandleFunc("GET /api/license", srv.handleLicense)
	srv.mux.HandleFunc("GET /api/features", srv.handleFeatures)

	// Platforms
	srv.mux.HandleFunc("GET /api/platforms", srv.handleListPlatforms)
	srv.mux.HandleFunc("POST /api/platforms", srv.handleCreatePlatform)
	srv.mux.HandleFunc("GET /api/platforms/{id}", srv.handleGetPlatform)
	srv.mux.HandleFunc("DELETE /api/platforms/{id}", srv.handleDeletePlatform)
	srv.mux.HandleFunc("GET /api/platforms/{id}/models", srv.handlePlatformModels)

	// Agents
	srv.mux.HandleFunc("GET /api/agents", srv.handleListAgents)
	srv.mux.HandleFunc("POST /api/agents", srv.handleCreateAgent)
	srv.mux.HandleFunc("GET /api/agents/{id}", srv.handleGetAgent)
	srv.mux.HandleFunc("DELETE /api/agents/{id}", srv.handleDeleteAgent)
	srv.mux.HandleFunc("GET /api/agents/{id}/memory", srv.handleAgentMemory)

	// Workflows
	srv.mux.HandleFunc("GET /api/workflows", srv.handleListWorkflows)
	srv.mux.HandleFunc("POST /api/workflows", srv.handleCreateWorkflow)
	srv.mux.HandleFunc("GET /api/workflows/{id}", srv.handleGetWorkflow)
	srv.mux.HandleFunc("PUT /api/workflows/{id}", srv.handleUpdateWorkflow)
	srv.mux.HandleFunc("GET /api/workflows/{id}/memory", srv.handleWorkflowMemory)

	// Projects
	srv.mux.HandleFunc("GET /api/projects", srv.handleListProjects)
	srv.mux.HandleFunc("POST /api/projects", srv.handleCreateProject)
	srv.mux.HandleFunc("GET /api/projects/{id}", srv.handleGetProject)
	srv.mux.HandleFunc("PUT /api/projects/{id}", srv.handleUpdateProject)
	srv.mux.HandleFunc("DELETE /api/projects/{id}", srv.handleDeleteProject)

	// Runs
	srv.mux.HandleFunc("GET /api/runs", srv.handleListAllRuns)
	srv.mux.HandleFunc("GET /api/runs/{id}", srv.handleGetRun)
	srv.mux.HandleFunc("DELETE /api/runs/{id}", srv.handleDeleteRun)
	srv.mux.HandleFunc("GET /api/runs/{id}/memory", srv.handleRunMemory)
	srv.mux.HandleFunc("GET /api/projects/{id}/runs", srv.handleListProjectRuns)
	srv.mux.HandleFunc("POST /api/projects/{id}/runs", srv.handleCreateRun)

	// Skills
	srv.mux.HandleFunc("GET /api/skills", srv.handleListSkills)
	srv.mux.HandleFunc("POST /api/skills", srv.handleCreateSkill)
	srv.mux.HandleFunc("GET /api/skills/{id}", srv.handleGetSkill)
	srv.mux.HandleFunc("PUT /api/skills/{id}", srv.handleUpdateSkill)
	srv.mux.HandleFunc("DELETE /api/skills/{id}", srv.handleDeleteSkill)

	// Memory (generic create / delete)
	srv.mux.HandleFunc("POST /api/memory", srv.handleCreateMemory)
	srv.mux.HandleFunc("DELETE /api/memory/{id}", srv.handleDeleteMemory)
}

// ── helpers ────────────────────────────────────────────────────────────────────

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("encode error: %v", err)
	}
}

func jsonErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"detail": msg})
}

func decode(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}

var providerModels = map[store.ProviderType][]string{
	store.ProviderOpenAI:    {"gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"},
	store.ProviderAnthropic: {"claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"},
	store.ProviderAzure:     {"gpt-4o", "gpt-4-turbo"},
	store.ProviderGoogle:    {"gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"},
	store.ProviderCustom:    {},
}

// ── Stats & License ────────────────────────────────────────────────────────────

func (srv *Server) handleStats(w http.ResponseWriter, _ *http.Request) {
	runs := srv.store.AllRuns()
	active, completed := 0, 0
	for _, r := range runs {
		if r.Status == store.StatusRunning {
			active++
		}
		if r.Status == store.StatusCompleted {
			completed++
		}
	}
	jsonOK(w, map[string]any{
		"projects":       len(srv.store.AllProjects()),
		"active_runs":    active,
		"completed_runs": completed,
		"total_runs":     len(runs),
		"agents":         len(srv.store.AllAgents()),
		"platforms":      len(srv.store.AllPlatforms()),
		"skills":         len(srv.store.AllSkills()),
	})
}

func (srv *Server) handleLicense(w http.ResponseWriter, _ *http.Request) {
	p := srv.lic.Payload
	jsonOK(w, map[string]any{
		"tier":         p.Tier,
		"licensee":     p.Licensee,
		"email":        p.Email,
		"features":     p.Features,
		"max_projects": p.MaxProjects,
		"max_agents":   p.MaxAgents,
		"issued_at":    p.IssuedAt,
		"expires_at":   p.ExpiresAt,
		"is_expired":   srv.lic.IsExpired(),
		"summary":      srv.lic.Summary(),
	})
}

func (srv *Server) handleFeatures(w http.ResponseWriter, _ *http.Request) {
	features := []map[string]any{
		{
			"id":          license.FeatureMultiAgent,
			"name":        "Multi-Agent Workflows",
			"description": "Run workflows with more than one agent step",
			"enabled":     srv.lic.HasFeature(license.FeatureMultiAgent),
			"tier":        "professional",
		},
		{
			"id":          license.FeatureAnalytics,
			"name":        "Analytics",
			"description": "Run-history analytics and performance metrics",
			"enabled":     srv.lic.HasFeature(license.FeatureAnalytics),
			"tier":        "professional",
		},
		{
			"id":          license.FeatureAdvancedWorkflow,
			"name":        "Advanced Workflow",
			"description": "Conditional branching and loops in workflow definitions",
			"enabled":     srv.lic.HasFeature(license.FeatureAdvancedWorkflow),
			"tier":        "professional",
		},
		{
			"id":          license.FeatureAuditLog,
			"name":        "Audit Log",
			"description": "Tamper-evident detailed audit trail for all operations",
			"enabled":     srv.lic.HasFeature(license.FeatureAuditLog),
			"tier":        "enterprise",
		},
		{
			"id":          license.FeatureCustomPlugins,
			"name":        "Custom Plugins",
			"description": "Load and run third-party agent plugins",
			"enabled":     srv.lic.HasFeature(license.FeatureCustomPlugins),
			"tier":        "enterprise",
		},
		{
			"id":          license.FeaturePriorityExecution,
			"name":        "Priority Execution",
			"description": "Priority-queue scheduling for time-sensitive runs",
			"enabled":     srv.lic.HasFeature(license.FeaturePriorityExecution),
			"tier":        "enterprise",
		},
	}
	jsonOK(w, features)
}

// ── Platforms ──────────────────────────────────────────────────────────────────

func (srv *Server) handleListPlatforms(w http.ResponseWriter, _ *http.Request) {
	jsonOK(w, srv.store.AllPlatforms())
}

func (srv *Server) handleGetPlatform(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, ok := srv.store.GetPlatform(id)
	if !ok { jsonErr(w, 404, "platform not found"); return }
	jsonOK(w, p)
}

type createPlatformReq struct {
	Name     string             `json:"name"`
	Provider store.ProviderType `json:"provider"`
	APIKey   string             `json:"api_key"`
	BaseURL  string             `json:"base_url"`
}

func (srv *Server) handleCreatePlatform(w http.ResponseWriter, r *http.Request) {
	// License gate: Community is limited to 1 platform
	if srv.lic.Payload.Tier == license.TierCommunity && len(srv.store.AllPlatforms()) >= 1 {
		jsonErr(w, 403, "community license: maximum 1 platform – upgrade to Professional to add more")
		return
	}
	var req createPlatformReq
	if err := decode(r, &req); err != nil { jsonErr(w, 400, err.Error()); return }
	hint := ""
	if len(req.APIKey) >= 4 {
		hint = "..." + req.APIKey[len(req.APIKey)-4:]
	}
	models := providerModels[req.Provider]
	p := &store.Platform{
		ID: store.NewID(), Name: req.Name, Provider: req.Provider,
		APIKeyHint: hint, BaseURL: req.BaseURL,
		Models: models, IsConnected: true, CreatedAt: time.Now().UTC(),
	}
	srv.store.SetPlatform(p)
	w.WriteHeader(http.StatusCreated)
	jsonOK(w, p)
}

func (srv *Server) handleDeletePlatform(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := srv.store.GetPlatform(id); !ok { jsonErr(w, 404, "platform not found"); return }
	srv.store.DelPlatform(id)
	w.WriteHeader(http.StatusNoContent)
}

func (srv *Server) handlePlatformModels(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, ok := srv.store.GetPlatform(id)
	if !ok { jsonErr(w, 404, "platform not found"); return }
	jsonOK(w, map[string][]string{"models": p.Models})
}

// ── Agents ─────────────────────────────────────────────────────────────────────

func (srv *Server) handleListAgents(w http.ResponseWriter, _ *http.Request) {
	jsonOK(w, srv.store.AllAgents())
}

func (srv *Server) handleGetAgent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	a, ok := srv.store.GetAgent(id)
	if !ok { jsonErr(w, 404, "agent not found"); return }
	jsonOK(w, a)
}

type createAgentReq struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	PlatformID   string   `json:"platform_id"`
	Model        string   `json:"model"`
	SystemPrompt string   `json:"system_prompt"`
	Steps        []string `json:"steps"`
	SkillIDs     []string `json:"skill_ids"`
}

func (srv *Server) handleCreateAgent(w http.ResponseWriter, r *http.Request) {
	// License gate: Community is limited to 2 agents
	if srv.lic.Payload.Tier == license.TierCommunity && len(srv.store.AllAgents()) >= 2 {
		jsonErr(w, 403, "community license: maximum 2 agents – upgrade to Professional to add more")
		return
	}
	var req createAgentReq
	if err := decode(r, &req); err != nil { jsonErr(w, 400, err.Error()); return }
	if _, ok := srv.store.GetPlatform(req.PlatformID); !ok {
		jsonErr(w, 400, "platform not found"); return
	}
	steps := req.Steps
	if steps == nil { steps = []string{} }
	skillIDs := req.SkillIDs
	if skillIDs == nil { skillIDs = []string{} }
	a := &store.Agent{
		ID: store.NewID(), Name: req.Name, Description: req.Description,
		PlatformID: req.PlatformID, Model: req.Model,
		Status: store.AgentIdle, CreatedAt: time.Now().UTC(),
		SystemPrompt: req.SystemPrompt,
		Steps:        steps,
		SkillIDs:     skillIDs,
	}
	srv.store.SetAgent(a)
	w.WriteHeader(http.StatusCreated)
	jsonOK(w, a)
}

func (srv *Server) handleAgentMemory(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := srv.store.GetAgent(id); !ok { jsonErr(w, 404, "agent not found"); return }
	jsonOK(w, srv.store.MemoriesByScope(store.MemoryScopeAgent, id))
}

func (srv *Server) handleDeleteAgent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := srv.store.GetAgent(id); !ok { jsonErr(w, 404, "agent not found"); return }
	srv.store.DelAgent(id)
	w.WriteHeader(http.StatusNoContent)
}

// ── Workflows ──────────────────────────────────────────────────────────────────

func (srv *Server) handleListWorkflows(w http.ResponseWriter, _ *http.Request) {
	jsonOK(w, srv.store.AllWorkflows())
}

func (srv *Server) handleGetWorkflow(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	wf, ok := srv.store.GetWorkflow(id)
	if !ok { jsonErr(w, 404, "workflow not found"); return }
	jsonOK(w, wf)
}

type workflowReq struct {
	Name     string               `json:"name"`
	Nodes    []store.WorkflowNode `json:"nodes"`
	Edges    []store.WorkflowEdge `json:"edges"`
	SkillIDs []string             `json:"skill_ids"`
}

func (srv *Server) handleCreateWorkflow(w http.ResponseWriter, r *http.Request) {
	var req workflowReq
	if err := decode(r, &req); err != nil { jsonErr(w, 400, err.Error()); return }
	// Count agent nodes
	agentCount := 0
	for _, n := range req.Nodes {
		if n.Type == "agent" { agentCount++ }
	}
	if agentCount > 1 && !srv.lic.HasFeature(license.FeatureMultiAgent) {
		jsonErr(w, 403, fmt.Sprintf(
			"license gate: multi-agent workflows require Professional or Enterprise (current: %s)",
			srv.lic.Payload.Tier))
		return
	}
	skillIDs := req.SkillIDs
	if skillIDs == nil { skillIDs = []string{} }
	wf := &store.Workflow{
		ID: store.NewID(), Name: req.Name,
		Nodes: req.Nodes, Edges: req.Edges,
		SkillIDs: skillIDs, CreatedAt: time.Now().UTC(),
	}
	srv.store.SetWorkflow(wf)
	w.WriteHeader(http.StatusCreated)
	jsonOK(w, wf)
}

func (srv *Server) handleUpdateWorkflow(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	wf, ok := srv.store.GetWorkflow(id)
	if !ok { jsonErr(w, 404, "workflow not found"); return }
	var req workflowReq
	if err := decode(r, &req); err != nil { jsonErr(w, 400, err.Error()); return }
	wf.Name = req.Name; wf.Nodes = req.Nodes; wf.Edges = req.Edges
	if req.SkillIDs != nil { wf.SkillIDs = req.SkillIDs }
	srv.store.SetWorkflow(wf)
	jsonOK(w, wf)
}

func (srv *Server) handleWorkflowMemory(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := srv.store.GetWorkflow(id); !ok { jsonErr(w, 404, "workflow not found"); return }
	jsonOK(w, srv.store.MemoriesByScope(store.MemoryScopeWorkflow, id))
}

// ── Projects ───────────────────────────────────────────────────────────────────

func (srv *Server) handleListProjects(w http.ResponseWriter, _ *http.Request) {
	jsonOK(w, srv.store.AllProjects())
}

func (srv *Server) handleGetProject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, ok := srv.store.GetProject(id)
	if !ok { jsonErr(w, 404, "project not found"); return }
	jsonOK(w, p)
}

type projectReq struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	WorkflowID  string   `json:"workflow_id"`
	Tags        []string `json:"tags"`
	InputType   string   `json:"input_type"`
	Prompt      string   `json:"prompt"`
	InputConfig string   `json:"input_config"`
}

func (srv *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	maxP := srv.lic.MaxProjectsAllowed()
	if maxP > 0 && len(srv.store.AllProjects()) >= maxP {
		jsonErr(w, 403, fmt.Sprintf(
			"license gate: your %s license allows a maximum of %d projects – upgrade to remove this limit",
			srv.lic.Payload.Tier, maxP))
		return
	}
	var req projectReq
	if err := decode(r, &req); err != nil { jsonErr(w, 400, err.Error()); return }
	tags := req.Tags
	if tags == nil { tags = []string{} }
	inputType := req.InputType
	if inputType == "" { inputType = "text" }
	p := &store.Project{
		ID: store.NewID(), Name: req.Name, Description: req.Description,
		Status: store.ProjectActive, WorkflowID: req.WorkflowID,
		Tags: tags, CreatedAt: time.Now().UTC(),
		InputType: inputType, Prompt: req.Prompt, InputConfig: req.InputConfig,
	}
	srv.store.SetProject(p)
	w.WriteHeader(http.StatusCreated)
	jsonOK(w, p)
}

func (srv *Server) handleUpdateProject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	p, ok := srv.store.GetProject(id)
	if !ok { jsonErr(w, 404, "project not found"); return }
	var req projectReq
	if err := decode(r, &req); err != nil { jsonErr(w, 400, err.Error()); return }
	p.Name = req.Name; p.Description = req.Description
	p.WorkflowID = req.WorkflowID
	if req.Tags != nil { p.Tags = req.Tags }
	if req.InputType != "" { p.InputType = req.InputType }
	p.Prompt = req.Prompt
	p.InputConfig = req.InputConfig
	srv.store.SetProject(p)
	jsonOK(w, p)
}

func (srv *Server) handleDeleteProject(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := srv.store.GetProject(id); !ok { jsonErr(w, 404, "project not found"); return }
	srv.store.DelProject(id)
	w.WriteHeader(http.StatusNoContent)
}

// ── Runs ───────────────────────────────────────────────────────────────────────

func (srv *Server) handleListAllRuns(w http.ResponseWriter, _ *http.Request) {
	jsonOK(w, srv.store.AllRuns())
}

func (srv *Server) handleGetRun(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	run, ok := srv.store.GetRun(id)
	if !ok { jsonErr(w, 404, "run not found"); return }
	jsonOK(w, run)
}

func (srv *Server) handleDeleteRun(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := srv.store.GetRun(id); !ok { jsonErr(w, 404, "run not found"); return }
	srv.store.DelRun(id)
	w.WriteHeader(http.StatusNoContent)
}

func (srv *Server) handleRunMemory(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := srv.store.GetRun(id); !ok { jsonErr(w, 404, "run not found"); return }
	jsonOK(w, srv.store.MemoriesByScope(store.MemoryScopeRun, id))
}

func (srv *Server) handleListProjectRuns(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := srv.store.GetProject(id); !ok { jsonErr(w, 404, "project not found"); return }
	jsonOK(w, srv.store.RunsForProject(id))
}

func (srv *Server) handleCreateRun(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	proj, ok := srv.store.GetProject(id)
	if !ok { jsonErr(w, 404, "project not found"); return }

	// Build steps from workflow agent nodes
	var steps []store.RunStep
	if proj.WorkflowID != "" {
		if wf, ok := srv.store.GetWorkflow(proj.WorkflowID); ok {
			for _, node := range wf.Nodes {
				if node.Type != "agent" || node.AgentID == "" { continue }
				agentName := node.Label
				if ag, ok := srv.store.GetAgent(node.AgentID); ok {
					agentName = ag.Name
				}
				steps = append(steps, store.RunStep{
					ID: store.NewID(), AgentID: node.AgentID, AgentName: agentName,
					Status: store.StatusPending, Logs: []string{},
				})
			}
		}
	}

	run := &store.Run{
		ID: store.NewID(), ProjectID: proj.ID, ProjectName: proj.Name,
		Status: store.StatusPending, Steps: steps, CreatedAt: time.Now().UTC(),
	}
	srv.store.SetRun(run)

	// Update project counters
	now := time.Now().UTC()
	proj.RunCount++
	proj.LastRunAt = &now
	srv.store.SetProject(proj)

	// License-checked async execution
	if err := srv.runner.Start(run); err != nil {
		// Mark run as failed immediately
		run.Status = store.StatusFailed
		failMsg := fmt.Sprintf("blocked by license: %s", err.Error())
		for i := range run.Steps { run.Steps[i].Status = store.StatusFailed }
		run.Steps = append(run.Steps, store.RunStep{
			ID: store.NewID(), AgentName: "License Check",
			Status: store.StatusFailed, Output: failMsg,
			Logs: []string{failMsg},
		})
		srv.store.SetRun(run)
		// Still return the run (with failed status) rather than an HTTP error
	}

	w.WriteHeader(http.StatusCreated)
	jsonOK(w, run)
}

// ── Skills ─────────────────────────────────────────────────────────────────────

func (srv *Server) handleListSkills(w http.ResponseWriter, _ *http.Request) {
jsonOK(w, srv.store.AllSkills())
}

func (srv *Server) handleGetSkill(w http.ResponseWriter, r *http.Request) {
id := r.PathValue("id")
sk, ok := srv.store.GetSkill(id)
if !ok { jsonErr(w, 404, "skill not found"); return }
jsonOK(w, sk)
}

type skillReq struct {
Name        string          `json:"name"`
Description string          `json:"description"`
Type        store.SkillType `json:"type"`
Language    string          `json:"language"`
Content     string          `json:"content"`
Tags        []string        `json:"tags"`
}

func (srv *Server) handleCreateSkill(w http.ResponseWriter, r *http.Request) {
var req skillReq
if err := decode(r, &req); err != nil { jsonErr(w, 400, err.Error()); return }
if req.Type != store.SkillTypeScript && req.Type != store.SkillTypePrompt {
jsonErr(w, 400, "type must be 'script' or 'prompt'"); return
}
tags := req.Tags
if tags == nil { tags = []string{} }
now := time.Now().UTC()
sk := &store.Skill{
ID: store.NewID(), Name: req.Name, Description: req.Description,
Type: req.Type, Language: req.Language, Content: req.Content,
Tags: tags, CreatedAt: now, UpdatedAt: now,
}
srv.store.SetSkill(sk)
w.WriteHeader(http.StatusCreated)
jsonOK(w, sk)
}

func (srv *Server) handleUpdateSkill(w http.ResponseWriter, r *http.Request) {
id := r.PathValue("id")
sk, ok := srv.store.GetSkill(id)
if !ok { jsonErr(w, 404, "skill not found"); return }
var req skillReq
if err := decode(r, &req); err != nil { jsonErr(w, 400, err.Error()); return }
sk.Name = req.Name; sk.Description = req.Description
sk.Type = req.Type; sk.Language = req.Language; sk.Content = req.Content
if req.Tags != nil { sk.Tags = req.Tags }
sk.UpdatedAt = time.Now().UTC()
srv.store.SetSkill(sk)
jsonOK(w, sk)
}

func (srv *Server) handleDeleteSkill(w http.ResponseWriter, r *http.Request) {
id := r.PathValue("id")
if _, ok := srv.store.GetSkill(id); !ok { jsonErr(w, 404, "skill not found"); return }
srv.store.DelSkill(id)
w.WriteHeader(http.StatusNoContent)
}

// ── Memory ─────────────────────────────────────────────────────────────────────

type memoryReq struct {
Scope     store.MemoryScope `json:"scope"`
ScopeID   string            `json:"scope_id"`
Title     string            `json:"title"`
Content   string            `json:"content"`
WrittenBy string            `json:"written_by"`
}

func (srv *Server) handleCreateMemory(w http.ResponseWriter, r *http.Request) {
var req memoryReq
if err := decode(r, &req); err != nil { jsonErr(w, 400, err.Error()); return }
if req.Scope == "" || req.ScopeID == "" || req.Title == "" {
jsonErr(w, 400, "scope, scope_id, and title are required"); return
}
now := time.Now().UTC()
m := &store.MemoryFile{
ID: store.NewID(), Scope: req.Scope, ScopeID: req.ScopeID,
Title: req.Title, Content: req.Content, WrittenBy: req.WrittenBy,
CreatedAt: now, UpdatedAt: now,
}
srv.store.SetMemory(m)
w.WriteHeader(http.StatusCreated)
jsonOK(w, m)
}

func (srv *Server) handleDeleteMemory(w http.ResponseWriter, r *http.Request) {
id := r.PathValue("id")
if _, ok := srv.store.GetMemory(id); !ok { jsonErr(w, 404, "memory not found"); return }
srv.store.DelMemory(id)
w.WriteHeader(http.StatusNoContent)
}
