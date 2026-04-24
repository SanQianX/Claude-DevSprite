```markdown
# Claude-DevSprite Ralph Loop 持续迭代开发指令 v4.1

> **周末无人值守版 — 合并 Agent Team + 文件通信 + 上下文管理 + 7门禁停止条件 + 生成物隔离**
> 
> 直接复制以下全部内容，喂给 Claude Code 启动开发。周末不停止，直到全部门禁通过。

---

## 〇、生成物隔离原则（最高优先级）

### 核心规则

**Claude Code 开发过程产生的所有文件，必须与项目源码严格隔离。**

| 文件类型 | 存放目录 | 说明 |
|---------|---------|------|
| 任务文件、结果文件 | `agent-comms/` | 任务板、Agent 状态、信号文件 |
| 测试报告 | `test-results/` | 每轮循环的测试结果 |
| 进度状态机 | `progress.json` | 根目录，仅此一个状态文件 |
| 上下文快照 | `context-snapshot.md` | 根目录，仅此一个快照文件 |
| 测试脚本 | `dev-scripts/` | e2e 脚本、验证脚本、临时脚本 |
| 截图 | `dev-scripts/screenshots/` | 端到端测试截图 |
| 设计文档、决策记录 | `agent-comms/decisions/` | ADR、接口设计草稿 |
| **项目源码** | `src/`、`web/` | 仅存放正式代码，不混入开发文档 |
| **架构文档** | 根目录 | `ARCHITECTURE.md` 唯一架构文档 |

### 目录结构（完整）

```
E:\SanQian.Xu\Claude-DevSprite\
├── ARCHITECTURE.md                  ← 唯一架构文档
├── RALPH_LOOP_INSTRUCTION.md        ← 开发流程指令（本文件）
├── progress.json                    ← 项目进度状态机（唯一状态文件）
├── context-snapshot.md              ← 关键决策快照（唯一快照）
├── package.json                     ← 项目依赖配置
│
├── src/                             ← 🎯 项目源码（后端）
├── web/                             ← 🎯 项目源码（前端）
│
├── agent-comms/                     ← 🗂️ Agent 通信归档
│   ├── task-board.md
│   ├── agent-status.md
│   ├── tasks/
│   ├── decisions/
│   └── signals/
│
├── test-results/                    ← 🗂️ 测试结果归档
│   └── loop{N}.md
│
├── dev-scripts/                     ← 🗂️ 开发用脚本
│   ├── e2e-full-test.js
│   └── screenshots/
│
└── .gitignore                       ← 忽略开发产物
```

### .gitignore 规则

```gitignore
# Claude Code 开发过程产物（不提交到 Git）
agent-comms/
test-results/
dev-scripts/screenshots/
progress.json
context-snapshot.md

