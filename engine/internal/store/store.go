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

// SkillType distinguishes executable scripts from prompt-context snippets.
type SkillType string

const (
	SkillTypeScript SkillType = "script"
	SkillTypePrompt SkillType = "prompt"
)

// MemoryScope identifies which entity a memory file belongs to.
type MemoryScope string

const (
	MemoryScopeRun      MemoryScope = "run"
	MemoryScopeWorkflow MemoryScope = "workflow"
	MemoryScopeAgent    MemoryScope = "agent"
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

// Agent represents a configured AI agent.
// SystemPrompt defines its persona/role; Steps are the ordered instructions it
// follows; SkillIDs lists the skills available to it by default.
type Agent struct {
	ID           string      `json:"id"`
	Name         string      `json:"name"`
	Description  string      `json:"description"`
	PlatformID   string      `json:"platform_id"`
	Model        string      `json:"model"`
	Status       AgentStatus `json:"status"`
	TaskCount    int         `json:"task_count"`
	SystemPrompt string      `json:"system_prompt"`
	Steps        []string    `json:"steps"`
	SkillIDs     []string    `json:"skill_ids"`
	CreatedAt    time.Time   `json:"created_at"`
}

type WorkflowNode struct {
	ID       string   `json:"id"`
	Type     string   `json:"type"` // "start" | "agent" | "end"
	Label    string   `json:"label"`
	AgentID  string   `json:"agent_id,omitempty"`
	SkillIDs []string `json:"skill_ids,omitempty"`
	X        float64  `json:"x"`
	Y        float64  `json:"y"`
}

type WorkflowEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label,omitempty"`
}

// Workflow is the blueprint of a processing job: which agents run, in what
// order, and what skills are available across the whole workflow.
type Workflow struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	Nodes     []WorkflowNode `json:"nodes"`
	Edges     []WorkflowEdge `json:"edges"`
	SkillIDs  []string       `json:"skill_ids"`
	CreatedAt time.Time      `json:"created_at"`
}

// Project is the entry-point for data flowing into agents.
// InputType describes how data arrives (text | file | api | url | webhook).
// Prompt is the core task description / AI prompt.
// InputConfig is optional JSON configuration for API/webhook sources.
type Project struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description"`
	Status      ProjectStatus `json:"status"`
	WorkflowID  string        `json:"workflow_id,omitempty"`
	Tags        []string      `json:"tags"`
	RunCount    int           `json:"run_count"`
	LastRunAt   *time.Time    `json:"last_run_at,omitempty"`
	InputType   string        `json:"input_type"`   // text | file | api | url | webhook
	Prompt      string        `json:"prompt"`        // the core AI task description
	InputConfig string        `json:"input_config"`  // JSON-encoded provider-specific config
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

// Skill is a reusable capability that can be attached to a workflow or agent.
// Type "script" contains executable code (Python, Bash, JavaScript…).
// Type "prompt" contains additional context injected into the agent's prompt.
type Skill struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Type        SkillType `json:"type"`
	Language    string    `json:"language"` // "python" | "bash" | "javascript" | "" (for prompt)
	Content     string    `json:"content"`  // source code or prompt text
	Tags        []string  `json:"tags"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// MemoryFile is a markdown document written by an agent to record what it has
// learnt.  Memory is scoped to a run (shared by all agents in that run), a
// workflow (persistent knowledge about the process), or an agent (role-specific
// self-knowledge that accumulates across all runs).
type MemoryFile struct {
	ID        string      `json:"id"`
	Scope     MemoryScope `json:"scope"`      // "run" | "workflow" | "agent"
	ScopeID   string      `json:"scope_id"`   // id of the owning entity
	Title     string      `json:"title"`
	Content   string      `json:"content"`    // markdown
	WrittenBy string      `json:"written_by"` // agent name that authored the entry
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
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
	Skills    map[string]*Skill
	Memories  map[string]*MemoryFile
}

// New creates a Store seeded with demo data.
func New() *Store {
	s := &Store{
		Platforms: make(map[string]*Platform),
		Agents:    make(map[string]*Agent),
		Workflows: make(map[string]*Workflow),
		Projects:  make(map[string]*Project),
		Runs:      make(map[string]*Run),
		Skills:    make(map[string]*Skill),
		Memories:  make(map[string]*MemoryFile),
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

	// ── Skills ─────────────────────────────────────────────────────────────────
	skillWebSearch := &Skill{
		ID: "skill-web-search-001", Name: "Web Search",
		Description: "Queries a search engine and returns structured results.",
		Type: SkillTypeScript, Language: "python",
		Tags: []string{"search", "internet", "research"},
		Content: `import json, urllib.request, urllib.parse

