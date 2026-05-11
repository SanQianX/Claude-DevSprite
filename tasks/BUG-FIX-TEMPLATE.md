# Bug Fix 文档模板

使用此模板记录每个组件的 Bug 排查过程。

---

# [组件名称] Bug 修复

## 问题概述
[简短描述发现的问题]

## 修复日期
YYYY-MM-DD

## 文件清单

| 文件 | 内容 |
|------|------|
| [01-ui-analysis.md](./01-ui-analysis.md) | UI 控件分析 |
| [02-code-review.md](./02-code-review.md) | 代码审查 |
| [03-bug-discovery.md](./03-bug-discovery.md) | 问题发现 (含 UI 测试) |
| [04-fix-implementation.md](./04-fix-implementation.md) | 修复实现 |
| [05-ui-testing.md](./05-ui-testing.md) | UI 测试验证 (Playwright) |

## 修复结果
- ✅ / ❌ [描述修复结果]

---

# 01. UI 控件分析

## 组件结构
```
┌─────────────────────────────────────┐
│ 组件布局图                           │
└─────────────────────────────────────┘
```

## 控件清单

| 控件 | 类型 | 功能 | 事件 |
|------|------|------|------|
| xxx | button | 功能描述 | @click |

## 数据流
```
用户操作 → 事件处理 → API 调用 → 数据更新 → DOM 更新
```

---

# 02. 代码审查

## 关键代码段

```typescript
// 问题代码或关键逻辑
```

## 审查检查清单

- [ ] 数据绑定正确
- [ ] 事件处理完整
- [ ] 错误处理覆盖
- [ ] 边界情况考虑
- [ ] 无内存泄漏风险

## 发现的问题

1. **问题 1**: 描述
2. **问题 2**: 描述

---

# 03. 问题发现 (含 UI 测试)

## 测试环境
- 浏览器: Chromium (Playwright)
- 测试页面: URL
- 测试数据: 说明

## 修复前 UI 测试

### 测试脚本
```javascript
// Playwright 测试脚本
const { chromium } = require('playwright');

async function testBeforeFix() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 1. 打开页面
  await page.goto('http://127.0.0.1:38888/xxx');

  // 2. 模拟用户操作
  await page.click('.button-selector');
  await page.waitForTimeout(500);

  // 3. 检查结果
  const result = await page.$('.result-selector');
  console.log(`结果: ${result ? '存在' : '不存在'}`);

  // 4. 截图保存
  await page.screenshot({ path: 'before-fix.png', fullPage: true });

  await browser.close();
}
```

### 测试结果
```
[控制台输出]
- 操作: 点击 xxx 按钮
- 预期: xxx
- 实际: xxx
- 状态: ❌ 失败
```

### 截图
`before-fix.png`

---

# 04. 修复实现

## 修复方案
描述修复思路

## 代码变更

### 修改前
```typescript
// 问题代码
```

### 修改后
```typescript
// 修复后代码
```

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| xxx.vue | 修改 | 说明 |

---

# 05. UI 测试验证 (Playwright)

## 测试环境
- 浏览器: Chromium (Playwright)
- 测试页面: URL
- 测试数据: 说明

## 测试脚本

```javascript
const { chromium } = require('playwright');

async function testAfterFix() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // 监听控制台
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Error] ${msg.text()}`);
    }
  });

  // 1. 打开页面
  console.log('=== Step 1: 打开页面 ===');
  await page.goto('http://127.0.0.1:38888/xxx');
  await page.waitForTimeout(2000);

  // 2. 检查元素存在
  console.log('\n=== Step 2: 检查元素 ===');
  const element = await page.$('.selector');
  console.log(`元素存在: ${!!element}`);

  // 3. 模拟用户操作
  console.log('\n=== Step 3: 模拟点击 ===');
  await page.click('.button-selector');
  await page.waitForTimeout(500);

  // 4. 验证结果
  console.log('\n=== Step 4: 验证结果 ===');
  const result = await page.$$('.result-item');
  console.log(`结果数量: ${result.length}`);

  // 5. 测试筛选器
  console.log('\n=== Step 5: 测试筛选 ===');
  await page.selectOption('.filter-select', 'value');
  await page.waitForTimeout(500);
  const filtered = await page.$$('.result-item');
  console.log(`筛选后数量: ${filtered.length}`);

  // 6. 截图保存
  await page.screenshot({ path: 'after-fix.png', fullPage: true });
  console.log('\n=== 截图已保存 ===');

  await browser.close();
}

