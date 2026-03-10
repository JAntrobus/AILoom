"""Tests for ailoom.manager (AgentManager)."""

import time

import pytest

from ailoom.agent import BaseAgent
from ailoom.exceptions import (
    AgentAlreadyRegisteredError,
    AgentNotFoundError,
    InvalidAgentStateError,
)
from ailoom.manager import AgentManager
from ailoom.models import AgentStatus, TaskInfo


class QuickAgent(BaseAgent):
    def execute(self, task: TaskInfo) -> str:
        self.report_progress(100, 1, 1, "done")
        return f"ok: {task.name}"


class SlowManagerAgent(BaseAgent):
    """Slow agent for lifecycle tests."""

    def execute(self, task: TaskInfo) -> str:
        steps = task.parameters.get("steps", 10)
        for i in range(steps):
            if self._check_pause_or_stop():
                return "stopped"
            self._sleep_interruptible(0.05)
            self.report_progress((i + 1) / steps * 100, i + 1, steps)
        return "finished"


class TestAgentManagerRegistration:
    def make_manager(self) -> AgentManager:
        return AgentManager()

    def test_register_and_list(self):
        mgr = self.make_manager()
        mgr.register(QuickAgent(name="q", description="quick"))
        assert "q" in mgr.list_agents()

    def test_register_duplicate_raises(self):
        mgr = self.make_manager()
        mgr.register(QuickAgent(name="q", description="quick"))
        with pytest.raises(AgentAlreadyRegisteredError):
            mgr.register(QuickAgent(name="q", description="dup"))

    def test_get_known_agent(self):
        mgr = self.make_manager()
        agent = QuickAgent(name="q", description="quick")
        mgr.register(agent)
        assert mgr.get("q") is agent

    def test_get_unknown_raises(self):
        mgr = self.make_manager()
        with pytest.raises(AgentNotFoundError):
            mgr.get("ghost")

    def test_unregister(self):
        mgr = self.make_manager()
        mgr.register(QuickAgent(name="q", description="quick"))
        mgr.unregister("q")
        assert "q" not in mgr.list_agents()

    def test_unregister_unknown_raises(self):
        mgr = self.make_manager()
        with pytest.raises(AgentNotFoundError):
            mgr.unregister("ghost")

    def test_unregister_running_raises(self):
        mgr = self.make_manager()
        slow = SlowManagerAgent(name="s", description="slow")
        mgr.register(slow)
        future = mgr.assign_task("s", "slow_task", "desc", steps=20)
        time.sleep(0.05)

        with pytest.raises(InvalidAgentStateError):
            mgr.unregister("s")

        mgr.stop("s")
        future.result(timeout=5)

    def test_len(self):
        mgr = self.make_manager()
        assert len(mgr) == 0
        mgr.register(QuickAgent(name="q", description="q"))
        assert len(mgr) == 1

    def test_repr(self):
        mgr = self.make_manager()
        mgr.register(QuickAgent(name="q", description="q"))
        assert "q" in repr(mgr)


class TestAgentManagerTaskAssignment:
    def make_manager(self) -> AgentManager:
        return AgentManager()

    def test_assign_task_returns_future(self):
        mgr = self.make_manager()
        mgr.register(QuickAgent(name="q", description="quick"))
        future = mgr.assign_task("q", "my_task", "do something")
        result = future.result(timeout=5)
        assert result == "ok: my_task"

    def test_assign_task_unknown_agent_raises(self):
        mgr = self.make_manager()
        with pytest.raises(AgentNotFoundError):
            mgr.assign_task("ghost", "t", "d")

    def test_task_parameters_forwarded(self):
        class ParamAgent(BaseAgent):
            def execute(self, task: TaskInfo) -> str:
                return task.parameters.get("value", "none")

        mgr = self.make_manager()
        mgr.register(ParamAgent(name="p", description="p"))
        future = mgr.assign_task("p", "param_task", "desc", value="hello")
        assert future.result(timeout=5) == "hello"


class TestAgentManagerStatus:
    def make_manager(self) -> AgentManager:
        return AgentManager()

    def test_get_status_idle(self):
        mgr = self.make_manager()
        mgr.register(QuickAgent(name="q", description="quick"))
        status = mgr.get_status("q")
        assert status.status == AgentStatus.IDLE

    def test_get_status_after_task(self):
        mgr = self.make_manager()
        mgr.register(QuickAgent(name="q", description="quick"))
        future = mgr.assign_task("q", "t", "d")
        future.result(timeout=5)
        status = mgr.get_status("q")
        assert status.status == AgentStatus.COMPLETED

    def test_get_all_statuses(self):
        mgr = self.make_manager()
        mgr.register(QuickAgent(name="q1", description="q1"))
        mgr.register(QuickAgent(name="q2", description="q2"))
        statuses = mgr.get_all_statuses()
        assert set(statuses.keys()) == {"q1", "q2"}

    def test_get_status_unknown_raises(self):
        mgr = self.make_manager()
        with pytest.raises(AgentNotFoundError):
            mgr.get_status("ghost")


class TestAgentManagerLifecycle:
    def make_manager(self) -> AgentManager:
        return AgentManager()

    def test_pause_and_resume(self):
        mgr = self.make_manager()
        slow = SlowManagerAgent(name="s", description="slow")
        mgr.register(slow)
        future = mgr.assign_task("s", "slow_task", "desc", steps=20)
        time.sleep(0.05)

        mgr.pause("s")
        assert mgr.get_status("s").status == AgentStatus.PAUSED

        mgr.resume("s")
        assert mgr.get_status("s").status == AgentStatus.RUNNING

        mgr.stop("s")
        future.result(timeout=5)

    def test_stop(self):
        mgr = self.make_manager()
        slow = SlowManagerAgent(name="s", description="slow")
        mgr.register(slow)
        future = mgr.assign_task("s", "slow_task", "desc", steps=50)
        time.sleep(0.05)

        mgr.stop("s")
        result = future.result(timeout=5)
        assert result == "stopped"

    def test_pause_unknown_raises(self):
        mgr = self.make_manager()
        with pytest.raises(AgentNotFoundError):
            mgr.pause("ghost")

    def test_resume_unknown_raises(self):
        mgr = self.make_manager()
        with pytest.raises(AgentNotFoundError):
            mgr.resume("ghost")

    def test_stop_unknown_raises(self):
        mgr = self.make_manager()
        with pytest.raises(AgentNotFoundError):
            mgr.stop("ghost")

    def test_shutdown(self):
        mgr = self.make_manager()
        mgr.register(QuickAgent(name="q", description="q"))
        mgr.assign_task("q", "t", "d").result(timeout=5)
        mgr.shutdown()  # should not raise
