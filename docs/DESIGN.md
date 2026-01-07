# Claude Pair Programming System

## Overview

A system that enables two Claude Code agents to work together: a main agent doing active development and a pair agent watching over its shoulder, catching issues, and providing feedback in near real-time.

## Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Main Agent    │         │  Bridge Server  │         │   Pair Agent    │
│                 │         │                 │         │                 │
│  Does the work  │────────▶│  Unix Socket    │────────▶│  Watches work   │
│                 │         │  Message Queue  │         │  Gives feedback │
│  PostToolUse    │         │                 │         │                 │
│  hook emits     │         │  Holds state:   │◀────────│  Emits feedback │
│  activity       │◀────────│  - activity log │         │  when it spots  │
│                 │         │  - feedback Q   │         │  issues         │
│  PreToolUse     │         │  - session info │         │                 │
│  hook receives  │         │                 │         │  Blocks waiting │
│  feedback       │         │                 │         │  for activity   │
└─────────────────┘         └─────────────────┘         └─────────────────┘
```

## Components

### 1. Bridge Server (pair-bridge)

A lightweight Node.js server that:
- Listens on a Unix socket (`/tmp/claude-pair-<session>.sock`)
- Receives activity events from main agent's hooks
- Queues feedback from pair agent for main agent
- Supports blocking reads (pair agent waits for next activity)
- Maintains session state and activity history

**CLI Interface:**
```bash
pair-bridge start [--session <id>]     # Start bridge server (backgrounds itself)
pair-bridge stop                        # Stop bridge server
pair-bridge status                      # Is bridge running?

pair-bridge emit <type> <json>          # Send activity/feedback to bridge
pair-bridge wait                         # Block until activity available (for pair)
pair-bridge poll                         # Non-blocking check for feedback (for main)
pair-bridge history [--last <n>]        # View recent activity
```

### 2. Hook Scripts

#### pair-emit-activity.sh (PostToolUse)

Runs after every tool use by main agent. Emits activity to bridge.

```bash
#!/bin/bash
# Runs on: PostToolUse
# Only active when bridge is running

SOCKET="/tmp/claude-pair-${CLAUDE_SESSION_ID:-default}.sock"

# No-op if bridge not running
[[ ! -S "$SOCKET" ]] && exit 0

# Build activity payload from hook environment
# CLAUDE_TOOL_NAME, CLAUDE_TOOL_INPUT, CLAUDE_TOOL_OUTPUT available
pair-bridge emit activity "{
  \"tool\": \"$CLAUDE_TOOL_NAME\",
  \"input\": $(echo "$CLAUDE_TOOL_INPUT" | jq -c '.' 2>/dev/null || echo '{}'),
  \"output_summary\": $(echo "$CLAUDE_TOOL_OUTPUT" | head -c 2000 | jq -Rs '.'),
  \"timestamp\": \"$(date -Iseconds)\"
}"
```

#### pair-check-feedback.sh (PreToolUse)

Runs before tool use. Injects any pending feedback from pair agent.

```bash
#!/bin/bash
# Runs on: PreToolUse
# Outputs to stdout = injected into context

SOCKET="/tmp/claude-pair-${CLAUDE_SESSION_ID:-default}.sock"

[[ ! -S "$SOCKET" ]] && exit 0

FEEDBACK=$(pair-bridge poll 2>/dev/null)

if [[ -n "$FEEDBACK" && "$FEEDBACK" != "null" ]]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📢 PAIR PROGRAMMER FEEDBACK:"
  echo "$FEEDBACK" | jq -r '.message'
  if [[ $(echo "$FEEDBACK" | jq -r '.severity') == "high" ]]; then
    echo "⚠️  HIGH PRIORITY - Address before continuing"
  fi
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi
```

### 3. The Skill (/pair)

Lives in skills directory. Handles setup, teardown, and launching.

#### skill.md

```markdown
---
name: pair
description: Launch a pair programming agent to watch your work and catch issues
triggers:
  - /pair
  - pair program with me
  - start pair programming
  - launch pair programmer
---

# Pair Programming Skill

When invoked, this skill launches a pair programming session where a second
agent watches your work and provides feedback.

## Commands

- `/pair` or `/pair start` - Start pair programming session
- `/pair stop` - End the session
- `/pair status` - Check if pairing is active

## On Start

1. Generate session ID
2. Start bridge server: `pair-bridge start --session <id>`
3. Launch pair agent via Task tool with the pair-programmer subagent type
4. Confirm to user that pairing is active

## On Stop

1. Signal pair agent to wrap up
2. Stop bridge server: `pair-bridge stop`
3. Confirm to user

## Pair Agent Instructions

The pair agent receives this system prompt (see pair-agent-prompt.md)
```

#### pair-agent-prompt.md

```markdown
# You are a Pair Programmer

You are watching another Claude agent (the "main agent") write code. Your job
is to be a second set of eyes - catching issues, suggesting improvements, and
asking clarifying questions.

## Your Role

- **Watch, don't drive**: The main agent is doing the implementation. You observe.
- **Speak up when it matters**: Don't comment on everything. Focus on:
  - Bugs or logic errors
  - Security issues
  - Missed edge cases
  - Violations of project conventions
  - Opportunities they might be missing
  - Questions about unclear intent
- **Be concise**: Your feedback gets injected into the main agent's context.
  Keep it short and actionable.
- **Prioritize**: Mark feedback as high/medium/low severity

## How It Works

