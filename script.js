// ตัวแปรควบคุมสถานะเกม
let board = [], turn = 'white', selected = null, gameActive = false, isMultiJump = false, aiDepth = 4, currentDiff = 4;

// ระบบเสียง (Web Audio API - Retro 8-bit Synthesizer)
let soundEnabled = true;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function toggleSound() {
    initAudio();
    soundEnabled = !soundEnabled;
    updateSoundUI();
}

function updateSoundUI() {
    const startBtn = document.getElementById('start-sound-btn');
    const gameBtn = document.getElementById('game-sound-btn');
    if (startBtn) startBtn.innerText = soundEnabled ? "🔊 เสียง: เปิด" : "🔇 เสียง: ปิด";
    if (gameBtn) gameBtn.innerText = soundEnabled ? "🔊" : "🔇";
}

function playTone(freq, type, duration, gainVal = 0.15, endFreq = null) {
    if (!soundEnabled) return;
    try {
        initAudio();
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        const now = audioCtx.currentTime;
        osc.frequency.setValueAtTime(freq, now);
        if (endFreq !== null) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), now + duration);
        }
        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + duration);
    } catch (e) {
        // audio context handling
    }
}

// เสียงเดินหมากทั่วไป (เสียงเคาะนุ่มนวล)
function playMoveSound() {
    playTone(320, 'triangle', 0.07, 0.15, 120);
}

// เสียงกินหมาก (เสียงกระแทกสะใจ)
function playCaptureSound() {
    playTone(480, 'square', 0.06, 0.18, 160);
    setTimeout(() => {
        playTone(190, 'triangle', 0.12, 0.22, 50);
    }, 45);
}

// เสียงเข้าฮอส (เสียง 8-bit Fanfare แวววาว)
function playCrownSound() {
    if (!soundEnabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
        setTimeout(() => {
            playTone(freq, 'sine', 0.1, 0.16);
        }, idx * 60);
    });
}

// เสียงชนะ (Victory Fanfare)
function playVictorySound() {
    if (!soundEnabled) return;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
        setTimeout(() => {
            playTone(freq, 'triangle', 0.2, 0.2);
        }, idx * 110);
    });
}

// เสียงแพ้ (Defeat Fanfare)
function playDefeatSound() {
    if (!soundEnabled) return;
    const notes = [440, 415.3, 392, 349.23];
    notes.forEach((freq, idx) => {
        setTimeout(() => {
            playTone(freq, 'sawtooth', 0.2, 0.15);
        }, idx * 130);
    });
}

// Transposition Table สำหรับจดจำรูปหมากที่คำนวณแล้ว
const transTable = new Map();
const MAX_TT_SIZE = 50000;

/**
 * เริ่มต้นเกมใหม่
 * @param {number} diff - ระดับความยาก (1: Easy, 4: Normal, 8: Hard)
 */
function startGame(diff) {
    initAudio();
    currentDiff = diff;
    if (diff === 1) {
        aiDepth = 3; // ง่าย (เล่นสบาย แต่มี Blunder Filter ไม่เดินแจกหมากฟรี)
    } else if (diff === 4) {
        aiDepth = 5; // ปานกลาง
    } else {
        aiDepth = 7; // ยาก (AI Smart Master)
    }
    gameActive = true;
    transTable.clear();
    updateSoundUI();
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-ui').style.display = 'flex';
    initGame();
}

function backToMenu() {
    gameActive = false;
    document.getElementById('retro-modal').style.display = 'none';
    const rulesModal = document.getElementById('rules-modal');
    if (rulesModal) rulesModal.style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';
    document.getElementById('game-ui').style.display = 'none';
}

function openRules() {
    initAudio();
    playTone(440, 'triangle', 0.1, 0.15);
    const modal = document.getElementById('rules-modal');
    if (modal) modal.style.display = 'flex';
}

function closeRules() {
    initAudio();
    playTone(330, 'triangle', 0.08, 0.15);
    const modal = document.getElementById('rules-modal');
    if (modal) modal.style.display = 'none';
}

