@echo off
title NARASI - Cek Hoaks Video Pendek
set ROOT=%~dp0
cd /d "%ROOT%server"

echo ========================================================
echo   NARASI sedang dinyalakan...
echo ========================================================

rem Cegah dua server di port yang sama.
curl -s -o nul http://127.0.0.1:8000/health && (
    echo NARASI sudah berjalan. Membuka dashboard...
    start "" http://localhost:8000
    timeout /t 3 >nul
    exit /b 0
)

rem Buka dashboard otomatis begitu server siap.
start "" /b cmd /c "for /l %%i in (1,1,60) do (curl -s -o nul http://127.0.0.1:8000/health && (start "" http://localhost:8000 & exit) || timeout /t 1 >nul)"

echo.
echo   Dashboard : http://localhost:8000  (terbuka otomatis)
echo.
echo   Pasang ekstensi (cukup sekali):
echo   1. Buka Chrome / Edge, ketik chrome://extensions
echo   2. Nyalakan "Developer mode" (pojok kanan atas)
echo   3. Klik "Load unpacked", pilih folder:
echo      %ROOT%ekstensi-NARASI
echo.
echo   Lalu buka video di Instagram, TikTok, YouTube Shorts, atau Facebook.
echo.
echo   JANGAN tutup jendela ini selama mencoba NARASI.
echo ========================================================
echo.

"%ROOT%python\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
echo.
echo Server berhenti. Bila ada pesan error di atas, kirimkan tangkapan layarnya ke tim NARASI.
pause
