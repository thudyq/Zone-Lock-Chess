// ==================== 常量 ====================
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIRECTIONS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
];
const NEIGHBOR_DIRECTIONS = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1]
];

const AI_DELAY_MS = 300;

const WEIGHT_MOBILITY = 2.0;
const WEIGHT_CENTER = 0.8;
const WEIGHT_GROUP = 0.5;
const WEIGHT_EDGE = 0.6;

const PLAYER_BLACK = 1;
const PLAYER_WHITE = 2;
const PLAYER_NAMES = {
    [PLAYER_BLACK]: "黑棋",
    [PLAYER_WHITE]: "白棋"
};

const DIFFICULTY_EASY = "easy";
const DIFFICULTY_MEDIUM = "medium";
const DIFFICULTY_HARD = "hard";
const DIFFICULTY_EXPERT = "expert";

const SEARCH_DEPTH_HARD = 2;
const SEARCH_DEPTH_EXPERT = 3;
const ROOM_CODE_LENGTH = 6;

// ==================== DOM 元素引用 ====================
const boardDiv = document.getElementById("board");
const columnLabelsDiv = document.getElementById("columnLabels");
const rowLabelsDiv = document.getElementById("rowLabels");
const turnText = document.getElementById("turnText");
const moveCountText = document.getElementById("moveCountText");
const evaluationText = document.getElementById("evaluationText");
const historyList = document.getElementById("historyList");
const overlay = document.getElementById("overlay");
const resultText = document.getElementById("resultText");

const boardSizeSelect = document.getElementById("boardSize");
const gameModeSelect = document.getElementById("gameMode");
const playerColorSelect = document.getElementById("playerColorSelect");
const aiDifficultySelect = document.getElementById("aiDifficulty");
const aiDifficultyLabel = document.getElementById("aiDifficultyLabel");
const restartBtn = document.getElementById("restartBtn");
const undoBtn = document.getElementById("undoBtn");
const playAgainBtn = document.getElementById("playAgainBtn");
const exportResultBtn = document.getElementById("exportResultBtn");
const themeToggle = document.getElementById("themeToggle");

const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const replayPanel = document.getElementById("replayPanel");
const replayFirstBtn = document.getElementById("replayFirst");
const replayPrevBtn = document.getElementById("replayPrev");
const replayPlayPauseBtn = document.getElementById("replayPlayPause");
const replayNextBtn = document.getElementById("replayNext");
const replayLastBtn = document.getElementById("replayLast");
const replaySpeedSelect = document.getElementById("replaySpeedSelect");
const resumeGameBtn = document.getElementById("resumeGameBtn");

const onlinePanel = document.getElementById("onlinePanel");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const roomCodeInput = document.getElementById("roomCodeInput");
const serverUrlInput = document.getElementById("serverUrlInput");
const applyServerUrlBtn = document.getElementById("applyServerUrlBtn");
const onlineStatus = document.getElementById("onlineStatus");
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const chooseBlackBtn = document.getElementById("chooseBlackBtn");
const chooseWhiteBtn = document.getElementById("chooseWhiteBtn");
const colorStatus = document.getElementById("colorStatus");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const confirmModal = document.getElementById("confirmModal");
const confirmTitle = document.getElementById("confirmTitle");
const confirmMessage = document.getElementById("confirmMessage");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");
const confirmOkBtn = document.getElementById("confirmOkBtn");

// ==================== 游戏状态 ====================
let boardSize = 8;
let board = [];
let currentPlayer = PLAYER_BLACK;
let gameOver = false;
let moveHistory = [];
let userColor = PLAYER_BLACK;
let aiColor = PLAYER_WHITE;
let aiThinking = false;
let aiTimer = null;
let previousBoardSize = boardSizeSelect.value;
let previousGameMode = gameModeSelect.value;
let previousAiDifficulty = aiDifficultySelect.value;

let isUpdatingBoardSize = false;
let isUpdatingGameMode = false;
let isUpdatingAiDifficulty = false;

let isReplayMode = false;
let replayIndex = 0;
let isReplayPlaying = false;
let replayTimer = null;

let lastPlacedPosition = null;

let isOnlineMode = false;
let onlineColor = null;
let onlinePhase = "waiting";
let hasNotifiedLeave = false;
let hasNotifiedNetworkError = false;
let onlineRoomCode = null;
let onlinePlayerId = null;
let onlinePollingTimer = null;
let isOnlineMyTurn = false;
let lastPromptedPendingBoardSize = null;
let boardSizePromptResolver = null;
let lastPromptedPendingRestart = false;
let restartPromptResolver = null;
let lastPromptedPendingUndo = false;
let undoPromptResolver = null;

const DEFAULT_SERVER_URL = "http://localhost:3000";
const SERVER_URL_STORAGE_KEY = "boardGameServerUrl";
let serverUrl = DEFAULT_SERVER_URL;

function normalizeServerUrl(url) {
    const value = (url || "").trim();
    if (!value) {
        return DEFAULT_SERVER_URL;
    }
    return value.replace(/\/$/, "");
}

async function probeServerUrl(candidateUrl) {
    try {
        const response = await fetch(`${candidateUrl}/health`, { method: "GET" });
        if (response.ok) {
            const data = await response.json();
            if (data && data.ok) {
                return candidateUrl;
            }
        }
    } catch (error) {
        // ignore
    }
    return null;
}

async function autoDetectServerUrl() {
    const candidates = [];
    const HOST_CANDIDATES = [window.location.hostname, "localhost", "127.0.0.1"];
    const PORTS = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010];

    const seen = new Set();
    for (const host of HOST_CANDIDATES) {
        for (const port of PORTS) {
            const candidate = `http://${host}:${port}`;
            if (!seen.has(candidate)) {
                candidates.push(candidate);
                seen.add(candidate);
            }
        }
    }

    if (window.location.origin && window.location.origin.startsWith("http")) {
        candidates.unshift(window.location.origin);
    }

    for (const candidate of candidates) {
        const found = await probeServerUrl(candidate);
        if (found) {
            return found;
        }
    }

    return normalizeServerUrl(DEFAULT_SERVER_URL);
}

function getConfiguredServerUrl() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("server");
    if (fromQuery) {
        return normalizeServerUrl(fromQuery);
    }

    const stored = localStorage.getItem(SERVER_URL_STORAGE_KEY);
    if (stored) {
        return normalizeServerUrl(stored);
    }

    const currentOrigin = window.location.origin;
    if (currentOrigin && (currentOrigin.includes("localhost") || currentOrigin.includes("127.0.0.1"))) {
        const parsed = new URL(currentOrigin);
        if (parsed.port === "3000") {
            return parsed.origin;
        }
    }

    return DEFAULT_SERVER_URL;
}

function applyServerUrl() {
    serverUrl = normalizeServerUrl(serverUrlInput.value);
    localStorage.setItem(SERVER_URL_STORAGE_KEY, serverUrl);
    serverUrlInput.value = serverUrl;
    onlineStatus.textContent = `后端地址已切换为 ${serverUrl}`;
}

// ==================== 事件监听 ====================
restartBtn.addEventListener("click", () => {
    if (isOnlineMode) {
        if (!onlineRoomCode || !onlinePlayerId) {
            alert("请先创建或加入房间");
            return;
        }

        const message = "在线对战中重新开始需要双方确认。\n你提议重新开始当前棋局，是否发送请求？";
        if (confirm(message)) {
            sendRestartRequest();
        }
        return;
    }

    const message = "重新开始游戏将清空当前棋局，是否继续？";
    if (confirm(message)) {
        if (gameModeSelect.value === "ai") {
            playerColorSelect.value = String(PLAYER_BLACK);
        }
        initializeGame();
    }
});

boardSizeSelect.addEventListener("change", () => {
    if (isUpdatingBoardSize) return;

    if (isOnlineMode) {
        if (!onlineRoomCode || !onlinePlayerId) {
            alert("请先创建或加入房间");
            isUpdatingBoardSize = true;
            boardSizeSelect.value = previousBoardSize;
            isUpdatingBoardSize = false;
            return;
        }

        const newSize = Number(boardSizeSelect.value);
        const message = `在线对战中修改棋盘大小需要双方确认。\n你提议将棋盘大小改为 ${newSize}×${newSize}，是否发送请求？`;
        if (confirm(message)) {
            previousBoardSize = boardSizeSelect.value;
            sendChangeBoardSizeRequest(newSize);
        } else {
            isUpdatingBoardSize = true;
            boardSizeSelect.value = previousBoardSize;
            isUpdatingBoardSize = false;
        }
        return;
    }

    const message = "修改棋盘大小将重新开始游戏，是否继续？";
    if (confirm(message)) {
        if (gameModeSelect.value === "ai") {
            playerColorSelect.value = String(PLAYER_BLACK);
        }
        previousBoardSize = boardSizeSelect.value;
        initializeGame();
    } else {
        isUpdatingBoardSize = true;
        boardSizeSelect.value = previousBoardSize;
        isUpdatingBoardSize = false;
    }
});

