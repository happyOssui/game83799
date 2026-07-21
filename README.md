# 🎲 五子棋 AI 对弈

和真正的 AI 下一局五子棋。

不是预设算法，不是随机落子——每一步都是大语言模型实时思考的结果。

## ✨ 特色

- 🤖 **真 AI 对弈** — 每步棋都由 LLM 实时决策，将完整棋盘状态发送给 AI，由模型计算下一步落子
- 🔌 **兼容多种 API** — 支持所有兼容 Anthropic 格式的 API（Claude、DeepSeek、本地模型等）
- 🎯 **Thinking 控制** — 可调节 AI 思考强度（disabled / low / medium / high / max）
- 💬 **赛后评论** — 对局结束后 AI 会说句话
- 📱 **响应式设计** — 手机、平板、桌面都能玩
- 🍃 **纯前端** — 无需后端服务器，浏览器直接打开 `index.html` 即可运行
- 🔒 **配置本地存储** — API 配置保存在浏览器 localStorage，不会上传到任何服务器

## 🚀 使用方法

1. 克隆仓库

```bash
git clone https://github.com/happyDepth/game83799.git
```

2. 用浏览器打开 `index.html`

3. 在右侧面板填写 API 配置：
   - **API Base URL** — API 地址（默认 Anthropic，可换成 DeepSeek 等）
   - **API Key** — 你的 API 密钥
   - **Model** — 模型名称
   - **Thinking** — 思考强度

4. 点击「保存配置并开始」，执黑先行

## 🎮 游戏规则

| 项目 | 说明 |
|------|------|
| 棋盘 | 15 × 15 |
| 玩家 | 执黑子，先手 |
| AI | 执白子，后手 |
| 胜利 | 率先连成五子一线者获胜 |

## 📁 项目结构

```
├── index.html    主页面
├── styles.css    样式
├── game.js       游戏核心逻辑（棋盘、胜负判断）
├── api.js        API 调用封装（兼容 Anthropic 格式）
├── app.js        主应用交互逻辑
└── server.py     可选的本地代理服务器
```

## 🔧 API 配置示例

| 服务商 | Base URL | Model 示例 |
|--------|----------|------------|
| Anthropic | `https://api.anthropic.com/v1/messages` | `claude-sonnet-4-20250514` |
| 本地模型 | `http://localhost:8080/v1/messages` | 自定义 |

> 只需兼容 Anthropic Messages API 格式即可使用。

## 🖼️ 界面预览

游戏采用温暖木纹风格棋盘，左右分栏布局：

- 左侧：15×15 棋盘 + 状态提示 + 重新开始按钮
- 右侧：API 配置面板 + 规则说明

落子带缩放弹入动画，获胜棋子高亮显示，AI 回合有加载蒙层。

## 📜 License

[MIT](LICENSE)
