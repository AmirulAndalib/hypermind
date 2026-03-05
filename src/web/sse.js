const { BROADCAST_THROTTLE } = require("../config/constants");

class SSEManager {
    constructor() {
        this.clients = new Set();
        this.lastBroadcast = 0;
    }

    addClient(res) {
        this.clients.add(res);
    }

    removeClient(res) {
        this.clients.delete(res);
    }

    broadcastUpdate(data) {
        const now = Date.now();
        if (now - this.lastBroadcast < BROADCAST_THROTTLE) return;
        this.lastBroadcast = now;

        this.broadcast(data);
    }

    broadcast(data) {
        const message = JSON.stringify(data);
        for (const client of this.clients) {
            if (client.writableEnded || client.destroyed) {
                this.clients.delete(client);
                continue;
            }
            try {
                client.write(`data: ${message}\n\n`);
            } catch (e) {
                this.clients.delete(client);
            }
        }
    }

    get size() {
        return this.clients.size;
    }
}

module.exports = { SSEManager };
