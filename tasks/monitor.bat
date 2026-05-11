@echo off
REM 监控任务执行状态

:loop
cls
echo ========================================
echo   Claude-DevSprite Task Monitor
echo   按 Ctrl+C 退出
echo ========================================
echo.

REM 显示当前时间
echo 当前时间: %date% %time%
echo.

REM 显示任务状态
echo [任务状态]
node -e "const s=require('./STATE.json'); console.log('状态:', s.status); console.log('当前任务:', s.currentTask || '无'); console.log('最后更新:', s.lastUpdate); console.log('进度:', s.statistics.completed + '/' + s.statistics.totalTasks); console.log('待处理:', s.statistics.pending);"

echo.
echo [定时任务状态]
schtasks /query /tn "ClaudeDevSprite-TaskRunner" /fo LIST 2>nul | findstr /i "状态 下次运行 时间"

echo.
echo ========================================
echo 按 R 立即执行 | 按 S 暂停 | 按 P 恢复 | 按 D 删除
echo ========================================

choice /c RSPD /n /m "选择操作: "

if %errorlevel%==1 (
    echo.
    echo 手动执行任务...
    node D:\Claude-DevSprite\tasks\task-runner.js
    pause
)
if %errorlevel%==2 (
    echo.
    echo 暂停定时任务...
    schtasks /change /tn "ClaudeDevSprite-TaskRunner" /disable
    pause
)
if %errorlevel%==3 (
    echo.
    echo 恢复定时任务...
    schtasks /change /tn "ClaudeDevSprite-TaskRunner" /enable
    pause
)
if %errorlevel%==4 (
    echo.
    echo 删除定时任务...
    schtasks /delete /tn "ClaudeDevSprite-TaskRunner" /f
    pause
)

timeout /t 5 /nobreak >nul
goto loop
