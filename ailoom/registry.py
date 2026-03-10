"""Agent Registry for the AILoom framework.

The :class:`AgentRegistry` acts as a factory – it maps agent *type names* to
their implementing classes so that new agent instances can be created
dynamically by name, enabling easy extensibility.
"""

from __future__ import annotations

from typing import Any

from ailoom.agent import BaseAgent
from ailoom.exceptions import AgentAlreadyRegisteredError, AgentTypeNotFoundError


class AgentRegistry:
    """A factory registry that maps type names to :class:`~ailoom.agent.BaseAgent` subclasses.

    Usage::

        registry = AgentRegistry()

        @registry.register
        class MyAgent(BaseAgent):
            ...

        agent = registry.create("MyAgent", name="agent-1", description="...")
    """

    def __init__(self) -> None:
        self._types: dict[str, type[BaseAgent]] = {}

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, cls: type[BaseAgent]) -> type[BaseAgent]:
        """Register an agent class under its ``__name__``.

        Can be used as a class decorator::

            @registry.register
            class MyAgent(BaseAgent): ...

        Args:
            cls: A subclass of :class:`~ailoom.agent.BaseAgent`.

        Returns:
            *cls* unchanged (so it can be used as a decorator).

        Raises:
            :class:`~ailoom.exceptions.AgentAlreadyRegisteredError`: If the
                name is already taken.
        """
        self.register_as(cls.__name__, cls)
        return cls

    def register_as(self, type_name: str, cls: type[BaseAgent]) -> None:
        """Register *cls* under an explicit *type_name*.

        Args:
            type_name: The key to register the class under.
            cls: A subclass of :class:`~ailoom.agent.BaseAgent`.

        Raises:
            :class:`~ailoom.exceptions.AgentAlreadyRegisteredError`: If the
                name is already taken.
            TypeError: If *cls* is not a subclass of
                :class:`~ailoom.agent.BaseAgent`.
        """
        if not (isinstance(cls, type) and issubclass(cls, BaseAgent)):
            raise TypeError(
                f"{cls!r} must be a subclass of BaseAgent."
            )
        if type_name in self._types:
            raise AgentAlreadyRegisteredError(type_name)
        self._types[type_name] = cls

    def unregister(self, type_name: str) -> None:
        """Remove a type from the registry.

        Args:
            type_name: The key previously used to register the class.

        Raises:
            :class:`~ailoom.exceptions.AgentTypeNotFoundError`: If the name is
                not in the registry.
        """
        if type_name not in self._types:
            raise AgentTypeNotFoundError(type_name)
        del self._types[type_name]

    # ------------------------------------------------------------------
    # Factory
    # ------------------------------------------------------------------

    def create(self, type_name: str, **kwargs: Any) -> BaseAgent:
        """Instantiate a registered agent by its *type_name*.

        All *kwargs* are forwarded to the agent's ``__init__``.

        Args:
            type_name: The key the agent class was registered under.
            **kwargs: Keyword arguments passed to the agent constructor.

        Returns:
            A new agent instance.

        Raises:
            :class:`~ailoom.exceptions.AgentTypeNotFoundError`: If the type is
                not registered.
        """
        if type_name not in self._types:
            raise AgentTypeNotFoundError(type_name)
        return self._types[type_name](**kwargs)

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------

    def list_types(self) -> list[str]:
        """Return names of all registered agent types."""
        return list(self._types.keys())

    def get_type(self, type_name: str) -> type[BaseAgent]:
        """Return the class registered under *type_name*.

        Raises:
            :class:`~ailoom.exceptions.AgentTypeNotFoundError`: If not found.
        """
        if type_name not in self._types:
            raise AgentTypeNotFoundError(type_name)
        return self._types[type_name]

    def __len__(self) -> int:
        return len(self._types)

    def __contains__(self, type_name: object) -> bool:
        return type_name in self._types

    def __repr__(self) -> str:
        types = ", ".join(self._types)
        return f"AgentRegistry([{types}])"