gameModeSelect.addEventListener("change", () => {
    if (isUpdatingGameMode) return;
    const message = "切换游戏模式将重新开始游戏，是否继续？";
    if (confirm(message)) {
        if (gameModeSelect.value === "ai") {
            playerColorSelect.value = String(PLAYER_BLACK);
        }
        previousGameMode = gameModeSelect.value;
        initializeGame();
    } else {
        isUpdatingGameMode = true;
        gameModeSelect.value = previousGameMode;
        isUpdatingGameMode = false;
        updateModeSpecificUI();
    }
});

aiDifficultySelect.addEventListener("change", () => {
    if (isUpdatingAiDifficulty) return;
    const message = "切换 AI 难度将改变后续 AI 的落子策略，是否继续？";
    if (confirm(message)) {
        previousAiDifficulty = aiDifficultySelect.value;
        saveGameState();
    } else {
        isUpdatingAiDifficulty = true;
        aiDifficultySelect.value = previousAiDifficulty;
        isUpdatingAiDifficulty = false;
    }
});

undoBtn.addEventListener("click", () => {
    if (isOnlineMode) {
        if (!onlineRoomCode || !onlinePlayerId) {
            alert("请先创建或加入房间");
            return;
        }

        if (moveHistory.length === 0) {
            alert("没有可悔的棋子");
            return;
        }

        const lastMove = moveHistory[moveHistory.length - 1];
        if (lastMove.player !== onlineColor) {
            alert("只有最后落子的一方可以发起悔棋");
            return;
        }

        const message = "在线对战中悔棋需要双方确认。\n你提议悔掉上一步，是否发送请求？";
        if (confirm(message)) {
            sendUndoRequest();
        }
        return;
    }

    undoMove();
});

playAgainBtn.addEventListener("click", () => {
    if (isOnlineMode) {
        sendRematchRequest();
        return;
    }

    overlay.classList.add("hidden");
    if (gameModeSelect.value === "ai") {
        playerColorSelect.value = String(PLAYER_BLACK);
    }
    initializeGame();
});

exportResultBtn.addEventListener("click", exportRecord);
themeToggle.addEventListener("click", toggleTheme);

exportBtn.addEventListener("click", exportRecord);
importBtn.addEventListener("click", () => {
    if (isOnlineMode) {
        alert("在线对战模式下不能导入棋谱");
        return;
    }
    importFile.click();
});
importFile.addEventListener("change", importRecord);

replayFirstBtn.addEventListener("click", replayFirst);
replayPrevBtn.addEventListener("click", replayPrev);
replayPlayPauseBtn.addEventListener("click", toggleReplayPlay);
replayNextBtn.addEventListener("click", replayNext);
replayLastBtn.addEventListener("click", replayLast);
replaySpeedSelect.addEventListener("change", handleReplaySpeedChange);
resumeGameBtn.addEventListener("click", resumeGameFromReplay);

createRoomBtn.addEventListener("click", createRoom);
roomCodeDisplay.addEventListener("click", async () => {
    const rawText = roomCodeDisplay.textContent || "";
    const match = rawText.match(/[A-Z0-9]{6}/);
    if (match) {
        const code = match[0];
        try {
            await navigator.clipboard.writeText(code);
            const originalText = roomCodeDisplay.textContent;
            roomCodeDisplay.textContent = "✅ 已复制！";
            setTimeout(() => {
                roomCodeDisplay.textContent = originalText;
            }, 1500);
        } catch (err) {
            // 降级方案：使用 input 临时复制
            const input = document.createElement("input");
            input.value = code;
            document.body.appendChild(input);
            input.select();
            document.execCommand("copy");
            document.body.removeChild(input);
            alert("房间号已复制到剪贴板");
        }
    }
});
joinRoomBtn.addEventListener("click", joinRoom);
playerColorSelect.addEventListener("change", () => {
    if (gameModeSelect.value !== "ai") {
        playerColorSelect.value = userColor;
        return;
    }
    const newColor = Number(playerColorSelect.value);
    if (newColor === userColor) return;
    const message = "切换执子颜色将重新开始游戏，是否继续？";
    if (confirm(message)) {
        initializeGame();
    } else {
        playerColorSelect.value = userColor;
    }
});
leaveRoomBtn.addEventListener("click", async () => {
    if (isOnlineMode && onlineRoomCode) {
        const result = await showConfirmDialog("确定要离开当前房间吗？");
        if (result === "confirm") {
            leaveRoom();
        }
    } else {
        leaveRoom();
    }
});
applyServerUrlBtn.addEventListener("click", applyServerUrl);
roomCodeInput.addEventListener("input", () => {
    roomCodeInput.value = roomCodeInput.value.toUpperCase();
});
serverUrlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        applyServerUrl();
    }
});

// ==================== 游戏初始化与重置 ====================
function initializeGame() {
    stopAiTimer();
    stopReplayTimer();
    exitReplayMode();

    moveHistory = [];
    gameOver = false;
    aiThinking = false;
    currentPlayer = PLAYER_BLACK;
    boardSize = Number(boardSizeSelect.value);
    lastPlacedPosition = null;
    isOnlineMyTurn = false;
    lastPromptedPendingBoardSize = null;
    boardSizePromptResolver = null;
    lastPromptedPendingRestart = false;
    restartPromptResolver = null;
    lastPromptedPendingUndo = false;
    undoPromptResolver = null;
    hasNotifiedNetworkError = false;

    previousBoardSize = boardSizeSelect.value;
    previousGameMode = gameModeSelect.value;
    previousAiDifficulty = aiDifficultySelect.value;

    board = createEmptyBoard(boardSize);

    if (gameModeSelect.value === "ai") {
        userColor = playerColorSelect ? Number(playerColorSelect.value) : PLAYER_BLACK;
        aiColor = getOpponent(userColor);
    } else {
        userColor = PLAYER_BLACK;
        aiColor = PLAYER_WHITE;
    }

    updateModeSpecificUI();
    renderBoard();
    updateTurnText();
    updateEvaluation();
    updateHistoryList();
    updateReplayControls();
    overlay.classList.add("hidden");
    saveGameState();

    if (gameModeSelect.value === "ai" && userColor === PLAYER_WHITE) {
        setTimeout(() => {
            triggerAiIfNeeded();
        }, 300);
    }
}

function resetToIdleState() {
    board = createEmptyBoard(boardSize);
    moveHistory = [];
    currentPlayer = PLAYER_BLACK;
    gameOver = false;
    lastPlacedPosition = null;
    stopAiTimer();
    if (isReplayMode) {
        exitReplayMode();
    }
    overlay.classList.add("hidden");
    renderBoard();
    updateTurnText();
    updateEvaluation();
    updateHistoryList();
    clearSavedGameState();
}

function createEmptyBoard(size) {
    const newBoard = [];
    for (let row = 0; row < size; row++) {
        newBoard[row] = [];
        for (let col = 0; col < size; col++) {
            newBoard[row][col] = 0;
        }
    }
    return newBoard;
}

function saveGameState() {
    const state = {
        version: "1.0",
        boardSize: boardSize,
        moves: moveHistory.map((move) => ({ ...move })),
        currentPlayer: currentPlayer,
        gameOver: gameOver,
        gameMode: gameModeSelect.value,
        aiDifficulty: aiDifficultySelect.value
    };

    try {
        localStorage.setItem("boardGameState", JSON.stringify(state));
    } catch (error) {
        // localStorage 不可用时不影响游戏
    }
}

function loadGameState() {
    try {
        const saved = localStorage.getItem("boardGameState");
        if (!saved) return false;

        const state = JSON.parse(saved);
        if (!state || typeof state.boardSize !== "number") return false;

        boardSize = state.boardSize;
        boardSizeSelect.value = String(boardSize);
        moveHistory = (state.moves || []).map((move) => ({ ...move }));
        currentPlayer = state.currentPlayer || PLAYER_BLACK;
        gameOver = state.gameOver || false;
        gameModeSelect.value = state.gameMode || "pvp";
        aiDifficultySelect.value = state.aiDifficulty || "medium";

        // 同步 previous 值，确保后续取消操作能正确恢复
        previousBoardSize = boardSizeSelect.value;
        previousGameMode = gameModeSelect.value;
        previousAiDifficulty = aiDifficultySelect.value;

        board = createEmptyBoard(boardSize);
        for (const move of moveHistory) {
            if (isInsideBoard(move.row, move.col)) {
                board[move.row][move.col] = move.player;
            }
        }

        renderBoard();
        updateTurnText();
        updateEvaluation();
        updateHistoryList();
        updateModeSpecificUI();
        updateReplayControls();

        if (gameOver) {
            const opponent = getOpponent(currentPlayer);
            if (hasLegalMove(opponent)) {
                showResult(`${PLAYER_NAMES[opponent]}获胜！`);
            } else {
                showResult("平局！");
            }
        }

        return true;
    } catch (error) {
        return false;
    }
}

