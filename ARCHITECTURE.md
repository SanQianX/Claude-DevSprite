---

# Claude-DevSprite 完整架构设计方案 v2.0

> 一个 Claude Code Skill，自动监听 Git Commit，通过 AI 分析代码变更，生成/更新结构化知识库文档，配套 Web Dashboard 支持文档间跳转和源码预览。
> 设计日期：2026-04-24

---

## 目录

1. [项目定位](#一项目定位)
2. [系统架构](#二系统架构)
3. [Git Commit 自动检测](#三git-commit-自动检测零配置)
4. [AI 分析引擎](#四ai-分析引擎)
5. [知识库文档系统](#五知识库文档系统)
6. [文档跳转系统](#六文档跳转系统核心创新)
7. [Web Dashboard](#七web-dashboard)
8. [数据库设计](#八数据库设计)
9. [API 接口设计](#九api-接口设计)
10. [项目目录结构](#十项目目录结构)
11. [技术选型与依赖](#十一技术选型与依赖)
12. [部署与配置](#十二部署与配置)
13. [开发路线图](#十三开发路线图)

---

## 一、项目定位

### 1.1 一句话描述
**自动将 Git 提交转化为可浏览、可跳转、团队共享的项目知识库。**

### 1.2 与 claude-mem 的关系

| 对比维度     | Claude-mem                | Claude-DevSprite          |
| ------------ | ------------------------- | ------------------------- |
| **监听目标** | Claude Code 工具调用      | Git Commit 事件           |
| **生成内容** | 会话记忆（JSON）          | 知识库文档（Markdown）    |
| **存储位置** | SQLite + ChromaDB         | 项目仓库 knowledge/ 目录  |
| **可视化**   | 记忆时间线                | GitHub 风格文档浏览器     |
| **团队协作** | 单人                      | 知识库随代码 Git 协作     |
| **AI 策略**  | 复用 Claude Code 模型配置 | 复用 Claude Code 模型配置 |
| **运行模式** | 后台守护进程，全自动      | 后台守护进程，全自动      |
| **Web UI**   | localhost:37777           | localhost:38888           |

### 1.3 核心价值

```
开发者正常写代码
      ↓
  git commit
      ↓
Claude-DevSprite 自动分析
      ↓
知识库文档自动更新（零感知）
      ↓
打开浏览器 → 可视化浏览所有知识库
      ↓
文档间跳转 + 源码预览 + 团队共享
```

---

## 二、系统架构

### 2.1 总体架构图

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         Claude-DevSprite 系统架构                            │
│                                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      1. 生命周期钩子层                                  │ │
│  │                                                                        │ │
│  │  SessionStart ──── UserPromptSubmit ──── PostToolUse ──── SessionEnd  │ │
│  │       │                  │                    │               │        │ │
│  │       ▼                  ▼                    ▼               ▼        │ │
│  │  ┌─────────┐    ┌─────────────┐    ┌─────────────┐   ┌──────────┐     │ │
│  │  │初始化     │    │拦截 /kb 命令│    │检测 Git 操作 │   │资源清理   │     │ │
│  │  │Worker    │    │手动触发分析 │    │自动触发分析  │   │保存状态   │     │ │
│  │  │服务      │    │查询知识库   │    │             │   │           │     │ │
│  │  └─────────┘    └─────────────┘    └──────┬──────┘   └──────────┘     │ │
│  │                                           │                            │ │
│  └───────────────────────────────────────────┼────────────────────────────┘ │
│                                              ▼                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      2. Git Commit 检测层（三级自动降级）               │ │
│  │                                                                        │ │
│  │  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────┐ │ │
│  │  │ 策略A: Git Hook │   │ 策略B: 文件监听  │   │ 策略C: Reflog 轮询  │ │ │
│  │  │                 │   │                 │   │                     │ │ │
│  │  │ SessionStart    │   │ fs.watch()      │   │ setInterval()       │ │ │
│  │  │ 自动安装        │   │ 监控 .git/refs/ │   │ git reflog -1      │ │ │
│  │  │ post-commit     │   │ heads/main      │   │ 每5秒检测一次      │ │ │
│  │  │ 实时触发        │   │ 1-2秒延迟       │   │ 兜底方案           │ │ │
│  │  └────────┬────────┘   └────────┬────────┘   └──────────┬──────────┘ │ │
│  │           │                    │                        │             │ │
│  │           └────────────────────┼────────────────────────┘             │ │
│  │                                ▼                                      │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │  CommitEvent {                                                  │ │ │
│  │  │    hash, message, author, timestamp,                            │ │ │
│  │  │    filesChanged[], diff, repoPath                               │ │ │
│  │  │  }                                                              │ │ │
│  │  └─────────────────────────────┬───────────────────────────────────┘ │ │
│  └────────────────────────────────┼──────────────────────────────────────┘ │
│                                   ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      3. AI 分析引擎                                    │ │
│  │                                                                        │ │
│  │  ┌───────────────┐   ┌────────────────┐   ┌────────────────────────┐ │ │
│  │  │ Diff Collector│   │ Context Builder│   │ Document Generator     │ │ │
│  │  │               │   │                │   │                        │ │ │
│  │  │ · git diff    │──▶│ · 变更代码     │──▶│ · 增量/全量分析策略    │ │ │
│  │  │ · 变更文件    │   │ · 已有知识库   │   │ · Markdown 模板生成    │ │ │
│  │  │ · commit msg  │   │ · 项目结构     │   │ · 关联文档自动建立     │ │ │
│  │  │ · 变更统计    │   │ · 代码上下文   │   │ · 源文件链接生成       │ │ │
│  │  └───────────────┘   └────────────────┘   └───────────┬────────────┘ │ │
│  │                                                        │             │ │
│  │  ┌─────────────────────────────────────────────────────┘             │ │
│  │  ▼                                                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │ │
│  │  │ AI Provider（直接复用 Claude Code 当前模型配置）                   │ │ │
│  │  │                                                                  │ │ │
│  │  │ · 读取 Claude Code 当前 API endpoint / model / auth              │ │ │
│  │  │ · 零配置，用户用什么模型，分析就用什么模型                         │ │ │
│  │  │ · 重试机制：失败自动重试 3 次，指数退避                            │ │ │
│  │  └─────────────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────┬────────────────────────────────────┘ │
│                                     ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      4. 知识库管理层                                   │ │
│  │                                                                        │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────┐ │ │
│  │  │ 文档存储管理器    │  │ 关联关系引擎      │  │ Git 同步管理器      │ │ │
│  │  │                  │  │                  │  │                     │ │ │
│  │  │ knowledge/       │  │ 文档间引用:       │  │ · auto-commit      │ │ │
│  │  │ ├── features/    │  │ · 知识库→知识库   │  │   知识库变更        │ │ │
│  │  │ │   └── {name}/  │  │ · 知识库→源码     │  │ · 冲突检测         │ │ │
│  │  │ │       └── kn-  │  │ · 双向链接       │  │ · 团队合并策略     │ │ │
│  │  │ │       owledge. │  │ · 关系图谱       │  │                     │ │ │
│  │  │ │       md       │  │                  │  │                     │ │ │
│  │  │ └── project-     │  │                  │  │                     │ │ │
│  │  │     overview/    │  │                  │  │                     │ │ │
│  │  │     ├── 01-概览  │  │                  │  │                     │ │ │
│  │  │     ├── 02-架构  │  │                  │  │                     │ │ │
│  │  │     ├── 03-模块  │  │                  │  │                     │ │ │
│  │  │     ├── 04-规范  │  │                  │  │                     │ │ │
│  │  │     ├── 05-测试  │  │                  │  │                     │ │ │
│  │  │     └── 06-变更  │  │                  │  │                     │ │ │
│  │  └──────────────────┘  └──────────────────┘  └─────────────────────┘ │ │
│  └──────────────────────────────────┬────────────────────────────────────┘ │
│                                     ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      5. Worker 服务（后台守护进程）                     │ │
│  │                                                                        │ │
│  │  端口: 38888                                                           │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │ HTTP Server (Express.js)                                         │ │ │
│  │  │                                                                  │ │ │
│  │  │ /api/projects          → 项目列表                                │ │ │
│  │  │ /api/projects/:name    → 项目详情                                │ │ │
│  │  │ /api/projects/:name/tree      → 文件树                          │ │ │
│  │  │ /api/projects/:name/file      → 文档内容                        │ │ │
│  │  │ /api/projects/:name/source    → 源码内容（带行号）               │ │ │
│  │  │ /api/projects/:name/search    → 搜索                            │ │ │
│  │  │ /api/projects/:name/relations → 关联图谱                        │ │ │
│  │  │ /api/projects/:name/analyze   → 手动触发分析                    │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │ SQLite 数据库                                                    │ │ │
│  │  │ · documents: 文档元信息索引                                       │ │ │
│  │  │ · relations: 文档关联关系                                        │ │ │
│  │  │ · analysis_log: 分析记录                                         │ │ │
│  │  │ · link_index: 链接索引（加速跳转）                                │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                        │ │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │ │
│  │  │ 任务队列                                                          │ │ │
│  │  │ · 串行执行分析任务，避免并发冲突                                   │ │ │
│  │  │ · 去重：同一 commit 不重复分析                                    │ │ │
│  │  │ · 持久化：重启后恢复未完成任务                                    │ │ │
│  │  └──────────────────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────┬────────────────────────────────────┘ │
│                                     ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      6. Web Dashboard                                 │ │
│  │                                                                        │ │
│  │  访问: http://localhost:38888                                          │ │
│  │                                                                        │ │
│  │  ┌────────────┬──────────────────────────────┬─────────────────────┐ │ │
│  │  │            │                              │                     │ │ │
│  │  │  项目列表  │                              │     标题目录        │ │ │
│  │  │  + 文件树  │      Markdown 内容区          │                     │ │ │
│  │  │            │                              │     · 自动生成      │ │ │
│  │  │  · 项目    │      · GitHub 风格渲染        │     · 滚动同步      │ │ │
│  │  │    切换    │      · 代码高亮               │     · 点击跳转      │ │ │
│  │  │  · 目录    │      · 文档间点击跳转         │                     │ │ │
│  │  │    展开    │      · 源码文件点击预览       │                     │ │ │
│  │  │  · 文件    │      · 表格/任务列表          │                     │ │ │
│  │  │    高亮    │      · 图片渲染               │                     │ │ │
│  │  │            │                              │                     │ │ │
│  │  └────────────┴──────────────────────────────┴─────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流图

```
                    ┌──────────────┐
                    │  开发者 git   │
                    │  commit      │
                    └──────┬───────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │   Git Commit Detector   │
              │   (三级检测策略)         │
              └────────────┬────────────┘
                           │ CommitEvent
                           ▼
              ┌─────────────────────────┐
              │   Analysis Task Queue   │
              │   (串行队列，去重)      │
              └────────────┬────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │   Diff Collector        │
              │   · git diff            │
              │   · 变更文件列表        │
              └────────────┬────────────┘
                           │ DiffData
                           ▼
              ┌─────────────────────────┐
              │   Context Builder       │
              │   · 加载已有知识库      │
              │   · 加载项目结构        │
              │   · 加载关联文档上下文  │
              └────────────┬────────────┘
                           │ AnalysisRequest
                           ▼
              ┌─────────────────────────┐
              │   AI Provider           │
              │   (复用 Claude Code 模型)│
              └────────────┬────────────┘
                           │ AI Response (JSON)
                           ▼
              ┌─────────────────────────┐
              │   Document Generator    │
              │   · 解析 AI 输出        │
              │   · 应用 Markdown 模板  │
              │   · 建立文档链接        │
              │   · 建立源码链接        │
              └────────────┬────────────┘
                           │ AnalysisResult
                           ▼
              ┌─────────────────────────┐
              │   Knowledge Base        │
              │   Manager               │
              │   · 写入/更新文档       │
              │   · 更新关联关系        │
              │   · 更新数据库索引      │
              │   · Git 同步            │
              └────────────┬────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
    ┌─────────────────┐      ┌─────────────────┐
    │  knowledge/     │      │  SQLite DB      │
    │  文件系统       │      │  (索引+关联)    │
    └────────┬────────┘      └────────┬────────┘
             │                        │
             └────────────┬───────────┘
                          │
                          ▼
              ┌─────────────────────────┐
              │   Web Dashboard         │
              │   · 文档浏览            │
              │   · 文档跳转            │
              │   · 源码预览            │
              └─────────────────────────┘
```

---

## 三、Git Commit 自动检测（零配置）

### 3.1 检测架构

```
┌─────────────────────────────────────────────────────────────┐
│                 CommitDetectorManager                         │
│                                                               │
│  职责: 管理检测策略的启动/停止/降级                           │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  detect(repoPath): Observable<CommitEvent>           │    │
│  │                                                      │    │
│  │  tryStrategyA() → 失败 → tryStrategyB() → 失败       │    │
│  │                                    → tryStrategyC()  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  策略A: PostCommitHookDetector                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 实现方式: 在 .git/hooks/post-commit 写入 hook 脚本   │    │
│  │ 触发方式: Git 原生 post-commit hook                 │    │
│  │ 延迟: 实时 (毫秒级)                                  │    │
│  │ 可靠性: ⭐⭐⭐⭐⭐ (最高)                                │    │
│  │                                                      │    │
│  │ Hook 脚本内容:                                        │    │
│  │ #!/bin/sh                                            │    │
│  │ curl -X POST http://localhost:38888/_internal/hook \ │    │
│  │   -H "Content-Type: application/json" \              │    │
│  │   -d "{\"repo\":\"$(pwd)\",\"hash\":\"$(git rev-pa…│    │
│  │                                                      │    │
│  │ 安装时机: SessionStart 时自动检测并安装              │    │
│  │ 卸载时机: SessionEnd 时自动清理                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  策略B: DotGitWatcher                                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 实现方式: fs.watch(.git/refs/heads/)                 │    │
│  │ 触发方式: 检测 HEAD 文件变化                        │    │
│  │ 延迟: 1-2秒                                          │    │
│  │ 可靠性: ⭐⭐⭐⭐ (高)                                    │    │
│  │                                                      │    │
│  │ 降级条件:                                             │    │
│  │ · Hook 安装失败 (权限不足)                           │    │
│  │ · .git/hooks/ 目录不存在                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  策略C: ReflogPoller                                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 实现方式: setInterval(5000) + git reflog -1         │    │
│  │ 触发方式: 定时轮询，比较 lastKnownHash              │    │
│  │ 延迟: 最多5秒                                        │    │
│  │ 可靠性: ⭐⭐⭐ (中，兜底)                               │    │
│  │                                                      │    │
│  │ 降级条件:                                             │    │
│  │ · fs.watch 不可用 (某些网络文件系统)                 │    │
│  │ · 文件监听无响应                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 CommitEvent 数据结构

```typescript
interface CommitEvent {
  /** 完整的 commit hash */
  commitHash: string;

  /** commit message */
  message: string;

  /** 提交者 */
  author: string;

  /** 提交时间 */
  timestamp: Date;

  /** 变更的文件列表 */
  filesChanged: FileChange[];

  /** 完整的 git diff 内容 */
  diff: string;

  /** 仓库绝对路径 */
  repoPath: string;

  /** 仓库名称（从路径提取） */
  repoName: string;

  /** 分支名 */
  branch: string;
}

interface FileChange {
  /** 文件路径 */
  path: string;

  /** 变更类型 */
  type: 'added' | 'modified' | 'deleted' | 'renamed';

  /** 旧路径（重命名时） */
  oldPath?: string;

  /** 变更行数 */
  additions: number;
  deletions: number;
}
```

### 3.3 去重机制

```
┌─────────────────────────────────────────────────────┐
│              去重策略                                 │
├─────────────────────────────────────────────────────┤
│                                                       │
│  1. Commit Hash 去重                                 │
│     - 维护已分析 commit hash 集合                    │
│     - 同一 hash 不重复分析                           │
│                                                       │
│  2. 短暂去重窗口 (5秒)                                │
│     - Hook + 文件监听可能同时触发                    │
│     - 同一 hash 在5秒内只处理一次                    │
│                                                       │
│  3. 持久化已分析记录                                  │
│     - SQLite analysis_log 表存储                     │
│     - Worker 重启后不重复分析                        │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## 四、AI 分析引擎

### 4.1 分析流水线

```
┌─────────────────────────────────────────────────────────────┐
│                    Analysis Pipeline                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  输入: CommitEvent                                            │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 阶段1: Diff Collector                                │    │
│  │                                                      │    │
│  │ 输入: CommitEvent.filesChanged + diff                │    │
│  │ 输出: StructuredDiff {                               │    │
│  │   files: FileDiff[],        // 按文件拆分的 diff     │    │
│  │   modules: ModuleChange[],  // 按模块归类的变更      │    │
│  │   stats: ChangeStats,       // 变更统计             │    │
│  │   scope: 'feature'|'architecture'|'bugfix'|'refactor'│   │
│  │        |'config'|'dependency'                        │    │
│  │ }                                                    │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     ▼                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 阶段2: Context Builder                               │    │
│  │                                                      │    │
│  │ 输入: StructuredDiff + repoPath                      │    │
│  │ 操作:                                                │    │
│  │ 1. 加载已有知识库文档列表及摘要                      │    │
│  │ 2. 加载项目结构 (目录树)                             │    │
│  │ 3. 识别变更影响的已有文档                            │    │
│  │ 4. 查找相关源码上下文                                │    │
│  │ 5. 加载关联文档引用                                  │    │
│  │                                                      │    │
│  │ 输出: AnalysisRequest {                              │    │
│  │   commit: CommitEvent,                               │    │
│  │   structuredDiff: StructuredDiff,                    │    │
│  │   existingDocs: ExistingDoc[],    // 可能受影响的    │    │
│  │   projectTree: ProjectTree,                          │    │
│  │   relatedCode: CodeContext[],     // 关联源码片段    │    │
│  │   analysisMode: 'incremental' | 'full'               │    │
│  │ }                                                    │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     ▼                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 阶段3: 智能分析模式决策                              │    │
│  │                                                      │    │
│  │ 增量分析 (默认):                                     │    │
│  │ · 仅分析本次变更内容                                │    │
│  │ · 更新受影响的已有文档                              │    │
│  │                                                      │    │
│  │ 自动升级为全量分析 (满足任一):                       │    │
│  │ · 新增文件 > 10 个                                  │    │
│  │ · package.json / requirements.txt 变更              │    │
│  │ · Commit message 含 [major][breaking][architecture] │    │
│  │ · 距上次全量分析 > 30 天                            │    │
│  │ · 新增顶级目录（新模块）                            │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     ▼                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 阶段4: AI 调用                                       │    │
│  │                                                      │    │
│  │ 模型: 复用 Claude Code 当前配置                      │    │
│  │ 重试: 3次，指数退避 (1s, 2s, 4s)                    │    │
│  │ Token 控制:                                          │    │
│  │ · 增量分析: diff 截断至 8000 tokens                 │    │
│  │ · 全量分析: 分批次处理                              │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     ▼                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 阶段5: Document Generator                            │    │
│  │                                                      │    │
│  │ 输入: AI 响应 (JSON)                                 │    │
│  │ 输出: AnalysisResult {                               │    │
│  │   updates: DocumentUpdate[],   // 更新已有文档       │    │
│  │   newDocs: DocumentCreate[],   // 新建文档           │    │
│  │   relations: RelationUpdate[], // 关联关系变更       │    │
│  │   summary: string              // 人类可读摘要       │    │
│  │ }                                                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 AI Prompt 设计

#### 增量分析 Prompt

```markdown
你是一个资深技术文档编写专家。分析以下 Git 提交，更新项目知识库。

## 提交信息
- **Commit**: {hash}
- **Message**: {message}
- **作者**: {author}
- **时间**: {timestamp}
- **分支**: {branch}

## 代码变更
```diff
{diff_content}
```

## 已有知识库文档
{existing_docs_context}

## 项目结构
{project_tree}

## 分析任务

### 1. 变更分类
识别变更类型（可多选）：
- `feature` - 新功能
- `architecture` - 架构变更
- `bugfix` - Bug 修复
- `refactor` - 重构
- `config` - 配置变更
- `dependency` - 依赖更新
- `test` - 测试相关
- `docs` - 文档变更

### 2. 文档更新判断
检查已有文档，判断是否需要更新：
- 修改了已有功能的代码 → 更新对应 features/ 文档
- 改变了模块关系 → 更新架构文档
- 修改了数据模型 → 更新数据模型文档

### 3. 新文档创建
是否需要创建新的知识库文档：
- 新增功能 → features/{feature-name}/knowledge.md
- 重大变更 → project-overview/06-变更记录/{date}-{description}.md

### 4. 关联关系建立
识别并建立文档间、文档与源码间的链接：
- 功能间依赖 → 知识库文档间链接
- 引用的关键代码 → 源码链接（含行号）

## 输出格式
```json
{
  "changeType": ["feature", "refactor"],
  "summary": "一句话中文摘要",
  "updates": [
    {
      "path": "features/dual-camera-calibration/knowledge.md",
      "reason": "修改了 calculate_model_point 函数，需要更新算法说明",
      "sections": [
        {
          "heading": "## 3.3 核心算法",
          "action": "replace",
          "newContent": "更新后的 Markdown 内容..."
        }
      ],
      "relationsToAdd": [
        {
          "type": "source_reference",
          "path": "caldialog.cpp",
          "lines": "3982-4018",
          "description": "仿射变换计算实现"
        }
      ]
    }
  ],
  "newDocs": [
    {
      "path": "project-overview/06-变更记录/2026-04-24-optimize-calibration.md",
      "content": "# 优化标定算法\n\n..."
    }
  ],
  "relationsToUpdate": [
    {
      "from": "features/dual-camera-calibration/knowledge.md",
      "to": "features/motion-dynamic-calibration/knowledge.md",
      "type": "depends_on",
      "description": "标定依赖运动控制校准结果"
    }
  ]
}
```

## 文档模板参考

### Feature 文档模板
```markdown
# {功能名称}

> 创建日期: {date}
> 最后更新: {date}
> 状态: Complete | In Progress
> 相关文件: {file_list}

## 1. 功能概述
### 1.1 物理含义
### 1.2 核心目标
### 1.3 使用场景

## 2. 执行流程
### 2.1 整体流程
### 2.2 详细步骤

## 3. 代码分析
### 3.1 相关文件
### 3.2 关键函数
### 3.3 核心算法
### 3.4 数据结构

## 4. 参考资料
### 项目内参考
- [{文件名}:{行号范围}]({相对路径}#L{行号})
### 相关知识库
- [{文档标题}]({相对路径})
```

请严格按照 JSON 格式输出，content 字段使用标准 Markdown 语法。
```

### 4.3 AI Provider 适配层

```typescript
// src/analyzer/aiProvider.ts

interface AIProvider {
  /** 发送分析请求 */
  analyze(request: AnalysisRequest): Promise<AnalysisResult>;
}

class ClaudeCodeAIProvider implements AIProvider {
  /**
   * 直接复用 Claude Code 的模型配置
   * 
   * 实现方式:
   * 1. 读取 Claude Code 的环境变量/配置文件
   * 2. 使用相同的 API endpoint 和认证信息
   * 3. 用户用什么模型（Claude/OpenRouter/Gemini），
   *    分析就用什么模型
   */
  
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    const prompt = buildPrompt(request);
    
    // 重试逻辑
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await this.callAI(prompt);
        return this.parseResponse(response);
      } catch (error) {
        if (attempt === 3) throw error;
        await this.sleep(Math.pow(2, attempt) * 1000); // 指数退避
      }
    }
  }
  
  private async callAI(prompt: string): Promise<string> {
    // 复用 Claude Code 的 API 调用机制
    // 通过 Claude Code SDK 或环境变量获取当前配置
  }
}
```

---

## 五、知识库文档系统

### 5.1 目录结构

```
{项目仓库}/
├── src/                          # 项目源码
├── docs/                         # 项目文档
├── knowledge/                    # 🆕 AI 生成的知识库
│   ├── README.md                 # 知识库索引（自动生成）
│   ├── .knowledge-meta.json     # 知识库元信息
│   │
│   ├── features/                 # 功能知识库
│   │   ├── dual-camera-calibration/
│   │   │   └── knowledge.md      # 功能文档
│   │   ├── defect-detection/
│   │   │   └── knowledge.md
│   │   └── motion-control/
│   │       └── knowledge.md
│   │
│   └── project-overview/         # 项目概览
│       ├── README.md             # 项目索引
│       ├── 01-项目概览/
│       │   ├── 项目介绍.md
│       │   └── 开发环境配置.md
│       ├── 02-架构设计/
│       │   ├── 系统架构.md
│       │   ├── 模块依赖关系.md
│       │   └── 数据模型.md
│       ├── 03-模块详解/
│       │   ├── 绘图模块.md
│       │   └── 对话框模块.md
│       ├── 04-开发规范/
│       │   └── 编码规范.md
│       ├── 05-测试/
│       │   └── 测试策略.md
│       └── 06-变更记录/
│           ├── 2026-04-20-initial.md
│           └── 2026-04-24-refactor.md
│
├── .gitignore                    # 建议: 不忽略 knowledge/
└── package.json
```

### 5.2 .knowledge-meta.json 结构

```json
{
  "version": "1.0",
  "project": "MaskInspect",
  "createdAt": "2026-04-20T10:00:00Z",
  "lastFullAnalysis": "2026-04-24T14:30:00Z",
  "lastAnalysisCommit": "a1b2c3d4e5f6",
  "analysisCount": 47,
  "documents": {
    "features/dual-camera-calibration/knowledge.md": {
      "title": "双相机锚点标定",
      "category": "feature",
      "createdAt": "2026-04-20T10:00:00Z",
      "updatedAt": "2026-04-24T14:30:00Z",
      "lastRelatedCommit": "a1b2c3d4e5f6",
      "relations": [
        {
          "target": "features/motion-dynamic-calibration/knowledge.md",
          "type": "depends_on"
        }
      ]
    }
  }
}
```

### 5.3 存储管理器接口

```typescript
interface StorageManager {
  /** 获取项目知识库结构 */
  getProjectStructure(repoPath: string): Promise<ProjectStructure>;

  /** 读取文档 */
  readDocument(repoPath: string, relativePath: string): Promise<string>;

  /** 写入/更新文档 */
  writeDocument(repoPath: string, relativePath: string, content: string): Promise<void>;

  /** 创建新文档 */
  createDocument(repoPath: string, relativePath: string, content: string, meta: DocumentMeta): Promise<void>;

  /** 删除文档 */
  deleteDocument(repoPath: string, relativePath: string): Promise<void>;

  /** 读取源码文件（指定行范围） */
  readSourceCode(repoPath: string, relativePath: string, startLine?: number, endLine?: number): Promise<SourceCode>;

  /** 搜索项目内的文档和源码 */
  search(repoPath: string, query: string): Promise<SearchResult[]>;
}
```

---

## 六、文档跳转系统（核心创新）

### 6.1 跳转类型全景

```
┌───────────────────────────────────────────────────────────────┐
│                    文档跳转系统 - 链接类型                       │
├───────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户在 Web Dashboard 点击文档中的链接:                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  类型1: 知识库文档间跳转                                  │  │
│  │                                                          │  │
│  │  Markdown: [运动控制校准](../motion-dynamic-calibration/knowledge.md)
│  │                                                          │  │
│  │  行为:                                                    │  │
│  │  1. 解析相对路径 → 确定目标文档                           │  │
│  │  2. 调用 GET /api/projects/:name/file?path=xxx.md        │  │
│  │  3. 更新内容区 → 渲染新文档                              │  │
│  │  4. 更新文件树高亮                                       │  │
│  │  5. 更新面包屑: 知识库 > MaskInspect > features > xxx    │  │
│  │  6. 更新标题目录                                         │  │
│  │  7. 浏览器历史记录 pushState（支持前进/后退）            │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  类型2: 知识库 → 源代码跳转                               │  │
│  │                                                          │  │
│  │  Markdown: [caldialog.cpp:3792-3923](../../../MaskInspect/caldialog.cpp#L3792)
│  │                                                          │  │
│  │  行为:                                                    │  │
│  │  1. 解析路径 + 行号范围 + 项目名                         │  │
│  │  2. 调用 GET /api/projects/:name/source?                 │  │
│  │        path=caldialog.cpp&start=3792&end=3923            │  │
│  │  3. 弹出代码查看面板（Split View 或 Modal）              │  │
│  │  4. 高亮指定行范围                                       │  │
│  │  5. 语法高亮（根据文件扩展名）                           │  │
│  │  6. 提供 "查看完整文件" 链接                             │  │
│  │                                                          │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  类型3: 文档内锚点跳转                                    │  │
│  │                                                          │  │
│  │  Markdown: [跳转到算法](#核心算法)                        │  │
│  │                                                          │  │
│  │  行为: 平滑滚动到目标标题位置                            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  类型4: 外部链接                                          │  │
│  │                                                          │  │
│  │  Markdown: [参考文档](https://example.com/doc)            │  │
│  │                                                          │  │
│  │  行为: 新标签页打开                                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└───────────────────────────────────────────────────────────────┘
```

### 6.2 链接解析器（Link Resolver）

```typescript
// web/src/composables/useLinkResolver.ts

interface ResolvedLink {
  type: 'knowledge' | 'source' | 'anchor' | 'external';
  
  // 知识库跳转
  targetDocPath?: string;
  
  // 源码跳转
  projectName?: string;
  sourceFilePath?: string;
  startLine?: number;
  endLine?: number;
  
  // 锚点跳转
  anchorId?: string;
  
  // 外部链接
  externalUrl?: string;
}

class LinkResolver {
  /**
   * 解析 Markdown 链接
   * 
   * 输入: [caldialog.cpp:3792-3923](../../../MaskInspect/caldialog.cpp#L3792)
   * 
   * 解析步骤:
   * 1. 提取链接文本（用于判断是否有行号信息）
   * 2. 提取链接目标路径
   * 3. 根据文件扩展名判断类型
   * 4. 解析行号范围
   */
  resolve(href: string, text: string, currentDocPath: string): ResolvedLink {
    // 外部链接
    if (href.startsWith('http://') || href.startsWith('https://')) {
      return { type: 'external', externalUrl: href };
    }
    
    // 锚点链接
    if (href.startsWith('#')) {
      return { type: 'anchor', anchorId: href.slice(1) };
    }
    
    // 解析路径和锚点
    const [path, anchor] = href.split('#');
    const ext = path.split('.').pop()?.toLowerCase();
    
    // 源码文件
    if (['cpp', 'h', 'hpp', 'py', 'js', 'ts', 'java', 'go', 'rs'].includes(ext || '')) {
      return this.resolveSourceLink(path, anchor, text);
    }
    
    // 知识库文档
    if (ext === 'md') {
      return {
        type: 'knowledge',
        targetDocPath: this.resolveRelativePath(path, currentDocPath),
        anchorId: anchor || undefined
      };
    }
    
    // 其他文件（JSON、XML等）→ 源码预览
    return this.resolveSourceLink(path, anchor, text);
  }
  
  /**
   * 解析源码链接
   * 
   * 输入: ../../MaskInspect/caldialog.cpp#L3792
   * 文本: caldialog.cpp:3792-3923
   * 
   * 输出: {
   *   type: 'source',
   *   projectName: 'MaskInspect',
   *   sourceFilePath: 'caldialog.cpp',
   *   startLine: 3792,
   *   endLine: 3923
   * }
   */
  private resolveSourceLink(path: string, anchor: string, text: string): ResolvedLink {
    // 提取项目名（知识库的上上级目录）
    const projectName = this.extractProjectName(path);
    const fileName = path.split('/').pop() || '';
    
    // 从链接文本中提取行号范围
    // 格式: "caldialog.cpp:3792-3923" 或 "#L3792"
    let startLine: number | undefined;
    let endLine: number | undefined;
    
    if (text.includes(':')) {
      const linePart = text.split(':')[1];
      if (linePart.includes('-')) {
        [startLine, endLine] = linePart.split('-').map(Number);
      } else {
        startLine = Number(linePart);
      }
    }
    
    if (!startLine && anchor?.startsWith('L')) {
      startLine = Number(anchor.slice(1));
    }
    
    return {
      type: 'source',
      projectName,
      sourceFilePath: fileName,
      startLine,
      endLine
    };
  }
}
```

### 6.3 源代码查看器组件

```typescript
// web/src/components/viewer/SourceViewer.vue

/**
 * 源代码查看器
 * 
 * 显示模式:
 * - Modal: 弹出对话框，居中显示
 * - SplitView: 左右分屏，文档在左/代码在右
 * - BottomPanel: 上下分屏，文档在上/代码在下
 * 
 * 功能:
 * - 行号显示
 * - 指定行范围高亮
 * - 语法高亮（highlight.js）
 * - 复制代码段
 * - 查看完整文件
 */
```

### 6.4 代码查看器 UI 设计

```
┌──────────────────────────────────────────────────────────────────┐
│  📄 caldialog.cpp                                    [✕ 关闭]   │
│  行 3792 - 3923  |  共 131 行选中  |  MaskInspect 项目            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  3788 │  // 双相机标定 - 像素锚点设置                             │
│  3789 │                                                          │
│  3790 │  /**                                                     │
│  3791 │   * 设置检测相机的像素锚点                                │
│  3792 │   * 用户在检测相机图像上标记物理标记点                    │
│  ────────────────────────────────────────────────────────────    │
│  3793 │  void calDialog::setDetectPixelAnchorPointPushButton()    │
│  3794 │  {                                                       │
│  3795 │      if (m_hwin_4->m_img == judgem_img)                  │
│  3796 │      {                                                   │
│  3797 │          QMessageBox::warning(this, "错误",              │
│  3798 │              "检测相机画面无图像");                       │
│  3799 │          return;                                         │
│  3800 │      }                                                   │
│  ...  │      ...                                                │
│  3921 │      // 在图像上绘制红色十字标记                          │
│  3922 │      drawCrossOnImage(detectXPixel, detectYPixel);       │
│  3923 │  }                                                       │
│  ────────────────────────────────────────────────────────────    │
│  3924 │                                                          │
│  3925 │  void calDialog::setDetectPlcAnchorPointPushButton()      │
│                                                                   │
├──────────────────────────────────────────────────────────────────┤
│  [← 返回文档]    [查看完整文件]    [复制选中代码]    [切换显示模式] │
└──────────────────────────────────────────────────────────────────┘
```

---

## 七、Web Dashboard

### 7.1 技术栈

```
前端技术选型:
├── 框架: Vue 3 + Composition API
├── 构建: Vite 5
├── 路由: Vue Router 4 (支持浏览器前进/后退)
├── 状态: Pinia
├── Markdown: marked + marked-gfm-heading-id
├── 代码高亮: highlight.js
├── CSS: CSS Variables + CSS Grid/Flexbox
├── HTTP: fetch API
└── 无 UI 框架依赖（手写 CSS，保持轻量）
```

### 7.2 路由设计

```typescript
// web/src/router/index.ts

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomePage.vue'),
    meta: { title: '知识库首页' }
  },
  {
    path: '/project/:projectName',
    component: () => import('@/views/ProjectLayout.vue'),
    children: [
      {
        path: '',
        name: 'project-overview',
        component: () => import('@/views/ProjectOverview.vue')
      },
      {
        path: 'doc/:path(.*)',
        name: 'document',
        component: () => import('@/views/DocumentView.vue'),
        props: true
      }
    ]
  }
];
```

### 7.3 组件树

```
App.vue
├── AppHeader.vue                    # 顶部导航
│   ├── Logo
│   ├── SearchBar.vue                # 搜索栏
│   └── ProjectSwitcher.vue          # 项目下拉切换
│
├── HomePage.vue                     # 首页
│   └── ProjectList.vue
│       └── ProjectCard.vue (×N)     # 项目卡片
│
├── ProjectLayout.vue                # 项目布局（三栏）
│   ├── AppSidebar.vue               # 左侧: 文件树
│   │   └── FileTree.vue
│   │       └── FileNode.vue (×N)    # 树节点（递归）
│   │
│   ├── <router-view>                # 中间: 内容区
│   │   ├── DocumentView.vue         # 文档视图
│   │   │   ├── Breadcrumb.vue       # 面包屑导航
│   │   │   ├── MarkdownViewer.vue   # Markdown 渲染
│   │   │   │   ├── CodeBlock.vue    # 代码块
│   │   │   │   ├── TableRenderer.vue
│   │   │   │   └── LinkHandler.vue  # 链接处理（跳转核心）
│   │   │   └── SourceViewer.vue     # 源码弹出面板
│   │   │
│   │   └── ProjectOverview.vue      # 项目概览页
│   │
│   └── AppToc.vue                   # 右侧: 标题目录
│       └── TocItem.vue (×N)
│
└── BackToTop.vue                    # 返回顶部
```

### 7.4 响应式布局策略

```
┌─────────────────────────────────────────────────────┐
│              响应式断点设计                            │
├─────────────────────────────────────────────────────┤
│                                                       │
│  > 1400px: 三栏完整布局                                │
│  ┌──────────┬──────────────────────┬──────────┐     │
│  │ File Tree│     Content          │    TOC   │     │
│  │  260px   │     flex: 1          │   220px  │     │
│  └──────────┴──────────────────────┴──────────┘     │
│                                                       │
│  1200px - 1400px: TOC 缩小                            │
│  ┌──────────┬────────────────────┬──────────┐       │
│  │ File Tree│     Content        │  TOC(sm) │       │
│  │  240px   │     flex: 1        │  180px   │       │
│  └──────────┴────────────────────┴──────────┘       │
│                                                       │
│  768px - 1200px: TOC 隐藏，File Tree 可折叠            │
│  ┌──────────┬──────────────────────────────┐         │
│  │ File Tree│         Content              │         │
│  │ (可折叠) │                              │         │
│  │  240px   │         flex: 1              │         │
│  └──────────┴──────────────────────────────┘         │
│                                                       │
│  < 768px: 单栏 + 抽屉式 File Tree                     │
│  ┌─────────────────────────────────────────┐         │
│  │  ☰ 菜单    Content                      │         │
│  │            (全宽)                        │         │
│  │                                         │         │
│  │  ← File Tree (drawer 滑入)              │         │
│  └─────────────────────────────────────────┘         │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 7.5 字体与配色方案

```css
/* GitHub 风格配色 */
:root {
  /* 主色调 */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f6f8fa;
  --color-bg-tertiary: #f0f2f5;
  
  /* 文字色 */
  --color-text-primary: #1f2328;
  --color-text-secondary: #656d76;
  --color-text-link: #0969da;
  
  /* 边框 */
  --color-border: #d0d7de;
  --color-border-light: #e8ecf1;
  
  /* 代码块 */
  --color-code-bg: #f6f8fa;
  --color-code-text: #1f2328;
  
  /* 高亮 */
  --color-highlight: #fff8c5;
  --color-accent: #0969da;
  
  /* 文件图标色 */
  --color-folder: #54aeff;
  --color-md-file: #8250df;
  --color-source-file: #656d76;
  
  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  
  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
}

/* 暗色主题（预留） */
[data-theme="dark"] {
  --color-bg-primary: #0d1117;
  --color-bg-secondary: #161b22;
  --color-bg-tertiary: #21262d;
  --color-text-primary: #c9d1d9;
  --color-text-secondary: #8b949e;
  --color-text-link: #58a6ff;
  --color-border: #30363d;
  --color-code-bg: #161b22;
  --color-code-text: #c9d1d9;
}
```

---

## 八、数据库设计

### 8.1 SQLite 表结构

```sql
-- 数据库位置: ~/.claude-dev-sprite/data.db
-- 或项目本地: {repo}/.claude-dev-sprite.db

-- 1. 项目表
CREATE TABLE projects (
  id          TEXT PRIMARY KEY,        -- 项目路径的 hash
  name        TEXT NOT NULL,           -- 项目名称
  path        TEXT NOT NULL UNIQUE,    -- 项目绝对路径
  knowledge_path TEXT NOT NULL,        -- knowledge/ 目录路径
  last_analysis_commit TEXT,           -- 最后分析的 commit hash
  last_full_analysis TEXT,             -- 最后全量分析时间
  analysis_count INTEGER DEFAULT 0,   -- 总分析次数
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 2. 文档元信息表
CREATE TABLE documents (
  id          TEXT PRIMARY KEY,        -- 项目路径 + 文档路径的 hash
  project_id  TEXT NOT NULL,
  path        TEXT NOT NULL,           -- 相对于 knowledge/ 的路径
  title       TEXT NOT NULL,           -- 文档标题
  category    TEXT NOT NULL,           -- feature | overview | architecture | module | standard | test | changelog
  commit_hash TEXT,                    -- 关联的 commit hash
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  UNIQUE(project_id, path)
);

-- 3. 关联关系表
CREATE TABLE relations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  TEXT NOT NULL,
  source_doc_id TEXT NOT NULL,         -- 源文档 ID
  target_doc_id TEXT NOT NULL,         -- 目标文档 ID
  relation_type TEXT NOT NULL,         -- depends_on | related_to | implements | part_of | source_reference
  target_is_source BOOLEAN DEFAULT 0, -- 目标是否为源码文件
  source_file_path TEXT,               -- 源码文件路径（当 target_is_source=1 时）
  start_line  INTEGER,                 -- 源码行号范围起始
  end_line    INTEGER,                 -- 源码行号范围结束
  description TEXT,
  created_at  TEXT NOT NULL,
  FOREIGN KEY (source_doc_id) REFERENCES documents(id),
  FOREIGN KEY (target_doc_id) REFERENCES documents(id)
);

-- 4. 分析日志表
CREATE TABLE analysis_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  commit_message TEXT,
  analysis_mode TEXT NOT NULL,         -- incremental | full
  files_changed INTEGER,
  model_used TEXT,                     -- 使用的 AI 模型
  tokens_used INTEGER,
  duration_ms INTEGER,                 -- 分析耗时
  status TEXT NOT NULL,                -- success | failed
  error_message TEXT,
  created_at  TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 5. 链接索引表（加速跳转解析）
CREATE TABLE link_index (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  TEXT NOT NULL,
  source_doc_id TEXT NOT NULL,
  link_url    TEXT NOT NULL,           -- Markdown 中的链接 URL
  link_text   TEXT,                    -- 链接显示文本
  link_type   TEXT NOT NULL,           -- knowledge | source | anchor | external
  resolved_path TEXT,                  -- 解析后的目标路径
  is_valid    BOOLEAN DEFAULT 1,       -- 链接是否有效
  last_checked TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 索引
CREATE INDEX idx_documents_project ON documents(project_id);
CREATE INDEX idx_relations_source ON relations(source_doc_id);
CREATE INDEX idx_relations_target ON relations(target_doc_id);
CREATE INDEX idx_analysis_log_project ON analysis_log(project_id, commit_hash);
CREATE INDEX idx_link_index_doc ON link_index(source_doc_id);
```

### 8.2 数据库管理器接口

```typescript
// src/worker/db.ts

interface DatabaseManager {
  /** 初始化数据库 */
  init(): Promise<void>;

  /** 项目 CRUD */
  getProject(path: string): Promise<Project | null>;
  getProjects(): Promise<Project[]>;
  upsertProject(project: Project): Promise<void>;

  /** 文档 CRUD */
  getDocument(projectId: string, path: string): Promise<Document | null>;
  getDocuments(projectId: string): Promise<Document[]>;
  upsertDocument(doc: Document): Promise<void>;
  deleteDocument(projectId: string, path: string): Promise<void>;

  /** 关联关系 */
  getRelations(projectId: string, docId?: string): Promise<Relation[]>;
  addRelation(relation: Omit<Relation, 'id'>): Promise<void>;
  deleteRelationsByDoc(docId: string): Promise<void>;

  /** 分析日志 */
  addAnalysisLog(log: AnalysisLog): Promise<void>;
  getAnalysisLogs(projectId: string, limit?: number): Promise<AnalysisLog[]>;
  hasAnalyzedCommit(projectId: string, commitHash: string): Promise<boolean>;

  /** 链接索引 */
  updateLinkIndex(docId: string, links: LinkEntry[]): Promise<void>;
  getLinkIndex(docId: string): Promise<LinkEntry[]>;
  findLinksToDoc(projectId: string, targetPath: string): Promise<LinkEntry[]>;

  /** 清理 */
  vacuum(): Promise<void>;
}
```

---

## 九、API 接口设计

### 9.1 完整 API 列表

```
Base URL: http://localhost:38888

┌──────────────────────────────────────────────────────────────────┐
│                          API 接口列表                              │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  📊 项目                                                           │
│  GET    /api/projects                       获取所有项目列表       │
│  GET    /api/projects/:name                 获取项目详情          │
│  POST   /api/projects/discover              扫描发现所有项目      │
│                                                                    │
│  📁 文件树                                                         │
│  GET    /api/projects/:name/tree            获取文件树结构        │
│  GET    /api/projects/:name/tree?root=features  获取指定子树     │
│                                                                    │
│  📄 文档                                                           │
│  GET    /api/projects/:name/file?path=xxx   获取文档内容          │
│  GET    /api/projects/:name/file/raw?path=xxx  获取原始 Markdown │
│                                                                    │
│  💻 源码                                                           │
│  GET    /api/projects/:name/source?         获取源码内容          │
│           path=xxx&start=100&end=200        支持行号范围          │
│                                                                    │
│  🔗 关联                                                           │
│  GET    /api/projects/:name/relations       获取所有关联关系      │
│  GET    /api/projects/:name/relations/     获取指定文档的关联    │
│           ?doc=features/xxx/knowledge.md                          │
│  GET    /api/projects/:name/relations/     获取文档关系图谱      │
│           graph                                 (节点+边数据)     │
│                                                                    │
│  🔍 搜索                                                           │
│  GET    /api/projects/:name/search?q=xxx   搜索知识库            │
│  GET    /api/search?q=xxx                   跨项目搜索            │
│                                                                    │
│  🤖 分析                                                           │
│  POST   /api/projects/:name/analyze         手动触发分析          │
│           body: { commitHash?: string, mode?: 'incremental'|'full' }
│  GET    /api/projects/:name/analysis-log    获取分析历史          │
│  GET    /api/projects/:name/analysis-status 获取当前分析状态     │
│                                                                    │
│  ⚙️ 系统                                                           │
│  GET    /api/health                         健康检查              │
│  GET    /api/config                         获取当前配置          │
│  PUT    /api/config                         更新配置              │
│                                                                    │
│  🔌 内部（Git Hook 使用）                                           │
│  POST   /_internal/hook                     Git Hook 通知         │
│           body: { repo: string, hash: string }                     │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 9.2 关键 API 响应格式

```typescript
// GET /api/projects
interface ProjectsResponse {
  projects: {
    name: string;
    path: string;
    description: string;
    lastUpdated: string;
    documentCount: number;
    analysisCount: number;
    color: string; // 项目标识色
  }[];
}

// GET /api/projects/:name/tree
interface FileTreeResponse {
  projectName: string;
  tree: TreeNode[];
}

interface TreeNode {
  name: string;
  type: 'directory' | 'file';
  path: string;
  children?: TreeNode[];
  meta?: {
    title?: string;        // 从文档提取的标题
    category?: string;     // 文档分类
    lastUpdated?: string;
  };
}

// GET /api/projects/:name/file?path=xxx
interface DocumentResponse {
  path: string;
  title: string;
  content: string;         // Markdown 原始内容
  html?: string;           // 预渲染的 HTML（可选）
  meta: {
    category: string;
    createdAt: string;
    updatedAt: string;
    lastCommit?: string;
  };
  relations: {
    outgoing: Relation[];  // 本文档引用的
    incoming: Relation[];  // 引用本文档的
  };
  toc: TocItem[];          // 目录结构
  links: LinkEntry[];      // 文档中的链接列表
}

// GET /api/projects/:name/source?path=xxx&start=100&end=200
interface SourceResponse {
  path: string;
  language: string;        // 语言标识（cpp, python, etc）
  totalLines: number;
  content: string;         // 指定行范围的源码
  startLine: number;
  endLine: number;
  highlighted: string;     // HTML 高亮后的代码
}

// GET /api/projects/:name/search?q=xxx
interface SearchResponse {
  query: string;
  results: {
    type: 'document' | 'source';
    path: string;
    title: string;
    snippet: string;       // 关键词上下文片段
    matches: number;       // 匹配次数
  }[];
}
```

---

## 十、项目目录结构

```
Claude-DevSprite/                          # 项目根目录
│
├── package.json                           # npm 包配置
├── tsconfig.json                          # TypeScript 配置
├── README.md                              # 项目说明
├── LICENSE                                # MIT License
│
├── src/                                   # 🔧 核心后端源码 (TypeScript)
│   │
│   ├── index.ts                           # Skill 入口
│   │   └── 注册生命周期钩子到 Claude Code
│   │   └── 初始化 Worker 服务
│   │
│   ├── config.ts                          # 配置管理
│   │   └── 端口、路径、分析策略等
│   │
│   ├── hooks/                             # 生命周期钩子
│   │   ├── index.ts                       # 钩子注册中心
│   │   ├── sessionStart.ts                # 启动时: 初始化一切
│   │   ├── userPromptSubmit.ts            # 拦截 /kb 命令
│   │   ├── postToolUse.ts                 # 工具调用后处理
│   │   └── sessionEnd.ts                  # 结束时: 清理 Git Hook
│   │
│   ├── detectors/                         # Git Commit 检测
│   │   ├── index.ts                       # CommitDetectorManager
│   │   ├── detectorFactory.ts             # 检测器工厂 + 降级策略
│   │   ├── postCommitHook.ts              # 策略A: Git Hook
│   │   ├── dotGitWatcher.ts               # 策略B: 文件监听
│   │   ├── reflogPoller.ts                # 策略C: Reflog 轮询
│   │   └── types.ts                       # CommitEvent, Detector 接口
│   │
│   ├── analyzer/                          # AI 分析引擎
│   │   ├── index.ts                       # Analyzer 入口
│   │   ├── pipeline.ts                    # 分析流水线编排
│   │   ├── diffCollector.ts               # Diff 收集器
│   │   ├── contextBuilder.ts              # 上下文构建器
│   │   ├── modeDecider.ts                 # 增量/全量模式决策
│   │   ├── documentGenerator.ts           # 文档生成器
│   │   ├── promptBuilder.ts               # Prompt 构建器
│   │   ├── promptTemplates.ts             # Prompt 模板
│   │   ├── aiProvider.ts                  # AI 调用适配层
│   │   ├── responseParser.ts              # AI 响应解析器
│   │   └── types.ts                       # 分析相关类型
│   │
│   ├── knowledge/                         # 知识库管理
│   │   ├── index.ts                       # KnowledgeBaseManager
│   │   ├── storageManager.ts              # 文件系统操作
│   │   ├── documentWriter.ts              # 文档写入（含模板应用）
│   │   ├── relationEngine.ts              # 关联关系引擎
│   │   ├── linkIndexer.ts                 # 链接索引维护
│   │   ├── gitSyncManager.ts              # Git 同步
│   │   ├── conflictResolver.ts            # 冲突处理
│   │   └── types.ts                       # 知识库类型定义
│   │
│   ├── worker/                            # Worker 后台服务
│   │   ├── index.ts                       # Worker 启动入口
│   │   ├── server.ts                      # Express HTTP 服务器
│   │   │
│   │   ├── routes/                        # API 路由
│   │   │   ├── index.ts                   # 路由注册
│   │   │   ├── projects.ts                # /api/projects
│   │   │   ├── files.ts                   # /api/projects/:name/tree, file, source
│   │   │   ├── relations.ts               # /api/projects/:name/relations
│   │   │   ├── search.ts                  # /api/search
│   │   │   ├── analysis.ts                # /api/projects/:name/analyze
│   │   │   ├── config.ts                  # /api/config
│   │   │   └── internal.ts                # /_internal/hook (Git Hook 回调)
│   │   │
│   │   ├── middleware/                     # 中间件
│   │   │   ├── errorHandler.ts            # 错误处理
│   │   │   ├── logger.ts                  # 请求日志
│   │   │   └── cors.ts                    # CORS 配置
│   │   │
│   │   ├── taskQueue.ts                   # 分析任务队列
│   │   ├── db.ts                          # SQLite 数据库管理
│   │   └── migrations/                    # 数据库迁移
│   │       └── 001_initial.sql
│   │
│   └── utils/                             # 工具函数
│       ├── git.ts                         # Git 操作封装 (simple-git)
│       ├── fs.ts                          # 文件系统操作
│       ├── path.ts                        # 路径处理
│       ├── markdown.ts                    # Markdown 解析工具
│       └── logger.ts                      # 日志工具
│
├── web/                                   # 🎨 Web Dashboard (Vue 3 + Vite)
│   │
│   ├── package.json                       # 前端依赖
│   ├── vite.config.ts                     # Vite 配置
│   ├── tsconfig.json                      # TypeScript 配置
│   ├── index.html                         # 入口 HTML
│   │
│   ├── src/
│   │   ├── main.ts                        # Vue 应用入口
│   │   ├── App.vue                        # 根组件
│   │   │
│   │   ├── router/                        # 路由
│   │   │   └── index.ts
│   │   │
│   │   ├── stores/                        # Pinia 状态管理
│   │   │   ├── projects.ts                # 项目列表状态
│   │   │   ├── knowledge.ts               # 知识库浏览状态
│   │   │   ├── ui.ts                      # UI 状态（侧栏折叠等）
│   │   │   └── search.ts                  # 搜索状态
│   │   │
│   │   ├── api/                           # API 调用层
│   │   │   ├── client.ts                  # HTTP 客户端（fetch 封装）
│   │   │   ├── projects.ts                # 项目 API
│   │   │   ├── files.ts                   # 文件/源码 API
│   │   │   ├── relations.ts               # 关联 API
│   │   │   └── search.ts                  # 搜索 API
│   │   │
│   │   ├── composables/                   # 组合式函数
│   │   │   ├── useProjectList.ts           # 项目列表逻辑
│   │   │   ├── useFileTree.ts              # 文件树逻辑
│   │   │   ├── useDocument.ts              # 文档加载逻辑
│   │   │   ├── useMarkdown.ts              # Markdown 渲染
│   │   │   ├── useLinkResolver.ts          # 🔗 链接解析器（跳转核心）
│   │   │   ├── useSourceViewer.ts          # 源码查看器逻辑
│   │   │   ├── useToc.ts                   # 标题目录逻辑
│   │   │   ├── useSearch.ts                # 搜索逻辑
│   │   │   ├── useBreadcrumb.ts            # 面包屑逻辑
│   │   │   └── useResponsive.ts            # 响应式检测
│   │   │
│   │   ├── views/                         # 页面视图
│   │   │   ├── HomePage.vue                # 首页
│   │   │   ├── ProjectLayout.vue           # 项目布局容器
│   │   │   ├── ProjectOverview.vue         # 项目概览页
│   │   │   └── DocumentView.vue            # 文档查看页
│   │   │
│   │   ├── components/                    # 组件
│   │   │   │
│   │   │   ├── layout/                    # 布局组件
│   │   │   │   ├── AppHeader.vue           # 顶部导航栏
│   │   │   │   ├── AppSidebar.vue          # 左侧侧边栏容器
│   │   │   │   └── AppTocPanel.vue         # 右侧 TOC 面板
│   │   │   │
│   │   │   ├── home/                      # 首页组件
│   │   │   │   ├── ProjectList.vue         # 项目列表
│   │   │   │   └── ProjectCard.vue         # 项目卡片
│   │   │   │
│   │   │   ├── tree/                      # 文件树组件
│   │   │   │   ├── FileTree.vue            # 文件树容器
│   │   │   │   └── FileTreeNode.vue        # 树节点（递归）
│   │   │   │
│   │   │   ├── viewer/                    # 内容查看器组件
│   │   │   │   ├── MarkdownViewer.vue      # Markdown 渲染容器
│   │   │   │   ├── MarkdownContent.vue     # 渲染后的内容
│   │   │   │   ├── CodeBlock.vue           # 代码块（含语言标签+复制）
│   │   │   │   ├── LinkHandler.vue         # 链接处理器
│   │   │   │   ├── SourceViewer.vue        # 源码查看器（弹窗/分屏）
│   │   │   │   └── SourceViewerPanel.vue   # 源码面板内部
│   │   │   │
│   │   │   ├── toc/                       # 目录组件
│   │   │   │   ├── TableOfContents.vue     # 标题目录容器
│   │   │   │   └── TocItem.vue             # 目录项
│   │   │   │
│   │   │   └── common/                    # 通用组件
│   │   │       ├── SearchBar.vue           # 搜索栏
│   │   │       ├── Breadcrumb.vue          # 面包屑
│   │   │       ├── BackToTop.vue           # 返回顶部
│   │   │       ├── LoadingSpinner.vue      # 加载动画
│   │   │       ├── ErrorMessage.vue        # 错误提示
│   │   │       └── EmptyState.vue          # 空状态
│   │   │
│   │   ├── styles/                        # 样式
│   │   │   ├── variables.css               # CSS 变量（主题色等）
│   │   │   ├── reset.css                   # 样式重置
│   │   │   ├── global.css                  # 全局样式
│   │   │   ├── markdown.css                # Markdown 渲染样式
│   │   │   ├── code-theme.css              # 代码高亮主题
│   │   │   └── responsive.css              # 响应式样式
│   │   │
│   │   └── types/                         # 前端类型定义
│   │       ├── index.ts
│   │       ├── project.ts
│   │       ├── document.ts
│   │       └── navigation.ts
│   │
│   └── public/                            # 静态资源
│       ├── favicon.ico
│       └── icons/                          # 文件类型图标
│           ├── folder.svg
│           ├── markdown.svg
│           ├── source.svg
│           └── ...
│
├── skills/                                # Claude Code Skill 配置
│   └── claude-dev-sprite/
│       ├── manifest.json                   # Skill 元信息
│       └── config.json                     # 默认配置
│
├── scripts/                               # 构建/部署脚本
│   ├── build.sh                           # 构建脚本
│   ├── install.sh                         # 安装脚本
│   └── uninstall.sh                       # 卸载脚本
│
├── tests/                                 # 测试
│   ├── unit/                              # 单元测试
│   │   ├── detectors/
│   │   │   ├── reflogPoller.test.ts
│   │   │   └── detectorFactory.test.ts
│   │   ├── analyzer/
│   │   │   ├── diffCollector.test.ts
│   │   │   ├── contextBuilder.test.ts
│   │   │   └── responseParser.test.ts
│   │   ├── knowledge/
│   │   │   ├── storageManager.test.ts
│   │   │   └── relationEngine.test.ts
│   │   └── worker/
│   │       ├── taskQueue.test.ts
│   │       └── db.test.ts
│   ├── integration/                       # 集成测试
│   │   ├── fullPipeline.test.ts
│   │   └── api.test.ts
│   └── fixtures/                          # 测试数据
│       ├── sample-repo/                   # 模拟 Git 仓库
│       │   ├── src/
│       │   ├── knowledge/
│       │   └── .git/
│       └── sample-diffs/                  # 示例 diff 文件
│           ├── feature-addition.diff
│           ├── bugfix.diff
│           └── refactor.diff
│
├── docs/                                  # 项目自身文档
│   ├── architecture.md                    # 本文档
│   ├── api-reference.md                   # API 参考
│   ├── development.md                     # 开发指南
│   └── changelog.md                       # 变更日志
│
└── .gitignore
```

---

## 十一、技术选型与依赖

### 11.1 核心依赖

```json
{
  "//": "=== package.json (后端) ===",

  "dependencies": {
    "express": "^4.18.0",
    "better-sqlite3": "^9.0.0",
    "simple-git": "^3.20.0",
    "marked": "^12.0.0",
    "highlight.js": "^11.9.0",
    "chokidar": "^3.5.0",
    "gray-matter": "^4.0.0"
  },

  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/express": "^4.17.0",
    "@types/better-sqlite3": "^7.6.0",
    "vitest": "^1.0.0",
    "esbuild": "^0.20.0"
  }
}
```

```json
{
  "//": "=== web/package.json (前端) ===",

  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.3.0",
    "pinia": "^2.1.0",
    "marked": "^12.0.0",
    "marked-gfm-heading-id": "^3.1.0",
    "highlight.js": "^11.9.0"
  },

  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.1.0",
    "typescript": "^5.3.0",
    "@types/marked": "^6.0.0"
  }
}
```

### 11.2 无第三方 CSS 框架

**设计决策：不引入 TailwindCSS、Element Plus 等 UI 库。**

理由：
1. 最终产出是静态 HTML/CSS/JS（打包后）
2. UI 布局固定（三栏 → 两栏 → 单栏），不需要复杂组件库
3. GitHub 风格简洁设计，CSS Variables 足以应对
4. 保持打包体积最小

---

## 十二、部署与配置

### 12.1 安装流程

```bash
# 1. 安装 Skill
npx claude-dev-sprite install

# 安装过程:
# - 下载包到 ~/.claude/skills/claude-dev-sprite/
# - 构建 Web Dashboard 静态文件
# - 初始化 SQLite 数据库
# - 向 Claude Code 注册生命周期钩子
# - 提示配置（可选）
```

### 12.2 配置文件

```json
// ~/.claude/claude-dev-sprite/config.json
{
  "//": "Claude-DevSprite 配置文件",

  "server": {
    "port": 38888,
    "host": "localhost"
  },

  "knowledge": {
    "directoryName": "knowledge",
    "autoCommit": false,
    "commitMessageTemplate": "docs(knowledge): update knowledge base [auto]"
  },

  "analysis": {
    "mode": "incremental",
    "fullAnalysisIntervalDays": 30,
    "fullAnalysisTriggers": {
      "newFilesThreshold": 10,
      "dependencyFilePatterns": [
        "package.json",
        "requirements.txt",
        "Cargo.toml",
        "go.mod"
      ],
      "commitMessageKeywords": [
        "[major]", "[breaking]", "[architecture]", "[refactor]"
      ]
    },
    "diffMaxTokens": 8000,
    "maxRetries": 3,
    "retryBaseDelayMs": 1000
  },

  "detection": {
    "preferredStrategy": "hook",
    "fallbackStrategies": ["watcher", "poller"],
    "pollerIntervalMs": 5000,
    "dedupWindowMs": 5000
  },

  "web": {
    "enabled": true,
    "autoOpen": false
  },

  "logging": {
    "level": "info",
    "file": "~/.claude/claude-dev-sprite/logs/app.log"
  }
}
```

### 12.3 Skill Manifest

```json
// skills/claude-dev-sprite/manifest.json
{
  "name": "claude-dev-sprite",
  "version": "1.0.0",
  "description": "AI-powered knowledge base auto-generation from Git commits",
  "author": "SanQian.Xu",
  "main": "dist/index.js",
  "hooks": [
    "SessionStart",
    "UserPromptSubmit",
    "PostToolUse",
    "SessionEnd"
  ],
  "commands": {
    "/kb": "Open knowledge base dashboard",
    "/kb analyze": "Manually trigger knowledge base analysis",
    "/kb search <query>": "Search knowledge base",
    "/kb config": "Show current configuration",
    "/kb status": "Show analysis status"
  },
  "webUI": {
    "port": 38888,
    "path": "/"
  },
  "permissions": [
    "fs:read",
    "fs:write",
    "git:read",
    "git:write",
    "network:localhost"
  ]
}
```

### 12.4 打包构建

```bash
# 后端: TypeScript 编译
npx tsc -p tsconfig.json
# 输出: dist/

# 前端: Vite 构建
cd web && npm run build
# 输出: web/dist/

# 最终产物:
# dist/          → Node.js 后端
# web/dist/      → 前端静态文件
# skills/        → Skill 配置
```

---

## 十三、开发路线图

### Phase 1: 核心骨架（Week 1-2）

```
目标: 搭建可运行的最小原型

任务:
□ 初始化项目结构，配置 TypeScript
□ 实现 Skill 入口 + 生命周期钩子注册
□ 实现 Worker 服务启动（Express + 基础路由）
□ 实现 SQLite 数据库初始化
□ 实现策略C: Reflog 轮询检测器
□ 实现基本的知识库文件读取 API
□ 搭建 Web Dashboard 骨架（Vue 3 + Vite）
□ 实现项目列表页 + 项目卡片

里程碑: 
  - Worker 服务启动成功
  - 能检测到 Git Commit
  - Web Dashboard 能看到项目列表
```

### Phase 2: AI 分析引擎（Week 3-4）

```
目标: 核心功能 - 自动分析生成文档

任务:
□ 实现 Diff Collector
□ 实现 Context Builder
□ 实现 AI Provider 适配层
□ 实现 Document Generator
□ 编写并调优 Prompt 模板
□ 实现增量/全量模式决策
□ 实现分析任务队列
□ 实现分析日志记录
□ 单元测试覆盖分析引擎

里程碑:
  - Git Commit → AI 分析 → 自动生成 knowledge.md
  - 文档格式符合模板规范
```

### Phase 3: 知识库管理（Week 5）

```
目标: 完整的文档生命周期管理

任务:
□ 实现 Storage Manager（CRUD）
□ 实现 Relation Engine（关联关系）
□ 实现 Link Indexer（链接索引）
□ 实现 Git Sync Manager
□ 实现知识库 README 自动生成
□ 实现知识库元信息维护

里程碑:
  - 知识库目录结构自动维护
  - 关联关系正确建立
  - 链接索引准确
```

### Phase 4: Web Dashboard（Week 6-7）

```
目标: 完整的可视化浏览体验

任务:
□ 实现文件树组件（展开/折叠/高亮）
□ 实现 Markdown 渲染（GFM + 代码高亮）
□ 实现标题目录（自动生成 + 滚动同步）
□ 实现链接解析器 + 知识库间跳转
□ 实现源码查看器（弹窗/分屏）
□ 实现搜索功能
□ 实现面包屑导航
□ 实现响应式布局
□ 实现浏览器前进/后退

里程碑:
  - 文档间流畅跳转
  - 源码文件点击预览
  - 完整的 GitHub 风格阅读体验
```

### Phase 5: 打磨与发布（Week 8）

```
目标: 生产就绪

任务:
□ 实现策略A: Git Hook 自动安装
□ 实现策略B: .git 文件监听
□ 冲突检测与处理
□ 错误处理完善
□ 性能优化
□ 安装/卸载脚本
□ 文档编写
□ 集成测试
□ 暗色主题（可选）
□ npm 包发布

里程碑:
  - 完全零配置运行
  - npx claude-dev-sprite install 一键安装
  - 稳定可靠的自动分析
```

---

## 附录：架构决策记录

### ADR-001: 使用 SQLite 而非 ChromaDB

- **决策**: 使用 SQLite 作为唯一数据库
- **理由**: claude-mem 使用 ChromaDB 做向量检索，但知识库文档搜索以文件名和标题为主，全文搜索 SQLite FTS5 足够。减少依赖复杂度。
- **影响**: 搜索限于关键词匹配，不支持语义搜索。未来可扩展。

### ADR-002: 前端自主研发，不引入 UI 库

- **决策**: 手写 CSS，不引入 TailwindCSS/Element Plus
- **理由**: 布局固定，组件数量有限，引入 UI 库反而增加打包体积和定制难度
- **影响**: 开发初期需要写更多 CSS，但长期维护更灵活

### ADR-003: 知识库目录放在项目仓库内

- **决策**: knowledge/ 目录作为项目仓库的一部分
- **理由**: 支持团队协作，知识库随代码 Git 版本管理
- **影响**: 可能出现 merge conflict，需要专门处理

### ADR-004: Markdown 渲染在前端完成

- **决策**: 前端使用 marked.js 渲染，后端仅返回原始 Markdown
- **理由**: 减少服务端负载，前端可以根据交互需求灵活处理链接跳转
- **影响**: 首次加载大文档时渲染可能稍慢

---

**架构设计完成。可以开始按 Phase 1 进入实施阶段。**