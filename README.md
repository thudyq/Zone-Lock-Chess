# Super AI Zone Lock Chess

纯静态版封域棋，在原网页 Easy / Medium / Hard / Expert 的基础上增加了
`Master（MCTS）` 难度。Master 是 `mcts.py` 与 `chess_new.py` 的 JavaScript
BigInt 移植版，在 ES module Web Worker 中运行，不需要 Python、Node 后端或数据库。

## 运行与部署

模块 Worker 需要通过 HTTP(S) 加载。开发时可在本目录运行任意静态服务器，例如：

```powershell
python -m http.server 8080
```

访问 `http://localhost:8080`。生产环境可直接把本目录发布到 GitHub Pages、
Cloudflare Pages、Netlify 或任意静态文件服务器。Master 人机对战不使用原项目的
在线对战后端；在线房间功能仍需要原 Node 服务。

## Master 默认参数

```text
timeLimit                 2.0 秒/步
exploration               sqrt(4.0)
rolloutTemperature        1.3
rolloutCandidateLimit     12
maxSearchSteps            8
valueDeadzoneRatio        0.01
visitFractionThreshold    0.8
```
