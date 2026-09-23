AVEX NEXUS Collector 0.1.0-test
=================================

Zweck
-----
Diese Windows-Testversion ruft die vorhandenen AVEX-Daten auf dem NEXUS-Laptop
alle 5 Minuten ab und pusht die erzeugten JSON-/Historien-Dateien in das
Voltune-GitHub-Repository.

Sie ersetzt NICHT update_avex.py. Der bestehende Scraper bleibt die einzige
Datenlogik. Der NEXUS-Collector kümmert sich nur um:
- Zeitsteuerung
- Wiederholungsversuche
- Git-Synchronisierung
- Commit/Push
- Lock gegen parallele Läufe
- lokale Logs und Health-Status

Installation
------------
1. Git fuer Windows und Python 3.9+ muessen installiert sein.
2. INSTALLIEREN.bat doppelklicken.
3. Falls GitHub beim ersten Push eine Anmeldung verlangt, normal im
   Git Credential Manager anmelden.
4. Die Installation legt einen separaten Clone an:
   %LOCALAPPDATA%\AVEX-NEXUS\voltune
5. Python-Abhaengigkeiten liegen getrennt in:
   %LOCALAPPDATA%\AVEX-NEXUS\venv
6. Danach wird die Windows-Aufgabe "AVEX NEXUS Collector" ueber PowerShell angelegt.\n   Sie laeuft im Benutzerkontext des angemeldeten NEXUS-Kontos.

Betrieb
-------
Die Windows-Aufgabe startet alle 5 Minuten einen versteckten Einzellauf.
Der Lauf beendet sich danach komplett. Es bleibt kein Konsolenfenster offen.

Verwaltung
----------
AVEX_NEXUS.bat bietet:
1  Jetzt abrufen + pushen
2  Nur lokal testen
3  Status und Log anzeigen
4  Automatik pausieren
5  Automatik fortsetzen
6  Windows-Aufgabe entfernen

Logs
----
%LOCALAPPDATA%\AVEX-NEXUS\logs\avex-watcher.log

Health-Datei
------------
%LOCALAPPDATA%\AVEX-NEXUS\health.json

Fehlerverhalten
---------------
- Bis zu 3 Scrape-Versuche pro Lauf.
- Parallele Laeufe werden per Lock verhindert.
- Bei einem Push-Konflikt wird main neu geladen, der Scrape erneut ausgefuehrt
  und einmal erneut gepusht.
- WLAN-/GitHub-Fehler werden geloggt und der naechste 5-Minuten-Lauf versucht
  es erneut.
- Keine Tokens oder Passwoerter werden in den Collector-Dateien gespeichert.

Testhinweis
-----------
Diese Version ist bewusst als 0.1.0-test gedacht. Fuer einige Tage Testbetrieb
ist der derzeitige Commit-pro-Abruf-Ansatz okay. Fuer Dauerbetrieb sollten wir
spaeter die Git-Historie/Datenspeicherung optimieren, damit nicht dauerhaft
hunderte Commits pro Tag entstehen.
