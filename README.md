# AILoom

A solution to managing, orchestrating and deploying AI agents – while keeping businesses and users in control.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  AILoom Engine  (Go binary – compiled, tamper-resistant)  │
│                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   License   │  │  Workflow   │  │   HTTP API      │  │
│  │  Validator  │  │   Runner    │  │  /api/...       │  │
│  │ (Ed25519)   │  │(goroutines) │  │  (all routes)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────┬────────────────────────────┘
                               │ REST / HTTP
┌─────────────────────────────▼────────────────────────────┐
│  React UI  (dark glass-theme, TypeScript + Tailwind)      │
│  Dashboard · Projects · Agents · Platforms · License      │
└──────────────────────────────────────────────────────────┘
                               │ extensibility
┌─────────────────────────────▼────────────────────────────┐
│  Python ailoom package  (agent SDK for developers)        │
│  BaseAgent · AgentManager · AgentRegistry · Learning      │
└──────────────────────────────────────────────────────────┘
```

## Quick start

### 1 – Build the Go engine

```bash
cd engine
go build -ldflags="-s -w" -o ailoom-engine ./cmd/engine
```

### 2 – Start the engine (with demo Professional license)

```bash
./ailoom-engine --license LICENSE_DEMO.lic --port 8000
```

Without a license file the engine starts in **Community** mode (capped at 3 projects, 1-agent workflows).

### 3 – Start the UI

```bash
cd ../ui
npm install
npm run dev          # dev server with proxy to :8000
# or
npm run build && npm run preview
```

Open **http://localhost:5173**

---

## Licensing system

AILoom uses **Ed25519-signed cryptographic license files** to protect paid features.

### License tiers

| Tier | Features | Limits |
|---|---|---|
| **Community** | None (free) | 3 projects, 1 agent/workflow, 1 platform |
| **Professional** | Multi-agent workflows, Analytics, Advanced workflow | Unlimited |
| **Enterprise** | All Professional + Audit log, Custom plugins, Priority execution | Unlimited |

### License file format

License files use a PEM-like wrapper around a base64-encoded JSON payload:

```
-----BEGIN AILOOM LICENSE-----
<base64({"payload":{...},"signature":"<Ed25519 sig>"}))>
-----END AILOOM LICENSE-----
```

The **Ed25519 signature** covers the canonical JSON encoding of the payload.  
The matching **public key is compiled into the engine binary** – only the vendor's
private key (never committed to VCS) can produce valid signatures.

### Generating key pairs & issuing licenses (vendor)

```bash
# Build the licensegen tool
cd engine && go build -o ailoom-licensegen ./cmd/licensegen

# 1. Generate a key pair (do this ONCE – store vendor.key securely)
./ailoom-licensegen keygen --pub public.key --priv vendor.key
# → embed the public key from public.key into internal/license/license.go

# 2. Issue a Professional license
./ailoom-licensegen create \
  --priv vendor.key \
  --licensee "Acme Corp" \
  --email admin@acme.com \
  --tier professional \
  --expires 2027-12-31 \
  --out acme.ailoom.lic

# 3. Verify a license
./ailoom-licensegen verify --file acme.ailoom.lic
```

### Feature gates in the engine

```go
// Example: block a multi-agent workflow for Community tier
if agentSteps > 1 && !lic.HasFeature(license.FeatureMultiAgent) {
    return fmt.Errorf("upgrade to Professional to use multi-agent workflows")
}
```

---

## Python agent SDK (extensibility layer)

Developers write custom agents in Python by subclassing `BaseAgent`:

```python
from ailoom import AgentManager, BaseAgent, TaskInfo

class MyAgent(BaseAgent):
    def execute(self, task: TaskInfo) -> str:
        self.report_progress(50, 1, 2, "Halfway…")
        return f"Done: {task.name}"

manager = AgentManager()
manager.register(MyAgent(name="my-agent", description="Custom agent"))
future = manager.assign_task("my-agent", "my_task", "Do the thing")
print(future.result())
```

### Python development

```bash
pip install -e ".[dev]"
pytest              # 96 tests
ruff check ailoom/ tests/
```

---

## Project structure

```
ailoom/           Python agent SDK (BaseAgent, Manager, Registry, Learning)
engine/           Go engine binary (license validation, workflow execution, HTTP API)
  cmd/engine/     Main server binary
  cmd/licensegen/ Vendor license-signing tool
  internal/
    license/      Ed25519 cryptographic license system
    store/        Thread-safe in-memory data store
    runner/       Goroutine-based workflow executor
    server/       HTTP API handlers
ui/               React + TypeScript + Tailwind glassmorphism frontend
tests/            Python test suite (96 tests)
```