def run(query: str, max_results: int = 5) -> dict:
    """Search the web and return a list of results."""
    encoded = urllib.parse.quote_plus(query)
    url = f"https://api.search.example.com/search?q={encoded}&n={max_results}"
    with urllib.request.urlopen(url, timeout=10) as resp:
        data = json.loads(resp.read())
    return {"results": data.get("items", []), "query": query}
`,
		CreatedAt: ago(48 * time.Hour), UpdatedAt: ago(48 * time.Hour),
	}
	skillSEOContext := &Skill{
		ID: "skill-seo-context-001", Name: "SEO Best Practices",
		Description: "Injects SEO writing guidelines as additional context into the agent prompt.",
		Type: SkillTypePrompt, Language: "",
		Tags: []string{"seo", "writing", "content"},
		Content: `## SEO Writing Guidelines

When producing content, follow these SEO best practices:

- **Title**: 50–60 characters, include primary keyword near the start.
- **Meta description**: 150–160 characters, include primary and secondary keywords naturally.
- **Headings (H2/H3)**: Use keyword variations; keep headings descriptive and scannable.
- **Keyword density**: Aim for 1–2% density for the primary keyword; avoid keyword stuffing.
- **Internal linking**: Suggest 2–3 relevant internal links per 1000 words.
- **Readability**: Target Flesch score ≥ 60; use short paragraphs (3–4 sentences max).
- **Images**: Include descriptive alt text containing primary keywords.
`,
		CreatedAt: ago(36 * time.Hour), UpdatedAt: ago(36 * time.Hour),
	}
	skillCodeLinter := &Skill{
		ID: "skill-code-linter-001", Name: "Static Analyser",
		Description: "Runs a lightweight static analysis pass and returns issues as JSON.",
		Type: SkillTypeScript, Language: "python",
		Tags: []string{"code", "analysis", "quality"},
		Content: `import ast, json

def run(source: str, language: str = "python") -> dict:
    """Statically analyse source code and return a list of issues."""
    issues = []
    if language == "python":
        try:
            tree = ast.parse(source)
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef) and not ast.get_docstring(node):
                    issues.append({
                        "line": node.lineno,
                        "severity": "warning",
                        "message": f"Function '{node.name}' is missing a docstring.",
                    })
        except SyntaxError as e:
            issues.append({"line": e.lineno, "severity": "error", "message": str(e)})
    return {"issues": issues, "count": len(issues)}
`,
		CreatedAt: ago(24 * time.Hour), UpdatedAt: ago(12 * time.Hour),
	}
	skillCodeStyle := &Skill{
		ID: "skill-code-style-001", Name: "Code Style Guide",
		Description: "Injects clean-code style rules as prompt context for code-writing agents.",
		Type: SkillTypePrompt, Language: "",
		Tags: []string{"code", "style", "best-practices"},
		Content: `## Clean Code Standards

Adhere to the following standards when reviewing or generating code:

### Naming
- Variables and functions: descriptive snake_case (Python) or camelCase (JS/TS).
- Constants: SCREAMING_SNAKE_CASE.
- Classes: PascalCase.

### Functions
- Single responsibility: each function does one thing.
- Maximum 20 lines per function; extract helpers where needed.
- All public functions must have a docstring / JSDoc comment.

