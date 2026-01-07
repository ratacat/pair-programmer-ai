#!/bin/bash
# ABOUTME: PreToolUse hook that checks for and displays pair feedback
# ABOUTME: Outputs feedback to stdout which gets injected into agent context

SOCKET="/tmp/claude-pair-${CLAUDE_SESSION_ID:-default}.sock"

[[ ! -S "$SOCKET" ]] && exit 0

FEEDBACK=$(pair-bridge poll 2>/dev/null)

if [[ -n "$FEEDBACK" && "$FEEDBACK" != "null" ]]; then
  echo "---"
  echo "PAIR PROGRAMMER FEEDBACK:"
  echo "$FEEDBACK" | jq -r '.message'
  SEVERITY=$(echo "$FEEDBACK" | jq -r '.severity')
  if [[ "$SEVERITY" == "high" ]]; then
    echo "HIGH PRIORITY - Address before continuing"
  fi
  echo "---"
fi
