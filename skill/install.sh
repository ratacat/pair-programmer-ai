#!/bin/bash
# ABOUTME: Manual installation script for standalone (non-plugin) installs
# ABOUTME: Not needed when installed via /plugin install

set -euo pipefail

# If installed as plugin, nothing to do
if [[ -n "${CLAUDE_PLUGIN_ROOT:-}" ]]; then
  echo "Installed as plugin - no additional setup needed."
  echo "Use '/pair' in Claude Code to start a pairing session."
  exit 0
fi

# Standalone manual install follows
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
HOOKS_DIR="${CLAUDE_HOOKS_DIR:-$HOME/.claude/hooks}"
BIN_DIR="${HOME}/.local/bin"

echo "Installing pair-bridge (standalone mode)..."

# Create directories
mkdir -p "$HOOKS_DIR"
mkdir -p "$BIN_DIR"

# Build if not already built
if [[ ! -f "$PROJECT_DIR/dist/cli.js" ]]; then
  echo "Building pair-bridge..."
  (cd "$PROJECT_DIR" && npm install && npm run build)
fi

# Copy hooks
echo "Installing hooks to $HOOKS_DIR..."
cp "$PROJECT_DIR/hooks/pair-emit-activity.sh" "$HOOKS_DIR/"
cp "$PROJECT_DIR/hooks/pair-check-feedback.sh" "$HOOKS_DIR/"
cp "$PROJECT_DIR/hooks/pair-user-prompt.sh" "$HOOKS_DIR/"
chmod +x "$HOOKS_DIR/pair-emit-activity.sh"
chmod +x "$HOOKS_DIR/pair-check-feedback.sh"
chmod +x "$HOOKS_DIR/pair-user-prompt.sh"

# Create symlink for CLI
echo "Installing CLI to $BIN_DIR..."
ln -sf "$PROJECT_DIR/bin/pair-bridge" "$BIN_DIR/pair-bridge"

# Check if BIN_DIR is in PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo ""
  echo "NOTE: $BIN_DIR is not in your PATH."
  echo "Add this to your shell profile (.bashrc, .zshrc, etc.):"
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
fi

# Verify jq is installed (required by hooks)
if ! command -v jq &>/dev/null; then
  echo ""
  echo "WARNING: jq is not installed. Hooks require jq for JSON processing."
  echo "Install with: brew install jq (macOS) or apt install jq (Linux)"
  echo ""
fi

echo ""
echo "pair-bridge installed successfully (standalone mode)!"
echo ""
echo "Hooks installed:"
echo "  $HOOKS_DIR/pair-emit-activity.sh (PostToolUse)"
echo "  $HOOKS_DIR/pair-check-feedback.sh (PreToolUse)"
echo "  $HOOKS_DIR/pair-user-prompt.sh (UserPromptSubmit)"
echo ""
echo "CLI installed:"
echo "  $BIN_DIR/pair-bridge"
echo ""
echo "To start using, configure Claude Code hooks in ~/.claude/settings.json:"
echo '  {'
echo '    "hooks": {'
echo '      "PostToolUse": ["pair-emit-activity.sh"],'
echo '      "PreToolUse": ["pair-check-feedback.sh"],'
echo '      "UserPromptSubmit": ["pair-user-prompt.sh"]'
echo '    }'
echo '  }'
echo ""
echo "Then use '/pair' in Claude Code to start a pairing session."
