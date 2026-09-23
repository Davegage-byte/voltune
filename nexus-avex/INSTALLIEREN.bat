@echo off
setlocal EnableExtensions
title AVEX NEXUS Collector - Installation

set "BASE=%LOCALAPPDATA%\AVEX-NEXUS"
set "ROOT=%BASE%\voltune"
set "VENV=%BASE%\venv"
set "TASK=AVEX NEXUS Collector"
set "REPO=https://github.com/Davegage-byte/voltune.git"

echo.
echo ==============================================
echo   AVEX NEXUS Collector 0.1.0-test
echo ==============================================
echo.

where git >nul 2>&1 || (
  echo [FEHLER] Git wurde nicht gefunden.
  echo Installiere Git fuer Windows und starte diese Datei danach erneut.
  pause
  exit /b 1
)

where python >nul 2>&1 || (
  echo [FEHLER] Python wurde nicht gefunden.
  echo Benoetigt wird Python 3.9 oder neuer.
  pause
  exit /b 1
)

for /f "tokens=2 delims= " %%V in ('python --version 2^>^&1') do set "PYVER=%%V"
echo Python: %PYVER%
git --version
echo.

if not exist "%BASE%" mkdir "%BASE%"

if exist "%ROOT%\.git" (
  echo Vorhandenes Collector-Repository gefunden.
  git -C "%ROOT%" fetch origin main
  git -C "%ROOT%" reset --hard origin/main
) else (
  echo Klone Voltune in den separaten Collector-Ordner ...
  git clone "%REPO%" "%ROOT%"
  if errorlevel 1 goto :error
)

if not exist "%VENV%\Scripts\python.exe" (
  echo Erzeuge isolierte Python-Umgebung ...
  python -m venv "%VENV%"
  if errorlevel 1 goto :error
)

echo Installiere Windows-Zeitzonendaten ...
"%VENV%\Scripts\python.exe" -m pip install --disable-pip-version-check --quiet --upgrade pip
"%VENV%\Scripts\python.exe" -m pip install --disable-pip-version-check --quiet tzdata
if errorlevel 1 goto :error

git -C "%ROOT%" config user.name "AVEX NEXUS"
git -C "%ROOT%" config user.email "avex-nexus@localhost"

echo.
echo Fuehre Parser-Test aus ...
pushd "%ROOT%"
"%VENV%\Scripts\python.exe" -m unittest discover -s tests -p "test_avex.py"
if errorlevel 1 (
  popd
  goto :error
)
popd

echo.
echo Fuehre einen lokalen AVEX-Test ohne GitHub-Push aus ...
"%VENV%\Scripts\python.exe" "%ROOT%\nexus-avex\avex_nexus_runner.py" --once --no-push
if errorlevel 2 goto :error

echo.
echo Pruefe GitHub-Schreibzugriff. Eventuell erscheint einmalig die GitHub-Anmeldung ...
git -C "%ROOT%" push --dry-run origin main
if errorlevel 1 (
  echo.
  echo [HINWEIS] Der lokale Abruf funktioniert, aber GitHub ist noch nicht angemeldet.
  echo Melde Git fuer dieses Windows-Konto bei GitHub an und starte INSTALLIEREN.bat erneut.
  pause
  exit /b 2
)

echo.
echo Richte Windows-Aufgabe alle 5 Minuten ein ...
schtasks /Create /TN "%TASK%" /SC MINUTE /MO 5 /TR "wscript.exe ^\"%ROOT%\nexus-avex\run_hidden.vbs^\"" /F >nul
if errorlevel 1 (
  echo [FEHLER] Windows-Aufgabe konnte nicht erstellt werden.
  echo Starte INSTALLIEREN.bat testweise als Administrator.
  pause
  exit /b 3
)

schtasks /Run /TN "%TASK%" >nul 2>&1

echo.
echo ==============================================
echo Installation fertig.
echo Abrufintervall: alle 5 Minuten
echo Repository: %ROOT%
echo Logs: %BASE%\logs\avex-watcher.log
echo Verwaltung: %ROOT%\nexus-avex\AVEX_NEXUS.bat
echo ==============================================
echo.
pause
exit /b 0

:error
echo.
echo [FEHLER] Installation/Test ist fehlgeschlagen.
echo Siehe die Ausgabe oben.
pause
exit /b 1