### Error handling
- Never swallow exceptions silently.
- Always log the original error before re-raising or returning an error response.

### Tests
- Minimum 80% code coverage for new code.
- Tests must be isolated; no shared mutable state between test cases.
`,
		CreatedAt: ago(18 * time.Hour), UpdatedAt: ago(18 * time.Hour),
	}
	s.Skills[skillWebSearch.ID] = skillWebSearch
	s.Skills[skillSEOContext.ID] = skillSEOContext
	s.Skills[skillCodeLinter.ID] = skillCodeLinter
	s.Skills[skillCodeStyle.ID] = skillCodeStyle

	// ── Agents ─────────────────────────────────────────────────────────────────
	agentResearch := &Agent{
		ID: "agent-research-001", Name: "Research Agent",
		Description: "Searches and synthesises information from multiple sources.",
		PlatformID:  platOpenAI.ID, Model: "gpt-4o",
		Status: AgentIdle, TaskCount: 14,
		SystemPrompt: `You are an expert research analyst. Your role is to gather information from multiple sources, evaluate credibility, and synthesise findings into clear, structured briefs that other agents can act on.

Always cite your sources and note the confidence level of each claim.`,
		Steps: []string{
			"Understand the research topic and define the key questions to answer.",
			"Use the Web Search skill to gather information from at least 5 sources.",
			"Evaluate and cross-reference the sources for credibility.",
			"Synthesise the findings into a structured brief with key insights.",
			"Write a summary and cite all sources used.",
		},
		SkillIDs:  []string{skillWebSearch.ID},
		CreatedAt: ago(20 * time.Hour),
	}
	agentWriter := &Agent{
		ID: "agent-writer-001", Name: "Writer Agent",
		Description: "Produces high-quality written content from structured briefs.",
		PlatformID:  platAnthropic.ID, Model: "claude-3-5-sonnet-20241022",
		Status: AgentIdle, TaskCount: 9,
		SystemPrompt: `You are a professional content writer and editor. You transform research briefs into polished, engaging written content that is both informative and optimised for the target audience.

Always match the tone and style specified in the brief.`,
		Steps: []string{
			"Read the research brief provided in the shared run memory.",
			"Define the target audience, tone, and structure.",
			"Write a compelling introduction that hooks the reader.",
			"Develop each section using the research findings.",
			"Apply SEO guidelines from the SEO Best Practices skill.",
			"Proofread for clarity, grammar, and readability.",
		},
		SkillIDs:  []string{skillSEOContext.ID},
		CreatedAt: ago(15 * time.Hour),
	}
	agentCode := &Agent{
		ID: "agent-code-001", Name: "Code Agent",
		Description: "Reviews, refactors and generates code across multiple languages.",
		PlatformID:  platOpenAI.ID, Model: "gpt-4o-mini",
		Status: AgentIdle, TaskCount: 22,
		SystemPrompt: `You are a senior software engineer specialising in code quality and refactoring. You analyse code for bugs, style violations, and architectural issues, then produce clean, well-documented improvements.