function clearSavedGameState() {
    try {
        localStorage.removeItem("boardGameState");
    } catch (error) {
        // ignore
    }
}

function updateModeSpecificUI() {
    const mode = gameModeSelect.value;
    isOnlineMode = mode === "online";

    const isAiMode = mode === "ai";
    aiDifficultySelect.disabled = !isAiMode;
    aiDifficultyLabel.classList.toggle("disabled", !isAiMode);
    playerColorSelect.disabled = !isAiMode;

    const playerColorDiv = document.getElementById("playerColorSelection");
    if (playerColorDiv) {
        playerColorDiv.style.display = isAiMode ? "" : "none";
    }

    if (isOnlineMode) {
        onlinePanel.classList.remove("hidden");
        importBtn.disabled = true;
        importBtn.title = "在线对战模式下不能导入棋谱";
    } else {
        onlinePanel.classList.add("hidden");
        if (onlineRoomCode) {
            leaveRoom();
        }
        importBtn.disabled = false;
        importBtn.title = "";
    }
}

function applyTheme(theme) {
    if (theme === "dark") {
        document.body.classList.add("dark");
        themeToggle.textContent = "☀";
    } else {
        document.body.classList.remove("dark");
        themeToggle.textContent = "🌙";
    }
}

function toggleTheme() {
    const isDark = document.body.classList.contains("dark");
    const newTheme = isDark ? "light" : "dark";
    applyTheme(newTheme);
    localStorage.setItem("boardGameTheme", newTheme);
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem("boardGameTheme") || "light";
    applyTheme(savedTheme);
}

// ==================== 棋盘渲染 ====================
function renderBoard() {
    document.documentElement.style.setProperty("--board-size", boardSize);

    boardDiv.innerHTML = "";
    columnLabelsDiv.innerHTML = "";
    rowLabelsDiv.innerHTML = "";

    renderColumnLabels();
    renderRowLabels();

    boardDiv.style.gridTemplateColumns = `repeat(${boardSize}, var(--cell-size))`;

    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            const cell = createCell(row, col);
            boardDiv.appendChild(cell);
        }
    }
    lastPlacedPosition = null;
    setTimeout(() => {
        const firstCell = document.querySelector(".cell");
        if (firstCell) {
            const cellWidth = firstCell.offsetWidth;
            document.documentElement.style.setProperty("--cell-font-size", cellWidth * 0.3 + "px");
        }
    }, 20);
}

function renderColumnLabels() {
    for (let col = 0; col < boardSize; col++) {
        const label = document.createElement("div");
        label.classList.add("coord-label");
        label.textContent = LETTERS[col];
        columnLabelsDiv.appendChild(label);
    }
}

function renderRowLabels() {
    for (let row = 0; row < boardSize; row++) {
        const label = document.createElement("div");
        label.classList.add("coord-label");
        label.textContent = row + 1;
        rowLabelsDiv.appendChild(label);
    }
}

function getDisplayPlayerForBoard() {
    if (isOnlineMode) {
        return onlineColor !== null ? onlineColor : currentPlayer;
    }
    return currentPlayer;
}

function createCell(row, col) {
    const cell = document.createElement("div");
    cell.classList.add("cell");

    const displayPlayer = getDisplayPlayerForBoard();
    const isLegalMove = !gameOver && displayPlayer !== null && isLegal(row, col, displayPlayer);
    if (isLegalMove) {
        cell.classList.add("legal-move");
        addHoverPreview(cell, displayPlayer);
    }

    cell.addEventListener("click", () => handleMove(row, col));

    const pieceOwner = board[row][col];
    if (pieceOwner !== 0) {
        cell.appendChild(createPiece(pieceOwner, row, col));
    }

    return cell;
}

function addHoverPreview(cell, displayPlayer) {
    if (!displayPlayer) return;

    const previewClass = displayPlayer === PLAYER_BLACK ? "preview-black" : "preview-white";

    cell.addEventListener("mouseenter", () => {
        cell.classList.add(previewClass);
    });

    cell.addEventListener("mouseleave", () => {
        cell.classList.remove(previewClass);
    });
}

function createPiece(player, row, col) {
    const piece = document.createElement("div");
    piece.classList.add("piece");
    piece.classList.add(player === PLAYER_BLACK ? "piece-black" : "piece-white");

    if (lastPlacedPosition && lastPlacedPosition.row === row && lastPlacedPosition.col === col) {
        piece.classList.add("piece-placed");
    }

    return piece;
}

// ==================== 核心游戏逻辑 ====================
function handleMove(row, col) {
    if (aiThinking || gameOver) return;

    if (isOnlineMode && onlinePhase === "color_selection") {
        alert("请先选择棋子颜色！");
        return;
    }

    const actingPlayer = isOnlineMode ? onlineColor : currentPlayer;
    if (!actingPlayer || !isLegal(row, col, actingPlayer)) {
        return;
    }

    if (isOnlineMode) {
        if (!isOnlineMyTurn) {
            alert("请等待对手落子！");
            return;
        }
        sendOnlineMove(row, col);
        return;
    }

    placePiece(row, col, currentPlayer);
    currentPlayer = getOpponent(currentPlayer);

    renderBoard();
    updateTurnText();
    updateEvaluation();
    updateHistoryList();

    checkGameEnd();
    triggerAiIfNeeded();
    saveGameState();
}

function placePiece(row, col, player) {
    moveHistory.push({ row, col, player });
    board[row][col] = player;
    lastPlacedPosition = { row, col };
}

function getOpponent(player) {
    return player === PLAYER_BLACK ? PLAYER_WHITE : PLAYER_BLACK;
}

function isLegal(row, col, player) {
    if (board[row][col] !== 0) return false;

    const opponent = getOpponent(player);

    for (const [deltaRow, deltaCol] of DIRECTIONS) {
        const neighborRow = row + deltaRow;
        const neighborCol = col + deltaCol;

        if (isInsideBoard(neighborRow, neighborCol)) {
            if (board[neighborRow][neighborCol] === opponent) {
                return false;
            }
        }
    }

    return true;
}

function isInsideBoard(row, col) {
    return row >= 0 && row < boardSize && col >= 0 && col < boardSize;
}

function hasLegalMove(player) {
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            if (isLegal(row, col, player)) {
                return true;
            }
        }
    }
    return false;
}

function countLegalMoves(player) {
    let count = 0;
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            if (isLegal(row, col, player)) {
                count++;
            }
        }
    }
    return count;
}

function getLegalMoves(player) {
    const moves = [];
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            if (isLegal(row, col, player)) {
                moves.push({ row, col });
            }
        }
    }
    return moves;
}

function checkGameEnd() {
    if (hasLegalMove(currentPlayer)) return;

    const opponent = getOpponent(currentPlayer);
    const opponentCanMove = hasLegalMove(opponent);

    gameOver = true;

    if (opponentCanMove) {
        const winnerName = PLAYER_NAMES[opponent];
        turnText.textContent = `游戏结束：${winnerName}获胜！`;
        showResult(`${winnerName}获胜！`);
    } else {
        turnText.textContent = "游戏结束：平局！";
        showResult("平局！");
    }
}

function triggerAiIfNeeded() {
    if (gameOver || gameModeSelect.value !== "ai" || currentPlayer !== aiColor) {
        return;
    }
    aiThinking = true;
    aiTimer = setTimeout(makeAiMove, AI_DELAY_MS);
}

function stopAiTimer() {
    if (aiTimer) {
        clearTimeout(aiTimer);
        aiTimer = null;
    }
}

// ==================== 悔棋 ====================
function undoMove() {
    if (isReplayMode || moveHistory.length === 0) return;

    if (gameModeSelect.value === "ai") {
        undoAiSideMoves();
    } else {
        undoLastMove();
    }

    gameOver = false;
    renderBoard();
    updateTurnText();
    updateEvaluation();
    updateHistoryList();
    saveGameState();
}

function undoAiSideMoves() {
    const movesToUndo = Math.min(2, moveHistory.length);
    for (let i = 0; i < movesToUndo; i++) {
        const lastMove = moveHistory.pop();
        board[lastMove.row][lastMove.col] = 0;
    }
    currentPlayer = PLAYER_BLACK;
}

