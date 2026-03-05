const { ENABLE_CHAT, ENABLE_MAP } = require("../../config/constants");
const { generateScreenname } = require("../../utils/name-generator");

const setupStatsRoutes = (router, dependencies) => {
    const { peerManager, swarm, diagnostics } = dependencies;

    router.get("/api/stats", (req, res) => {
        res.json({
            count: peerManager.size,
            totalUnique: peerManager.totalUniquePeers,
            direct: swarm.getSwarm().connections.size,
            id: dependencies.identity.id,
            screenname: dependencies.identity.screenname,
            diagnostics: diagnostics.getStats(),
            chatEnabled: ENABLE_CHAT,
            mapEnabled: ENABLE_MAP,
            peers: peerManager.getPeersWithIps(),
        });
    });

    router.get("/api/health", (req, res) => {
        res.json({
            status: "ok",
            uptime: process.uptime(),
            peers: peerManager.size,
            direct: swarm.getSwarm().connections.size,
            sseClients: dependencies.sseManager ? dependencies.sseManager.size : 0,
            timestamp: Date.now(),
        });
    });

    router.get("/api/peers", (req, res) => {
        const peers = peerManager
            .getPeerList()
            .sort((a, b) => b.lastSeen - a.lastSeen)
            .map((peer) => ({
                id: peer.id,
                screenname: generateScreenname(peer.id),
                lastSeen: peer.lastSeen,
                ip: peer.ip,
            }));

        res.json({
            count: peers.length,
            peers,
        });
    });
};

module.exports = { setupStatsRoutes };
