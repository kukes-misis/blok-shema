#!/usr/bin/env bash
# start-macos.command - Запуск для macOS
cd "$(dirname "$0")"

echo "======================================================"
echo "  Генератор блок-схем по ГОСТ 19.701-90 (Python, C++, C#, C, Go)"
echo "======================================================"
echo "Запуск сервера: http://localhost:8080 ..."

# Запуск локального сервера
node server.js &
SERVER_PID=$!

sleep 0.8
open "http://localhost:8080"

echo ""
echo "Веб-интерфейс открыт в браузере (http://localhost:8080)."
echo "Чтобы остановить сервер, закройте это окно терминала или нажмите Ctrl+C."

trap "kill $SERVER_PID 2>/dev/null; exit 0" INT TERM EXIT
wait $SERVER_PID
