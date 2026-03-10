const BASE = ''  // uses Vite proxy /api → localhost:8000

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

void BASE

export const api = {
  // Platforms
  getPlatforms: () => request<import('../types').Platform[]>('/platforms'),
  getPlatform: (id: string) => request<import('../types').Platform>(`/platforms/${id}`),
  createPlatform: (body: import('../types').PlatformCreate) =>
    request<import('../types').Platform>('/platforms', { method: 'POST', body: JSON.stringify(body) }),
  deletePlatform: (id: string) =>
    request<void>(`/platforms/${id}`, { method: 'DELETE' }),
  getPlatformModels: (id: string) =>
    request<{ models: string[] }>(`/platforms/${id}/models`),

  // Agents
  getAgents: () => request<import('../types').Agent[]>('/agents'),
  getAgent: (id: string) => request<import('../types').Agent>(`/agents/${id}`),
  createAgent: (body: import('../types').AgentCreate) =>
    request<import('../types').Agent>('/agents', { method: 'POST', body: JSON.stringify(body) }),
  deleteAgent: (id: string) =>
    request<void>(`/agents/${id}`, { method: 'DELETE' }),
  getAgentMemory: (id: string) =>
    request<import('../types').MemoryFile[]>(`/agents/${id}/memory`),

  // Workflows
  getWorkflows: () => request<import('../types').Workflow[]>('/workflows'),
  getWorkflow: (id: string) => request<import('../types').Workflow>(`/workflows/${id}`),
  createWorkflow: (body: import('../types').WorkflowCreate) =>
    request<import('../types').Workflow>('/workflows', { method: 'POST', body: JSON.stringify(body) }),
  updateWorkflow: (id: string, body: import('../types').WorkflowCreate) =>
    request<import('../types').Workflow>(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  getWorkflowMemory: (id: string) =>
    request<import('../types').MemoryFile[]>(`/workflows/${id}/memory`),

  // Projects
  getProjects: () => request<import('../types').Project[]>('/projects'),
  getProject: (id: string) => request<import('../types').Project>(`/projects/${id}`),
  createProject: (body: import('../types').ProjectCreate) =>
    request<import('../types').Project>('/projects', { method: 'POST', body: JSON.stringify(body) }),
  updateProject: (id: string, body: import('../types').ProjectCreate) =>
    request<import('../types').Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProject: (id: string) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),

  // Runs
  getProjectRuns: (projectId: string) =>
    request<import('../types').Run[]>(`/projects/${projectId}/runs`),
  getAllRuns: () => request<import('../types').Run[]>('/runs'),
  getRun: (id: string) => request<import('../types').Run>(`/runs/${id}`),
  createRun: (projectId: string) =>
    request<import('../types').Run>(`/projects/${projectId}/runs`, { method: 'POST' }),
  deleteRun: (id: string) =>
    request<void>(`/runs/${id}`, { method: 'DELETE' }),
  getRunMemory: (id: string) =>
    request<import('../types').MemoryFile[]>(`/runs/${id}/memory`),

  // Skills
  getSkills: () => request<import('../types').Skill[]>('/skills'),
  getSkill: (id: string) => request<import('../types').Skill>(`/skills/${id}`),
  createSkill: (body: import('../types').SkillCreate) =>
    request<import('../types').Skill>('/skills', { method: 'POST', body: JSON.stringify(body) }),
  updateSkill: (id: string, body: import('../types').SkillCreate) =>
    request<import('../types').Skill>(`/skills/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteSkill: (id: string) =>
    request<void>(`/skills/${id}`, { method: 'DELETE' }),

  // Memory
  createMemory: (body: import('../types').MemoryCreate) =>
    request<import('../types').MemoryFile>('/memory', { method: 'POST', body: JSON.stringify(body) }),
  deleteMemory: (id: string) =>
    request<void>(`/memory/${id}`, { method: 'DELETE' }),

  // Stats
  getStats: () => request<import('../types').Stats>('/stats'),
}