testAfterFix().catch(console.error);
```

## 测试结果

| 测试项 | 修复前 | 修复后 | 状态 |
|--------|--------|--------|------|
| 元素存在 | false | true | ✅ |
| 点击响应 | 无反应 | 正常 | ✅ |
| 筛选功能 | 不工作 | 正常 | ✅ |
| 数据更新 | 不更新 | 正常 | ✅ |

### 控制台输出
```
=== Step 1: 打开页面 ===
=== Step 2: 检查元素 ===
元素存在: true
=== Step 3: 模拟点击 ===
=== Step 4: 验证结果 ===
结果数量: 10
=== Step 5: 测试筛选 ===
筛选后数量: 3
=== 截图已保存 ===
```

### 截图
`after-fix.png`

## 测试结论
✅ 所有测试通过，修复有效

---

# 附录: UI 测试流程

## 标准测试流程

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI 测试流程                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 修复前测试 (验证 Bug 存在)                                   │
│     ├── 打开测试页面                                             │
│     ├── 模拟用户操作 (点击、输入、选择)                           │
│     ├── 记录实际行为                                             │
│     ├── 截图保存                                                 │
│     └── 确认问题存在                                             │
│                                                                 │
│  2. 实施修复                                                     │
│     ├── 修改代码                                                 │
│     ├── 重新构建                                                 │
│     └── 重启服务                                                 │
│                                                                 │
│  3. 修复后测试 (验证修复有效)                                     │
│     ├── 打开测试页面                                             │
│     ├── 执行相同操作                                             │
│     ├── 验证预期行为                                             │
│     ├── 截图保存                                                 │
│     └── 确认问题已解决                                           │
│                                                                 │
│  4. 回归测试 (确保无副作用)                                       │
│     ├── 测试相关功能                                             │
│     ├── 检查控制台错误                                           │
│     └── 验证性能无影响                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Playwright 常用操作

### 点击操作
```javascript
// 点击按钮
await page.click('.btn-approve');

// 点击特定位置的元素
await page.click('.review-item:first-child .btn-approve');

// 模拟停止事件传播
await page.click('.btn', { modifiers: ['StopPropagation'] });
```

### 输入操作
```javascript
// 输入文本
await page.fill('.input-selector', 'text');

// 选择下拉框
await page.selectOption('.filter-select', 'value');

// 清空输入框
await page.fill('.input-selector', '');
```

### 等待操作
```javascript
// 等待元素出现
await page.waitForSelector('.element');

// 等待指定时间
await page.waitForTimeout(500);

// 等待导航完成
await page.waitForNavigation();
```

### 检查操作
```javascript
// 检查元素是否存在
const element = await page.$('.selector');
console.log(`存在: ${!!element}`);

// 获取元素数量
const items = await page.$$('.item');
console.log(`数量: ${items.length}`);

// 获取文本内容
const text = await page.textContent('.selector');
console.log(`内容: ${text}`);

// 获取属性值
const value = await page.getAttribute('.selector', 'value');
console.log(`属性: ${value}`);
```

### 截图操作
```javascript
// 全页截图
await page.screenshot({ path: 'screenshot.png', fullPage: true });

// 元素截图
await page.screenshot({ path: 'element.png', element: '.selector' });
```

## 测试报告格式

```markdown
## 测试报告

### 环境
- 浏览器: Chromium
- URL: http://127.0.0.1:38888/xxx
- 时间: YYYY-MM-DD HH:MM

### 测试用例

#### TC-001: [测试名称]
- **前置条件**: ...
- **操作步骤**:
  1. 打开页面
  2. 点击 xxx
  3. 观察 xxx
- **预期结果**: ...
- **实际结果**: ...
- **状态**: ✅ / ❌
- **截图**: xxx.png

### 测试总结
- 总用例数: X
- 通过: X
- 失败: X
- 通过率: X%
```
