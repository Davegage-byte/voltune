# Voltune Physical Engine · v0.2 Hörfeedback und A/B

## Bestandsregel (unverändert)

Alle bisherigen Voltune-Soundprofile sowie die Physical Engine v0.1 bleiben vorhanden, vollständig nutzbar und für A/B-Vergleiche erreichbar. Für v0.2 wurden zwei weitere Dateien angelegt; keine produktive Audio-Datei und keine v0.1-Datei wird überschrieben.

- Normale Voltune-App: https://davegage-byte.github.io/voltune/voltune-dev/index.html
- Physical Engine v0.1: https://davegage-byte.github.io/voltune/voltune-dev/physical-engine-lab.html
- Physical Engine v0.2: https://davegage-byte.github.io/voltune/voltune-dev/physical-engine-lab-v2.html

## Hörfeedback am 15.10.2026

- V8 Crossplane: klingt noch unnatürlich, aber Potential; niedrige Frequenzen gefallen.
- Reihenfünfzylinder: noch nicht gut nutzbar, aber Potential.
- EV: obere Drehzahl klingt wie einfacher Synth; noch nicht gut.
- Hybrid V8: bisher am besten, weil der EV-Anteil untergeht und nicht wie einfacher Synth wirkt.

## Änderungen in v0.2

- Verbrenner: Zündungsimpulse mit schnellem und langsamem Druckverlauf statt breitbandiger Sample-Rauschmodulation.
- V8: getrennte Crossplane-Bankereignisse, warme Tief-/Mitteltonschichten und gedämpfte Resonanzen.
- R5: gleiche fünf Zündereignisse auf beide virtuellen Abgaskanäle statt künstlich wechselnder Gruppen.
- EV: tiefere Rotorfrequenzen, deutlich schwächere hohe Harmonische, lastgekoppelte elektrische Körnung.
- Hybrid: V8 dominiert; EV-Lautheit mit Schieberegler fein einstellbar (Start 25 %).
- Am Ausgang: DC-Sperre nach Sättigung zur Vermeidung von Gleichanteilen.
- Performance: keine temporären Arrays im Audio-Sample-Loop; Verarbeitung ausschließlich in separatem AudioWorklet.
- Virtuelle Testfahrt: weiterhin 25 Sekunden; weiterhin **keine reale GPS-Kopplung**.

**Einschränkung:** Die neue Klangqualität muss der Nutzer im Browser/Kopfhörer/Tesla anhören und beurteilen. Numerische Tests auf stabile Audiowerte sind kein Ersatz für einen Hörtest und keine physikalische Motor-Messkalibrierung.

## Neue Dateien

- physical-engine-lab-v2.html
- js/physical-engine-worklet-v2.js

## Tests

Isoliertes JavaScript-Simulationssetup (Fake-AudioWorkletProcessor) für 44,1, 48 und 96 kHz, je alle vier Presets, simulierte RPM-Änderungen und endliche Stereo-Ausgabe. Ergebnis: keine NaN/Infinity, keine Sample-Amplitude über 1, Ausgangs-DC innerhalb ±0,03. Ein tatsächlicher Audio-/Browser-Hörtest bleibt ausstehend.

## Weiterentwicklung

1. Nutzerbewertung V8 / R5 / EV / Hybrid gegen v0.1 einholen.
2. Ein gutes Verbrenner-Modell herausarbeiten, dann erst mit der bestehenden Drehzahl-/Last-/Ganglogik koppeln.
3. Hybrid-/EV-Klangqualität langfristig ohne piepende Synth-Stimmen verbessern.
4. Bestehende Soundklassen **nie** ersetzen oder still umdefinieren.

