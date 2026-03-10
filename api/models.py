from __future__ import annotations
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field
import uuid

def now(): return datetime.now(tz=timezone.utc)
def uid(): return str(uuid.uuid4())

class ProviderType(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    AZURE = "azure"
    GOOGLE = "google"
    CUSTOM = "custom"

class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"

class AgentStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"

class ProjectStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"

class Platform(BaseModel):
    id: str = Field(default_factory=uid)
    name: str
    provider: ProviderType
    api_key_hint: str = ""   # last 4 chars of key, masked
    base_url: Optional[str] = None
    models: list[str] = []
    is_connected: bool = False
    created_at: datetime = Field(default_factory=now)

class PlatformCreate(BaseModel):
    name: str
    provider: ProviderType
    api_key: str
    base_url: Optional[str] = None

class Agent(BaseModel):
    id: str = Field(default_factory=uid)
    name: str
    description: str
    platform_id: str
    model: str
    status: AgentStatus = AgentStatus.IDLE
    task_count: int = 0
    created_at: datetime = Field(default_factory=now)

class AgentCreate(BaseModel):
    name: str
    description: str
    platform_id: str
    model: str

class WorkflowNode(BaseModel):
    id: str = Field(default_factory=uid)
    type: str  # "start" | "agent" | "end"
    label: str
    agent_id: Optional[str] = None
    x: float = 0
    y: float = 0

class WorkflowEdge(BaseModel):
    id: str = Field(default_factory=uid)
    source: str
    target: str
    label: str = ""

class Workflow(BaseModel):
    id: str = Field(default_factory=uid)
    name: str
    nodes: list[WorkflowNode] = []
    edges: list[WorkflowEdge] = []
    created_at: datetime = Field(default_factory=now)

class WorkflowCreate(BaseModel):
    name: str
    nodes: list[WorkflowNode] = []
    edges: list[WorkflowEdge] = []

class Project(BaseModel):
    id: str = Field(default_factory=uid)
    name: str
    description: str
    status: ProjectStatus = ProjectStatus.ACTIVE
    workflow_id: Optional[str] = None
    tags: list[str] = []
    run_count: int = 0
    last_run_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now)

class ProjectCreate(BaseModel):
    name: str
    description: str
    workflow_id: Optional[str] = None
    tags: list[str] = []

class RunStep(BaseModel):
    id: str = Field(default_factory=uid)
    agent_id: str
    agent_name: str
    status: RunStatus = RunStatus.PENDING
    progress: float = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    output: str = ""
    logs: list[str] = []

class Run(BaseModel):
    id: str = Field(default_factory=uid)
    project_id: str
    project_name: str
    status: RunStatus = RunStatus.PENDING
    steps: list[RunStep] = []
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=now)

class RunCreate(BaseModel):
    project_id: str
