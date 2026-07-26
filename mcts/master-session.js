import { IsolationChessEnv } from "./chess-engine.js";
import { DEFAULT_MCTS_PARAMS, MCTSAgent } from "./mcts-engine.js";

function sameMove(left, right) {
    return left && right
        && left.row === right.row
        && left.col === right.col
        && left.player === right.player;
}

export class MasterSession {
    constructor() {
        this.state = null;
    }

    rebuild(message) {
        const env = new IsolationChessEnv(message.boardSize);
        const history = [];
        for (const move of message.moves) {
            if (move.player !== env.currentPlayer) throw new Error("invalid move order");
            env.step(move);
            history.push({ row: move.row, col: move.col, player: move.player });
        }
        this.state = {
            gameId: message.gameId,
            aiColor: message.aiColor,
            env,
            history,
            agent: new MCTSAgent(message.aiColor, {
                ...DEFAULT_MCTS_PARAMS,
                ...message.params,
                timeLimit: message.timeLimit || DEFAULT_MCTS_PARAMS.timeLimit
            })
        };
    }

    sync(message) {
        const reusable = this.state
            && this.state.gameId === message.gameId
            && this.state.aiColor === message.aiColor
            && this.state.env.size === message.boardSize
            && message.moves.length >= this.state.history.length
            && this.state.history.every((move, index) => sameMove(move, message.moves[index]));
        if (!reusable) {
            this.rebuild(message);
            return;
        }
        for (let index = this.state.history.length; index < message.moves.length; index++) {
            const move = message.moves[index];
            if (move.player !== this.state.env.currentPlayer) throw new Error("invalid move order");
            this.state.env.step(move);
            this.state.agent.applyMove(this.state.env, move);
            this.state.history.push({ row: move.row, col: move.col, player: move.player });
        }
    }

    choose(message) {
        this.sync(message);
        if (this.state.env.currentPlayer !== this.state.aiColor) {
            throw new Error("not AI turn");
        }
        const stats = this.state.agent.chooseMove(this.state.env);
        const move = stats.move;
        this.state.env.step(move);
        this.state.agent.applyMove(this.state.env, move);
        this.state.history.push({ row: move.row, col: move.col, player: this.state.aiColor });
        return {
            row: move.row,
            col: move.col,
            simulations: stats.roundSimulations,
            elapsedSeconds: stats.elapsedSeconds,
            reusedTree: stats.reusedTree
        };
    }
}
