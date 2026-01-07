#!/bin/bash
# ABOUTME: PreToolUse hook that checks for and displays pair feedback
# ABOUTME: Outputs feedback to stdout which gets injected into agent context

SESSION_ID="${CLAUDE_SESSION_ID:-default}"
SOCKET="/tmp/claude-pair-${SESSION_ID}.sock"

# No-op if bridge not running
[[ ! -S "$SOCKET" ]] && exit 0

# Require jq for JSON parsing
if ! command -v jq &>/dev/null; then
  exit 0
fi

# Poll for pending feedback (non-blocking)
FEEDBACK=$(SESSION_ID="$SESSION_ID" pair-bridge poll 2>/dev/null || echo "")

# Display feedback if present
if [[ -n "$FEEDBACK" && "$FEEDBACK" != "null" ]]; then
  MESSAGE=$(echo "$FEEDBACK" | jq -r '.message // "No message"')
  SEVERITY=$(echo "$FEEDBACK" | jq -r '.severity // "medium"')
  CONTEXT_FILE=$(echo "$FEEDBACK" | jq -r '.context.file // empty')
  CONTEXT_LINE=$(echo "$FEEDBACK" | jq -r '.context.line // empty')

  echo ""
  echo "<pair-feedback>"
  echo "PAIR PROGRAMMER FEEDBACK:"
  echo "$MESSAGE"

  # Show context if available
  if [[ -n "$CONTEXT_FILE" ]]; then
    if [[ -n "$CONTEXT_LINE" ]]; then
      echo "Location: $CONTEXT_FILE:$CONTEXT_LINE"
    else
      echo "File: $CONTEXT_FILE"
    fi
  fi

  # Highlight severity
  case "$SEVERITY" in
    high)
      echo "SEVERITY: HIGH - Address before continuing"
      ;;
    medium)
      echo "SEVERITY: MEDIUM - Should be addressed"
      ;;
    low)
      echo "SEVERITY: LOW - Consider for later"
      ;;
  esac
  echo "</pair-feedback>"
  echo ""
fi
