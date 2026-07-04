const http = require("http");
const fs = require("fs");
const path = require("path");

const DEFAULT_PORT = 3000;
const ROOM_CODE_LENGTH = 6;

const rooms = new Map();

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
        hostId: null,
        board: createBoard(boardSize),
        currentPlayer: 1,
        gameOver: false,
        winner: null,
        moveHistory: [],
        rematchVotes: new Set(),
        pendingBoardSize: null,
        boardSizeVotes: new Set(),
        boardSizeProposalBy: null,
        pendingRestart: false,
        restartVotes: new Set(),
        restartProposalBy: null,
        pendingUndo: false,
        undoVotes: new Set(),
        undoProposalBy: null,
        phase: 'waiting'
    };

    rooms.set(code, room);
    return room;
}

function resetRoom(room) {
    room.board = createBoard(room.boardSize);
    room.currentPlayer = 1;
    room.gameOver = false;
    room.winner = null;
    room.moveHistory = [];
    room.rematchVotes.clear();
    room.pendingBoardSize = null;
    room.boardSizeVotes.clear();
    room.boardSizeProposalBy = null;
    room.pendingRestart = false;
    room.restartVotes.clear();
    room.restartProposalBy = null;
    room.pendingUndo = false;
    room.undoVotes.clear();
    room.undoProposalBy = null;
    
    // ----- 新增：重置颜色选择阶段 -----
    room.phase = 'color_selection';
    room.players.forEach(p => {
        p.color = null;
        p.selectedColor = null;
    });
}

function undoLastMove(room) {
    if (room.moveHistory.length === 0) return;

    const lastMove = room.moveHistory.pop();
    room.board[lastMove.row][lastMove.col] = 0;
    room.currentPlayer = lastMove.player;
    room.gameOver = false;
    room.winner = null;
}

function getRoomState(room, playerId) {
    const player = room.players.find((entry) => entry.id === playerId);
    const status = room.players.length < 2 ? "waiting" : (room.gameOver ? "finished" : "playing");

    return {
        code: room.code,
        boardSize: room.boardSize,
        board: room.board,
        currentPlayer: room.currentPlayer,
        gameOver: room.gameOver,
        winner: room.winner,
        moveHistory: room.moveHistory,
        players: room.players.map((entry) => ({ id: entry.id, color: entry.color, selectedColor: entry.selectedColor })),
        hostId: room.hostId,
        myColor: player ? player.color : null,
        status: room.phase,
        phase: room.phase,
        rematchVotes: Array.from(room.rematchVotes),
        pendingBoardSize: room.pendingBoardSize,
        boardSizeVotes: Array.from(room.boardSizeVotes),
        boardSizeProposalBy: room.boardSizeProposalBy,
        pendingRestart: room.pendingRestart,
        restartVotes: Array.from(room.restartVotes),
        restartProposalBy: room.restartProposalBy,
        pendingUndo: room.pendingUndo,
        undoVotes: Array.from(room.undoVotes),
        undoProposalBy: room.undoProposalBy
    };
}