# 依赖
node_modules/
```

### 强制约束

1. **禁止**在 `src/` 或 `web/` 目录下创建任何 `.md` 文档（除 `README.md`）
2. **禁止**在项目根目录散落临时脚本、测试文件
3. 所有脚本放入 `dev-scripts/`，所有报告放入 `test-results/`
4. Lead 初始化时必须创建上述目录结构

---

## ⚠️ 最高优先级规则：上下文保护

### 核心原则：对话只做"通知"，文件承载"内容"

**禁止在对话中发送超过 100 字的指令。** 
所有任务详情、代码讨论、测试报告必须写入文件，对话仅用作状态同步信号。

### 通信协议

| 场景         | 文件操作                             | 对话输出（≤50字）              |
| ------------ | ------------------------------------ | ------------------------------ |
| Lead 发任务  | 写入 `agent-comms/tasks/TASK-NNN.md` | "@Agent 任务板已更新 TASK-NNN" |
| Agent 接任务 | 读取任务文件                         | "已认领 TASK-NNN"              |
| Agent 报结果 | 写入 `TASK-NNN-result.md`            | "TASK-NNN 完成，修改 N 个文件" |
| 测试报告     | 写入 `test-results/loop{N}.md`       | "门禁X FAIL，详情见文件"       |

---

## 一、项目初始化（首次执行）

### 1.1 必须创建的文件结构

Team Lead，执行以下初始化：

1. 创建目录 `agent-comms/tasks/` `agent-comms/decisions/` `agent-comms/signals/` `test-results/` `dev-scripts/screenshots/`
2. 创建 `agent-comms/task-board.md`，内容为空白看板模板
3. 创建 `agent-comms/agent-status.md`，所有 Agent 状态设为 "就绪"
4. 创建 `progress.json`，所有门禁设为 `"NOT_STARTED"`，`loopCount=0`，`currentPhase=1`
5. 创建 `context-snapshot.md`，从 `ARCHITECTURE.md` 提取 5 个关键决策
6. 创建 `package.json`，包含必要依赖（express, better-sqlite3, simple-git, marked, highlight.js, chokidar, gray-matter）
7. 创建 `web/package.json`，包含前端依赖（vue, vue-router, pinia, marked, highlight.js）
8. 创建 `dev-scripts/e2e-full-test.js`，内容使用附录的完整脚本
9. 创建 `.gitignore`，内容使用上述规则

完成后对话输出："初始化完成"

---

## 二、角色定义

```
┌─────────────────────────────────────────────────────────────────┐
│                 Claude-DevSprite Agent Team                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  👤 Team Lead（你担任）                                          │
│     · 读取 ARCHITECTURE.md 理解全貌                              │
│     · 每轮 Ralph Loop：读 progress.json → 定计划 → 写任务文件   │
│     · 评审 Agent 结果 → 更新 task-board.md                       │
│     · 判断门禁是否通过 → 更新 progress.json                      │
│     · 决定 Ralph Loop 继续/停止                                  │
│     · ⚠️ 禁止亲自写代码、测试、部署                               │
│                                                                   │
│  👤 设计 Agent                                                    │
│     · 接到任务 → 读取任务文件 → 输出设计文档 → 写入结果文件      │
│     · 交付物：模块接口、数据模型、API 格式                       │
│     · 设计文档写入 agent-comms/decisions/                        │
│                                                                   │
│  👤 开发 Agent (Backend)                                          │
│     · 接到任务 → 读取任务文件 → 修改 src/ → npm run build       │
│     · 负责：Git检测器、AI分析引擎、知识库管理、Worker服务、      │
│             SQLite、API路由                                       │
│     · 修改范围严格限制在 src/ 目录                               │
│                                                                   │
│  👤 开发 Agent (Frontend)                                         │
│     · 接到任务 → 读取任务文件 → 修改 web/ → npm run build       │
│     · 负责：Vue3应用、所有组件、composables、样式、              │
│             Markdown渲染、链接处理                                 │
│     · 修改范围严格限制在 web/ 目录                               │
│                                                                   │
│  👤 测试 Agent                                                    │
│     · 接到任务 → 读取任务文件 → 执行测试 → 写入 test-results/   │
│     · 负责：7个门禁验证、端到端测试、Puppeteer UI 测试           │
│     · 测试脚本写入 dev-scripts/                                  │
│     · ⚠️ 必须实际执行，禁止假设通过                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 三、任务文件模板

### TASK-NNN.md 模板（Lead 创建）

```markdown
# TASK-NNN: [简短标题]

> 创建: [ISO时间]
> 分配给: [设计Agent/开发Agent(Backend)/开发Agent(Frontend)/测试Agent]
> 优先级: P0/P1/P2
> 依赖: [依赖的任务ID，无则写"无"]
> Phase: [1/2/3/4]

## 背景
[1-2 句话说明为什么要做这个任务]

## 任务清单
- [ ] [具体任务项1]
- [ ] [具体任务项2]

## 涉及文件
- [ ] [文件路径] ([操作：新建/修改])

## 验收标准
[明确的通过条件，可量化]

## 参考
- ARCHITECTURE.md 第[X]节
- [相关文档或之前任务]
```

### TASK-NNN-result.md 模板（Agent 创建）

```markdown
# TASK-NNN 执行结果

> 完成时间: [ISO时间]
> 执行者: [角色]
> 状态: ✅ 完成 / ❌ 未完成

## 修改文件清单
| 文件 | 操作 | 说明 |
|------|------|------|
| xxx.ts | 新建 | xxx |

## 自测结果
[Agent 自己的测试结果]

## 遇到的问题
[阻塞、风险、需要决策的事项]
```

