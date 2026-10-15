# Voltune Physical Events Lab v0.1 – Schalten und Schubknallen

## Bestandsschutz

Die produktive Voltune-App (einschließlich alter DSG-, Schubknall-, WAV/MP3-Sample-Logik), die Physical Engine v0.1 bis v0.4 und sämtliche bisherige Soundprofile werden **nicht verändert**.

Neue isolierte Dateien:
- physical-events-lab-v1.html
- js/physical-events-worklet-v1.js

Testseite:
https://davegage-byte.github.io/voltune/voltune-dev/physical-events-lab-v1.html

## Warum neu entwickeln?

In der alten VoltuneAudio-Engine beruhen der selbst synthetisierte DSG-Schalteffekt und Schubknaller maßgeblich auf eigenständigen Sägezahn-Oszillatoren mit Frequenzrampen, ergänzt um Filter/Rauschen. Dies kann nach zusätzlich ausgelösten Sounds statt nach einer kurzen Veränderung des laufenden Motors klingen.

Im neuen Hörlabor:
- Die eigentliche Klangquelle ist das unveränderte **Physical-Engine-v0.4-Worklet**.
- Davor bzw. danach liegen ein optionaler **AMG-Hochtonfilter** und das neue **Event-Worklet**, das den Motorsound bei Schaltvorgängen beeinflusst.
- Hochschalten: ca. 180 ms kurze, geglättete Drehmoment-/Pegelunterbrechung mit einem mechanisch-exhaustiven Druckereignis; die HTML-Testoberfläche senkt kurz Last und danach die virtuelle Drehzahl.
- Runterschalten: anderer Klangansatz mit simuliertem Zwischengas/Drehzahlanstieg und geringerem Abgasdruckimpuls.
- Schubknallen: 2–6 unregelmäßig verteilte, abklingende Druckimpulse; Resonatoren und Echo als virtueller Abgastrakt. Keine Sägezahn- oder Sinusoszillatoren in diesem Worklet, keine geladenen Audiodateien.
- Drei Regler: Schalthärte, Abgasimpuls-Stärke, Auspuffdämpfung. Echtzeit-A/B durch Worklet-Bypass.
- Fahrsequenz: kurze Leerlauf-, Beschleunigungs-, Hochschalt-, Schub- und Rückschaltphasen. Dient nur zum Hörtest, kein GPS-/Fahrzeugdaten-Sensor.
- AMG-Hochtonkorrektur (neu im Labor): optionaler WebAudio-HighShelf-Filter ab 1,2 kHz, 0–11 dB Dämpfung (Startwert 55 % => etwa -6 dB). **Die Basisdateien des AMG-v0.4-Profils bleiben unberührt.**

## Technische Verifikation

- Neue Event-Worklet-Sampleausgabe simuliert bei 44,1/48/96 kHz: endlich, mit begrenzten Spitzen und kleinem Gleichanteil.
- Separat für Up-/Downshift/Overrun: messbare Signaländerung gegenüber Event-Bypass.
- Bypass-Ausgang in der isolierten Audioprüfung **sampleidentisch** zum Eingang.
- DOM-Elemente und Inline-JavaScript der Laborwebseite syntaktisch geprüft.
- Keine Hörprüfung am Tesla, keine physikalische Messkalibrierung. Der tatsächliche Klang kann noch unbefriedigend sein.

## Fachliche Annäherung

Bei DSG/DCT kann eine kurze Zünd-/Drehmomentunterbrechung zusammen mit Abgas-Nachreaktionen ein Schaltgeräusch erzeugen. Schubknallphänomene hängen von Nachverbrennung, Last-/Drehzahlzustand und dem Abgasweg ab. Daher sollten **Ereignisauslösung**, **Motorreaktion** und **akustische Abgasreaktion** getrennt parametriert werden; sie sollten nicht ausschließlich aus Tonhöhensweeps entstehen.

Referenzen:
- https://docs.beamng.com/modding/vehicle/sections/sounds/engine_audio/
- https://www.fcpeuro.com/blog/the-definitive-guide-to-the-dsg-transmission

## Nächste Schritte

1. Hörtest mit den Tasten Hoch-/Runterschalten und Schubknallen am Kopfhörer und später über das Auto, immer Bedienung im Stand.
2. Klangqualitätsfeedback (zu synthetisch, zu dumpf, zu knallig, Länge zu groß etc.) vor weiteren DSP-Änderungen sammeln.
3. Wenn überzeugend, als optionalen Event-Layer mit vorhandenen BOV-/DSG-/Schub-Einstellungen integrieren, ohne die alte Engine zu löschen.
4. Automatische Auslösung später an überprüfte, robuste Gang-/Lastwechselereignisse knüpfen; **nicht** bei jedem GPS-Aussetzer oder bei jedem minimalen Lastwechsel.
