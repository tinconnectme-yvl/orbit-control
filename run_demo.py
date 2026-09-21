"""
ОРБИТА-КОНТРОЛ // ЦУП Спутниковой Группировки
Автономная система оператора наземного центра управления полётами
Команда «Team Я - Vector» • КосмоХакатон 2026 (Благовещенск)

Единая точка запуска системы (Localhost First):
Запуск: python run_demo.py [--port 8010]
"""
import os
import sys
import time
import socket
import argparse
import webbrowser
import threading
from pathlib import Path

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Add backend directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

try:
    import uvicorn
except ImportError:
    print("❌ Не установлен uvicorn. Выполните: pip install -r backend/requirements.txt")
    sys.exit(1)

def is_port_free(port, host="127.0.0.1"):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex((host, port)) != 0

def find_available_port(preferred_port=8010, host="127.0.0.1"):
    port = preferred_port
    while port < preferred_port + 50:
        if is_port_free(port, host):
            return port
        port += 1
    return preferred_port

def open_browser(port):
    time.sleep(1.2)
    url = f"http://127.0.0.1:{port}"
    print(f"\n🚀 Открытие веб-сервиса ЦУП в браузере: {url}\n")
    webbrowser.open(url)

def main():
    parser = argparse.ArgumentParser(description="ОРБИТА-КОНТРОЛ // ЦУП Спутниковой Группировки")
    parser.add_argument("--port", type=int, default=8010, help="Порт для веб-сервера (по умолчанию 8010)")
    parser.add_argument("--no-browser", action="store_true", help="Не открывать браузер автоматически")
    args = parser.parse_args()

    port = args.port
    if not is_port_free(port):
        new_port = find_available_port(port + 1)
        print(f"⚠️ Порт {port} уже занят другим процессом. Автоматически выбран свободный порт: {new_port}")
        port = new_port

    print("=" * 70)
    print("🛰️  ОРБИТА-КОНТРОЛ // СИТУАЦИОННЫЙ ЦЕНТР ОПЕРАТОРА ЦУП")
    print("    Кейс №1: «Автономное управление спутниковой группировкой»")
    print("    Команда «Team Я - Vector» | КосмоХакатон 2026")
    print("=" * 70)
    print(f"  • Локальный адрес: http://127.0.0.1:{port}")
    print(f"  • Документация API: http://127.0.0.1:{port}/docs")
    print("  • Схема данных:   cosmo-B-ops-result-1.0 (100% Bit-Exact Replay)")
    print("=" * 70)

    if not args.no_browser:
        threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        app_dir=str(PROJECT_ROOT / "backend"),
        log_level="info"
    )

if __name__ == "__main__":
    main()