---

## 四、Ralph Loop 循环（4 步骤）

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  PLAN   │────▶│  BUILD  │────▶│  TEST   │────▶│ REVIEW  │
│  计划   │     │  构建   │     │  测试   │     │  评审   │
└─────────┘     └─────────┘     └─────────┘     └────┬────┘
     ▲                                               │
     │         判断停止条件                           │
     │         PASS=7 → 项目完成，退出循环            │
     │         PASS<7 → 继续下一轮                    │
     └───────────────────────────────────────────────┘
```

### PLAN 阶段（Lead 执行）
1. 读取 `progress.json` → 了解门禁状态
2. 读取 `context-snapshot.md` → 恢复关键决策
3. 读取上次 `test-results/` → 了解失败原因
4. 制定本轮目标 → 写入任务文件到 `agent-comms/tasks/` → 更新 `task-board.md`
5. **对话输出**: `"第N轮 PLAN: 目标=[目标]，任务=[ID列表]，并行=[是/否]"`

### BUILD 阶段（开发 Agent 执行）
1. Agent 认领任务 → 读取任务文件 → 执行
2. Agent 完成 → 写入结果文件 → **对话通知**
3. Lead 跟踪进度 → 更新 `task-board.md`

### TEST 阶段（测试 Agent 执行）
1. 测试 Agent 读取对应任务文件 → 执行测试
2. 测试结果写入 `test-results/loop{N}.md`
3. **对话输出**: `"测试完成，通过X/7，失败门禁: [列表]，详情见文件"`

### REVIEW 阶段（Lead 执行）
1. Lead 读取 `test-results/loop{N}.md`
2. 更新 `progress.json`（门禁状态 + loopCount++）
3. 更新 `context-snapshot.md`
4. 判断停止条件
5. **对话输出**: `"第N轮 REVIEW: 通过X/7，[继续/停止]"`

---

## 五、停止条件（7 个强制门禁）

**必须全部 PASS 才能宣布项目完成。任何一个 FAIL，Ralph Loop 自动继续。**

| 门禁 | 名称       | 验证方法                                         |
| ---- | ---------- | ------------------------------------------------ |
| 1    | 后端启动   | Worker服务启动在38888，`/api/health` 返回200     |
| 2    | API 功能   | 5个核心API可用: projects/tree/file/search/source |
| 3    | Git 检测   | commit后10秒内检测到CommitEvent                  |
| 4    | AI 分析    | 触发分析后生成/更新 knowledge.md                 |
| 5    | 前端构建   | `npm run build` 无报错，`web/dist/` 生成         |
| 6    | 端到端联动 | Puppeteer 测试通过：首页→项目→文档→跳转→源码     |
| 7    | 回归测试   | 第二轮端到端无异常，无控制台错误                 |

### progress.json 格式

```json
{
  "loopCount": 0,
  "currentPhase": 1,
  "lastUpdate": "2026-04-24T00:00:00Z",
  "gates": {
    "gate1_backend_start": "NOT_STARTED",
    "gate2_api_function": "NOT_STARTED",
    "gate3_git_detection": "NOT_STARTED",
    "gate4_ai_analysis": "NOT_STARTED",
    "gate5_frontend_build": "NOT_STARTED",
    "gate6_e2e_integration": "NOT_STARTED",
    "gate7_regression": "NOT_STARTED"
  },
  "completedTasks": [],
  "activeTasks": []
}
```

### 门禁验证命令（测试 Agent 必须实际执行）

```bash
# 门禁1: 后端启动
cd E:\SanQian.Xu\Claude-DevSprite
npm install && npm run build
Start-Process node -ArgumentList "dist/index.js" -NoNewWindow
Start-Sleep 3
curl http://localhost:38888/api/health
# 预期: {"status":"ok"}

