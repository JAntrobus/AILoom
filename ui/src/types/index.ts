export type ProviderType = 'openai' | 'anthropic' | 'azure' | 'google' | 'custom'
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused'
export type AgentStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed'
export type ProjectStatus = 'draft' | 'active' | 'archived'
export type SkillType = 'script' | 'prompt'
export type MemoryScope = 'run' | 'workflow' | 'agent'
export type InputType = 'text' | 'file' | 'api' | 'url' | 'webhook'

export interface Platform {
  id: string
  name: string
  provider: ProviderType
  api_key_hint: string
  base_url?: string
  models: string[]
  is_connected: boolean
  created_at: string
}

export interface PlatformCreate {
  name: string
  provider: ProviderType
  api_key: string
  base_url?: string
}

export interface Agent {
  id: string
  name: string
  description: string
  platform_id: string
  model: string
  status: AgentStatus
  task_count: number
  system_prompt: string
  steps: string[]
  skill_ids: string[]
  created_at: string
}

export interface AgentCreate {
  name: string
  description: string
  platform_id: string
  model: string
  system_prompt?: string
  steps?: string[]
  skill_ids?: string[]
}

export interface WorkflowNode {
  id: string
  type: 'start' | 'agent' | 'end'
  label: string
  agent_id?: string
  skill_ids?: string[]
  x: number
  y: number
}

export interface WorkflowEdge {
  id: string
  source: string
  target: string
  label?: string
}

export interface Workflow {
  id: string
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  skill_ids: string[]
  created_at: string
}

export interface WorkflowCreate {
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  skill_ids?: string[]
}

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  workflow_id?: string
  tags: string[]
  run_count: number
  last_run_at?: string
  input_type: InputType
  prompt: string
  input_config?: string
  created_at: string
}

export interface ProjectCreate {
  name: string
  description: string
  workflow_id?: string
  tags: string[]
  input_type?: InputType
  prompt?: string
  input_config?: string
}

export interface RunStep {
  id: string
  agent_id: string
  agent_name: string
  status: RunStatus
  progress: number
  started_at?: string
  completed_at?: string
  output: string
  logs: string[]
}

export interface Run {
  id: string
  project_id: string
  project_name: string
  status: RunStatus
  steps: RunStep[]
  started_at?: string
  completed_at?: string
  created_at: string
}

export interface Skill {
  id: string
  name: string
  description: string
  type: SkillType
  language: string
  content: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface SkillCreate {
  name: string
  description: string
  type: SkillType
  language?: string
  content: string
  tags?: string[]
}

export interface MemoryFile {
  id: string
  scope: MemoryScope
  scope_id: string
  title: string
  content: string
  written_by: string
  created_at: string
  updated_at: string
}

export interface MemoryCreate {
  scope: MemoryScope
  scope_id: string
  title: string
  content: string
  written_by?: string
}

export interface Stats {
  projects: number
  active_runs: number
  completed_runs: number
  total_runs: number
  agents: number
  platforms: number
  skills: number
}
