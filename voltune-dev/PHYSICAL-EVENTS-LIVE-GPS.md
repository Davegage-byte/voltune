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


## Lautstärke bei 100 % / alle zehn Profile (16.10.2026)

- **GPS- und manuelles Events-Labor:** Gesamtlautstärke 0–100 % mit voller browserseitiger Aussteuerung bei 100 %; starre 0,90-Gain-Grenze entfernt.
- **Neue abschließende Stereo-Schutzstufe:** `js/physical-output-limiter-v1.js` hinter dem gemeinsamen Ausgangsgain und *vor* normalem Browser-Ausgang bzw. MediaStream-Medienbrücke. Digitales Sample-Peak-Limit ±0,965 mit 75 ms Gain-Recovery, keine Änderung der v0.4-Motor-Worklet-Profile.
- **Lautstärkekurve:** Gain = `3.8 * (volume/100)^1.65 * 10^((boostDb * (1-volume/100))/20)`. 100 % ergibt immer 3,8 vor dem Limiter, unabhängig vom Boost; bei niedrigeren Reglerwerten unterstützt Musik-Boost 0 bis +12 dB zusätzliche Verstärkung.
- **Hybrid EV + V8** behält seinen separaten Faktor 2 vor dem bestehenden Event-Prozessor. Andere neun Soundprofile werden nicht einzeln tonal verändert.
- **Tesla-Medienmodus:** seit 16.10.2026 Test E statt MediaStream-Umleitung: Der vom Output-Limiter geschützte Motor bleibt direkt mit `AudioContext.destination` verbunden; ein separates, leises, 60 Sekunden langes HTML-WAV in Schleife aktiviert die Tesla-Medienquelle.
- **Validierung:** beide Testseiten mit simuliertem AudioGraph gestartet, alle drei Worklets geladen, Reglerwerte 0/25/50/100 % und Tesla-Stream-Umschaltung geprüft. 10 Profile bei simulierten 3200 RPM, Last 0,55 und 25/100 % durch Motor-/Events-/Output-Worklets gerendert; digitale Ausgangsspitzen aller zehn Profile bei 100 % max. 0,965 und alle Samples endlich.
- **Einschränkung:** Peak-Begrenzung ist keine Garantie für subjektiv unverzerrte Wiedergabe bei Extrempegeln (starke Dynamikbegrenzung möglich). Die Tesla-Audiohardware und Betriebssystemlautstärke bleiben separat; in-car Test nötig. Die bestehende Voltune-Hauptapp und das alte Physical-Engine-v0.4-Referenzlabor bleiben unverändert.

## Erfolgreicher Tesla-Test E und Übernahme ins GPS-Labor (16.10.2026)

- **Im Tesla bestätigt:** Der Hybrid-Worklet-Sound aus Modus E („Motor + Medienanker“) war bei minimiertem Browser ununterbrochen hörbar. Eine Auswertung zeigte etwa 23,2 Sekunden markierten Test und 22,0 Sekunden fortschreitende Worklet-Renderzeit.
- **Mini-Player:** Tesla zeigte die Browser-Medienquelle, pausierte dabei jedoch die normale Tesla-Musik. Musik-Parallelbetrieb und Mediensteuerung gleichzeitig sind derzeit nicht bestätigt.
- **Mittiger Scrollradklick:** Die Testdiagnose registrierte 8 Play-/Pause-Medienbefehle. Seitlich Links/Rechts für Titelwechsel lieferte keine Befehle; der Tesla-Mini-Player behandelte den Medienanker offenbar als einzelnen Titel.
- **GPS:** Bei einem anderen Minimier-/Wiederöffnen-Versuch erhöhte sich der GPS-Gesamtzähler nach Nutzerbeobachtung ungefähr von 400 auf 480, obwohl „GPS bei versteckter Seite“ 0 anzeigte. Das ist ein starkes Indiz für weiterlaufende GPS-Callbacks; nicht als exakt zeitgestempelter Hidden-Nachweis zu werten. Der Test E mit 23,2 Sekunden hatte GPS nicht aktiviert.

### GPS-Labor: erfolgreicher Audio-Pfad aus E

- Option **„Tesla-Medienmodus E aktivieren (mittiger Lenkradklick)“** im `physical-events-live-v1.html`. Standardmäßig **aus**.
- Physischer Mittelklick → MediaSession `play`/`pause` → nächstes der 10 Soundprofile (mit Rundlauf), geschützt gegen schnelle doppelte Meldungen.
- Dieselbe Physical Engine und derselbe Output-Limiter sind weiterhin **direkt** an `AudioContext.destination` angeschlossen. **Keine** Weiterleitung in ein HTML-Audioelement; kein Worklet-/GPS-Neustart beim Umschalten.
- Separates leises natives HTML-Audioelement spielt einen 60-Sekunden-WAV-Medienanker in Schleife (`volume=.025`). Wie Test E soll dadurch der Tesla-Mini-Player aktiv werden und Hintergrund-Audio weiterlaufen.
- Aktivierung erfolgt per direktem Nutzerklick ohne vorgeschaltetes `await`, damit der Tesla-Browser `audio.play()` zulässt.
- Eine Play-/Pause-Aktion soll den Motor nicht stoppen; ein eventuell pausierter Medienanker wird wieder gestartet. Ausschalten entfernt MediaSession-Handler und WAV-Quelle, lässt aber GPS und WebAudio-Motor weiterlaufen.
- Die Bildschirm-Tasten für vorheriges/nächstes Soundprofil bleiben verfügbar; die seitlichen Lenkrad-Next/Previous-Befehle sind ausdrücklich **nicht bestätigt**.
- **Verifiziert mit simulierten Browser-/Audio-/GPS-Objekten:** Modulstart mit GPS, Medienanker-Aktivierung, 4 Handler, Pause/Play-Doppelsignal, Profilwechsel, Medienanker-Wiederanlauf und Deaktivierung bei weiterlaufendem GPS und unverändertem direktem Soundgraphen.
- **Noch offen:** E-Medienanker direkt *im GPS-Labor* am echten Tesla ausprobieren. Der Test-E-Erfolg in der Diagnoseseite garantiert nicht identisches Verhalten in der Laborkonfiguration.

