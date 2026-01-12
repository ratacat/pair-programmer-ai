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

- `/pair` or `/pair start` - Start with default backend (opus)
- `/pair opus` - Start with Claude Opus as pair (Task tool)
- `/pair codex` - Start with Codex as pair (background CLI)
- `/pair stop` - End the current session
- `/pair status` - Check if pairing is active

## Starting a Session

When the user invokes `/pair`:

### Step 1: Generate Session ID

```bash
SESSION_ID=$(openssl rand -hex 4)
echo "Session ID: $SESSION_ID"
```

### Step 2: Start the Bridge Server

```bash
SESSION_ID="$SESSION_ID" pair-bridge start
```

Verify it started:
```bash
SESSION_ID="$SESSION_ID" pair-bridge status
```

### Step 3: Spawn the Pair Agent

**Determine the backend** from the command (default is `opus`):
- `/pair` or `/pair opus` → Use Task tool
- `/pair codex` → Use Bash background process

#### For Opus (default): Use Task Tool

Spawn the pair agent using the Task tool with these parameters:
- `subagent_type`: "general-purpose"
- `model`: "opus"
- `run_in_background`: true
- `prompt`: The pair programmer prompt below

**Pair Programmer Prompt for Task Tool:**
```
You are a pair programmer watching another Claude agent work. Your job is to catch bugs, security issues, and missed edge cases.

## Connection
Session ID: {SESSION_ID}
Socket: /tmp/claude-pair-{SESSION_ID}.sock

## Your Loop

Run this continuously:

1. Wait for activity:
   ```bash
   SESSION_ID="{SESSION_ID}" pair-bridge wait $LAST_SEEN
   ```
   This blocks until the main agent does something. Start with LAST_SEEN=0.

2. Parse the JSON response - it contains tool calls with:
   - tool: Which tool was used (Edit, Bash, Read, etc.)
   - input: The tool's parameters
   - output_summary: First 2KB of output
   - sequence: Incrementing ID (use as next LAST_SEEN)

3. Analyze for issues:
   - Bugs or logic errors
   - Security vulnerabilities
   - Missed edge cases
   - Breaking API changes
   - Missing test updates

4. If you spot an issue, emit feedback:
   ```bash
   SESSION_ID="{SESSION_ID}" pair-bridge emit feedback '{"severity":"high","message":"Description","context":{"file":"path.ts","line":42}}'
   ```

5. Update LAST_SEEN and loop back to step 1.

## Severity Levels
- high: Stop and fix now (security, data loss, breaking changes)
- medium: Fix soon (missing error handling, test gaps)
- low: Consider later (minor style issues)

## Guidelines
- Stay quiet on routine operations
- Quality over quantity - one good catch beats ten nitpicks
- Ask questions if intent is unclear
- Focus on what the main agent might miss

Begin watching now.
```

#### For Codex: Use Bash Background Process

Spawn Codex as a background process:

```bash
codex --quiet "You are a pair programmer. Session: {SESSION_ID}. Run: while true; do ACTIVITY=\$(SESSION_ID={SESSION_ID} pair-bridge wait \$LAST_SEEN); # analyze and emit feedback; done" &
CODEX_PID=$!
echo "Codex pair agent started with PID: $CODEX_PID"
```

Store the PID for later cleanup.

### Step 4: Confirm to User

Tell the user:
- Session ID
- Which backend is running
- That their pair will provide feedback as they work

## Stopping a Session

When the user says `/pair stop`:

1. Stop the bridge server:
   ```bash
   SESSION_ID="$SESSION_ID" pair-bridge stop
   ```

2. If using Codex, kill the background process:
   ```bash
   kill $CODEX_PID 2>/dev/null
   ```

3. Summarize the session (activity count, feedback given)

## Checking Status

When the user says `/pair status`:

```bash
SESSION_ID="$SESSION_ID" pair-bridge status
```

Report:
- Whether pairing is active
- Session uptime
- Activity count
- Pending feedback count

## How Feedback Appears

The hooks handle feedback injection automatically:
- `pair-emit-activity.sh` (PostToolUse): Sends your tool calls to the bridge
- `pair-check-feedback.sh` (PreToolUse): Shows pair feedback before your next action

When the pair spots an issue, you'll see:
```
<pair-feedback>
PAIR PROGRAMMER FEEDBACK:
This SQL query concatenates user input - use parameterized queries
Location: src/db/queries.ts:45
SEVERITY: HIGH - Address before continuing
</pair-feedback>
```

## Example Session

```
User: /pair

Agent: Starting pair programming session...
  Session ID: a1b2c3d4
  Bridge: /tmp/claude-pair-a1b2c3d4.sock
  Backend: opus (Task tool)

[Spawns background Task with pair programmer prompt]

Pair programming active! I'll work on your task while my pair watches for issues.

User: Refactor the auth module to use JWT

Agent: [Reads files, makes edits...]

<pair-feedback>
PAIR PROGRAMMER FEEDBACK:
You removed the rate limiting check - this protected against brute force attacks.
Location: src/auth/login.ts:45
SEVERITY: HIGH - Address before continuing
</pair-feedback>

Agent: Good catch from my pair! Let me restore that rate limiting...

User: /pair stop

Agent: Ending pair programming session...
  Duration: 12 minutes
  Tool calls observed: 34
  Feedback provided: 2 (1 high, 1 medium)

Session ended.
```
