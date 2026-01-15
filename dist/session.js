// ABOUTME: Session manager for programmatic pair-bridge usage
// ABOUTME: Handles bridge lifecycle and adapter spawning for CLI backends
import { randomBytes } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { BridgeServer } from './server.js';
import { createAdapter } from './adapters/index.js';
const PAIR_AGENT_PROMPT_PATH = new URL('../skill/pair-agent-prompt.md', import.meta.url);
let activeSession = null;
/**
 * Generate a short unique session ID.
 */
function generateSessionId() {
    return randomBytes(4).toString('hex');
}
/**
 * Load the pair agent system prompt from disk.
 */
function loadPairAgentPrompt() {
    try {
        const promptPath = PAIR_AGENT_PROMPT_PATH.pathname;
        if (existsSync(promptPath)) {
            return readFileSync(promptPath, 'utf-8');
        }
    }
    catch {
        // Fall through to default
    }
    // Minimal fallback prompt
    return `You are a pair programmer. Watch the main agent's activity via pair-bridge wait,
and emit feedback via pair-bridge emit feedback when you spot issues.
Focus on bugs, security issues, and missed edge cases.`;
}
/**
 * Start a new pair programming session.
 *
 * For 'codex' backend: Spawns a Codex subprocess via adapter.
 * For 'claude-opus' backend: Only starts the bridge. The pair agent must be
 * spawned separately via Claude Code's Task tool (see skill.md).
 */
export async function startSession(options = {}) {
    if (activeSession) {
        throw new Error(`Session already active: ${activeSession.id}`);
    }
    const backend = options.backend || 'claude-opus';
    const sessionId = generateSessionId();
    // Start the bridge server
    const bridge = new BridgeServer(sessionId);
    await bridge.start();
    let adapter = null;
    let adapterSpawned = false;
    // Only spawn adapter for CLI-available backends
    if (backend === 'codex') {
        adapter = createAdapter(backend);
        const systemPrompt = options.customPrompt || loadPairAgentPrompt();
        try {
            await adapter.spawn(sessionId, systemPrompt);
            adapterSpawned = true;
        }
        catch (err) {
            // Clean up bridge if adapter fails to spawn
            await bridge.stop();
            throw err;
        }
    }
    // For 'claude-opus', only the bridge is started.
    // The pair agent must be spawned via Claude Code's Task tool.
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
        adapterSpawned,
    };
}
/**
 * Stop the active pair programming session.
 */
export async function stopSession() {
    if (!activeSession) {
        throw new Error('No active session');
    }
    const { id, bridge, adapter, startedAt } = activeSession;
    // Get final status before stopping
    const status = null;
    // Stop adapter if one was spawned
    if (adapter) {
        try {
            await adapter.stop();
        }
        catch {
            // Continue with bridge stop even if adapter fails
        }
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
export function getSessionStatus() {
    if (!activeSession) {
        return { active: false };
    }
    return {
        active: true,
        sessionId: activeSession.id,
        backend: activeSession.backend,
        socketPath: activeSession.bridge.getSocketPath(),
        uptime: Math.floor((Date.now() - activeSession.startedAt.getTime()) / 1000),
        pairRunning: activeSession.adapter?.isRunning() ?? false,
    };
}
/**
 * Check if a session is currently active.
 */
export function isSessionActive() {
    return activeSession !== null;
}
/**
 * Get the current session ID, if any.
 */
export function getSessionId() {
    return activeSession?.id || null;
}
//# sourceMappingURL=session.js.map