function isLegalMove(room, row, col, player) {
    if (room.gameOver) return false;
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
    const winner = hasLegalMove(room, opponent) ? opponent : 0;
    room.gameOver = true;
    room.winner = winner;
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

function startServer(port) {
    const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;
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
            const player = { id: playerId, color: null, selectedColor: null };

            room.players.push(player);
            if (room.players.length === 1) {
                room.hostId = playerId;   // 第一个玩家为房主
            }
            if (room.players.length === 2) {
                room.phase = 'color_selection';
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                playerId,
                color: null,
                boardSize: room.boardSize,
                phase: room.phase
            }));
        });
        return;
    }

    if (pathname === "/choose-color" && method === "POST") {
        parseBody(req, (body) => {
            const { code, playerId, color } = body;
            const room = rooms.get(code);
            if (!room) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "房间不存在" }));
                return;
            }
            if (room.phase !== 'color_selection') {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "当前不在颜色选择阶段" }));
                return;
            }
            const player = room.players.find(p => p.id === playerId);
            if (!player) {
                res.writeHead(403, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "未授权" }));
                return;
            }
            if (color !== 1 && color !== 2) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "非法颜色" }));
                return;
            }
            const other = room.players.find(p => p.id !== playerId);
            if (other && other.selectedColor === color) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "该颜色已被对方选择" }));
                return;
            }
            player.selectedColor = color;

            // 检查双方是否都选好
            const allSelected = room.players.every(p => p.selectedColor !== null);
            if (allSelected) {
                room.players.forEach(p => p.color = p.selectedColor);
                // 重置棋盘（保留玩家列表和颜色）
                room.board = createBoard(room.boardSize);
                room.currentPlayer = 1;
                room.gameOver = false;
                room.winner = null;
                room.moveHistory = [];
                room.rematchVotes.clear();
                room.pendingBoardSize = null;
                room.boardSizeVotes.clear();
                room.boardSizeProposalBy = null;
                room.pendingRestart = false;
                room.restartVotes.clear();
                room.restartProposalBy = null;
                room.pendingUndo = false;
                room.undoVotes.clear();
                room.undoProposalBy = null;
                room.phase = 'playing';
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, state: getRoomState(room, playerId) }));
        });
        return;
    }

    if (pathname === "/room-state" && method === "GET") {
        const code = requestUrl.searchParams.get("room");
        const playerId = requestUrl.searchParams.get("player");
        const room = rooms.get(code);

        if (!room) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "房间不存在" }));
            return;
        }

        const player = room.players.find((entry) => entry.id === playerId);
        if (!player) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "未授权" }));
            return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(getRoomState(room, playerId)));
        return;
    }

    if (pathname === "/move" && method === "POST") {
        parseBody(req, (body) => {
            if (!body) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "缺少参数" }));
                return;
            }

            const { code, playerId, row, col } = body;
            const room = rooms.get(code);

            if (!room) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "房间不存在" }));
                return;
            }

            const player = room.players.find((entry) => entry.id === playerId);
            if (!player) {
                res.writeHead(403, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "未授权" }));
                return;
            }

            if (room.currentPlayer !== player.color) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "请等待对手落子！" }));
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
            checkGameEnd(room);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, state: getRoomState(room, playerId) }));
        });
        return;
    }

    if (pathname === "/rematch" && method === "POST") {
        parseBody(req, (body) => {
            if (!body) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "缺少参数" }));
                return;
            }

            const { code, playerId } = body;
            const room = rooms.get(code);

            if (!room) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "房间不存在" }));
                return;
            }

            const player = room.players.find((entry) => entry.id === playerId);
            if (!player) {
                res.writeHead(403, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "未授权" }));
                return;
            }

            room.rematchVotes.add(playerId);

            if (room.rematchVotes.size >= 2) {
                resetRoom(room);
                room.rematchVotes.clear();
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, state: getRoomState(room, playerId) }));
        });
        return;
    }

    if (pathname === "/change-board-size" && method === "POST") {
        parseBody(req, (body) => {
            if (!body) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "缺少参数" }));
                return;
            }

            const { code, playerId, boardSize, action } = body;
            const room = rooms.get(code);

            if (!room) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "房间不存在" }));
                return;
            }

            const player = room.players.find((entry) => entry.id === playerId);
            if (!player) {
                res.writeHead(403, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "未授权" }));
                return;
            }

            const validSizes = [6, 8, 10, 12];
            const newSize = Number(boardSize);
            if (!validSizes.includes(newSize)) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "非法棋盘大小" }));
                return;
            }

            if (action === "approve") {
                if (room.pendingBoardSize === null || room.pendingBoardSize === undefined) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "当前没有待确认的棋盘大小" }));
                    return;
                }

                room.boardSize = room.pendingBoardSize;
                resetRoom(room);
            } else if (action === "reject") {
                room.pendingBoardSize = null;
                room.boardSizeProposalBy = null;
                room.boardSizeVotes.clear();
            } else {
                if (room.pendingBoardSize !== newSize) {
                    room.pendingBoardSize = newSize;
                    room.boardSizeProposalBy = playerId;
                    room.boardSizeVotes.clear();
                }

                room.boardSizeVotes.add(playerId);
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, state: getRoomState(room, playerId) }));
        });
        return;
    }

    if (pathname === "/cancel-board-size-change" && method === "POST") {
        parseBody(req, (body) => {
            if (!body) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "缺少参数" }));
                return;
            }

            const { code, playerId } = body;
            const room = rooms.get(code);

            if (!room) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "房间不存在" }));
                return;
            }

            const player = room.players.find((entry) => entry.id === playerId);
            if (!player) {
                res.writeHead(403, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "未授权" }));
                return;
            }

            room.pendingBoardSize = null;
            room.boardSizeVotes.clear();
            room.boardSizeProposalBy = null;

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, state: getRoomState(room, playerId) }));
        });
        return;
    }

    if (pathname === "/restart" && method === "POST") {
        parseBody(req, (body) => {
            if (!body) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "缺少参数" }));
                return;
            }

            const { code, playerId, action } = body;
            const room = rooms.get(code);

            if (!room) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "房间不存在" }));
                return;
            }

            const player = room.players.find((entry) => entry.id === playerId);
            if (!player) {
                res.writeHead(403, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "未授权" }));
                return;
            }

            if (action === "approve") {
                if (!room.pendingRestart) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "当前没有待确认的重开请求" }));
                    return;
                }

                resetRoom(room);
            } else if (action === "reject") {
                room.pendingRestart = false;
                room.restartVotes.clear();
                room.restartProposalBy = null;
            } else {
                if (!room.pendingRestart) {
                    room.pendingRestart = true;
                    room.restartProposalBy = playerId;
                    room.restartVotes.clear();
                }

                room.restartVotes.add(playerId);

                if (room.restartVotes.size >= 2) {
                    resetRoom(room);
                }
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, state: getRoomState(room, playerId) }));
        });
        return;
    }

    if (pathname === "/undo" && method === "POST") {
        parseBody(req, (body) => {
            if (!body) {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "缺少参数" }));
                return;
            }

            const { code, playerId, action } = body;
            const room = rooms.get(code);

            if (!room) {
                res.writeHead(404, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "房间不存在" }));
                return;
            }

            const player = room.players.find((entry) => entry.id === playerId);
            if (!player) {
                res.writeHead(403, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "未授权" }));
                return;
            }

            if (action === "approve") {
                if (!room.pendingUndo) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "当前没有待确认的悔棋请求" }));
                    return;
                }

                undoLastMove(room);
                room.pendingUndo = false;
                room.undoVotes.clear();
                room.undoProposalBy = null;
            } else if (action === "reject") {
                room.pendingUndo = false;
                room.undoVotes.clear();
                room.undoProposalBy = null;
            } else {
                if (room.moveHistory.length === 0) {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "没有可悔的棋子" }));
                    return;
                }

                const lastMove = room.moveHistory[room.moveHistory.length - 1];
                if (lastMove.player !== player.color) {
                    res.writeHead(403, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "只有最后落子的一方可以发起悔棋" }));
                    return;
                }
                
                if (!room.pendingUndo) {
                    room.pendingUndo = true;
                    room.undoProposalBy = playerId;
                    room.undoVotes.clear();
                }

                room.undoVotes.add(playerId);

                if (room.undoVotes.size >= 2) {
                    undoLastMove(room);
                    room.pendingUndo = false;
                    room.undoVotes.clear();
                    room.undoProposalBy = null;
                }
            }

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true, state: getRoomState(room, playerId) }));
        });
        return;
    }

    if (pathname === "/leave-room" && method === "POST") {
        parseBody(req, (body) => {
            const { code, playerId } = body || {};
            const room = rooms.get(code);
            if (room) {
                const isHost = room.hostId === playerId;
                room.players = room.players.filter((entry) => entry.id !== playerId);

                if (room.players.length === 0) {
                    // 没有玩家了，直接删除房间
                    rooms.delete(room.code);
                } else if (isHost) {
                    // 房主离开，删除房间
                    rooms.delete(room.code);
                } else {
                    // 房客离开，保留房间但重置状态
                    room.phase = 'waiting';
                    room.players.forEach(p => { p.color = null; p.selectedColor = null; });
                    room.board = createBoard(room.boardSize);
                    room.currentPlayer = 1;
                    room.gameOver = false;
                    room.winner = null;
                    room.moveHistory = [];
                    room.rematchVotes.clear();
                    room.pendingBoardSize = null;
                    room.boardSizeVotes.clear();
                    room.boardSizeProposalBy = null;
                    room.pendingRestart = false;
                    room.restartVotes.clear();
                    room.restartProposalBy = null;
                    room.pendingUndo = false;
                    room.undoVotes.clear();
                    room.undoProposalBy = null;
                    // 更新房主为剩余玩家
                    room.hostId = room.players[0].id;
                }
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }

    if (pathname === "/health" && method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, port }));
        return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
    });

    server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
            const nextPort = port + 1;
            if (nextPort <= 3010) {
                console.log(`端口 ${port} 被占用，尝试 ${nextPort}`);
                startServer(nextPort);
                return;
            }
        }
        console.error(error);
        process.exit(1);
    });

    server.listen(port, () => {
        console.log(`在线对战服务器已启动: http://localhost:${port}`);
    });
}

startServer(Number(process.env.PORT || DEFAULT_PORT));
