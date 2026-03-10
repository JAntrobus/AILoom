"""Data models for the AILoom framework."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


class AgentStatus(str, Enum):
    """Lifecycle states an agent can occupy."""

    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class TaskInfo:
    """Describes a unit of work assigned to an agent."""

    name: str
    description: str
    parameters: dict[str, Any] = field(default_factory=dict)
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))

    def __str__(self) -> str:
        return f"Task(id={self.task_id!r}, name={self.name!r})"


@dataclass
class ProgressReport:
    """A snapshot of an agent's progress on its current task."""

    percentage: float  # 0.0 – 100.0
    current_step: int
    total_steps: int
    message: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))

    def __post_init__(self) -> None:
        if not (0.0 <= self.percentage <= 100.0):
            raise ValueError(
                f"percentage must be between 0 and 100, got {self.percentage}"
            )
        if self.total_steps < 1:
            raise ValueError(
                f"total_steps must be at least 1, got {self.total_steps}"
            )
        if not (0 <= self.current_step <= self.total_steps):
            raise ValueError(
                f"current_step {self.current_step} out of range [0, {self.total_steps}]"
            )

    def __str__(self) -> str:
        bar_width = 20
        filled = int(self.percentage / 100 * bar_width)
        bar = "█" * filled + "░" * (bar_width - filled)
        return (
            f"[{bar}] {self.percentage:.1f}% "
            f"(step {self.current_step}/{self.total_steps}) – {self.message}"
        )


@dataclass
class Experience:
    """Records an agent's interaction with a task for later learning."""

    task: TaskInfo
    outcome: str  # human-readable result description
    success: bool
    feedback: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    recorded_at: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))

    def __str__(self) -> str:
        status = "✓" if self.success else "✗"
        return (
            f"Experience({status} task={self.task.name!r}, "
            f"outcome={self.outcome!r})"
        )


@dataclass
class StatusReport:
    """A comprehensive snapshot of an agent's state at a point in time."""

    agent_name: str
    status: AgentStatus
    current_task: TaskInfo | None
    progress: ProgressReport | None
    timestamp: datetime = field(default_factory=lambda: datetime.now(tz=timezone.utc))

    def __str__(self) -> str:
        task_desc = self.current_task.name if self.current_task else "none"
        progress_desc = str(self.progress) if self.progress else "N/A"
        return (
            f"Agent {self.agent_name!r} | status={self.status.value} "
            f"| task={task_desc} | progress={progress_desc}"
        )