function initGame() {
    // สร้างกระดาน 8x8 (0=ว่าง, 1=ขาวปกติ, 2=ดำปกติ, 3=ขาวฮอส, 4=ดำฮอส)
    board = Array(8).fill(null).map(() => Array(8).fill(0));
    
    // วางหมากดำ (บน - AI)
    for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 !== 0) board[r][c] = 2;
        }
    }
            
    // วางหมากขาว (ล่าง - ผู้เล่น)
    for (let r = 6; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if ((r + c) % 2 !== 0) board[r][c] = 1;
        }
    }
            
    turn = 'white'; 
    isMultiJump = false; 
    selected = null; 
    
    document.getElementById('status').innerText = "ตาของคุณ";
    const badge = document.getElementById('status-badge');
    if (badge) badge.classList.remove('ai-turn');
    document.getElementById('white-count').innerText = "8";
    document.getElementById('black-count').innerText = "8";
    
    render();
}

// ตรวจสอบความถูกต้องของการเดิน
function validateMove(fr, fc, tr, tc, currB) {
    if (tr < 0 || tr > 7 || tc < 0 || tc > 7 || currB[tr][tc] !== 0) return { valid: false };
    const p = currB[fr][fc];
    const dr = tr - fr, dc = tc - fc;
    const absDr = Math.abs(dr), absDc = Math.abs(dc);
    if (absDr !== absDc || absDr === 0) return { valid: false };
    
    const uR = dr / absDr, uC = dc / absDc;

    // หมากปกติ (เดินหน้าได้อย่างเดียว)
    if (p <= 2) {
        // เดิน 1 ช่องธรรมดา
        if (absDr === 1) {
            return { valid: (p === 1 ? dr < 0 : dr > 0), capture: false };
        }
        // กิน 2 ช่อง (หมากฮอสไทย เบี้ยปกติกินไปข้างหน้าได้อย่างเดียว)
        if (absDr === 2) {
            if ((p === 1 && dr > 0) || (p === 2 && dr < 0)) return { valid: false };
            const mid = currB[fr + uR][fc + uC];
            if (mid !== 0 && mid % 2 !== p % 2) {
                return { valid: true, capture: true, mR: fr + uR, mC: fc + uC };
            }
        }
    } 
    // หมากฮอส (เดินและกินได้หลายช่องตามแนวทแยง)
    else {
        let pCount = 0, mR = -1, mC = -1;
        for (let i = 1; i < absDr; i++) {
            let curr = currB[fr + i * uR][fc + i * uC];
            if (curr !== 0) {
                if (curr % 2 === p % 2) return { valid: false }; // ติดหมากฝ่ายเดียวกัน
                pCount++; 
                mR = fr + i * uR; 
                mC = fc + i * uC;
            }
        }
        if (pCount === 0) return { valid: true, capture: false };
        if (pCount === 1) {
            // กติกาหมากฮอสไทย: เมื่อฮอสกิน จะต้องวางลงที่ "ช่องถัดจากตัวที่ถูกกิน 1 ช่องทันที"
            if (tr === mR + uR && tc === mC + uC) {
                return { valid: true, capture: true, mR, mC };
            }
        }
    }
    return { valid: false };
}

// หาตาเดินทั้งหมดของผู้เล่น
function getAllMoves(b, player, filterPos = null, onlyCaptures = false) {
    let moves = [];
    let hasCapture = false;

    let rStart = filterPos ? filterPos.r : 0;
    let rEnd = filterPos ? filterPos.r : 7;
    let cStart = filterPos ? filterPos.c : 0;
    let cEnd = filterPos ? filterPos.c : 7;

    for (let r = rStart; r <= rEnd; r++) {
        for (let c = cStart; c <= cEnd; c++) {
            const p = b[r][c];
            if (p !== 0 && p % 2 === player % 2) {
                const isKing = p > 2;
                const maxSteps = isKing ? 7 : 2;

                for (let step = 1; step <= maxSteps; step++) {
                    const directions = [
                        { dr: step, dc: step },
                        { dr: step, dc: -step },
                        { dr: -step, dc: step },
                        { dr: -step, dc: -step }
                    ];

                    for (let d of directions) {
                        let tr = r + d.dr;
                        let tc = c + d.dc;
                        if (tr >= 0 && tr <= 7 && tc >= 0 && tc <= 7) {
                            let res = validateMove(r, c, tr, tc, b);
                            if (res.valid) {
                                if (res.capture) hasCapture = true;
                                moves.push({ fr: r, fc: c, tr, tc, data: res });
                            }
                        }
                    }
                }
            }
        }
    }

    // ถ้ามีตากิน หรือถูกเรียกให้หาเฉพาะตากิน (เช่น ตรวจสอบ multi-jump)
    if (hasCapture || onlyCaptures) {
        return moves.filter(m => m.data.capture);
    }
    return moves;
}

