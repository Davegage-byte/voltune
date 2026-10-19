# Voltune Drive – Clean Cockpit v0.1

Stand: 19.10.2026

## Ziel

Eine **separate** Fahransicht unter `/voltune-dev/drive-clean.html`. Die ursprüngliche `index.html`, deren Styles und die Fahr-/Soundmodule bleiben unverändert. Die neue Seite übernimmt dieselbe Markup-/Script-Struktur der bisherigen Dev-App und ergänzt:

- Kompakten Fahrbildschirm mit übergroßer **Geschwindigkeit in km/h**, **virtuellem Gang**, **Drehzahl in RPM** und einer RPM-Füllstandsanzeige.
- Zwei dynamische, farblich getrennte Balken für **Beschleunigung** und **Verzögerung/Reku** auf Basis derselben bestehenden Beschleunigungswerte in m/s². Die Balken sättigen ab 4 m/s², die Zahl bleibt korrekt auch darüber.
- Dezenten visuellen Gangwechselimpuls ohne Audiomodifikation.
- Die **bestehende linke Bedienleiste** bleibt vollständig mit GPS/Start, Stop, Stumm, Launch, Fahrmodus (Normal/Sport/Wahnsinn), Gänge, Dynamik, Animationen, Theme und Debug erhalten.
- **Master-Lautstärke stets sichtbar** oben rechts im Cockpit; optionaler kleiner Demo-Knopf und ein Link zurück zur klassischen Voltune-Ansicht.
- Sämtliche Klang-, Fahr- und Physical-Einstellungen standardmäßig **versteckt**; über „Einstellungen“ bei Bedarf erreichbar.

## Dateien

- `drive-clean.html`: Abgezweigte, separate Einstiegsseite mit zusätzlichen Cockpit-Elementen und derselben bestehenden Voltune-Boot-Reihenfolge. Lädt `css/drive-clean.css` sowie `js/drive-clean.js` **nach** `js/app.js`. Die duplizierte Seite ist bewusst zunächst ein Prototyp; später könnte das gemeinsame Shell-Markup ausgelagert werden.
- `css/drive-clean.css`: Unaufdringliches responsives Fahrzeug-Layout, voller Desktop-/Tesla-Bildschirm abzüglich linker Leiste, auf Smartphones gestapelte Panels. Einstellungen als einklappbarer, per Escape schließbarer Bereich.
- `js/drive-clean.js`: Präsentationsadapter. Verschiebt die **echten** Master- und Demo-DOM-Elemente samt vorhandenen Event-Listenern. Liest nur die bestehenden Elemente `#speed`, `#gearDisplay`, `#rpmDisplay`, `#accel`, `#runStatus` sowie den gewählten Fahrmodus. Ein `MutationObserver` aktualisiert Cockpitwerte, ohne zusätzliche GPS-Listener, AudioContext oder Getrieberechnung.

## Technische Leitplanken

- Die eigentliche Soundengine, GPS-Qualitätsprüfung, virtuellen Schaltpunkte, Audio-Limiter und gespeicherten Voreinstellungen bleiben exakt wie in der normalen Voltune-Dev-App. Beide Seiten verwenden denselben bestehenden Storage-Key und können dieselben gespeicherten Einstellungen nutzen.
- Die alte Seitenleiste bleibt funktional und identisch, damit die neue Fahransicht ohne zusätzliche Bedienelement-Duplikate getestet werden kann.
- Ein Smartphone kann wegen des schmaleren Displays eine andere Anordnung erhalten; im Tesla-Browser muss die tatsächliche Darstellung noch optisch geprüft werden.
- Bereits implementierte Launch-Darstellung und Hintergrundsound laufen weiter über die vorhandenen Module.

## Tests

- DOM-Validierung: 172 einzigartige IDs, **keine** fehlenden `app.js`-Referenzen.
- Syntax von `drive-clean.js` validiert.
- Mock mit 75 km/h, 3.250 RPM, Gang 4 und +1,75 m/s²: korrekte Anzeigen, Beschleunigungsbalken auf 43,8 %.
- Anschließende Werte 53 km/h, Gang 3, −3,00 m/s²: Rekuperationsbalken auf 75 %, Beschleunigungsbalken leer.
- Einstellungen öffnen/schließen; vorhandener Lautstärkeregler und Demo-Knopf werden verschoben und **nicht** neu erstellt.

**Offen:** Sichtprüfung mit dem echten Tesla-Display, Verhalten des Fahrbildschirms während echter GPS-Fahrt sowie Feedback zu Größe, Dichte und Farben.