Write code as if the next person to read it is a junior developer who needs to understand it immediately.`,
		Steps: []string{
			"Read the code provided in the project input.",
			"Run the Static Analyser skill to get an objective list of issues.",
			"Review the issues in the context of the full codebase.",
			"Prioritise: fix critical bugs first, then style, then optimisations.",
			"Produce refactored code with inline comments explaining significant changes.",
			"Write a summary of all changes made.",
		},
		SkillIDs:  []string{skillCodeLinter.ID, skillCodeStyle.ID},
		CreatedAt: ago(10 * time.Hour),
	}
	s.Agents[agentResearch.ID] = agentResearch
	s.Agents[agentWriter.ID] = agentWriter
	s.Agents[agentCode.ID] = agentCode

	// ── Workflows ──────────────────────────────────────────────────────────────
	wfResearch := &Workflow{
		ID: "wf-research-001", Name: "Research & Write", CreatedAt: ago(20 * time.Hour),
		SkillIDs: []string{skillWebSearch.ID, skillSEOContext.ID},
		Nodes: []WorkflowNode{
			{ID: "n-start-1", Type: "start", Label: "Start", X: 80, Y: 150},
			{ID: "n-r1", Type: "agent", Label: "Research Agent", AgentID: agentResearch.ID, SkillIDs: []string{skillWebSearch.ID}, X: 280, Y: 150},
			{ID: "n-w1", Type: "agent", Label: "Writer Agent", AgentID: agentWriter.ID, SkillIDs: []string{skillSEOContext.ID}, X: 480, Y: 150},
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
		SkillIDs: []string{skillCodeLinter.ID, skillCodeStyle.ID},
		Nodes: []WorkflowNode{
			{ID: "n-start-2", Type: "start", Label: "Start", X: 80, Y: 150},
			{ID: "n-c1", Type: "agent", Label: "Code Agent (Analyse)", AgentID: agentCode.ID, SkillIDs: []string{skillCodeLinter.ID}, X: 280, Y: 150},
			{ID: "n-c2", Type: "agent", Label: "Code Agent (Refactor)", AgentID: agentCode.ID, SkillIDs: []string{skillCodeStyle.ID}, X: 480, Y: 150},
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
		InputType: "text",
		Prompt: `Research and write a comprehensive, SEO-optimised blog post on the given topic.

The post should:
- Be 1,000–1,500 words
- Include at least 3 H2 headings and supporting H3s
- Cite credible sources
- Target a general technical audience
- Include a compelling introduction and a summary/CTA at the end`,
	}
	projCode := &Project{
		ID: "proj-code-001", Name: "Code Quality Analyser",
		Description: "Analyses pull-requests for code quality issues and produces a refactored version.",
		Status: ProjectActive, WorkflowID: wfCode.ID,
		Tags: []string{"code", "review", "quality"}, RunCount: 15,
		LastRunAt: &lastCode, CreatedAt: ago(10 * time.Hour),
		InputType: "api",
		Prompt: `Analyse the provided code for quality issues and produce a refactored version.

Focus areas:
1. Correctness: identify and fix any bugs or logic errors.
2. Readability: improve naming, add comments, simplify complex expressions.
3. Performance: flag any obvious performance bottlenecks.
4. Security: highlight potential injection or authentication issues.

Return a summary of all changes with severity ratings.`,
		InputConfig: `{"source": "github", "repo": "org/repo", "pr_number_env": "PR_NUMBER"}`,
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
					Logs:   []string{"Querying sources…", "Running Web Search skill…", "Synthesising data…", "Writing run memory entry…", "Research complete."},
				},
				{
					ID: id + "-s2", AgentID: agentWriter.ID, AgentName: "Writer Agent",
					Status: StatusCompleted, Progress: 100,
					StartedAt: ptr(start.Add(5 * time.Minute)), CompletedAt: &end,
					Output: "Blog post written: 1200 words, 3 headings, SEO score 94.",
					Logs:   []string{"Reading run memory…", "Applying SEO Best Practices skill…", "Drafting intro…", "Writing body…", "Polishing…", "Done."},
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
				Logs:   []string{"Scanning files…", "Running Static Analyser skill…", "Analysis complete.", "Writing run memory entry…"},
			},
			{
				ID: "run-code-001-s2", AgentID: agentCode.ID, AgentName: "Code Agent (Refactor)",
				Status: StatusRunning, Progress: 62,
				StartedAt: &step1End,
				Output:    "",
				Logs:      []string{"Reading run memory…", "Applying Code Style Guide skill…", "Starting refactor…", "Fixing critical issues…"},
			},
		},
	}

	s.Runs[run1.ID] = run1
	s.Runs[run2.ID] = run2
	s.Runs[run3.ID] = run3

	// ── Memory files ───────────────────────────────────────────────────────────
	// Run-scoped memory (shared between all agents in a run)
	s.Memories["mem-run-blog-001-a"] = &MemoryFile{
		ID: "mem-run-blog-001-a", Scope: MemoryScopeRun, ScopeID: run1.ID,
		Title: "Research Findings: Blog Post Run",
		WrittenBy: "Research Agent",
		Content: `# Research Findings

