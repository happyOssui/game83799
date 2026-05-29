class GomokuAI {
    constructor(baseUrl, apiKey, model, thinkingEffort) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.model = model;
        this.thinkingEffort = thinkingEffort || 'enabled';
    }

    setConfig(baseUrl, apiKey, model, thinkingEffort) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.model = model;
        this.thinkingEffort = thinkingEffort || 'enabled';
    }

    isConfigured() {
        return this.baseUrl && this.apiKey && this.model;
    }

    // 将棋盘转换为文本表示
    boardToString(board) {
        return board.map(row => {
            return row.map(cell => {
                if (cell === 0) return '.';
                if (cell === 1) return 'X';
                if (cell === 2) return 'O';
            }).join('');
        }).join('\n');
    }

    // 解析AI返回的坐标
    parseMove(text) {
        // 清理 markdown 代码标记
        let cleaned = text.replace(/```/g, '').replace(/`/g, '').trim();

        // 匹配各种格式: "7,7" "8,8" "(7,7)" "7,8" "row 7 col 7"
        const regex = /(\d{1,2})\s*[,，、]\s*(\d{1,2})/;
        const match = cleaned.match(regex);
        if (!match) return null;

        const row = parseInt(match[1], 10);
        const col = parseInt(match[2], 10);

        if (isNaN(row) || isNaN(col)) return null;
        if (row < 0 || row >= 15 || col < 0 || col >= 15) return null;

        return { row, col };
    }

    // 从文本中找到所有可能的坐标，跳过已被占用的
    findAllMoves(text) {
        const moves = [];
        let cleaned = text.replace(/```/g, '').replace(/`/g, '').trim();
        const regex = /(\d{1,2})\s*[,，、]\s*(\d{1,2})/g;
        let match;
        while ((match = regex.exec(cleaned)) !== null) {
            const row = parseInt(match[1], 10);
            const col = parseInt(match[2], 10);
            if (!isNaN(row) && !isNaN(col) && row >= 0 && row < 15 && col >= 0 && col < 15) {
                moves.push({ row, col });
            }
        }
        return moves;
    }

    // 获取下一步落子，自动重试并反馈错误
    async getNextMove(board) {
        const boardStr = this.boardToString(board);

        const promptFirst = `你和朋友在下15x15五子棋。你是白方(O)，朋友是黑方(X)。坐标从0开始，行0-14，列0-14，连成五子获胜。正常下就行，别想太多。

当前棋盘：
${boardStr}

输出你的坐标（如 7,8）。只输出坐标。`;

        for (let attempt = 0; attempt < 4; attempt++) {
            try {
                let prompt;
                if (attempt === 0) {
                    prompt = promptFirst;
                } else {
                    prompt = `刚才你选的位置已经被占了或者坐标无效，请重新选一个空位。

棋盘：
${boardStr}

再输出一个有效的坐标，只输出坐标。`;
                }

                const useThinking = attempt < 2 && this.thinkingEffort !== 'disabled';
                const response = useThinking
                    ? await this.callApi(prompt, 16000)
                    : await this.callApiNoThink(prompt, 500);

                const text = response.trim();
                console.log(`AI attempt ${attempt + 1}:`, text);

                const moves = this.findAllMoves(text);
                for (const move of moves) {
                    if (move.row >= 0 && move.row < 15 &&
                        move.col >= 0 && move.col < 15 &&
                        board[move.row][move.col] === 0) {
                        return move;
                    }
                }

                console.warn(`Attempt ${attempt + 1} - no valid move`);
            } catch (error) {
                console.error(`Attempt ${attempt + 1} error:`, error);
            }
        }
        return null;
    }

    // 对局结束，获取AI的评论
    async getComment(result, lastBoard) {
        // result: 'player-win' | 'ai-win' | 'draw'
        let resultText;
        if (result === 'player-win') {
            resultText = '你赢了这一局';
        } else if (result === 'ai-win') {
            resultText = '我赢了这一局';
        } else {
            resultText = '这一局是平局';
        }

        const prompt = `我们刚下完一局五子棋，${resultText}。现在以一个玩家的身份对另一个玩家说句话，随便说点什么。`;

        try {
            const response = await this.callApi(prompt, 200);
            return response.trim();
        } catch (error) {
            console.error('Get comment error:', error);
            return '';
        }
    }

    // 底层API调用
    async callApi(content, maxTokens) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60秒超时

        // 构建请求体
        const body = {
            model: this.model,
            messages: [
                {
                    role: 'user',
                    content: content
                }
            ],
            max_tokens: maxTokens
        };

        // 根据 thinking 参数映射
        if (this.thinkingEffort === 'disabled') {
            body.thinking = { type: 'disabled' };
        } else {
            body.thinking = { type: 'enabled' };
            if (this.thinkingEffort === 'effort=low') {
                body.output_config = { effort: 'low' };
            } else if (this.thinkingEffort === 'effort=medium') {
                body.output_config = { effort: 'medium' };
            } else if (this.thinkingEffort === 'effort=high') {
                body.output_config = { effort: 'high' };
            } else if (this.thinkingEffort === 'effort=max') {
                body.output_config = { effort: 'max' };
            }
        }

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('API full response:', JSON.stringify(data, null, 2));

            // Anthropic 格式：content 数组
            if (data.content && Array.isArray(data.content)) {
                // 先找正常的 text 输出
                const textParts = data.content
                    .filter(item => item.type === 'text')
                    .map(item => item.text);
                if (textParts.length > 0) {
                    return textParts.join('');
                }
                // 如果没有 text，从 thinking 内容中尝试提取
                const thinkingParts = data.content
                    .filter(item => item.type === 'thinking')
                    .map(item => item.thinking);
                if (thinkingParts.length > 0) {
                    return thinkingParts.join(' ');
                }
                return '';
            }

            // 兼容一些其他格式
            if (data.completion) {
                return data.completion;
            }

            if (typeof data === 'string') {
                return data;
            }

            // OpenAI 兼容格式
            if (data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content || '';
            }

            throw new Error('Unexpected response format');
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    // 强制关闭思考的API调用
    async callApiNoThink(content, maxTokens) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'anthropic-version': '2023-06-01',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: 'user', content: content }],
                    max_tokens: maxTokens,
                    thinking: { type: 'disabled' }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('API no-think response:', JSON.stringify(data, null, 2));

            if (data.content && Array.isArray(data.content)) {
                const textParts = data.content
                    .filter(item => item.type === 'text')
                    .map(item => item.text);
                if (textParts.length > 0) {
                    return textParts.join('');
                }
                return '';
            }

            if (data.choices && data.choices[0] && data.choices[0].message) {
                return data.choices[0].message.content || '';
            }

            return data.completion || '';
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
}
