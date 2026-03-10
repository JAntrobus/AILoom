// Package runner executes AILoom workflows asynchronously, enforcing license
// feature gates and reporting granular progress back to the store.
package runner

import (
	"fmt"
	"time"

	"github.com/JAntrobus/ailoom/engine/internal/license"
	"github.com/JAntrobus/ailoom/engine/internal/store"
)

// Runner executes workflow runs against the data store, honouring license limits.
type Runner struct {
	store *store.Store
	lic   *license.License
}

// New creates a Runner using the supplied store and license.
func New(s *store.Store, lic *license.License) *Runner {
	return &Runner{store: s, lic: lic}
}

// Start launches a run asynchronously.  It validates license constraints before
// spawning the goroutine, returning an error immediately if the run is blocked.
func (r *Runner) Start(run *store.Run) error {
	// Count agent steps in this run
	agentSteps := 0
	for _, step := range run.Steps {
		if step.AgentID != "" {
			agentSteps++
		}
	}

	// Feature gate: multi-agent workflows require the FeatureMultiAgent flag
	maxAgents := r.lic.MaxAgentsPerWorkflow()
	if maxAgents > 0 && agentSteps > maxAgents {
		return fmt.Errorf(
			"license gate: this workflow has %d agent steps but your %s license "+
				"allows a maximum of %d per workflow – upgrade to Professional or Enterprise",
			agentSteps, r.lic.Payload.Tier, maxAgents,
		)
	}
	if agentSteps > 1 && !r.lic.HasFeature(license.FeatureMultiAgent) {
		return fmt.Errorf(
			"license gate: multi-agent workflows require a Professional or Enterprise license "+
				"(current tier: %s)", r.lic.Payload.Tier,
		)
	}

	go r.execute(run)
	return nil
}

func (r *Runner) execute(run *store.Run) {
	now := time.Now().UTC()
	run.Status = store.StatusRunning
	run.StartedAt = &now
	r.store.SetRun(run)

	for i := range run.Steps {
		step := &run.Steps[i]

		// Mark step as running
		stepStart := time.Now().UTC()
		step.Status = store.StatusRunning
		step.StartedAt = &stepStart
		step.Logs = append(step.Logs, fmt.Sprintf("[%s] Starting…", step.AgentName))
		r.store.SetRun(run)

		// Identify which skills the agent uses (for log messages)
		var agentSkillNames []string
		if ag, ok := r.store.GetAgent(step.AgentID); ok {
			for _, sid := range ag.SkillIDs {
				if sk, ok := r.store.GetSkill(sid); ok {
					agentSkillNames = append(agentSkillNames, sk.Name)
				}
			}
		}
		if len(agentSkillNames) > 0 {
			for _, sn := range agentSkillNames {
				step.Logs = append(step.Logs, fmt.Sprintf("[%s] Invoking skill: %s", step.AgentName, sn))
				r.store.SetRun(run)
				time.Sleep(200 * time.Millisecond)
			}
		}

		// Simulate incremental progress
		for pct := 10.0; pct <= 90.0; pct += 20.0 {
			time.Sleep(400 * time.Millisecond)
			step.Progress = pct
			step.Logs = append(step.Logs, fmt.Sprintf("[%s] %.0f%% complete", step.AgentName, pct))
			r.store.SetRun(run)
		}

		// Write a run-scoped memory entry for this step
		memTitle := fmt.Sprintf("%s — step output", step.AgentName)
		memContent := fmt.Sprintf("## %s\n\n**Run:** `%s`\n\n### Output\n\n%s completed successfully.\n\n### Observations\n\n- Executed at %s\n- All skills completed without errors\n",
			memTitle, run.ID, step.AgentName, time.Now().UTC().Format(time.RFC3339))
		r.store.SetMemory(&store.MemoryFile{
			ID:        store.NewID(),
			Scope:     store.MemoryScopeRun,
			ScopeID:   run.ID,
			Title:     memTitle,
			Content:   memContent,
			WrittenBy: step.AgentName,
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		})
		step.Logs = append(step.Logs, fmt.Sprintf("[%s] Memory written for this step.", step.AgentName))

		// Complete the step
		time.Sleep(400 * time.Millisecond)
		stepEnd := time.Now().UTC()
		step.Status = store.StatusCompleted
		step.Progress = 100
		step.CompletedAt = &stepEnd
		step.Output = fmt.Sprintf("%s completed successfully.", step.AgentName)
		step.Logs = append(step.Logs, fmt.Sprintf("[%s] Done.", step.AgentName))

		// Bump the agent's task count
		if ag, ok := r.store.GetAgent(step.AgentID); ok {
			ag.TaskCount++
			r.store.SetAgent(ag)
		}

		r.store.SetRun(run)
	}

	// Mark the run complete
	end := time.Now().UTC()
	run.Status = store.StatusCompleted
	run.CompletedAt = &end
	r.store.SetRun(run)
}
