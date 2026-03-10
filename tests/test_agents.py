"""Tests for ailoom.agent (BaseAgent) and example agents."""

import threading
import time

import pytest

from ailoom.agent import BaseAgent
from ailoom.examples import CounterAgent, EchoAgent, SummariserAgent
from ailoom.exceptions import InvalidAgentStateError, TaskExecutionError
from ailoom.models import AgentStatus, Experience, TaskInfo

# ---------------------------------------------------------------------------
# A minimal concrete agent for testing BaseAgent directly
# ---------------------------------------------------------------------------

class SimpleAgent(BaseAgent):
    """Returns a constant string; used to test BaseAgent mechanics."""

    def execute(self, task: TaskInfo) -> str:
        self.report_progress(50, 1, 2, "halfway")
        self.report_progress(100, 2, 2, "done")
        return "result"


class BrokenAgent(BaseAgent):
    """Always raises an error."""

    def execute(self, task: TaskInfo) -> str:
        raise TaskExecutionError(self.name, "broken_task", "intentional failure")


class SlowAgent(BaseAgent):
    """Sleeps in tiny increments, checking for stop/pause."""

    def execute(self, task: TaskInfo) -> str:
        steps = task.parameters.get("steps", 10)
        for i in range(steps):
            if self._check_pause_or_stop():
                return "stopped"
            self._sleep_interruptible(0.05)
            self.report_progress((i + 1) / steps * 100, i + 1, steps, f"step {i + 1}")
        return "finished"


# ---------------------------------------------------------------------------
# BaseAgent tests
# ---------------------------------------------------------------------------

class TestBaseAgentLifecycle:
    def make_agent(self):
        return SimpleAgent(name="simple", description="A simple agent")

    def make_task(self):
        return TaskInfo(name="test", description="A test task")

    def test_initial_status(self):
        agent = self.make_agent()
        assert agent.status == AgentStatus.IDLE

    def test_run_success(self):
        agent = self.make_agent()
        task = self.make_task()
        result = agent.run(task)
        assert result == "result"
        assert agent.status == AgentStatus.COMPLETED

    def test_run_sets_task(self):
        agent = self.make_agent()
        task = self.make_task()
        agent.run(task)
        assert agent.current_task == task

    def test_run_updates_progress(self):
        reports = []
        agent = SimpleAgent(
            name="simple",
            description="with callback",
            progress_callback=reports.append,
        )
        agent.run(TaskInfo(name="t", description="d"))
        assert len(reports) == 2
        assert reports[-1].percentage == 100.0

    def test_run_records_experience(self):
        agent = self.make_agent()
        agent.run(self.make_task())
        assert len(agent.learning.memory) == 1

    def test_run_failure_status(self):
        agent = BrokenAgent(name="broken", description="always fails")
        with pytest.raises(TaskExecutionError):
            agent.run(TaskInfo(name="t", description="d"))
        assert agent.status == AgentStatus.FAILED

    def test_run_failure_records_experience(self):
        agent = BrokenAgent(name="broken", description="always fails")
        with pytest.raises(TaskExecutionError):
            agent.run(TaskInfo(name="t", description="d"))
        assert len(agent.learning.memory) == 1
        assert not agent.learning.memory.all()[0].success

    def test_cannot_run_while_running(self):
        slow = SlowAgent(name="slow", description="slow agent")
        task = TaskInfo(name="slow_task", description="slow", parameters={"steps": 20})

        t = threading.Thread(target=slow.run, args=(task,))
        t.start()
        time.sleep(0.05)  # wait for agent to start

        with pytest.raises(InvalidAgentStateError):
            slow.run(TaskInfo(name="t", description="d"))

        slow.stop()
        t.join(timeout=5)

    def test_can_run_after_completion(self):
        agent = self.make_agent()
        agent.run(self.make_task())
        assert agent.status == AgentStatus.COMPLETED
        agent.run(self.make_task())
        assert agent.status == AgentStatus.COMPLETED

    def test_report_status(self):
        agent = self.make_agent()
        status = agent.report_status()
        assert status.agent_name == "simple"
        assert status.status == AgentStatus.IDLE

    def test_repr(self):
        agent = self.make_agent()
        r = repr(agent)
        assert "SimpleAgent" in r
        assert "simple" in r


class TestBaseAgentPauseResume:
    def test_pause_and_resume(self):
        slow = SlowAgent(name="slow", description="slow")
        task = TaskInfo(name="t", description="d", parameters={"steps": 20})
        results = []

        def runner():
            results.append(slow.run(task))

        t = threading.Thread(target=runner)
        t.start()
        time.sleep(0.05)

        slow.pause()
        assert slow.status == AgentStatus.PAUSED

        time.sleep(0.1)  # should not progress while paused

        slow.resume()
        assert slow.status == AgentStatus.RUNNING

        slow.stop()
        t.join(timeout=5)

    def test_pause_when_not_running_raises(self):
        agent = SimpleAgent(name="s", description="s")
        with pytest.raises(InvalidAgentStateError):
            agent.pause()

    def test_resume_when_not_paused_raises(self):
        agent = SimpleAgent(name="s", description="s")
        with pytest.raises(InvalidAgentStateError):
            agent.resume()


