# Voltune Physical Engine v0.4 – reale Motorvorbilder, eigene Klangmodelle

## Grundregel: Bestand vollständig erhalten

Die neue Engine ist ein eigenständiger Hörprototyp und ersetzt weder die reguläre Voltune-App noch die Physikalischen Soundlabor-Versionen v0.1, v0.2 oder v0.3.

**Die Dateien der älteren Engines wurden nicht modifiziert.** Der neue AudioWorklet-Prozessor trägt die Versionskennung v4.

- Original Voltune: https://davegage-byte.github.io/voltune/voltune-dev/index.html
- v0.3 Vergleich: https://davegage-byte.github.io/voltune/voltune-dev/physical-engine-lab-v3.html
- v0.4: https://davegage-byte.github.io/voltune/voltune-dev/physical-engine-lab-v4.html

## Hintergrund – Korrektur der Zylinder

1. Golf VII GTI: 2,0-Liter-Reihenvierzylinder (R4/I4). Hersteller: https://www.volkswagen-newsroom.com/en/vehicle-data-golf-7-gti-profile-20033
2. Mercedes-AMG C63 Modelljahr 2017: 4,0-Liter-V8-Biturbo, nicht V6. Hersteller: https://media.mbusa.com/news/the-new-2017-mercedes-amg-c63-coupe-the-sportiest-c-class-ever
3. Ferrari 812 Superfast: 6,5-Liter-V12-Saugmotor mit sportlich hohen Drehzahlen. Hersteller: https://www.ferrari.com/en-US/corporate/articles/the-ferrari-812-superfast-the-new-extreme-performance-v12-berlinetta
4. Lamborghini Aventador: V12-Saugmotor, 6,5 Liter. Hersteller: https://www.lamborghini.com/en-en/history/aventador-lp-780-4-ultimae

## Neu in v0.4

Folgende **zusätzliche** Presets wurden angelegt:

- **R4 · Golf 7 GTI inspiriert** (`gti`): vier gleichmäßig arbeitende Zylinder pro 720°, gemeinsamer, komprimiert wirkender Abgasweg, kernigere Ansauglast und rauerer Motorcharakter.
- **V8 Biturbo · C63 AMG inspiriert** (`amg`): acht Zylinder, unregelmäßige Crossplane-Bankimpulse, tiefere Abgasresonanzen, deutliche Lastwechsel und warmes tieffrequentes Volumen.
- **V12 Italia · Ferrari/Lamborghini inspiriert** (`italia`): zwölf gleichmäßig verteilte Zündungen, helle Ansaug-/Abgasresonanzen und ein unter Last/Drehzahl wachsender, **regelbarer trompetenartiger** Charakter.

Bei diesen drei Klangmodellen werden zusätzliche Resonatoren **durch die Zündimpulse** angeregt. Es handelt sich also nicht um einen zusätzlich überlagerten Endlos-Sinus-Synthesizer.

**Das Ziel ist ein eigenständiger, wiedererkennbarer Sound und keine behauptete akustische 1:1-Kopie**. Auch die V12-Klänge von Ferrari und Lamborghini unterscheiden sich im Original; der Prototyp ist eine gemeinsame italienische Klanginterpretation.

## Unveränderte Bestandspresets

`v4`, `v6`, `v12`, `v8`, `i5`, `ev`, `hybrid`.

Für diese sieben Profile ergibt der Audio-Sample-Abgleich zwischen v0.3- und v0.4-Prozessor beim gleichen Szenario eine maximale absolute Abweichung von **0**. Auch die vorherigen Webseiten bleiben separat aufrufbar.

## Testkontrollen

- Leerlauf: 8 Sekunden.
- Beschleunigen / Gas weg: 12 Sekunden.
- Testfahrt: 25 Sekunden.
- Einstellbar: RPM, Last, Auspuff/Klangfarbe, Lautstärke.
- Zusätzlich nur beim Hybrid: EV-Anteil.
- Zusätzlich nur beim neuen V12 Italia: **Trompetencharakter 0–100 %**, Startwert 60 %.

Der V12-Trompetenregler wurde auch numerisch geprüft: unterschiedliche Stellung erzeugt eine messbar unterschiedliche Wellenform bei 7.400 RPM unter Last.

## Teststatus & nächste Schritte

Die neuen drei Motormodelle wurden als isolierte AudioWorklet-DSP-Simulation bei 44,1 kHz, 48 kHz und 96 kHz getestet: nur endliche Samples, keine volle Sample-Amplitude über 1, geringer DC-Anteil. **Dies ersetzt keinen echten Hörtest.**

Die aktuelle Demo verwendet **keine GPS- oder CAN-/Fahrzeugdaten** und keine Originalsound-Dateien. Im Fahrzeug die Testoberfläche nur im Stand bedienen. Als nächstes über echte Lautsprecher beurteilen und getrennt Standklang, Beschleunigung, Verzögerung und Dauerklang feinabstimmen.

## Regel für künftige Weiterentwicklungen

Neue Versionen mit eigenen Dateien erstellen; erfolgreiche frühere Profile nie still überschreiben. Geplante Integration in produktive Voltune-App erst nach bewusstem A/B-Abgleich und mit weiterhin auswählbarem Legacy-Sound.