function undoLastMove() {
    const lastMove = moveHistory.pop();
    board[lastMove.row][lastMove.col] = 0;
    currentPlayer = lastMove.player;
}

// ==================== UI 更新 ====================
function updateTurnText() {
    if (gameOver) {
        return; // 游戏结束时不更新文本，保留结束信息
    }
    if (isReplayMode) {
        turnText.textContent = `回放中：第 ${replayIndex} / ${moveHistory.length} 步`;
        moveCountText.textContent = "";
        return;
    }

    if (isOnlineMode) {
        if (onlinePhase === "color_selection") {
            // 两人已在房间内，但尚未选择颜色
            turnText.textContent = "在线对战：已进入房间";
            moveCountText.textContent = "";
            return;
        }
        if (onlineColor === null) {
            // 如果已有房间号，说明是房主等待对手；否则是未加入状态
            if (onlineRoomCode) {
                turnText.textContent = "在线对战：等待对手加入...";
            } else {
                turnText.textContent = "在线对战：请创建房间或加入房间";
            }
            moveCountText.textContent = "";
            return;
        }

        const colorText = onlineColor === PLAYER_BLACK ? "黑棋" : "白棋";
        const playerSymbol = onlineColor === PLAYER_BLACK ? "⚫" : "⚪";
        const blackMoves = countLegalMoves(PLAYER_BLACK);
        const whiteMoves = countLegalMoves(PLAYER_WHITE);
        turnText.textContent = `你是 ${playerSymbol} ${colorText}｜${isOnlineMyTurn ? "轮到你了" : "等待对手落子"}`;
        moveCountText.textContent = `黑棋可下：${blackMoves}    |    白棋可下：${whiteMoves}`;
        return;
    } else if (gameModeSelect.value === "ai") {
        const playerSymbol = currentPlayer === PLAYER_BLACK ? "⚫" : "⚪";
        const isMyTurn = currentPlayer === userColor;
        const turnInfo = isMyTurn ? "你的回合" : "AI 思考中...";
        const colorName = currentPlayer === PLAYER_BLACK ? "黑棋" : "白棋";
        turnText.textContent = `当前玩家：${playerSymbol} ${colorName} | ${turnInfo}`;
        const blackMoves = countLegalMoves(PLAYER_BLACK);
        const whiteMoves = countLegalMoves(PLAYER_WHITE);
        moveCountText.textContent = `黑棋可下：${blackMoves}    |    白棋可下：${whiteMoves}`;
        return;
    }

    const playerSymbol = currentPlayer === PLAYER_BLACK ? "⚫" : "⚪";
    const blackMoves = countLegalMoves(PLAYER_BLACK);
    const whiteMoves = countLegalMoves(PLAYER_WHITE);

    turnText.textContent = `当前玩家：${playerSymbol} ${PLAYER_NAMES[currentPlayer]}`;
    moveCountText.textContent = `黑棋可下：${blackMoves}    |    白棋可下：${whiteMoves}`;
}

function updateEvaluation() {
    const blackMoves = countLegalMoves(PLAYER_BLACK);
    const whiteMoves = countLegalMoves(PLAYER_WHITE);
    const diff = blackMoves - whiteMoves;

    let text = "";
    if (diff > 5) {
        text = `局势评估：⚫ 黑棋优势 (+${diff})`;
    } else if (diff < -5) {
        text = `局势评估：⚪ 白棋优势 (+${-diff})`;
    } else {
        text = "局势评估：均势";
    }

    evaluationText.textContent = text;
}

function updateHistoryList() {
    historyList.innerHTML = "";

    moveHistory.forEach((move, index) => {
        const listItem = document.createElement("li");
        const playerName = move.player === PLAYER_BLACK ? "黑" : "白";
        const coordinate = LETTERS[move.col] + (move.row + 1);
        listItem.textContent = `${playerName} ${coordinate}`;

        if (isReplayMode && index === replayIndex - 1) {
            listItem.classList.add("current-replay-move");
        }

        historyList.appendChild(listItem);
    });

    if (isReplayMode && replayIndex > 0) {
        const currentItem = historyList.children[replayIndex - 1];
        if (currentItem) {
            currentItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    } else {
        historyList.scrollTo({
            top: historyList.scrollHeight,
            behavior: "smooth"
        });
    }
}

function showResult(text) {
    resultText.textContent = text;
    overlay.classList.remove("hidden");
}

// ==================== AI ====================
function makeAiMove() {
    if (gameOver || gameModeSelect.value !== "ai") {
        aiThinking = false;
        return;
    }
    const legalMoves = getLegalMoves(aiColor);
    if (legalMoves.length === 0) {
        aiThinking = false;
        return;
    }
    const difficulty = aiDifficultySelect.value;
    let bestMove;
    switch (difficulty) {
        case DIFFICULTY_EASY:
            bestMove = getRandomMove(legalMoves);
            break;
        case DIFFICULTY_HARD:
            bestMove = findBestMoveMinimax(SEARCH_DEPTH_HARD, aiColor);
            break;
        case DIFFICULTY_EXPERT:
            bestMove = findBestMoveMinimax(SEARCH_DEPTH_EXPERT, aiColor);
            break;
        case DIFFICULTY_MEDIUM:
        default:
            bestMove = findBestMove(legalMoves, aiColor);
            break;
    }
    aiThinking = false;
    if (bestMove) {
        handleMove(bestMove.row, bestMove.col);
    }
}

function getRandomMove(moves) {
    const index = Math.floor(Math.random() * moves.length);
    return moves[index];
}

function findBestMove(moves, player) {
    let bestMove = null;
    let bestScore = -Infinity;
    for (const move of moves) {
        const score = evaluateMove(move.row, move.col, player);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    return bestMove;
}

function evaluateMove(row, col, player) {
    const opponent = getOpponent(player);
    board[row][col] = player;
    const aiMoves = getLegalMoves(player).length;
    const playerMoves = getLegalMoves(opponent).length;
    board[row][col] = 0;

    const mobilityScore = aiMoves - playerMoves;
    const centerScore = getCenterScore(row, col);
    const groupScore = getGroupScore(row, col, player);

    return WEIGHT_MOBILITY * mobilityScore + WEIGHT_CENTER * centerScore + WEIGHT_GROUP * groupScore;
}

function findBestMoveMinimax(depth, player) {
    const legalMoves = getLegalMoves(player);
    if (legalMoves.length === 0) return null;
    let bestMove = legalMoves[0];
    let bestScore = -Infinity;
    const opponent = getOpponent(player);

    for (const move of legalMoves) {
        board[move.row][move.col] = player;
        const score = minimax(depth - 1, -Infinity, Infinity, false, player, opponent);
        board[move.row][move.col] = 0;
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    return bestMove;
}

function minimax(depth, alpha, beta, isMaximizingPlayer, aiPlayer, humanPlayer) {
    const currentPlayer = isMaximizingPlayer ? aiPlayer : humanPlayer;
    const legalMoves = getLegalMoves(currentPlayer);

    if (legalMoves.length === 0) {
        const opponent = getOpponent(currentPlayer);
        const opponentMoves = getLegalMoves(opponent);
        if (opponentMoves.length === 0) {
            return 0;
        }
        return isMaximizingPlayer ? -10000 : 10000;
    }

    if (depth === 0) {
        return evaluateBoard(aiPlayer);
    }

    if (isMaximizingPlayer) {
        let maxScore = -Infinity;
        for (const move of legalMoves) {
            board[move.row][move.col] = aiPlayer;
            const score = minimax(depth - 1, alpha, beta, false, aiPlayer, humanPlayer);
            board[move.row][move.col] = 0;
            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break;
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        for (const move of legalMoves) {
            board[move.row][move.col] = humanPlayer;
            const score = minimax(depth - 1, alpha, beta, true, aiPlayer, humanPlayer);
            board[move.row][move.col] = 0;
            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break;
        }
        return minScore;
    }
}

function evaluateBoard(forPlayer) {
    const opponent = getOpponent(forPlayer);
    const myMoves = countLegalMoves(forPlayer);
    const oppMoves = countLegalMoves(opponent);

    if (myMoves === 0 && oppMoves === 0) {
        return 0;
    }
    if (myMoves === 0) {
        return -10000;
    }
    if (oppMoves === 0) {
        return 10000;
    }

    const mobilityScore = myMoves - oppMoves;
    const centerScore = getBoardCenterScore(forPlayer) - getBoardCenterScore(opponent);
    const groupScore = getBoardGroupScore(forPlayer) - getBoardGroupScore(opponent);
    const edgePenalty = getEdgePenalty(forPlayer) - getEdgePenalty(opponent);

    return WEIGHT_MOBILITY * mobilityScore
        + WEIGHT_CENTER * centerScore
        + WEIGHT_GROUP * groupScore
        - WEIGHT_EDGE * edgePenalty;
}

function getCenterScore(row, col) {
    const centerRow = (boardSize - 1) / 2;
    const centerCol = (boardSize - 1) / 2;
    const maxDistance = centerRow + centerCol;
    const distance = Math.abs(row - centerRow) + Math.abs(col - centerCol);

    return maxDistance - distance;
}

function getBoardCenterScore(player) {
    let score = 0;

    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            if (board[row][col] === player) {
                score += getCenterScore(row, col);
            }
        }
    }

    return score;
}

function getGroupScore(row, col, player) {
    let friendlyCount = 0;

    for (const [deltaRow, deltaCol] of NEIGHBOR_DIRECTIONS) {
        const neighborRow = row + deltaRow;
        const neighborCol = col + deltaCol;

        if (isInsideBoard(neighborRow, neighborCol)) {
            if (board[neighborRow][neighborCol] === player) {
                friendlyCount++;
            }
        }
    }

    return friendlyCount;
}

function getBoardGroupScore(player) {
    let score = 0;

    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            if (board[row][col] === player) {
                score += getGroupScore(row, col, player);
            }
        }
    }

    return score / 2;
}

