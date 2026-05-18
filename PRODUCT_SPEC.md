# The Wall — Product Spec v0.1

> An AI-native JesseOS that **is** the design philosophy it demonstrates.
> The product itself is the understanding. — Jesse Lai

---

## 1. Vision

一个书桌隐喻的个人作品展示网站。所有视觉元素由"基本粒子"组成——贴纸、照片、别针、纸片、笔、文件夹、邮票——它们可以互相组合，像真实书桌上的物件一样存在。

**这不是传统 JesseOS。** 它是 GenUI 的实体化表达：
- 布局由 AI 根据访客身份动态生成（不是固定排版）
- 内容从 Notion 数据库实时获取（不是硬编码）
- 访客可以提问，AI 基于 Jesse 的资料库即时生成新页面
- **产品本身就是对 AI 产品设计的理解**

---

## 2. Design Principles (from DESIGN_LANGUAGE.md)

| Keyword | Meaning |
|---|---|
| **Dynamic** | 布局和内容随访客、时间、交互而变化 |
| **Emergent** | AI 让内容从数据中涌现，不是预设的 |
| **Organic** | 物理感、手感、真实的书桌质感 |
| **Primitive** | 一切由基本粒子组成，粒子是最小单元 |
| **Symbiotic** | 人与 AI 共生——Jesse 提供原料，AI 组织呈现 |

---

## 3. Primitives（基本粒子）

每种粒子是一种原子类型，有自己的视觉形态和 **ability**（能力）。

### 3.1 粒子类型

| 粒子 | 视觉 | Ability | 组合方式 |
|---|---|---|---|
| **贴 (Sticker)** | 贴纸，粒子化纹理 | 能组合图片，装饰性 | 贴在照片/文件上 |
| **照片 (Photo)** | 方形/长方形照片 | 展示人物/场景/作品截图 | 可被别针钉、被文件夹收纳 |
| **别针 (Pin)** | 金属别针/回形针 | 组合 + 固定照片 | 把多张照片夹在一起 |
| **纸片 (Note)** | 纸条/便签 | 展示文字内容 | 可被钉、可被放入文件夹 |
| **笔 (Pen)** | 钢笔/马克笔 | 唤起输入/对话 | 点击触发 AI 对话 |
| **文件夹 (Folder)** | 文件袋/信封 | 有秩序地收纳多个元素 | 包含照片、纸片、贴纸等 |
| **邮票 (Stamp)** | 邮票纹理 | 装饰性标记 | 贴在任何元素上 |

### 3.2 Boundary Rules（边界规则）

- 粒子不能孤立出现在空白处（需要有上下文/组合）
- 同类粒子不能出现太多（避免视觉疲劳）
- 粒子之间有物理感的叠放关系（z-index、阴影、旋转）
- 粒子带有日期标记（马克笔手写风格）

### 3.3 组合示例

```
别针 + 照片×3 → 一组被夹在一起的项目图片
文件夹 + (照片 + 纸片 + 贴纸) → 一个完整的项目案例
邮票 + 照片 → 带装饰标记的照片
笔 → 点击后出现对话输入框
```

---

## 4. Views（视图）

### 4.1 Default View — "文件袋"

- 初始状态：一个文件袋/信封，里面装着各种文件
- **AI 排版**：根据访客信息（来源、设备、时间等）动态决定展示什么、怎么排列
  - 例：来自 LinkedIn → 优先展示职业项目
  - 例：来自设计社区 → 优先展示设计思考
  - 例：凌晨访问 → 更随意、更个人化的内容
- 文件从袋子里散落在桌面上，有自然的叠放角度
- 每次刷新布局可能不同（emergent）

### 4.2 Sorted View — "分类整理"

- 用户主动切换
- 元素按类别整齐排列（项目类、个人类、设计思考类...）
- 类似传统 JesseOS 的 grid 布局，但保留粒子质感
- 每个分类可以是一个文件夹

### 4.3 Detail View — "展开查看"

- 点击任何元素 → 展开/跳转到原始页面
- 原始页面来自 Notion（或外部链接）
- 页面内容动态渲染
- **AI 对话功能**（见 Section 6）

---

## 5. Data Architecture

### 5.1 Notion 作为 CMS

