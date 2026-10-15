# Voltune Physical Engine v0.3 – V4 / V6 / V12

## Bestandsschutz

- Produktive Voltune-App und Sounds bleiben unverändert.
- Physical Engine v0.1 und v0.2 inklusive Hybrid V8 bleiben unverändert.
- Neue Dateien werden separat hinzugefügt: `physical-engine-lab-v3.html` und `js/physical-engine-worklet-v3.js`.
- Neue v0.3-Worklet-Variante enthält die bisher vier v0.2-Profile. Audio-Sample-Vergleich mit der v0.2-Engine im identischen Szenario ist **bitgenau**.

## Testadressen

- v0.3: https://davegage-byte.github.io/voltune/voltune-dev/physical-engine-lab-v3.html
- v0.2 (bestehende Referenz): https://davegage-byte.github.io/voltune/voltune-dev/physical-engine-lab-v2.html
- Original-Voltune: https://davegage-byte.github.io/voltune/voltune-dev/index.html

## Neue experimentelle Motortypen

- **V4:** asymmetrische vier Zündungen pro 720° Kurbelwelle, relative Winkelintervalle 180°, 270°, 180°, 90°; zwei getrennte Abgaswege; markantes Leerlauf-Pulsieren.
- **V6:** gleichmäßige sechs Zündungen pro 720° auf zwei wechselnden Abgaswegen; mehr kräftiger Ansaug-/Druckcharakter als V12.
- **V12:** zwölf gleichmäßige Zündungen pro 720° auf zwei wechselnden Abgaswegen; engere Impulsfolge, ruhigerer Grundcharakter mit eigenem Mitteltonfilter und separaten Rohrresonanzen.

Der V4 ist ein absichtlich ungleichmäßig zündendes, **künstlerisches Soundmodell**, keine behauptete exakte Simulation eines konkreten Herstellers.

## Schwerpunkt: Stand, Beschleunigung, Verzögerung

Neu sind drei direkt auswählbare Hörtests:
1. **8 Sekunden Leerlauf**, ~800 U/min mit kleinen Schwankungen.
2. **12 Sekunden Gas & Lupfen**: zweimal deutliche Lastaufnahme und Lastwegnahme.
3. **25-Sekunden-Fahrt**: bisheriges Testprofil.

Für V4, V6 und V12:
- Motorlast steuert Pulsstärke und Resonanzenergie.
- Lastaufnahme/Drehzahlanstieg erzeugen zeitbegrenzte Ansaugkörnung und Druckanhebung.
- Schnelle Lastwegnahme führt zu kurzer Schub-/Abgas-Nachklangtextur, kein künstliches Dauer-Schubknallen.
- Im Leerlauf sind Zündstärken leicht unterschiedlich; V4 unruhiger als V6, V12 am glattesten.

Für bestehende V8-, R5-, EV- und Hybrid-Presets bleiben die Klangparameter aus v0.2 unverändert, auch wenn die zusätzlichen Demo-Schaltflächen zur Verfügung stehen.

## Technischer Status

AudioWorklet: isolierte DSP-Simulation für V4/V6/V12 bei 44,1 / 48 / 96 kHz; auf endliche Samples, RMS/DC und Clipping geprüft. Alle neun Kombinationen bestanden. Bestehende vier Presets gegen v0.2 samplegenau geprüft.

Eine **akustische Qualitätsbewertung im echten Tesla** steht noch aus. Keine GPS-/Fahrzeuganbindung in dieser v0.3-Demo. Bitte mit reduzierter Lautstärke testen und im Fahrzeug nur im Stand bedienen.

### Änderungsregel

Weder Original-Engine noch frühere Labs überschreiben. Verbesserungen als neue, separat auswählbare Presets oder Laborversionen hinzufügen und anhand direkter Hörtests abnehmen.
