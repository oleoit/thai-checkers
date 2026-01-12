let board = [], turn = 'white', selected = null, gameActive = false, isMultiJump = false, aiDepth = 3;

function startGame(diff) {
    aiDepth = diff; gameActive = true;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-ui').style.display = 'flex';
    initGame();
}

function backToMenu() {
    gameActive = false;
    document.getElementById('retro-modal').style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';
    document.getElementById('game-ui').style.display = 'none';
}

function initGame() {
    board = Array(8).fill(null).map(() => Array(8).fill(0));
    for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 !== 0) board[r][c] = 2;
    for (let r = 6; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 !== 0) board[r][c] = 1;
    turn = 'white'; isMultiJump = false; selected = null; render();
}

function validateMove(fr, fc, tr, tc, currB) {
    if (tr < 0 || tr > 7 || tc < 0 || tc > 7 || currB[tr][tc] !== 0) return { valid: false };
    const p = currB[fr][fc], dr = tr - fr, dc = tc - fc, absDr = Math.abs(dr), absDc = Math.abs(dc);
    if (absDr !== absDc) return { valid: false };
    const uR = dr / absDr, uC = dc / absDc;

    if (p <= 2) {
        if (absDr === 1) return { valid: (p === 1 ? dr < 0 : dr > 0), capture: false };
        if (absDr === 2) {
            if ((p === 1 && dr > 0) || (p === 2 && dr < 0)) return { valid: false };
            const mid = currB[fr + uR][fc + uC];
            if (mid !== 0 && mid % 2 !== p % 2) return { valid: true, capture: true, mR: fr + uR, mC: fc + uC };
        }
    } else {
        let pCount = 0, mR, mC;
        for (let i = 1; i < absDr; i++) {
            let curr = currB[fr + i * uR][fc + i * uC];
            if (curr !== 0) {
                if (curr % 2 === p % 2) return { valid: false };
                pCount++; mR = fr + i * uR; mC = fc + i * uC;
            }
        }
        if (pCount === 0) return { valid: true, capture: false };
        if (pCount === 1) return { valid: true, capture: true, mR, mC };
    }
    return { valid: false };
}

// AI Minimax + Alpha-Beta Pruning
function aiAction() {
    // เช็คก่อนว่า AI เดินได้ไหม
    let moves = getAllMoves(board, 2);
    if (moves.length === 0) {
        checkWinner(); // จะไปเข้าเงื่อนไข "บอทเดินไม่ได้" และจบเกม
        return;
    }

    let best = minimax(board, aiDepth, -Infinity, Infinity, true);
    if (best.move) {
        executeMove(best.move.fr, best.move.fc, best.move.tr, best.move.tc, best.move.data);
    } else {
        endTurn();
    }
}

function minimax(simB, depth, alpha, beta, isMax) {
    if (depth === 0) return { score: evaluate(simB) };
    let moves = getAllMoves(simB, isMax ? 2 : 1);
    if (moves.length === 0) return { score: isMax ? -1000 : 1000 };
    
    let jumps = moves.filter(m => m.data.capture);
    let targets = jumps.length > 0 ? jumps : moves;
    let bestMove = null;

    if (isMax) {
        let maxS = -Infinity;
        for (let m of targets) {
            let nextB = JSON.parse(JSON.stringify(simB));
            applyMove(m.fr, m.fc, m.tr, m.tc, m.data, nextB);
            let res = minimax(nextB, depth - 1, alpha, beta, false);
            if (res.score > maxS) { maxS = res.score; bestMove = m; }
            alpha = Math.max(alpha, maxS); if (beta <= alpha) break;
        }
        return { score: maxS, move: bestMove };
    } else {
        let minS = Infinity;
        for (let m of targets) {
            let nextB = JSON.parse(JSON.stringify(simB));
            applyMove(m.fr, m.fc, m.tr, m.tc, m.data, nextB);
            let res = minimax(nextB, depth - 1, alpha, beta, true);
            if (res.score < minS) { minS = res.score; bestMove = m; }
            beta = Math.min(beta, minS); if (beta <= alpha) break;
        }
        return { score: minS, move: bestMove };
    }
}

function evaluate(b) {
    let s = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        if (b[r][c] === 2) s += (10 + r); else if (b[r][c] === 4) s += 50;
        else if (b[r][c] === 1) s -= (10 + (7 - r)); else if (b[r][c] === 3) s -= 50;
    }
    return s;
}

