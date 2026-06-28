const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = 3000;
const ROOM_CODE_LENGTH = 6;

const rooms = new Map();
const playerConnections = new Map();

function generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

function createBoard(size) {
    const board = [];
    for (let row = 0; row < size; row++) {
        board[row] = new Array(size).fill(0);
    }
    return board;
}

function createRoom(boardSize) {
    let code = generateRoomCode();
    while (rooms.has(code)) {
        code = generateRoomCode();
    }

    const room = {
        code,
        boardSize,
        players: [],
        board: createBoard(boardSize),
        currentPlayer: 1,
        gameOver: false,
        moveHistory: []
    };

    rooms.set(code, room);
    return room;
}

function isLegalMove(room, row, col, player) {
    if (room.gameOver) return false;
    if (room.currentPlayer !== player) return false;
    if (room.board[row][col] !== 0) return false;

    const opponent = player === 1 ? 2 : 1;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of directions) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < room.boardSize && nc >= 0 && nc < room.boardSize) {
            if (room.board[nr][nc] === opponent) {
                return false;
            }
        }
    }

    return true;
}

function hasLegalMove(room, player) {
    for (let row = 0; row < room.boardSize; row++) {
        for (let col = 0; col < room.boardSize; col++) {
            if (isLegalMove(room, row, col, player)) {
                return true;
            }
        }
    }
    return false;
}

function checkGameEnd(room) {
    if (hasLegalMove(room, room.currentPlayer)) return;

    const opponent = room.currentPlayer === 1 ? 2 : 1;
    const opponentCanMove = hasLegalMove(room, opponent);

    room.gameOver = true;

    if (opponentCanMove) {
        broadcast(room, { type: "gameOver", winner: opponent });
    } else {
        broadcast(room, { type: "gameOver", winner: 0 });
    }
}

function broadcast(room, data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    room.players.forEach((player) => {
        if (player.res && !player.res.writableEnded) {
            player.res.write(message);
        }
    });
}

function cleanupRoom(room) {
    room.players.forEach((player) => {
        if (player.res && !player.res.writableEnded) {
            player.res.end();
        }
    });
    rooms.delete(room.code);
}

function parseBody(req, callback) {
    let body = "";
    req.on("data", (chunk) => {
        body += chunk.toString();
    });
    req.on("end", () => {
        try {
            callback(JSON.parse(body));
        } catch (error) {
            callback(null);
        }
    });
}

function serveStaticFile(filePath, res) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8"
    };

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }
        res.writeHead(200, {
            "Content-Type": contentTypes[ext] || "application/octet-stream"
        });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    if (pathname === "/" && method === "GET") {
        serveStaticFile(path.join(__dirname, "index.html"), res);
        return;
    }

    if (pathname === "/style.css" && method === "GET") {
        serveStaticFile(path.join(__dirname, "style.css"), res);
        return;
    }

    if (pathname === "/script.js" && method === "GET") {
        serveStaticFile(path.join(__dirname, "script.js"), res);
        return;
    }

    if (pathname === "/create-room" && method === "POST") {
        parseBody(req, (body) => {
            const boardSize = body && body.boardSize ? Number(body.boardSize) : 8;
            const room = createRoom(boardSize);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ code: room.code, boardSize: room.boardSize }));
        });
        return;
    }

    if (pathname === "/join-room" && method === "POST") {
        parseBody(req, (body) => {
            const code = body && body.code ? body.code.toUpperCase() : "";
            const room = rooms.get(code);

            if (!room) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "房间不存在" }));
                return;
            }

            if (room.players.length >= 2) {
                res.writeHead(403, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "房间已满" }));
                return;
            }

            const playerId = Date.now().toString() + Math.random().toString(36).substring(2, 8);
            const color = room.players.length === 0 ? 1 : 2;
            const player = { id: playerId, color, res: null };

            room.players.push(player);
            playerConnections.set(playerId, { roomCode: code, color });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ playerId, color, boardSize: room.boardSize }));

            if (room.players.length === 2) {
                broadcast(room, { type: "started", currentPlayer: 1, boardSize: room.boardSize });
            }
        });
        return;
    }

    if (pathname === "/events" && method === "GET") {
        const code = parsedUrl.query.room;
        const playerId = parsedUrl.query.player;
        const room = rooms.get(code);

        if (!room) {
            res.writeHead(404);
            res.end();
            return;
        }

        const player = room.players.find((p) => p.id === playerId);
        if (!player) {
            res.writeHead(403);
            res.end();
            return;
        }

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        });

        player.res = res;

        res.write(`data: ${JSON.stringify({ type: "connected", color: player.color })}\n\n`);

        if (room.players.length === 1) {
            res.write(`data: ${JSON.stringify({ type: "waiting" })}\n\n`);
        } else if (room.players.length === 2) {
            res.write(`data: ${JSON.stringify({ type: "started", currentPlayer: 1, boardSize: room.boardSize })}\n\n`);
        }

        req.on("close", () => {
            player.res = null;
            const otherPlayer = room.players.find((p) => p.id !== playerId);
            if (otherPlayer) {
                broadcast(room, { type: "opponentLeft" });
            }
            cleanupRoom(room);
        });

        return;
    }

    if (pathname === "/move" && method === "POST") {
        parseBody(req, (body) => {
            if (!body) {
                res.writeHead(400);
                res.end();
                return;
            }

            const { code, playerId, row, col } = body;
            const room = rooms.get(code);

            if (!room) {
                res.writeHead(404);
                res.end();
                return;
            }

            const player = room.players.find((p) => p.id === playerId);
            if (!player) {
                res.writeHead(403);
                res.end();
                return;
            }

            if (!isLegalMove(room, row, col, player.color)) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "非法落子" }));
                return;
            }

            room.board[row][col] = player.color;
            room.moveHistory.push({ row, col, player: player.color });
            room.currentPlayer = player.color === 1 ? 2 : 1;

            broadcast(room, { type: "move", row, col, player: player.color, currentPlayer: room.currentPlayer });
            checkGameEnd(room);

            res.writeHead(200);
            res.end();
        });
        return;
    }

    if (pathname === "/leave-room" && method === "POST") {
        parseBody(req, (body) => {
            const { code, playerId } = body || {};
            const room = rooms.get(code);
            if (room) {
                broadcast(room, { type: "opponentLeft" });
                cleanupRoom(room);
            }
            playerConnections.delete(playerId);
            res.writeHead(200);
            res.end();
        });
        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

server.listen(PORT, () => {
    console.log(`在线对战服务器已启动: http://localhost:${PORT}`);
});
