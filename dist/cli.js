// ABOUTME: CLI tool for interacting with the pair-bridge server
// ABOUTME: Supports start, stop, status, emit, wait, poll, and history commands
import { connect } from 'net';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const SESSION_ID = process.env.CLAUDE_SESSION_ID || process.env.SESSION_ID || 'default';
const SOCKET_PATH = `/tmp/claude-pair-${SESSION_ID}.sock`;
function sendCommand(command) {
    return new Promise((resolve, reject) => {
        if (!existsSync(SOCKET_PATH)) {
            reject(new Error(`Bridge not running (socket not found: ${SOCKET_PATH})`));
            return;
        }
        const socket = connect(SOCKET_PATH);
        let buffer = '';
        socket.on('connect', () => {
            socket.write(JSON.stringify(command) + '\n');
        });
        socket.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            if (lines.length > 1) {
                const response = JSON.parse(lines[0]);
                socket.end();
                resolve(response);
            }
        });
        socket.on('error', (err) => {
            reject(err);
        });
        socket.on('timeout', () => {
            socket.end();
            reject(new Error('Connection timed out'));
        });
        socket.setTimeout(30000);
    });
}
function waitForActivity(lastSeen) {
    return new Promise((resolve, reject) => {
        if (!existsSync(SOCKET_PATH)) {
            reject(new Error(`Bridge not running (socket not found: ${SOCKET_PATH})`));
            return;
        }
        const socket = connect(SOCKET_PATH);
        let buffer = '';
        socket.on('connect', () => {
            const command = { command: 'wait', lastSeen };
            socket.write(JSON.stringify(command) + '\n');
        });
        socket.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            if (lines.length > 1) {
                const response = JSON.parse(lines[0]);
                socket.end();
                resolve(response);
            }
        });
        socket.on('error', (err) => {
            reject(err);
        });
        // No timeout for wait - it blocks until activity
    });
}
async function startBridge() {
    if (existsSync(SOCKET_PATH)) {
        console.log('Bridge already running');
        return;
    }
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const serverPath = join(__dirname, 'server.js');
    const server = spawn('node', [serverPath], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, SESSION_ID },
    });
    server.unref();
    // Wait for socket to appear
    for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 100));
        if (existsSync(SOCKET_PATH)) {
            console.log(`Bridge started for session ${SESSION_ID}`);
            console.log(`Socket: ${SOCKET_PATH}`);
            return;
        }
    }
    throw new Error('Bridge failed to start (socket not created)');
}
async function main() {
    const [, , cmd, ...args] = process.argv;
    switch (cmd) {
        case 'start': {
            await startBridge();
            break;
        }
        case 'stop': {
            const result = await sendCommand({ command: 'stop' });
            console.log('Bridge stopped');
            break;
        }
        case 'status': {
            const status = await sendCommand({ command: 'status' });
            console.log(JSON.stringify(status, null, 2));
            break;
        }
        case 'emit': {
            const type = args[0]; // 'activity' or 'feedback'
            const payloadStr = args[1];
            if (!type || !payloadStr) {
                console.error('Usage: pair-bridge emit <activity|feedback> <json>');
                process.exit(1);
            }
            const payload = JSON.parse(payloadStr);
            payload.type = type;
            payload.timestamp = payload.timestamp || new Date().toISOString();
            await sendCommand({ command: 'emit', payload });
            break;
        }
        case 'wait': {
            const lastSeen = parseInt(args[0] || '0', 10);
            const activities = await waitForActivity(lastSeen);
            console.log(JSON.stringify(activities));
            break;
        }
        case 'poll': {
            const feedback = await sendCommand({ command: 'poll' });
            if (feedback) {
                console.log(JSON.stringify(feedback));
            }
            break;
        }
        case 'history': {
            const n = parseInt(args[0] || '10', 10);
            const history = await sendCommand({ command: 'history', last: n });
            console.log(JSON.stringify(history, null, 2));
            break;
        }
        default:
            console.log(`pair-bridge - AI pair programming bridge

Usage: pair-bridge <command> [args]

Commands:
  start              Start the bridge server (backgrounds itself)
  stop               Stop the bridge server
  status             Show bridge status (session, activity count, etc.)
  emit <type> <json> Send activity or feedback to the bridge
                     type: 'activity' or 'feedback'
  wait [lastSeen]    Block until new activity (for pair agent)
  poll               Non-blocking check for pending feedback (for main)
  history [n]        Show last n activities (default: 10)

Environment:
  CLAUDE_SESSION_ID  Session ID (default: 'default')
  SESSION_ID         Alias for CLAUDE_SESSION_ID

Examples:
  pair-bridge start
  pair-bridge emit activity '{"tool":"Edit","input":{"file":"foo.ts"}}'
  pair-bridge emit feedback '{"severity":"high","message":"Missing null check"}'
  pair-bridge wait 0
  pair-bridge poll
  pair-bridge status
  pair-bridge stop
`);
            if (cmd && cmd !== 'help' && cmd !== '--help' && cmd !== '-h') {
                process.exit(1);
            }
    }
}
main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map