import { MasterSession } from "./master-session.js";

const session = new MasterSession();

self.onmessage = event => {
    const message = event.data;
    if (!message || message.type !== "choose") return;
    try {
        self.postMessage({
            type: "result",
            requestId: message.requestId,
            gameId: message.gameId,
            ...session.choose(message)
        });
    } catch (error) {
        self.postMessage({
            type: "error",
            requestId: message.requestId,
            gameId: message.gameId,
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