// ----------------------------------------------------
// ระบบ AI Smart: Minimax + Alpha-Beta + Quiescence + Blunder Prevention
// ----------------------------------------------------

function aiAction() {
    let rawMoves = getAllMoves(board, 2, isMultiJump ? selected : null, isMultiJump);
    if (rawMoves.length === 0) {
        if (isMultiJump) {
            endTurn();
        } else {
            checkWinner();
        }
        return;
    }

    // ถ้าเหลือตาเดินเดียว (เช่น กำลังกินต่อเนื่อง หรือโดนบังคับกิน)
    if (rawMoves.length === 1) {
        executeMove(rawMoves[0].fr, rawMoves[0].fc, rawMoves[0].tr, rawMoves[0].tc, rawMoves[0].data);
        return;
    }

    // ประเมินคะแนนของทุกท่าเดินที่เป็นไปได้
    let evaluatedMoves = [];
    for (let m of rawMoves) {
        let nextB = board.map(row => [...row]);
        let promoted = applyMove(m.fr, m.fc, m.tr, m.tc, m.data, nextB);

        let res;
        if (m.data.capture && !promoted) {
            let moreMoves = getAllMoves(nextB, nextB[m.tr][m.tc], { r: m.tr, c: m.tc }, true);
            if (moreMoves.length > 0) {
                res = minimax(nextB, aiDepth, -Infinity, Infinity, true, { r: m.tr, c: m.tc });
            } else {
                res = minimax(nextB, aiDepth - 1, -Infinity, Infinity, false, null);
            }
        } else {
            res = minimax(nextB, aiDepth - 1, -Infinity, Infinity, false, null);
        }

        // ตรวจสอบ Blunder (เดินแล้วทำให้อีกฝ่ายได้กินฟรีทันที)
        let oppMoves = getAllMoves(nextB, 1);
        let givesFreePiece = !m.data.capture && oppMoves.some(om => om.data.capture);

        evaluatedMoves.push({
            move: m,
            score: res.score,
            givesFreePiece: givesFreePiece
        });
    }

    // เรียงลำดับจากคะแนนสูงไปต่ำ
    evaluatedMoves.sort((a, b) => b.score - a.score);

    let chosenMove;
    if (currentDiff === 1) {
        // โหมด EASY: กรองท่าเดินที่แจกหมากทิ้ง (Blunder Prevention)
        let safeMoves = evaluatedMoves.filter(em => !em.givesFreePiece);
        let candidatePool = safeMoves.length > 0 ? safeMoves : evaluatedMoves;
        
        // เลือกสุ่มในกลุ่มท่าที่ดีอันดับต้นๆ (Top 2-3) เพื่อความเป็นธรรมชาติ ไม่แจกหมากฟรีแต่ไม่ตึงจนเกินไป
        let topCount = Math.min(candidatePool.length, 3);
        chosenMove = candidatePool[Math.floor(Math.random() * topCount)].move;
    } else if (currentDiff === 4) {
        // โหมด NORMAL: สุ่มระหว่างอันดับ 1 หรือ 2
        let topCount = Math.min(evaluatedMoves.length, 2);
        chosenMove = evaluatedMoves[Math.floor(Math.random() * topCount)].move;
    } else {
        // โหมด HARD: เลือกท่าที่ดีที่สุด 100%
        chosenMove = evaluatedMoves[0].move;
    }

    if (chosenMove) {
        executeMove(chosenMove.fr, chosenMove.fc, chosenMove.tr, chosenMove.tc, chosenMove.data);
    } else {
        let fallback = rawMoves[0];
        executeMove(fallback.fr, fallback.fc, fallback.tr, fallback.tc, fallback.data);
    }
}

