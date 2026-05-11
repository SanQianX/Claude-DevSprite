# run_claude_loop.ps1
$maxTurns = 500

# 设置 Mimo 环境变量（来自 use-mimo 函数）
$env:ANTHROPIC_AUTH_TOKEN = "tp-co7hqo7902z08bm9wetz3aqobllj8johfaw1o862lba8npq0"
$env:ANTHROPIC_BASE_URL = "https://token-plan-cn.xiaomimimo.com/anthropic"
$env:API_TIMEOUT_MS = "3000000"
$env:ANTHROPIC_MODEL = "mimo-v2.5"
$env:ANTHROPIC_SMALL_FAST_MODEL = "mimo-v2.5"
$env:ANTHROPIC_DEFAULT_SONNET_MODEL = "mimo-v2.5"
$env:ANTHROPIC_DEFAULT_OPUS_MODEL = "mimo-v2.5"
$env:ANTHROPIC_DEFAULT_HAIKU_MODEL = "mimo-v2.5"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"

$prompt = @"
# Role
You are a senior full-stack engineer. Transform DevSprite into a dual-mode project workspace as per design doc.

## Context
- Design doc: D:\Claude-DevSprite\docs\designs\mockups\v1.1.1\project-workspace-design-v1.1.1.md
- UI mockups: D:\Claude-DevSprite\docs\designs\mockups\v1.1.1
- Tokens: call `ccusage` tool for stats, do NOT re-implement.
- Agent reference: openclaw at D:\...\openclaw, use only design patterns, no copy/paste.

## Priority (strict order)
Phase0 - Home redesign (sidebar removal, TokensBar, global search, Console collapsible, project table)
Phase1 - Project workspace base (routing + SplitPane + panel toggle)
Phase2 - Dashboard (task list + AI review queue)
Phase3 - Workspace panels (Doc, Code, Chat)
Phase4 - Doc↔Code links (jump + highlight)
Phase5 - AI review integration (background scan + auto-fix)
Phase6 - Dev memory (context + summaries)

## Workflow per iteration
1. Identify next incomplete feature.
2. Implement (frontend + backend + basic tests).
3. Verify:
   - UI: pixel-perfect match with mockups
   - Functional: all expected behaviors
   - Regression: existing features intact
4. If pass → commit with detailed Chinese message → push.
5. If fail → fix → re-verify (retry allowed).
6. Repeat.

## Stop conditions (output "DONE")
- All mockup features implemented.
- Screenshot diff < 0.1%.
- No regression.
- E2E journey passes.

## Constraints
- Do not break existing core components (DocumentView, DevChatView, SourceViewer).
- Avoid destructive git commands.
- Use normal `git push origin main`.
"@

while ($true) {
    Write-Host "=== Starting Claude session ===" -ForegroundColor Green
    # 通过管道将 prompt 传给 Claude（注意：命令名是大写 C 的 Claude）
    $prompt | Claude --dangerously-skip-permissions -p - --max-turns $maxTurns

    Write-Host "=== Session ended, restart in 1 second ===" -ForegroundColor Cyan
    Start-Sleep -Seconds 1
}