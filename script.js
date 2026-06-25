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
const restartBtn = document.getElementById("restartBtn");
const undoBtn = document.getElementById("undoBtn");
const playAgainBtn = document.getElementById("playAgainBtn");

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
});

undoBtn.addEventListener("click", undoMove);

playAgainBtn.addEventListener("click", () => {
    overlay.classList.add("hidden");
    initializeGame();
});

// ==================== 游戏初始化与重置 ====================
function initializeGame() {
    stopAiTimer();
    moveHistory = [];
    gameOver = false;
    aiThinking = false;
    currentPlayer = PLAYER_BLACK;
    boardSize = Number(boardSizeSelect.value);

    board = createEmptyBoard(boardSize);

    renderBoard();
    updateTurnText();
    updateEvaluation();
    updateHistoryList();
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
        cell.appendChild(createPiece(pieceOwner));
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

function createPiece(player) {
    const piece = document.createElement("div");
    piece.classList.add("piece");
    piece.classList.add(player === PLAYER_BLACK ? "piece-black" : "piece-white");
    return piece;
}

// ==================== 核心游戏逻辑 ====================
function handleMove(row, col) {
    if (aiThinking || gameOver) return;
    if (!isLegal(row, col, currentPlayer)) {
        alert("这里不能下！");
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
}

function placePiece(row, col, player) {
    moveHistory.push({ row, col, player });
    board[row][col] = player;
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
    if (moveHistory.length === 0) return;

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

    moveHistory.forEach((move) => {
        const listItem = document.createElement("li");
        const playerName = move.player === PLAYER_BLACK ? "黑" : "白";
        const coordinate = LETTERS[move.col] + (move.row + 1);
        listItem.textContent = `${playerName} ${coordinate}`;
        historyList.appendChild(listItem);
    });

    historyList.scrollTo({
        top: historyList.scrollHeight,
        behavior: "smooth"
    });
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

    const bestMove = findBestMove(legalMoves);
    aiThinking = false;

    handleMove(bestMove.row, bestMove.col);
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

function getCenterScore(row, col) {
    const centerRow = (boardSize - 1) / 2;
    const centerCol = (boardSize - 1) / 2;
    const maxDistance = centerRow + centerCol;
    const distance = Math.abs(row - centerRow) + Math.abs(col - centerCol);

    return maxDistance - distance;
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

// ==================== 启动游戏 ====================
initializeGame();
