// ABOUTME: Bridge server that routes messages between main and pair agents
// ABOUTME: Listens on Unix socket, manages activity queue and feedback delivery

import { createServer, Socket, Server } from 'net';
import { unlinkSync, existsSync } from 'fs';
import type {
  ActivityEvent,
  FeedbackEvent,
  BridgeCommand,
  BridgeResponse,
  BridgeStatus,
} from './types.js';

interface Session {
  id: string;
  activities: ActivityEvent[];
  feedbackQueue: FeedbackEvent[];
  startedAt: Date;
  pairWaiters: Socket[];
}

export class BridgeServer {
  private server: Server | null = null;
  private session: Session;
  private socketPath: string;

  constructor(sessionId: string) {
    this.session = {
      id: sessionId,
      activities: [],
      feedbackQueue: [],
      startedAt: new Date(),
      pairWaiters: [],
    };
    this.socketPath = `/tmp/claude-pair-${sessionId}.sock`;
  }

  getSocketPath(): string {
    return this.socketPath;
  }

  async start(): Promise<void> {
    if (existsSync(this.socketPath)) {
      unlinkSync(this.socketPath);
    }

    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => this.handleConnection(socket));

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.socketPath, () => {
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close any waiting connections
      for (const waiter of this.session.pairWaiters) {
        waiter.end(JSON.stringify({ type: 'stop', session_id: this.session.id }) + '\n');
      }
      this.session.pairWaiters = [];

      if (this.server) {
        this.server.close(() => {
          if (existsSync(this.socketPath)) {
            unlinkSync(this.socketPath);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleConnection(socket: Socket): void {
    let buffer = '';

    socket.on('data', (data) => {
      buffer += data.toString();

      // Process complete messages (newline-delimited JSON)
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          this.handleMessage(socket, line.trim());
        }
      }
    });

    socket.on('error', (err) => {
      // Remove from waiters if present
      this.session.pairWaiters = this.session.pairWaiters.filter((w) => w !== socket);
      console.error('Socket error:', err.message);
    });

    socket.on('close', () => {
      this.session.pairWaiters = this.session.pairWaiters.filter((w) => w !== socket);
    });
  }

  private handleMessage(socket: Socket, messageStr: string): void {
    let message: BridgeCommand;
    try {
      message = JSON.parse(messageStr);
    } catch {
      this.sendResponse(socket, { ok: false, error: 'Invalid JSON' });
      return;
    }

    switch (message.command) {
      case 'emit':
        this.handleEmit(socket, message);
        break;
      case 'wait':
        this.handleWait(socket, message);
        break;
      case 'poll':
        this.handlePoll(socket);
        break;
      case 'history':
        this.handleHistory(socket, message);
        break;
      case 'status':
        this.handleStatus(socket);
        break;
      case 'stop':
        this.handleStop(socket);
        break;
      default:
        this.sendResponse(socket, { ok: false, error: `Unknown command: ${message.command}` });
    }
  }

  private handleEmit(socket: Socket, message: BridgeCommand): void {
    if (!message.payload) {
      this.sendResponse(socket, { ok: false, error: 'Missing payload' });
      return;
    }

    if (message.payload.type === 'activity') {
      const activity: ActivityEvent = {
        ...message.payload,
        sequence: this.session.activities.length,
        session_id: this.session.id,
      };
      this.session.activities.push(activity);

      // Notify any waiting pair agents
      for (const waiter of this.session.pairWaiters) {
        waiter.write(JSON.stringify([activity]) + '\n');
      }
      this.session.pairWaiters = [];

      this.sendResponse(socket, { ok: true });
    } else if (message.payload.type === 'feedback') {
      this.session.feedbackQueue.push(message.payload as FeedbackEvent);
      this.sendResponse(socket, { ok: true });
    } else {
      this.sendResponse(socket, { ok: false, error: `Unknown payload type: ${message.payload.type}` });
    }
  }

  private handleWait(socket: Socket, message: BridgeCommand): void {
    const lastSeen = message.lastSeen ?? 0;
    const unseen = this.session.activities.slice(lastSeen);

    if (unseen.length > 0) {
      // Have unseen activity, send immediately
      socket.write(JSON.stringify(unseen) + '\n');
    } else {
      // No new activity, hold connection until there is
      this.session.pairWaiters.push(socket);
      // Don't respond yet - connection stays open
    }
  }

  private handlePoll(socket: Socket): void {
    const feedback = this.session.feedbackQueue.shift();
    socket.write(JSON.stringify(feedback ?? null) + '\n');
  }

  private handleHistory(socket: Socket, message: BridgeCommand): void {
    const n = message.last ?? 10;
    const history = this.session.activities.slice(-n);
    socket.write(JSON.stringify(history) + '\n');
  }

  private handleStatus(socket: Socket): void {
    const status: BridgeStatus = {
      session_id: this.session.id,
      activity_count: this.session.activities.length,
      pending_feedback: this.session.feedbackQueue.length,
      pair_connected: this.session.pairWaiters.length > 0,
      uptime_seconds: Math.floor((Date.now() - this.session.startedAt.getTime()) / 1000),
    };
    socket.write(JSON.stringify(status) + '\n');
  }

  private handleStop(socket: Socket): void {
    this.sendResponse(socket, { ok: true, data: { stopping: true } });
    // Schedule stop after response is sent
    setImmediate(() => this.stop());
  }

  private sendResponse(socket: Socket, response: BridgeResponse): void {
    socket.write(JSON.stringify(response) + '\n');
  }
}

// Run as standalone server if executed directly
const isMainModule = process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts');
if (isMainModule) {
  const sessionId = process.env.SESSION_ID || 'default';
  const server = new BridgeServer(sessionId);

  server.start().then(() => {
    console.log(`Bridge listening on ${server.getSocketPath()}`);
  }).catch((err) => {
    console.error('Failed to start bridge:', err);
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    server.stop().then(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    server.stop().then(() => process.exit(0));
  });
}
