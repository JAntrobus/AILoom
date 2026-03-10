"""EchoAgent – a trivial example agent that echoes back its task parameters."""

from __future__ import annotations

from ailoom.agent import BaseAgent
from ailoom.models import TaskInfo


class EchoAgent(BaseAgent):
    """Returns a formatted echo of the task parameters.

    This is the simplest possible agent and is useful for verifying that the
    framework wiring works end-to-end.

    Example::

        agent = EchoAgent(name="echo", description="Echoes task parameters")
        task = TaskInfo(name="ping", description="Echo test", parameters={"msg": "hi"})
        result = agent.run(task)
        # result == "Echo: ping – {'msg': 'hi'}"
    """

    def execute(self, task: TaskInfo) -> str:
        self.report_progress(0, 0, 1, "Starting echo…")
        if self._check_pause_or_stop():
            return "stopped"
        self.report_progress(100, 1, 1, "Echo complete.")
        return f"Echo: {task.name} – {task.parameters}"
