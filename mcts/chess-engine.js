export const Player = Object.freeze({ BLACK: 1, WHITE: 2 });
export const GameResult = Object.freeze({
    ONGOING: "ongoing",
    BLACK_WIN: "black_win",
    WHITE_WIN: "white_win",
    DRAW: "draw"
});

export function opponentOf(player) {
    return player === Player.BLACK ? Player.WHITE : Player.BLACK;
}

export function bitCount(bits) {
    let count = 0;
    while (bits !== 0n) {
        bits &= bits - 1n;
        count++;
    }
    return count;
}

export class IsolationChessEnv {
    constructor(size = 8) {
        if (!Number.isInteger(size) || size <= 0) {
            throw new Error("size must be a positive integer");
        }
        this.size = size;
        this.cellCount = size * size;
        this.boardMask = (1n << BigInt(this.cellCount)) - 1n;
        this.leftColMask = this.firstColumnMask(size);
        this.rightColMask = this.leftColMask << BigInt(size - 1);
        this.reset();
    }

    get currentPlayer() {
        return this.side;
    }

    reset() {
        this.black = 0n;
        this.white = 0n;
        this.dead = 0n;
        this.adjBlack = 0n;
        this.adjWhite = 0n;
        this.side = Player.BLACK;
        this.result = GameResult.ONGOING;
        this.updateResult();
    }

    clone() {
        const cloned = new IsolationChessEnv(this.size);
        cloned.black = this.black;
        cloned.white = this.white;
        cloned.dead = this.dead;
        cloned.adjBlack = this.adjBlack;
        cloned.adjWhite = this.adjWhite;
        cloned.side = this.side;
        cloned.result = this.result;
        return cloned;
    }

    signature() {
        return [
            this.size,
            this.black.toString(16),
            this.white.toString(16),
            this.dead.toString(16),
            this.adjBlack.toString(16),
            this.adjWhite.toString(16),
            this.side,
            this.result
        ].join(":");
    }

    bitAt(row, col) {
        if (!this.inBounds(row, col)) {
            throw new Error(`position out of bounds: (${row}, ${col})`);
        }
        return 1n << BigInt(row * this.size + col);
    }

    legalMask(player = this.side) {
        const empty = this.boardMask & ~(this.black | this.white | this.dead);
        if (player === Player.BLACK) {
            return empty & ~this.adjWhite & this.boardMask;
        }
        if (player === Player.WHITE) {
            return empty & ~this.adjBlack & this.boardMask;
        }
        throw new Error(`invalid player: ${player}`);
    }

    legalCount(player = this.side) {
        return bitCount(this.legalMask(player));
    }

    hasLegalMove(player = this.side) {
        return this.legalMask(player) !== 0n;
    }

    legalMoves(player = this.side) {
        const moves = [];
        let bits = this.legalMask(player);
        while (bits !== 0n) {
            const lsb = bits & -bits;
            const action = this.bitIndex(lsb);
            moves.push({ row: Math.floor(action / this.size), col: action % this.size });
            bits ^= lsb;
        }
        return moves;
    }

    isLegalMove(row, col, player = this.side) {
        if (!this.inBounds(row, col)) return false;
        return (this.legalMask(player) & this.bitAt(row, col)) !== 0n;
    }

    step(move) {
        if (this.result !== GameResult.ONGOING) {
            throw new Error(`game is already finished: ${this.result}`);
        }
        const { row, col } = move;
        const moveBit = this.bitAt(row, col);
        if ((this.legalMask(this.side) & moveBit) === 0n) {
            throw new Error(`illegal move for player ${this.side}: (${row}, ${col})`);
        }

        if (this.side === Player.BLACK) {
            this.black |= moveBit;
            this.adjBlack |= this.neighborMask(moveBit);
        } else {
            this.white |= moveBit;
            this.adjWhite |= this.neighborMask(moveBit);
        }
        this.updateDead();
        this.side = opponentOf(this.side);
        this.updateResult();
        return this.result;
    }

    observation() {
        const board = Array.from({ length: this.size }, () => Array(this.size).fill(0));
        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                const bit = this.bitAt(row, col);
                if ((this.black & bit) !== 0n) board[row][col] = Player.BLACK;
                else if ((this.white & bit) !== 0n) board[row][col] = Player.WHITE;
                else if ((this.dead & bit) !== 0n) board[row][col] = 3;
            }
        }
        return board;
    }

    neighborMask(bits) {
        const shift = BigInt(this.size);
        const north = bits >> shift;
        const south = (bits << shift) & this.boardMask;
        const west = (bits & ~this.leftColMask) >> 1n;
        const east = (bits & ~this.rightColMask) << 1n;
        return (north | south | west | east) & this.boardMask;
    }

    updateDead() {
        const occupied = this.black | this.white;
        const emptyNotDead = this.boardMask & ~(occupied | this.dead);
        this.dead |= this.adjBlack & this.adjWhite & emptyNotDead;
        this.dead &= this.boardMask;
    }

    updateResult() {
        if (this.hasLegalMove(this.side)) {
            this.result = GameResult.ONGOING;
            return;
        }
        if (!this.hasLegalMove(opponentOf(this.side))) {
            this.result = GameResult.DRAW;
        } else if (opponentOf(this.side) === Player.BLACK) {
            this.result = GameResult.BLACK_WIN;
        } else {
            this.result = GameResult.WHITE_WIN;
        }
    }

    inBounds(row, col) {
        return Number.isInteger(row) && Number.isInteger(col)
            && row >= 0 && row < this.size && col >= 0 && col < this.size;
    }

    firstColumnMask(size) {
        return ((1n << BigInt(size * size)) - 1n) / ((1n << BigInt(size)) - 1n);
    }

    bitIndex(singleBit) {
        return singleBit.toString(2).length - 1;
    }
}

export function replayMoves(size, moves) {
    const env = new IsolationChessEnv(size);
    for (const [index, move] of moves.entries()) {
        if (move.player !== env.currentPlayer) {
            throw new Error(`move ${index + 1} has wrong player`);
        }
        env.step({ row: move.row, col: move.col });
    }
    return env;
}
