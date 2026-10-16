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


## Lenkrad-/Mediensteuerung (optional, 15.10.2026)

Zur GPS-Testseite wurde ein eigener Opt-in-Modus **„Medien-/Lenkradsteuerung aktivieren“** ergänzt. Standardmäßig **aus**, um Teslas normale Medientasten nicht zu kapern.

Bedienung beim Tesla Model 3:
- **Neu:** Linkes Scrollrad **mittig drücken** (normalerweise „Play/Pause“) → nächstes Soundprofil.
- Linkes Scrollrad **seitlich nach rechts kippen** → ebenfalls nächstes Profil.
- Nach links kippen → vorheriges Profil.
- **Hoch-/Runterrollen verändert weiterhin die Fahrzeuglautstärke**; diese Funktion wird nicht von der Webseite abgefangen.

Implementation:
- \`navigator.mediaSession.setActionHandler("nexttrack" / "previoustrack")\`
- Zusätzlich behandelt `navigator.mediaSession.setActionHandler("play" / "pause")` den mittigen Klick: Beide Aktionen wechseln genau ein Soundprofil vorwärts; der Motorsound soll dabei weiterlaufen.
- Fallback-Tasten `MediaPlayPause`, `MediaPlay`, `MediaPause` werden ebenfalls erkannt; eine 260-ms-Sperre schützt vor doppeltem Profilwechsel.
- Bei eventuell pausiertem Medien-Audioelement wird die Wiedergabe erneut gestartet. Browser-/Tesla-Verhalten weiterhin im Fahrzeug zu verifizieren.
- Metadaten zeigen jeweils das aktuell gewählte Profil.
- Alternativ werden \`MediaTrackNext\` / \`MediaTrackPrevious\` und bei nicht fokussierten Formularen Pfeiltasten-Events unterstützt.
- Ein von einer Nutzeraktion gestarteter \`Audio\`-Player spielt den echten Worklet-Ausgang über \`MediaStreamAudioDestinationNode\` ab. Hintergrund: Manche Chromium-/Android-Browser aktivieren die Medientasten für reines Web Audio nicht.
- Wird die Audio-Bridge nicht unterstützt oder das Abspielen verweigert, verbleibt der Sound auf dem normalen Web-Audio-Ausgang. Die Testtasten auf dem Bildschirm funktionieren stets.
- Beim Ausschalten schaltet die Audioausgabe wieder auf den originalen \`AudioContext.destination\` um. Die Media-Action-Handler werden entfernt.
- Profilwechsel werden mit einer 260-ms-Sperre gegen Doppelbefehle geschützt.
- Profilwechsel erhalten laufende Audio-/GPS-Verarbeitung und die Effekte; kein Neuladen der Seite.
- Im UI stehen „Vorheriger Sound“, „Nächster Sound“ und „Lenkrad-Klick simulieren“ als Testtasten sowie ein Empfangs-/Statusindikator.

**Nicht bestätigt:** Die interne Technik von rupteur.app ist nicht öffentlich einsehbar. Der Tesla-Browser muss erst im Fahrzeug getestet werden, um zu prüfen, ob die linken Lenkradtasten ihre Mediensignale der Webseite zur Verfügung stellen. Ein erfolgreich registrierter MediaSession-Handler beweist dies nicht. Keine CAN-/Tesla-Fleet-API-Verbindung notwendig.

Sicherheit: Die Audioausgabe kann über ein HTML-Audio-Element etwas mehr Latenz aufweisen. Musik-Medienbefehle könnten in diesem Testmodus von Voltune übernommen werden. Nur bei stehendem Fahrzeug einschalten bzw. konfigurieren und die Funkionalität gefahrlos prüfen.

Informationsquellen:
- Tesla Model 3 Handbuch: https://www.tesla.com/ownersmanual/2017_2023_model3/en_ae/GUID-DEB259CC-ABAC-4BFC-8D10-B7B1BBCFCB1F.html
- Browser Media Session: https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setActionHandler
- Rupteur-Produktbeschreibung: https://rupteur.app/de/


## Entscheidung: optionale Lenkradsteuerung, Hintergrundbetrieb und Anzeige (16.10.2026)

- **Lenkradsteuerung:** Später als **frei zuschaltbarer Betriebsmodus** in Voltune übernehmen, sofern die Tesla-Tests den Empfang von Medienbefehlen bestätigen. Der Nutzer akzeptiert ausdrücklich, dass dabei die Tesla-Musik pausieren kann. Normaler Betrieb parallel zur Musik bleibt als Alternative erhalten.
- **Engine-Auswahl:** Voltune Original bleibt vollständig erhalten. Physical Engine mit **Hybrid EV + V8** als separate Engine dazu; weitere neue Profile später möglich.
- **Regler:** Gemeinsame GPS-, Getriebe-, Start/Stopp- und Master-Lautstärke-Regler immer sichtbar. Engine-spezifische Regler nur bei aktivem Engine-Typ zeigen; ausgeblendete Einstellungen behalten ihre Werte. Keine doppelte Audioausgabe.
- **Priorität vor der Integration:** Audio- und GPS-Hintergrundfähigkeit des Tesla-Browsers separat testen. Tesla dokumentiert grundsätzlich weiterlaufendes Browser-Audio nach dem Minimieren, dies garantiert aber nicht weiterlaufende WebAudio-, AudioWorklet- oder GPS-Verarbeitung.

### Medien- und Hintergrund-Diagnose

Die Testseite `voltune-dev/tesla-media-diagnose.html` enthält fünf getrennte Audiomodi:
- **A:** HTML-WAV-Audio (`audio.src`), nativer Mediaplayer.
- **B:** WebAudio-Oszillator über `MediaStreamAudioDestinationNode` an HTML-Audio.
- **C:** Direkter WebAudio-Oszillator über `AudioContext.destination`.
- **D:** Echter Hybrid EV + V8 (Physical Engine v0.4) via AudioWorklet und MediaStream an HTML-Audio.
- **E:** Echter Hybrid direkt über AudioWorklet sowie ein leiser nativer HTML-WAV-Medienanker.

MediaSession-Aktionen Play/Pause/Next/Previous werden gezählt. Hintergrundprüfung vergleicht `visibilitychange`, Fokusverlust, Audiostatus, AudioContext-Zeit, tatsächliche Worklet-Audiorender-Zeit (`js/tesla-background-monitor-v1.js`), JavaScript-Timerlücken und optionale GPS-Fixes. Die Seite speichert keine GPS-Koordinaten; Fotobericht und lokal gesicherte Vergleichsläufe.

**Testablauf:** im geparkten Tesla einen Modus starten, bei D/E drei Sekunden für den Render-Monitor warten, Hintergrundtest vormerken, Browser für 20–30 Sekunden minimieren, wieder öffnen, tatsächliche Hörbarkeit (Ja/Nein) eintragen und Bericht fotografieren. Die Modi A–E getrennt durchtesten und den GPS-Test ggf. zusätzlich starten. Fokusverlust allein ist ein schwächeres Signal als `document.hidden`.

**Einschränkung:** Ein Tesla-Browser, der Medienbefehle oder GPS-Updates im Hintergrund nicht weiterleitet, kann durch reine JavaScript-Handler nicht gezwungen werden. Audiowiedergabe allein reicht für einen wirklich dynamischen Voltune-Motorsound nicht aus.

**Die normale Voltune-App und ihre Audioengine wurden bei diesen Tests nicht verändert.**
