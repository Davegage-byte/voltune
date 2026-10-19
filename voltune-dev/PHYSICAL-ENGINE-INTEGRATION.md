# Voltune Physical Engine – Integration v1

Stand: 19.10.2026

## Ziel und Grundprinzip

Voltune Original und die im Tesla bewährte Physical Engine sind nun in der regulären Voltune-Dev-App \`index.html\` auswählbar. Beim Start ist **Voltune Original** voreingestellt. Der Legacy-Audiocode \`js/audio.js\` wurde nicht verändert.

### Architektur

- \`js/physical-audio.js\`: Neue Physical-Audioengine und Proxy-Router \`window.VoltuneAudio\`. Die Original-API bleibt als \`window.VoltuneOriginalAudio\` verfügbar. Nur die gewählte Engine läuft.
- \`js/drivetrain.js\`, \`js/gps.js\`: Gemeinsame Fahrlogik, gemeinsam berechnete virtuelle RPM, Gangwechsel und GPS. Keine zweite GPS-Positionsüberwachung und kein zweites Getriebe für Physical Engine.
- Physical Engine enthält das unveränderte Worklet \`physical-engine-worklet-v4.js\`, \`physical-presence-worklet-v1.js\`, \`physical-events-worklet-v3.js\` und \`physical-output-limiter-v1.js\`. Soundgraph: Motor -> AMG-Equalizer -> harmonische Präsenz -> Hybrid-Profil-Gain -> Event-Worklet -> Kompressor -> gemeinsames Gain -> Stereo-Peak-Limiter -> AudioContext.destination.
- Legacy-Events \`triggerShiftBurble\`, \`triggerDownshiftBlip\` werden im Router passend auf Physical-Events \`upshift\` und \`downshift\` abgebildet. Überrun/Schubknallen wird zusätzlich mit Sport-Empfindlichkeit und kurzem Beschleunigungs-Gedächtnis geprüft. Physikalische GPS-/Getriebelogik bleibt im Haupt-App-Controller.
- Wird \`requestAnimationFrame\` beim Minimieren des Tesla-Browsers angehalten, werden eintreffende GPS-Callbacks nach mindestens 300 ms ohne Renderframe direkt an die **Physical Engine** weitergegeben. In aktiven Frames bleibt der bestehende Voltune-Fahrloop zuständig.
- Muting, Mastervolume, Start/Stop und Launch greifen über das bestehende \`VoltuneAudio\`-Interface auf die gewählte Engine zu. Keine doppelte Wiedergabe.

### UI

Oben in den Sound-Reglern ist die **Soundengine-Auswahl**: Original oder Physical Engine. Bei Physical wird die Original-Soundprofilmatrix ausgeblendet, der Demo-Schnellstart bleibt sichtbar. Nur die für Legacy nötigen Klang-, BOV-, Flutter-, Legacy-Shift-/Overrun-Regler werden versteckt. Gemeinsam sichtbar bleiben Geschwindigkeit, Mastervolume, GPS, virtuelle Gänge, Getriebereichweite, maximale RPM und Schalt-RPM.

Physical Engine hat eigene Regler: Motorsound (10 Presets, Standard Hybrid EV + V8), EV-Anteil (nur Hybrid), AMG-Höhen (nur AMG), Motorpräsenz, Musik-Boost, Schalthärte, Schubknallen, Effekt-Vordergrund, Auspuffdämpfung, GPS-Effekt-Empfindlichkeit und Tesla-Medienmodus E. Testknöpfe für Up-/Downshift und Schubknall wurden ergänzt; nur im Stand benutzen.

Die Original- und Physical-Einstellungen werden unabhängig voneinander unter dem bestehenden \`voltune.settings.v1\`-Eintrag abgelegt. Ältere gespeicherte Einstellungen ohne Engine-Auswahl behalten automatisch Voltune Original.

### Tesla-Medienmodus E

Optional einschaltbarer 60-Sekunden-HTML-WAV-Medienanker (Lautstärke .025), während der Motorsound direkt vom WebAudio-Worklet läuft. So wurde der Tesla-Mini-Player im Fahrzeug und fortgesetzte Audioausgabe im Hintergrund bereits in der **separaten Diagnoseseite** bestätigt. Der Medienmodus pausiert die reguläre Tesla-Musik. Mittiger Klick auf das linke Scrollrad löst Play-/Pause-MediaSession aus und schaltet das Physical-Motorprofil weiter. Seitliches Next/Previous wird nicht als verfügbar vorausgesetzt.

Der Medienanker startet synchron im Nutzerklick beim Start der gewählten Engine – **nachträgliches Aktivieren per Regler wird erst nach Neustart des Sounds wirksam**. Bei Fehlern soll der normale direkte WebAudio-Sound weiterlaufen.

### Validierung

- Syntaktikprüfungen für \`index.html\`, \`js/app.js\`, \`js/physical-audio.js\` und alle vier Worklets, eindeutige DOM IDs, alle \`getElementById\`-Verweise.
- Simulierter Legacy-Start → Enginewechsel → Physical-Start mit synchronem Medienanker → RPM-/Shift-Event → Scrollradklick → Stumm → Rückwechsel zur Original-Engine → Original-Start. Ergebnis: alter Audiogenerator wird gestoppt, Physical startet mit genau einem Worklet-Graphen, MediaSession-Klick ändert Profil, HTML-Medienanker wird beim Rückwechsel entfernt und alter Audiogenerator ist wieder startbar.
- Kein echter Tesla-Haupt-App-Fahrtest bei der Code-Erstellung: zuerst im Stand testen, später GPS und Hintergrundbetrieb. Der direkte Tesla-Sound der Physical Engine war zuvor separat bereits erfolgreich.

### Abgrenzung / spätere Verbesserungen

- Vorherige Sounds/Labore sind als Referenz verfügbar.
- Ein sofortiges, unterbrechungsfreies *Crossfade* beim Umschalten der gesamten Engine wurde **noch nicht** umgesetzt: Die Audioengine wird beendet und die neue gestartet. GPS bleibt dabei aktiv.
- Die Debugwerte Base/Invert/Drive/Reku sind derzeit Legacy-spezifisch. Sie sollen nicht als Physical-Frequenzdiagnose interpretiert werden.
- Künftige Tests: erneuter Hörtest mit der neuen Integration (Lautstärke, dynamische Schalt-/Schub-Effekte, Lenkrad-Klick, GPS im Hintergrund) und Sichtung auffälliger Gangwechselanzahlen im Fahrbericht.
