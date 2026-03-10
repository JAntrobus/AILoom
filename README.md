# AILoom

A solution to managing, orchestrating and deploying AI agents – while keeping businesses and users in control.

## Overview

AILoom is a lightweight, highly extensible Python framework for building, orchestrating and deploying AI agents.  Every agent is required to:

- **Report what it is doing** – structured `TaskInfo` objects describe every unit of work.
- **Track and broadcast progress** – `ProgressReport` snapshots let users see exactly how far along a task is.
- **Learn from experience** – a built-in `LearningModule` supports both supervisor-driven feedback (*individual learning*) and autonomous pattern detection (*self-learning*).

## Quick start

```python
from ailoom import AgentManager, BaseAgent, TaskInfo

class GreetingAgent(BaseAgent):
    def execute(self, task: TaskInfo) -> str:
        self.report_progress(50, 1, 2, "Generating greeting…")
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

status = manager.get_status("greeter")
print(status)  # Agent 'greeter' | status=completed | task=greet | …
```

## Key concepts

| Component | Description |
|---|---|
| `BaseAgent` | Abstract base class every agent must extend.  Provides lifecycle, progress and learning APIs. |
| `AgentManager` | Registers agent instances, assigns tasks asynchronously and controls lifecycle (pause / resume / stop). |
| `AgentRegistry` | Factory that maps agent *type names* to classes so new agents can be created by name. |
| `LearningModule` | Stores experiences, accepts human feedback and derives lessons autonomously. |
| `TaskInfo` | Describes a unit of work (name, description, parameters). |
| `ProgressReport` | Timestamped snapshot of an agent's progress (%, step, message). |
| `Experience` | Records a completed task with outcome and optional feedback for later learning. |

## Creating a custom agent

```python
from ailoom import BaseAgent, TaskInfo

class MyAgent(BaseAgent):
    def execute(self, task: TaskInfo) -> str:
        # … do work, calling self.report_progress() at each step …
        # … check self._check_pause_or_stop() at natural checkpoints …
        return "result"
```

## Extensibility via registry

```python
from ailoom import AgentRegistry

registry = AgentRegistry()

@registry.register
class MyAgent(BaseAgent):
    def execute(self, task: TaskInfo) -> str:
        return "done"

agent = registry.create("MyAgent", name="my-1", description="My agent")
```

## Development

```bash
pip install -e ".[dev]"
pytest
ruff check ailoom/ tests/
```

