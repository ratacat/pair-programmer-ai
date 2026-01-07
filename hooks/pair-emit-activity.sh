#!/bin/bash
# ABOUTME: PostToolUse hook that emits activity to the pair-bridge
# ABOUTME: No-ops if bridge is not running

set -euo pipefail

SESSION_ID="${CLAUDE_SESSION_ID:-default}"
SOCKET="/tmp/claude-pair-${SESSION_ID}.sock"

# No-op if bridge not running
[[ ! -S "$SOCKET" ]] && exit 0

# Require jq for JSON handling
if ! command -v jq &>/dev/null; then
  exit 0
fi

# Build activity payload from hook environment
# CLAUDE_TOOL_NAME, CLAUDE_TOOL_INPUT, CLAUDE_TOOL_OUTPUT are provided by Claude Code
TOOL_NAME="${CLAUDE_TOOL_NAME:-unknown}"
TOOL_INPUT="${CLAUDE_TOOL_INPUT:-{}}"
TOOL_OUTPUT="${CLAUDE_TOOL_OUTPUT:-}"

# Safely encode input as JSON
INPUT_JSON=$(echo "$TOOL_INPUT" | jq -c '.' 2>/dev/null || echo '{}')

# Truncate and encode output (max 2KB to avoid huge payloads)
OUTPUT_JSON=$(echo "$TOOL_OUTPUT" | head -c 2000 | jq -Rs '.' 2>/dev/null || echo '""')

# Emit to bridge (suppress errors - don't break main agent workflow)
SESSION_ID="$SESSION_ID" pair-bridge emit activity "{
  \"tool\": \"$TOOL_NAME\",
  \"input\": $INPUT_JSON,
  \"output_summary\": $OUTPUT_JSON
}" 2>/dev/null || true
