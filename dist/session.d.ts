import type { PairAgentBackend, PairSessionOptions, BridgeStatus } from './types.js';
/**
 * Start a new pair programming session.
 *
 * For 'codex' backend: Spawns a Codex subprocess via adapter.
 * For 'claude-opus' backend: Only starts the bridge. The pair agent must be
 * spawned separately via Claude Code's Task tool (see skill.md).
 */
export declare function startSession(options?: Partial<PairSessionOptions>): Promise<{
    sessionId: string;
    socketPath: string;
    backend: PairAgentBackend;
    adapterSpawned: boolean;
}>;
/**
 * Stop the active pair programming session.
 */
export declare function stopSession(): Promise<{
    sessionId: string;
    duration: number;
    status: BridgeStatus | null;
}>;
/**
 * Get the status of the active session.
 */
export declare function getSessionStatus(): {
    active: boolean;
    sessionId?: string;
    backend?: PairAgentBackend;
    socketPath?: string;
    uptime?: number;
    pairRunning?: boolean;
};
/**
 * Check if a session is currently active.
 */
export declare function isSessionActive(): boolean;
/**
 * Get the current session ID, if any.
 */
export declare function getSessionId(): string | null;
//# sourceMappingURL=session.d.ts.map