function getAllMoves(b, player) {
    let m = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        if (b[r][c] !== 0 && b[r][c] % 2 === player % 2) {
            for (let dr = -7; dr <= 7; dr++) for (let dc = -7; dc <= 7; dc++) {
                if (Math.abs(dr) === Math.abs(dc) && dr !== 0) {
                    let res = validateMove(r, c, r + dr, c + dc, b);
                    if (res.valid) m.push({ fr: r, fc: c, tr: r + dr, tc: c + dc, data: res });
                }
            }
        }
    }
    return m;
}

function applyMove(fr, fc, tr, tc, data, b) {
    if (data.capture) b[data.mR][data.mC] = 0;
    b[tr][tc] = b[fr][fc]; b[fr][fc] = 0;
    if (tr === 0 && b[tr][tc] === 1) b[tr][tc] = 3;
    if (tr === 7 && b[tr][tc] === 2) b[tr][tc] = 4;
}

function handleSquareClick(r, c) {
    if (!gameActive || turn !== 'white') return;
    if (board[r][c] === 1 || board[r][c] === 3) { if (!isMultiJump) selected = { r, c }; }
    else if (selected && board[r][c] === 0) {
        const res = validateMove(selected.r, selected.c, r, c, board);
        if (res.valid) {
            let jumps = getAllMoves(board, 1).filter(m => m.data.capture);
            if (jumps.length > 0 && !res.capture) return;
            executeMove(selected.r, selected.c, r, c, res);
        }
    }
    render();
}

function executeMove(fr, fc, tr, tc, res) {
    applyMove(fr, fc, tr, tc, res, board);
    let kinged = (tr === 0 && board[tr][tc] === 3) || (tr === 7 && board[tr][tc] === 4);
    if (!kinged && res.capture && getAllMoves(board, board[tr][tc]).some(m => m.fr === tr && m.fc === tc && m.data.capture)) {
        isMultiJump = true; selected = { r: tr, c: tc };
    } else { endTurn(); }
}

function endTurn() {
    isMultiJump = false; selected = null; if (checkWinner()) return;
    turn = (turn === 'white' ? 'black' : 'white');
    document.getElementById('status').innerText = (turn === 'white' ? "YOUR TURN" : "CPU THINKING");
    if (turn === 'black') setTimeout(aiAction, 600);
    render();
}

function checkWinner() {
    let w = 0, b = 0;
    let whiteCanMove = false;
    let blackCanMove = false;

    // 1. นับจำนวนหมากและเช็คว่าแต่ละฝ่ายยังเดินได้ไหม
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p === 1 || p === 3) {
                w++;
                if (!whiteCanMove && getAllMoves(board, 1).length > 0) whiteCanMove = true;
            }
            if (p === 2 || p === 4) {
                b++;
                if (!blackCanMove && getAllMoves(board, 2).length > 0) blackCanMove = true;
            }
        }
    }

    document.getElementById('white-count').innerText = w;
    document.getElementById('black-count').innerText = b;

    // 2. เงื่อนไขการตัดสินแพ้ชนะ
    // แพ้เมื่อ: หมากหมด (count === 0) หรือ เดินไม่ได้แล้ว (!canMove)
    if (w === 0 || !whiteCanMove) {
        gameActive = false;
        let msg = w === 0 ? "หมากของคุณหมดแล้ว!" : "คุณไม่เหลือตาให้เดินแล้ว (หมากตาย)!";
        showRetroModal("GAME OVER", msg);
        return true;
    }
    if (b === 0 || !blackCanMove) {
        gameActive = false;
        let msg = b === 0 ? "บอทหมากหมดแล้ว!" : "บอทไม่เหลือตาให้เดินแล้ว (หมากตาย)!";
        showRetroModal("VICTORY", msg);
        return true;
    }
    return false;
}

function showRetroModal(title, message) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = message;
    document.getElementById('retro-modal').style.display = 'flex';
}

function render() {
    const bEl = document.getElementById('board'); bEl.innerHTML = '';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const cell = document.createElement('div'); cell.className = `cell ${(r+c)%2===0?'white-cell':'black-cell'}`;
        const p = board[r][c];
        if (p !== 0) {
            const d = document.createElement('div'); d.className = `piece ${p%2===0?'black-piece':'white-piece'} ${p>2?'king':''}`;
            if (selected && selected.r === r && selected.c === c) d.classList.add('selected');
            cell.appendChild(d);
        }
        cell.onclick = () => handleSquareClick(r, c); bEl.appendChild(cell);
    }
}