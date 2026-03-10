"""Custom exceptions for the AILoom framework."""


class AILoomError(Exception):
    """Base class for all AILoom errors."""


class AgentNotFoundError(AILoomError):
    """Raised when an agent cannot be found in the manager or registry."""

    def __init__(self, name: str) -> None:
        super().__init__(f"Agent {name!r} not found.")
        self.name = name


class AgentAlreadyRegisteredError(AILoomError):
    """Raised when attempting to register an agent under a name that is already taken."""

    def __init__(self, name: str) -> None:
        super().__init__(f"An agent named {name!r} is already registered.")
        self.name = name


class AgentTypeNotFoundError(AILoomError):
    """Raised when an agent *type* (class) cannot be found in the registry."""

    def __init__(self, type_name: str) -> None:
        super().__init__(f"Agent type {type_name!r} is not registered.")
        self.type_name = type_name


class InvalidAgentStateError(AILoomError):
    """Raised when an operation is invalid for the agent's current state."""

    def __init__(self, agent_name: str, current_state: str, operation: str) -> None:
        super().__init__(
            f"Cannot perform {operation!r} on agent {agent_name!r} "
            f"in state {current_state!r}."
        )
        self.agent_name = agent_name
        self.current_state = current_state
        self.operation = operation


class TaskExecutionError(AILoomError):
    """Raised when a task execution fails inside an agent."""

    def __init__(self, agent_name: str, task_name: str, reason: str) -> None:
        super().__init__(
            f"Agent {agent_name!r} failed to execute task {task_name!r}: {reason}"
        )
        self.agent_name = agent_name
        self.task_name = task_name
        self.reason = reason
