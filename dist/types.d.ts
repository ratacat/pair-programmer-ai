export interface ToolActivityEvent {
    type: 'activity';
    timestamp: string;
    tool: string;
    input: Record<string, unknown>;
    output_summary: string;
    sequence: number;
    session_id: string;
}
export interface PromptEvent {
    type: 'prompt';
    timestamp: string;
    content: string;
    sequence: number;
    session_id: string;
}
/**
 * Events sent to the pair agent.
 * - activity: Tool calls from the main agent
 * - prompt: User prompts (gives pair agent context about what was asked)
 */
export type ActivityEvent = ToolActivityEvent | PromptEvent;
export interface FeedbackEvent {
    type: 'feedback';
    timestamp: string;
    severity: 'high' | 'medium' | 'low';
    message: string;
    context?: {
        file?: string;
        line?: number;
        tool?: string;
        sequence?: number;
    };
}
export interface ControlEvent {
    type: 'start' | 'stop' | 'ping' | 'pong';
    timestamp: string;
    session_id: string;
}
export type BridgeEvent = ActivityEvent | FeedbackEvent | ControlEvent;
export interface Session {
    id: string;
    activities: ActivityEvent[];
    feedbackQueue: FeedbackEvent[];
    startedAt: string;
    pairConnected: boolean;
}
export interface BridgeStatus {
    session_id: string;
    activity_count: number;
    pending_feedback: number;
    pair_connected: boolean;
    uptime_seconds: number;
}
export interface BridgeCommand {
    command: 'emit' | 'wait' | 'poll' | 'history' | 'status' | 'stop';
    payload?: BridgeEvent;
    lastSeen?: number;
    last?: number;
}
export interface BridgeResponse {
    ok: boolean;
    data?: unknown;
    error?: string;
}
/**
 * Supported pair agent backends.
 * - claude-opus: Claude Opus via Task tool (runs in same Claude Code session)
 * - codex: OpenAI Codex via `codex` CLI (spawned as subprocess)
 */
export type PairAgentBackend = 'claude-opus' | 'codex';
/**
 * Configuration for the pair programming system.
 * Stored in ~/.claude/settings.json under the "pair" key.
 */
export interface PairConfig {
    /** Suggest pairing for complex tasks */
    auto_suggest: boolean;
    /** Suggest after N file edits planned */
    auto_suggest_threshold: number;
    /** How much feedback to show: quiet (high only), normal (high+medium), verbose (all) */
    feedback_verbosity: 'quiet' | 'normal' | 'verbose';
    /** Default pair agent backend */
    default_backend: PairAgentBackend;
}
/**
 * Adapter interface for spawning external AI model backends.
 *
 * The main agent (Claude Code) always runs the bridge and hooks.
 * The pair agent communicates through the bridge.
 *
 * For Claude Opus: Use Task tool directly in the skill (no adapter needed).
 * For external models: Use an adapter to spawn a subprocess.
 *
 * Implementations:
 * - CodexAdapter: Spawns `codex` CLI as a subprocess with the pair prompt
 */
export interface AgentAdapter {
    /** Display name for this backend */
    readonly name: string;
    /** Backend identifier */
    readonly backend: PairAgentBackend;
    /**
     * Spawn the pair agent.
     * @param sessionId - Bridge session ID for socket path
     * @param systemPrompt - The pair programmer system prompt
     * @returns Promise that resolves when agent is running
     */
    spawn(sessionId: string, systemPrompt: string): Promise<void>;
    /**
     * Stop the pair agent gracefully.
     * Should send stop signal and wait for cleanup.
     */
    stop(): Promise<void>;
    /** Check if the pair agent process is still running */
    isRunning(): boolean;
    /** Get the process ID or task ID for monitoring */
    getProcessId(): string | undefined;
}
/**
 * Options for spawning a pair session.
 */
export interface PairSessionOptions {
    /** Which backend to use for the pair agent */
    backend: PairAgentBackend;
    /** Override the default system prompt */
    customPrompt?: string;
    /** Run in verbose mode (show all feedback) */
    verbose?: boolean;
}
//# sourceMappingURL=types.d.ts.map