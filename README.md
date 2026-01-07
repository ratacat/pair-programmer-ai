# pair-bridge

A system for AI pair programming: two AI agents work together, one coding while the other watches and provides real-time feedback on bugs, security issues, and missed edge cases.

## How It Works

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Main Agent    │         │  Bridge Server  │         │   Pair Agent    │
│   (Claude)      │────────▶│  Unix Socket    │────────▶│  (Opus/Codex)   │
│                 │         │                 │         │                 │
│  Does the work  │         │  Routes msgs    │         │  Watches work   │
│  Hooks emit     │◀────────│  Queues feedback│◀────────│  Gives feedback │
│  activity       │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

- **Main Agent**: The Claude Code instance you're working with
- **Bridge Server**: Unix socket server that routes messages
- **Pair Agent**: Another AI (Opus or Codex) watching and providing feedback

## Installation

```bash
# Clone and install
git clone https://github.com/ratacat/pair-programmer-ai.git
cd pair-programmer-ai
npm install
npm run build

# Install hooks and CLI
./skill/install.sh
```

### Requirements

- Node.js 18+
- `jq` (for JSON processing in hooks)
- `claude` CLI (for Claude Opus pair agent)
- `codex` CLI (optional, for Codex pair agent)

## Usage

### Quick Start

```bash
# Start the bridge
pair-bridge start

# In another terminal, start a pair agent manually
claude "You are a pair programmer. Run: pair-bridge wait 0, analyze activity, emit feedback if needed."

# Your main Claude Code session will now receive feedback
```

### Within Claude Code

Use the `/pair` skill:

```
User: /pair
Agent: Starting pair programming session...
       Bridge started, pair agent launched.
       I'll work on your task while my pair watches for issues.

User: /pair stop
Agent: Ending session. 34 tool calls observed, 2 feedback items.
```

### CLI Commands

```bash
pair-bridge start              # Start bridge server
pair-bridge stop               # Stop bridge server
pair-bridge status             # Show session status

pair-bridge emit activity '{...}'   # Emit tool activity (used by hooks)
pair-bridge emit feedback '{...}'   # Emit pair feedback

pair-bridge wait [lastSeen]    # Block until activity (for pair agent)
pair-bridge poll               # Check for pending feedback (non-blocking)
pair-bridge history [n]        # Show last n activities
```

### Feedback Format

```json
{
  "severity": "high",
  "message": "This SQL query concatenates user input - use parameterized queries",
  "context": {
    "file": "src/db/queries.ts",
    "line": 45
  }
}
```

Severity levels:
- **high**: Stop and fix before continuing
- **medium**: Address soon but can finish current task
- **low**: Consider for later

## Configuration

### Hooks

The hooks connect your Claude Code session to the bridge:

- `pair-emit-activity.sh` (PostToolUse): Sends tool calls to bridge
- `pair-check-feedback.sh` (PreToolUse): Displays pair feedback

Install to `~/.claude/hooks/` and configure in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": ["pair-emit-activity.sh"],
    "PreToolUse": ["pair-check-feedback.sh"]
  }
}
```

### Pair Agent Backend

Choose your pair agent:

- **claude-opus** (default): Uses Claude Opus via `claude` CLI
- **codex**: Uses OpenAI Codex via `codex` CLI

```bash
# Via environment variable
PAIR_BACKEND=codex pair-bridge start

# Or in the skill
/pair --backend codex
```

## Architecture

### Components

| File | Purpose |
|------|---------|
| `src/server.ts` | Bridge server with Unix socket |
| `src/cli.ts` | CLI tool for bridge interaction |
| `src/session.ts` | Session lifecycle management |
| `src/adapters/` | Pair agent adapters (Opus, Codex) |
| `hooks/` | Claude Code hook scripts |
| `skill/` | `/pair` skill definition |

### Message Flow

1. Main agent uses a tool (Edit, Bash, etc.)
2. PostToolUse hook emits activity to bridge
3. Pair agent receives activity via `pair-bridge wait`
4. Pair agent analyzes and optionally emits feedback
5. Main agent's PreToolUse hook displays feedback
6. Main agent sees feedback before next action

## Development

```bash
npm install          # Install dependencies
npm run build        # Build TypeScript
npm run dev          # Watch mode
npm test             # Run tests
```

### Testing the Bridge

```bash
# Terminal 1: Start bridge
node dist/cli.js start

# Terminal 2: Simulate pair agent
node dist/cli.js wait 0  # Blocks until activity

# Terminal 3: Emit activity
node dist/cli.js emit activity '{"tool":"Edit","input":{"file":"test.ts"}}'

# Terminal 2 will receive the activity
# Then emit feedback:
node dist/cli.js emit feedback '{"severity":"high","message":"Test feedback"}'

# Terminal 3: Check for feedback
node dist/cli.js poll
```

## License

MIT