// จัดลำดับตาเดิน (Move Ordering) เพื่อให้ Alpha-Beta Pruning ตัดกิ่งได้เร็วกว่าเดิม 3-5 เท่า
function orderMoves(moves, b) {
    return moves.sort((a, bMove) => {
        let scoreA = 0;
        let scoreB = 0;

        // 1. ตากินได้ลำดับความสำคัญสูงสุด
        if (a.data.capture) {
            let capturedPiece = b[a.data.mR][a.data.mC];
            scoreA += 1000 + (capturedPiece > 2 ? 500 : 100);
            if (b[a.fr][a.fc] <= 2 && (a.tr === 7 || a.tr === 0)) scoreA += 300; // กินแล้วเข้าฮอส
        }
        if (bMove.data.capture) {
            let capturedPiece = b[bMove.data.mR][bMove.data.mC];
            scoreB += 1000 + (capturedPiece > 2 ? 500 : 100);
            if (b[bMove.fr][bMove.fc] <= 2 && (bMove.tr === 7 || bMove.tr === 0)) scoreB += 300;
        }

        // 2. ตาที่เดินแล้วได้เป็นฮอส
        if (b[a.fr][a.fc] <= 2 && (a.tr === 7 || a.tr === 0)) scoreA += 400;
        if (b[bMove.fr][bMove.fc] <= 2 && (bMove.tr === 7 || bMove.tr === 0)) scoreB += 400;

        // 3. ตาที่คุมกลางกระดาน
        if (a.tc >= 2 && a.tc <= 5 && a.tr >= 2 && a.tr <= 5) scoreA += 50;
        if (bMove.tc >= 2 && bMove.tc <= 5 && bMove.tr >= 2 && bMove.tr <= 5) scoreB += 50;

        return scoreB - scoreA;
    });
}

// สร้างคีย์ของกระดานเพื่อบันทึกใน Transposition Table
function getBoardKey(b, isMax, multiPos) {
    let s = isMax ? "M|" : "O|";
    if (multiPos) s += `J${multiPos.r},${multiPos.c}|`;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (b[r][c] !== 0) s += `${r}${c}${b[r][c]};`;
        }
    }
    return s;
}

function minimax(simB, depth, alpha, beta, isMax, multiPos = null) {
    const key = getBoardKey(simB, isMax, multiPos);
    if (!multiPos && transTable.has(key)) {
        const cached = transTable.get(key);
        if (cached.depth >= depth) {
            return cached.res;
        }
    }

    // เมื่อถึง Depth 0 ให้เข้า Quiescence Search เพื่อประเมินตากินต่อเนื่อง (ป้องกัน Horizon Effect)
    if (depth <= 0 && !multiPos) {
        let qScore = quiescence(simB, alpha, beta, isMax, 3);
        return { score: qScore, move: null };
    }

    const player = isMax ? 2 : 1;
    let rawMoves = getAllMoves(simB, player, multiPos, multiPos !== null);

    if (rawMoves.length === 0) {
        if (multiPos) {
            // หมดการกินต่อเนื่อง -> สลับเทิร์น
            return minimax(simB, depth - 1, alpha, beta, !isMax, null);
        }
        // แพ้/ไม่มีตาเดิน
        return { score: isMax ? -20000 - depth : 20000 + depth, move: null };
    }

    let moves = orderMoves(rawMoves, simB);
    let bestMove = null;

    if (isMax) {
        let maxS = -Infinity;
        for (let m of moves) {
            let nextB = simB.map(row => [...row]);
            let promoted = applyMove(m.fr, m.fc, m.tr, m.tc, m.data, nextB);

            let res;
            // ตรวจสอบการกินต่อเนื่อง (ถ้าเข้าฮอสแล้ว ต้องจบเทิร์นทันที ไม่กินต่อ)
            if (m.data.capture && !promoted) {
                let moreMoves = getAllMoves(nextB, nextB[m.tr][m.tc], { r: m.tr, c: m.tc }, true);
                if (moreMoves.length > 0) {
                    res = minimax(nextB, depth, alpha, beta, true, { r: m.tr, c: m.tc });
                } else {
                    res = minimax(nextB, depth - 1, alpha, beta, false, null);
                }
            } else {
                res = minimax(nextB, depth - 1, alpha, beta, false, null);
            }

            if (res.score > maxS) {
                maxS = res.score;
                bestMove = m;
            }
            alpha = Math.max(alpha, maxS);
            if (beta <= alpha) break; // Alpha-Beta Cutoff
        }
        const out = { score: maxS, move: bestMove };
        if (!multiPos && transTable.size < MAX_TT_SIZE) transTable.set(key, { depth, res: out });
        return out;
    } else {
        let minS = Infinity;
        for (let m of moves) {
            let nextB = simB.map(row => [...row]);
            let promoted = applyMove(m.fr, m.fc, m.tr, m.tc, m.data, nextB);

            let res;
            if (m.data.capture && !promoted) {
                let moreMoves = getAllMoves(nextB, nextB[m.tr][m.tc], { r: m.tr, c: m.tc }, true);
                if (moreMoves.length > 0) {
                    res = minimax(nextB, depth, alpha, beta, false, { r: m.tr, c: m.tc });
                } else {
                    res = minimax(nextB, depth - 1, alpha, beta, true, null);
                }
            } else {
                res = minimax(nextB, depth - 1, alpha, beta, true, null);
            }

            if (res.score < minS) {
                minS = res.score;
                bestMove = m;
            }
            beta = Math.min(beta, minS);
            if (beta <= alpha) break; // Alpha-Beta Cutoff
        }
        const out = { score: minS, move: bestMove };
        if (!multiPos && transTable.size < MAX_TT_SIZE) transTable.set(key, { depth, res: out });
        return out;
    }
}

