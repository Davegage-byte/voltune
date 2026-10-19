# Voltune Physical Engine – Integration v1

Stand: 19.10.2026

## Ziel und Grundprinzip

Voltune Original und die im Tesla bewährte Physical Engine sind nun in der regulären Voltune-Dev-App \`index.html\` auswählbar. Für **Erstbesucher ohne gespeicherte Einstellungen** ist **Physical Engine / Hybrid EV + V8** vorausgewählt; gespeicherte Engine- und Reglerwerte haben Vorrang. Der Legacy-Audiocode \`js/audio.js\` wurde nicht verändert.

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


## Neue Beschleunigungsdynamik (19.10.2026)

Der Regler **„Beschleunigungsdynamik“** steht innerhalb von Physical Engine bei den anderen neuen Motorreglern. \`physicalAccelDynamics\` hat einen Bereich von **0 bis 12 dB**, Standard **6 dB**. Er wird live und dauerhaft als \`physicalSettings.accelDynamics\` gespeichert; die Legacy-Engine bleibt unverändert.

Betriebslogik in \`js/physical-audio.js\`:

- Für die Dynamik wird die **bereits von Voltune berechnete Beschleunigung** genutzt; keine zusätzliche GPS-Anfrage, kein zusätzlicher Tachosignalfilter.
- Werte unter **+0,3 m/s²** gelten als Konstantfahrt. Ab ungefähr **+2,5 m/s²** wird die maximale Anhebung erreicht. Dazwischen eine sanfte Smoothstep-Kurve.
- Zeitliches Nachführen des Beschleunigungssignals mit ca. **160 ms beim Beschleunigen**, **520 ms beim Nachlassen** sowie **65 ms Audio-Gain-Automation** gegen hörbare Pegelsprünge.
- Der Reglerwert beschreibt die **Differenz** zwischen Konstantfahrt und kräftiger Beschleunigung: bei 6 dB etwa **−3 dB Konstantfahrt** und **+3 dB kräftige Beschleunigung** relativ zum vorherigen festen Pegel. Somit wird nicht einfach dauerhaft lauter gefahren. Bei 0 dB bleibt die Gain-Stufe exakt auf 1×.
- Eine zusätzliche Gain-Node steht **nach dem Event-Kompressor und vor Master-Gain sowie Peak-Limiter**. Sie beeinflusst den gesamten Physical-Sound, einschließlich transienter Effekte. Der vorhandene digitale Peak-Limiter bleibt unverändert; an seiner Pegelgrenze kann die hörbare Anhebung kleiner ausfallen als der Sollwert.
- Dynamik gilt ausschließlich für Physical Engine, unabhängig vom gewählten Motorprofil. Kein Einfluss auf Virtuell-RPM/Gänge/GPS/Launch.
- Beim Sound-Neustart und \`resetDrivingState()\` wird der Beschleunigungsspeicher zurückgesetzt. Bestehende Installationseinstellungen ohne Feld \`accelDynamics\` nutzen den UI-Standard 6 dB.

**Technischer Mock-Test:** bei 6 dB lief der Regelbereich von 0,7079× (Konstantfahrt) bis 1,4107× (kräftige Beschleunigung); Rückkehr nach 2,5 Sekunden auf ca. 0,7119×. Bei 0 dB exakt 1×, bei maximal 12 dB ca. 0,5× bis 2,0×. Ein paralleler Mute-Test bestätigte Master-Gain 0. Ein echter Hörtest im Tesla mit wechselnder Beschleunigung steht noch aus.

## Kurze Reglerhilfen und neue Erststart-Voreinstellung (19.10.2026)

- Jede Physical-Engine-Einstellung einschließlich der Motorauswahl, GPS-Empfindlichkeit, Effekttesttasten und des Tesla-Medienmodus hat direkt darunter **einen kurzen verständlichen Hilfesatz**. Der lange Hilfetext zur Beschleunigungsdynamik wurde auf einen Satz gekürzt.
- Die vorhandenen Original-Regler und gemeinsamen Geschwindigkeits-/Getriebe-/Lautstärkeregler erhielten ebenfalls kurze, klarere Erklärungen; Schriftgröße und Lesbarkeit der Hinweise wurden verbessert.
- **Neu ohne gespeicherte Voltune-Einstellungen:** `soundEngineSelect` und `VoltuneAudio`-Router starten mit `physical`. Die Motorpreset-Voreinstellung ist `hybrid`. Andere Physical-Reglerwerte bleiben vorerst wie bisher, bis sie gemeinsam im Fahrzeug abgestimmt werden.
- **Bestehende Einstellungen:** Wenn `voltune.settings.v1` vorhanden ist, wird die darin hinterlegte Engine ausgewählt. Ältere Konfigurationen ohne `soundEngine` bleiben absichtlich bei `legacy`. Laufende Benutzeränderungen werden wie bisher gespeichert und beim nächsten Start wiederhergestellt.
- **Wichtig:** Dies wählt nur die Soundengine vor, die eigentliche Audioausgabe beginnt weiterhin erst durch eine Nutzeraktion (Start/Demo); keine automatische Wiedergabe beim Seitenaufruf.
- CSS wird durch eine aktualisierte Version der Stylesheet-URL neu geladen, um veraltete Hilfetextdarstellung im Tesla-Browser zu vermeiden.
