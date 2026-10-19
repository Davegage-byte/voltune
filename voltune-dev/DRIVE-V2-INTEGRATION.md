# Voltune Drive 2.0 · Instrument Cockpit
Stand: 19. Oktober 2026

## Stand der Umsetzung

Die frühere separate `drive-clean.html` verwendet jetzt das neue, bewusst reduzierte Voltune-Drive-2.0-Design als **eigenständige Fahransicht**. Die reguläre `index.html` und die ursprüngliche `js/app.js` bleiben unberührt.

### Anordnung
- Zentrale, große Geschwindigkeitszahl in kreisförmigem Kombiinstrument; darunter virtueller Gang und aktuelle RPM.
- Drei animierte Instrumentenbögen: RPM, Beschleunigung und Verzögerung.
- Linke Seite: G-Meter und geschätzte elektrische Antriebsleistung (kW + PS).
- Rechte Seite: Beschleunigungs-/Verzögerungswerte plus kleine Fahrzeugsilhouette.
- Oben: Logo, GPS-/Audio-Status, Uhrzeit, Theme-Knopf (über bisherigen Theme-Schalter) und Einstellungen.
- Unten: Start, Stop, Stumm, Fahrmodi, direkter Launch und Demo sowie **Touch-/Maus-/Tastatur-Masterbalken** mit live reagierendem VU-Meter.
- Die alte Seitenleiste bleibt **technisch im DOM**, ist aber auf dieser separaten Seite visuell ausgeblendet. Alle bestehenden Original-Knöpfe, Speichermechanismen und Listener sind noch vorhanden. Neue Buttons leiten Klicks synchron an sie weiter.
- Klang- und Fahreinstellungen sind hinter dem ausblendbaren Settings-Overlay erreichbar. ESC, Hintergrundklick und Schließen-Knopf schließen es.
- Vollständiger Light-/Dark-/Auto-Theme-Support über denselben Theme-Modus wie die reguläre Dev-App.

### Start-Erlebnis
Der große Start-Knopf ist im Zentrum sichtbar, solange die Audioengine aus ist.
Beim Anklicken wird unmittelbar der vorhandene GPS-Startknopf aufgerufen (keine asynchrone Verzögerung vor dem AudioContext-Beginn). Die Schaltfläche pulsiert kurz. Sobald der bestehende Startvorgang die laufende Audioengine bestätigt, verschwinden Button und Hintergrund mit Fade/Scale, die Instrumentenbögen führen einen rund 1,38 Sekunden langen Selbsttest durch. Danach zeigt das Cockpit wieder die realen GPS-/Getriebe-/Drehzahlwerte. Bei Startfehler wird der Startknopf erneut angeboten. Die Animation wird bei `prefers-reduced-motion` minimiert.

### Leistungsschätzung (keine Tesla-Messung)
Für die grobe mechanische/equivalente Antriebsleistungsabschätzung wird gerechnet:

`v = speedKmh / 3.6`
`F = m*a + m*g*Cr + 0.5*rho*Cd*A*v²`
`P_rad = F*v / 1000`

Annahmen: `m=1950 kg` inklusive Fahrerin/Fahrer, `Cr=0.011`, `rho=1.225 kg/m³`, `Cd=0.23`, `A=2.22 m²`. Positive elektrische Vergleichsleistung `P = P_rad / 0.91`. Negative Schätzung `P = P_rad * 0.72` (brutto angenäherte mögliche Verzögerungsleistung, **nicht** verifizierte Akku-Reku). PS werden aus kW mit `1.35962` berechnet. Null Geschwindigkeit ergibt Null mechanische Leistung, auch wenn das Fahrzeug Drehmoment erzeugt.

Ein Korrekturfaktor `0.50–1.50` in den versteckten Einstellungen (`voltune.drive.powerFactor.v1`, Startwert `1.00`) erlaubt den späteren Abgleich mit echten Tesla-kW-Werten. Er beeinflusst **nur diese UI-Anzeige**, niemals Sound oder Fahrlogik.

### G-Sensor
Längs-G ist aus dem bestehenden GPS-Beschleunigungswert `a / 9.80665` abgeleitet und im Kreisdiagramm sichtbar. Für Quer-G gibt es derzeit weder eine vertrauenswürdige Seitenbeschleunigung noch eine ausreichende GPS-Bearing-Zeitreihe im bestehenden Datenadapter. **Quer-G wird mit „—“ als nicht verfügbar gezeigt**, nicht als erfundener 0-G-Wert. Später ist eine separate, validierte Sensoranbindung möglich.

### Audio-VU
In `js/physical-audio.js` wurde **nur ein read-only AnalyserNode-Abgriff parallel zum bestehenden Audioausgang** hinzugefügt (nach dem finalen Limiter). Der ursprüngliche Output bleibt direkt mit `destination` verbunden; der Abgriff hat keine Verbindung zu einem zusätzlichen Lautsprecherausgang. `getOutputMeter()` gibt einen normierten RMS-Pegel von 0 bis 1 zurück. Bei Stumm, Stop oder ohne Context: 0.

Der Touch-Balken aktualisiert das bestehende `#volume`-Input und löst dessen originales `input`-Event aus. Damit bleiben Audio- und Storage-Routinen unangetastet. Tastatursteuerung: Pfeile 1 %, Page Up/Down 5 %, Home/End 0/100 %. Das VU-Signal wird nur bei Physical Engine als „LIVE-PEGEL“ gezeigt. Voltune Original hat derzeit keinen auslesbaren Analyser und erhält deshalb keine vorgetäuschte VU-Messung.

### Nicht angefasst
- `js/app.js`, `js/gps.js`, `js/drivetrain.js`, `js/audio.js`, `js/launch.js`
- Die bisherigen Vollbild-Beschleunigungs- und Verzögerungseffekte (`accelerationFx`-Canvas und bestehende FX-Logik).
- Bestehende Klangpresets, EQ, Kompressor, Schaltknalle, Filter und die -3-dB-Testabsenkung.

### Dateien
- `drive-clean.html` (überarbeitet), Link zur Fahransicht bleibt stabil.
- `css/drive-v2.css` (neu), `js/drive-v2.js` (neu).
- `js/physical-audio.js` (nur lesender VU-Abgriff).
- Vorherige `drive-clean.js` und `drive-clean.css` bleiben als frühere Konzeptdateien im Repository, werden aber von der Drive-2.0-Seite nicht mehr geladen.

### Prüfungen
- JavaScript-Syntax, 196 eindeutige HTML-IDs, alle bisherigen `app.js`-Referenzen weiterhin verfügbar.
- Start-Selbsttest, Fahrmoduswechsel, Start/Stop, Settings-Overlay, RPM (inklusive Tausenderpunkten), Geschwindigkeits-/Leistungsberechnung und Touch-Volume im isolierten DOM-Mock erfolgreich getestet.
- Original-Canvas für Vollbild-Effekte und Start-/Launch-/Engine-Skripte in der Seite vorhanden.
- Physical Engine mit gemocktem WebAudioContext gestartet: vier Worklets, ein AudioContext, exakt ein unveränderter Weg nach `destination` plus paralleler, read-only VU-Abgriff. Meter und Mute getestet.
- **Noch offen:** optische Sichtprüfung im echten Tesla-Browser, echtes GPS und subjektiver Sound-/Animations-Hörtest im Fahrzeug.
