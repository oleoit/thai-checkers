// ตัวแปรควบคุมสถานะเกม
let board = [], turn = 'white', selected = null, gameActive = false, isMultiJump = false, aiDepth = 3;

/**
 * เริ่มต้นเกมใหม่
 * @param {number} diff - ระดับความยาก (1: Easy, 4: Normal, 6: Hard)
 */
function startGame(diff) {
    // ปรับความลึกสูงสุดที่ 6 สำหรับ Hard เพื่อป้องกันเบราว์เซอร์ค้าง
    aiDepth = (diff === 8) ? 6 : diff; 
    gameActive = true;
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
    // สร้างกระดาน 8x8 (0=ว่าง, 1=ขาวปกติ, 2=ดำปกติ, 3=ขาวฮอส, 4=ดำฮอส)
    board = Array(8).fill(null).map(() => Array(8).fill(0));
    
    // วางหมากดำ (บน)
    for (let r = 0; r < 2; r++) 
        for (let c = 0; c < 8; c++) 
            if ((r + c) % 2 !== 0) board[r][c] = 2;
            
    // วางหมากขาว (ล่าง)
    for (let r = 6; r < 8; r++) 
        for (let c = 0; c < 8; c++) 
            if ((r + c) % 2 !== 0) board[r][c] = 1;
            
    turn = 'white'; 
    isMultiJump = false; 
    selected = null; 
    render();
}

// ตรวจสอบความถูกต้องของการเดิน
function validateMove(fr, fc, tr, tc, currB) {
    if (tr < 0 || tr > 7 || tc < 0 || tc > 7 || currB[tr][tc] !== 0) return { valid: false };
    const p = currB[fr][fc], dr = tr - fr, dc = tc - fc, absDr = Math.abs(dr), absDc = Math.abs(dc);
    if (absDr !== absDc) return { valid: false };
    const uR = dr / absDr, uC = dc / absDc;

    // หมากปกติ
    if (p <= 2) {
        if (absDr === 1) return { valid: (p === 1 ? dr < 0 : dr > 0), capture: false };
        if (absDr === 2) {
            if ((p === 1 && dr > 0) || (p === 2 && dr < 0)) return { valid: false };
            const mid = currB[fr + uR][fc + uC];
            if (mid !== 0 && mid % 2 !== p % 2) return { valid: true, capture: true, mR: fr + uR, mC: fc + uC };
        }
    } 
    // หมากฮอส (เดินได้หลายช่อง)
    else {
        let pCount = 0, mR, mC;
        for (let i = 1; i < absDr; i++) {
            let curr = currB[fr + i * uR][fc + i * uC];
            if (curr !== 0) {
                if (curr % 2 === p % 2) return { valid: false }; // ติดหมากตัวเอง
                pCount++; mR = fr + i * uR; mC = fc + i * uC;
            }
        }
        if (pCount === 0) return { valid: true, capture: false };
        if (pCount === 1) return { valid: true, capture: true, mR, mC };
    }
    return { valid: false };
}

// AI Minimax + Alpha-Beta Pruning (Optimized)
function aiAction() {
    let moves = getAllMoves(board, 2);
    if (moves.length === 0) {
        checkWinner();
        return;
    }

    // ประมวลผลหาท่าที่ดีที่สุด
    let result = minimax(board, aiDepth, -Infinity, Infinity, true);
    
    if (result.move) {
        executeMove(result.move.fr, result.move.fc, result.move.tr, result.move.tc, result.move.data);
    } else {
        // กรณีฉุกเฉินถ้าหาท่าเดินไม่ได้ (เช่น หมากติดหมด)
        let fallback = moves[Math.floor(Math.random() * moves.length)];
        executeMove(fallback.fr, fallback.fc, fallback.tr, fallback.tc, fallback.data);
    }
}

function minimax(simB, depth, alpha, beta, isMax) {
    if (depth === 0) return { score: evaluate(simB) };
    
    let moves = getAllMoves(simB, isMax ? 2 : 1);
    if (moves.length === 0) return { score: isMax ? -1000 : 1000 };
    
    // กฎหมากฮอสไทย: "บังคับกิน" ถ้ามีหมากให้กินต้องกิน
    let jumps = moves.filter(m => m.data.capture);
    let targets = jumps.length > 0 ? jumps : moves;
    
    let bestMove = null;

    if (isMax) {
        let maxS = -Infinity;
        for (let m of targets) {
            let nextB = simB.map(row => [...row]); // เร็วกว่า JSON.stringify
            applyMove(m.fr, m.fc, m.tr, m.tc, m.data, nextB);
            let res = minimax(nextB, depth - 1, alpha, beta, false);
            if (res.score > maxS) { maxS = res.score; bestMove = m; }
            alpha = Math.max(alpha, maxS);
            if (beta <= alpha) break;
        }
        return { score: maxS, move: bestMove };
    } else {
        let minS = Infinity;
        for (let m of targets) {
            let nextB = simB.map(row => [...row]);
            applyMove(m.fr, m.fc, m.tr, m.tc, m.data, nextB);
            let res = minimax(nextB, depth - 1, alpha, beta, true);
            if (res.score < minS) { minS = res.score; bestMove = m; }
            beta = Math.min(beta, minS);
            if (beta <= alpha) break;
        }
        return { score: minS, move: bestMove };
    }
}

