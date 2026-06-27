// ==================== 常量 ====================
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIRECTIONS = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
];
const NEIGHBOR_DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
];

const AI_DELAY_MS = 300;

const WEIGHT_MOBILITY = 1.0;
const WEIGHT_CENTER = 0.5;
const WEIGHT_GROUP = 0.4;

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

// ==================== 游戏状态 ====================
let boardSize = 8;
let board = [];
let currentPlayer = PLAYER_BLACK;
let gameOver = false;
let moveHistory = [];
let aiThinking = false;
let aiTimer = null;
let previousBoardSize = boardSizeSelect.value;
let previousGameMode = gameModeSelect.value;
let previousAiDifficulty = aiDifficultySelect.value;

let isReplayMode = false;
let replayIndex = 0;
let isReplayPlaying = false;
let replayTimer = null;

let lastPlacedPosition = null;

// ==================== 事件监听 ====================
restartBtn.addEventListener("click", initializeGame);

boardSizeSelect.addEventListener("change", () => {
    const message = "修改棋盘大小将重新开始游戏，是否继续？";
    if (confirm(message)) {
        initializeGame();
    }
});

gameModeSelect.addEventListener("change", () => {
    const message = "切换游戏模式将重新开始游戏，是否继续？";
    if (confirm(message)) {
        previousGameMode = gameModeSelect.value;
        initializeGame();
    } else {
        gameModeSelect.value = previousGameMode;
    }
    updateAiDifficultyVisibility();
});

aiDifficultySelect.addEventListener("change", () => {
    const message = "切换 AI 难度将改变后续 AI 的落子策略，是否继续？";
    if (confirm(message)) {
        previousAiDifficulty = aiDifficultySelect.value;
    } else {
        aiDifficultySelect.value = previousAiDifficulty;
    }
});

undoBtn.addEventListener("click", undoMove);

playAgainBtn.addEventListener("click", () => {
    overlay.classList.add("hidden");
    initializeGame();
});

exportResultBtn.addEventListener("click", exportRecord);
themeToggle.addEventListener("click", toggleTheme);

exportBtn.addEventListener("click", exportRecord);
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", importRecord);

replayFirstBtn.addEventListener("click", replayFirst);
replayPrevBtn.addEventListener("click", replayPrev);
replayPlayPauseBtn.addEventListener("click", toggleReplayPlay);
replayNextBtn.addEventListener("click", replayNext);
replayLastBtn.addEventListener("click", replayLast);
replaySpeedSelect.addEventListener("change", handleReplaySpeedChange);
resumeGameBtn.addEventListener("click", resumeGameFromReplay);

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

    board = createEmptyBoard(boardSize);

    renderBoard();
    updateTurnText();
    updateEvaluation();
    updateHistoryList();
    updateAiDifficultyVisibility();
    updateReplayControls();
    overlay.classList.add("hidden");
    saveGameState();
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
        updateAiDifficultyVisibility();
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

function updateAiDifficultyVisibility() {
    const isAiMode = gameModeSelect.value === "ai";
    aiDifficultySelect.disabled = !isAiMode;
    aiDifficultyLabel.classList.toggle("disabled", !isAiMode);
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
    boardDiv.innerHTML = "";
    columnLabelsDiv.innerHTML = "";
    rowLabelsDiv.innerHTML = "";

    renderColumnLabels();
    renderRowLabels();

    boardDiv.style.gridTemplateColumns = `repeat(${boardSize}, 60px)`;

    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            const cell = createCell(row, col);
            boardDiv.appendChild(cell);
        }
    }
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

function createCell(row, col) {
    const cell = document.createElement("div");
    cell.classList.add("cell");

    const isLegalMove = !gameOver && isLegal(row, col, currentPlayer);
    if (isLegalMove) {
        cell.classList.add("legal-move");
        addHoverPreview(cell);
    }

    cell.addEventListener("click", () => handleMove(row, col));

    const pieceOwner = board[row][col];
    if (pieceOwner !== 0) {
        cell.appendChild(createPiece(pieceOwner, row, col));
    }

    return cell;
}