# 门禁2: API 功能（需要测试知识库目录存在）
curl http://localhost:38888/api/projects
curl "http://localhost:38888/api/projects/MaskInspect/tree"
curl "http://localhost:38888/api/projects/MaskInspect/file?path=knowledge/features/dual-camera-calibration/knowledge.md"
curl "http://localhost:38888/api/projects/MaskInspect/search?q=标定"
curl "http://localhost:38888/api/projects/MaskInspect/source?path=caldialog.cpp&start=3792&end=3923"

# 门禁3: Git 检测
cd E:\2025.7.2task\知识库\MaskInspect
echo "test" >> test.txt
git add test.txt && git commit -m "test: verify dev-sprite detection"
# 观察 Worker 日志，预期 10 秒内检测到 commit

# 门禁4: AI 分析
curl -X POST http://localhost:38888/api/projects/MaskInspect/analyze `
  -H "Content-Type: application/json" `
  -d '{"mode":"incremental"}'
# 等待分析完成，检查 knowledge/ 目录是否有文件更新

# 门禁5: 前端构建
cd E:\SanQian.Xu\Claude-DevSprite\web
npm install && npm run build
# 预期: 无报错，web/dist/ 目录生成 index.html

# 门禁6 + 7: 端到端测试
node E:\SanQian.Xu\Claude-DevSprite\dev-scripts\e2e-full-test.js
```

---

## 六、上下文管理（无人值守关键）

### Compact 触发条件
1. 每完成 **3 个任务** → 触发 Compact
2. 每通过 **1 个门禁** → 触发 Compact
3. Agent **3 分钟无响应** → 检查并触发 Compact
4. 对话出现 **context length 警告** → 立即 Compact

### Compact 操作流程
```
Step 1: 保存状态
  - 更新 progress.json (门禁状态 + loopCount)
  - 更新 context-snapshot.md (提取当前关键决策)
  - 更新 agent-comms/task-board.md (任务状态)
  
Step 2: 确认持久化
  - 确认所有代码修改已写入磁盘文件
  - 确认所有结果文件已写入 agent-comms/tasks/
  
Step 3: 执行压缩
  - /compact
  
Step 4: 恢复状态
  - 读取 progress.json → 了解门禁进度
  - 读取 context-snapshot.md → 恢复关键决策
  - 读取 agent-comms/task-board.md → 恢复任务队列
  
Step 5: 继续循环
  - 对话输出: "上下文已恢复，继续第N轮 Ralph Loop"
```

### 对话卡死/崩溃恢复
如果 Claude Code 意外断开或卡死，重新启动后输入：
```
请从 progress.json、context-snapshot.md、task-board.md 恢复状态，
继续第 N 轮 Ralph Loop。当前门禁进度: gate1=X, gate2=X...
```

---

## 七、开发阶段规划

### Phase 1: 核心骨架 → 目标：门禁 1, 2, 5
```
□ 初始化项目结构 + package.json
□ Express Worker 服务 + 基础路由
□ SQLite 数据库初始化 + 表创建
□ API: /api/projects, /api/projects/:name/tree, file, source, search
□ Vue 3 项目骨架 + 首页 ProjectList
□ 前端构建验证
```

### Phase 2: 检测与分析 → 目标：门禁 3, 4
```
□ Git 检测器（三级降级：Hook → Watcher → Poller）
□ Diff Collector + Context Builder
□ AI Provider 适配层 + Prompt 模板
□ Document Generator + 分析任务队列
□ 知识库文档生成验证
```

### Phase 3: 可视化 → 目标：门禁 6
```
□ FileTree 组件 + 展开/折叠/高亮
□ Markdown 渲染 + 代码高亮
□ TableOfContents 组件 + 滚动同步
□ Link Resolver + 知识库间跳转
□ Source Viewer（弹窗/分屏 + 行号高亮）
□ SearchBar + 搜索结果
□ 响应式布局 + 浏览器前进/后退
```

### Phase 4: 收敛 → 目标：门禁 7
```
□ 回归端到端测试
□ Bug 修复
□ 错误处理完善
□ 最终验收
```

---

## 八、硬性停止条件（安全阀）

**即使门禁未全部通过，满足以下任一条件也必须停止并报告：**

