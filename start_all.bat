@echo off
echo ========================================================
echo   Menjalankan NARASI
echo ========================================================
echo.

set ROOT=%~dp0
set PY=%ROOT%backend\.venv\Scripts\python.exe

rem Persiapan pertama kali: pasang dependensi bila belum ada.
if not exist "%PY%" (
    where uv >nul 2>nul
    if errorlevel 1 (
        echo [!] "uv" belum terpasang. Pasang dulu: https://docs.astral.sh/uv/getting-started/installation/
        pause
        exit /b 1
    )
    echo Memasang dependensi server (sekali saja^)...
    pushd "%ROOT%backend"
    uv sync
    popd
)
if not exist "%ROOT%dashboard\node_modules" (
    where npm >nul 2>nul
    if errorlevel 1 (
        echo [!] Node.js belum terpasang. Pasang dulu: https://nodejs.org
        pause
        exit /b 1
    )
    echo Memasang dependensi dashboard (sekali saja^)...
    pushd "%ROOT%dashboard"
    call npm install
    popd
)

echo 1. Menyalakan server NARASI di http://localhost:8000 ...
start "NARASI Server (Port 8000)" cmd /k "cd /d "%ROOT%backend" && "%PY%" -m uvicorn app.main:app --port 8000"

echo 2. Menyalakan Dashboard di http://localhost:5174 ...
start "NARASI Dashboard (Port 5174)" cmd /k "cd /d "%ROOT%dashboard" && npm run dev"

echo.
echo ========================================================
echo   NARASI sudah berjalan. Jangan tutup dua jendela baru tadi.
echo.
echo   Pasang ekstensi (cukup sekali):
echo   1. Buka Chrome / Edge, ketik chrome://extensions
echo   2. Nyalakan "Developer mode" (pojok kanan atas)
echo   3. Klik "Load unpacked", lalu pilih folder:
echo      %ROOT%extension\.output\chrome-mv3
echo.
echo   Setelah itu:
echo   - Buka Instagram, TikTok, YouTube Shorts, atau Facebook
echo   - Buka http://localhost:5174 untuk melihat Dashboard
echo ========================================================
pause