class TestBaseAgentStop:
    def test_stop_interrupts_agent(self):
        slow = SlowAgent(name="slow", description="slow")
        task = TaskInfo(name="t", description="d", parameters={"steps": 50})
        results = []

        def runner():
            results.append(slow.run(task))

        t = threading.Thread(target=runner)
        t.start()
        time.sleep(0.05)
        slow.stop()
        t.join(timeout=5)

        assert results == ["stopped"]
        # After a stop the agent should be COMPLETED (it returned normally)
        assert slow.status == AgentStatus.COMPLETED


class TestBaseAgentLearning:
    def test_learn_records_and_returns_lesson(self):
        agent = SimpleAgent(name="s", description="s")
        task = TaskInfo(name="t", description="d")
        exp = Experience(task=task, outcome="great", success=True, feedback="Perfect!")
        agent.learn(exp)
        assert len(agent.learning.lessons) == 1
        assert len(agent.learning.memory) == 1

    def test_self_learn_creates_lessons(self):
        agent = SimpleAgent(name="s", description="s")
        task = TaskInfo(name="learn_task", description="d")
        for _ in range(5):
            agent.learning.memory.record(
                Experience(task=task, outcome="ok", success=True)
            )
        agent.self_learn()
        assert len(agent.learning.lessons) >= 1


# ---------------------------------------------------------------------------
# EchoAgent tests
# ---------------------------------------------------------------------------

class TestEchoAgent:
    def test_echoes_parameters(self):
        agent = EchoAgent(name="echo", description="echo")
        task = TaskInfo(name="ping", description="test", parameters={"msg": "hello"})
        result = agent.run(task)
        assert "ping" in result
        assert "hello" in result

    def test_completes(self):
        agent = EchoAgent(name="echo", description="echo")
        agent.run(TaskInfo(name="t", description="d"))
        assert agent.status == AgentStatus.COMPLETED


# ---------------------------------------------------------------------------
# CounterAgent tests
# ---------------------------------------------------------------------------

class TestCounterAgent:
    def test_counts_to_n(self):
        agent = CounterAgent(name="counter", description="counter")
        task = TaskInfo(name="count", description="count", parameters={"n": 5})
        result = agent.run(task)
        assert result == "Counted to 5"

    def test_progress_reported(self):
        reports = []
        agent = CounterAgent(
            name="counter", description="counter", progress_callback=reports.append
        )
        agent.run(TaskInfo(name="count", description="d", parameters={"n": 3}))
        assert len(reports) == 3
        assert reports[-1].percentage == pytest.approx(100.0)

    def test_invalid_n(self):
        agent = CounterAgent(name="counter", description="counter")
        task = TaskInfo(name="count", description="d", parameters={"n": -1})
        with pytest.raises(TaskExecutionError):
            agent.run(task)

    def test_missing_n(self):
        agent = CounterAgent(name="counter", description="counter")
        task = TaskInfo(name="count", description="d", parameters={})
        with pytest.raises(TaskExecutionError):
            agent.run(task)


# ---------------------------------------------------------------------------
# SummariserAgent tests
# ---------------------------------------------------------------------------

class TestSummariserAgent:
    def test_summarises_text(self):
        agent = SummariserAgent(name="sum", description="summariser")
        text = "The sky is blue. The grass is green. The sun is bright."
        task = TaskInfo(name="summarise", description="sum", parameters={"text": text})
        result = agent.run(task)
        assert "Word count:" in result
        assert "Sentences extracted:" in result
        assert "Summary:" in result

    def test_empty_text_raises(self):
        agent = SummariserAgent(name="sum", description="summariser")
        task = TaskInfo(name="summarise", description="sum", parameters={"text": "  "})
        with pytest.raises(TaskExecutionError):
            agent.run(task)

    def test_max_sentences_respected(self):
        agent = SummariserAgent(name="sum", description="summariser")
        text = "One. Two. Three. Four. Five."
        task = TaskInfo(
            name="summarise",
            description="sum",
            parameters={"text": text, "max_sentences": 2},
        )
        result = agent.run(task)
        assert "Sentences extracted: 2" in result

    def test_triggers_self_learn(self):
        agent = SummariserAgent(name="sum", description="summariser")
        text = "Alpha. Beta. Gamma."
        task = TaskInfo(name="summarise", description="sum", parameters={"text": text})
        # Run twice so self_learn has enough data
        agent.run(task)
        agent.run(task)
        # After two runs, memory should have 2 entries; lessons may have been derived
        assert len(agent.learning.memory) == 2
