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
    echo Запуск локального веб-сервера...
    start "Gost Flowchart Server" /b node server.js
    timeout /t 2 /nobreak >nul
    start "" http://127.0.0.1:8080
    echo.
    echo [OK] Веб-интерфейс открыт: http://127.0.0.1:8080
    echo      (Также доступен по http://localhost:8080)
    echo.
    echo Автономный режим без сервера: запустите open-offline-windows.bat или index.html
    echo Онлайн-версия на GitHub:      https://kukes-misis.github.io/blok-shema/
    echo.
    echo Чтобы остановить локальный сервер, закройте это окно.
    echo.
) else (
    echo [ИНФОРМАЦИЯ] Node.js не установлен на этом компьютере.
    echo Для работы генератора Node.js НЕ ТРЕБУЕТСЯ!
    echo Открытие автономного интерфейса напрямую в вашем браузере...
    echo.
    start "" "%~dp0index.html"
    echo [OK] Файл index.html успешно открыт в браузере.
    echo Онлайн-версия доступна по ссылке:
    echo https://kukes-misis.github.io/blok-shema/
    echo.
)

pause