// Quiescence Search: ค้นหาต่อเฉพาะตากิน เพื่อไม่ให้บอทตาบอดในจังหวะแลกหมาก
function quiescence(simB, alpha, beta, isMax, qDepth) {
    let standPat = evaluate(simB);
    if (qDepth <= 0) return standPat;

    if (isMax) {
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;

        let moves = getAllMoves(simB, 2).filter(m => m.data.capture);
        if (moves.length === 0) return standPat;

        for (let m of moves) {
            let nextB = simB.map(row => [...row]);
            applyMove(m.fr, m.fc, m.tr, m.tc, m.data, nextB);
            let score = quiescence(nextB, alpha, beta, false, qDepth - 1);
            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }
        return alpha;
    } else {
        if (standPat <= alpha) return alpha;
        if (standPat < beta) beta = standPat;

        let moves = getAllMoves(simB, 1).filter(m => m.data.capture);
        if (moves.length === 0) return standPat;

        for (let m of moves) {
            let nextB = simB.map(row => [...row]);
            applyMove(m.fr, m.fc, m.tr, m.tc, m.data, nextB);
            let score = quiescence(nextB, alpha, beta, true, qDepth - 1);
            if (score <= alpha) return alpha;
            if (score < beta) beta = score;
        }
        return beta;
    }
}

// ----------------------------------------------------
// ฟังก์ชันประเมินคะแนนกระดานเชิงกลยุทธ์ (Advanced Evaluation)
// ----------------------------------------------------
function evaluate(b) {
    let score = 0;
    let blackPieces = 0, whitePieces = 0;
    let blackKings = 0, whiteKings = 0;

    // ตารางประเมินตำแหน่งการยืนหมากเบี้ยดำ (ก้าวไปข้างหน้า + คุมกลาง + ป้องกันหลัง)
    const blackPosBonus = [
        [0, 25, 0, 25, 0, 25, 0, 25],  // แถว 0: ตรึงแถวหลัง ป้องกันอีกฝ่ายเข้าฮอส
        [8, 0, 10, 0, 10, 0, 8, 0],   
        [0, 12, 0, 16, 0, 16, 0, 10], // แถว 2: คุมพื้นที่กลาง
        [10, 0, 18, 0, 18, 0, 12, 0], // แถว 3: จุดปะทะ
        [0, 15, 0, 22, 0, 22, 0, 14], // แถว 4
        [18, 0, 26, 0, 26, 0, 18, 0], // แถว 5: บุกประชิด
        [0, 35, 0, 38, 0, 38, 0, 35], // แถว 6: ใกล้ขึ้นฮอส
        [0, 0, 0, 0, 0, 0, 0, 0]
    ];

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = b[r][c];
            if (p === 0) continue;

            if (p === 2) { // เบี้ยดำ (บอท)
                blackPieces++;
                score += 100 + blackPosBonus[r][c];

                // 1. หมากผูก/หมากหนุน (Protection Bonus)
                if (r > 0) {
                    if ((c > 0 && b[r - 1][c - 1] === 2) || (c < 7 && b[r - 1][c + 1] === 2)) {
                        score += 18; // มีเพื่อนหนุนหลัง ไม่เสียหมากฟรี
                    }
                }

                // 2. หมากริมกระดาน (ขอบกระดานมีความยืดหยุ่นน้อยกว่า)
                if (c === 0 || c === 7) {
                    score -= 8;
                }

            } else if (p === 4) { // ฮอสบอท
                blackKings++;
                score += 420;

                // ฮอสคุมกลางกระดานมีประสิทธิภาพสูงสุด
                if (r >= 2 && r <= 5 && c >= 2 && c <= 5) score += 20;

            } else if (p === 1) { // เบี้ยขาว (ผู้เล่น)
                whitePieces++;
                score -= (100 + blackPosBonus[7 - r][7 - c]);

                // หมากผูกของผู้เล่น
                if (r < 7) {
                    if ((c > 0 && b[r + 1][c - 1] === 1) || (c < 7 && b[r + 1][c + 1] === 1)) {
                        score -= 18;
                    }
                }

                if (c === 0 || c === 7) {
                    score += 8;
                }

            } else if (p === 3) { // ฮอสผู้เล่น
                whiteKings++;
                score -= 420;

                if (r >= 2 && r <= 5 && c >= 2 && c <= 5) score -= 20;
            }
        }
    }

    // โบนัสช่วง Endgame: ถ้าบอทมีเปรียบ ให้ฮอสไล่ต้อน
    if (blackKings > 0 && whitePieces + whiteKings <= 3) {
        score += 50;
    }

    return score;
}

