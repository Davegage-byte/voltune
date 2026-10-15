# Voltune – GPS-Fahrtest für Physical Engine + Events (Stand 15.10.2026)

## Empfehlung

Für den ersten Straßenhörtest wird **Voltunes vorhandene GPS- und Getriebelogik in eine separate Soundlabor-Webseite eingebunden**, anstatt experimentelle Sounds in die normale Voltune-Dev-Anwendung zu integrieren. So bleiben produktive Funktionen und ältere Klangprofile geschützt; später kann ein gutes Klangprofil optional in Voltune-Dev integriert werden.

## Links

- **GPS-Fahrtest:** https://davegage-byte.github.io/voltune/voltune-dev/physical-events-live-v1.html
- **Manuelle Effektdemo:** https://davegage-byte.github.io/voltune/voltune-dev/physical-events-lab-v1.html
- **Bisherige Voltune-App:** https://davegage-byte.github.io/voltune/voltune-dev/index.html

## Einbau ohne Änderungen an Original-Sensorlogik

Unverändert importiert:
- `js/gps.js` — Standort, Geschwindigkeit, Kurzzeitbeschleunigung, Genauigkeit, Update-Rate
- `js/drivetrain.js` — virtuelle Drehzahl, Gänge, Schaltziele
- `js/physical-engine-worklet-v4.js` — 10 Presets inklusive Hybrid EV + V8

Neu:
- `js/physical-events-worklet-v2.js` — getrennte Effekt-Engine mit echt stillgelegtem 0/0-Pfad
- `physical-events-live-v1.html` — Live-Hörlabor inkl. GPS-Schalt-/Schub-Automatik

Effekt-Prozent:
- 0 % = kein zusätzlicher Effekt.
- **50 % = genau der vorherige dezente Effektpegel** (Audio-Rohsignal bei identischen Parametern nach Einschwingen samplegleich zur alten Event-Engine geprüft).
- 100 % = absichtlich extremere Impulse/Schalthärte, Ausgang weiterhin begrenzt.
- Schalthärte und Abgasimpulse haben getrennte Skalen; Dämpfung bleibt nur eine Klangfarben-Einstellung.
- Die manuelle Eventseite wurde ebenfalls auf diese 50-%-Mitte umgestellt.

## Live-Verhalten

- Benutzer startet Sound und GPS explizit mit einem Klick auf „Live-Fahrt starten“. Browser fragt bei Bedarf nach Standortfreigabe.
- Normale GPS-Werte aktualisieren Motor-RPM/virtuelle Last. 6.7-Hz-GPS ist ausreichend als Befehlsquelle zur AudioWorklet-Synthese; das Audiorendering erfolgt weiterhin viel schneller im Worklet.
- Echtes Pedal, CAN-Daten und Motorlast sind **nicht vorhanden**; Last wird nur heuristisch aus GPS-Beschleunigung berechnet.
- Virtuelle Gangwechsel werden per `VoltuneDrivetrain.update()` erkannt. Nur bei vertrauenswürdigem GPS, Mindestgeschwindigkeit und Sperrzeit wird ein passendes Event ausgelöst.
- Schubknallen: nur nach stärkerem Lastabfall/Beschleunigungswechsel, ausreichender Geschwindigkeit und Sperrzeit, um GPS-Jitter nicht ständig vertonen.
- GPS-Genauigkeit maximal 45 m, Update-Rate 0.8–30 Hz und Geschwindigkeitssprung plausibel; ungültige Werte verursachen **keine automatischen Effekte**.
- Bei länger als 4 Sekunden ungültigem GPS Warnstatus; automatisches Event-Triggering bleibt pausiert.
- Checkboxen zur selektiven Deaktivierung automatischer Schaltungen/Schubknaller.
- Bei fehlender GPS-Erlaubnis weiterhin manuelle Testoberfläche nutzbar.

## Sicherheit / Grenzen

**Vor dem Losfahren** Motor, Lautstärke und Effektstärken einstellen, GPS starten und Standort erlauben. **Während der Fahrt nicht am Browser bedienen.** Eine beifahrende Person kann ggf. Einstellungen bedienen.

Weder Browser-GPS noch der virtuelle Gangwechsel ist ein direkter Messwert aus dem Tesla-Antriebsstrang. GPS-Timeouts, Browser-Hintergrundbeschränkungen oder fehlende Standortfreigabe können Hörqualität und Automatik einschränken.

Für einen ersten Praxisversuch genügen Kopfhörer-/Standtest und die live erfassten Daten; die Klangqualität ist noch unbewiesen.

## Validierung

- Event-Worklet v2 bei 44.1 / 48 / 96 kHz mit 0/50/100 %, ohne ungültige Samples.
- 0/0-Event-Pegel ist im reinen Worklet-Test samplegleich zum Eingang.
- 50 % entspricht der vorherigen v1-Engine (maximale Sampleabweichung im stabilen Zustand = 0).
- Live-Seite: Inline-JS kompiliert, alle Element-IDs aufgelöst, DOM-/Audio-/GPS-Startablauf mit simulierten Werten ausgeführt.
- Originale `VoltuneDrivetrain`-Ganglogik mit einer simulierten Beschleunigungs-/Verzögerungssequenz überprüft.
- **Noch kein echter Browser-/Tesla-Hörtest**, kein behaupteter Einsatz mit echten GPS-Werten.

## Weitere Arbeit

Bei überzeugendem Hörtest die neuen Event- und Motorsound-Arten als **zusätzliche auswählbare Engine** in der produktiven Voltune-Dev-App integrieren; die alten Sounds inklusive Wankel und bisherigen Schalt-/Schub-Effekten dauerhaft auswählbar lassen.
