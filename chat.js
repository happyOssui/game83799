(function () {
    // DOM
    const $ = (s) => document.querySelector(s);
    const messagesEl = $('#messages');
    const welcomeEl = $('#welcome');
    const textInput = $('#textInput');
    const sendBtn = $('#sendBtn');
    const fileBtn = $('#fileBtn');
    const imageBtn = $('#imageBtn');
    const cameraBtn = $('#cameraBtn');
    const fileInput = $('#fileInput');
    const imageInput = $('#imageInput');
    const cameraInput = $('#cameraInput');
    const previewBar = $('#previewBar');
    const previewContent = $('#previewContent');
    const previewRemove = $('#previewRemove');
    const settingsBtn = $('#settingsBtn');
    const settingsModal = $('#settingsModal');
    const closeSettings = $('#closeSettings');
    const saveSettings = $('#saveSettings');
    const clearBtn = $('#clearBtn');

    // State
    let conversation = [];
    let pendingAttachments = []; // { type: 'image'|'file', name, data (base64 or text), mimeType }
    let isStreaming = false;
    let abortController = null;

    // Config
    const STORAGE_KEY = 'aichat_config';
    const CONVO_KEY = 'aichat_convo';

    function loadConfig() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch { return {}; }
    }

    function saveConfig(cfg) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    }

    function loadConversation() {
        try {
            return JSON.parse(localStorage.getItem(CONVO_KEY)) || [];
        } catch { return []; }
    }

    function saveConversation() {
        localStorage.setItem(CONVO_KEY, JSON.stringify(conversation));
    }

    // Init settings form
    const cfg = loadConfig();
    $('#apiUrl').value = cfg.apiUrl || '';
    $('#apiKey').value = cfg.apiKey || '';
    $('#modelName').value = cfg.modelName || '';
    $('#systemPrompt').value = cfg.systemPrompt || '';
    $('#maxTokens').value = cfg.maxTokens || 4096;
    $('#apiFormat').value = cfg.apiFormat || 'openai';

    // Restore conversation
    conversation = loadConversation();
    if (conversation.length > 0) {
        welcomeEl.style.display = 'none';
        conversation.forEach(msg => renderMessage(msg));
    }

    // Settings modal
    settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
    closeSettings.addEventListener('click', () => settingsModal.classList.remove('active'));
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.remove('active');
    });

    saveSettings.addEventListener('click', () => {
        saveConfig({
            apiUrl: $('#apiUrl').value.trim(),
            apiKey: $('#apiKey').value.trim(),
            modelName: $('#modelName').value.trim(),
            systemPrompt: $('#systemPrompt').value.trim(),
            maxTokens: parseInt($('#maxTokens').value) || 4096,
            apiFormat: $('#apiFormat').value,
        });
        settingsModal.classList.remove('active');
    });

    // Clear
    clearBtn.addEventListener('click', () => {
        if (conversation.length === 0) return;
        if (!confirm('清空所有对话？')) return;
        conversation = [];
        saveConversation();
        messagesEl.innerHTML = '';
        messagesEl.appendChild(welcomeEl);
        welcomeEl.style.display = '';
    });

    // Textarea auto-resize
    textInput.addEventListener('input', () => {
        textInput.style.height = 'auto';
        textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px';
    });

    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendBtn.addEventListener('click', sendMessage);

    // File / Image / Camera
    fileBtn.addEventListener('click', () => fileInput.click());
    imageBtn.addEventListener('click', () => imageInput.click());
    cameraBtn.addEventListener('click', () => cameraInput.click());

    fileInput.addEventListener('change', handleFileSelect);
    imageInput.addEventListener('change', handleFileSelect);
    cameraInput.addEventListener('change', handleFileSelect);

    previewRemove.addEventListener('click', () => {
        pendingAttachments = [];
        updatePreview();
    });

    function handleFileSelect(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                readFileAsDataURL(file).then(data => {
                    pendingAttachments.push({
                        type: 'image',
                        name: file.name,
                        data: data,
                        mimeType: file.type,
                    });
                    updatePreview();
                });
            } else {
                readFileAsText(file).then(text => {
                    pendingAttachments.push({
                        type: 'file',
                        name: file.name,
                        data: text,
                        mimeType: file.type,
                    });
                    updatePreview();
                });
            }
        });

        e.target.value = '';
    }

    function readFileAsDataURL(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }

    function readFileAsText(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsText(file);
        });
    }

    function updatePreview() {
        if (pendingAttachments.length === 0) {
            previewBar.classList.remove('active');
            previewContent.innerHTML = '';
            return;
        }
        previewBar.classList.add('active');
        previewContent.innerHTML = '';
        pendingAttachments.forEach(att => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            if (att.type === 'image') {
                const img = document.createElement('img');
                img.src = att.data;
                img.alt = att.name;
                div.appendChild(img);
            } else {
                const chip = document.createElement('div');
                chip.className = 'file-chip';
                chip.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${escHtml(att.name)}`;
                div.appendChild(chip);
            }
            previewContent.appendChild(div);
        });
    }

    // Send message
    async function sendMessage() {
        const text = textInput.value.trim();
        const attachments = [...pendingAttachments];

        if (!text && attachments.length === 0) return;

        const config = loadConfig();
        if (!config.apiUrl || !config.apiKey) {
            alert('请先配置 API 地址和 Key');
            settingsModal.classList.add('active');
            return;
        }

        // Clear input
        textInput.value = '';
        textInput.style.height = 'auto';
        pendingAttachments = [];
        updatePreview();

        // Hide welcome
        welcomeEl.style.display = 'none';

        // Build user message
        const userMsg = { role: 'user', content: [], _display: [] };

        if (text) {
            userMsg.content.push({ type: 'text', text: text });
            userMsg._display.push({ type: 'text', text: text });
        }

        attachments.forEach(att => {
            if (att.type === 'image') {
                const base64 = att.data.split(',')[1] || att.data;
                userMsg.content.push({
                    type: 'image_url',
                    image_url: { url: att.data },
                });
                userMsg._display.push({
                    type: 'image',
                    name: att.name,
                    data: att.data,
                });
            } else {
                userMsg.content.push({
                    type: 'text',
                    text: `[文件: ${att.name}]\n${att.data}`,
                });
                userMsg._display.push({
                    type: 'file',
                    name: att.name,
                });
            }
        });

        // If only text, simplify content
        if (userMsg.content.length === 1 && userMsg.content[0].type === 'text') {
            userMsg.content = userMsg.content[0].text;
        }

        conversation.push(userMsg);
        renderMessage(userMsg);
        saveConversation();

        // AI response
        await callAPI(config);
    }

    // Render a message
    function renderMessage(msg) {
        const div = document.createElement('div');
        div.className = `msg ${msg.role}`;

        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.textContent = msg.role === 'user' ? 'U' : 'AI';

        const body = document.createElement('div');
        body.className = 'msg-body';

        // Attachments
        const displayItems = msg._display || [];
        if (displayItems.length > 0) {
            const attDiv = document.createElement('div');
            attDiv.className = 'msg-attachments';
            displayItems.forEach(item => {
                if (item.type === 'image') {
                    const img = document.createElement('img');
                    img.className = 'msg-image';
                    img.src = item.data;
                    img.alt = item.name;
                    img.addEventListener('click', () => openLightbox(item.data));
                    attDiv.appendChild(img);
                } else if (item.type === 'file') {
                    const chip = document.createElement('div');
                    chip.className = 'msg-file';
                    chip.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${escHtml(item.name)}`;
                    attDiv.appendChild(chip);
                }
            });
            body.appendChild(attDiv);
        }

        // Text
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';

        const textContent = getTextContent(msg);
        if (textContent) {
            bubble.innerHTML = renderMarkdown(textContent);
        }

        body.appendChild(bubble);
        div.appendChild(avatar);
        div.appendChild(body);
        messagesEl.appendChild(div);
        scrollToBottom();
    }

    function getTextContent(msg) {
        if (typeof msg.content === 'string') return msg.content;
        if (Array.isArray(msg.content)) {
            return msg.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n');
        }
        return '';
    }

    // Simple markdown-ish rendering
    function renderMarkdown(text) {
        let html = escHtml(text);
        // Code blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
            return `<pre><code>${code.trim()}</code></pre>`;
        });
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        // Line breaks
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    function escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // Lightbox
    function openLightbox(src) {
        let lb = document.querySelector('.lightbox');
        if (!lb) {
            lb = document.createElement('div');
            lb.className = 'lightbox';
            lb.addEventListener('click', () => lb.classList.remove('active'));
            const img = document.createElement('img');
            lb.appendChild(img);
            document.body.appendChild(lb);
        }
        lb.querySelector('img').src = src;
        lb.classList.add('active');
    }

    // API call
    async function callAPI(config) {
        if (isStreaming) return;
        isStreaming = true;
        sendBtn.disabled = true;

        // Create assistant message placeholder
        const assistantDiv = document.createElement('div');
        assistantDiv.className = 'msg assistant';
        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.textContent = 'AI';
        const body = document.createElement('div');
        body.className = 'msg-body';
        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';

        // Typing indicator
        const typing = document.createElement('div');
        typing.className = 'typing-indicator';
        typing.innerHTML = '<span></span><span></span><span></span>';
        bubble.appendChild(typing);

        body.appendChild(bubble);
        assistantDiv.appendChild(avatar);
        assistantDiv.appendChild(body);
        messagesEl.appendChild(assistantDiv);
        scrollToBottom();

        try {
            abortController = new AbortController();
            const apiMessages = buildAPIMessages(config);

            let responseText = '';

            if (config.apiFormat === 'anthropic') {
                responseText = await callAnthropicAPI(config, apiMessages, abortController.signal, (chunk) => {
                    if (!typing.parentNode) return;
                    typing.remove();
                    bubble.innerHTML = renderMarkdown(chunk);
                    scrollToBottom();
                });
            } else {
                responseText = await callOpenAIAPI(config, apiMessages, abortController.signal, (chunk) => {
                    if (!typing.parentNode) return;
                    typing.remove();
                    bubble.innerHTML = renderMarkdown(chunk);
                    scrollToBottom();
                });
            }

            typing.remove();
            bubble.innerHTML = renderMarkdown(responseText);

            const assistantMsg = { role: 'assistant', content: responseText };
            conversation.push(assistantMsg);
            saveConversation();

        } catch (err) {
            typing.remove();
            if (err.name === 'AbortError') {
                bubble.innerHTML = '<em style="color:var(--text-dim)">已停止</em>';
            } else {
                const errorEl = document.createElement('div');
                errorEl.className = 'msg-error';
                errorEl.textContent = `请求失败: ${err.message}`;
                bubble.innerHTML = '';
                bubble.appendChild(errorEl);
            }
        } finally {
            isStreaming = false;
            sendBtn.disabled = false;
            abortController = null;
            scrollToBottom();
        }
    }

    function buildAPIMessages(config) {
        const msgs = [];
        if (config.systemPrompt) {
            msgs.push({ role: 'system', content: config.systemPrompt });
        }
        conversation.forEach(msg => {
            if (msg.role === 'user' || msg.role === 'assistant') {
                // For API, send clean content
                if (typeof msg.content === 'string') {
                    msgs.push({ role: msg.role, content: msg.content });
                } else if (Array.isArray(msg.content)) {
                    // Convert image_url format for OpenAI
                    const content = msg.content.map(c => {
                        if (c.type === 'image_url') {
                            return {
                                type: 'image_url',
                                image_url: { url: c.image_url.url, detail: 'auto' },
                            };
                        }
                        return c;
                    });
                    msgs.push({ role: msg.role, content });
                }
            }
        });
        return msgs;
    }

    // OpenAI-compatible API
    async function callOpenAIAPI(config, messages, signal, onChunk) {
        const res = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: config.modelName,
                messages,
                max_tokens: config.maxTokens,
                stream: true,
            }),
            signal,
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`${res.status}: ${errText.slice(0, 200)}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;
                const data = trimmed.slice(5).trim();
                if (data === '[DONE]') break;

                try {
                    const json = JSON.parse(data);
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullText += delta;
                        onChunk(fullText);
                    }
                } catch {}
            }
        }

        return fullText;
    }

    // Anthropic API
    async function callAnthropicAPI(config, messages, signal, onChunk) {
        // Separate system prompt
        let systemPrompt = '';
        const filteredMsgs = messages.filter(m => {
            if (m.role === 'system') {
                systemPrompt = typeof m.content === 'string' ? m.content : '';
                return false;
            }
            return true;
        });

        // Convert image format for Anthropic
        const convertedMsgs = filteredMsgs.map(m => {
            if (Array.isArray(m.content)) {
                const content = m.content.map(c => {
                    if (c.type === 'image_url') {
                        const url = c.image_url.url;
                        const match = url.match(/^data:([^;]+);base64,(.+)$/);
                        if (match) {
                            return {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: match[1],
                                    data: match[2],
                                },
                            };
                        }
                    }
                    return c;
                });
                return { ...m, content };
            }
            return m;
        });

        const body = {
            model: config.modelName,
            messages: convertedMsgs,
            max_tokens: config.maxTokens,
            stream: true,
        };
        if (systemPrompt) body.system = systemPrompt;

        const res = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify(body),
            signal,
        });

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`${res.status}: ${errText.slice(0, 200)}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data:')) continue;
                const data = trimmed.slice(5).trim();

                try {
                    const json = JSON.parse(data);
                    if (json.type === 'content_block_delta' && json.delta?.text) {
                        fullText += json.delta.text;
                        onChunk(fullText);
                    }
                } catch {}
            }
        }

        return fullText;
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        });
    }
})();
