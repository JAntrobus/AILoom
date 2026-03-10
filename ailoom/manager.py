"""Agent Manager for the AILoom framework.

The :class:`AgentManager` is the central orchestration component.  It allows
users to register agent *instances*, assign tasks to them, monitor their
progress and learning, and maintain control over their lifecycles.
"""

from __future__ import annotations

import concurrent.futures
import logging
import threading
from typing import Any

from ailoom.agent import BaseAgent
from ailoom.exceptions import (
    AgentAlreadyRegisteredError,
    AgentNotFoundError,
    InvalidAgentStateError,
)
from ailoom.models import AgentStatus, StatusReport, TaskInfo

logger = logging.getLogger(__name__)


class AgentManager:
    """Central controller for a fleet of :class:`~ailoom.agent.BaseAgent` instances.

    Usage::

        manager = AgentManager()
        manager.register(MyAgent(name="agent-1", description="..."))

        future = manager.assign_task(
            "agent-1",
            task_name="summarise",
            task_description="Summarise a document",
            document="...",
        )
        outcome = future.result()

        report = manager.get_status("agent-1")
        print(report)
    """

    def __init__(self, max_workers: int = 10) -> None:
        self._agents: dict[str, BaseAgent] = {}
        self._lock = threading.Lock()
        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_workers, thread_name_prefix="ailoom-worker"
        )

    # ------------------------------------------------------------------
    # Agent registration
    # ------------------------------------------------------------------

    def register(self, agent: BaseAgent) -> None:
        """Add *agent* to the manager.

        Args:
            agent: An agent instance to manage.

        Raises:
            :class:`~ailoom.exceptions.AgentAlreadyRegisteredError`: If an
                agent with the same name is already registered.
        """
        with self._lock:
            if agent.name in self._agents:
                raise AgentAlreadyRegisteredError(agent.name)
            self._agents[agent.name] = agent
        logger.info("Registered agent %r (%s)", agent.name, type(agent).__name__)

    def unregister(self, name: str) -> None:
        """Remove the agent named *name* from the manager.

        Raises:
            :class:`~ailoom.exceptions.AgentNotFoundError`: If no agent with
                that name is registered.
            :class:`~ailoom.exceptions.InvalidAgentStateError`: If the agent is
                currently running.
        """
        with self._lock:
            agent = self._agents.get(name)
            if agent is None:
                raise AgentNotFoundError(name)
            if agent.status == AgentStatus.RUNNING:
                raise InvalidAgentStateError(name, AgentStatus.RUNNING.value, "unregister")
            del self._agents[name]
        logger.info("Unregistered agent %r", name)

    def get(self, name: str) -> BaseAgent:
        """Return the registered agent named *name*.

        Raises:
            :class:`~ailoom.exceptions.AgentNotFoundError`: If not found.
        """
        with self._lock:
            agent = self._agents.get(name)
        if agent is None:
            raise AgentNotFoundError(name)
        return agent

    def list_agents(self) -> list[str]:
        """Return the names of all registered agents."""
        with self._lock:
            return list(self._agents.keys())

    # ------------------------------------------------------------------
    # Task assignment
    # ------------------------------------------------------------------

    def assign_task(
        self,
        agent_name: str,
        task_name: str,
        task_description: str,
        **task_parameters: Any,
    ) -> concurrent.futures.Future[str]:
        """Assign a task to the named agent and run it asynchronously.

        Args:
            agent_name: Name of the agent to run the task.
            task_name: Short identifier for the task.
            task_description: Human-readable description of the task.
            **task_parameters: Arbitrary key/value pairs passed to the task.

        Returns:
            A :class:`~concurrent.futures.Future` that resolves to the
            outcome string when the task completes.

        Raises:
            :class:`~ailoom.exceptions.AgentNotFoundError`: If the agent is
                not registered.
        """
        agent = self.get(agent_name)
        task = TaskInfo(
            name=task_name,
            description=task_description,
            parameters=task_parameters,
        )
        logger.info(
            "Assigning task %r to agent %r", task_name, agent_name
        )
        future: concurrent.futures.Future[str] = self._executor.submit(
            agent.run, task
        )
        return future

    # ------------------------------------------------------------------
    # Lifecycle control
    # ------------------------------------------------------------------

    def pause(self, agent_name: str) -> None:
        """Pause the named agent.

        Raises:
            :class:`~ailoom.exceptions.AgentNotFoundError`: If not found.
            :class:`~ailoom.exceptions.InvalidAgentStateError`: If not running.
        """
        self.get(agent_name).pause()

    def resume(self, agent_name: str) -> None:
        """Resume the named paused agent.

        Raises:
            :class:`~ailoom.exceptions.AgentNotFoundError`: If not found.
            :class:`~ailoom.exceptions.InvalidAgentStateError`: If not paused.
        """
        self.get(agent_name).resume()

    def stop(self, agent_name: str) -> None:
        """Request the named agent to stop at its next checkpoint.

        Raises:
            :class:`~ailoom.exceptions.AgentNotFoundError`: If not found.
        """
        self.get(agent_name).stop()

    # ------------------------------------------------------------------
    # Status & reporting
    # ------------------------------------------------------------------

    def get_status(self, agent_name: str) -> StatusReport:
        """Return a :class:`~ailoom.models.StatusReport` for the named agent.

        Raises:
            :class:`~ailoom.exceptions.AgentNotFoundError`: If not found.
        """
        return self.get(agent_name).report_status()

    def get_all_statuses(self) -> dict[str, StatusReport]:
        """Return status reports for every registered agent."""
        with self._lock:
            agents = dict(self._agents)
        return {name: agent.report_status() for name, agent in agents.items()}

    # ------------------------------------------------------------------
    # Shutdown
    # ------------------------------------------------------------------

    def shutdown(self, wait: bool = True) -> None:
        """Shut down the internal thread-pool.

        Args:
            wait: If ``True`` (default), block until all running tasks finish.
        """
        self._executor.shutdown(wait=wait)
        logger.info("AgentManager shut down.")

    # ------------------------------------------------------------------
    # Dunder helpers
    # ------------------------------------------------------------------

    def __len__(self) -> int:
        with self._lock:
            return len(self._agents)

    def __repr__(self) -> str:
        with self._lock:
            names = list(self._agents.keys())
        return f"AgentManager(agents={names!r})"
