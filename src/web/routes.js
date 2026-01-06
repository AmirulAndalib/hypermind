const express = require("express");
const fs = require("fs");
const path = require("path");
const { ENABLE_CHAT, CHAT_RATE_LIMIT } = require("../config/constants");
const updater = require("../core/updater");

const HTML_TEMPLATE = fs.readFileSync(
    path.join(__dirname, "../../public/index.html"),
    "utf-8"
);

const setupRoutes = (app, identity, peerManager, swarm, sseManager, diagnostics) => {
    app.use(express.json());

    app.get("/", (req, res) => {
        const count = peerManager.size;
        const directPeers = swarm.getSwarm().connections.size;

        const html = HTML_TEMPLATE
            .replace(/\{\{COUNT\}\}/g, count)
            .replace(/\{\{ID\}\}/g, "..." + identity.id.slice(-8))
            .replace(/\{\{DIRECT\}\}/g, directPeers);

        res.send(html);
    });

    app.get("/events", (req, res) => {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        sseManager.addClient(res);

        const data = JSON.stringify({
            count: peerManager.size,
            totalUnique: peerManager.totalUniquePeers,
            direct: swarm.getSwarm().connections.size,
            id: identity.id,
            diagnostics: diagnostics.getStats(),
            chatEnabled: ENABLE_CHAT,
            peers: peerManager.getPeersWithIps()
        });
        res.write(`data: ${data}\n\n`);

        req.on("close", () => {
            sseManager.removeClient(res);
        });
    });

    app.get("/api/stats", (req, res) => {
        res.json({
            count: peerManager.size,
            totalUnique: peerManager.totalUniquePeers,
            direct: swarm.getSwarm().connections.size,
            id: identity.id,
            diagnostics: diagnostics.getStats(),
            chatEnabled: ENABLE_CHAT,
            peers: peerManager.getPeersWithIps()
        });
    });

    let chatHistory = []; // Store timestamps of recent messages

    app.post("/api/chat", (req, res) => {
        if (!ENABLE_CHAT) {
            return res.status(403).json({ error: "Chat disabled" });
        }

        const now = Date.now();
        // Clean up old timestamps (older than 10 seconds)
        chatHistory = chatHistory.filter(time => now - time < 10000);

        if (chatHistory.length >= 5) {
            return res.status(429).json({ error: "Rate limit exceeded: Max 5 messages per 10 seconds" });
        }
        
        chatHistory.push(now);

        const { content } = req.body;
        if (!content || typeof content !== 'string' || content.length > 140) {
            return res.status(400).json({ error: "Invalid content" });
        }

        const msg = {
            type: "CHAT",
            sender: identity.id,
            content: content,
            timestamp: Date.now()
        };

        swarm.broadcastChat(msg);
        sseManager.broadcast(msg);

        res.json({ success: true });
    });

    // Update System
    app.get("/api/update/check", async (req, res) => {
        try {
            const status = await updater.check();
            res.json(status);
        } catch (error) {
            console.error("Update check failed:", error);
            res.status(500).json({ error: "Failed to check for updates" });
        }
    });

    app.get("/api/update/notes", async (req, res) => {
        try {
            const notes = await updater.getRemoteNotes();
            res.json(notes);
        } catch (error) {
            console.error("Notes fetch failed:", error);
            res.status(500).json({ error: "Failed to fetch release notes" });
        }
    });

    app.post("/api/update/trigger", async (req, res) => {
        try {
            // Trigger internal update
            // We don't await this because it restarts the process
            updater.update().catch(err => {
                console.error("Update process failed:", err);
            });

            res.json({ success: true, message: "Update started" });
        } catch (error) {
            console.error("Update trigger failed:", error);
            res.status(500).json({ error: "Failed to start update" });
        }
    });

    app.use(express.static(path.join(__dirname, "../../public")));
}

module.exports = { setupRoutes };
