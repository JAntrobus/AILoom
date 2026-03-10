"""Learning module for AILoom agents.

Provides :class:`Memory` for persisting :class:`~ailoom.models.Experience` objects
and :class:`LearningModule` which analyses that memory to derive lessons an agent
can act on.
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from ailoom.models import Experience


@dataclass
class Lesson:
    """A piece of knowledge derived from one or more experiences."""

    summary: str
    confidence: float  # 0.0 – 1.0
    source_count: int
    derived_at: datetime = field(
        default_factory=lambda: datetime.now(tz=timezone.utc)
    )
    metadata: dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        return (
            f"Lesson(confidence={self.confidence:.0%}, "
            f"sources={self.source_count}): {self.summary!r}"
        )


class Memory:
    """Stores and retrieves :class:`~ailoom.models.Experience` objects.

    Experiences can optionally be persisted to a JSON file so they survive
    process restarts (individual-agent learning that endures over time).
    """

    def __init__(self, persistence_path: str | None = None) -> None:
        self._experiences: list[Experience] = []
        self._persistence_path = persistence_path
        if persistence_path and os.path.exists(persistence_path):
            self._load(persistence_path)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def record(self, experience: Experience) -> None:
        """Add an experience to memory and optionally persist it."""
        self._experiences.append(experience)
        if self._persistence_path:
            self._save(self._persistence_path)

    def all(self) -> list[Experience]:
        """Return all stored experiences (oldest first)."""
        return list(self._experiences)

    def successful(self) -> list[Experience]:
        """Return only experiences where the task succeeded."""
        return [e for e in self._experiences if e.success]

    def failed(self) -> list[Experience]:
        """Return only experiences where the task failed."""
        return [e for e in self._experiences if not e.success]

    def for_task(self, task_name: str) -> list[Experience]:
        """Return all experiences for a given task name."""
        return [e for e in self._experiences if e.task.name == task_name]

    def clear(self) -> None:
        """Remove all stored experiences (and the persistence file if set)."""
        self._experiences.clear()
        if self._persistence_path and os.path.exists(self._persistence_path):
            os.remove(self._persistence_path)

    def __len__(self) -> int:
        return len(self._experiences)

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------

    def _save(self, path: str) -> None:
        records = []
        for exp in self._experiences:
            d = asdict(exp)
            # Convert non-serialisable datetime fields to ISO strings
            d["recorded_at"] = exp.recorded_at.isoformat()
            d["task"]["created_at"] = exp.task.created_at.isoformat()
            records.append(d)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(records, fh, indent=2, default=str)

    def _load(self, path: str) -> None:
        with open(path, encoding="utf-8") as fh:
            records = json.load(fh)
        from ailoom.models import TaskInfo

        for d in records:
            task_data = d["task"]
            task = TaskInfo(
                name=task_data["name"],
                description=task_data["description"],
                parameters=task_data.get("parameters", {}),
                task_id=task_data["task_id"],
                created_at=datetime.fromisoformat(task_data["created_at"]),
            )
            exp = Experience(
                task=task,
                outcome=d["outcome"],
                success=d["success"],
                feedback=d.get("feedback"),
                metadata=d.get("metadata", {}),
                recorded_at=datetime.fromisoformat(d["recorded_at"]),
            )
            self._experiences.append(exp)


class LearningModule:
    """Analyses an agent's :class:`Memory` and produces :class:`Lesson` objects.

    Two modes are supported:

    * **Individual learning** – the agent learns from external ``feedback``
      provided by a human or supervisor (:meth:`learn_from_feedback`).
    * **Self-learning** – the agent analyses its own past experiences and
      derives lessons autonomously (:meth:`self_learn`).
    """

    def __init__(self, memory: Memory) -> None:
        self._memory = memory
        self._lessons: list[Lesson] = []

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def lessons(self) -> list[Lesson]:
        """Return all lessons derived so far."""
        return list(self._lessons)

    @property
    def memory(self) -> Memory:
        return self._memory

    def learn_from_feedback(self, experience: Experience) -> Lesson:
        """Record an experience with external feedback and derive a lesson.

        Args:
            experience: The completed experience (must have ``feedback`` set).

        Returns:
            The :class:`Lesson` derived from this experience.
        """
        self._memory.record(experience)
        summary = self._summarise_single(experience)
        lesson = Lesson(
            summary=summary,
            confidence=1.0 if experience.success else 0.5,
            source_count=1,
            metadata={"task_id": experience.task.task_id},
        )
        self._lessons.append(lesson)
        return lesson

    def self_learn(self) -> list[Lesson]:
        """Analyse all stored experiences and derive new lessons autonomously.

        Groups experiences by task name and creates a lesson for each group
        that has enough data.  Already-known lessons are not duplicated.

        Returns:
            A list of newly derived :class:`Lesson` objects.
        """
        from collections import defaultdict

        groups: dict[str, list[Experience]] = defaultdict(list)
        for exp in self._memory.all():
            groups[exp.task.name].append(exp)

        new_lessons: list[Lesson] = []
        known_summaries = {lesson.summary for lesson in self._lessons}

        for task_name, experiences in groups.items():
            lesson = self._derive_lesson(task_name, experiences)
            if lesson and lesson.summary not in known_summaries:
                self._lessons.append(lesson)
                new_lessons.append(lesson)
                known_summaries.add(lesson.summary)

        return new_lessons

    def clear_lessons(self) -> None:
        """Remove all derived lessons."""
        self._lessons.clear()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _summarise_single(self, experience: Experience) -> str:
        if experience.feedback:
            return (
                f"Task '{experience.task.name}': {experience.feedback}"
            )
        verb = "succeeded" if experience.success else "failed"
        return f"Task '{experience.task.name}' {verb}: {experience.outcome}"

    def _derive_lesson(
        self, task_name: str, experiences: list[Experience]
    ) -> Lesson | None:
        if not experiences:
            return None

        total = len(experiences)
        successes = sum(1 for e in experiences if e.success)
        success_rate = successes / total
        confidence = min(0.5 + success_rate * 0.5, 1.0)

        if success_rate >= 0.8:
            summary = (
                f"Task '{task_name}' has a high success rate "
                f"({successes}/{total} attempts)."
            )
        elif success_rate <= 0.2:
            summary = (
                f"Task '{task_name}' fails frequently "
                f"({total - successes}/{total} attempts). Review implementation."
            )
        else:
            summary = (
                f"Task '{task_name}' has mixed results "
                f"({successes}/{total} successes). Consider improvements."
            )

        return Lesson(
            summary=summary,
            confidence=confidence,
            source_count=total,
            metadata={"task_name": task_name, "success_rate": success_rate},
        )
