@echo off
chcp 65001 >nul
title Блок-Схемы ГОСТ (Python, C++, C#, C, Go)
cd /d "%~dp0"

echo ======================================================
echo   Генератор блок-схем по ГОСТ 19.701-90 (Windows)
echo   Поддержка: Python, C++, C#, ANSI C, Go (Golang)
echo ======================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js обнаружен в системе.
    echo Запуск локального сервера http://localhost:8080 ...
    start "C# Flowchart Server" /b node server.js
    timeout /t 1 /nobreak >nul
    start http://localhost:8080
    echo.
    echo Веб-интерфейс открыт в вашем браузере!
    echo Чтобы остановить сервер, закройте это окно.
    echo.
) else (
    echo [ВНИМАНИЕ] Node.js не установлен в PATH.
    echo Открытие автономного веб-интерфейса напрямую в браузере...
    start index.html
    echo.
    echo Веб-приложение работает локально без сервера!
    echo.
)

pause
