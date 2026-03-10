from __future__ import annotations
from datetime import datetime, timezone, timedelta
from api.models import (
    Platform, ProviderType, Agent, AgentStatus,
    Workflow, WorkflowNode, WorkflowEdge,
    Project, ProjectStatus, Run, RunStep, RunStatus
)

def dt(minutes_ago: int = 0) -> datetime:
    return datetime.now(tz=timezone.utc) - timedelta(minutes=minutes_ago)

# Fixed IDs for seed data
PLATFORM_OPENAI_ID = "plat-openai-001"
PLATFORM_ANTHROPIC_ID = "plat-anthropic-001"

AGENT_RESEARCH_ID = "agent-research-001"
AGENT_WRITER_ID = "agent-writer-001"
AGENT_CODE_ID = "agent-code-001"

WORKFLOW_RESEARCH_ID = "wf-research-001"
WORKFLOW_CODE_ID = "wf-code-001"

PROJECT_BLOG_ID = "proj-blog-001"
PROJECT_CODE_ID = "proj-code-001"

# ── Platforms ──────────────────────────────────────────────────────────────────
platforms: dict[str, Platform] = {
    PLATFORM_OPENAI_ID: Platform(
        id=PLATFORM_OPENAI_ID, name="OpenAI", provider=ProviderType.OPENAI,
        api_key_hint="sk-...a1b2", is_connected=True,
        models=["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
        created_at=dt(1440),
    ),
    PLATFORM_ANTHROPIC_ID: Platform(
        id=PLATFORM_ANTHROPIC_ID, name="Anthropic", provider=ProviderType.ANTHROPIC,
        api_key_hint="sk-ant-...c3d4", is_connected=True,
        models=["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
        created_at=dt(720),
    ),
}

# ── Agents ─────────────────────────────────────────────────────────────────────
agents: dict[str, Agent] = {
    AGENT_RESEARCH_ID: Agent(
        id=AGENT_RESEARCH_ID, name="Research Agent", platform_id=PLATFORM_OPENAI_ID,
        model="gpt-4o", task_count=14,
        description="Searches and synthesises information from multiple sources.",
        created_at=dt(1200),
    ),
    AGENT_WRITER_ID: Agent(
        id=AGENT_WRITER_ID, name="Writer Agent", platform_id=PLATFORM_ANTHROPIC_ID,
        model="claude-3-5-sonnet-20241022", task_count=9,
        description="Produces high-quality written content from structured briefs.",
        created_at=dt(900),
    ),
    AGENT_CODE_ID: Agent(
        id=AGENT_CODE_ID, name="Code Agent", platform_id=PLATFORM_OPENAI_ID,
        model="gpt-4o-mini", task_count=22,
        description="Reviews, refactors and generates code across multiple languages.",
        created_at=dt(600),
    ),
}

# ── Workflows ──────────────────────────────────────────────────────────────────
N_START_1 = "n-start-1"; N_R1 = "n-r1"; N_W1 = "n-w1"; N_END_1 = "n-end-1"
N_START_2 = "n-start-2"; N_C1 = "n-c1"; N_C2 = "n-c2"; N_END_2 = "n-end-2"

workflows: dict[str, Workflow] = {
    WORKFLOW_RESEARCH_ID: Workflow(
        id=WORKFLOW_RESEARCH_ID, name="Research & Write", created_at=dt(1200),
        nodes=[
            WorkflowNode(id=N_START_1, type="start", label="Start", x=80, y=150),
            WorkflowNode(id=N_R1, type="agent", label="Research Agent", agent_id=AGENT_RESEARCH_ID, x=280, y=150),
            WorkflowNode(id=N_W1, type="agent", label="Writer Agent", agent_id=AGENT_WRITER_ID, x=480, y=150),
            WorkflowNode(id=N_END_1, type="end", label="End", x=680, y=150),
        ],
        edges=[
            WorkflowEdge(id="e1", source=N_START_1, target=N_R1),
            WorkflowEdge(id="e2", source=N_R1, target=N_W1, label="brief"),
            WorkflowEdge(id="e3", source=N_W1, target=N_END_1),
        ],
    ),
    WORKFLOW_CODE_ID: Workflow(
        id=WORKFLOW_CODE_ID, name="Code Review", created_at=dt(600),
        nodes=[
            WorkflowNode(id=N_START_2, type="start", label="Start", x=80, y=150),
            WorkflowNode(id=N_C1, type="agent", label="Code Agent (Analyse)", agent_id=AGENT_CODE_ID, x=280, y=150),
            WorkflowNode(id=N_C2, type="agent", label="Code Agent (Refactor)", agent_id=AGENT_CODE_ID, x=480, y=150),
            WorkflowNode(id=N_END_2, type="end", label="End", x=680, y=150),
        ],
        edges=[
            WorkflowEdge(id="e4", source=N_START_2, target=N_C1),
            WorkflowEdge(id="e5", source=N_C1, target=N_C2, label="issues"),
            WorkflowEdge(id="e6", source=N_C2, target=N_END_2),
        ],
    ),
}

# ── Projects ───────────────────────────────────────────────────────────────────
projects: dict[str, Project] = {
    PROJECT_BLOG_ID: Project(
        id=PROJECT_BLOG_ID, name="Blog Post Generator",
        description="Automatically researches topics and produces SEO-optimised blog posts.",
        status=ProjectStatus.ACTIVE, workflow_id=WORKFLOW_RESEARCH_ID,
        tags=["content", "seo", "writing"], run_count=7,
        last_run_at=dt(45), created_at=dt(1200),
    ),
    PROJECT_CODE_ID: Project(
        id=PROJECT_CODE_ID, name="Code Quality Analyser",
        description="Analyses pull-requests for code quality issues and produces a refactored version.",
        status=ProjectStatus.ACTIVE, workflow_id=WORKFLOW_CODE_ID,
        tags=["code", "review", "quality"], run_count=15,
        last_run_at=dt(120), created_at=dt(600),
    ),
}

# ── Runs ───────────────────────────────────────────────────────────────────────
def make_completed_run(run_id: str, project_id: str, project_name: str, minutes_ago: int) -> Run:
    start = dt(minutes_ago + 8)
    end = dt(minutes_ago)
    return Run(
        id=run_id, project_id=project_id, project_name=project_name,
        status=RunStatus.COMPLETED, started_at=start, completed_at=end, created_at=start,
        steps=[
            RunStep(
                id=f"{run_id}-s1", agent_id=AGENT_RESEARCH_ID, agent_name="Research Agent",
                status=RunStatus.COMPLETED, progress=100,
                started_at=start, completed_at=start + timedelta(minutes=5),
                output="Research complete. Found 12 relevant sources.",
                logs=["Querying sources…", "Synthesising data…", "Research complete."],
            ),
            RunStep(
                id=f"{run_id}-s2", agent_id=AGENT_WRITER_ID, agent_name="Writer Agent",
                status=RunStatus.COMPLETED, progress=100,
                started_at=start + timedelta(minutes=5), completed_at=end,
                output="Blog post written: 1 200 words, 3 headings, SEO score 94.",
                logs=["Drafting intro…", "Writing body…", "Polishing…", "Done."],
            ),
        ],
    )

runs: dict[str, Run] = {
    "run-blog-001": make_completed_run("run-blog-001", PROJECT_BLOG_ID, "Blog Post Generator", 45),
    "run-blog-002": make_completed_run("run-blog-002", PROJECT_BLOG_ID, "Blog Post Generator", 200),
    "run-code-001": Run(
        id="run-code-001", project_id=PROJECT_CODE_ID, project_name="Code Quality Analyser",
        status=RunStatus.RUNNING, created_at=dt(10), started_at=dt(10),
        steps=[
            RunStep(
                id="run-code-001-s1", agent_id=AGENT_CODE_ID, agent_name="Code Agent (Analyse)",
                status=RunStatus.COMPLETED, progress=100,
                started_at=dt(10), completed_at=dt(5),
                output="Found 8 issues: 3 critical, 5 minor.",
                logs=["Scanning files…", "Running static analysis…", "Analysis complete."],
            ),
            RunStep(
                id="run-code-001-s2", agent_id=AGENT_CODE_ID, agent_name="Code Agent (Refactor)",
                status=RunStatus.RUNNING, progress=62,
                started_at=dt(5),
                output="",
                logs=["Starting refactor…", "Fixing critical issues…"],
            ),
        ],
    ),
}
