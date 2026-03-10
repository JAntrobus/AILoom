// Package store provides a thread-safe in-memory data store for the AILoom engine.
package store

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

// ── Domain types ───────────────────────────────────────────────────────────────

type ProviderType string

const (
	ProviderOpenAI    ProviderType = "openai"
	ProviderAnthropic ProviderType = "anthropic"
	ProviderAzure     ProviderType = "azure"
	ProviderGoogle    ProviderType = "google"
	ProviderCustom    ProviderType = "custom"
)

type RunStatus string

const (
	StatusPending   RunStatus = "pending"
	StatusRunning   RunStatus = "running"
	StatusCompleted RunStatus = "completed"
	StatusFailed    RunStatus = "failed"
	StatusPaused    RunStatus = "paused"
)

type AgentStatus string

const (
	AgentIdle      AgentStatus = "idle"
	AgentRunning   AgentStatus = "running"
	AgentPaused    AgentStatus = "paused"
	AgentCompleted AgentStatus = "completed"
	AgentFailed    AgentStatus = "failed"
)

type ProjectStatus string

const (
	ProjectDraft    ProjectStatus = "draft"
	ProjectActive   ProjectStatus = "active"
	ProjectArchived ProjectStatus = "archived"
)

// ── Entity types ───────────────────────────────────────────────────────────────

type Platform struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Provider    ProviderType `json:"provider"`
	APIKeyHint  string       `json:"api_key_hint"`
	BaseURL     string       `json:"base_url,omitempty"`
	Models      []string     `json:"models"`
	IsConnected bool         `json:"is_connected"`
	CreatedAt   time.Time    `json:"created_at"`
}

type Agent struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	PlatformID  string      `json:"platform_id"`
	Model       string      `json:"model"`
	Status      AgentStatus `json:"status"`
	TaskCount   int         `json:"task_count"`
	CreatedAt   time.Time   `json:"created_at"`
}

type WorkflowNode struct {
	ID      string  `json:"id"`
	Type    string  `json:"type"` // "start" | "agent" | "end"
	Label   string  `json:"label"`
	AgentID string  `json:"agent_id,omitempty"`
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
}

type WorkflowEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label,omitempty"`
}

type Workflow struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	Nodes     []WorkflowNode `json:"nodes"`
	Edges     []WorkflowEdge `json:"edges"`
	CreatedAt time.Time      `json:"created_at"`
}

type Project struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Status      ProjectStatus `json:"status"`
	WorkflowID  string        `json:"workflow_id,omitempty"`
	Tags        []string      `json:"tags"`
	RunCount    int           `json:"run_count"`
	LastRunAt   *time.Time    `json:"last_run_at,omitempty"`
	CreatedAt   time.Time     `json:"created_at"`
}