// ระบบให้คะแนนตำแหน่งหมาก
function evaluate(b) {
    let s = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (b[r][c] === 2) s += (20 + r); // หมากปกติ (ยิ่งสูงยิ่งดี)
            else if (b[r][c] === 4) s += 100; // ฮอส
            else if (b[r][c] === 1) s -= (20 + (7 - r)); // หมากผู้เล่น
            else if (b[r][c] === 3) s -= 100; // ฮอสผู้เล่น
        }
    }
    return s;
}

function getAllMoves(b, player) {
    let m = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (b[r][c] !== 0 && b[r][c] % 2 === player % 2) {
                // ตรวจสอบรอบตัว (รัศมี 1-7 สำหรับฮอส)
                for (let dr = -7; dr <= 7; dr++) {
                    for (let dc = -7; dc <= 7; dc++) {
                        if (Math.abs(dr) === Math.abs(dc) && dr !== 0) {
                            let res = validateMove(r, c, r + dr, c + dc, b);
                            if (res.valid) m.push({ fr: r, fc: c, tr: r + dr, tc: c + dc, data: res });
                        }
                    }
                }
            }
        }
    }
    return m;
}

function applyMove(fr, fc, tr, tc, data, b) {
    if (data.capture) b[data.mR][data.mC] = 0;
    b[tr][tc] = b[fr][fc]; 
    b[fr][fc] = 0;
    // เป็นฮอสเมื่อถึงฝั่ง
    if (tr === 0 && b[tr][tc] === 1) b[tr][tc] = 3;
    if (tr === 7 && b[tr][tc] === 2) b[tr][tc] = 4;
}

function handleSquareClick(r, c) {
    if (!gameActive || turn !== 'white') return;
    
    // เลือกหมาก
    if (board[r][c] === 1 || board[r][c] === 3) { 
        if (!isMultiJump) selected = { r, c }; 
    } 
    // เดินไปยังช่องว่าง
    else if (selected && board[r][c] === 0) {
        const res = validateMove(selected.r, selected.c, r, c, board);
        if (res.valid) {
            // เช็คว่ามีตัวอื่นที่บังคับกินไหม
            let allMoves = getAllMoves(board, 1);
            let jumps = allMoves.filter(m => m.data.capture);
            if (jumps.length > 0 && !res.capture) {
                alert("ต้องกินหมากฝ่ายตรงข้ามก่อน!");
                return;
            }
            executeMove(selected.r, selected.c, r, c, res);
        }
    }
    render();
}

function executeMove(fr, fc, tr, tc, res) {
    applyMove(fr, fc, tr, tc, res, board);
    
    // ตรวจสอบการกินต่อเนื่อง
    let canJumpMore = false;
    if (res.capture) {
        let moreMoves = getAllMoves(board, board[tr][tc]);
        canJumpMore = moreMoves.some(m => m.fr === tr && m.fc === tc && m.data.capture);
    }

    if (canJumpMore) {
        isMultiJump = true; 
        selected = { r: tr, c: tc };
        if (turn === 'black') setTimeout(aiAction, 500); // ถ้าเป็น AI ให้กินต่อทันที
    } else { 
        endTurn(); 
    }
    render();
}

function endTurn() {
    isMultiJump = false; 
    selected = null; 
    if (checkWinner()) return;
    
    turn = (turn === 'white' ? 'black' : 'white');
    document.getElementById('status').innerText = (turn === 'white' ? "YOUR TURN" : "CPU THINKING");
    
    if (turn === 'black') {
        setTimeout(aiAction, 600);
    }
}

function checkWinner() {
    let w = 0, b = 0;
    let whiteCanMove = getAllMoves(board, 1).length > 0;
    let blackCanMove = getAllMoves(board, 2).length > 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === 1 || board[r][c] === 3) w++;
            if (board[r][c] === 2 || board[r][c] === 4) b++;
        }
    }

    document.getElementById('white-count').innerText = w;
    document.getElementById('black-count').innerText = b;

    if (w === 0 || !whiteCanMove) {
        showRetroModal("GAME OVER", "คุณพ่ายแพ้ให้กับระบบ!");
        gameActive = false;
        return true;
    }
    if (b === 0 || !blackCanMove) {
        showRetroModal("VICTORY", "คุณชนะ! บอทเดินต่อไม่ได้");
        gameActive = false;
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
    const bEl = document.getElementById('board'); 
    bEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div'); 
            cell.className = `cell ${(r+c)%2===0?'white-cell':'black-cell'}`;
            const p = board[r][c];
            if (p !== 0) {
                const d = document.createElement('div'); 
                d.className = `piece ${p%2===0?'black-piece':'white-piece'} ${p>2?'king':''}`;
                if (selected && selected.r === r && selected.c === c) d.classList.add('selected');
                cell.appendChild(d);
            }
            cell.onclick = () => handleSquareClick(r, c); 
            bEl.appendChild(cell);
        }
    }
}