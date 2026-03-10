"""Tests for ailoom.learning."""

import os
import tempfile

from ailoom.learning import LearningModule, Lesson, Memory
from ailoom.models import Experience, TaskInfo


def make_task(name: str = "task") -> TaskInfo:
    return TaskInfo(name=name, description=f"Description of {name}")


def make_experience(task_name: str = "task", success: bool = True, feedback: str | None = None) -> Experience:
    return Experience(
        task=make_task(task_name),
        outcome="done" if success else "failed",
        success=success,
        feedback=feedback,
    )


class TestMemory:
    def test_empty_on_start(self):
        mem = Memory()
        assert len(mem) == 0
        assert mem.all() == []

    def test_record_and_retrieve(self):
        mem = Memory()
        exp = make_experience()
        mem.record(exp)
        assert len(mem) == 1
        assert mem.all()[0] is exp

    def test_successful_filter(self):
        mem = Memory()
        mem.record(make_experience(success=True))
        mem.record(make_experience(success=False))
        assert len(mem.successful()) == 1
        assert len(mem.failed()) == 1

    def test_for_task_filter(self):
        mem = Memory()
        mem.record(make_experience(task_name="alpha"))
        mem.record(make_experience(task_name="beta"))
        mem.record(make_experience(task_name="alpha"))
        assert len(mem.for_task("alpha")) == 2
        assert len(mem.for_task("beta")) == 1
        assert len(mem.for_task("gamma")) == 0

    def test_clear(self):
        mem = Memory()
        mem.record(make_experience())
        mem.clear()
        assert len(mem) == 0

    def test_persistence_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "memory.json")
            mem1 = Memory(persistence_path=path)
            mem1.record(make_experience(task_name="saved", success=True))
            assert os.path.exists(path)

            mem2 = Memory(persistence_path=path)
            assert len(mem2) == 1
            loaded = mem2.all()[0]
            assert loaded.task.name == "saved"
            assert loaded.success is True

    def test_clear_removes_persistence_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            path = os.path.join(tmpdir, "memory.json")
            mem = Memory(persistence_path=path)
            mem.record(make_experience())
            assert os.path.exists(path)
            mem.clear()
            assert not os.path.exists(path)


class TestLearningModule:
    def test_learn_from_feedback_success(self):
        mem = Memory()
        lm = LearningModule(mem)
        exp = make_experience(feedback="Great work!")
        lesson = lm.learn_from_feedback(exp)
        assert isinstance(lesson, Lesson)
        assert lesson.confidence == 1.0
        assert "Great work!" in lesson.summary
        assert len(lm.lessons) == 1
        assert len(mem) == 1

    def test_learn_from_feedback_failure(self):
        mem = Memory()
        lm = LearningModule(mem)
        exp = make_experience(success=False, feedback="This failed.")
        lesson = lm.learn_from_feedback(exp)
        assert lesson.confidence == 0.5

    def test_self_learn_high_success(self):
        mem = Memory()
        lm = LearningModule(mem)
        for _ in range(9):
            mem.record(make_experience(task_name="count", success=True))
        mem.record(make_experience(task_name="count", success=False))

        new_lessons = lm.self_learn()
        assert len(new_lessons) == 1
        lesson = new_lessons[0]
        assert "high success rate" in lesson.summary
        assert lesson.source_count == 10

    def test_self_learn_low_success(self):
        mem = Memory()
        lm = LearningModule(mem)
        for _ in range(8):
            mem.record(make_experience(task_name="bad_task", success=False))
        mem.record(make_experience(task_name="bad_task", success=True))
        mem.record(make_experience(task_name="bad_task", success=True))

        new_lessons = lm.self_learn()
        assert len(new_lessons) == 1
        assert "fails frequently" in new_lessons[0].summary

    def test_self_learn_no_duplicates(self):
        mem = Memory()
        lm = LearningModule(mem)
        for _ in range(5):
            mem.record(make_experience(task_name="repeat", success=True))

        first = lm.self_learn()
        assert len(first) == 1

        # Running again should not produce duplicate lessons
        second = lm.self_learn()
        assert len(second) == 0
        assert len(lm.lessons) == 1

    def test_self_learn_multiple_tasks(self):
        mem = Memory()
        lm = LearningModule(mem)
        for _ in range(5):
            mem.record(make_experience(task_name="alpha", success=True))
        for _ in range(5):
            mem.record(make_experience(task_name="beta", success=False))

        new_lessons = lm.self_learn()
        task_names = {lesson.metadata.get("task_name") for lesson in new_lessons}
        assert "alpha" in task_names
        assert "beta" in task_names

    def test_clear_lessons(self):
        mem = Memory()
        lm = LearningModule(mem)
        lm.learn_from_feedback(make_experience())
        lm.clear_lessons()
        assert lm.lessons == []

    def test_lesson_str(self):
        lesson = Lesson(summary="All good", confidence=0.9, source_count=5)
        s = str(lesson)
        assert "90%" in s
        assert "All good" in s