function getEdgePenalty(player) {
    let penalty = 0;
    const lastIndex = boardSize - 1;

    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            if (board[row][col] === player) {
                if (row === 0 || row === lastIndex || col === 0 || col === lastIndex) {
                    penalty += 1;
                }
                if ((row === 0 || row === lastIndex) && (col === 0 || col === lastIndex)) {
                    penalty += 2;
                }
            }
        }
    }

    return penalty;
}

// ==================== 棋谱系统 ====================
function exportRecord() {
    const record = {
        version: "1.0",
        boardSize: boardSize,
        moves: moveHistory.map((move) => ({ ...move }))
    };

    const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const secs = String(now.getSeconds()).padStart(2, "0");
    const timeStr = hours + "-" + minutes + "-" + secs;
    link.href = url;
    link.download = `棋谱_${boardSize}x${boardSize}_${dateStr}_${timeStr}.json`;
    link.style.display = "none";
    link.target = "_blank";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);
}

function importRecord(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const record = JSON.parse(e.target.result);
            if (validateRecord(record)) {
                enterReplayMode(record);
            } else {
                alert("棋谱文件格式不正确！");
            }
        } catch (error) {
            alert("无法解析棋谱文件！");
        }
        event.target.value = "";
    };
    reader.readAsText(file);
}

function validateRecord(record) {
    return (
        record &&
        record.version === "1.0" &&
        typeof record.boardSize === "number" &&
        [6, 8, 10, 12].includes(record.boardSize) &&
        Array.isArray(record.moves) &&
        record.moves.every(
            (move) =>
                typeof move.row === "number" &&
                typeof move.col === "number" &&
                typeof move.player === "number" &&
                move.row >= 0 &&
                move.row < record.boardSize &&
                move.col >= 0 &&
                move.col < record.boardSize &&
                (move.player === PLAYER_BLACK || move.player === PLAYER_WHITE)
        )
    );
}

function enterReplayMode(record) {
    stopAiTimer();
    stopReplayTimer();

    isReplayMode = true;
    isReplayPlaying = false;
    replayIndex = 0;

    boardSize = record.boardSize;
    boardSizeSelect.value = String(boardSize);
    moveHistory = record.moves.map((move) => ({ ...move }));

    applyReplayIndex(0);
    updateReplayControls();
}

function exitReplayMode() {
    if (!isReplayMode) return;

    isReplayMode = false;
    isReplayPlaying = false;
    stopReplayTimer();

    applyReplayIndex(moveHistory.length);
    checkGameEnd();
    updateReplayControls();
}

function applyReplayIndex(index) {
    replayIndex = Math.max(0, Math.min(index, moveHistory.length));

    board = createEmptyBoard(boardSize);
    for (let i = 0; i < replayIndex; i++) {
        const move = moveHistory[i];
        board[move.row][move.col] = move.player;
    }

    currentPlayer = replayIndex % 2 === 0 ? PLAYER_BLACK : PLAYER_WHITE;
    gameOver = isReplayMode;
    lastPlacedPosition = null;

    renderBoard();
    updateTurnText();
    updateEvaluation();
    updateHistoryList();
}

function replayFirst() {
    if (!isReplayMode) return;
    pauseReplay();
    applyReplayIndex(0);
}

function replayPrev() {
    if (!isReplayMode) return;
    pauseReplay();
    applyReplayIndex(replayIndex - 1);
}

function replayNext() {
    if (!isReplayMode) return;
    pauseReplay();
    applyReplayIndex(replayIndex + 1);
}

function replayLast() {
    if (!isReplayMode) return;
    pauseReplay();
    applyReplayIndex(moveHistory.length);
}

function toggleReplayPlay() {
    if (!isReplayMode) return;

    if (isReplayPlaying) {
        pauseReplay();
    } else {
        playReplay();
    }
}

function playReplay() {
    if (!isReplayMode) return;

    if (replayIndex >= moveHistory.length) {
        replayIndex = 0;
        applyReplayIndex(0);
    }

    isReplayPlaying = true;
    updateReplayControls();
    scheduleReplayStep();
}

function scheduleReplayStep() {
    if (!isReplayPlaying || !isReplayMode) return;

    const speed = Number(replaySpeedSelect.value);
    replayTimer = setTimeout(() => {
        if (replayIndex < moveHistory.length) {
            applyReplayIndex(replayIndex + 1);
            scheduleReplayStep();
        } else {
            pauseReplay();
        }
    }, speed);
}

function pauseReplay() {
    isReplayPlaying = false;
    stopReplayTimer();
    updateReplayControls();
}

function stopReplayTimer() {
    if (replayTimer) {
        clearTimeout(replayTimer);
        replayTimer = null;
    }
}

function handleReplaySpeedChange() {
    if (isReplayPlaying) {
        stopReplayTimer();
        scheduleReplayStep();
    }
}

function updateReplayControls() {
    if (isReplayMode) {
        replayPanel.classList.remove("hidden");
    } else {
        replayPanel.classList.add("hidden");
    }

    replayPlayPauseBtn.textContent = isReplayPlaying ? "⏸" : "▶";

    replayFirstBtn.disabled = replayIndex === 0;
    replayPrevBtn.disabled = replayIndex === 0;
    replayNextBtn.disabled = replayIndex === moveHistory.length;
    replayLastBtn.disabled = replayIndex === moveHistory.length;
}

function resumeGameFromReplay() {
    if (!isReplayMode) return;

    moveHistory = moveHistory.slice(0, replayIndex);
    exitReplayMode();
    saveGameState();
    triggerAiIfNeeded();
}

// ==================== 在线对战 ====================
function generateRoomCode() {
    const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    return code;
}

function getOnlineIdentityKey(code) {
    return `boardGameIdentity:${code}`;
}

function saveOnlineIdentity(code, playerId, color) {
    sessionStorage.setItem(getOnlineIdentityKey(code), JSON.stringify({ playerId, color }));
}