## Topic: AI Agent Orchestration

### Key Sources
1. *Orchestrating AI Agents at Scale* – MIT Technology Review (2024)
2. *Multi-Agent Systems: Patterns & Anti-Patterns* – ACM Queue (2024)
3. *LLM Pipelines in Production* – Anthropic Engineering Blog (2023)

### Key Insights
- Multi-agent workflows outperform single-agent pipelines on complex tasks by 34% (MIT study).
- Memory sharing between agents reduces redundant API calls by up to 60%.
- Human-in-the-loop checkpoints increase output quality satisfaction scores by 22%.

### Recommended Structure
1. Introduction: why AI orchestration matters
2. Core concepts: agents, workflows, memory
3. Real-world patterns
4. Getting started
5. Summary & CTA
`,
		CreatedAt: run1.Steps[0].CompletedAt.Add(-1 * time.Minute),
		UpdatedAt: run1.Steps[0].CompletedAt.Add(-1 * time.Minute),
	}
	s.Memories["mem-run-blog-001-b"] = &MemoryFile{
		ID: "mem-run-blog-001-b", Scope: MemoryScopeRun, ScopeID: run1.ID,
		Title: "Final Article Draft",
		WrittenBy: "Writer Agent",
		Content: `# AI Agent Orchestration: The Future of Intelligent Automation

*1,247 words · SEO score: 94 · Target keyword: "AI agent orchestration"*

## Introduction

The ability to coordinate multiple AI agents working in concert is fast becoming a critical capability for organisations looking to automate complex workflows...

## Core Concepts

### What Are AI Agents?
An AI agent is a software entity that perceives its environment, makes decisions, and takes actions to achieve a goal...

### Workflows and Memory
Effective multi-agent systems rely on two things: a well-defined workflow and a shared memory layer...

## Real-World Patterns

### Pattern 1: Research → Synthesis → Output
...

### Pattern 2: Parallel Analysis
...

## Getting Started

To implement your first multi-agent workflow...

## Summary

AI agent orchestration is no longer a research curiosity—it is a practical tool available to engineering teams today...
`,
		CreatedAt: *run1.CompletedAt,
		UpdatedAt: *run1.CompletedAt,
	}

	// Workflow-scoped memory (persistent knowledge about the process)
	s.Memories["mem-wf-research-001"] = &MemoryFile{
		ID: "mem-wf-research-001", Scope: MemoryScopeWorkflow, ScopeID: wfResearch.ID,
		Title: "Workflow Learnings: Research & Write",
		WrittenBy: "Research Agent",
		Content: `# Workflow Learnings: Research & Write

## What Works Well
- Breaking the research phase into source discovery and synthesis produces better briefs.
- Passing a structured JSON brief (not free text) to the Writer Agent reduces hallucination.
- Requesting at least 8 sources before synthesising gives the Writer sufficient material.

## Known Issues
- Web Search skill occasionally times out on queries containing special characters; URL-encode all queries.
- Writer Agent tends to under-cite when given briefs shorter than 300 words; always pass full research notes.

## Optimisations Discovered
- Running the research step with temperature=0.2 and writing step with temperature=0.7 gives best results.
- Adding "cite sources inline" to the Writer's system prompt improved citation rate from 40% to 91%.
`,
		CreatedAt: ago(6 * time.Hour),
		UpdatedAt: ago(2 * time.Hour),
	}

	// Agent-scoped memory (the agent's self-knowledge of its role)
	s.Memories["mem-agent-research-001"] = &MemoryFile{
		ID: "mem-agent-research-001", Scope: MemoryScopeAgent, ScopeID: agentResearch.ID,
		Title: "My Role & Best Practices",
		WrittenBy: "Research Agent",
		Content: `# Research Agent — Role Memory

