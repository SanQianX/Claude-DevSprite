@echo off
REM 设置 Windows 定时任务 - 每10分钟执行一次 task-runner

echo ========================================
echo   Claude-DevSprite Task Runner Setup
echo ========================================
echo.

REM 删除现有任务（如果存在）
schtasks /delete /tn "ClaudeDevSprite-TaskRunner" /f 2>nul

REM 创建定时任务 - 每10分钟执行
schtasks /create ^
  /tn "ClaudeDevSprite-TaskRunner" ^
  /tr "node D:\Claude-DevSprite\tasks\task-runner.js" ^
  /sc minute ^
  /mo 10 ^
  /st 00:00 ^
  /ru "%USERNAME%" ^
  /rl HIGHEST ^
  /f

if %errorlevel% equ 0 (
    echo.
    echo [SUCCESS] 定时任务创建成功!
    echo.
    echo 任务名称: ClaudeDevSprite-TaskRunner
    echo 执行频率: 每10分钟
    echo 执行命令: node D:\Claude-DevSprite\tasks\task-runner.js
    echo.
    echo 管理命令:
    echo   查看状态: schtasks /query /tn "ClaudeDevSprite-TaskRunner"
    echo   手动运行: schtasks /run /tn "ClaudeDevSprite-TaskRunner"
    echo   暂停任务: schtasks /change /tn "ClaudeDevSprite-TaskRunner" /disable
    echo   恢复任务: schtasks /change /tn "ClaudeDevSprite-TaskRunner" /enable
    echo   删除任务: schtasks /delete /tn "ClaudeDevSprite-TaskRunner" /f
) else (
    echo.
    echo [ERROR] 定时任务创建失败!
    echo 请以管理员身份运行此脚本。
)

echo.
pause
