// ABOUTME: Claude Opus adapter that spawns pair agent via Task tool
// ABOUTME: Runs Opus as a background agent in the same Claude Code session

import type { AgentAdapter, PairAgentBackend } from '../types.js';

/**
 * Adapter for using Claude Opus as the pair programmer.
 *
 * Uses the Task tool to spawn Opus as a background agent. The agent runs
 * in the same Claude Code session, watching the bridge for activity and
 * emitting feedback.
 *
 * This is the recommended adapter when running inside Claude Code since
 * it uses native tooling and shares context efficiently.
 */
export class ClaudeOpusAdapter implements AgentAdapter {
  readonly name = 'Claude Opus';
  readonly backend: PairAgentBackend = 'claude-opus';

  private taskId: string | undefined;
  private running = false;

  async spawn(sessionId: string, systemPrompt: string): Promise<void> {
    // TODO: Implement using Task tool with run_in_background: true
    // The task prompt should include:
    // 1. The system prompt for pair programmer behavior
    // 2. Instructions to connect to bridge at /tmp/claude-pair-{sessionId}.sock
    // 3. The wait/emit loop for watching activity and providing feedback

    this.running = true;
    // this.taskId = result.taskId;
  }

  async stop(): Promise<void> {
    // TODO: Signal the task to stop gracefully
    // Could emit a 'stop' control event to the bridge
    this.running = false;
    this.taskId = undefined;
  }

  isRunning(): boolean {
    return this.running;
  }

  getProcessId(): string | undefined {
    return this.taskId;
  }
}