## My Purpose
I am a research specialist. My output feeds directly into downstream agents; quality here determines the quality of everything that follows.

## What I've Learnt
- **Source diversity matters**: Always include at least one academic source, one industry publication, and one practitioner blog.
- **Structured output wins**: Downstream agents perform better when I return a JSON-structured brief rather than prose.
- **Confidence scoring**: I should always attach a confidence level (high/medium/low) to each claim.

## Common Mistakes to Avoid
- Do not summarise too aggressively—preserve the original phrasing of important quotes.
- Do not skip the "key questions" step; ambiguous research scope causes iteration loops.
- If fewer than 5 sources are found, pause and request clarification rather than proceeding.

## Skills I Rely On
- **Web Search** (skill-web-search-001): primary tool for source discovery.
`,
		CreatedAt: ago(18 * time.Hour),
		UpdatedAt: ago(3 * time.Hour),
	}
	s.Memories["mem-agent-code-001"] = &MemoryFile{
		ID: "mem-agent-code-001", Scope: MemoryScopeAgent, ScopeID: agentCode.ID,
		Title: "My Role & Best Practices",
		WrittenBy: "Code Agent",
		Content: `# Code Agent — Role Memory

## My Purpose
I review and improve code quality. My work must be precise, non-destructive, and clearly explained.

## What I've Learnt
- **Preserve intent**: refactoring must not change observable behaviour unless a bug is being fixed.
- **Explain every change**: a one-line comment per non-trivial change dramatically reduces review round-trips.
- **Prioritise severity**: critical security issues > correctness bugs > performance > style.

## Patterns I've Found Useful
- When given Python, always run the Static Analyser skill first to get an objective baseline.
- For TypeScript/JavaScript, check for missing null guards and any-typed parameters.
- Always output a diff-style summary alongside the full refactored file.

## Skills I Rely On
- **Static Analyser** (skill-code-linter-001): objective baseline for issues.
- **Code Style Guide** (skill-code-style-001): reference for all style decisions.
`,
		CreatedAt: ago(10 * time.Hour),
		UpdatedAt: ago(1 * time.Hour),
	}
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

// Skill CRUD

func (s *Store) GetSkill(id string) (*Skill, bool) {
	s.mu.RLock(); defer s.mu.RUnlock()
	sk, ok := s.Skills[id]; return sk, ok
}
func (s *Store) SetSkill(sk *Skill) {
	s.mu.Lock(); defer s.mu.Unlock()
	s.Skills[sk.ID] = sk
}
func (s *Store) DelSkill(id string) {
	s.mu.Lock(); defer s.mu.Unlock()
	delete(s.Skills, id)
}
func (s *Store) AllSkills() []*Skill {
	s.mu.RLock(); defer s.mu.RUnlock()
	out := make([]*Skill, 0, len(s.Skills))
	for _, sk := range s.Skills { out = append(out, sk) }
	return out
}

// Memory CRUD

func (s *Store) GetMemory(id string) (*MemoryFile, bool) {
	s.mu.RLock(); defer s.mu.RUnlock()
	m, ok := s.Memories[id]; return m, ok
}
func (s *Store) SetMemory(m *MemoryFile) {
	s.mu.Lock(); defer s.mu.Unlock()
	s.Memories[m.ID] = m
}
func (s *Store) DelMemory(id string) {
	s.mu.Lock(); defer s.mu.Unlock()
	delete(s.Memories, id)
}

// MemoriesByScope returns all memory files for the given scope and scope ID.
func (s *Store) MemoriesByScope(scope MemoryScope, scopeID string) []*MemoryFile {
	s.mu.RLock(); defer s.mu.RUnlock()
	var out []*MemoryFile
	for _, m := range s.Memories {
		if m.Scope == scope && m.ScopeID == scopeID {
			out = append(out, m)
		}
	}
	return out
}