1. **循环次数 ≥ 35 轮** → 可能存在架构设计问题，停止并输出问题报告
2. **同一门禁连续 FAIL ≥ 5 轮** → 该门禁存在根本性障碍，停止并报告
3. **连续 3 轮无任何门禁状态变化** → 系统陷入死循环，停止并报告
4. **AI 分析连续失败 ≥ 5 次** → API 或模型配置问题，停止并报告

---

## 九、现在开始

Team Lead，执行第 1 轮 Ralph Loop。

### 第一步：初始化
1. 创建文件结构（见第一节）
2. 创建 `progress.json` 和 `context-snapshot.md`
3. 创建 `package.json` 和 `web/package.json`
4. 创建 `.gitignore`
5. 创建 `dev-scripts/e2e-full-test.js`（使用附录脚本）
6. 对话输出："初始化完成，进入 Phase 1"

### 第二步：Phase 1 开发
按照 PLAN → BUILD → TEST → REVIEW 循环推进，直到门禁 1, 2, 5 全部 PASS。

### 第三步：Phase 2-4 依次推进
直到 7 个门禁全部 PASS，或触发硬性停止条件。

---

**核心规则（写死，不可违反）：**
1. ⚠️ 对话只说通知，内容全在文件
2. ⚠️ 每个门禁必须实测，禁止假设通过
3. ⚠️ 7 个门禁全部 PASS 才能停止
4. ⚠️ 上下文满了就 Compact，然后从文件恢复继续
5. ⚠️ 开发产物严格隔离，禁止污染 src/ 和 web/
6. ⚠️ 周末无人值守，任务失败自动重试，直到通过或到达硬性停止条件
7. ⚠️ 超 35 轮或死循环自动停止并报告

---

## 附录：e2e-full-test.js

