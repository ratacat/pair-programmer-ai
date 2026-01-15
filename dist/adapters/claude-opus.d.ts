import type { AgentAdapter, PairAgentBackend } from '../types.js';
/**
 * Adapter for using Claude Opus as the pair programmer.
 *
 * Spawns a new `claude` CLI instance with the pair programmer prompt.
 * The pair agent runs in a subprocess, watching the bridge for activity
 * and emitting feedback when it spots issues.
 *
 * When used within Claude Code, the skill can also use the Task tool
 * directly - this adapter provides standalone functionality.
 */
export declare class ClaudeOpusAdapter implements AgentAdapter {
    readonly name = "Claude Opus";
    readonly backend: PairAgentBackend;
    private process;
    private running;
    private sessionId;
    /**
     * Build the prompt for the pair agent including connection instructions.
     */
    buildPrompt(sessionId: string, systemPrompt: string): string;
    spawn(sessionId: string, systemPrompt: string): Promise<void>;
    stop(): Promise<void>;
    isRunning(): boolean;
    getProcessId(): string | undefined;
    /**
     * Get the prompt that would be used to spawn this adapter.
     * Useful for Claude Code to invoke via Task tool instead.
     */
    getTaskPrompt(sessionId: string, systemPrompt: string): {
        prompt: string;
        model: string;
        subagentType: string;
    };
}
//# sourceMappingURL=claude-opus.d.ts.map