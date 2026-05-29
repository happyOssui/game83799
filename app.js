// DOM 元素
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const aiCommentEl = document.getElementById('aiComment');
const restartBtn = document.getElementById('restartBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const baseUrlInput = document.getElementById('baseUrl');
const apiKeyInput = document.getElementById('apiKey');
const modelInput = document.getElementById('model');
const thinkingEffortSelect = document.getElementById('thinkingEffort');
const saveConfigBtn = document.getElementById('saveConfigBtn');

// 存储键
const STORAGE_KEY = 'gomoku_ai_config';

// 全局实例
let game;
let ai;

// 初始化
function init() {
    // 从 localStorage 加载配置
    loadConfig();

    // 创建棋盘格子
    renderBoardGrid();

    // 绑定事件
    boardEl.addEventListener('click', handleBoardClick);
    restartBtn.addEventListener('click', handleRestart);
    saveConfigBtn.addEventListener('click', handleSaveConfig);
}

// 加载保存的配置
function loadConfig() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const config = JSON.parse(saved);
            if (config.baseUrl) baseUrlInput.value = config.baseUrl;
            if (config.model) modelInput.value = config.model;
            if (config.apiKey) apiKeyInput.value = config.apiKey;
            if (config.thinkingEffort) thinkingEffortSelect.value = config.thinkingEffort;
        } catch (e) {
            console.warn('Failed to load saved config:', e);
        }
    }
}

// 保存配置
function saveConfig() {
    const config = {
        baseUrl: baseUrlInput.value.trim(),
        apiKey: apiKeyInput.value.trim(),
        model: modelInput.value.trim(),
        thinkingEffort: thinkingEffortSelect.value
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return config;
}

// 渲染棋盘格子
function renderBoardGrid() {
    boardEl.innerHTML = '';
    for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
            const cell = document.createElement('div');
            cell.className = 'board-cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            boardEl.appendChild(cell);
        }
    }
}

// 处理配置保存
function handleSaveConfig() {
    const config = saveConfig();
    ai = new GomokuAI(config.baseUrl, config.apiKey, config.model, config.thinkingEffort);

    if (!ai.isConfigured()) {
        setStatus('请填写完整 API 配置', 'waiting');
        return;
    }

    startNewGame();
}

// 开始新游戏
function startNewGame() {
    game = new Game();
    aiCommentEl.textContent = '';
    renderBoard();
    updateStatus();
    restartBtn.disabled = false;
    setLoading(false);
}

// 处理重新开始
function handleRestart() {
    if (!ai || !ai.isConfigured()) return;
    startNewGame();
}

// 渲染整个棋盘
function renderBoard() {
    // 清除所有棋子
    document.querySelectorAll('.piece').forEach(p => p.remove());

    const board = game.getBoard();
    const winningLine = game.getWinningLine();
    const winningSet = new Set(
        winningLine ? winningLine.map(([r, c]) => `${r},${c}`) : []
    );

    for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
            const value = board[row][col];
            if (value !== 0) {
                const isWinning = winningSet.has(`${row},${col}`);
                renderPiece(row, col, value, isWinning);
            }
        }
    }
}

// 渲染单个棋子
function renderPiece(row, col, player, isWinning) {
    const cell = boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    if (!cell) return;

    const piece = document.createElement('div');
    piece.className = `piece ${player === 1 ? 'black' : 'white'}`;
    if (isWinning) {
        piece.classList.add('winning');
    }
    cell.appendChild(piece);

    // 触发动画
    requestAnimationFrame(() => {
        piece.classList.add('placed');
    });
}

// 处理棋盘点击
function handleBoardClick(e) {
    if (!game || game.isGameOver() || game.getCurrentPlayer() !== 1) return;
    if (loadingOverlay.classList.contains('show')) return;
    if (!ai || !ai.isConfigured()) return;

    const cell = e.target.closest('.board-cell');
    if (!cell) return;

    const row = parseInt(cell.dataset.row, 10);
    const col = parseInt(cell.dataset.col, 10);

    if (!game.isValidMove(row, col)) return;

    // 玩家落子
    game.move(row, col, 1);
    renderBoard();
    updateStatus();

    if (game.isGameOver()) {
        handleGameOver();
        return;
    }

    // AI 回合
    setTimeout(() => {
        handleAiMove();
    }, 300);
}

// AI 落子
async function handleAiMove() {
    setLoading(true);
    setStatus('AI 思考中...', 'ai-turn');

    try {
        const board = game.getBoard();
        const move = await ai.getNextMove(board);

        if (!move) {
            alert('AI 无法给出合法落子。\n可以切换思考强度或检查 API 配置。');
            setLoading(false);
            updateStatus();
            return;
        }

        // AI 落子
        game.move(move.row, move.col, 2);
        renderBoard();
        setLoading(false);
        updateStatus();

        if (game.isGameOver()) {
            handleGameOver();
            return;
        }

    } catch (error) {
        setLoading(false);
        updateStatus();
        alert('API 调用出错：' + error.message);
        console.error(error);
    }
}

// 游戏结束处理
async function handleGameOver() {
    let result;
    if (game.getWinningLine()) {
        const winner = game.getCurrentPlayer() === 1 ? 'player-win' : 'ai-win';
        result = winner;
    } else {
        result = 'draw';
    }

    // 获取 AI 评论
    try {
        setLoading(true);
        const comment = await ai.getComment(result, game.getBoard());
        aiCommentEl.textContent = comment;
        setLoading(false);
    } catch (error) {
        console.error('Failed to get AI comment:', error);
        aiCommentEl.textContent = '';
        setLoading(false);
    }
}

// 更新状态显示
function updateStatus() {
    if (!game) {
        setStatus('请配置 API 后开始', 'waiting');
        return;
    }

    if (game.isGameOver()) {
        if (game.getWinningLine()) {
            if (game.getCurrentPlayer() === 1) {
                setStatus('你赢了！', 'player-win');
            } else {
                setStatus('AI 赢了', 'ai-win');
            }
        } else {
            setStatus('平局', 'draw');
        }
        return;
    }

    if (game.getCurrentPlayer() === 1) {
        setStatus('轮到你落子（黑子）', 'player-turn');
    } else {
        setStatus('轮到 AI 落子（白子）', 'ai-turn');
    }
}

// 设置状态文字和样式
function setStatus(text, className) {
    statusEl.textContent = text;
    statusEl.className = 'status ' + (className || '');
}

// 设置加载状态
function setLoading(show) {
    if (show) {
        loadingOverlay.classList.add('show');
    } else {
        loadingOverlay.classList.remove('show');
    }
}

// 启动
init();
