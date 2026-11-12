# 灯笼夜行（Lantern Run）— Kiroween 2026 参赛规划

> 比赛：Kiroween 2026（https://kiroween.devpost.com/），Kiro 主办的万圣节主题黑客松
> 截止：2026-12-04（周五）14:00 PT，即北京时间 2026-12-05 06:00
> 本文件是规划草案，基于比赛概览页整理。规则以官方 Rules 页面为准（该页面抓取时返回 403，尚未逐条核对）。

---

## 1. 比赛要点（对规划有约束的部分）

| 项目 | 要求 | 对我们的影响 |
|---|---|---|
| 项目新旧 | 必须在 2026-10-30 之后开始开发，2025 年项目不算 | 本项目从零开始，满足条件 |
| 类别 | Resurrection / Frankenstein / Skeleton Crew / Costume Contest 四选一 | 建议选 **Costume Contest**（见第 2 节） |
| 代码仓库 | 公开的 GitHub 仓库（不能是 GitLab/Bitbucket），有 OSI 开源许可证且在仓库 About 区可见 | 需要 LICENSE 文件（建议 MIT） |
| `.kiro/` 目录 | 必须位于仓库根目录，且**不能**被 .gitignore 忽略 | specs、hooks、steering 都要提交进仓库 |
| 可运行的应用 | 提供可访问的应用链接（如 GitHub Pages） | 做成纯前端游戏，部署成本低 |
| 演示视频 | 不超过 3 分钟，上传 YouTube 并设为公开；不能包含有版权的音乐 | 音效和美术用 CC0 资源，并注明来源 |
| Kiro 使用说明 | 提交文字说明，讲清 specs、hooks、steering、MCP 等功能如何用于开发 | 开发过程要有证据（spec 文件、hook 配置、steering 文件的提交记录） |
| 团队 | 最多 3 人 | 已确认：单人参赛 |
| 评审维度 | 影响力、技术实现、设计、创意、展示 | 技术实现看 Kiro 功能用得是否深入 |

**额外奖项（成本低，可顺带拿）**：Best Demo（无额外要求，所有合格项目自动参评）、Social Blitz（在社交平台发帖并带 `#KiroweenHackathon26`）、Bonus Blog（发一篇第三方博客）。

---

## 2. 项目定位

**一句话**：玩家扮演一只提灯笼的南瓜，在雾气弥漫的村庄里赶路。灯笼火焰会慢慢变小，幽灵靠近会吸走火焰，沿途收集糖果可以补充火焰，走到教堂门口即过关。

**核心玩法（MVP）**
- 俯视角 2D 移动（键盘 + 手机虚拟摇杆）
- 灯笼火焰随时间衰减，火焰归零即失败
- 糖果：拾取后回复火焰
- 幽灵：3 种行为（直线巡逻、追踪、闪现），接触时吸走火焰
- 技能：“吹灭”（冷却 5 秒），把附近幽灵吹退
- 3 个夜晚关卡，难度递增，每关结束统计糖果数
- 最高分存本地（localStorage）

**类别选择：Costume Contest（推荐）**
- 评审重点是“令人难忘的恐怖 UI 和设计”，适合我们的游戏形态，玩法做到完整即可。
- 备选：Resurrection（把一个过时的游戏类型复活，比如用现代技术重做老式雾中寻路游戏）。概念更有话题性，但需要解释“复活什么”，故事成本更高。
- 不建议 Frankenstein 和 Skeleton Crew：前者要缝合多个技术，三周内风险高；后者要做两个应用，工作量翻倍。

---

## 3. 技术方案

| 层 | 选择 | 理由 |
|---|---|---|
| 语言 | TypeScript | 类型检查可以挂在 hook 上自动跑 |
| 游戏引擎 | Phaser 3 | 成熟，2D 动画、碰撞、音频现成，适合三周时间 |
| 构建 | Vite | 启动快，产出静态文件方便部署 |
| 测试 | Vitest + fast-check | 纯逻辑（火焰衰减、幽灵行为、关卡生成）用属性测试覆盖，比赛评分表也提到 PBT |
| 部署 | GitHub Pages | 免费，直接给评审一个可玩的链接 |
| 美术/音频 | Kenney、OpenGameArt 上的 CC0 资源 | 无版权风险，省去自己画图的时间 |

目录结构（初步）：

```
qiuqiu-kakaka/
├── .kiro/
│   ├── specs/lantern-run/      # requirements.md, design.md, tasks.md
│   ├── steering/               # product.md, tech.md, style-guide.md
│   └── hooks/                  # 保存时类型检查、任务完成后跑测试
├── src/
│   ├── core/                   # 纯逻辑：火焰、糖果、幽灵、关卡（可测试）
│   ├── scenes/                 # Phaser 场景：菜单、游戏、结算
│   ├── ui/                     # HUD、虚拟摇杆、恐怖风格的文字与特效
│   └── main.ts
├── tests/                      # Vitest + fast-check
├── public/assets/              # CC0 资源，附 CREDITS.md 注明来源
├── LICENSE                     # MIT
├── README.md
└── PLAN.md                     # 本文件
```

