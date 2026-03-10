from __future__ import annotations
from typing import Any
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from api import store
from api.models import (
    Platform, PlatformCreate, ProviderType,
    Agent, AgentCreate, AgentStatus,
    Workflow, WorkflowCreate,
    Project, ProjectCreate, ProjectStatus,
    Run, RunCreate, RunStatus, RunStep,
    now,
)

app = FastAPI(title="AILoom API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROVIDER_MODELS = {
    ProviderType.OPENAI: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    ProviderType.ANTHROPIC: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
    ProviderType.AZURE: ["gpt-4o", "gpt-4-turbo"],
    ProviderType.GOOGLE: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
    ProviderType.CUSTOM: [],
}

# ── Platforms ──────────────────────────────────────────────────────────────────
@app.get("/api/platforms", response_model=list[Platform])
def list_platforms():
    return list(store.platforms.values())

@app.get("/api/platforms/{id}", response_model=Platform)
def get_platform(id: str):
    p = store.platforms.get(id)
    if not p: raise HTTPException(404, "Platform not found")
    return p

@app.post("/api/platforms", response_model=Platform, status_code=201)
def create_platform(body: PlatformCreate):
    key_hint = f"...{body.api_key[-4:]}" if len(body.api_key) >= 4 else "****"
    models = PROVIDER_MODELS.get(body.provider, [])
    p = Platform(
        name=body.name, provider=body.provider,
        api_key_hint=key_hint, base_url=body.base_url,
        models=models, is_connected=True,
    )
    store.platforms[p.id] = p
    return p

@app.delete("/api/platforms/{id}", status_code=204)
def delete_platform(id: str):
    if id not in store.platforms: raise HTTPException(404, "Platform not found")
    del store.platforms[id]

@app.get("/api/platforms/{id}/models")
def get_platform_models(id: str):
    p = store.platforms.get(id)
    if not p: raise HTTPException(404, "Platform not found")
    return {"models": p.models}

# ── Agents ─────────────────────────────────────────────────────────────────────
@app.get("/api/agents", response_model=list[Agent])
def list_agents():
    return list(store.agents.values())

@app.get("/api/agents/{id}", response_model=Agent)
def get_agent(id: str):
    a = store.agents.get(id)
    if not a: raise HTTPException(404, "Agent not found")
    return a

@app.post("/api/agents", response_model=Agent, status_code=201)
def create_agent(body: AgentCreate):
    if body.platform_id not in store.platforms:
        raise HTTPException(400, "Platform not found")
    a = Agent(**body.model_dump())
    store.agents[a.id] = a
    return a

@app.delete("/api/agents/{id}", status_code=204)
def delete_agent(id: str):
    if id not in store.agents: raise HTTPException(404, "Agent not found")
    del store.agents[id]

# ── Workflows ──────────────────────────────────────────────────────────────────
@app.get("/api/workflows", response_model=list[Workflow])
def list_workflows():
    return list(store.workflows.values())

@app.get("/api/workflows/{id}", response_model=Workflow)
def get_workflow(id: str):
    w = store.workflows.get(id)
    if not w: raise HTTPException(404, "Workflow not found")
    return w

@app.post("/api/workflows", response_model=Workflow, status_code=201)
def create_workflow(body: WorkflowCreate):
    w = Workflow(**body.model_dump())
    store.workflows[w.id] = w
    return w

@app.put("/api/workflows/{id}", response_model=Workflow)
def update_workflow(id: str, body: WorkflowCreate):
    if id not in store.workflows: raise HTTPException(404, "Workflow not found")
    w = store.workflows[id]
    updated = w.model_copy(update=body.model_dump())
    store.workflows[id] = updated
    return updated

# ── Projects ───────────────────────────────────────────────────────────────────
@app.get("/api/projects", response_model=list[Project])
def list_projects():
    return list(store.projects.values())

@app.get("/api/projects/{id}", response_model=Project)
def get_project(id: str):
    p = store.projects.get(id)
    if not p: raise HTTPException(404, "Project not found")
    return p

@app.post("/api/projects", response_model=Project, status_code=201)
def create_project(body: ProjectCreate):
    p = Project(**body.model_dump())
    store.projects[p.id] = p
    return p

@app.put("/api/projects/{id}", response_model=Project)
def update_project(id: str, body: ProjectCreate):
    if id not in store.projects: raise HTTPException(404, "Project not found")
    p = store.projects[id]
    updated = p.model_copy(update=body.model_dump())
    store.projects[id] = updated
    return updated

@app.delete("/api/projects/{id}", status_code=204)
def delete_project(id: str):
    if id not in store.projects: raise HTTPException(404, "Project not found")
    del store.projects[id]

# ── Runs ───────────────────────────────────────────────────────────────────────
@app.get("/api/projects/{project_id}/runs", response_model=list[Run])
def list_runs(project_id: str):
    if project_id not in store.projects: raise HTTPException(404, "Project not found")
    return [r for r in store.runs.values() if r.project_id == project_id]

@app.get("/api/runs/{id}", response_model=Run)
def get_run(id: str):
    r = store.runs.get(id)
    if not r: raise HTTPException(404, "Run not found")
    return r

@app.get("/api/runs", response_model=list[Run])
def list_all_runs():
    return list(store.runs.values())

@app.post("/api/projects/{project_id}/runs", response_model=Run, status_code=201)
def create_run(project_id: str):
    proj = store.projects.get(project_id)
    if not proj: raise HTTPException(404, "Project not found")

    # Build steps from workflow
    steps: list[RunStep] = []
    if proj.workflow_id and proj.workflow_id in store.workflows:
        wf = store.workflows[proj.workflow_id]
        for node in wf.nodes:
            if node.type == "agent" and node.agent_id:
                ag = store.agents.get(node.agent_id)
                steps.append(RunStep(
                    agent_id=node.agent_id,
                    agent_name=ag.name if ag else node.label,
                ))

    run = Run(
        project_id=project_id, project_name=proj.name,
        status=RunStatus.PENDING, steps=steps,
    )
    store.runs[run.id] = run

    # Update project metadata
    proj_updated = proj.model_copy(update={
        "run_count": proj.run_count + 1,
        "last_run_at": now(),
    })
    store.projects[project_id] = proj_updated
    return run

@app.delete("/api/runs/{id}", status_code=204)
def delete_run(id: str):
    if id not in store.runs: raise HTTPException(404, "Run not found")
    del store.runs[id]

# ── Stats ──────────────────────────────────────────────────────────────────────
@app.get("/api/stats")
def get_stats():
    runs_list = list(store.runs.values())
    active = sum(1 for r in runs_list if r.status == RunStatus.RUNNING)
    completed = sum(1 for r in runs_list if r.status == RunStatus.COMPLETED)
    return {
        "projects": len(store.projects),
        "active_runs": active,
        "completed_runs": completed,
        "total_runs": len(runs_list),
        "agents": len(store.agents),
        "platforms": len(store.platforms),
    }