function applyMove(fr, fc, tr, tc, data, b) {
    if (data.capture) b[data.mR][data.mC] = 0;
    const piece = b[fr][fc];
    b[tr][tc] = piece; 
    b[fr][fc] = 0;
    let promoted = false;
    // เป็นฮอสเมื่อเดินถึงแถวสุดท้ายของฝ่ายตรงข้าม
    if (tr === 0 && piece === 1) {
        b[tr][tc] = 3;
        promoted = true;
    }
    if (tr === 7 && piece === 2) {
        b[tr][tc] = 4;
        promoted = true;
    }
    return promoted;
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
            // ถ้าอยู่ในสถานะกินต่อเนื่อง (Multi-jump) ต้องเป็นตากินเท่านั้น
            if (isMultiJump && !res.capture) {
                return;
            }

            // เช็คกฎบังคับกิน
            let allMoves = getAllMoves(board, 1, isMultiJump ? selected : null, isMultiJump);
            let jumps = allMoves.filter(m => m.data.capture);
            if (jumps.length > 0 && !res.capture) {
                showGameToast("กฎบังคับกิน!", "ต้องกินหมากฝ่ายตรงข้ามก่อน!");
                return;
            }
            executeMove(selected.r, selected.c, r, c, res);
        }
    }
    render();
}

function executeMove(fr, fc, tr, tc, res) {
    const promoted = applyMove(fr, fc, tr, tc, res, board);
    
    // เล่นเสียงเอฟเฟกต์ตามการกระทำ
    if (promoted) {
        playCrownSound(); // เสียงเข้าฮอส
    } else if (res.capture) {
        playCaptureSound(); // เสียงกินหมาก
    } else {
        playMoveSound(); // เสียงเดินปกติ
    }

    // ตรวจสอบการกินต่อเนื่อง (ถ้าเพิ่งเข้าฮอส จะจบเทิร์นทันที ไม่กินต่อ)
    let canJumpMore = false;
    if (res.capture && !promoted) {
        let moreJumps = getAllMoves(board, board[tr][tc], { r: tr, c: tc }, true);
        canJumpMore = (moreJumps.length > 0);
    }

    if (canJumpMore) {
        isMultiJump = true; 
        selected = { r: tr, c: tc };
        if (turn === 'black') {
            setTimeout(aiAction, 350); // AI กินต่อเนื่อง
        }
    } else { 
        endTurn(); 
    }
    render();
}

// ธีมกระดานสว่าง (Bright Board Themes)
const THEMES = [
    { id: 'theme-oak', name: '🎨 ไม้สว่าง (Oak)' },
    { id: 'theme-green', name: '🎨 เขียวสว่าง (Sage)' },
    { id: 'theme-birch', name: '🎨 เบิร์ชสว่าง (Birch)' }
];
let currentThemeIndex = 0;

function applyTheme(index) {
    currentThemeIndex = index % THEMES.length;
    const theme = THEMES[currentThemeIndex];
    const boardEl = document.getElementById('board');
    if (boardEl) {
        THEMES.forEach(t => boardEl.classList.remove(t.id));
        boardEl.classList.add(theme.id);
    }
    const startThemeBtn = document.getElementById('start-theme-btn');
    if (startThemeBtn) startThemeBtn.innerText = theme.name;
    const gameThemeBtn = document.getElementById('game-theme-btn');
    if (gameThemeBtn) {
        gameThemeBtn.innerText = "🎨 ธีม";
        gameThemeBtn.title = `เปลี่ยนสีกระดาน (ปัจจุบัน: ${theme.name.replace('🎨 ', '')})`;
    }
}