function loadOnlineIdentity(code) {
    try {
        const raw = sessionStorage.getItem(getOnlineIdentityKey(code));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function clearOnlineIdentity(code) {
    sessionStorage.removeItem(getOnlineIdentityKey(code));
}

function showConfirmDialog(message) {
    return new Promise((resolve) => {
        confirmMessage.textContent = message;
        confirmTitle.textContent = "提示";
        confirmModal.classList.remove("hidden");

        const cleanup = () => {
            confirmModal.classList.add("hidden");
            confirmOkBtn.onclick = null;
            confirmCancelBtn.onclick = null;
            confirmModal.onclick = null;
        };

        confirmOkBtn.onclick = () => {
            cleanup();
            resolve("confirm");
        };

        confirmCancelBtn.onclick = () => {
            cleanup();
            resolve("cancel");
        };

        confirmModal.onclick = (event) => {
            if (event.target === confirmModal) {
                cleanup();
                resolve("dismiss");
            }
        };
    });
}

async function apiRequest(path, method, body) {
    let response;
    try {
        response = await fetch(`${serverUrl}${path}`, {
            method,
            headers: { "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined
        });
    } catch (networkError) {
        throw new Error(`无法连接到服务器 (${serverUrl})`);
    }

    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (parseError) {
        throw new Error(`服务器返回了无法识别的响应：${text.slice(0, 100)}`);
    }

    if (!response.ok) {
        throw new Error(data && data.error ? data.error : `请求失败 ${response.status}`);
    }

    return data;
}

function startOnlinePolling() {
    stopOnlinePolling();
    onlinePollingTimer = setInterval(pollServerState, 250);
}

function stopOnlinePolling() {
    if (onlinePollingTimer) {
        clearInterval(onlinePollingTimer);
        onlinePollingTimer = null;
    }
}

async function pollServerState() {
    if (!onlineRoomCode || !onlinePlayerId) return;

    try {
        const state = await apiRequest(`/room-state?room=${onlineRoomCode}&player=${onlinePlayerId}`, "GET");
        applyServerState(state);
    } catch (error) {
        console.error(error);
        const msg = error.message || "";
        // 判断是否为网络断开（无法连接服务器）
        if (
            msg.includes("fetch") ||
            msg.includes("NetworkError") ||
            msg.includes("无法连接") ||
            msg.includes("Failed to fetch") ||
            msg.includes("network") ||
            error instanceof TypeError
        ) {
            handleNetworkError();
        } else if (msg.includes("404") || msg.includes("房间不存在") || msg.includes("未授权")) {
            handleLeftRoom("你已离开房间或房间已解散");
        } else {
            onlineStatus.textContent = "同步失败，请检查网络";
        }
    }
}

function createRoom() {
    const boardSizeValue = Number(boardSizeSelect.value);

    apiRequest("/create-room", "POST", { boardSize: boardSizeValue })
        .then((data) => {
            joinServerRoom(data.code, true);
        })
        .catch((error) => {
            onlineStatus.textContent = error.message;
        });
}

function joinRoom() {
    const code = roomCodeInput.value.trim().toUpperCase();
    if (code.length !== ROOM_CODE_LENGTH) {
        onlineStatus.textContent = `请输入 ${ROOM_CODE_LENGTH} 位房间号`;
        return;
    }
    joinServerRoom(code, false);
}

function joinServerRoom(code, isHost) {
    apiRequest("/join-room", "POST", { code })
        .then((data) => {
            hasNotifiedNetworkError = false;
            onlineRoomCode = code;
            onlinePlayerId = data.playerId;
            onlineColor = data.color; // 此时为 null
            isOnlineMode = true;
            saveOnlineIdentity(code, data.playerId, data.color);

            boardSize = data.boardSize;
            boardSizeSelect.value = String(boardSize);

            startOnlinePolling();
            pollServerState();

            const phase = data.phase || "waiting";
            if (phase === "waiting") {
                onlineStatus.textContent = isHost ? "房间已创建，分享房间号给对手" : "已加入房间，等待对手...";
                updateOnlinePanel("waiting");
            } else if (phase === "color_selection") {
                onlineStatus.textContent = "等待双方选择颜色...";
                updateOnlinePanel("color_selection", { players: [] });
            } else {
                onlineStatus.textContent = "对局进行中";
                updateOnlinePanel("playing");
            }
        })
        .catch((error) => {
            onlineStatus.textContent = error.message;
        });
}

function sendOnlineMove(row, col) {
    if (!onlineRoomCode || !onlinePlayerId) return;

    apiRequest("/move", "POST", {
        code: onlineRoomCode,
        playerId: onlinePlayerId,
        row,
        col
    })
        .then((data) => {
            applyServerState(data.state);
        })
        .catch((error) => {
            alert(error.message);
        });
}

function sendRematchRequest() {
    if (!onlineRoomCode || !onlinePlayerId) return;

    apiRequest("/rematch", "POST", {
        code: onlineRoomCode,
        playerId: onlinePlayerId
    })
        .then((data) => {
            applyServerState(data.state);
        })
        .catch((error) => {
            alert(error.message);
        });
}

function sendChangeBoardSizeRequest(newSize) {
    if (!onlineRoomCode || !onlinePlayerId) return;

    stopOnlinePolling();
    apiRequest("/change-board-size", "POST", {
        code: onlineRoomCode,
        playerId: onlinePlayerId,
        boardSize: newSize,
        action: "propose"
    })
        .then((data) => {
            applyServerState(data.state);
            startOnlinePolling();
        })
        .catch((error) => {
            alert(error.message);
            startOnlinePolling();
        });
}

function sendCancelBoardSizeChangeRequest() {
    if (!onlineRoomCode || !onlinePlayerId) return;

    stopOnlinePolling();
    apiRequest("/cancel-board-size-change", "POST", {
        code: onlineRoomCode,
        playerId: onlinePlayerId
    })
        .then((data) => {
            applyServerState(data.state);
            startOnlinePolling();
        })
        .catch((error) => {
            alert(error.message);
            startOnlinePolling();
        });
}

function sendRestartRequest() {
    if (!onlineRoomCode || !onlinePlayerId) return;

    stopOnlinePolling();
    apiRequest("/restart", "POST", {
        code: onlineRoomCode,
        playerId: onlinePlayerId,
        action: "propose"
    })
        .then((data) => {
            applyServerState(data.state);
            startOnlinePolling();
        })
        .catch((error) => {
            alert(error.message);
            startOnlinePolling();
        });
}

function sendApproveRestartRequest() {
    if (!onlineRoomCode || !onlinePlayerId) return;

    stopOnlinePolling();
    apiRequest("/restart", "POST", {
        code: onlineRoomCode,
        playerId: onlinePlayerId,
        action: "approve"
    })
        .then((data) => {
            applyServerState(data.state);
            startOnlinePolling();
        })
        .catch((error) => {
            alert(error.message);
            startOnlinePolling();
        });
}

function sendRejectRestartRequest() {
    if (!onlineRoomCode || !onlinePlayerId) return;

    stopOnlinePolling();
    apiRequest("/restart", "POST", {
        code: onlineRoomCode,
        playerId: onlinePlayerId,
        action: "reject"
    })
        .then((data) => {
            applyServerState(data.state);
            startOnlinePolling();
        })
        .catch((error) => {
            alert(error.message);
            startOnlinePolling();
        });
}

function sendUndoRequest() {
    if (!onlineRoomCode || !onlinePlayerId) return;

    stopOnlinePolling();
    apiRequest("/undo", "POST", {
        code: onlineRoomCode,
        playerId: onlinePlayerId,
        action: "propose"
    })
        .then((data) => {
            applyServerState(data.state);
            startOnlinePolling();
        })
        .catch((error) => {
            alert(error.message);
            startOnlinePolling();
        });
}

function sendApproveUndoRequest() {
    if (!onlineRoomCode || !onlinePlayerId) return;

    stopOnlinePolling();
    apiRequest("/undo", "POST", {
        code: onlineRoomCode,
        playerId: onlinePlayerId,
        action: "approve"
    })
        .then((data) => {
            applyServerState(data.state);
            startOnlinePolling();
        })
        .catch((error) => {
            alert(error.message);
            startOnlinePolling();
        });
}

function sendRejectUndoRequest() {
    if (!onlineRoomCode || !onlinePlayerId) return;

    stopOnlinePolling();
    apiRequest("/undo", "POST", {
        code: onlineRoomCode,
        playerId: onlinePlayerId,
        action: "reject"
    })
        .then((data) => {
            applyServerState(data.state);
            startOnlinePolling();
        })
        .catch((error) => {
            alert(error.message);
            startOnlinePolling();
        });
}

function applyServerState(state) {
    if (!state) return;

    // ==================== 保存旧状态 ====================
    const oldBoard = board.map((row) => [...row]);
    const oldMoveHistory = moveHistory.slice();
    const oldBoardSize = boardSize;
    const oldPhase = onlinePhase;

    // ==================== 更新全局变量 ====================
    if (state.code) {
        onlineRoomCode = state.code;
    }
    if (state.myColor) {
        onlineColor = state.myColor;
    }

    boardSize = state.boardSize;
    board = (state.board || []).map((row) => [...row]);
    currentPlayer = state.currentPlayer;
    gameOver = !!state.gameOver;
    moveHistory = (state.moveHistory || []).map((move) => ({ ...move }));
    isOnlineMyTurn = currentPlayer === onlineColor;
    onlinePhase = state.phase || "waiting";

    // ==================== 离开检测 ====================
    if (isOnlineMode && onlineRoomCode && onlinePlayerId) {
        const players = state.players || [];
        const playerInRoom = players.some((p) => p.id === onlinePlayerId);

        if (!playerInRoom) {
            handleLeftRoom("你已离开房间或房间已解散");
            return;
        }

        // 检测对方是否离开：只剩自己一人，且阶段从非 waiting 变为 waiting
        if (players.length === 1 && state.phase === "waiting" && oldPhase !== "waiting") {
            // 判断当前玩家是否是房主
            if (state.hostId === onlinePlayerId) {
                handleOpponentLeft(); // 房主：房客离开，保留房间
            } else {
                handleLeftRoom("对手已离开房间"); // 房客：房主离开，解散房间
            }
            return;
        }
    }

    // ==================== 检测变化 ====================
    let boardChanged = false;
    if (boardSize !== oldBoardSize) {
        boardChanged = true;
    } else {
        for (let r = 0; r < boardSize; r++) {
            for (let c = 0; c < boardSize; c++) {
                if (oldBoard[r][c] !== board[r][c]) {
                    boardChanged = true;
                    break;
                }
            }
            if (boardChanged) break;
        }
    }

    const movesChanged =
        moveHistory.length !== oldMoveHistory.length ||
        (moveHistory.length > 0 &&
            oldMoveHistory.length > 0 &&
            (moveHistory[moveHistory.length - 1].row !== oldMoveHistory[oldMoveHistory.length - 1].row ||
                moveHistory[moveHistory.length - 1].col !== oldMoveHistory[oldMoveHistory.length - 1].col ||
                moveHistory[moveHistory.length - 1].player !== oldMoveHistory[oldMoveHistory.length - 1].player));

    if (moveHistory.length > oldMoveHistory.length && !isReplayMode) {
        const last = moveHistory[moveHistory.length - 1];
        lastPlacedPosition = { row: last.row, col: last.col };
    } else {
        lastPlacedPosition = null;
    }

    if (boardChanged || movesChanged) {
        renderBoard();
    }

    updateTurnText();
    updateEvaluation();
    updateHistoryList();

    const pendingSize = state.pendingBoardSize;
    const hasBoardSizeVoted =
        pendingSize !== null && pendingSize !== undefined && (state.boardSizeVotes || []).includes(onlinePlayerId);
    const isProposalOwner =
        pendingSize !== null && pendingSize !== undefined && state.boardSizeProposalBy === onlinePlayerId;

    if (pendingSize !== null && pendingSize !== undefined) {
        isUpdatingBoardSize = true;
        boardSizeSelect.value = String(pendingSize);
        isUpdatingBoardSize = false;
    } else {
        isUpdatingBoardSize = true;
        boardSizeSelect.value = String(boardSize);
        isUpdatingBoardSize = false;
    }

    const isRestartProposalOwner = state.pendingRestart && state.restartProposalBy === onlinePlayerId;
    const isUndoProposalOwner = state.pendingUndo && state.undoProposalBy === onlinePlayerId;

    handleBoardSizeVotePrompt(state);
    handleRestartVotePrompt(state);
    handleUndoVotePrompt(state);

    if (state.gameOver) {
        handleOnlineGameOver({ winner: state.winner ?? 0 });
        const hasVoted = (state.rematchVotes || []).includes(onlinePlayerId);
        if (hasVoted) {
            resultText.textContent = `${resultText.textContent}\n等待对方同意再来一局...`;
            onlineStatus.textContent = "已请求再来一局，等待对方同意...";
        }
    } else {
        overlay.classList.add("hidden");
        const phase = state.phase || "playing";
        updateOnlinePanel(phase, state); // 传递 state 以便更新颜色选择 UI
    }

    if (pendingSize !== null && pendingSize !== undefined && isProposalOwner) {
        onlineStatus.textContent = `已提议改为 ${pendingSize}×${pendingSize}，等待对方确认...`;
    } else if (pendingSize !== null && pendingSize !== undefined && !isProposalOwner) {
        onlineStatus.textContent = `对方提议改为 ${pendingSize}×${pendingSize}，等待你确认...`;
    }

    if (state.pendingRestart && isRestartProposalOwner) {
        onlineStatus.textContent = "已提议重新开始，等待对方确认...";
    } else if (state.pendingRestart && !isRestartProposalOwner) {
        onlineStatus.textContent = "对方提议重新开始，等待你确认...";
    }

    if (state.pendingUndo && isUndoProposalOwner) {
        onlineStatus.textContent = "已提议悔棋，等待对方确认...";
    } else if (state.pendingUndo && !isUndoProposalOwner) {
        onlineStatus.textContent = "对方提议悔棋，等待你确认...";
    }

    saveGameState();
}

function handleRestartVotePrompt(state) {
    if (!isOnlineMode || !state.pendingRestart) {
        lastPromptedPendingRestart = false;
        restartPromptResolver = null;
        return;
    }

    const hasVoted = (state.restartVotes || []).includes(onlinePlayerId);
    const isProposalOwner = state.restartProposalBy === onlinePlayerId;
    if (hasVoted || isProposalOwner) {
        return;
    }

    if (restartPromptResolver || lastPromptedPendingRestart) {
        return;
    }

    lastPromptedPendingRestart = true;
    restartPromptResolver = true;
    showConfirmDialog("对方提议重新开始当前棋局，是否同意？")
        .then((result) => {
            if (result === "confirm") {
                sendApproveRestartRequest();
            } else if (result === "cancel") {
                sendRejectRestartRequest();
            } else if (result === "dismiss") {
                lastPromptedPendingRestart = false;
            }
        })
        .finally(() => {
            restartPromptResolver = null;
        });
}

function handleUndoVotePrompt(state) {
    if (!isOnlineMode || !state.pendingUndo) {
        lastPromptedPendingUndo = false;
        undoPromptResolver = null;
        return;
    }

    const hasVoted = (state.undoVotes || []).includes(onlinePlayerId);
    const isProposalOwner = state.undoProposalBy === onlinePlayerId;
    if (hasVoted || isProposalOwner) {
        return;
    }

    if (undoPromptResolver || lastPromptedPendingUndo) {
        return;
    }

    lastPromptedPendingUndo = true;
    undoPromptResolver = true;
    showConfirmDialog("对方提议悔掉上一步，是否同意？")
        .then((result) => {
            if (result === "confirm") {
                sendApproveUndoRequest();
            } else if (result === "cancel") {
                sendRejectUndoRequest();
            } else if (result === "dismiss") {
                lastPromptedPendingUndo = false;
            }
        })
        .finally(() => {
            undoPromptResolver = null;
        });
}

function handleBoardSizeVotePrompt(state) {
    if (!isOnlineMode || state.pendingBoardSize === null || state.pendingBoardSize === undefined) {
        lastPromptedPendingBoardSize = null;
        boardSizePromptResolver = null;
        return;
    }

    const hasVoted = (state.boardSizeVotes || []).includes(onlinePlayerId);
    const isProposalOwner = state.boardSizeProposalBy === onlinePlayerId;
    if (hasVoted || isProposalOwner) {
        return;
    }

    if (boardSizePromptResolver || state.pendingBoardSize === lastPromptedPendingBoardSize) {
        return;
    }

    lastPromptedPendingBoardSize = state.pendingBoardSize;
    boardSizePromptResolver = true;
    showConfirmDialog(`对方提议将棋盘大小改为 ${state.pendingBoardSize}×${state.pendingBoardSize}，是否同意？`)
        .then((result) => {
            if (result === "confirm") {
                apiRequest("/change-board-size", "POST", {
                    code: onlineRoomCode,
                    playerId: onlinePlayerId,
                    boardSize: state.pendingBoardSize,
                    action: "approve"
                })
                    .then((data) => {
                        applyServerState(data.state);
                    })
                    .catch((error) => {
                        alert(error.message);
                    });
            } else if (result === "cancel") {
                apiRequest("/change-board-size", "POST", {
                    code: onlineRoomCode,
                    playerId: onlinePlayerId,
                    boardSize: state.pendingBoardSize,
                    action: "reject"
                })
                    .then((data) => {
                        applyServerState(data.state);
                    })
                    .catch((error) => {
                        alert(error.message);
                    });
            } else if (result === "dismiss") {
                lastPromptedPendingBoardSize = null;
            }
        })
        .finally(() => {
            boardSizePromptResolver = null;
        });
}

function handleOnlineGameOver(message) {
    gameOver = true;

    if (message.winner === 0) {
        showResult("平局！");
    } else {
        const winnerName = PLAYER_NAMES[message.winner];
        showResult(`${winnerName}获胜！`);
    }

    saveGameState();
}

function leaveRoom() {
    hasNotifiedLeave = true;
    hasNotifiedNetworkError = true;
    const currentRoomCode = onlineRoomCode;
    const currentPlayerId = onlinePlayerId;

    stopOnlinePolling();

    onlineRoomCode = null;
    onlinePlayerId = null;
    onlineColor = null;
    isOnlineMyTurn = false;
    onlinePhase = "waiting";
    lastPromptedPendingBoardSize = null;
    boardSizePromptResolver = null;
    lastPromptedPendingRestart = false;
    restartPromptResolver = null;
    lastPromptedPendingUndo = false;
    undoPromptResolver = null;
    clearOnlineIdentity(currentRoomCode);

    resetToIdleState();

    if (currentRoomCode && currentPlayerId) {
        apiRequest("/leave-room", "POST", { code: currentRoomCode, playerId: currentPlayerId }).catch((error) =>
            console.error(error)
        );
    }

    updateOnlinePanel("idle");

    setTimeout(() => {
        hasNotifiedLeave = false;
        hasNotifiedNetworkError = false;
    }, 500);
}

function handleLeftRoom(reason) {
    if (hasNotifiedLeave) return;
    hasNotifiedLeave = true;
    hasNotifiedNetworkError = true;
    const msg = reason || "对手已离开房间";
    alert(msg);

    stopOnlinePolling();
    if (onlineRoomCode) {
        clearOnlineIdentity(onlineRoomCode);
    }
    onlineRoomCode = null;
    onlinePlayerId = null;
    onlineColor = null;
    isOnlineMyTurn = false;
    onlinePhase = "waiting";
    lastPromptedPendingBoardSize = null;
    boardSizePromptResolver = null;
    lastPromptedPendingRestart = false;
    restartPromptResolver = null;
    lastPromptedPendingUndo = false;
    undoPromptResolver = null;

    resetToIdleState();

    updateOnlinePanel("idle");

    setTimeout(() => {
        hasNotifiedLeave = false;
        hasNotifiedNetworkError = false;
    }, 1000);
}

function handleOpponentLeft() {
    if (hasNotifiedLeave) return;
    hasNotifiedLeave = true;
    hasNotifiedNetworkError = true;
    alert("对手已离开房间");

    resetToIdleState();

    onlineColor = null;
    isOnlineMyTurn = false;
    onlinePhase = "waiting";

    updateTurnText();
    updateOnlinePanel("waiting");

    setTimeout(() => {
        hasNotifiedLeave = false;
        hasNotifiedNetworkError = false;
    }, 1000);
}

function handleNetworkError() {
    if (hasNotifiedNetworkError) return;
    hasNotifiedNetworkError = true;
    alert("网络连接已断开，请检查网络后重新加入");

    stopOnlinePolling();
    if (onlineRoomCode) {
        clearOnlineIdentity(onlineRoomCode);
    }
    onlineRoomCode = null;
    onlinePlayerId = null;
    onlineColor = null;
    isOnlineMyTurn = false;
    onlinePhase = "waiting";
    resetToIdleState();
    updateOnlinePanel("idle");
    onlineStatus.textContent = "网络错误，请检查网络连接";

    setTimeout(() => {
        hasNotifiedNetworkError = false;
    }, 3000);
}

function updateOnlinePanel(state, stateData) {
    if (state === "idle") {
        onlineStatus.textContent = "";
        roomCodeDisplay.classList.add("hidden");
        leaveRoomBtn.classList.add("hidden");
        createRoomBtn.disabled = false;
        joinRoomBtn.disabled = false;
        roomCodeInput.disabled = false;
        roomCodeInput.value = "";
        const colorDiv = document.getElementById("colorSelection");
        if (colorDiv) colorDiv.classList.add("hidden");
        return;
    }

    if (state === "waiting") {
        onlineStatus.textContent = "等待对手加入...";
        roomCodeDisplay.textContent = `房间号(点击复制)：${onlineRoomCode}`;
        roomCodeDisplay.classList.remove("hidden");
        leaveRoomBtn.classList.remove("hidden");
        createRoomBtn.disabled = true;
        joinRoomBtn.disabled = true;
        roomCodeInput.disabled = true;
        const colorDiv = document.getElementById("colorSelection");
        if (colorDiv) colorDiv.classList.add("hidden");
        return;
    }

    if (state === "color_selection") {
        onlineStatus.textContent = "选择棋子颜色";
        roomCodeDisplay.textContent = `房间号：${onlineRoomCode}`;
        roomCodeDisplay.classList.remove("hidden");
        leaveRoomBtn.classList.remove("hidden");
        createRoomBtn.disabled = true;
        joinRoomBtn.disabled = true;
        roomCodeInput.disabled = true;

        const colorDiv = document.getElementById("colorSelection");
        if (colorDiv) colorDiv.classList.remove("hidden");

        const me = stateData?.players?.find((p) => p.id === onlinePlayerId);
        const other = stateData?.players?.find((p) => p.id !== onlinePlayerId);

        let blackDisabled = false;
        let whiteDisabled = false;
        let blackText = "⚫ 黑棋";
        let whiteText = "⚪ 白棋";
        let statusMsg = "";

        if (me) {
            const mySelected = me.selectedColor;
            const otherSelected = other?.selectedColor;

            if (mySelected === 1) {
                blackDisabled = true;
                blackText = "⚫ 黑棋 (已选)";
                if (otherSelected === 2) {
                    whiteDisabled = true;
                    whiteText = "⚪ 白棋 (对方已选)";
                } else {
                    whiteDisabled = false;
                    whiteText = "⚪ 白棋";
                }
            } else if (mySelected === 2) {
                whiteDisabled = true;
                whiteText = "⚪ 白棋 (已选)";
                if (otherSelected === 1) {
                    blackDisabled = true;
                    blackText = "⚫ 黑棋 (对方已选)";
                } else {
                    blackDisabled = false;
                    blackText = "⚫ 黑棋";
                }
            } else {
                if (otherSelected === 1) {
                    blackDisabled = true;
                    blackText = "⚫ 黑棋 (对方已选)";
                    whiteDisabled = false;
                    whiteText = "⚪ 白棋";
                } else if (otherSelected === 2) {
                    whiteDisabled = true;
                    whiteText = "⚪ 白棋 (对方已选)";
                    blackDisabled = false;
                    blackText = "⚫ 黑棋";
                } else {
                    blackDisabled = false;
                    whiteDisabled = false;
                    blackText = "⚫ 黑棋";
                    whiteText = "⚪ 白棋";
                }
            }

            if (otherSelected) {
                const otherName = otherSelected === 1 ? "黑棋" : "白棋";
                if (mySelected) {
                    const myName = mySelected === 1 ? "黑棋" : "白棋";
                    statusMsg = `你已选择 ${myName}，对方已选择 ${otherName}`;
                } else {
                    const available = otherSelected === 1 ? "白棋" : "黑棋";
                    statusMsg = `对方已选择 ${otherName}，你只能选择 ${available}`;
                }
            } else {
                if (mySelected) {
                    const myName = mySelected === 1 ? "黑棋" : "白棋";
                    statusMsg = `你已选择 ${myName}，等待对方选择...`;
                } else {
                    statusMsg = "";
                }
            }
        } else {
            blackDisabled = false;
            whiteDisabled = false;
            statusMsg = "请选择你的棋子颜色";
        }

        chooseBlackBtn.disabled = blackDisabled;
        chooseWhiteBtn.disabled = whiteDisabled;
        chooseBlackBtn.textContent = blackText;
        chooseWhiteBtn.textContent = whiteText;
        colorStatus.textContent = statusMsg;

        return;
    }

    if (state === "playing") {
        const colorDiv = document.getElementById("colorSelection");
        if (colorDiv) colorDiv.classList.add("hidden");

        if (onlineColor === null || !onlineRoomCode) {
            updateOnlinePanel("idle");
            return;
        }
        const colorText = onlineColor === PLAYER_BLACK ? "黑棋" : "白棋";
        onlineStatus.textContent = "联机对战中";
        roomCodeDisplay.textContent = `房间号：${onlineRoomCode}`;
        roomCodeDisplay.classList.remove("hidden");
        leaveRoomBtn.classList.remove("hidden");
        createRoomBtn.disabled = true;
        joinRoomBtn.disabled = true;
        roomCodeInput.disabled = true;
    }
}

function chooseColor(color) {
    if (!onlineRoomCode || !onlinePlayerId) {
        alert("请先加入房间");
        return;
    }
    apiRequest("/choose-color", "POST", {
        code: onlineRoomCode,
        playerId: onlinePlayerId,
        color: color
    })
        .then((data) => {
            applyServerState(data.state);
        })
        .catch((error) => {
            alert(error.message);
        });
}

if (chooseBlackBtn) {
    chooseBlackBtn.addEventListener("click", () => chooseColor(1));
}
if (chooseWhiteBtn) {
    chooseWhiteBtn.addEventListener("click", () => chooseColor(2));
}

// ==================== 启动游戏 ====================
loadSavedTheme();
serverUrlInput.value = serverUrl;

(async () => {
    const detectedUrl = await autoDetectServerUrl();
    serverUrl = detectedUrl;
    serverUrlInput.value = serverUrl;
    localStorage.setItem(SERVER_URL_STORAGE_KEY, serverUrl);
    onlineStatus.textContent = `已连接到后端：${serverUrl}`;
})();

if (!loadGameState()) {
    initializeGame();
}
