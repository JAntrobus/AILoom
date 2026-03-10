"""Base Agent class for the AILoom framework.

All custom agents **must** subclass :class:`BaseAgent` and implement
:meth:`execute`.  The framework enforces that every agent:

* Reports what task it is working on.
* Regularly emits :class:`~ailoom.models.ProgressReport` updates.
* Maintains individual learning via :class:`~ailoom.learning.LearningModule`.
"""

from __future__ import annotations

import logging
import threading
import time
from abc import ABC, abstractmethod
from collections.abc import Callable

from ailoom.exceptions import InvalidAgentStateError, TaskExecutionError
from ailoom.learning import LearningModule, Memory
from ailoom.models import (
    AgentStatus,
    Experience,
    ProgressReport,
    StatusReport,
    TaskInfo,
)

logger = logging.getLogger(__name__)


class BaseAgent(ABC):
    """Abstract base for all AILoom agents.

    Subclasses must implement :meth:`execute`.  The base class handles:

    * Lifecycle management (idle → running → completed/failed/paused).
    * Progress tracking and callbacks.
    * Individual and self-learning via :class:`~ailoom.learning.LearningModule`.
    * Thread-safe status reporting.

    Args:
        name: Unique name for this agent instance.
        description: Human-readable description of what this agent does.
        persistence_path: Optional path for persisting the agent's memory.
        progress_callback: Optional callable invoked whenever progress is
            updated.  Receives a single :class:`~ailoom.models.ProgressReport`.
    """

    def __init__(
        self,
        name: str,
        description: str,
        persistence_path: str | None = None,
        progress_callback: Callable[[ProgressReport], None] | None = None,
    ) -> None:
        self._name = name
        self._description = description
        self._status = AgentStatus.IDLE
        self._current_task: TaskInfo | None = None
        self._progress: ProgressReport | None = None
        self._progress_callback = progress_callback
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._pause_event.set()  # not paused initially

        memory = Memory(persistence_path=persistence_path)
        self._learning = LearningModule(memory)

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> str:
        return self._description

    @property
    def status(self) -> AgentStatus:
        with self._lock:
            return self._status

    @property
    def current_task(self) -> TaskInfo | None:
        with self._lock:
            return self._current_task

    @property
    def progress(self) -> ProgressReport | None:
        with self._lock:
            return self._progress

    @property
    def learning(self) -> LearningModule:
        """Access this agent's learning module."""
        return self._learning

    # ------------------------------------------------------------------
    # Abstract interface
    # ------------------------------------------------------------------

    @abstractmethod
    def execute(self, task: TaskInfo) -> str:
        """Perform the work described by *task* and return a result string.

        Implementations should call :meth:`report_progress` regularly so the
        framework can track how far along the task has progressed.

        Implementations should check :meth:`_check_pause_or_stop` at
        checkpoints to support pause/resume and graceful stopping.

        Args:
            task: The task to execute.

        Returns:
            A human-readable string describing the outcome.

        Raises:
            :class:`~ailoom.exceptions.TaskExecutionError`: If the task cannot
                be completed.
        """

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def run(self, task: TaskInfo) -> str:
        """Run *task* on this agent, managing lifecycle and learning.

        This is the primary entry point used by the
        :class:`~ailoom.manager.AgentManager`.

        Returns:
            The outcome string returned by :meth:`execute`.

        Raises:
            :class:`~ailoom.exceptions.InvalidAgentStateError`: If the agent is
                not in a state that allows running.
        """
        with self._lock:
            if self._status not in (AgentStatus.IDLE, AgentStatus.COMPLETED, AgentStatus.FAILED):
                raise InvalidAgentStateError(self._name, self._status.value, "run")
            self._status = AgentStatus.RUNNING
            self._current_task = task
            self._progress = None
            self._stop_event.clear()
            self._pause_event.set()

        logger.info("[%s] Starting task: %s", self._name, task)

        outcome: str | None = None
        success = False
        try:
            outcome = self.execute(task)
            success = True
            with self._lock:
                self._status = AgentStatus.COMPLETED
            logger.info("[%s] Task completed: %s", self._name, task)
        except TaskExecutionError:
            with self._lock:
                self._status = AgentStatus.FAILED
            logger.error("[%s] Task failed: %s", self._name, task)
            raise
        except Exception as exc:
            with self._lock:
                self._status = AgentStatus.FAILED
            logger.exception("[%s] Unexpected error during task %s", self._name, task)
            raise TaskExecutionError(self._name, task.name, str(exc)) from exc
        finally:
            experience = Experience(
                task=task,
                outcome=outcome or "task did not produce an outcome",
                success=success,
            )
            self._learning.memory.record(experience)

        return outcome  # type: ignore[return-value]

    def pause(self) -> None:
        """Pause execution at the next checkpoint.

        Raises:
            :class:`~ailoom.exceptions.InvalidAgentStateError`: If the agent is
                not currently running.
        """
        with self._lock:
            if self._status != AgentStatus.RUNNING:
                raise InvalidAgentStateError(
                    self._name, self._status.value, "pause"
                )
            self._status = AgentStatus.PAUSED
            self._pause_event.clear()
        logger.info("[%s] Paused.", self._name)

    def resume(self) -> None:
        """Resume execution after a pause.

        Raises:
            :class:`~ailoom.exceptions.InvalidAgentStateError`: If the agent is
                not currently paused.
        """
        with self._lock:
            if self._status != AgentStatus.PAUSED:
                raise InvalidAgentStateError(
                    self._name, self._status.value, "resume"
                )
            self._status = AgentStatus.RUNNING
            self._pause_event.set()
        logger.info("[%s] Resumed.", self._name)

    def stop(self) -> None:
        """Request the agent to stop at the next checkpoint."""
        self._stop_event.set()
        self._pause_event.set()  # unblock any waiting pause
        logger.info("[%s] Stop requested.", self._name)

    # ------------------------------------------------------------------
    # Progress reporting
    # ------------------------------------------------------------------

    def report_progress(
        self,
        percentage: float,
        current_step: int,
        total_steps: int,
        message: str = "",
    ) -> None:
        """Update and broadcast the agent's progress.

        Should be called from within :meth:`execute`.

        Args:
            percentage: Completion percentage (0–100).
            current_step: The step just completed.
            total_steps: Total number of steps in the task.
            message: Optional human-readable status message.
        """
        report = ProgressReport(
            percentage=percentage,
            current_step=current_step,
            total_steps=total_steps,
            message=message,
        )
        with self._lock:
            self._progress = report
        logger.debug("[%s] Progress: %s", self._name, report)
        if self._progress_callback:
            self._progress_callback(report)

    def report_status(self) -> StatusReport:
        """Return a comprehensive snapshot of the agent's current state."""
        with self._lock:
            return StatusReport(
                agent_name=self._name,
                status=self._status,
                current_task=self._current_task,
                progress=self._progress,
            )

    # ------------------------------------------------------------------
    # Learning
    # ------------------------------------------------------------------

    def learn(self, experience: Experience) -> None:
        """Apply external feedback to the agent's learning module.

        Args:
            experience: A completed experience, typically with ``feedback``
                set by a supervisor or end user.
        """
        lesson = self._learning.learn_from_feedback(experience)
        logger.info("[%s] Learned: %s", self._name, lesson)

    def self_learn(self) -> None:
        """Trigger autonomous self-learning from the agent's own memories."""
        new_lessons = self._learning.self_learn()
        for lesson in new_lessons:
            logger.info("[%s] Self-learned: %s", self._name, lesson)

    # ------------------------------------------------------------------
    # Checkpoint helpers (for use inside execute())
    # ------------------------------------------------------------------

    def _check_pause_or_stop(self) -> bool:
        """Block if paused; return ``True`` if the agent should stop.

        Implementations of :meth:`execute` should call this at natural
        checkpoints::

            if self._check_pause_or_stop():
                return "stopped early"
        """
        self._pause_event.wait()  # blocks while paused
        return self._stop_event.is_set()

    def _sleep_interruptible(self, seconds: float) -> bool:
        """Sleep for *seconds*, returning ``True`` early if stop is requested."""
        end = time.monotonic() + seconds
        interval = 0.1
        while time.monotonic() < end:
            if self._stop_event.is_set():
                return True
            self._pause_event.wait()
            time.sleep(min(interval, end - time.monotonic()))
        return False

    # ------------------------------------------------------------------
    # Dunder helpers
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        return (
            f"{type(self).__name__}(name={self._name!r}, "
            f"status={self._status.value!r})"
        )
