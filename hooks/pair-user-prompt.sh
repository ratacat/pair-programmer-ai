#!/bin/bash
# ABOUTME: UserPromptSubmit hook that sends user prompts to the pair-bridge
# ABOUTME: Gives the pair agent context about what the user asked for

PAIR_BRIDGE="${CLAUDE_PLUGIN_ROOT:-$(dirname "$(dirname "$0")")}/bin/pair-bridge"
SESSION_ID="${CLAUDE_SESSION_ID:-default}"
SOCKET="/tmp/claude-pair-${SESSION_ID}.sock"

# No-op if bridge not running
[[ ! -S "$SOCKET" ]] && exit 0

# Require jq for JSON handling
if ! command -v jq &>/dev/null; then
  exit 0
fi

# Read the hook input from stdin
INPUT=$(cat)

# Extract the user prompt from the input
# The UserPromptSubmit hook receives: { "prompt": "user's message", ... }
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')

# Exit if no prompt
[[ -z "$PROMPT" ]] && exit 0

# Safely encode prompt as JSON string
PROMPT_JSON=$(echo "$PROMPT" | jq -Rs '.')

# Emit to bridge as a 'prompt' event type
# This lets the pair agent know what the user asked for
SESSION_ID="$SESSION_ID" "$PAIR_BRIDGE" emit prompt "{
  \"content\": $PROMPT_JSON
}" 2>/dev/null || true
