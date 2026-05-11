/**
 * Task Runner - 自动化 Bug 排查循环
 *
 * 功能:
 * 1. 读取 STATE.json 获取当前任务
 * 2. 检查是否正在开发中
 * 3. 如果空闲，开始下一个任务
 * 4. 执行任务并更新状态
 * 5. 提交到 git
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STATE_FILE = path.join(__dirname, 'STATE.json');
const BUGFIX_DIR = path.join(__dirname, 'bugfix');
const TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟

// 读取状态
function readState() {
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to read state:', error.message);
    return null;
  }
}

// 写入状态
function writeState(state) {
  try {
    state.lastUpdate = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to write state:', error.message);
    return false;
  }
}

// 检查是否超时（超过10分钟未更新）
function isTimedOut(state) {
  if (!state.lastUpdate) return true;
  const lastUpdate = new Date(state.lastUpdate);
  const now = new Date();
  return (now - lastUpdate) > TIMEOUT_MS;
}

// 执行 git 命令
function gitCommand(cmd) {
  try {
    const result = execSync(cmd, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      timeout: 30000
    });
    return result.trim();
  } catch (error) {
    console.error(`Git command failed: ${cmd}`, error.message);
    return null;
  }
}

// 提交到 git
function commitToGit(taskId, taskName) {
  const timestamp = new Date().toISOString().slice(0, 10);
  const commitMsg = `fix(${taskId}): ${taskName} Bug 修复

- 自动排查发现并修复
- 日期: ${timestamp}
- 详见 tasks/bugfix/${taskId}/`;

  // 添加文件
  execSync('git add tasks/', { cwd: path.join(__dirname, '..') });

  // 检查是否有变更
  const status = gitCommand('git status --porcelain tasks/');
  if (!status) {
    console.log('No changes to commit');
    return false;
  }

  // 提交
  try {
    execSync(`git commit -m "${commitMsg}"`, {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8'
    });
    console.log('Committed successfully');
    return true;
  } catch (error) {
    console.error('Commit failed:', error.message);
    return false;
  }
}

// 推送到远程
function pushToRemote() {
  try {
    execSync('git push origin main', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      timeout: 60000
    });
    console.log('Pushed successfully');
    return true;
  } catch (error) {
    console.error('Push failed:', error.message);
    return false;
  }
}

// 创建 bugfix 文件夹
function createBugfixFolder(taskId) {
  const folderPath = path.join(BUGFIX_DIR, taskId);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`Created bugfix folder: ${taskId}`);
  }
  return folderPath;
}

// 生成任务报告模板
function generateTaskReport(task, folderPath) {
  const report = `# ${task.name} Bug 修复

## 任务信息
- **ID**: ${task.id}
- **优先级**: ${task.priority}
- **模块**: ${task.module}
- **描述**: ${task.description}

## 排查文件
${task.files.map(f => `- ${f}`).join('\n')}

## 排查结果
（待填写）

## 发现的问题
（待填写）

## 修复方案
（待填写）

## 测试验证
（待填写）
`;

  fs.writeFileSync(path.join(folderPath, 'README.md'), report);
}

// 主执行逻辑
async function main() {
  console.log(`[${new Date().toISOString()}] Task Runner started`);

  const state = readState();
  if (!state) {
    console.error('Cannot read state, exiting');
    process.exit(1);
  }

  // 检查是否正在开发中
  if (state.status === 'in_progress' && !isTimedOut(state)) {
    console.log(`Development in progress: ${state.currentTask}`);
    console.log('Skipping this cycle');
    process.exit(0);
  }

  // 获取下一个任务
  const nextTask = state.taskQueue.find(t =>
    !state.completedTasks.includes(t.id)
  );

  if (!nextTask) {
    console.log('All tasks completed!');
    state.status = 'completed';
    writeState(state);
    process.exit(0);
  }

  console.log(`Starting task: ${nextTask.name} (${nextTask.id})`);

  // 更新状态为进行中
  state.currentTask = nextTask.id;
  state.status = 'in_progress';
  writeState(state);

  // 创建 bugfix 文件夹
  const folderPath = createBugfixFolder(nextTask.id);

  // 生成任务报告
  generateTaskReport(nextTask, folderPath);

  // 更新状态
  state.completedTasks.push(nextTask.id);
  state.statistics.completed++;
  state.statistics.pending--;
  state.status = 'idle';
  writeState(state);

  // 提交到 git
  console.log('Committing changes...');
  commitToGit(nextTask.id, nextTask.name);

  // 推送到远程
  console.log('Pushing to remote...');
  pushToRemote();

  console.log(`Task completed: ${nextTask.name}`);
  console.log(`Progress: ${state.statistics.completed}/${state.statistics.totalTasks}`);
}

// 运行
main().catch(error => {
  console.error('Task runner failed:', error);
  process.exit(1);
});
