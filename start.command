#!/usr/bin/env bash
# start.command - Двойной клик для запуска Блок-Схемы ГОСТ
cd "$(dirname "$0")"

echo "======================================================"
echo "  Генератор блок-схем по ГОСТ 19.701-90 (Python, C++, C#, C, Go)"
echo "======================================================"

if command -v node >/dev/null 2>&1; then
    echo "Запуск локального сервера: http://127.0.0.1:8080 ..."
    node server.js &
    SERVER_PID=$!
    sleep 1
    open "http://127.0.0.1:8080"
    echo ""
    echo "[OK] Веб-интерфейс открыт в браузере (http://127.0.0.1:8080)."
    echo "Онлайн-версия: https://kukes-misis.github.io/blok-shema/"
    echo "Чтобы остановить сервер, нажмите Ctrl+C или закройте это окно терминала."
    trap "kill $SERVER_PID 2>/dev/null; exit 0" INT TERM EXIT
    wait $SERVER_PID
else
    echo "[ИНФОРМАЦИЯ] Node.js не обнаружен. Локальный сервер не требуется."
    echo "Открытие автономного интерфейса напрямую в браузере..."
    open "index.html"
fi
