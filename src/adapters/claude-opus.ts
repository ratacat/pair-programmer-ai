// ABOUTME: Claude Opus adapter that spawns pair agent via claude CLI
// ABOUTME: Runs Opus as a background process watching the bridge

import { spawn, ChildProcess } from 'child_process';
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
export class ClaudeOpusAdapter implements AgentAdapter {
  readonly name = 'Claude Opus';
  readonly backend: PairAgentBackend = 'claude-opus';

  private process: ChildProcess | undefined;
  private running = false;
  private sessionId: string | undefined;

  /**
   * Build the prompt for the pair agent including connection instructions.
   */
  buildPrompt(sessionId: string, systemPrompt: string): string {
    return `${systemPrompt}

## Connection Details

You are connected to session: ${sessionId}
Socket path: /tmp/claude-pair-${sessionId}.sock

## Your Task

Run the pair programmer watch loop:

1. Start by checking if the bridge is running:
   \`\`\`bash
   SESSION_ID="${sessionId}" pair-bridge status
   \`\`\`

2. Then enter the watch loop. Keep running this until the session ends:
   \`\`\`bash
   LAST_SEEN=0
   while true; do
     ACTIVITY=$(SESSION_ID="${sessionId}" pair-bridge wait $LAST_SEEN)
     # Analyze $ACTIVITY and emit feedback if needed
     # Update LAST_SEEN from the activity sequence numbers
   done
   \`\`\`

3. When you spot an issue, emit feedback:
   \`\`\`bash
   SESSION_ID="${sessionId}" pair-bridge emit feedback '{"severity":"high","message":"Description of issue","context":{"file":"path.ts"}}'
   \`\`\`

Begin watching now. Stay quiet unless you spot a real issue.`;
  }

  async spawn(sessionId: string, systemPrompt: string): Promise<void> {
    this.sessionId = sessionId;
    const prompt = this.buildPrompt(sessionId, systemPrompt);

    // Spawn claude CLI in print mode with the prompt
    // Using --print to get non-interactive output
    this.process = spawn('claude', ['--print', prompt], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        SESSION_ID: sessionId,
        CLAUDE_SESSION_ID: sessionId,
      },
    });

    this.process.unref();
    this.running = true;

    // Log output for debugging (optional)
    this.process.stdout?.on('data', (data) => {
      // Could log to a file or event emitter
    });

    this.process.stderr?.on('data', (data) => {
      console.error(`[pair-opus] ${data}`);
    });

    this.process.on('exit', (code) => {
      this.running = false;
      if (code !== 0 && code !== null) {
        console.error(`[pair-opus] Exited with code ${code}`);
      }
    });

    // Wait briefly to ensure process started
    await new Promise((resolve) => setTimeout(resolve, 200));

    if (this.process.exitCode !== null) {
      this.running = false;
      throw new Error(`Claude process exited immediately with code ${this.process.exitCode}`);
    }
  }

  async stop(): Promise<void> {
    if (this.process && this.running) {
      // Send SIGTERM for graceful shutdown
      this.process.kill('SIGTERM');

      // Wait for graceful shutdown with timeout
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          // Force kill if still running
          if (this.process && this.running) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    this.running = false;
    this.process = undefined;
    this.sessionId = undefined;
  }

  isRunning(): boolean {
    if (!this.process) return false;
    return this.running && this.process.exitCode === null;
  }

  getProcessId(): string | undefined {
    return this.process?.pid?.toString();
  }

  /**
   * Get the prompt that would be used to spawn this adapter.
   * Useful for Claude Code to invoke via Task tool instead.
   */
  getTaskPrompt(sessionId: string, systemPrompt: string): {
    prompt: string;
    model: string;
    subagentType: string;
  } {
    return {
      prompt: this.buildPrompt(sessionId, systemPrompt),
      model: 'opus',
      subagentType: 'general-purpose',
    };
  }
}
