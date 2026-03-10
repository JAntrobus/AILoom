"""Tests for ailoom.models."""

import pytest

from ailoom.models import (
    AgentStatus,
    Experience,
    ProgressReport,
    StatusReport,
    TaskInfo,
)


class TestAgentStatus:
    def test_enum_values(self):
        assert AgentStatus.IDLE.value == "idle"
        assert AgentStatus.RUNNING.value == "running"
        assert AgentStatus.PAUSED.value == "paused"
        assert AgentStatus.COMPLETED.value == "completed"
        assert AgentStatus.FAILED.value == "failed"

    def test_is_string_enum(self):
        assert AgentStatus.IDLE == "idle"


class TestTaskInfo:
    def test_defaults(self):
        task = TaskInfo(name="test", description="A test task")
        assert task.name == "test"
        assert task.description == "A test task"
        assert task.parameters == {}
        assert task.task_id  # auto-generated UUID

    def test_custom_parameters(self):
        task = TaskInfo(name="greet", description="Say hello", parameters={"name": "Alice"})
        assert task.parameters["name"] == "Alice"

    def test_str(self):
        task = TaskInfo(name="greet", description="Say hello")
        s = str(task)
        assert "greet" in s
        assert task.task_id in s


class TestProgressReport:
    def test_valid(self):
        r = ProgressReport(percentage=50.0, current_step=1, total_steps=2, message="halfway")
        assert r.percentage == 50.0
        assert r.current_step == 1
        assert r.total_steps == 2
        assert r.message == "halfway"

    def test_percentage_out_of_range(self):
        with pytest.raises(ValueError, match="percentage"):
            ProgressReport(percentage=101.0, current_step=1, total_steps=1)

    def test_negative_percentage(self):
        with pytest.raises(ValueError, match="percentage"):
            ProgressReport(percentage=-1.0, current_step=0, total_steps=1)

    def test_total_steps_zero(self):
        with pytest.raises(ValueError, match="total_steps"):
            ProgressReport(percentage=0.0, current_step=0, total_steps=0)

    def test_current_step_exceeds_total(self):
        with pytest.raises(ValueError, match="current_step"):
            ProgressReport(percentage=100.0, current_step=5, total_steps=4)

    def test_str_contains_bar(self):
        r = ProgressReport(percentage=50.0, current_step=1, total_steps=2)
        s = str(r)
        assert "50.0%" in s
        assert "1/2" in s

    def test_boundary_zero_percent(self):
        r = ProgressReport(percentage=0.0, current_step=0, total_steps=5)
        assert r.percentage == 0.0

    def test_boundary_hundred_percent(self):
        r = ProgressReport(percentage=100.0, current_step=5, total_steps=5)
        assert r.percentage == 100.0


class TestExperience:
    def test_defaults(self):
        task = TaskInfo(name="t", description="d")
        exp = Experience(task=task, outcome="done", success=True)
        assert exp.success is True
        assert exp.feedback is None
        assert exp.metadata == {}

    def test_str_success(self):
        task = TaskInfo(name="t", description="d")
        exp = Experience(task=task, outcome="ok", success=True)
        assert "✓" in str(exp)

    def test_str_failure(self):
        task = TaskInfo(name="t", description="d")
        exp = Experience(task=task, outcome="bad", success=False)
        assert "✗" in str(exp)


class TestStatusReport:
    def test_str(self):
        task = TaskInfo(name="work", description="doing work")
        progress = ProgressReport(percentage=30.0, current_step=1, total_steps=3)
        report = StatusReport(
            agent_name="myagent",
            status=AgentStatus.RUNNING,
            current_task=task,
            progress=progress,
        )
        s = str(report)
        assert "myagent" in s
        assert "running" in s
        assert "work" in s

    def test_str_no_task(self):
        report = StatusReport(
            agent_name="myagent",
            status=AgentStatus.IDLE,
            current_task=None,
            progress=None,
        )
        s = str(report)
        assert "none" in s
        assert "N/A" in s
