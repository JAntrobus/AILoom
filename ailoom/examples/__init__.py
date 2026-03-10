"""Example agents bundled with AILoom.

These agents demonstrate how to extend :class:`~ailoom.agent.BaseAgent` and
are useful for testing and experimentation.
"""

from ailoom.examples.counter_agent import CounterAgent
from ailoom.examples.echo_agent import EchoAgent
from ailoom.examples.summariser_agent import SummariserAgent

__all__ = ["EchoAgent", "CounterAgent", "SummariserAgent"]
