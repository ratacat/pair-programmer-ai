# Pair Bridge

A system enabling two AI agents to pair program together. One agent does the work, the other watches and provides real-time feedback.

## Architecture

- **Bridge Server**: Unix socket server that routes messages between agents
- **Hooks**: Claude Code hooks that emit activity and inject feedback
- **Skill**: Claude skill that manages session lifecycle

See `docs/DESIGN.md` for full architecture documentation.

## Development

```bash
npm install
npm run build
npm run install-hooks  # Copies hooks to ~/.claude/hooks/
```

## Project Goals

1. Enable real-time pair programming between AI agents
2. Support multiple AI backends (Claude, Codex, Gemini, etc.)
3. Keep the bridge protocol simple and extensible

## Key Files

- `src/types.ts` - Protocol type definitions
- `src/server.ts` - Bridge server implementation
- `src/cli.ts` - CLI tool for interacting with bridge
- `hooks/` - Claude Code hook scripts
- `skill/` - Claude skill definition

## Multi-Model Support

The `AgentAdapter` interface in `src/types.ts` defines how to add support for different AI models as pair programmers. Each adapter must implement:
- `spawn()` - Start the pair agent
- `stop()` - Stop the pair agent
- `isRunning()` - Check if agent is active

This allows the same bridge to work with Claude, Codex, Gemini, or any other model that can execute the pair programmer prompt.
