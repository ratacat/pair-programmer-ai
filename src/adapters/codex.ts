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

  async spawn(sessionId: string, systemPrompt: string): Promise<void> {
    const socketPath = `/tmp/claude-pair-${sessionId}.sock`;

    // Build the Codex prompt that includes:
    // 1. The pair programmer system prompt
    // 2. Instructions to use pair-bridge CLI to communicate
    const codexPrompt = `
${systemPrompt}

You are connected to a pair programming bridge at ${socketPath}.
Use these commands to communicate:
- pair-bridge wait: Block until the main agent does something
- pair-bridge emit feedback '{"severity":"high|medium|low","message":"..."}'

Start your watch loop now.
`.trim();

    // Spawn codex in the background
    // Using 'codex' CLI - adjust command based on actual Codex CLI interface
    this.process = spawn('codex', ['--prompt', codexPrompt], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, CLAUDE_PAIR_SESSION: sessionId },
    });

    this.process.unref();
    this.running = true;

    // Wait briefly to ensure process started
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (this.process.exitCode !== null) {
      this.running = false;
      throw new Error(`Codex process exited immediately with code ${this.process.exitCode}`);
    }
  }

  async stop(): Promise<void> {
    if (this.process && this.running) {
      this.process.kill('SIGTERM');

      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          this.process?.kill('SIGKILL');
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
  }

  isRunning(): boolean {
    return this.running && this.process?.exitCode === null;
  }

  getProcessId(): string | undefined {
    return this.process?.pid?.toString();
  }
}