**关键设计原则**：把游戏规则写成不依赖 Phaser 的纯函数（`src/core/`），这样规则可以单独做属性测试，也方便 Kiro 在 spec 里逐条实现和验证。

---

## 4. 如何使用 Kiro（对应评审中的“技术实现”）

评审要求看到“多种 Kiro 功能有意义地组合使用”，因此计划有意覆盖以下几项，并保留开发证据：

| Kiro 功能 | 具体用法 | 需要留下的证据 |
|---|---|---|
| **Spec（规格驱动）** | 用 requirements → design → tasks 三步生成游戏规格，任务逐条执行 | `.kiro/specs/lantern-run/` 三个文件，commit 历史里能看出按任务推进 |
| **Steering（引导文件）** | `product.md`：游戏基调、玩法约束；`tech.md`：技术栈与编码规范；`style-guide.md`：恐怖配色、字体、动效规则 | 三个 steering 文件；write-up 中说明哪条规则对输出影响最大 |
| **Hooks（自动化钩子）** | `PostFileSave`：保存 `.ts` 时跑类型检查；`PostTaskExec`：任务完成后跑测试 | `.kiro/hooks/*.json`；write-up 中说明节省了哪些重复操作 |
| **MCP** | 接入浏览器自动化 MCP（如 Playwright），让 Kiro 在部署前自动跑一遍关卡并截图 | MCP 配置说明；截图留在 `docs/` 中 |
| **Powers** | 用于前端或测试相关的最佳实践包（安装前需确认可用） | 记录用了哪个 power 及效果 |
| **Custom agent（可选）** | 建一个“美术风格审查”agent，检查新 UI 是否符合 style-guide | 仅在时间允许时做 |

每个功能至少要有一个真实的使用场景和前后对比，比单纯列出来更有说服力。

---

## 5. 时间计划（11-12 至 12-03，约 3 周）

| 日期 | 阶段 | 产出 |
|---|---|---|
| 11-12 ~ 11-15 | 立项 | 仓库初始化、LICENSE、`.kiro/` 骨架、三个 steering 文件、spec 的 requirements 和 design |
| 11-16 ~ 11-22 | 核心玩法 | 移动、灯笼火焰衰减、糖果、一种幽灵、一个可玩的夜晚；核心逻辑有测试 |
| 11-23 ~ 11-29 | 内容与体验 | 三个夜晚、三种幽灵、吹灭技能、音效、手机摇杆、恐怖 UI、结算页 |
| 11-30 ~ 12-01 | **功能冻结** | 不再加新功能；只修 bug，跑属性测试，部署到 GitHub Pages |
| 12-02 | 材料 | 录演示视频（≤3 分钟）、写 Kiro 使用说明、补 README |
| 12-03 | **提交** | 留一天缓冲。截止是 12-04 PT，北京时间是 12-05 06:00 |

**额外动作（每天 5 分钟即可）**：在 Discord 的 #kiroween-hackathon 频道提问；申请 Resources 页面的 Kiro credits；Social Blitz 和 Bonus Blog 在 12-02 前完成。

---

## 6. 风险与应对

| 风险 | 应对 |
|---|---|
| 范围蔓延（想加的内容太多） | 第 2 节的 MVP 是上限；新想法放进“Stretch”列表，功能冻结后再看 |
| 美术/音频拖慢进度 | 先用占位图形和 CC0 资源；美术统一只选一套包 |
| 视频录制耗时 | 12-02 当天只录视频，脚本提前在 11-29 前写好 |
| 版权问题 | 所有素材记入 `CREDITS.md`，不用商业音乐 |
| 评审打不开游戏 | 不依赖登录；README 写明操作方式；部署前在手机和桌面各测一次 |
| 对规则理解有误 | 提交前完整读一遍官方 Rules 页面，尤其是 `.kiro` 和 License 两条 |

---

## 7. Stretch（仅在功能冻结前完成才考虑）

- 无尽模式
- 幽灵的 Boss 夜晚
- 角色皮肤（服装挑选，呼应 Costume Contest 主题）
- 排行榜（需要后端，不做则保持纯前端）

---

## 8. 已确认与待确认

**已确认**
- 单人参赛，不组队
- 类别：Costume Contest
- 不是学生，因此不参加 Best Student Project 等学生奖项

**待确认**
1. **技术栈**：暂按 Phaser 3 + TypeScript 推进，如有异议请告知。
2. **开始时机**：是否现在开始搭仓库骨架，并编写 `.kiro/` 下的 steering 和 spec 文件。
