const express = require("express");
const { PORT } = require("../config/constants");
const { setupRoutes } = require("./routes");

const createServer = (identity, peerManager, swarm, sseManager, diagnostics) => {
    const app = express();

    setupRoutes(app, identity, peerManager, swarm, sseManager, diagnostics);

    return app;
}

const startServer = (app, identity) => {
    const server = app.listen(PORT, () => {
        console.log(`Hypermind Node running on port ${PORT}`);
        console.log(`ID: ${identity.id}`);
    });
    return server;
}

module.exports = { createServer, startServer };
