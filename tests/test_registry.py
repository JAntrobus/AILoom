"""Tests for ailoom.registry (AgentRegistry)."""

import pytest

from ailoom.agent import BaseAgent
from ailoom.exceptions import AgentAlreadyRegisteredError, AgentTypeNotFoundError
from ailoom.models import TaskInfo
from ailoom.registry import AgentRegistry


class AlphaAgent(BaseAgent):
    def execute(self, task: TaskInfo) -> str:
        return "alpha"


class BetaAgent(BaseAgent):
    def execute(self, task: TaskInfo) -> str:
        return "beta"


class TestAgentRegistry:
    def make_registry(self) -> AgentRegistry:
        return AgentRegistry()

    def test_register_and_list(self):
        reg = self.make_registry()
        reg.register(AlphaAgent)
        assert "AlphaAgent" in reg.list_types()

    def test_register_as_custom_name(self):
        reg = self.make_registry()
        reg.register_as("custom", AlphaAgent)
        assert "custom" in reg.list_types()

    def test_register_decorator(self):
        reg = self.make_registry()

        @reg.register
        class GammaAgent(BaseAgent):
            def execute(self, task: TaskInfo) -> str:
                return "gamma"

        assert "GammaAgent" in reg.list_types()

    def test_register_duplicate_raises(self):
        reg = self.make_registry()
        reg.register(AlphaAgent)
        with pytest.raises(AgentAlreadyRegisteredError):
            reg.register(AlphaAgent)

    def test_register_non_agent_raises(self):
        reg = self.make_registry()
        with pytest.raises(TypeError):
            reg.register_as("bad", object)  # type: ignore[arg-type]

    def test_unregister(self):
        reg = self.make_registry()
        reg.register(AlphaAgent)
        reg.unregister("AlphaAgent")
        assert "AlphaAgent" not in reg.list_types()

    def test_unregister_unknown_raises(self):
        reg = self.make_registry()
        with pytest.raises(AgentTypeNotFoundError):
            reg.unregister("Ghost")

    def test_create(self):
        reg = self.make_registry()
        reg.register(AlphaAgent)
        agent = reg.create("AlphaAgent", name="a1", description="desc")
        assert isinstance(agent, AlphaAgent)
        assert agent.name == "a1"

    def test_create_unknown_raises(self):
        reg = self.make_registry()
        with pytest.raises(AgentTypeNotFoundError):
            reg.create("Unknown", name="x", description="y")

    def test_get_type(self):
        reg = self.make_registry()
        reg.register(BetaAgent)
        cls = reg.get_type("BetaAgent")
        assert cls is BetaAgent

    def test_get_type_unknown_raises(self):
        reg = self.make_registry()
        with pytest.raises(AgentTypeNotFoundError):
            reg.get_type("Missing")

    def test_contains(self):
        reg = self.make_registry()
        reg.register(AlphaAgent)
        assert "AlphaAgent" in reg
        assert "BetaAgent" not in reg

    def test_len(self):
        reg = self.make_registry()
        assert len(reg) == 0
        reg.register(AlphaAgent)
        assert len(reg) == 1
        reg.register(BetaAgent)
        assert len(reg) == 2

    def test_repr(self):
        reg = self.make_registry()
        reg.register(AlphaAgent)
        assert "AlphaAgent" in repr(reg)
