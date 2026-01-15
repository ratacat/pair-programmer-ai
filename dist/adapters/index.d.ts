import type { AgentAdapter, PairAgentBackend } from '../types.js';
export { CodexAdapter } from './codex.js';
/**
 * Create an adapter for the specified backend.
 *
 * Note: 'opus' backend is only available within Claude Code via the Task tool.
 * For CLI/standalone usage, only 'codex' is supported.
 */
export declare function createAdapter(backend: PairAgentBackend): AgentAdapter;
/**
 * List backends available for CLI/standalone usage.
 */
export declare function listBackends(): {
    backend: PairAgentBackend;
    name: string;
    cliAvailable: boolean;
}[];
//# sourceMappingURL=index.d.ts.map