Die eigentliche Voltune-App wird erst nach weiterer Abstimmung integriert. Ihre alten Klangregler sollen nur bei ausgewählter alter Audioengine erscheinen; zusätzliche Physical-Engine-Regler nur bei der neuen Audioengine. Gemeinsame GPS-/Getriebe-/Lautstärkeregelung bleibt unabhängig.


## Effekte deutlich hörbarer und empfindlicher (16.10.2026)

Im GPS-Events-Fahrtest wurde der bestehende Effect-Prozessor v0.2 **nicht überschrieben**, sondern durch eine optionale neue v0.3-Worklet-Version ersetzt (Datei \`js/physical-events-worklet-v3.js\`). Die bisherige manuelle Events-Lab-Seite verbleibt als Referenz bei v0.2.

- **Schalthärte und Abgasimpulse:** weiterhin 0–100 %, wobei 50 % exakt der bisherigen dezenten Abstimmung entsprechen.
- **Effekt-Vordergrund:** 0–100 %, voreingestellt 70 %. 0 % liefert mit v3 beim alten Vergleichseffekt sampleidentisches Output zu v2; 100 % steuert bis zum Faktor 5 für Event-Transienten. Wenn wirklich ein Impuls ausgelöst wird, sinkt der Motorsound über dessen kurze Ausklingzeit bei maximalem Effekt-Vordergrund um höchstens ca. 58 %. Originaler Motor-Worklet v4 und finales Peak-Limit bleiben unverändert.
- **Auspuffdämpfung:** für maximale Offensivität nahe 0 % einstellen.
- **GPS-Effekt-Empfindlichkeit:** Standard (alte Schwellen und Cooldowns), Sport (voreingestellt, leichter auslösbar), Extrem (Experiment, kann GPS-Fehlauslösungen hervorbringen). Echte virtuelle Gear-Changes sind weiterhin für automatische Hochschalt-/Runterschalt-Effekte erforderlich; RPM/GPS-Werte werden durch diese Einstellung nicht verändert.
- **Schubknallen:** Sport/Extrem verwenden eine kurze Erinnerung an vorausgegangene positive Beschleunigung (Sport 1,6 s, Extrem 2,4 s), statt ausschließlich die Last des unmittelbar vorherigen GPS-Fixes. Die Standard-Variante benutzt weiterhin die bisherigen Bedingungen.
- **Schutz:** Nur nach gültigem GPS, bei Geschwindigkeitsminimum und nach Sperrzeiten. Kein neuer Effekt bei ungültigem Fix. Schubknallen erst nach Lastabfall und ausreichender jüngster Last. Output-Limiter bleibt bei max. ±0,965.
- **Maximaler Hörtest (nur im Stand einstellen):** \`Schalthärte 100 %\`, \`Abgasimpulse 100 %\`, \`Effekt-Vordergrund 100 %\`, \`Auspuffdämpfung 0 %\`, \`GPS-Empfindlichkeit Extrem\`; Automatik-Schaltungen und Automatik-Schubknallen eingeschaltet und Bypass aus.
- **Validierung:** In Worklet-Simulationen sind v2 und v3 bei \`effectBoost=1\` über alle getesteten Effekte sampleidentisch. Für dynamisches Hybrid-PCM mit Lautstärkefaktor 2, Masterfaktor 2,7 und finalem Output-Limiter stieg der Effektkontrast (RMS-Abstand vom identischen Lauf ohne Effekt) bei Maximal-Boost um ca. 18 % (Upshift), 44 % (Downshift), 32 % (Overrun). Das sind digitale Simulationswerte, keine psychoakustische Messung. Test der GPS-Modi mit virtuellem Getriebe und Lastwechsel: Standard kein Pop bei −0,75 m/s², Sport/Extrem je ein Pop; bei gleichem GPS-Fix-Verlauf. Die Motorwiedergabe bleibt bei Regleranpassungen unverändert aktiv.

Achtung: Der Test mit hoher Effekt-Präsenz kann im Fahrzeug sehr auffällige Transienten erzeugen. Fahrzeuglautstärke zunächst niedrig einstellen. Die Haupt-Voltune-App wurde noch nicht geändert.
