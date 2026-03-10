"""AILoom – AI agent management, orchestration and deployment framework.

Quickstart::

    from ailoom import AgentManager, AgentRegistry, BaseAgent, TaskInfo

    class GreetingAgent(BaseAgent):
        def execute(self, task: TaskInfo) -> str:
            self.report_progress(50, 1, 2, "Generating greeting...")
            name = task.parameters.get("name", "World")
            self.report_progress(100, 2, 2, "Done")
            return f"Hello, {name}!"

    manager = AgentManager()
    manager.register(GreetingAgent(name="greeter", description="Says hello"))

    future = manager.assign_task(
        "greeter",
        task_name="greet",
        task_description="Greet the user",
        name="Alice",
    )
    print(future.result())  # Hello, Alice!
"""

from ailoom.agent import BaseAgent
from ailoom.exceptions import (
    AgentAlreadyRegisteredError,
    AgentNotFoundError,
    AgentTypeNotFoundError,
    AILoomError,
    InvalidAgentStateError,
    TaskExecutionError,
)
from ailoom.learning import LearningModule, Lesson, Memory
from ailoom.manager import AgentManager
from ailoom.models import (
    AgentStatus,
    Experience,
    ProgressReport,
    StatusReport,
    TaskInfo,
)
from ailoom.registry import AgentRegistry

__all__ = [
    # Core
    "BaseAgent",
    "AgentManager",
    "AgentRegistry",
    # Models
    "AgentStatus",
    "TaskInfo",
    "ProgressReport",
    "Experience",
    "StatusReport",
    # Learning
    "Memory",
    "LearningModule",
    "Lesson",
    # Exceptions
    "AILoomError",
    "AgentNotFoundError",
    "AgentAlreadyRegisteredError",
    "AgentTypeNotFoundError",
    "InvalidAgentStateError",
    "TaskExecutionError",
]
