// ABOUTME: Codex adapter that spawns pair agent via `codex` CLI
// ABOUTME: Runs Codex as a subprocess watching the bridge

import { spawn, ChildProcess } from 'child_process';
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
export class CodexAdapter implements AgentAdapter {
  readonly name = 'Codex';
  readonly backend: PairAgentBackend = 'codex';

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

    // Spawn codex CLI with the prompt
    // The codex CLI accepts a prompt as a positional argument
    this.process = spawn('codex', [prompt], {
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

    // Log output for debugging
    this.process.stderr?.on('data', (data) => {
      console.error(`[pair-codex] ${data}`);
    });

    this.process.on('exit', (code) => {
      this.running = false;
      if (code !== 0 && code !== null) {
        console.error(`[pair-codex] Exited with code ${code}`);
      }
    });

    // Wait briefly to ensure process started
    await new Promise((resolve) => setTimeout(resolve, 200));

    if (this.process.exitCode !== null) {
      this.running = false;
      throw new Error(`Codex process exited immediately with code ${this.process.exitCode}`);
    }
  }

  async stop(): Promise<void> {
    if (this.process && this.running) {
      this.process.kill('SIGTERM');

      // Wait for graceful shutdown with timeout
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
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
}
