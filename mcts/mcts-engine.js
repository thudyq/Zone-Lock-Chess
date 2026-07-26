import { GameResult, Player, bitCount, opponentOf } from "./chess-engine.js";

export const DEFAULT_MCTS_PARAMS = Object.freeze({
    timeLimit: 2.0,
    exploration: Math.sqrt(4.0),
    visitFractionThreshold: 0.8,
    rolloutTemperature: 1.3,
    rolloutCandidateLimit: 12,
    maxSearchSteps: 8,
    valueDeadzoneRatio: 0.01
});

export class RandomSource {
    constructor(seed = null) {
        if (seed === null || seed === undefined) {
            this.next = () => Math.random();
        } else {
            let state = Number(seed) >>> 0;
            this.next = () => {
                state += 0x6D2B79F5;
                let value = state;
                value = Math.imul(value ^ (value >>> 15), value | 1);
                value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
                return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
            };
        }
    }

    randrange(length) {
        return Math.floor(this.next() * length);
    }

    choice(items) {
        return items[this.randrange(items.length)];
    }

    sample(items, count) {
        const copy = items.slice();
        for (let index = 0; index < count; index++) {
            const selected = index + this.randrange(copy.length - index);
            [copy[index], copy[selected]] = [copy[selected], copy[index]];
        }
        return copy.slice(0, count);
    }

    weightedChoice(items, weights) {
        const total = weights.reduce((sum, weight) => sum + weight, 0);
        let target = this.next() * total;
        for (let index = 0; index < items.length; index++) {
            target -= weights[index];
            if (target <= 0) return items[index];
        }
        return items[items.length - 1];
    }
}

function movesEqual(left, right) {
    return left && right && left.row === right.row && left.col === right.col;
}

export function rewardForPlayer(player, result) {
    if (result === GameResult.DRAW || result === GameResult.ONGOING) return 0;
    if (result === GameResult.BLACK_WIN) return player === Player.BLACK ? 1 : -1;
    return player === Player.WHITE ? 1 : -1;
}

export function evaluatePosition(env, player, deadzoneRatio = DEFAULT_MCTS_PARAMS.valueDeadzoneRatio) {
    const diff = env.legalCount(player) - env.legalCount(opponentOf(player));
    const totalCells = env.size * env.size;
    const deadzone = Math.max(1, Math.trunc(totalCells * deadzoneRatio));
    const advantage = Math.max(0, Math.abs(diff) - deadzone);
    if (advantage === 0) return 0;
    const normalized = advantage / Math.max(1, totalCells - deadzone);
    const value = normalized * normalized;
    return diff > 0 ? value : -value;
}

class MCTSNode {
    constructor(env, parent = null, move = null, depth = 0) {
        this.env = env;
        this.parent = parent;
        this.move = move;
        this.visits = 0;
        this.wins = 0;
        this.depth = depth;
        this.children = [];
        this.untriedMoves = env.result === GameResult.ONGOING ? env.legalMoves() : [];
        this.signature = env.signature();
    }

    isFullyExpanded() {
        return this.untriedMoves.length === 0;
    }

    findChildByMove(move) {
        return this.children.find(child => movesEqual(child.move, move)) || null;
    }

    matchesEnv(env) {
        return this.signature === env.signature();
    }

    bestUcbChild(exploration, maximizing) {
        if (this.children.length === 0) throw new Error("node has no children");
        const parentVisits = Math.max(1, this.visits);
        let best = null;
        let bestScore = -Infinity;
        for (const child of this.children) {
            let score;
            if (child.visits === 0) {
                score = Infinity;
            } else {
                let exploitation = child.wins / child.visits;
                if (!maximizing) exploitation = -exploitation;
                score = exploitation
                    + exploration * Math.sqrt(Math.log(parentVisits) / child.visits);
            }
            if (score > bestScore) {
                bestScore = score;
                best = child;
            }
        }
        return best;
    }

    robustBestChild(maximizing, visitFractionThreshold) {
        if (this.children.length === 0) return null;
        const maxVisits = Math.max(...this.children.map(child => child.visits));
        const minVisits = Math.max(1, Math.ceil(maxVisits * visitFractionThreshold));
        let candidates = this.children.filter(child => child.visits >= minVisits);
        if (candidates.length === 0) candidates = this.children;
        let best = null;
        let bestAverage = -Infinity;
        let bestVisits = -1;
        for (const child of candidates) {
            const rawAverage = child.visits === 0
                ? (maximizing ? -Infinity : Infinity)
                : child.wins / child.visits;
            const average = maximizing ? rawAverage : -rawAverage;
            if (average > bestAverage || (average === bestAverage && child.visits > bestVisits)) {
                bestAverage = average;
                bestVisits = child.visits;
                best = child;
            }
        }
        return best;
    }
}

export class MCTSAgent {
    constructor(player, params = {}, rng = null) {
        this.player = player;
        this.params = { ...DEFAULT_MCTS_PARAMS, ...params };
        if (this.params.timeLimit <= 0 || this.params.maxSearchSteps <= 0) {
            throw new Error("timeLimit and maxSearchSteps must be positive");
        }
        this.rng = rng || new RandomSource();
        this.root = null;
    }