1. You'll receive a stream of the main agent's activity (tool calls and results)
2. Use `pair-bridge wait` to block until the next activity
3. When you see something worth commenting on, use `pair-bridge emit feedback`
4. The main agent will see your feedback before their next action

## Workflow Loop

```
while session_active:
    activity = pair-bridge wait      # Blocks until main does something

    # Analyze the activity
    if worth_commenting(activity):
        pair-bridge emit feedback {
            "severity": "high|medium|low",
            "message": "Your concise feedback here",
            "context": { "file": "...", "line": ... }  # optional
        }

    # Otherwise, stay quiet and wait for next activity
```

## What You See

Each activity includes:
- `tool`: Which tool was called (Edit, Bash, Read, etc.)
- `input`: The tool's input parameters
- `output_summary`: Truncated output (first 2KB)
- `timestamp`: When it happened

## Feedback Guidelines

**DO comment on:**
- "You're editing auth.ts but didn't update the corresponding test"
- "This SQL query is vulnerable to injection - use parameterized query"
- "The error handling here swallows the stack trace"
- "This changes the API contract - consumers will break"

**DON'T comment on:**
- Style preferences (unless they violate project rules)
- Minor things the main agent will obviously catch
- Things you're not sure about (ask as a question instead)

## Severity Levels

- **high**: Stop and address this before continuing (bugs, security, breaking changes)
- **medium**: Should be addressed but can finish current task first
- **low**: Nice to know, consider for later

## Session End

When the main agent signals session end, or you receive a stop signal,
summarize what you observed and any outstanding concerns, then exit.
```

### 4. Message Protocol

#### Activity Event (Main → Bridge → Pair)

```typescript
interface ActivityEvent {
  type: 'activity';
  timestamp: string;
  tool: string;
  input: Record<string, unknown>;
  output_summary: string;
  // Derived/added by bridge:
  sequence: number;
  session_id: string;
}
```

#### Feedback Event (Pair → Bridge → Main)

```typescript
interface FeedbackEvent {
  type: 'feedback';
  timestamp: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  context?: {
    file?: string;
    line?: number;
    tool?: string;  // Which tool call this relates to
    sequence?: number;  // Which activity this responds to
  };
}
```

#### Control Events

```typescript
interface ControlEvent {
  type: 'start' | 'stop' | 'ping' | 'pong';
  timestamp: string;
  session_id: string;
}
```

## Directory Structure

```
claude-pair/
├── package.json
├── README.md
├── tsconfig.json
│
├── src/
│   ├── server.ts           # Bridge server
│   ├── cli.ts              # CLI tool
│   └── types.ts            # Shared types
│
├── hooks/
│   ├── pair-emit-activity.sh
│   └── pair-check-feedback.sh
│
├── skill/
│   ├── skill.md            # Skill definition
│   ├── pair-agent-prompt.md
│   └── install.sh          # Installs hooks to ~/.claude/hooks/
│
└── bin/
    └── pair-bridge         # Compiled CLI entry point
```

## Installation Flow

```bash
# Install globally
npm install -g claude-pair

# Run installer (sets up hooks)
claude-pair install

# This does:
# 1. Copies hooks to ~/.claude/hooks/
# 2. Adds hook config to ~/.claude/settings.json
# 3. Verifies pair-bridge is in PATH
```

## Configuration Options

In `~/.claude/settings.json`:

```json
{
  "pair": {
    "auto_suggest": true,        // Suggest pairing for complex tasks
    "auto_suggest_threshold": 5, // Suggest after N file edits planned
    "feedback_verbosity": "normal", // "quiet" | "normal" | "verbose"
    "pair_model": "sonnet"       // Model for pair agent (cost savings)
  }
}
```

## Usage Examples

### Starting a Pair Session

User: "Let's pair program on this refactor"

Main agent:
```
Starting pair programming session...

1. Starting bridge server
   $ pair-bridge start --session abc123
   ✓ Bridge listening on /tmp/claude-pair-abc123.sock

2. Launching pair programmer agent
   [Spawns Task with pair-agent-prompt]

Pair programming active. I'll proceed with the refactor and my pair
will watch for issues.
```

### During the Session

Main agent edits a file. PostToolUse hook fires:
```bash
pair-bridge emit activity '{"tool":"Edit","input":{"file":"auth.ts",...},...}'
```

Pair agent receives activity, notices an issue:
```bash
pair-bridge emit feedback '{
  "severity": "high",
  "message": "This removes the rate limiting check - was that intentional? The original prevented brute force attacks.",
  "context": {"file": "auth.ts", "line": 45}
}'
```

Main agent's next PreToolUse hook shows:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📢 PAIR PROGRAMMER FEEDBACK:
This removes the rate limiting check - was that intentional?
The original prevented brute force attacks.
⚠️  HIGH PRIORITY - Address before continuing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Ending the Session

User: "/pair stop"

```
Ending pair programming session...

$ pair-bridge stop
✓ Bridge stopped

Pair programmer summary:
- Watched 23 tool calls over 15 minutes
- Provided 3 pieces of feedback (1 high, 2 medium)
- All high-priority items addressed

Session ended.
```

## Future Enhancements

1. **Multiple pair agents**: Different specialists (security, testing, perf)
2. **Recorded sessions**: Save activity log for later review
3. **Learning**: Pair agent learns project conventions over time
4. **Async mode**: Pair agent runs fully async, batches feedback
5. **Voice mode**: Pair speaks feedback aloud (TTS integration)
6. **Metrics**: Track how often pair catches real issues
