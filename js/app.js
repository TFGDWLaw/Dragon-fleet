import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

// ==========================================
// 1. CẤU HÌNH FIREBASE CLOUD
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyACUVNGTByzfY_DwpavwpB7EVbKgbFDfxY",
    authDomain: "dragon-battleship.firebaseapp.com",
    databaseURL: "https://dragon-battleship-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dragon-battleship",
    storageBucket: "dragon-battleship.firebasestorage.app",
    messagingSenderId: "147470295813",
    appId: "1:147470295813:web:d02e73501b5b9705794d6c"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let myPlayerId = null; 
let currentRoomCode = null;
let currentRoomData = null;
let gameState = 'LOBBY'; 
let isHorizontal = true; 
let activeSkill = 'NORMAL'; 

const statusText = document.getElementById('status-text');

// ==========================================
// 2. SẢNH CHỜ
// ==========================================
document.getElementById('btn-create-room').addEventListener('click', async () => {
    currentRoomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    myPlayerId = 'player1'; 

    // FIX: Đưa skills vào riêng biệt cho từng người chơi
    await set(ref(db, 'rooms/' + currentRoomCode), {
        status: 'waiting', 
        turn: 'player1', 
        player1: { ready: false, board: null, skills: { FIRE: 1, WIND: 1 } },
        player2: { ready: false, board: null, skills: { FIRE: 1, WIND: 1 } }
    });

    document.getElementById('btn-create-room').style.display = 'none';
    document.getElementById('join-room-section').style.display = 'none';
    document.getElementById('waiting-info').style.display = 'block';
    document.getElementById('display-room-code').innerText = currentRoomCode;
    statusText.innerText = "Đã tạo phòng! Gửi mã cho đối thủ.";

    listenToRoomUpdates(currentRoomCode);
});

document.getElementById('btn-join-room').addEventListener('click', async () => {
    const inputCode = document.getElementById('input-room-code').value.toUpperCase();
    if (inputCode.length !== 4) return alert("Mã phòng phải có 4 ký tự!"); 

    const roomRef = ref(db, 'rooms/' + inputCode);
    const snapshot = await get(roomRef);

    if (snapshot.exists() && snapshot.val().status === 'waiting') {
        currentRoomCode = inputCode;
        myPlayerId = 'player2';
        await update(roomRef, { status: 'setup' });
        listenToRoomUpdates(currentRoomCode);
    } else {
        alert("Mã phòng không tồn tại hoặc đã bắt đầu chơi!");
    }
});

// ==========================================
// 3. ĐỒNG BỘ TRẠNG THÁI GAME
// ==========================================
function listenToRoomUpdates(roomCode) {
    onValue(ref(db, 'rooms/' + roomCode), (snapshot) => {
        currentRoomData = snapshot.val();
        if (!currentRoomData) return;

        if (gameState === 'LOBBY' && currentRoomData.status === 'setup') {
            gameState = 'SETUP';
            document.getElementById('lobby-container').style.display = 'none';
            document.getElementById('game-container').style.display = 'flex';
            statusText.innerText = "💥 ĐỐI THỦ ĐÃ KẾT NỐI! Bắt đầu xếp Rồng!";
            initSetupPhase(); 
        }

        if (gameState === 'SETUP' && currentRoomData.player1?.ready && currentRoomData.player2?.ready) {
            gameState = 'BATTLE';
            if (myPlayerId === 'player1' && currentRoomData.status !== 'battle') {
                update(ref(db, 'rooms/' + currentRoomCode), { status: 'battle' });
            }
            initBattlePhase();
        }

        if (gameState === 'BATTLE') {
            syncBattleGraphics();
        }
    });
}

// ==========================================
// 4. XẾP QUÂN
// ==========================================
let currentDragonIndex = 0; 
let currentHoverRow = null, currentHoverCol = null;
let logicalBoard = Array(10).fill().map(() => Array(10).fill(""));

const divineSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 40'%3E%3Crect x='5' y='5' width='190' height='30' rx='15' fill='%23ffeaa7' stroke='%23ff9f43' stroke-width='3'/%3E%3Ccircle cx='175' cy='20' r='10' fill='%23ff9f43'/%3E%3Cpath d='M30 10 L40 5 L35 15' fill='%23ff9f43'/%3E%3C/svg%3E";
const supremeSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 40'%3E%3Crect x='5' y='5' width='150' height='30' rx='10' fill='%23a29bfe' stroke='%236c5ce7' stroke-width='3'/%3E%3Ccircle cx='140' cy='20' r='9' fill='%236c5ce7'/%3E%3Cpath d='M20 8 L25 2 L30 8 L25 14 Z' fill='%23fff'/%3E%3C/svg%3E";
const epicFireSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 40'%3E%3Crect x='5' y='5' width='110' height='30' rx='8' fill='%23ff7675' stroke='%23d63031' stroke-width='3'/%3E%3Cpath d='M95 10 C 105 0, 115 20, 105 30' stroke='%23fff' stroke-width='2' fill='none'/%3E%3C/svg%3E";
const epicWaterSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 40'%3E%3Crect x='5' y='5' width='110' height='30' rx='8' fill='%2374b9ff' stroke='%230984e3' stroke-width='3'/%3E%3Ccircle cx='100' cy='20' r='6' fill='%23fff' opacity='0.7'/%3E%3C/svg%3E";
const rareSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 40'%3E%3Crect x='5' y='5' width='70' height='30' rx='5' fill='%2355efc4' stroke='%2300b894' stroke-width='3'/%3E%3Cpath d='M10 10 L 20 20 L 10 30' stroke='%23fff' stroke-width='2' fill='none'/%3E%3C/svg%3E";

let fleet = [
    { id: "divine", name: "Divine Dragon", size: 5, isPlaced: false, svg: divineSvg },
    { id: "supreme", name: "Supreme Dragon", size: 4, isPlaced: false, svg: supremeSvg },
    { id: "epic_a", name: "Epic Dragon Alpha", size: 3, isPlaced: false, svg: epicFireSvg },
    { id: "epic_b", name: "Epic Dragon Beta", size: 3, isPlaced: false, svg: epicWaterSvg },
    { id: "rare", name: "Rare Dragon", size: 2, isPlaced: false, svg: rareSvg }
];

function initSetupPhase() {
    const gridElement = document.getElementById('game-board'); gridElement.innerHTML = '';
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell setup-mode'; cell.dataset.row = r; cell.dataset.col = c;
            cell.addEventListener('mouseenter', handleEnter); cell.addEventListener('mouseleave', handleLeave); cell.addEventListener('click', handlePlaceDragon);
            gridElement.appendChild(cell);
        }
    }
    updateDragonListUI();
}

function getCells(r, c, size) {
    let cells = [];
    for(let i=0; i<size; i++) cells.push({ r: isHorizontal ? r : r+i, c: isHorizontal ? c+i : c });
    return cells;
}

function isValid(cells) {
    for (let cell of cells) { if (cell.r >= 10 || cell.c >= 10 || logicalBoard[cell.r][cell.c] !== "") return false; } return true;
}

function drawPreview() {
    document.querySelectorAll('#game-board .cell').forEach(c => c.classList.remove('preview-valid', 'preview-invalid'));
    if(gameState !== 'SETUP' || currentDragonIndex >= fleet.length || currentHoverRow === null) return;
    const cells = getCells(currentHoverRow, currentHoverCol, fleet[currentDragonIndex].size);
    const valid = isValid(cells);
    cells.forEach(cell => {
        if (cell.r < 10 && cell.c < 10) document.querySelector(`#game-board .cell[data-row='${cell.r}'][data-col='${cell.c}']`).classList.add(valid ? 'preview-valid' : 'preview-invalid');
    });
}

function handleEnter(e) { currentHoverRow = parseInt(e.target.dataset.row); currentHoverCol = parseInt(e.target.dataset.col); drawPreview(); }
function handleLeave() { currentHoverRow = null; currentHoverCol = null; document.querySelectorAll('#game-board .cell').forEach(c => c.classList.remove('preview-valid', 'preview-invalid')); }

function handlePlaceDragon(e) {
    if (gameState !== 'SETUP' || currentDragonIndex >= fleet.length) return;
    const r = parseInt(e.target.dataset.row), c = parseInt(e.target.dataset.col);
    const dragon = fleet[currentDragonIndex];
    const cells = getCells(r, c, dragon.size);

    if (isValid(cells)) {
        cells.forEach(cell => { logicalBoard[cell.r][cell.c] = dragon.id; document.querySelector(`#game-board .cell[data-row='${cell.r}'][data-col='${cell.c}']`).classList.add('placed'); });
        const sprite = document.createElement('div'); sprite.className = 'dragon-sprite';
        sprite.style.width = (dragon.size * 40 + (dragon.size - 1) * 2) + 'px'; sprite.style.height = '40px';
        sprite.style.top = (5 + r * 42) + 'px'; sprite.style.left = (5 + c * 42) + 'px';
        if (!isHorizontal) { sprite.style.transformOrigin = '20px 20px'; sprite.style.transform = 'rotate(90deg)'; }
        sprite.style.backgroundImage = `url("${dragon.svg}")`;
        document.getElementById('game-board').appendChild(sprite);

        dragon.isPlaced = true; currentDragonIndex++; updateDragonListUI(); drawPreview();

        if (currentDragonIndex === fleet.length) {
            document.getElementById('btn-rotate').style.display = 'none'; document.getElementById('btn-ready').style.display = 'block';
            document.querySelectorAll('#game-board .cell').forEach(c => { c.classList.remove('setup-mode'); c.style.cursor = 'default'; });
            statusText.innerText = "Xếp xong! Bấm Nút Xanh lá để sẵn sàng.";
        }
    }
}

