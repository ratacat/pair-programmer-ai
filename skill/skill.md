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

Launch a pair programming session where a second AI agent watches your work and provides real-time feedback on bugs, security issues, and missed edge cases.

## Commands

- `/pair` or `/pair start` - Start a pair programming session
- `/pair stop` - End the current session
- `/pair status` - Check if pairing is active
- `/pair --backend <name>` - Start with specific backend (claude-opus or codex)

## How It Works

1. **Bridge Server**: A Unix socket server routes messages between you (main agent) and the pair agent
2. **Activity Streaming**: Your tool calls are streamed to the pair agent in real-time
3. **Feedback Injection**: Pair agent feedback appears before your next action

## Starting a Session

When the user invokes `/pair` or asks to pair program:

1. Generate a unique session ID
2. Start the bridge server:
   ```bash
   pair-bridge start
   ```
3. Spawn the pair agent using the Task tool with `run_in_background: true`
4. Confirm to user that pairing is active

Example spawn prompt for the pair agent:
```
You are a pair programmer watching another agent work. Connect to the bridge
at /tmp/claude-pair-{session_id}.sock and run the watch loop:

1. Use `pair-bridge wait` to block until activity
2. Analyze each tool call for issues
3. Use `pair-bridge emit feedback '{"severity":"high|medium|low","message":"..."}' when you spot problems
4. Stay quiet on routine operations

Focus on: bugs, security issues, missed edge cases, API contract changes.
```

## Stopping a Session

When the user says `/pair stop` or ends pairing:

1. Stop the bridge server:
   ```bash
   pair-bridge stop
   ```
2. The pair agent will receive a stop signal and exit
3. Summarize what the pair observed (activity count, feedback given)

## Backend Selection

The pair agent can be:
- **claude-opus** (default): Spawns Opus via Task tool
- **codex**: Spawns OpenAI Codex via CLI

Set default in config or override with `--backend`:
```
/pair --backend codex
```

## Implementation Notes

- Hooks (`pair-emit-activity.sh`, `pair-check-feedback.sh`) handle the main agent side
- The skill's job is session lifecycle, not message passing
- Pair agent runs in background and may outlive individual tool calls
- Session state is in the bridge server, not the skill

## Example Session

```
User: /pair

Agent: Starting pair programming session...
  - Bridge started on /tmp/claude-pair-abc123.sock
  - Launching pair programmer (claude-opus)
  - Pair programming active!

Your pair will watch your work and provide feedback on issues.

User: Refactor the auth module

Agent: [Works on refactoring...]

<pair-feedback>
PAIR PROGRAMMER FEEDBACK:
You removed the rate limiting middleware - this was protecting against brute force attacks.
Location: src/auth/login.ts:45
SEVERITY: HIGH - Address before continuing
</pair-feedback>

Agent: Good catch! Let me restore that rate limiting...

User: /pair stop

Agent: Ending pair programming session...
  - Session lasted 12 minutes
  - 34 tool calls observed
  - 2 feedback items provided (1 high, 1 medium)
  - All high-priority items addressed
```