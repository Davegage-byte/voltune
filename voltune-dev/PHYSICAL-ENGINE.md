# Voltune · Physical Engine Lab (experimentell)

## Grundsatz: bestehende Sounds dauerhaft behalten

Die neue Physical Engine ist eine **Erweiterung**, ausdrücklich **kein Ersatz** für VoltuneAudio.

Die folgenden bestehenden Dateien wurden für dieses Experiment NICHT verändert:
- voltune-dev/js/audio.js – bisherige Soundprofile, Grundtöne, Idle, Wankel, BOV, Schubknallen, DSG, etc.
- voltune-dev/js/drivetrain.js – bestehende Gang- und RPM-Simulation.
- voltune-dev/js/gps.js – bisherige GPS-/Beschleunigungslogik.
- voltune-dev/js/app.js, voltune-dev/index.html und sämtliche CSS-Dateien.

Alle bisherigen Profile müssen bei einer späteren Integration weiterhin **einzeln auswählbar, unabhängig nutzbar und klanglich unverändert** bleiben. Auch neue Presets sollen das alte Angebot nicht stillschweigend ersetzen.

## Neue Dateien

- physical-engine-lab.html: vollständig getrennte, mobile Hördemo.
- js/physical-engine-worklet.js: eigenständige, samplegenaue Erzeugung für den Browser-Audio-Rendering-Thread.

**Test-Link bei GitHub Pages:**

https://davegage-byte.github.io/voltune/voltune-dev/physical-engine-lab.html

Die Testseite ist absichtlich **nicht in den produktiven Soundweg** eingebunden. Sie wird per Klick gestartet, benötigt keine GPS-Daten und öffnet keine Audiodateien.

## Technikstand v0.1

- V8 Crossplane: acht Zündereignisse pro zwei Kurbelwellenumdrehungen; die Ereignisse werden auf zwei Abgasstränge verteilt.
- Reihenfünfzylinder: eigene Zündzahl und abweichende Impulsfolge.
- Beide Modelle: kurze Impulse, laufzeitbasierte Resonatoren, Klangfarbensteuerung, DC-Entfernung und Ausgangslimiter.
- EV: eigener Synthesezweig als **Platzhalter und experimenteller Klang**, **nicht** die bestehende Voltune-EV-Engine.
- Hybrid: Überlagerung eines Verbrenner- und EV-Zweigs; derzeit starre Mischung als Machbarkeitsprobe.
- Parameter: virtuelle Drehzahl, geschätzte Last, Klangfarbe, Lautstärke.
- 25-Sekunden-Demo für Hochdrehen, Schalten, Schubbetrieb und Rückkehr zum Idle.

### Keine Behauptung zur Klangtreue

Dies ist ein selbst entwickelter Algorithmus, **kein extrahierter oder nachgebauter proprietärer Rupteur-Quellcode**. Die Modelle sind physikalisch *inspiriert*, aber bisher nicht gegen echte Motoraufnahmen, Spektren oder Hörtests im Fahrzeug kalibriert.

## Ziele für kommende Versionen

1. V8 als **ein** besonders gutes, eigenständig entworfenes Verbrenner-Soundprofil ausarbeiten: Resonanzmessungen, Variation der Einzelschläge, lastabhängige Ansaugung/Auspuff, Psychoakustik.
2. Prüfen, wie die bestehende VoltuneDrivetrain Zustände wie Gang, RPM, Last und Lastwechsel liefern kann, **ohne** die alte Engine umzubauen.
3. Neue Audio-Engine in der Oberfläche **als zusätzlicher Typ** auswählbar machen, mit sauberem Start/Stop, ohne doppelten Audiomix und mit klarer Rückschaltmöglichkeit auf Legacy-Sounds.
4. Eigenständige EV-Motoren (nicht die alten ersetzen), inklusive tiefer Texturen, nichtrepetitiver Anteile, lastgekoppelter Körnung und langfristiger Hörverträglichkeit.
5. Frei einstellbares Hybrid-Modell mit Moduswechsel und weichem Überblenden.
6. Im Tesla bei Fahrt und mit Musik gegenhören: Dynamik, Lautstärke, Latenz, Verzerrung, Spektrum und Langezeittauglichkeit.

## Sicherheit und Testhinweise

- Test zuerst bei niedriger Lautstärke durchführen; die Klanglautheit variiert je nach Gerät.
- Nur im Stand bedienen. Während einer echten Fahrt keine Bildschirmsteuerung vornehmen.
- Browser benötigen HTTPS oder localhost für AudioWorklet; GitHub Pages erfüllt HTTPS.
- AudioWorklet kann je nach Fahrzeugbrowser/WebView fehlen. Ein Fehler in der experimentellen Seite darf die normale Voltune-App nicht beeinflussen.
- Simulation ist keine Messung echter Motordrehzahl oder Gaspedalstellung.

## Änderungsregel

Künftige Arbeiten an der Physical Engine zunächst nur in **neuen, separat benannten Modulen** vornehmen und mit Hörtests abnehmen. Erst danach optional über einen eigenen Auswahlpunkt in Voltune einbinden. **Legacy-Profile weder löschen noch durch geänderte Profile unter demselben Namen überschreiben.**