function updateDragonListUI() {
    const list = document.getElementById('dragon-list'); list.innerHTML = '';
    fleet.forEach((d, i) => {
        const item = document.createElement('div');
        item.className = `dragon-item ${d.isPlaced ? 'placed' : (i === currentDragonIndex ? 'active' : '')}`;
        item.innerHTML = `<span>${d.name}</span> <span>${d.size} ô</span>`;
        list.appendChild(item);
    });
}

const btnRotate = document.getElementById('btn-rotate');
btnRotate.addEventListener('click', () => { isHorizontal = !isHorizontal; btnRotate.innerText = `🔄 Xoay Rồng (Phím R): ${isHorizontal ? 'NGANG' : 'DỌC'}`; drawPreview(); });
document.addEventListener('keydown', (e) => { if (gameState === 'SETUP' && e.key.toLowerCase() === 'r') btnRotate.click(); });

document.getElementById('btn-ready').addEventListener('click', async () => {
    document.getElementById('btn-ready').innerText = "✅ ĐANG CHỜ ĐỐI THỦ..."; document.getElementById('btn-ready').disabled = true;
    statusText.innerText = "Hệ thống đã khóa đội hình. Đợi đối phương...";
    const updateData = {}; updateData[`${myPlayerId}/ready`] = true; updateData[`${myPlayerId}/board`] = logicalBoard;
    await update(ref(db, 'rooms/' + currentRoomCode), updateData);
});

// ==========================================
// 5. GIAI ĐOẠN TÁC CHIẾN
// ==========================================
function initBattlePhase() {
    document.getElementById('control-and-skills').style.display = 'flex';
    document.getElementById('control-panel').style.display = 'none';
    document.getElementById('skill-panel').style.display = 'block';
    document.getElementById('radar-wrapper').style.display = 'flex';

    const radarElement = document.getElementById('radar-board'); radarElement.innerHTML = '';
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const cell = document.createElement('div');
            cell.className = 'radar-cell'; cell.dataset.row = r; cell.dataset.col = c;
            cell.addEventListener('click', () => handleFireRadar(r, c));
            radarElement.appendChild(cell);
        }
    }
    syncSkillUI();
}

async function handleFireRadar(r, c) {
    if (gameState !== 'BATTLE' || currentRoomData.turn !== myPlayerId) return;

    const oppId = myPlayerId === 'player1' ? 'player2' : 'player1';
    
    const oppBoard = currentRoomData[oppId].board;
    const rowData = oppBoard[r] || [];
    if (rowData[c] === 'hit' || rowData[c] === 'miss') return;

    if (activeSkill === 'FIRE') {
        await handleSkillFireArea(r, c, [[0,0], [1,0], [-1,0], [0,1], [0,-1]]); 
        spendSkillCharge('FIRE'); return;
    } else if (activeSkill === 'WIND') {
        await handleSkillFireArea(r, c, [[0,0], [1,0], [-1,0], [0,1], [0,-1], [1,1], [1,-1], [-1,1], [-1,-1]]); 
        spendSkillCharge('WIND'); return;
    }
    await fireAtCell(oppId, r, c);
}

async function fireAtCell(targetPlayerId, r, c) {
    const oppCellRef = ref(db, `rooms/${currentRoomCode}/${targetPlayerId}/board/${r}/${c}`);
    const snapshot = await get(oppCellRef);
    let targetDragonId = snapshot.val();
    
    if (!targetDragonId) targetDragonId = ""; 

    if (targetDragonId === 'hit' || targetDragonId === 'miss') return;

    let isHit = (targetDragonId !== "");
    let result = isHit ? 'hit' : 'miss';
    
    let nextTurnPlayerId = isHit ? myPlayerId : targetPlayerId; 

    const updates = {};
    updates[`rooms/${currentRoomCode}/${targetPlayerId}/board/${r}/${c}`] = result;
    updates[`rooms/${currentRoomCode}/turn`] = nextTurnPlayerId; 
    await update(ref(db), updates);
}

