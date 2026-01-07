// ABOUTME: Adapter registry for pair agent backends
// ABOUTME: Exports all adapters and provides factory function

import type { AgentAdapter, PairAgentBackend } from '../types.js';
import { ClaudeOpusAdapter } from './claude-opus.js';
import { CodexAdapter } from './codex.js';

export { ClaudeOpusAdapter } from './claude-opus.js';
export { CodexAdapter } from './codex.js';

/**
 * Create an adapter for the specified backend.
 */
export function createAdapter(backend: PairAgentBackend): AgentAdapter {
  switch (backend) {
    case 'claude-opus':
      return new ClaudeOpusAdapter();
    case 'codex':
      return new CodexAdapter();
    default:
      throw new Error(`Unknown backend: ${backend}`);
  }
}

/**
 * List all available backends.
 */
export function listBackends(): { backend: PairAgentBackend; name: string }[] {
  return [
    { backend: 'claude-opus', name: 'Claude Opus' },
    { backend: 'codex', name: 'Codex' },
  ];
}
