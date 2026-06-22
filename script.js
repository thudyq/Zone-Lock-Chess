let history = [];
let BOARD_SIZE = 8;
const sizeSelector =
    document.getElementById("boardSize");
const moveCountText =
    document.getElementById("moveCount");
const undoBtn =
    document.getElementById("undoBtn");

let board = [];
let currentPlayer = 1; // 1=黑棋 2=白棋
let gameOver = false;

const letters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const boardDiv = document.getElementById("board");
const turnText = document.getElementById("turn");
const restartBtn = document.getElementById("restart");

const columnLabels =
    document.getElementById("columnLabels");

const rowLabels =
    document.getElementById("rowLabels");

const overlay =
    document.getElementById("overlay");

const resultText =
    document.getElementById("resultText");

const playAgain =
    document.getElementById("playAgain");

initializeGame();

restartBtn.addEventListener("click", initializeGame);
sizeSelector.addEventListener("change", () => {

    if (
        confirm(
            "修改棋盘大小将重新开始游戏，是否继续？"
        )
    ) {
        initializeGame();
    }
});
undoBtn.addEventListener(
    "click",
    undoMove
);

playAgain.addEventListener(
    "click",
    () => {

        overlay.classList.add("hidden");

        initializeGame();
    }
);

function initializeGame() {
    
    history = [];

    BOARD_SIZE =
        Number(sizeSelector.value);

    board = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
        board[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            board[r][c] = 0;
        }
    }

    currentPlayer = 1;
    gameOver = false;

    updateTurnText();
    renderBoard();
    updateTurnText();
}

function renderBoard() {

    boardDiv.innerHTML = "";

    columnLabels.innerHTML = "";
    rowLabels.innerHTML = "";

    for (let c = 0; c < BOARD_SIZE; c++) {

        const label =
            document.createElement("div");

        label.classList.add("coord-label");

        label.textContent =
            letters[c];

        columnLabels.appendChild(label);
    }

    for (let r = 0; r < BOARD_SIZE; r++) {

        const label =
            document.createElement("div");

        label.classList.add("coord-label");

        label.textContent =
            r + 1;

        rowLabels.appendChild(label);
    }

    boardDiv.style.gridTemplateColumns =
    `repeat(${BOARD_SIZE}, 60px)`;

    for (let r = 0; r < BOARD_SIZE; r++) {

        for (let c = 0; c < BOARD_SIZE; c++) {

            const cell = document.createElement("div");

            cell.classList.add("cell");

            if (
                !gameOver &&
                isLegal(r, c, currentPlayer)
            ) {

                cell.classList.add("legal-move");

                cell.addEventListener("mouseenter", () => {

                    cell.classList.add(
                        currentPlayer === 1
                        ? "preview-black"
                        : "preview-white"
                    );
                });

                cell.addEventListener("mouseleave", () => {

                    cell.classList.remove(
                        "preview-black",
                        "preview-white"
                    );
                });
            }

            // 高亮合法位置
            if (
                !gameOver &&
                isLegal(r, c, currentPlayer)
            ) {
                cell.classList.add("legal-move");
            }

            cell.addEventListener("click", () => {
                handleMove(r, c);
            });

            if (board[r][c] !== 0) {

                const piece =
                    document.createElement("div");

                piece.classList.add("piece");

                if (board[r][c] === 1) {
                    piece.classList.add("black");
                }
                else {
                    piece.classList.add("white");
                }

                cell.appendChild(piece);
            }

            boardDiv.appendChild(cell);
        }
    }    
}

function handleMove(row, col) {

    if (gameOver) return;

    if (!isLegal(row, col, currentPlayer)) {
        alert("这里不能下！");
        return;
    }

    history.push({
        row,
        col,
        player: currentPlayer
    });

board[row][col] = currentPlayer;

    // 切换玩家
    currentPlayer = currentPlayer === 1 ? 2 : 1;

    renderBoard();
    updateTurnText();

    checkGameEnd();

    if (!gameOver) {
        updateTurnText();
    }
}

function isLegal(row, col, player) {

    if (board[row][col] !== 0) {
        return false;
    }

    const opponent = player === 1 ? 2 : 1;

    const directions = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
    ];

    for (const [dr, dc] of directions) {

        const nr = row + dr;
        const nc = col + dc;

        if (
            nr >= 0 &&
            nr < BOARD_SIZE &&
            nc >= 0 &&
            nc < BOARD_SIZE
        ) {
            if (board[nr][nc] === opponent) {
                return false;
            }
        }
    }

    return true;
}

function hasLegalMove(player) {

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {

            if (isLegal(r, c, player)) {
                return true;
            }
        }
    }

    return false;
}

function checkGameEnd() {

    const currentCanMove = hasLegalMove(currentPlayer);

    // 当前玩家还能下
    if (currentCanMove) {
        return;
    }

    const opponent = currentPlayer === 1 ? 2 : 1;
    const opponentCanMove = hasLegalMove(opponent);

    gameOver = true;

    if (opponentCanMove) {

        const winner =
            opponent === 1 ? "黑棋" : "白棋";

        turnText.textContent =
            `游戏结束：${winner}获胜！`;

        showResult(`${winner}获胜！`);
    }
    else {

        turnText.textContent =
            "游戏结束：平局！";

        showResult("平局！");
    }
}

function updateTurnText() {

    turnText.textContent =
        currentPlayer === 1
        ? "当前玩家：黑棋"
        : "当前玩家：白棋";

    const blackMoves =
        countLegalMoves(1);

    const whiteMoves =
        countLegalMoves(2);

    moveCountText.textContent =
        `黑棋可下：${blackMoves}    |    白棋可下：${whiteMoves}`;
}

function countLegalMoves(player) {

    let count = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {

        for (let c = 0; c < BOARD_SIZE; c++) {

            if (isLegal(r, c, player)) {
                count++;
            }
        }
    }

    return count;
}

function undoMove() {

    if (history.length === 0) {
        return;
    }

    const lastMove = history.pop();

    board[lastMove.row][lastMove.col] = 0;

    currentPlayer = lastMove.player;

    gameOver = false;

    renderBoard();
    updateTurnText();
}

function showResult(text) {

    resultText.textContent = text;

    overlay.classList.remove("hidden");
}