function cycleTheme() {
    applyTheme(currentThemeIndex + 1);
}

function endTurn() {
    isMultiJump = false; 
    selected = null; 
    if (checkWinner()) return;
    
    turn = (turn === 'white' ? 'black' : 'white');
    const statusText = (turn === 'white' ? "ตาของคุณ" : "บอทกำลังคิด...");
    document.getElementById('status').innerText = statusText;
    
    const badge = document.getElementById('status-badge');
    if (badge) {
        if (turn === 'white') badge.classList.remove('ai-turn');
        else badge.classList.add('ai-turn');
    }
    
    if (turn === 'black') {
        setTimeout(aiAction, 400);
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
        playDefeatSound();
        showRetroModal("GAME OVER", "คุณพ่ายแพ้ให้กับระบบ AI!", false);
        gameActive = false;
        return true;
    }
    if (b === 0 || !blackCanMove) {
        playVictorySound();
        showRetroModal("VICTORY", "ยินดีด้วย! คุณชนะบอท AI สำเร็จ", true);
        gameActive = false;
        return true;
    }
    return false;
}

function showRetroModal(title, message, isVictory = false) {
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = message;
    const iconEl = document.getElementById('modal-icon');
    if (iconEl) iconEl.innerText = isVictory ? "🏆" : "💀";
    document.getElementById('retro-modal').style.display = 'flex';
}

let toastTimeout = null;
function showGameToast(title = "กฎบังคับกิน!", message = "ต้องกินหมากฝ่ายตรงข้ามก่อน!") {
    const toast = document.getElementById('game-toast');
    if (!toast) return;

    // เสียงแจ้งเตือนเตือนสติสไตล์เรโทร (8-bit Warning Buzz)
    playTone(280, 'sawtooth', 0.12, 0.18, 140);

    const titleEl = toast.querySelector('.toast-title');
    const descEl = document.getElementById('toast-message');
    if (titleEl) titleEl.innerText = title;
    if (descEl) descEl.innerText = message;

    toast.classList.remove('show');
    void toast.offsetWidth; // Force reflow
    toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

function render() {
    const bEl = document.getElementById('board'); 
    bEl.innerHTML = '';
    
    // คำนวณตำแหน่งที่สามารถเดินหรือกินได้สำหรับตัวหมากที่ถูกเลือก
    let validTargets = [];
    if (selected && gameActive && turn === 'white') {
        const moves = getAllMoves(board, 1, selected, isMultiJump);
        validTargets = moves.map(m => ({ r: m.tr, c: m.tc, isCapture: m.data.capture }));
    }

    // ข้อความแนะนำด้านล่างกระดาน
    const hintEl = document.getElementById('hint-text');
    if (hintEl) {
        if (isMultiJump) {
            hintEl.innerText = "⚡ กินต่อเนื่อง! เลือกช่องที่สามารถกินต่อได้";
        } else if (selected) {
            hintEl.innerText = validTargets.length > 0 
                ? `👉 แตะช่องเป้าหมายเพื่อเดิน (${validTargets.length} ตาเดิน)` 
                : "⚠️ ตัวนี้ไม่มีตาเดินที่ถูกต้อง ลองเลือกตัวอื่น";
        } else {
            hintEl.innerText = "💡 แตะที่ตัวหมากเพื่อดูช่องที่เดินได้";
        }
    }

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const cell = document.createElement('div'); 
            cell.className = `cell ${(r + c) % 2 === 0 ? 'white-cell' : 'black-cell'}`;
            
            // แสดงจุดแนะนำการเดินบนกระดาน
            const target = validTargets.find(t => t.r === r && t.c === c);
            if (target) {
                const hint = document.createElement('div');
                hint.className = `move-hint ${target.isCapture ? 'capture-hint' : ''}`;
                cell.appendChild(hint);
            }

            const p = board[r][c];
            if (p !== 0) {
                const d = document.createElement('div'); 
                d.className = `piece ${p % 2 === 0 ? 'black-piece' : 'white-piece'} ${p > 2 ? 'king' : ''}`;
                if (selected && selected.r === r && selected.c === c) d.classList.add('selected');
                cell.appendChild(d);
            }
            cell.onclick = () => handleSquareClick(r, c); 
            bEl.appendChild(cell);
        }
    }
}