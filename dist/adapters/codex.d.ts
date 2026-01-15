import type { AgentAdapter, PairAgentBackend } from '../types.js';
/**
 * Adapter for using OpenAI Codex as the pair programmer.
 *
 * Spawns the `codex` CLI as a subprocess with a prompt that instructs it
 * to connect to the bridge and run the pair programmer loop.
 *
 * Requirements:
 * - `codex` CLI must be installed and in PATH
 * - OPENAI_API_KEY must be set in environment
 */
export declare class CodexAdapter implements AgentAdapter {
    readonly name = "Codex";
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
}
//# sourceMappingURL=codex.d.ts.map