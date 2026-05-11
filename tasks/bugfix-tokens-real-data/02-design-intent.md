# 02. 原始设计逻辑

## 设计文档参考

来自 `docs/designs/project-workspace-design.md` §6.3

### Tokens 栏设计规格

```
┌─────────────────────────────────────────────────────────────────────┐
│ Tokens  150K → $2.35  ● In 85K  ● Out 45K  ▐▌▌▌  ↑12%  [日][周][月] │
│ ─────────────────────────────────────────────────────────────────── │
│ 浅色背景 #f8fafc，单行布局，mini 图表 + 趋势 + 进度条 + 数值         │
└─────────────────────────────────────────────────────────────────────┘
```

### 设计要求

1. **视觉风格**
   - 浅色背景 `#f8fafc`
   - 单行紧凑布局
   - 迷你柱状图展示趋势
   - 彩色圆点区分 Input/Output/Cache

2. **数据展示**
   - 总 Token 数量
   - USD 费用（可选）
   - 输入/输出/缓存分类统计
   - 趋势变化百分比

3. **交互功能**
   - 周期切换（日/周/月/全部）
   - 手动刷新
   - 详情弹窗（扩展功能）

## 参考项目: ccusage

项目位置: `docs/designs/ccusage/`

### ccusage 核心功能

```
数据源: ~/.claude/projects/ 下的 JSONL 文件
    ↓
解析器: data-loader.ts 解析 token 使用记录
    ↓
聚合器: calculate-cost.ts 计算费用
    ↓
输出: daily/monthly/session/blocks 报告
```

### ccusage JSON 输出格式

```json
{
  "daily": [
    {
      "date": "2026-05-12",
      "inputTokens": 268726,
      "outputTokens": 16309,
      "cacheCreationTokens": 0,
      "cacheReadTokens": 7007488,
      "totalTokens": 7292523,
      "totalCost": 0,
      "modelsUsed": ["mimo-v2.5"],
      "modelBreakdowns": [...]
    }
  ]
}
```

### 数据映射关系

| ccusage 字段 | 前端字段 | 说明 |
|-------------|---------|------|
| `inputTokens` | `input` | 输入 Token |
| `outputTokens` | `output` | 输出 Token |
| `cacheReadTokens + cacheCreationTokens` | `cache` | 缓存 Token |
| `totalTokens` | `total` | 总计 |
| `totalCost` | `cost` | USD 费用 |
| `modelsUsed` | `models` | 使用的模型列表 |

## 原始设计意图

### 数据采集
- 实时读取本地 Claude Code 日志文件
- 支持多项目、多会话的数据聚合
- 使用 LiteLLM 定价数据库计算费用

### 数据展示
- 按日/周/月/全部维度聚合
- 显示趋势变化（当前周期 vs 上一周期）
- 支持按模型细分查看

### 性能优化
- 本地缓存避免重复计算
- 增量更新只处理新数据
- 异步加载不阻塞 UI