async function handleSkillFireArea(centerR, centerC, sampleOffsets) {
    const oppId = myPlayerId === 'player1' ? 'player2' : 'player1';
    const updates = {}; 
    let hasHitAnything = false;

    for (let offset of sampleOffsets) {
        const r = centerR + offset[0], c = centerC + offset[1];
        if (r >= 0 && r < 10 && c >= 0 && c < 10) {
            const snapshot = await get(ref(db, `rooms/${currentRoomCode}/${oppId}/board/${r}/${c}`));
            let targetVal = snapshot.val();
            if (!targetVal) targetVal = "";

            if (targetVal !== 'hit' && targetVal !== 'miss') {
                let isHit = (targetVal !== "");
                updates[`rooms/${currentRoomCode}/${oppId}/board/${r}/${c}`] = isHit ? 'hit' : 'miss';
                if (isHit) hasHitAnything = true;
            }
        }
    }

    updates[`rooms/${currentRoomCode}/turn`] = hasHitAnything ? myPlayerId : oppId;
    await update(ref(db), updates);
    activeSkill = 'NORMAL'; syncSkillUI(); 
}

// FIX: Chỉ đọc/hiển thị kỹ năng của riêng bản thân mình
function syncSkillUI() {
    if (gameState !== 'BATTLE') return; 
    
    // Trỏ vào kho skill của đúng user hiện tại
    const mySkills = currentRoomData[myPlayerId].skills || {FIRE: 0, WIND: 0};

    document.getElementById('skill-fire').innerHTML = `🔥 Hệ Lửa: Chữ Thập (Sạc: ${mySkills.FIRE})`;
    document.getElementById('skill-wind').innerHTML = `🌪️ Hệ Gió: Radar 3x3 (Sạc: ${mySkills.WIND})`;
    
    document.getElementById('skill-fire').disabled = mySkills.FIRE <= 0;
    document.getElementById('skill-wind').disabled = mySkills.WIND <= 0;
    document.getElementById('skill-normal').classList.toggle('selected', activeSkill === 'NORMAL');
}

// FIX: Chỉ trừ sạc trong túi kỹ năng của bản thân mình
function spendSkillCharge(skillType) {
    const updates = {}; 
    let newCharges = {...currentRoomData[myPlayerId].skills};
    newCharges[skillType]--; 
    
    updates[`rooms/${currentRoomCode}/${myPlayerId}/skills`] = newCharges;
    update(ref(db), updates);
}

document.getElementById('skill-normal').addEventListener('click', () => { activeSkill = 'NORMAL'; syncSkillUI(); });
document.getElementById('skill-fire').addEventListener('click', () => { 
    if(currentRoomData[myPlayerId].skills.FIRE > 0) { activeSkill = 'FIRE'; syncSkillUI(); } 
});
document.getElementById('skill-wind').addEventListener('click', () => { 
    if(currentRoomData[myPlayerId].skills.WIND > 0) { activeSkill = 'WIND'; syncSkillUI(); } 
});

// ==========================================
// 6. ĐỒNG BỘ GIAO DIỆN MƯỢT MÀ
// ==========================================
function syncBattleGraphics() {
    const oppId = myPlayerId === 'player1' ? 'player2' : 'player1';
    const isMyTurn = currentRoomData.turn === myPlayerId;

    if (isMyTurn) {
        statusText.innerHTML = `<span class="turn-highlight">🎯 TỚI LƯỢT BẠN! Nhấp chuột vào Radar để khai hỏa!</span>`;
    } else {
        statusText.innerHTML = "⏳ Đang đợi đối thủ ra chiêu..."; 
        statusText.style.color = "#dfe4ea";
    }

    const myBoardData = currentRoomData[myPlayerId].board;
    for (let r = 0; r < 10; r++) {
        const rowData = myBoardData[r] || [];
        for (let c = 0; c < 10; c++) {
            const val = rowData[c];
            if (val === 'hit' || val === 'miss') {
                document.querySelector(`#game-board .cell[data-row='${r}'][data-col='${c}']`).className = `cell ${val}`;
            }
        }
    }

    const oppBoardData = currentRoomData[oppId].board;
    for (let r = 0; r < 10; r++) {
        const rowData = oppBoardData[r] || [];
        for (let c = 0; c < 10; c++) {
            const val = rowData[c];
            if (val === 'hit' || val === 'miss') {
                document.querySelector(`#radar-board .radar-cell[data-row='${r}'][data-col='${c}']`).className = `radar-cell ${val}`;
            }
        }
    }
    syncSkillUI(); 
}