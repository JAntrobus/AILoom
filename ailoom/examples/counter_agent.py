"""CounterAgent – counts from 1 to N, reporting progress at every step."""

from __future__ import annotations

from ailoom.agent import BaseAgent
from ailoom.exceptions import TaskExecutionError
from ailoom.models import TaskInfo


class CounterAgent(BaseAgent):
    """Counts from 1 to ``n`` (provided as a task parameter).

    Demonstrates multi-step progress reporting and checkpoint-based
    pause/stop support.

    Example::

        agent = CounterAgent(name="counter", description="Counts to N")
        task = TaskInfo(name="count", description="Count to 5", parameters={"n": 5})
        result = agent.run(task)
        # result == "Counted to 5"
    """

    def execute(self, task: TaskInfo) -> str:
        n = task.parameters.get("n")
        if not isinstance(n, int) or n < 1:
            raise TaskExecutionError(
                self.name, task.name, "'n' must be a positive integer"
            )

        for i in range(1, n + 1):
            if self._check_pause_or_stop():
                return f"Stopped at {i - 1}"
            pct = i / n * 100
            self.report_progress(pct, i, n, f"Counted {i} of {n}")

        return f"Counted to {n}"