type RunStep struct {
	ID          string     `json:"id"`
	AgentID     string     `json:"agent_id"`
	AgentName   string     `json:"agent_name"`
	Status      RunStatus  `json:"status"`
	Progress    float64    `json:"progress"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	Output      string     `json:"output"`
	Logs        []string   `json:"logs"`
}

type Run struct {
	ID          string     `json:"id"`
	ProjectID   string     `json:"project_id"`
	ProjectName string     `json:"project_name"`
	Status      RunStatus  `json:"status"`
	Steps       []RunStep  `json:"steps"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// ── Store ──────────────────────────────────────────────────────────────────────

// Store is the central thread-safe in-memory repository.
type Store struct {
	mu        sync.RWMutex
	Platforms map[string]*Platform
	Agents    map[string]*Agent
	Workflows map[string]*Workflow
	Projects  map[string]*Project
	Runs      map[string]*Run
}

// New creates a Store seeded with demo data.
func New() *Store {
	s := &Store{
		Platforms: make(map[string]*Platform),
		Agents:    make(map[string]*Agent),
		Workflows: make(map[string]*Workflow),
		Projects:  make(map[string]*Project),
		Runs:      make(map[string]*Run),
	}
	s.seed()
	return s
}

// NewID returns a new random UUID string.
func NewID() string { return uuid.New().String() }

func ago(d time.Duration) time.Time { return time.Now().UTC().Add(-d) }
func ptr[T any](v T) *T             { return &v }

func (s *Store) seed() {
	now := time.Now().UTC()

	// ── Platforms ──────────────────────────────────────────────────────────────
	platOpenAI := &Platform{
		ID: "plat-openai-001", Name: "OpenAI", Provider: ProviderOpenAI,
		APIKeyHint:  "sk-...a1b2",
		Models:      []string{"gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"},
		IsConnected: true,
		CreatedAt:   ago(24 * time.Hour),
	}
	platAnthropic := &Platform{
		ID: "plat-anthropic-001", Name: "Anthropic", Provider: ProviderAnthropic,
		APIKeyHint:  "sk-ant-...c3d4",
		Models:      []string{"claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"},
		IsConnected: true,
		CreatedAt:   ago(12 * time.Hour),
	}
	s.Platforms[platOpenAI.ID] = platOpenAI
	s.Platforms[platAnthropic.ID] = platAnthropic

	// ── Agents ─────────────────────────────────────────────────────────────────
	agentResearch := &Agent{
		ID: "agent-research-001", Name: "Research Agent",
		Description: "Searches and synthesises information from multiple sources.",
		PlatformID:  platOpenAI.ID, Model: "gpt-4o",
		Status: AgentIdle, TaskCount: 14, CreatedAt: ago(20 * time.Hour),
	}
	agentWriter := &Agent{
		ID: "agent-writer-001", Name: "Writer Agent",
		Description: "Produces high-quality written content from structured briefs.",
		PlatformID:  platAnthropic.ID, Model: "claude-3-5-sonnet-20241022",
		Status: AgentIdle, TaskCount: 9, CreatedAt: ago(15 * time.Hour),
	}
	agentCode := &Agent{
		ID: "agent-code-001", Name: "Code Agent",
		Description: "Reviews, refactors and generates code across multiple languages.",
		PlatformID:  platOpenAI.ID, Model: "gpt-4o-mini",
		Status: AgentIdle, TaskCount: 22, CreatedAt: ago(10 * time.Hour),
	}
	s.Agents[agentResearch.ID] = agentResearch
	s.Agents[agentWriter.ID] = agentWriter
	s.Agents[agentCode.ID] = agentCode

	// ── Workflows ──────────────────────────────────────────────────────────────
	wfResearch := &Workflow{
		ID: "wf-research-001", Name: "Research & Write", CreatedAt: ago(20 * time.Hour),
		Nodes: []WorkflowNode{
			{ID: "n-start-1", Type: "start", Label: "Start", X: 80, Y: 150},
			{ID: "n-r1", Type: "agent", Label: "Research Agent", AgentID: agentResearch.ID, X: 280, Y: 150},
			{ID: "n-w1", Type: "agent", Label: "Writer Agent", AgentID: agentWriter.ID, X: 480, Y: 150},
			{ID: "n-end-1", Type: "end", Label: "End", X: 680, Y: 150},
		},
		Edges: []WorkflowEdge{
			{ID: "e1", Source: "n-start-1", Target: "n-r1"},
			{ID: "e2", Source: "n-r1", Target: "n-w1", Label: "brief"},
			{ID: "e3", Source: "n-w1", Target: "n-end-1"},
		},
	}
	wfCode := &Workflow{
		ID: "wf-code-001", Name: "Code Review", CreatedAt: ago(10 * time.Hour),
		Nodes: []WorkflowNode{
			{ID: "n-start-2", Type: "start", Label: "Start", X: 80, Y: 150},
			{ID: "n-c1", Type: "agent", Label: "Code Agent (Analyse)", AgentID: agentCode.ID, X: 280, Y: 150},
			{ID: "n-c2", Type: "agent", Label: "Code Agent (Refactor)", AgentID: agentCode.ID, X: 480, Y: 150},
			{ID: "n-end-2", Type: "end", Label: "End", X: 680, Y: 150},
		},
		Edges: []WorkflowEdge{
			{ID: "e4", Source: "n-start-2", Target: "n-c1"},
			{ID: "e5", Source: "n-c1", Target: "n-c2", Label: "issues"},
			{ID: "e6", Source: "n-c2", Target: "n-end-2"},
		},
	}
	s.Workflows[wfResearch.ID] = wfResearch
	s.Workflows[wfCode.ID] = wfCode

	// ── Projects ───────────────────────────────────────────────────────────────
	lastBlog := ago(45 * time.Minute)
	lastCode := ago(2 * time.Hour)
	projBlog := &Project{
		ID: "proj-blog-001", Name: "Blog Post Generator",
		Description: "Automatically researches topics and produces SEO-optimised blog posts.",
		Status: ProjectActive, WorkflowID: wfResearch.ID,
		Tags: []string{"content", "seo", "writing"}, RunCount: 7,
		LastRunAt: &lastBlog, CreatedAt: ago(20 * time.Hour),
	}
	projCode := &Project{
		ID: "proj-code-001", Name: "Code Quality Analyser",
		Description: "Analyses pull-requests for code quality issues and produces a refactored version.",
		Status: ProjectActive, WorkflowID: wfCode.ID,
		Tags: []string{"code", "review", "quality"}, RunCount: 15,
		LastRunAt: &lastCode, CreatedAt: ago(10 * time.Hour),
	}
	s.Projects[projBlog.ID] = projBlog
	s.Projects[projCode.ID] = projCode

	// ── Runs ───────────────────────────────────────────────────────────────────
	makeCompletedRun := func(id, projID, projName string, ago_ time.Duration) *Run {
		start := now.Add(-ago_ - 8*time.Minute)
		end := now.Add(-ago_)
		return &Run{
			ID: id, ProjectID: projID, ProjectName: projName,
			Status: StatusCompleted, StartedAt: &start, CompletedAt: &end, CreatedAt: start,
			Steps: []RunStep{
				{
					ID: id + "-s1", AgentID: agentResearch.ID, AgentName: "Research Agent",
					Status: StatusCompleted, Progress: 100,
					StartedAt: &start, CompletedAt: ptr(start.Add(5 * time.Minute)),
					Output: "Research complete. Found 12 relevant sources.",
					Logs:   []string{"Querying sources…", "Synthesising data…", "Research complete."},
				},
				{
					ID: id + "-s2", AgentID: agentWriter.ID, AgentName: "Writer Agent",
					Status: StatusCompleted, Progress: 100,
					StartedAt: ptr(start.Add(5 * time.Minute)), CompletedAt: &end,
					Output: "Blog post written: 1200 words, 3 headings, SEO score 94.",
					Logs:   []string{"Drafting intro…", "Writing body…", "Polishing…", "Done."},
				},
			},
		}
	}

	run1 := makeCompletedRun("run-blog-001", projBlog.ID, projBlog.Name, 45*time.Minute)
	run2 := makeCompletedRun("run-blog-002", projBlog.ID, projBlog.Name, 200*time.Minute)

	codeStart := ago(10 * time.Minute)
	step1End := ago(5 * time.Minute)
	run3 := &Run{
		ID: "run-code-001", ProjectID: projCode.ID, ProjectName: projCode.Name,
		Status: StatusRunning, StartedAt: &codeStart, CreatedAt: codeStart,
		Steps: []RunStep{
			{
				ID: "run-code-001-s1", AgentID: agentCode.ID, AgentName: "Code Agent (Analyse)",
				Status: StatusCompleted, Progress: 100,
				StartedAt: &codeStart, CompletedAt: &step1End,
				Output: "Found 8 issues: 3 critical, 5 minor.",
				Logs:   []string{"Scanning files…", "Running static analysis…", "Analysis complete."},
			},
			{
				ID: "run-code-001-s2", AgentID: agentCode.ID, AgentName: "Code Agent (Refactor)",
				Status: StatusRunning, Progress: 62,
				StartedAt: &step1End,
				Output:    "",
				Logs:      []string{"Starting refactor…", "Fixing critical issues…"},
			},
		},
	}

	s.Runs[run1.ID] = run1
	s.Runs[run2.ID] = run2
	s.Runs[run3.ID] = run3
}

// ── CRUD helpers ───────────────────────────────────────────────────────────────

func (s *Store) GetPlatform(id string) (*Platform, bool) {
	s.mu.RLock(); defer s.mu.RUnlock()
	p, ok := s.Platforms[id]; return p, ok
}
func (s *Store) SetPlatform(p *Platform) {
	s.mu.Lock(); defer s.mu.Unlock()
	s.Platforms[p.ID] = p
}
func (s *Store) DelPlatform(id string) {
	s.mu.Lock(); defer s.mu.Unlock()
	delete(s.Platforms, id)
}
func (s *Store) AllPlatforms() []*Platform {
	s.mu.RLock(); defer s.mu.RUnlock()
	out := make([]*Platform, 0, len(s.Platforms))
	for _, p := range s.Platforms { out = append(out, p) }
	return out
}

func (s *Store) GetAgent(id string) (*Agent, bool) {
	s.mu.RLock(); defer s.mu.RUnlock()
	a, ok := s.Agents[id]; return a, ok
}
func (s *Store) SetAgent(a *Agent) {
	s.mu.Lock(); defer s.mu.Unlock()
	s.Agents[a.ID] = a
}
func (s *Store) DelAgent(id string) {
	s.mu.Lock(); defer s.mu.Unlock()
	delete(s.Agents, id)
}
func (s *Store) AllAgents() []*Agent {
	s.mu.RLock(); defer s.mu.RUnlock()
	out := make([]*Agent, 0, len(s.Agents))
	for _, a := range s.Agents { out = append(out, a) }
	return out
}

func (s *Store) GetWorkflow(id string) (*Workflow, bool) {
	s.mu.RLock(); defer s.mu.RUnlock()
	w, ok := s.Workflows[id]; return w, ok
}
func (s *Store) SetWorkflow(w *Workflow) {
	s.mu.Lock(); defer s.mu.Unlock()
	s.Workflows[w.ID] = w
}
func (s *Store) AllWorkflows() []*Workflow {
	s.mu.RLock(); defer s.mu.RUnlock()
	out := make([]*Workflow, 0, len(s.Workflows))
	for _, w := range s.Workflows { out = append(out, w) }
	return out
}

func (s *Store) GetProject(id string) (*Project, bool) {
	s.mu.RLock(); defer s.mu.RUnlock()
	p, ok := s.Projects[id]; return p, ok
}
func (s *Store) SetProject(p *Project) {
	s.mu.Lock(); defer s.mu.Unlock()
	s.Projects[p.ID] = p
}
func (s *Store) DelProject(id string) {
	s.mu.Lock(); defer s.mu.Unlock()
	delete(s.Projects, id)
}
func (s *Store) AllProjects() []*Project {
	s.mu.RLock(); defer s.mu.RUnlock()
	out := make([]*Project, 0, len(s.Projects))
	for _, p := range s.Projects { out = append(out, p) }
	return out
}

func (s *Store) GetRun(id string) (*Run, bool) {
	s.mu.RLock(); defer s.mu.RUnlock()
	r, ok := s.Runs[id]; return r, ok
}
func (s *Store) SetRun(r *Run) {
	s.mu.Lock(); defer s.mu.Unlock()
	s.Runs[r.ID] = r
}
func (s *Store) DelRun(id string) {
	s.mu.Lock(); defer s.mu.Unlock()
	delete(s.Runs, id)
}
func (s *Store) AllRuns() []*Run {
	s.mu.RLock(); defer s.mu.RUnlock()
	out := make([]*Run, 0, len(s.Runs))
	for _, r := range s.Runs { out = append(out, r) }
	return out
}
func (s *Store) RunsForProject(projectID string) []*Run {
	s.mu.RLock(); defer s.mu.RUnlock()
	var out []*Run
	for _, r := range s.Runs {
		if r.ProjectID == projectID { out = append(out, r) }
	}
	return out
}
