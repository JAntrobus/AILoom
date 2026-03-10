"""SummariserAgent – a word-count summariser that demonstrates text processing."""

from __future__ import annotations

from ailoom.agent import BaseAgent
from ailoom.exceptions import TaskExecutionError
from ailoom.models import TaskInfo


class SummariserAgent(BaseAgent):
    """Produces a simple word-count summary of the provided text.

    Demonstrates a multi-step processing pipeline with progress reporting and
    self-learning (improves its lessons as it processes more documents).

    Task parameters:

    ``text`` (str):
        The text to summarise.

    ``max_sentences`` (int, optional):
        Maximum number of sentences to extract (default: 3).

    Example::

        agent = SummariserAgent(name="summariser", description="Summarises text")
        task = TaskInfo(
            name="summarise",
            description="Summarise a document",
            parameters={"text": "The quick brown fox..."},
        )
        result = agent.run(task)
    """

    def execute(self, task: TaskInfo) -> str:
        text: str = task.parameters.get("text", "")
        if not isinstance(text, str) or not text.strip():
            raise TaskExecutionError(
                self.name, task.name, "'text' must be a non-empty string"
            )

        max_sentences: int = task.parameters.get("max_sentences", 3)

        # Step 1 – tokenise
        self.report_progress(0, 0, 4, "Tokenising text…")
        if self._check_pause_or_stop():
            return "stopped"
        words = text.split()
        word_count = len(words)

        # Step 2 – sentence split
        self.report_progress(25, 1, 4, "Splitting sentences…")
        if self._check_pause_or_stop():
            return "stopped"
        sentences = [
            s.strip()
            for s in text.replace("?", ".").replace("!", ".").split(".")
            if s.strip()
        ]

        # Step 3 – extract top sentences (naive: just take first N)
        self.report_progress(50, 2, 4, "Extracting key sentences…")
        if self._check_pause_or_stop():
            return "stopped"
        selected = sentences[:max_sentences]

        # Step 4 – format result
        self.report_progress(75, 3, 4, "Formatting summary…")
        if self._check_pause_or_stop():
            return "stopped"
        summary_text = ". ".join(selected)
        if summary_text and not summary_text.endswith("."):
            summary_text += "."

        self.report_progress(100, 4, 4, "Summary complete.")

        result = (
            f"Word count: {word_count} | "
            f"Sentences extracted: {len(selected)} | "
            f"Summary: {summary_text}"
        )

        # Trigger self-learning after each successful summarisation
        self.self_learn()

        return result
