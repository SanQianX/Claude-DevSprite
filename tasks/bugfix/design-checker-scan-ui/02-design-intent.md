# 02. 原始设计逻辑

## 系统架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DesignChecker 功能一致性扫描架构                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  前端                                                                  │
│  ├─ DashboardView.vue ─────→ 审查队列 + 扫描控制                        │
│  │     ├─ scan-btn ────────→ 手动扫描                                   │
│  │     ├─ scan-toggle ─────→ 启用/禁用定时扫描                          │
│  │     └─ scan-interval ───→ 扫描间隔选择                               │
│  │          │                                                          │
│  │          ↓                                                          │
│  ├─ dashboard store ───────→ scannerConfig + triggerScan               │
│  ├─ dashboard API ─────────→ getScannerConfig / updateScannerConfig    │
│          │                                                              │
│          ↓                                                              │
│  后端                                                                  │
│  ├─ routes/reviews.ts ─────→ POST /scan + GET/PUT /scanner/config      │
│  ├─ routes/index.ts ───────→ registerScannerConfigRoutes               │
│  ├─ designChecker.ts ──────→ DesignChecker 核心引擎                     │
│  │     ├─ scanProject() ───→ 收集文档 + AI 分析                        │
│  │     ├─ startScanner() ──→ setInterval 后台循环                      │
│  │     ├─ getConfig() ─────→ 返回当前配置                               │
│  │     └─ updateConfig() ──→ 动态更新间隔和启用状态                     │
│  └─ db.ts ─────────────────→ createReviewsBatch (事务安全)              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 后端端点设计

### 扫描端点

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| POST | `/api/projects/:name/reviews/scan` | 手动触发功能一致性扫描 | ✅ 已实现 |
| GET | `/api/scanner/config` | 获取扫描器配置 | ✅ 已实现 |
| PUT | `/api/scanner/config` | 更新扫描器配置 | ✅ 已实现 |

### 原有审查端点 (保持不变)

| 方法 | 路径 | 功能 | 状态 |
|------|------|------|------|
| GET | `/api/projects/:name/reviews` | 列出审查项 | ✅ |
| PUT | `/api/reviews/:id/approve` | 批准审查 | ✅ |
| PUT | `/api/reviews/:id/ignore` | 忽略审查 | ✅ |
| POST | `/api/reviews/:id/fix` | 生成 AI 修复 | ✅ |

## DesignChecker 扫描流程

```
scanProject(projectId, projectPath, projectName)
    │
    ├─ 1. 收集设计文档
    │     读取 tasks/FUNCTIONAL-LOGIC-ANALYSIS.md
    │     读取 tasks/COMPONENT-INVENTORY.md
    │     读取 tasks/BUG-HUNTING-PLAN.md
    │
    ├─ 2. 收集知识库文档
    │     KnowledgeBaseManager(project.knowledge_path)
    │     .listDocuments() → Document[]
    │
    ├─ 3. 收集源代码文件
    │     扫描 src/ 和 web/src/ 目录
    │     最多 20 个文件, 300KB 总量
    │     过滤: node_modules, dist, .git
    │
    ├─ 4. 组装 AI Prompt
    │     设计文档 + 知识库 + 源代码
    │     检查 7 类不一致:
    │     ├─ missing-impl (功能缺失)
    │     ├─ dead-code (死代码)
    │     ├─ logic-mismatch (逻辑不一致)
    │     ├─ api-mismatch (API 不一致)
    │     ├─ state-mismatch (状态不一致)
    │     ├─ unrecorded (未记录功能)
    │     └─ dataflow (数据流错误)
    │
    ├─ 5. 调用 AI 分析
    │     AIProvider.callAI(prompt)
    │
    ├─ 6. 解析响应
    │     parseResponse() → DesignCheckResult
    │
    └─ 7. 写入数据库
          db.createReviewsBatch(reviews)
          source='design-check'
          category='设计不匹配' 等
```

## 定时扫描机制

```
DesignChecker.startScanner()
    │
    ├─ 检查 enabled 标志
    │     if (!enabled) return
    │
    ├─ setInterval(scanAllProjects, intervalMs)
    │     默认: 10 分钟 (600000ms)
    │
    └─ setTimeout(scanAllProjects, 30000)
          启动后 30 秒执行首次扫描

DesignChecker.updateConfig({ enabled, intervalMs })
    │
    ├─ 更新 enabled 标志
    ├─ 更新 scanIntervalMs (最小 60 秒)
    ├─ stopScanner() (清除旧定时器)
    └─ if (enabled) startScanner() (创建新定时器)
```

## 数据库设计

### reviews 表 (source 字段区分扫描类型)

| source 值 | 说明 | 由谁写入 |
|-----------|------|----------|
| `ai` | git diff 代码质量扫描 | CodeReviewer |
| `design-check` | 功能一致性扫描 | DesignChecker |
| `manual` | 手动创建 | 用户 |

### scanner config (内存状态)

```typescript
interface ScannerConfig {
  enabled: boolean;      // 是否启用定时扫描
  intervalMs: number;    // 扫描间隔 (毫秒)
  isScanning: boolean;   // 当前是否正在扫描
}
```

配置存储在 DesignChecker 实例的内存中，不持久化。重启后恢复默认值 (enabled=true, intervalMs=600000)。
