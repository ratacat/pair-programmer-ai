// ABOUTME: Adapter registry for pair agent backends
// ABOUTME: Provides factory function for CLI-spawnable backends
import { CodexAdapter } from './codex.js';
export { CodexAdapter } from './codex.js';
/**
 * Create an adapter for the specified backend.
 *
 * Note: 'opus' backend is only available within Claude Code via the Task tool.
 * For CLI/standalone usage, only 'codex' is supported.
 */
export function createAdapter(backend) {
    switch (backend) {
        case 'codex':
            return new CodexAdapter();
        case 'claude-opus':
            throw new Error("Claude Opus backend requires Claude Code's Task tool. " +
                "Use the /pair skill within Claude Code, or use 'codex' for standalone CLI usage.");
        default:
            throw new Error(`Unknown backend: ${backend}`);
    }
}
/**
 * List backends available for CLI/standalone usage.
 */
export function listBackends() {
    return [
        { backend: 'claude-opus', name: 'Claude Opus', cliAvailable: false },
        { backend: 'codex', name: 'Codex', cliAvailable: true },
    ];
}
//# sourceMappingURL=index.js.map