```javascript
// e2e-full-test.js - 完整端到端验证脚本
// 用法: node dev-scripts/e2e-full-test.js

const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');

const BASE = 'http://localhost:38888';
const RESULTS = [];
const SCREENSHOT_DIR = './dev-scripts/screenshots';

// 确保截图目录存在
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function check(name, fn) {
  try {
    await fn();
    RESULTS.push({ name, status: 'PASS', error: null });
    console.log(`  ✅ ${name}`);
  } catch (e) {
    RESULTS.push({ name, status: 'FAIL', error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function httpGet(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } 
          catch { resolve(data); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  console.log('=== Claude-DevSprite 端到端验证 ===\n');
  console.log(`时间: ${new Date().toISOString()}\n`);

  // ==========================================
  // 门禁1: 后端启动验证
  // ==========================================
  console.log('--- 门禁1: 后端启动验证 ---');
  
  await check('1.1 Health Check', async () => {
    const res = await httpGet('/api/health');
    if (res.status !== 'ok') throw new Error('Health check 返回异常');
  });

  // ==========================================
  // 门禁2: API 功能验证
  // ==========================================
  console.log('\n--- 门禁2: API 功能验证 ---');
  
  let projectName = null;
  
  await check('2.1 GET /api/projects', async () => {
    const res = await httpGet('/api/projects');
    if (!res.projects || !Array.isArray(res.projects)) {
      throw new Error('projects 字段缺失或格式错误');
    }
    if (res.projects.length === 0) {
      throw new Error('没有发现任何项目');
    }
    projectName = res.projects[0].name;
    console.log(`     发现项目: ${projectName}`);
  });

  await check('2.2 GET /api/projects/:name/tree', async () => {
    if (!projectName) throw new Error('无项目名，跳过');
    const res = await httpGet(`/api/projects/${projectName}/tree`);
    if (!res.tree) throw new Error('tree 字段缺失');
  });

  await check('2.3 GET /api/projects/:name/file', async () => {
    if (!projectName) throw new Error('无项目名，跳过');
    const treeRes = await httpGet(`/api/projects/${projectName}/tree`);
    
    // 查找第一个 .md 文件
    function findFirstMd(node) {
      if (node.type === 'file' && node.path.endsWith('.md')) return node.path;
      if (node.children) {
        for (const child of node.children) {
          const found = findFirstMd(child);
          if (found) return found;
        }
      }
      return null;
    }
    
    const mdPath = findFirstMd(treeRes.tree);
    if (!mdPath) {
      console.log('      ⚠️ 没有 .md 文件，跳过此检查');
      return;
    }
    
    const res = await httpGet(`/api/projects/${projectName}/file?path=${mdPath}`);
    if (!res.content) throw new Error('content 字段缺失');
  });

  await check('2.4 GET /api/projects/:name/search', async () => {
    if (!projectName) throw new Error('无项目名，跳过');
    const res = await httpGet(`/api/projects/${projectName}/search?q=test`);
    if (!res.results) throw new Error('results 字段缺失');
  });

  // ==========================================
  // 门禁5: 前端构建验证
  // ==========================================
  console.log('\n--- 门禁5: 前端构建验证 ---');

  await check('5.1 npm run build', async () => {
    const cwd = process.cwd();
    execSync('npm run build', { cwd: `${cwd}/web`, stdio: 'pipe' });
  });

  await check('5.2 dist/ 目录生成', async () => {
    const cwd = process.cwd();
    if (!fs.existsSync(`${cwd}/web/dist/index.html`)) {
      throw new Error('web/dist/index.html 不存在');
    }
  });

  // ==========================================
  // 门禁6: 端到端联动验证（使用 Puppeteer）
  // ==========================================
  console.log('\n--- 门禁6: 端到端联动验证 ---');
  
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    console.log('  ⚠️ Puppeteer 未安装，跳过 UI 测试');
    console.log('  安装命令: npm install puppeteer');
  }

  if (puppeteer) {
    let browser;
    try {
      browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      page.setDefaultTimeout(10000);

      await check('6.1 首页渲染', async () => {
        await page.goto(BASE, { waitUntil: 'networkidle2' });
        const title = await page.title();
        if (!title) throw new Error('页面无标题');
        await page.screenshot({ path: `${SCREENSHOT_DIR}/e2e-home.png` });
      });

      await check('6.2 项目导航', async () => {
        const card = await page.$('.project-card, [data-project]');
        if (!card) throw new Error('未找到项目卡片');
        await card.click();
        await page.waitForSelector('.file-tree, .sidebar', { timeout: 5000 });
        await page.screenshot({ path: `${SCREENSHOT_DIR}/e2e-project.png` });
      });

      await check('6.3 文档渲染', async () => {
        const mdLink = await page.$('[data-type="md"], .file-node.md');
        if (!mdLink) {
          console.log('      ⚠️ 未找到 .md 文件链接，跳过');
          return;
        }
        await mdLink.click();
        await page.waitForSelector('.markdown-content, .markdown-viewer', { timeout: 5000 });
        await page.screenshot({ path: `${SCREENSHOT_DIR}/e2e-document.png` });
      });

      await check('6.4 链接跳转', async () => {
        const links = await page.$$('a[href*=".md"], a[href*=".cpp"], a[href*=".h"]');
        if (links.length > 0) {
          await links[0].click();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: `${SCREENSHOT_DIR}/e2e-link-navigation.png` });
        } else {
          console.log('      ⚠️ 未找到可跳转链接，跳过');
        }
      });

    } finally {
      if (browser) await browser.close();
    }
  }

  // ==========================================
  // 输出结果汇总
  // ==========================================
  console.log('\n========================================');
  console.log('           验证结果汇总');
  console.log('========================================\n');

  const passCount = RESULTS.filter(r => r.status === 'PASS').length;
  const failCount = RESULTS.filter(r => r.status === 'FAIL').length;
  const totalCount = RESULTS.length;

  RESULTS.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    if (r.error) console.log(`   └─ ${r.error}`);
  });

  console.log(`\n─────────────────────────────`);
  console.log(`通过: ${passCount}/${totalCount}`);
  console.log(`失败: ${failCount}/${totalCount}`);
  console.log(`─────────────────────────────\n`);

  if (failCount > 0) {
    console.log('❌ 存在未通过项目，Ralph Loop 继续迭代');
    process.exit(1);
  } else {
    console.log('✅ 所有检查通过！');
    process.exit(0);
  }
})().catch(e => {
  console.error('\n💥 测试脚本异常:', e.message);
  process.exit(1);
});
```


