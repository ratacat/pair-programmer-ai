export declare class BridgeServer {
    private server;
    private session;
    private socketPath;
    constructor(sessionId: string);
    getSocketPath(): string;
    start(): Promise<void>;
    stop(): Promise<void>;
    private handleConnection;
    private handleMessage;
    private handleEmit;
    private handleWait;
    private handlePoll;
    private handleHistory;
    private handleStatus;
    private handleStop;
    private sendResponse;
}
//# sourceMappingURL=server.d.ts.map