function addHoverPreview(cell) {
    const previewClass = currentPlayer === PLAYER_BLACK
        ? "preview-black"
        : "preview-white";

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
    if (!isLegal(row, col, currentPlayer)) {
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
    if (gameOver || gameModeSelect.value !== "ai" || currentPlayer !== PLAYER_WHITE) {
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
    if (isReplayMode) {
        turnText.textContent = `回放中：第 ${replayIndex} / ${moveHistory.length} 步`;
        moveCountText.textContent = "";
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

    const legalMoves = getLegalMoves(PLAYER_WHITE);
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
            bestMove = findBestMoveMinimax(SEARCH_DEPTH_HARD);
            break;
        case DIFFICULTY_EXPERT:
            bestMove = findBestMoveMinimax(SEARCH_DEPTH_EXPERT);
            break;
        case DIFFICULTY_MEDIUM:
        default:
            bestMove = findBestMove(legalMoves);
            break;
    }

    aiThinking = false;
    handleMove(bestMove.row, bestMove.col);
}

function getRandomMove(moves) {
    const index = Math.floor(Math.random() * moves.length);
    return moves[index];
}

function findBestMove(moves) {
    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of moves) {
        const score = evaluateMove(move.row, move.col);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}

function evaluateMove(row, col) {
    board[row][col] = PLAYER_WHITE;
    const aiMoves = getLegalMoves(PLAYER_WHITE).length;
    const playerMoves = getLegalMoves(PLAYER_BLACK).length;
    board[row][col] = 0;

    const mobilityScore = aiMoves - playerMoves;
    const centerScore = getCenterScore(row, col);
    const groupScore = getGroupScore(row, col, PLAYER_WHITE);

    return WEIGHT_MOBILITY * mobilityScore
        + WEIGHT_CENTER * centerScore
        + WEIGHT_GROUP * groupScore;
}

function findBestMoveMinimax(depth) {
    const legalMoves = getLegalMoves(PLAYER_WHITE);
    let bestMove = legalMoves[0];
    let bestScore = -Infinity;

    for (const move of legalMoves) {
        board[move.row][move.col] = PLAYER_WHITE;
        const score = minimax(depth - 1, -Infinity, Infinity, false);
        board[move.row][move.col] = 0;

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
}

function minimax(depth, alpha, beta, isMaximizingPlayer) {
    const player = isMaximizingPlayer ? PLAYER_WHITE : PLAYER_BLACK;

    if (depth === 0 || !hasLegalMove(player)) {
        return evaluateBoard();
    }

    const legalMoves = getLegalMoves(player);

    if (isMaximizingPlayer) {
        let maxScore = -Infinity;

        for (const move of legalMoves) {
            board[move.row][move.col] = PLAYER_WHITE;
            const score = minimax(depth - 1, alpha, beta, false);
            board[move.row][move.col] = 0;

            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);

            if (beta <= alpha) {
                break;
            }
        }

        return maxScore;
    }

    let minScore = Infinity;

    for (const move of legalMoves) {
        board[move.row][move.col] = PLAYER_BLACK;
        const score = minimax(depth - 1, alpha, beta, true);
        board[move.row][move.col] = 0;

        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);

        if (beta <= alpha) {
            break;
        }
    }

    return minScore;
}

function evaluateBoard() {
    const whiteMoves = countLegalMoves(PLAYER_WHITE);
    const blackMoves = countLegalMoves(PLAYER_BLACK);

    if (whiteMoves === 0 && blackMoves === 0) {
        return 0;
    }
    if (whiteMoves === 0) {
        return -10000;
    }
    if (blackMoves === 0) {
        return 10000;
    }

    const mobilityScore = whiteMoves - blackMoves;
    const centerScore = getBoardCenterScore(PLAYER_WHITE) - getBoardCenterScore(PLAYER_BLACK);
    const groupScore = getBoardGroupScore(PLAYER_WHITE) - getBoardGroupScore(PLAYER_BLACK);

    return WEIGHT_MOBILITY * mobilityScore
        + WEIGHT_CENTER * centerScore
        + WEIGHT_GROUP * groupScore;
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

    const dateStr = new Date().toISOString().slice(0, 10);
    const timeStr = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
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
    return record
        && record.version === "1.0"
        && typeof record.boardSize === "number"
        && [6, 8, 10, 12].includes(record.boardSize)
        && Array.isArray(record.moves)
        && record.moves.every((move) =>
            typeof move.row === "number"
            && typeof move.col === "number"
            && typeof move.player === "number"
            && move.row >= 0 && move.row < record.boardSize
            && move.col >= 0 && move.col < record.boardSize
            && (move.player === PLAYER_BLACK || move.player === PLAYER_WHITE)
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
}

// ==================== 启动游戏 ====================
loadSavedTheme();

if (!loadGameState()) {
    initializeGame();
}
