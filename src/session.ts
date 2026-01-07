// ABOUTME: Session manager that orchestrates pair programming sessions
// ABOUTME: Handles bridge lifecycle, adapter spawning, and session state

import { randomBytes } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { BridgeServer } from './server.js';
import { createAdapter } from './adapters/index.js';
import type { AgentAdapter, PairAgentBackend, PairSessionOptions, BridgeStatus } from './types.js';

const PAIR_AGENT_PROMPT_PATH = new URL('../skill/pair-agent-prompt.md', import.meta.url);

interface ActiveSession {
  id: string;
  bridge: BridgeServer;
  adapter: AgentAdapter;
  startedAt: Date;
  backend: PairAgentBackend;
}

let activeSession: ActiveSession | null = null;

/**
 * Generate a short unique session ID.
 */
function generateSessionId(): string {
  return randomBytes(4).toString('hex');
}

/**
 * Load the pair agent system prompt from disk.
 */
function loadPairAgentPrompt(): string {
  try {
    const promptPath = PAIR_AGENT_PROMPT_PATH.pathname;
    if (existsSync(promptPath)) {
      return readFileSync(promptPath, 'utf-8');
    }
  } catch {
    // Fall through to default
  }

  // Minimal fallback prompt
  return `You are a pair programmer. Watch the main agent's activity via pair-bridge wait,
and emit feedback via pair-bridge emit feedback when you spot issues.
Focus on bugs, security issues, and missed edge cases.`;
}

/**
 * Start a new pair programming session.
 */
export async function startSession(options: Partial<PairSessionOptions> = {}): Promise<{
  sessionId: string;
  socketPath: string;
  backend: PairAgentBackend;
}> {
  if (activeSession) {
    throw new Error(`Session already active: ${activeSession.id}`);
  }

  const backend = options.backend || 'claude-opus';
  const sessionId = generateSessionId();

  // Start the bridge server
  const bridge = new BridgeServer(sessionId);
  await bridge.start();

  // Create and spawn the adapter
  const adapter = createAdapter(backend);
  const systemPrompt = options.customPrompt || loadPairAgentPrompt();

  try {
    await adapter.spawn(sessionId, systemPrompt);
  } catch (err) {
    // Clean up bridge if adapter fails to spawn
    await bridge.stop();
    throw err;
  }

  activeSession = {
    id: sessionId,
    bridge,
    adapter,
    startedAt: new Date(),
    backend,
  };

  // Set environment variable for hooks to use
  process.env.CLAUDE_SESSION_ID = sessionId;

  return {
    sessionId,
    socketPath: bridge.getSocketPath(),
    backend,
  };
}

/**
 * Stop the active pair programming session.
 */
export async function stopSession(): Promise<{
  sessionId: string;
  duration: number;
  status: BridgeStatus | null;
}> {
  if (!activeSession) {
    throw new Error('No active session');
  }

  const { id, bridge, adapter, startedAt } = activeSession;

  // Get final status before stopping
  let status: BridgeStatus | null = null;
  try {
    // We'd need to query the bridge for status, but since we're stopping,
    // let's just calculate duration
  } catch {
    // Ignore errors getting status
  }

  // Stop adapter first (graceful shutdown)
  try {
    await adapter.stop();
  } catch {
    // Continue with bridge stop even if adapter fails
  }

  // Stop bridge
  await bridge.stop();

  const duration = Math.floor((Date.now() - startedAt.getTime()) / 1000);

  // Clear session
  const sessionId = activeSession.id;
  activeSession = null;
  delete process.env.CLAUDE_SESSION_ID;

  return {
    sessionId,
    duration,
    status,
  };
}

/**
 * Get the status of the active session.
 */
export function getSessionStatus(): {
  active: boolean;
  sessionId?: string;
  backend?: PairAgentBackend;
  socketPath?: string;
  uptime?: number;
  pairRunning?: boolean;
} {
  if (!activeSession) {
    return { active: false };
  }

  return {
    active: true,
    sessionId: activeSession.id,
    backend: activeSession.backend,
    socketPath: activeSession.bridge.getSocketPath(),
    uptime: Math.floor((Date.now() - activeSession.startedAt.getTime()) / 1000),
    pairRunning: activeSession.adapter.isRunning(),
  };
}

/**
 * Check if a session is currently active.
 */
export function isSessionActive(): boolean {
  return activeSession !== null;
}

/**
 * Get the current session ID, if any.
 */
export function getSessionId(): string | null {
  return activeSession?.id || null;
}
