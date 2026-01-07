#!/bin/bash
# ABOUTME: PostToolUse hook that emits activity to the pair-bridge
# ABOUTME: No-ops if bridge is not running

SOCKET="/tmp/claude-pair-${CLAUDE_SESSION_ID:-default}.sock"

# No-op if bridge not running
[[ ! -S "$SOCKET" ]] && exit 0

# Build activity payload from hook environment
pair-bridge emit activity "{
  \"tool\": \"$CLAUDE_TOOL_NAME\",
  \"input\": $(echo "$CLAUDE_TOOL_INPUT" | jq -c '.' 2>/dev/null || echo '{}'),
  \"output_summary\": $(echo "$CLAUDE_TOOL_OUTPUT" | head -c 2000 | jq -Rs '.'),
  \"timestamp\": \"$(date -Iseconds)\"
}"