```
Notion Database: "JesseOS"
├── 项目名称 (Title)
├── 封面图片 (Files)  
├── 描述 (Rich Text)
├── 类型 (Select: project / photo / note / design-thought)
├── 标签 (Multi-select)
├── 日期 (Date)
├── 原始链接 (URL)
├── 详细内容 (Relation → 子页面)
├── 排序权重 (Number)
├── 是否展示 (Checkbox)
└── 粒子组合 (Select: single-photo / pinned-group / folder / note+stamp...)
```

### 5.2 同步机制

```
Notion → sync script → content.json + images/ → GitHub Pages
```

- 构建时同步（脚本拉取 Notion 数据）
- 可通过 cron 定时自动同步
- content.json 描述所有元素的类型、位置提示、组合关系
- 图片下载到 repo（避免 Notion 临时 URL 过期）

---

## 6. AI Features

### 6.1 Smart Layout（智能排版）

- **Input**: 访客 user-agent、referrer、时间、设备
- **Output**: 选择展示哪些内容 + 排版布局
- **How**: 调用 LLM，输入用户信息 + 可用内容列表 → 输出布局 JSON
- 可用 lightweight model（快速响应）

### 6.2 AI Conversation（对话生成）

- 用户点击"笔"或在详情页提问
- AI 基于 Notion 资料库回答
- 可以**生成新页面**：根据用户问题 + Jesse 的项目资料 → 动态生成一个新的展示页
- 这就是 GenUI 的核心体现：**UI 是生成的，不是预设的**

### 6.3 实现选项

| 方案 | 优点 | 缺点 |
|---|---|---|
| **Vercel AI SDK + Edge Functions** | 实时、流式输出 | 需要后端 |
| **Cloudflare Workers + AI** | 便宜、快 | 需要 CF 账号 |
| **Client-side API call** | 最简单 | 暴露 API key |

推荐：Vercel 或 Cloudflare Workers 做代理层。

---

## 7. Technical Stack

| Layer | Tech |
|---|---|
| Rendering | PixiJS v8 (WebGL) — 粒子效果、物理感 |
| Layout | Custom layout engine（AI 生成 + 物理模拟） |
| Content | Notion API → content.json |
| AI Backend | Vercel Edge / Cloudflare Workers |
| LLM | GPT-4o-mini (layout) / GPT-4o (conversation) |
| Hosting | GitHub Pages (static) + Serverless (AI) |
| Fonts | Bradford LL, Red Hat Mono |

---

## 8. User Journey

```
1. 访客打开网站
   ↓
2. AI 获取访客信息（referrer, device, time）
   ↓
3. AI 决定展示内容 + 布局
   ↓
4. 文件袋打开动画 → 元素散落在桌面上
   ↓
5. 访客浏览、拖动、翻看元素
   ↓
6. [可选] 切换到 Sorted View
   ↓
7. 点击元素 → 查看详情/跳转原始页面
   ↓
8. [可选] 点击笔/提问 → AI 生成新页面
   ↓
9. 访客带走一个独特的、为 TA 生成的体验
```

---

## 9. Milestones

### Phase 1 — 基础粒子系统
- [ ] 定义所有粒子类型的视觉和交互
- [ ] Notion 数据库搭建 + 同步脚本
- [ ] 静态内容展示（从 content.json 加载）
- [ ] 基本拖动/翻看交互

### Phase 2 — 视图系统
- [ ] Default View（文件袋 → 散落）
- [ ] Sorted View（分类 grid）
- [ ] Detail View（点击展开/跳转）

### Phase 3 — AI 集成
- [ ] Smart Layout（AI 排版）
- [ ] AI Conversation（笔→对话→生成页面）
- [ ] 后端代理搭建

### Phase 4 — 打磨
- [ ] 动画和过渡效果
- [ ] 移动端适配
- [ ] 性能优化
- [ ] 光影效果（dappled light）

---

## 10. Open Questions

1. **AI 排版的 fallback**：如果 AI 服务不可用，用什么默认布局？
2. **对话生成的边界**：AI 能回答的范围？只限于 Jesse 的作品？还是更广？
3. **隐私**：访客信息收集的程度？只用 referrer + device 还是更多？
4. **Notion 内容结构**：需要 Jesse 先在 Notion 里按结构整理内容
5. **生成的页面是否持久化**：AI 生成的页面是临时的还是保存下来？
6. **粒子的物理模拟程度**：简单叠放 vs 真正的物理引擎？

---

*This spec is a living document. Updated as we discuss and iterate.*