    chooseMove(env) {
        const reusedTree = this.ensureRoot(env);
        const legalMoves = env.legalMoves(env.currentPlayer);
        if (legalMoves.length === 0) throw new Error("no legal moves");
        const start = performance.now();
        let roundSimulations = 0;

        if (legalMoves.length === 1) {
            const move = legalMoves[0];
            const child = this.root.findChildByMove(move);
            return {
                move,
                roundSimulations: 0,
                treeSimulations: this.root.visits,
                recommendedBranchSimulations: child ? child.visits : 0,
                elapsedSeconds: (performance.now() - start) / 1000,
                reusedTree
            };
        }

        const safetySeconds = Math.min(0.02, this.params.timeLimit * 0.2);
        const searchMilliseconds = Math.max(1, (this.params.timeLimit - safetySeconds) * 1000);
        const deadline = start + searchMilliseconds;
        while (performance.now() < deadline) {
            let node = this.select(this.root);
            node = this.expand(node);
            const reward = this.rollout(node.env, node.depth);
            this.backpropagate(node, reward);
            roundSimulations++;
        }

        const maximizingRoot = env.currentPlayer === this.player;
        const bestChild = this.root.robustBestChild(
            maximizingRoot,
            this.params.visitFractionThreshold
        );
        const move = bestChild && bestChild.move ? bestChild.move : this.rng.choice(legalMoves);
        return {
            move,
            roundSimulations,
            treeSimulations: this.root.visits,
            recommendedBranchSimulations: bestChild ? bestChild.visits : 0,
            elapsedSeconds: (performance.now() - start) / 1000,
            reusedTree
        };
    }

    applyMove(envAfterMove, move) {
        if (!this.root) {
            this.root = new MCTSNode(envAfterMove.clone());
            return false;
        }
        const child = this.root.findChildByMove(move);
        if (child && child.matchesEnv(envAfterMove)) {
            child.parent = null;
            this.rebaseDepths(child, 0);
            this.root = child;
            return true;
        }
        this.root = new MCTSNode(envAfterMove.clone());
        return false;
    }

    ensureRoot(env) {
        if (this.root && this.root.matchesEnv(env)) {
            this.rebaseDepths(this.root, 0);
            return true;
        }
        this.root = new MCTSNode(env.clone());
        return false;
    }

    rebaseDepths(node, depth) {
        node.depth = depth;
        for (const child of node.children) this.rebaseDepths(child, depth + 1);
    }

    select(node) {
        while (
            node.env.result === GameResult.ONGOING
            && node.depth < this.params.maxSearchSteps
            && node.isFullyExpanded()
            && node.children.length > 0
        ) {
            node = node.bestUcbChild(
                this.params.exploration,
                node.env.currentPlayer === this.player
            );
        }
        return node;
    }

    expand(node) {
        if (
            node.env.result !== GameResult.ONGOING
            || node.depth >= this.params.maxSearchSteps
            || node.untriedMoves.length === 0
        ) return node;

        const index = this.rng.randrange(node.untriedMoves.length);
        const [move] = node.untriedMoves.splice(index, 1);
        const childEnv = node.env.clone();
        childEnv.step(move);
        const child = new MCTSNode(childEnv, node, move, node.depth + 1);
        node.children.push(child);
        return child;
    }

    rollout(env, usedSteps = 0) {
        const rolloutEnv = env.clone();
        let steps = usedSteps;
        while (
            rolloutEnv.result === GameResult.ONGOING
            && steps < this.params.maxSearchSteps
        ) {
            const legalMoves = rolloutEnv.legalMoves(rolloutEnv.currentPlayer);
            if (legalMoves.length === 0) break;
            rolloutEnv.step(this.rolloutPolicyMove(rolloutEnv, legalMoves));
            steps++;
        }
        if (rolloutEnv.result !== GameResult.ONGOING) {
            return rewardForPlayer(this.player, rolloutEnv.result);
        }
        return evaluatePosition(rolloutEnv, this.player, this.params.valueDeadzoneRatio);
    }

    rolloutPolicyMove(env, legalMoves) {
        if (legalMoves.length === 1) return legalMoves[0];
        const opponentLegalMask = env.legalMask(opponentOf(env.currentPlayer));
        const candidates = legalMoves.length > this.params.rolloutCandidateLimit
            ? this.rng.sample(legalMoves, this.params.rolloutCandidateLimit)
            : legalMoves;
        const scored = candidates.map(move => {
            const moveBit = env.bitAt(move.row, move.col);
            const neighborMask = env.neighborMask(moveBit);
            const opponentLoss = bitCount(opponentLegalMask & (moveBit | neighborMask));
            const ownFutureMoves = legalMoves.length - 1;
            const opponentFutureMoves = bitCount(opponentLegalMask) - opponentLoss;
            return { move, score: ownFutureMoves - opponentFutureMoves };
        });
        const maxScore = Math.max(...scored.map(item => item.score));
        const weights = scored.map(item =>
            Math.exp((item.score - maxScore) / this.params.rolloutTemperature)
        );
        return this.rng.weightedChoice(scored.map(item => item.move), weights);
    }

    backpropagate(node, reward) {
        while (node) {
            node.visits++;
            node.wins += reward;
            node = node.parent;
        }
    }
}
