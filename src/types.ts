// ABOUTME: Shared type definitions for the pair-bridge protocol
// ABOUTME: Defines activity events, feedback events, and control messages

export interface ActivityEvent {
  type: 'activity';
  timestamp: string;
  tool: string;
  input: Record<string, unknown>;
  output_summary: string;
  sequence: number;
  session_id: string;
}

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
 * Configuration for the pair programming system.
 * Stored in ~/.claude/settings.json under the "pair" key.
 */
export interface PairConfig {
  auto_suggest: boolean;
  auto_suggest_threshold: number;
  feedback_verbosity: 'quiet' | 'normal' | 'verbose';
  pair_model: string;
}

/**
 * Adapter interface for different AI model backends.
 * Implement this to add support for new pair programming agents.
 */
export interface AgentAdapter {
  name: string;
  spawn(sessionId: string, systemPrompt: string): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}
