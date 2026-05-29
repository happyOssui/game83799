class Game {
    constructor() {
        this.size = 15;
        this.board = this.createEmptyBoard();
        this.currentPlayer = 1; // 1: 黑棋(玩家), 2: 白棋(AI)
        this.gameOver = false;
        this.winningLine = null; // 存储获胜连线坐标
    }

    createEmptyBoard() {
        return Array(this.size).fill(null).map(() => Array(this.size).fill(0));
    }

    restart() {
        this.board = this.createEmptyBoard();
        this.currentPlayer = 1;
        this.gameOver = false;
        this.winningLine = null;
    }

    getBoard() {
        return this.board;
    }

    getCurrentPlayer() {
        return this.currentPlayer;
    }

    isGameOver() {
        return this.gameOver;
    }

    getWinningLine() {
        return this.winningLine;
    }

    isValidMove(row, col) {
        if (row < 0 || row >= this.size || col < 0 || col >= this.size) {
            return false;
        }
        return this.board[row][col] === 0;
    }

    move(row, col, player) {
        if (!this.isValidMove(row, col) || this.gameOver) {
            return false;
        }
        this.board[row][col] = player;
        if (this.checkWin(row, col)) {
            this.gameOver = true;
            return true;
        }
        if (this.isBoardFull()) {
            this.gameOver = true;
            return true;
        }
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
        return true;
    }

    checkWin(row, col) {
        const player = this.board[row][col];
        const directions = [
            [[0, -1], [0, 1]],   // 水平
            [[-1, 0], [1, 0]],   // 垂直
            [[-1, -1], [1, 1]],  // 左上-右下对角线
            [[-1, 1], [1, -1]]   // 右上-左下对角线
        ];

        for (const [dir1, dir2] of directions) {
            let count = 1;
            const line = [[row, col]];

            // 向第一个方向数
            let r = row + dir1[0];
            let c = col + dir1[1];
            while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
                count++;
                line.push([r, c]);
                r += dir1[0];
                c += dir1[1];
            }

            // 向第二个方向数
            r = row + dir2[0];
            c = col + dir2[1];
            while (r >= 0 && r < this.size && c >= 0 && c < this.size && this.board[r][c] === player) {
                count++;
                line.push([r, c]);
                r += dir2[0];
                c += dir2[1];
            }

            if (count >= 5) {
                this.winningLine = line;
                return true;
            }
        }

        return false;
    }

    isBoardFull() {
        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                if (this.board[row][col] === 0) {
                    return false;
                }
            }
        }
        return true;
    }
}
