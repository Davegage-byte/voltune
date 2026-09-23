@echo off
setlocal EnableExtensions
set "BASE=%LOCALAPPDATA%\AVEX-NEXUS"
set "ROOT=%BASE%\voltune"
set "PY=%BASE%\venv\Scripts\python.exe"
set "TASK=AVEX NEXUS Collector"

:menu
cls
echo ==============================================
echo   AVEX NEXUS Collector - Verwaltung
echo ==============================================
echo.
echo  1  Jetzt abrufen + zu GitHub pushen
echo  2  Nur lokal testen, kein Push
echo  3  Status und letzte Logzeilen anzeigen
echo  4  Automatik pausieren
echo  5  Automatik fortsetzen
echo  6  Windows-Aufgabe entfernen
echo  0  Beenden
echo.
set /p "CHOICE=Auswahl: "

if "%CHOICE%"=="1" goto runpush
if "%CHOICE%"=="2" goto runtest
if "%CHOICE%"=="3" goto status
if "%CHOICE%"=="4" goto pause
if "%CHOICE%"=="5" goto resume
if "%CHOICE%"=="6" goto remove
if "%CHOICE%"=="0" exit /b 0
goto menu

:runpush
echo.
"%PY%" "%ROOT%\nexus-avex\avex_nexus_runner.py" --once
pause
goto menu

:runtest
echo.
"%PY%" "%ROOT%\nexus-avex\avex_nexus_runner.py" --once --no-push
pause
goto menu

:status
echo.
echo --- Windows-Aufgabe ---
schtasks /Query /TN "%TASK%" /FO LIST /V 2>nul
echo.
echo --- Health ---
if exist "%BASE%\health.json" type "%BASE%\health.json"
if not exist "%BASE%\health.json" echo Noch keine Health-Datei vorhanden.
echo.
echo --- Letzte Logzeilen ---
if exist "%BASE%\logs\avex-watcher.log" powershell -NoProfile -Command "Get-Content -LiteralPath '%BASE%\logs\avex-watcher.log' -Tail 35"
if not exist "%BASE%\logs\avex-watcher.log" echo Noch kein Log vorhanden.
echo.
pause
goto menu

:pause
schtasks /Change /TN "%TASK%" /DISABLE
pause
goto menu

:resume
schtasks /Change /TN "%TASK%" /ENABLE
schtasks /Run /TN "%TASK%" >nul 2>&1
echo Automatik aktiviert und ein Lauf gestartet.
pause
goto menu

:remove
echo.
echo Die Windows-Aufgabe wird entfernt. Repo und Logs bleiben erhalten.
schtasks /Delete /TN "%TASK%" /F
pause
goto menu
