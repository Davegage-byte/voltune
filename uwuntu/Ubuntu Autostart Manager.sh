#!/usr/bin/env bash
set -u
#test
# ============================================================
# Ubuntu / GNOME Autostart Manager + 4-Tile Diagnose-Kiosk + Hardware Check v4.5.0 + Wipe Auto v3.3
# ============================================================

USER_AUTOSTART="$HOME/.config/autostart"
SYSTEM_AUTOSTART="/etc/xdg/autostart"
BIN_DIR="$HOME/.local/bin"
APP_DIR="$HOME/.local/share/applications"
# Neuer 4-Felder-Kiosk
KIOSK_DESKTOP="$USER_AUTOSTART/diagnostic-4tile-kiosk.desktop"
OLD_KIOSK_DESKTOP="$USER_AUTOSTART/firefox-snapshot-kiosk.desktop"
KIOSK_LAUNCHER="$BIN_DIR/start-kiosk-apps.sh"

NETWORK_CHECK_SCRIPT="$BIN_DIR/network-check.sh"
NETWORK_CHECK_APP_DESKTOP="$APP_DIR/com.david.NetworkCheck.desktop"
NETWORK_CHECK_AUTOSTART="$USER_AUTOSTART/com.david.NetworkCheck.desktop"

WIPE_AUTO_SCRIPT="$BIN_DIR/wipe-auto-app.sh"
WIPE_AUTO_APP_DESKTOP="$APP_DIR/com.david.WipeAuto.desktop"
HARDWARE_CHECK_SCRIPT="$BIN_DIR/hardware-check.sh"
HARDWARE_CHECK_APP_DESKTOP="$APP_DIR/com.david.HardwareCheck.desktop"
CAMERA_TEST_SCRIPT="$BIN_DIR/uwuntu-camera-test.sh"
# Bewusst dieselbe Desktop-ID wie GNOME Snapshot: bestehende Tiling-Assistant-
# Zuordnungen für oben rechts starten dadurch direkt unseren Kamera-Test.
CAMERA_TEST_APP_DESKTOP="$APP_DIR/org.gnome.Snapshot.desktop"
TOUCH_TEST_SCRIPT="$BIN_DIR/uwuntu-touch-tester.sh"
TOUCH_STATE_FILE="$HOME/.local/state/uwuntu/touch_tester_status.json"
CLOSE_APPS_SCRIPT="$BIN_DIR/close-diagnostic-apps.sh"
FORCE_UPDATE_SCRIPT="$BIN_DIR/uwuntu-force-update.sh"
MANAGER_PATH_FILE="$HOME/.config/uwuntu-manager-path"
MANAGER_INSTALL_PATH="$BIN_DIR/Ubuntu Autostart Manager.sh"

# Interne Buildnummer für den manuellen GitHub-Updater.
# Verhindert, dass U versehentlich eine ältere GitHub-Fassung installiert.
MANAGER_BUILD=2026090404
AUTO_MODE=0

mkdir -p "$USER_AUTOSTART" "$BIN_DIR" "$APP_DIR" "$HOME/.config"

pause() {
    if [ "${AUTO_MODE:-0}" -eq 1 ]; then
        return 0
    fi
    echo
    read -r -p "ENTER zum Fortfahren ..." _
}
header() {
    clear 2>/dev/null || true
    echo "============================================================"
    echo " Ubuntu Autostart Manager"
    echo "============================================================"
    echo
}

desktop_name() {
    local file="$1"
    local name
    name="$(grep -m1 '^Name=' "$file" 2>/dev/null | cut -d= -f2-)"
    [ -n "$name" ] || name="$(basename "$file")"
    printf '%s' "$name"
}
desktop_exec() {
    local file="$1"
    grep -m1 '^Exec=' "$file" 2>/dev/null | cut -d= -f2-
}

is_hidden() {
    local file="$1"
    grep -qiE '^Hidden=true$' "$file" 2>/dev/null
}

gnome_disabled() {
    local file="$1"
    grep -qiE '^X-GNOME-Autostart-enabled=false$' "$file" 2>/dev/null
}
# Ermittelt den effektiven Zustand eines Desktop-Autostarts.
# User-Datei mit gleichem Dateinamen überschreibt System-Datei.
effective_state() {
    local base="$1"
    local userfile="$USER_AUTOSTART/$base"
    local systemfile="$SYSTEM_AUTOSTART/$base"

    if [ -f "$userfile" ]; then
        if is_hidden "$userfile" || gnome_disabled "$userfile"; then
            echo "DEAKTIVIERT"
        else
            echo "AKTIV"
        fi
        return
    fi
    if [ -f "$systemfile" ]; then
        if is_hidden "$systemfile" || gnome_disabled "$systemfile"; then
            echo "DEAKTIVIERT"
        else
            echo "AKTIV"
        fi
        return
    fi

    echo "UNBEKANNT"
}

build_autostart_index() {
    AUTOSTART_FILES=()
    AUTOSTART_BASES=()

    declare -A seen=()
    # User-Dateien zuerst
    shopt -s nullglob
    for f in "$USER_AUTOSTART"/*.desktop; do
        localbase="$(basename "$f")"
        if [ -z "${seen[$localbase]+x}" ]; then
            seen["$localbase"]=1
            AUTOSTART_BASES+=("$localbase")
        fi
    done
    # System-Dateien ergänzen
    if [ -d "$SYSTEM_AUTOSTART" ]; then
        for f in "$SYSTEM_AUTOSTART"/*.desktop; do
            localbase="$(basename "$f")"
            if [ -z "${seen[$localbase]+x}" ]; then
                seen["$localbase"]=1
                AUTOSTART_BASES+=("$localbase")
            fi
        done
    fi
    shopt -u nullglob
    # Alphabetisch sortieren
    if [ "${#AUTOSTART_BASES[@]}" -gt 0 ]; then
        mapfile -t AUTOSTART_BASES < <(printf '%s\n' "${AUTOSTART_BASES[@]}" | sort)
    fi
}

show_autostarts() {
    build_autostart_index

    echo "GNOME/XDG AUTOSTARTS"
    echo "------------------------------------------------------------"

    if [ "${#AUTOSTART_BASES[@]}" -eq 0 ]; then
        echo "Keine Autostart-Einträge gefunden."
        return
    fi
    printf "%-4s %-12s %-10s %-38s %s\n" "Nr." "Status" "Quelle" "Name" "Datei"
    printf "%-4s %-12s %-10s %-38s %s\n" "----" "------------" "----------" "--------------------------------------" "----------------"

    local i=1
    local base userfile systemfile source displayfile name state

    for base in "${AUTOSTART_BASES[@]}"; do
        userfile="$USER_AUTOSTART/$base"
        systemfile="$SYSTEM_AUTOSTART/$base"
        if [ -f "$userfile" ]; then
            displayfile="$userfile"
            if [ -f "$systemfile" ]; then
                source="Override"
            else
                source="Benutzer"
            fi
        else
            displayfile="$systemfile"
            source="System"
        fi

        name="$(desktop_name "$displayfile")"
        state="$(effective_state "$base")"

        printf "%-4s %-12s %-10s %-38.38s %s\n" \
            "$i" "$state" "$source" "$name" "$base"
        i=$((i + 1))
    done
}

choose_autostart() {
    build_autostart_index
    show_autostarts
    echo

    if [ "${#AUTOSTART_BASES[@]}" -eq 0 ]; then
        return 1
    fi

    local num
    read -r -p "Nummer auswählen (0 = Abbrechen): " num

    if ! [[ "$num" =~ ^[0-9]+$ ]]; then
        echo "Ungültige Eingabe."
        return 1
    fi

    if [ "$num" -eq 0 ]; then
        return 1
    fi
    if [ "$num" -lt 1 ] || [ "$num" -gt "${#AUTOSTART_BASES[@]}" ]; then
        echo "Nummer außerhalb des Bereichs."
        return 1
    fi

    SELECTED_BASE="${AUTOSTART_BASES[$((num - 1))]}"
    return 0
}

show_details() {
    header
    if ! choose_autostart; then
        pause
        return
    fi

    local base="$SELECTED_BASE"
    local userfile="$USER_AUTOSTART/$base"
    local systemfile="$SYSTEM_AUTOSTART/$base"
    local file source
    if [ -f "$userfile" ]; then
        file="$userfile"
        if [ -f "$systemfile" ]; then
            source="Benutzer-Override für Systemeintrag"
        else
            source="Benutzereintrag"
        fi
    else
        file="$systemfile"
        source="Systemeintrag"
    fi
    header
    echo "Name   : $(desktop_name "$file")"
    echo "Status : $(effective_state "$base")"
    echo "Quelle : $source"
    echo "Datei  : $file"
    echo "Exec   : $(desktop_exec "$file")"
    echo
    echo "--- Inhalt ---"
    cat "$file" 2>/dev/null || true
    pause
}

disable_autostart() {
    header
    if ! choose_autostart; then
        pause
        return
    fi

    local base="$SELECTED_BASE"
    local userfile="$USER_AUTOSTART/$base"
    local systemfile="$SYSTEM_AUTOSTART/$base"
    echo
    echo "Deaktiviere: $base"

    if [ -f "$userfile" ] && [ ! -f "$systemfile" ]; then
        # Eigener Benutzereintrag: Hidden=true setzen
        if grep -q '^Hidden=' "$userfile"; then
            sed -i 's/^Hidden=.*/Hidden=true/' "$userfile"
        else
            printf '\nHidden=true\n' >> "$userfile"
        fi
        if grep -q '^X-GNOME-Autostart-enabled=' "$userfile"; then
            sed -i 's/^X-GNOME-Autostart-enabled=.*/X-GNOME-Autostart-enabled=false/' "$userfile"
        else
            printf 'X-GNOME-Autostart-enabled=false\n' >> "$userfile"
        fi
        echo "OK: Benutzereintrag deaktiviert."
    else
        # Systemeintrag oder bestehender Override:
        # sauberen User-Override mit Hidden=true erstellen
        if [ -f "$systemfile" ]; then
            cp -a "$systemfile" "$userfile"
        fi

        if grep -q '^Hidden=' "$userfile"; then
            sed -i 's/^Hidden=.*/Hidden=true/' "$userfile"
        else
            printf '\nHidden=true\n' >> "$userfile"
        fi
        if grep -q '^X-GNOME-Autostart-enabled=' "$userfile"; then
            sed -i 's/^X-GNOME-Autostart-enabled=.*/X-GNOME-Autostart-enabled=false/' "$userfile"
        else
            printf 'X-GNOME-Autostart-enabled=false\n' >> "$userfile"
        fi

        echo "OK: Systemeintrag wurde nur für deinen Benutzer deaktiviert."
        echo "Die Systemdatei selbst wurde NICHT gelöscht."
    fi

    pause
}
enable_autostart() {
    header
    if ! choose_autostart; then
        pause
        return
    fi

    local base="$SELECTED_BASE"
    local userfile="$USER_AUTOSTART/$base"
    local systemfile="$SYSTEM_AUTOSTART/$base"

    echo
    echo "Aktiviere: $base"
    if [ -f "$userfile" ] && [ -f "$systemfile" ]; then
        # Wenn User-Datei ein Override für System ist, entfernen wir ihn.
        rm -f "$userfile"
        echo "OK: Benutzer-Override entfernt."
        echo "Der originale System-Autostart ist wieder aktiv."
    elif [ -f "$userfile" ]; then
        if grep -q '^Hidden=' "$userfile"; then
            sed -i 's/^Hidden=.*/Hidden=false/' "$userfile"
        else
            printf '\nHidden=false\n' >> "$userfile"
        fi
        if grep -q '^X-GNOME-Autostart-enabled=' "$userfile"; then
            sed -i 's/^X-GNOME-Autostart-enabled=.*/X-GNOME-Autostart-enabled=true/' "$userfile"
        else
            printf 'X-GNOME-Autostart-enabled=true\n' >> "$userfile"
        fi

        echo "OK: Benutzereintrag aktiviert."
    else
        echo "Der Systemeintrag ist bereits aktiv."
    fi

    pause
}

delete_user_autostart() {
    header
    if ! choose_autostart; then
        pause
        return
    fi
    local base="$SELECTED_BASE"
    local userfile="$USER_AUTOSTART/$base"
    local systemfile="$SYSTEM_AUTOSTART/$base"

    echo

    if [ ! -f "$userfile" ]; then
        echo "Dieser Eintrag gehört zum System und wird NICHT gelöscht."
        echo "Benutze stattdessen 'Deaktivieren'."
        pause
        return
    fi
    if [ -f "$systemfile" ]; then
        echo "Achtung: '$base' ist ein Benutzer-Override für einen Systemeintrag."
        echo "Wenn du ihn löschst, wird der originale Systemeintrag wieder aktiv."
    else
        echo "Achtung: Dieser Benutzereintrag wird vollständig gelöscht:"
        echo "$userfile"
    fi

    echo
    read -r -p "Wirklich löschen? [j/N]: " answer
    case "$answer" in
        j|J|ja|JA|Ja)
            rm -f "$userfile"
            echo "OK: Benutzerdatei gelöscht."
            ;;
        *)
            echo "Abgebrochen."
            ;;
    esac

    pause
}
show_user_services() {
    header
    echo "AKTIVIERTE SYSTEMD-BENUTZERDIENSTE"
    echo "------------------------------------------------------------"
    systemctl --user list-unit-files --type=service --state=enabled --no-pager 2>/dev/null || true
    echo
    echo "Hinweis:"
    echo "Diese Liste ist zusätzlich zu den GNOME/XDG-Autostarts."
    pause
}
disable_user_service() {
    header
    echo "Aktivierte systemd-Benutzerdienste:"
    echo
    mapfile -t services < <(
        systemctl --user list-unit-files --type=service --state=enabled --no-legend 2>/dev/null \
        | awk '{print $1}' \
        | sort
    )

    if [ "${#services[@]}" -eq 0 ]; then
        echo "Keine aktivierten Benutzer-Services gefunden."
        pause
        return
    fi
    local i=1
    for s in "${services[@]}"; do
        printf "%3d) %s\n" "$i" "$s"
        i=$((i + 1))
    done

    echo
    local num
    read -r -p "Nummer deaktivieren (0 = Abbrechen): " num

    if ! [[ "$num" =~ ^[0-9]+$ ]] || [ "$num" -eq 0 ]; then
        return
    fi

    if [ "$num" -lt 1 ] || [ "$num" -gt "${#services[@]}" ]; then
        echo "Ungültige Auswahl."
        pause
        return
    fi

    local service="${services[$((num - 1))]}"
    echo
    read -r -p "'$service' wirklich deaktivieren und stoppen? [j/N]: " answer
    case "$answer" in
        j|J|ja|JA|Ja)
            systemctl --user disable --now "$service"
            echo "OK."
            ;;
        *)
            echo "Abgebrochen."
            ;;
    esac

    pause
}


install_close_apps_helper() {
    cat > "$CLOSE_APPS_SCRIPT" <<'EOF'
#!/usr/bin/env bash
set -u
# Etwas verzögert starten, damit die App, die Strg+Q ausgelöst hat,
# ihr Tastaturereignis sauber beenden kann.
sleep 0.08
# Alle eigenen Diagnoseprogramme gemeinsam beenden.
# Kamera/Touch bestehen aus einem Shell-Wrapper + Python-Kindprozess.
# Deshalb deren Prozessbaum gezielt von innen nach außen beenden.
kill_script_tree() {
    local pattern="$1" pid
    while read -r pid; do
        [ -n "$pid" ] || continue
        pkill -TERM -P "$pid" 2>/dev/null || true
        kill -TERM "$pid" 2>/dev/null || true
    done < <(pgrep -f "$pattern" 2>/dev/null || true)
}

# Falls STRG+Q während der Start-/Touch-Sequenz kommt, darf der Kiosk-Launcher
# danach kein bereits geschlossenes Fenster erneut aktivieren.
pkill -TERM -f '/.local/bin/start-kiosk-apps.sh' 2>/dev/null || true
pkill -TERM -f '/tmp/network-check-' 2>/dev/null || true
pkill -TERM -f '/tmp/wipe-auto-' 2>/dev/null || true
pkill -TERM -f '/tmp/hardware-check\.' 2>/dev/null || true
kill_script_tree '/.local/bin/uwuntu-camera-test.sh'
kill_script_tree '/.local/bin/uwuntu-touch-tester.sh'
# Alte Snapshot-Instanz ebenfalls beseitigen, falls sie noch von einer
# früheren Installation übrig geblieben ist.
pkill -TERM -x snapshot 2>/dev/null || true

exit 0
EOF

    chmod +x "$CLOSE_APPS_SCRIPT"
}


install_force_update_helper() {
    # Der U-Updater braucht einen dauerhaft vorhandenen Manager. Der Ort,
    # von dem der Benutzer die heruntergeladene Installationsdatei gestartet
    # hat (Downloads, USB, /tmp, ...), darf deshalb keine Rolle spielen.
    # Wir halten immer eine feste, ausführbare Kopie unter ~/.local/bin vor.
    local manager_source manager_source_real manager_install_real
    manager_source="$(readlink -f "$0" 2>/dev/null || printf '%s' "$0")"
    manager_source_real="$(readlink -f "$manager_source" 2>/dev/null || printf '%s' "$manager_source")"
    manager_install_real="$(readlink -f "$MANAGER_INSTALL_PATH" 2>/dev/null || printf '%s' "$MANAGER_INSTALL_PATH")"

    if [ "$manager_source_real" != "$manager_install_real" ]; then
        local manager_tmp="${MANAGER_INSTALL_PATH}.new.$$"
        cp "$manager_source" "$manager_tmp" || {
            echo "FEHLER: Feste Manager-Kopie konnte nicht erstellt werden."
            return 1
        }
        chmod +x "$manager_tmp" || true
        mv -f "$manager_tmp" "$MANAGER_INSTALL_PATH" || {
            rm -f "$manager_tmp" 2>/dev/null || true
            echo "FEHLER: Feste Manager-Kopie konnte nicht installiert werden."
            return 1
        }
    else
        chmod +x "$MANAGER_INSTALL_PATH" 2>/dev/null || true
    fi

    # Kompatibilitätsdatei für bereits installierte Helper. Sie zeigt ab
    # jetzt immer auf den stabilen Installationsort und niemals auf Downloads.
    printf '%s\n' "$MANAGER_INSTALL_PATH" > "$MANAGER_PATH_FILE"

    local helper_tmp="${FORCE_UPDATE_SCRIPT}.new.$$"
    cat > "$helper_tmp" <<'EOF'
#!/usr/bin/env bash
set -u

RAW_URL="https://raw.githubusercontent.com/Davegage-byte/voltune/refs/heads/main/uwuntu/Ubuntu%20Autostart%20Manager.sh"
PATH_FILE="$HOME/.config/uwuntu-manager-path"
DEFAULT_TARGET="$HOME/.local/bin/Ubuntu Autostart Manager.sh"
LOG="$HOME/uwuntu_force_update.log"
KIOSK="$HOME/.local/bin/start-kiosk-apps.sh"

status() {
    printf 'STATUS|%s\n' "$1"
    printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >> "$LOG" 2>/dev/null || true
}

fail() {
    status "FEHLER: $1"
    exit "${2:-1}"
}

# Neue Installationen verwenden immer den festen Pfad. Für eine ältere
# Installation lesen wir die bisherige Pfaddatei nur noch als Fallback.
TARGET="$DEFAULT_TARGET"
if [ ! -f "$TARGET" ] && [ -f "$PATH_FILE" ]; then
    legacy_target="$(cat "$PATH_FILE" 2>/dev/null || true)"
    if [ -n "$legacy_target" ] && [ -f "$legacy_target" ]; then
        TARGET="$legacy_target"
    fi
fi

[ -f "$TARGET" ] || fail "Ubuntu Autostart Manager wurde nicht gefunden." 12
printf '%s\n' "$TARGET" > "$PATH_FILE" 2>/dev/null || true
command -v curl >/dev/null 2>&1 || fail "curl ist nicht installiert." 13

status "Suche nach Update …"

TMP="$(mktemp /tmp/uwuntu-manager-update.XXXXXX.sh)" || fail "Temporäre Datei konnte nicht erstellt werden." 14
BACKUP="${TARGET}.update-backup"
trap 'rm -f "$TMP" "${TARGET}.new" 2>/dev/null || true' EXIT

if ! curl \
    --fail \
    --location \
    --silent \
    --show-error \
    --connect-timeout 8 \
    --max-time 45 \
    --output "$TMP" \
    "$RAW_URL"
then
    fail "GitHub ist nicht erreichbar oder der Download ist fehlgeschlagen." 20
fi

[ -s "$TMP" ] || fail "GitHub hat eine leere Datei geliefert." 21
head -n 1 "$TMP" | grep -q '^#!/usr/bin/env bash' \
    || fail "Die heruntergeladene Datei ist kein gültiger Uwuntu-Manager." 22
grep -q '^main_menu()' "$TMP" \
    || fail "Die heruntergeladene Datei ist unvollständig." 23
bash -n "$TMP" >/dev/null 2>&1 \
    || fail "Die heruntergeladene Datei hat einen Syntaxfehler." 24

local_build="$(grep -m1 '^MANAGER_BUILD=[0-9][0-9]*$' "$TARGET" 2>/dev/null | cut -d= -f2 || true)"
remote_build="$(grep -m1 '^MANAGER_BUILD=[0-9][0-9]*$' "$TMP" 2>/dev/null | cut -d= -f2 || true)"

# Ab dieser Version besitzt der Manager eine monotone Buildnummer.
# Fehlt sie auf GitHub, ist dort definitiv noch die ältere Generation.
if [ -n "$local_build" ] && [ -z "$remote_build" ]; then
    status "GitHub-Version ist älter · kein Update"
    exit 0
fi

if [ -n "$local_build" ] && [ -n "$remote_build" ]; then
    if [ "$remote_build" -lt "$local_build" ]; then
        status "GitHub-Version ist älter · kein Update"
        exit 0
    fi
fi

if cmp -s "$TARGET" "$TMP"; then
    status "Bereits aktuell"
    exit 0
fi

status "Update gefunden · wird installiert …"

rm -f "$BACKUP" 2>/dev/null || true
cp -a "$TARGET" "$BACKUP" \
    || fail "Sicherung der bisherigen Version fehlgeschlagen." 30

chmod +x "$TMP" || true
cp "$TMP" "${TARGET}.new" \
    || fail "Neue Manager-Datei konnte nicht vorbereitet werden." 31
chmod +x "${TARGET}.new" || true
mv -f "${TARGET}.new" "$TARGET" \
    || fail "Ubuntu Autostart Manager konnte nicht ersetzt werden." 32

status "Installiere Uwuntu-Komponenten …"

if ! "$TARGET" --apply-update >> "$LOG" 2>&1; then
    cp -a "$BACKUP" "$TARGET" 2>/dev/null || true
    chmod +x "$TARGET" 2>/dev/null || true
    fail "Installation fehlgeschlagen · vorherige Manager-Version wiederhergestellt." 40
fi

rm -f "$BACKUP" 2>/dev/null || true
status "Update erfolgreich · Anwendungen werden neu gestartet …"

# Status noch kurz sichtbar lassen. Danach laufen wir unabhängig vom
# Hardware-Check-Prozess weiter und können ihn selbst gefahrlos beenden.
sleep 0.7

pkill -TERM -f '/tmp/network-check-' 2>/dev/null || true
pkill -TERM -f '/tmp/wipe-auto-' 2>/dev/null || true
pkill -TERM -f '/tmp/hardware-check\.' 2>/dev/null || true
for wrapper in \
    '/.local/bin/uwuntu-camera-test.sh' \
    '/.local/bin/uwuntu-touch-tester.sh'
do
    while read -r pid; do
        [ -n "$pid" ] || continue
        pkill -TERM -P "$pid" 2>/dev/null || true
        kill -TERM "$pid" 2>/dev/null || true
    done < <(pgrep -f "$wrapper" 2>/dev/null || true)
done
# Alte Snapshot-Instanz ebenfalls schließen, falls sie noch läuft.
pkill -TERM -x snapshot 2>/dev/null || true

sleep 0.7

if [ -x "$KIOSK" ]; then
    nohup "$KIOSK" >> "$LOG" 2>&1 </dev/null &
else
    # Fallback, falls nur die Einzelprogramme installiert sind.
    [ -x "$HOME/.local/bin/network-check.sh" ] \
        && nohup "$HOME/.local/bin/network-check.sh" >> "$LOG" 2>&1 </dev/null &
    [ -x "$HOME/.local/bin/wipe-auto-app.sh" ] \
        && nohup "$HOME/.local/bin/wipe-auto-app.sh" >> "$LOG" 2>&1 </dev/null &
    [ -x "$HOME/.local/bin/hardware-check.sh" ] \
        && nohup "$HOME/.local/bin/hardware-check.sh" >> "$LOG" 2>&1 </dev/null &
fi

exit 0
EOF

    chmod +x "$helper_tmp"
    # Atomar ersetzen: Falls gerade ein U-Update mit der bisherigen
    # Helper-Datei läuft, liest dessen Bash-Prozess seinen alten Inode
    # ungestört zu Ende.
    mv -f "$helper_tmp" "$FORCE_UPDATE_SCRIPT"
}


cleanup_legacy_kiosk_items() {
    echo "--- Alte Kiosk-Reste bereinigen ---"

    local removed=0
    for f in \
        "$USER_AUTOSTART/wipe-auto.desktop" \
        "$USER_AUTOSTART/wipe.desktop"
    do
        if [ -e "$f" ]; then
            rm -f "$f"
            echo "Entfernt: $f"
            removed=1
        fi
    done
    # Der von Ubuntu mitgelieferte Benutzer-ydotoold kollidiert mit
    # unserem eigenen Systemdienst /run/ydotool-kiosk.sock.
    # Unser ydotool-kiosk.service bleibt davon unberührt.
    if systemctl --user list-unit-files ydotool.service \
        --no-legend 2>/dev/null | grep -q 'ydotool.service'
    then
        systemctl --user disable --now ydotool.service \
            >/dev/null 2>&1 || true
        systemctl --user mask ydotool.service \
            >/dev/null 2>&1 || true
        systemctl --user daemon-reload >/dev/null 2>&1 || true
        echo "Alter Benutzer-Service ydotool.service: deaktiviert + maskiert."
        removed=1
    fi
    if [ "$removed" -eq 0 ]; then
        echo "Keine alten Reste gefunden."
    fi
}

setup_ydotool() {
    echo "--- ydotool prüfen ---"

    if ! command -v ydotool >/dev/null 2>&1; then
        echo "ydotool fehlt. Installation wird versucht."

        if sudo -n true 2>/dev/null; then
            sudo -n apt-get install -y ydotool || return 1
        else
            sudo apt-get install -y ydotool || return 1
        fi
    fi

    echo "OK: $(command -v ydotool)"
    # Prüfen, ob ein nutzbarer Socket existiert.
    local socket=""
    for s in \
        "/run/ydotool-kiosk.sock" \
        "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/.ydotool_socket" \
        "/run/user/$(id -u)/.ydotool_socket" \
        "/tmp/.ydotool_socket"
    do
        if [ -S "$s" ] && [ -w "$s" ]; then
            socket="$s"
            break
        fi
    done

    if [ -n "$socket" ]; then
        echo "OK: ydotool-Socket vorhanden: $socket"
        return 0
    fi
    echo "Kein nutzbarer Socket gefunden."
    echo "Richte Kiosk-ydotoold ein ..."

    local sudo_cmd=(sudo)
    if sudo -n true 2>/dev/null; then
        sudo_cmd=(sudo -n)
    fi

    "${sudo_cmd[@]}" tee /etc/systemd/system/ydotool-kiosk.service >/dev/null <<'EOF'
[Unit]
Description=ydotool daemon for local kiosk automation
After=systemd-udevd.service

[Service]
Type=simple
ExecStart=/usr/bin/ydotoold --socket-path=/run/ydotool-kiosk.sock --socket-perm=0666
Restart=on-failure
RestartSec=1
[Install]
WantedBy=multi-user.target
EOF

    "${sudo_cmd[@]}" systemctl daemon-reload
    "${sudo_cmd[@]}" systemctl enable --now ydotool-kiosk.service
    sleep 1

    if [ ! -S /run/ydotool-kiosk.sock ]; then
        echo "FEHLER: /run/ydotool-kiosk.sock wurde nicht erstellt."
        return 1
    fi

    echo "OK: ydotool-Kiosk-Daemon läuft."
    return 0
}


setup_pyatspi() {
    echo "--- AT-SPI prüfen ---"
    if ! command -v python3 >/dev/null 2>&1; then
        echo "FEHLER: python3 wurde nicht gefunden."
        return 1
    fi

    if python3 -c 'import pyatspi' >/dev/null 2>&1; then
        echo "OK: python3-pyatspi ist verfügbar."
        return 0
    fi

    echo "python3-pyatspi fehlt. Installation wird versucht."

    if sudo -n true 2>/dev/null; then
        sudo -n apt-get install -y python3-pyatspi || return 1
    else
        sudo apt-get install -y python3-pyatspi || return 1
    fi
    if ! python3 -c 'import pyatspi' >/dev/null 2>&1; then
        echo "FEHLER: pyatspi lässt sich nach der Installation nicht importieren."
        return 1
    fi

    echo "OK: python3-pyatspi ist verfügbar."
    return 0
}


install_camera_test_app() {
    echo "--- Uwuntu Kamera-Test installieren / aktualisieren ---"

    cat > "$CAMERA_TEST_SCRIPT" <<'CAMERA_TEST_EOF'
#!/usr/bin/env bash
set -u

REQUIRED_PKGS=(
  python3-gi
  gir1.2-gtk-3.0
  gir1.2-gstreamer-1.0
  gstreamer1.0-plugins-base
  gstreamer1.0-plugins-good
  gstreamer1.0-gtk3
)

missing=()
for pkg in "${REQUIRED_PKGS[@]}"; do
    dpkg -s "$pkg" >/dev/null 2>&1 || missing+=("$pkg")
done

if ((${#missing[@]})); then
    if command -v pkexec >/dev/null 2>&1; then
        pkexec env DEBIAN_FRONTEND=noninteractive apt-get install -y "${missing[@]}" || exit 1
    else
        sudo apt-get install -y "${missing[@]}" || exit 1
    fi
fi

python3 - <<'PY'
import glob
import os
import subprocess
import gi

gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("Gst", "1.0")

from gi.repository import Gtk, Gdk, Gst, GLib

Gst.init(None)

ERROR_TEXT = "KEIN KAMERABILD ERKANNT"
devices = sorted(glob.glob("/dev/video*")) or ["/dev/video0"]

modes = [
    ("MJPEG 1920x1080 @ 30 FPS", "image/jpeg,width=1920,height=1080,framerate=30/1 ! jpegdec"),
    ("MJPEG 1280x720 @ 30 FPS", "image/jpeg,width=1280,height=720,framerate=30/1 ! jpegdec"),
    ("AUTO", None),
]

tests = [(dev, label, caps) for dev in devices for label, caps in modes]

class CameraWindow(Gtk.Window):
    def __init__(self):
        super().__init__(title="Uwuntu Kamera Test")

        self.set_decorated(False)
        self.set_default_size(960, 540)
        self.set_position(Gtk.WindowPosition.CENTER)
        self.connect("destroy", self.on_destroy)
        self.connect("key-press-event", self.on_key_press)

        self.pipeline = None
        self.index = -1
        self.frame_seen = False
        self.serial = 0

        css = Gtk.CssProvider()
        css.load_from_data(b'''
window { background: #000; }
#camera_error {
    color: #ff2020;
    font-size: 30px;
    font-weight: 700;
}
''')
        Gtk.StyleContext.add_provider_for_screen(
            Gdk.Screen.get_default(),
            css,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )

        self.overlay = Gtk.Overlay()
        self.add(self.overlay)

        self.video_box = Gtk.Box()
        self.video_box.set_hexpand(True)
        self.video_box.set_vexpand(True)
        self.overlay.add(self.video_box)

        self.error_label = Gtk.Label(label=ERROR_TEXT)
        self.error_label.set_name("camera_error")
        self.error_label.set_halign(Gtk.Align.CENTER)
        self.error_label.set_valign(Gtk.Align.CENTER)
        self.overlay.add_overlay(self.error_label)

        self.show_all()
        self.error_label.hide()

        GLib.idle_add(self.try_next)

    def stop_pipeline(self):
        if self.pipeline:
            try:
                self.pipeline.get_bus().remove_signal_watch()
            except Exception:
                pass
            self.pipeline.set_state(Gst.State.NULL)
            self.pipeline = None

    def clear_video(self):
        for child in self.video_box.get_children():
            self.video_box.remove(child)

    def build_pipeline(self, device, caps):
        if caps is None:
            return (
                f'v4l2src device="{device}" ! '
                'videoconvert ! '
                'identity name=probe signal-handoffs=true ! '
                'gtksink name=sink sync=false'
            )
        return (
            f'v4l2src device="{device}" ! '
            f'{caps} ! '
            'videoconvert ! '
            'identity name=probe signal-handoffs=true ! '
            'gtksink name=sink sync=false'
        )

    def try_next(self):
        self.serial += 1
        current_serial = self.serial

        self.stop_pipeline()
        self.clear_video()

        self.index += 1
        self.frame_seen = False

        if self.index >= len(tests):
            self.error_label.show()
            print("Keine funktionierende Kamera-Konfiguration gefunden.", flush=True)
            return False

        device, label, caps = tests[self.index]
        print(f"Teste {device}: {label}", flush=True)

        try:
            self.pipeline = Gst.parse_launch(self.build_pipeline(device, caps))
            sink = self.pipeline.get_by_name("sink")
            probe = self.pipeline.get_by_name("probe")

            if sink is None or probe is None:
                raise RuntimeError("GStreamer-Element fehlt")

            widget = sink.get_property("widget")
            widget.set_hexpand(True)
            widget.set_vexpand(True)
            self.video_box.pack_start(widget, True, True, 0)
            widget.show()

            probe.connect("handoff", self.on_frame, current_serial)

            bus = self.pipeline.get_bus()
            bus.add_signal_watch()
            bus.connect("message::error", self.on_error, current_serial)
            bus.connect("message::eos", self.on_eos, current_serial)

            result = self.pipeline.set_state(Gst.State.PLAYING)
            if result == Gst.StateChangeReturn.FAILURE:
                GLib.idle_add(self.fail_current, current_serial)
            else:
                GLib.timeout_add(2200, self.check_timeout, current_serial)

        except Exception as exc:
            print("  Fehler:", exc, flush=True)
            GLib.idle_add(self.fail_current, current_serial)

        return False

    def on_frame(self, element, buffer, current_serial):
        if current_serial != self.serial:
            return

        if not self.frame_seen:
            self.frame_seen = True
            device, label, _ = tests[self.index]
            print(f"Kamera aktiv: {device} | {label}", flush=True)
            GLib.idle_add(self.error_label.hide)

    def check_timeout(self, current_serial):
        if current_serial == self.serial and not self.frame_seen:
            self.fail_current(current_serial)
        return False

    def fail_current(self, current_serial):
        if current_serial != self.serial or self.frame_seen:
            return False
        self.try_next()
        return False

    def on_error(self, bus, message, current_serial):
        if current_serial == self.serial and not self.frame_seen:
            err, _ = message.parse_error()
            print("  GStreamer:", err.message, flush=True)
            GLib.idle_add(self.fail_current, current_serial)

    def on_eos(self, bus, message, current_serial):
        if current_serial == self.serial and not self.frame_seen:
            GLib.idle_add(self.fail_current, current_serial)

    def on_key_press(self, widget, event):
        ctrl = bool(event.state & Gdk.ModifierType.CONTROL_MASK)
        if event.keyval == Gdk.KEY_Escape or (
            ctrl and event.keyval in (Gdk.KEY_w, Gdk.KEY_W)
        ):
            self.close()
            return True
        if ctrl and event.keyval in (Gdk.KEY_q, Gdk.KEY_Q):
            helper = os.path.expanduser("~/.local/bin/close-diagnostic-apps.sh")
            try:
                subprocess.Popen(
                    [helper],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                )
            except Exception:
                pass
            return True
        return False

    def on_destroy(self, *args):
        self.serial += 1
        self.stop_pipeline()
        Gtk.main_quit()

CameraWindow()
Gtk.main()
PY
CAMERA_TEST_EOF
    chmod +x "$CAMERA_TEST_SCRIPT"

    # User-Override für die bisherige GNOME-Snapshot-ID. Dadurch bleibt eine
    # bestehende Tiling-Assistant-Zuordnung oben rechts erhalten, startet aber
    # ab jetzt unseren cleanen Kamera-Test.
    cat > "$CAMERA_TEST_APP_DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=Uwuntu Kamera Test
Comment=Cleaner Uwuntu Kamera-Test
Exec=$CAMERA_TEST_SCRIPT
Icon=camera-photo-symbolic
Terminal=false
StartupNotify=true
StartupWMClass=Uwuntu Kamera Test
Categories=Utility;System;
NoDisplay=false
EOF

    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "$APP_DIR" >/dev/null 2>&1 || true
    fi

    echo "OK: Kamera-Test installiert/aktualisiert."
    echo "Programm: $CAMERA_TEST_SCRIPT"
    echo "Desktop:  $CAMERA_TEST_APP_DESKTOP"
    return 0
}

install_touch_test_app() {
    echo "--- Uwuntu Touch-Tester installieren / aktualisieren ---"

    cat > "$TOUCH_TEST_SCRIPT" <<'TOUCH_TEST_EOF'
#!/usr/bin/env bash
set -u

# Let GTK connect to the X server provided by XWayland, even when the
# desktop session itself is Wayland.
export GDK_BACKEND=x11

if [[ -z "${DISPLAY:-}" ]]; then
  echo "Touch-Tester: Kein X11/XWayland DISPLAY gefunden."
  echo "DISPLAY ist nicht gesetzt; dieser Transparenz-Test kann so nicht starten."
  exit 4
fi

python3 - <<'PY'
import sys, json, glob, subprocess
from datetime import datetime, timezone
from pathlib import Path

STATE_DIR = Path.home() / ".local" / "state" / "uwuntu"
STATE_FILE = STATE_DIR / "touch_tester_status.json"
TOTAL = 5


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def write_state(result, completed=0, device=None, note=None):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    data = {
        "test": "touchscreen",
        "result": result,
        "completed_fields": completed,
        "total_fields": TOTAL,
        "variant": "xwayland-rgba-final",
        "timestamp": now_iso(),
    }
    if device:
        data["device"] = device
    if note:
        data["note"] = note
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(STATE_FILE)


def find_touchscreen():
    for dev in sorted(glob.glob("/dev/input/event*")):
        try:
            p = subprocess.run(
                ["udevadm", "info", "--query=property", f"--name={dev}"],
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                timeout=2,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            continue
        props = {}
        for line in p.stdout.splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                props[k] = v
        if props.get("ID_INPUT_TOUCHSCREEN") == "1":
            name = props.get("NAME") or props.get("ID_MODEL_FROM_DATABASE") or props.get("ID_MODEL")
            return dev, name
    return None, None


device, device_name = find_touchscreen()
if not device:
    write_state("no_touchscreen", note="Kein Touchscreen über udev erkannt")
    print("Touch-Tester: Kein Touchscreen erkannt.")
    sys.exit(2)

try:
    import gi
    gi.require_version("Gtk", "3.0")
    gi.require_version("Gdk", "3.0")
    from gi.repository import Gtk, Gdk, GLib
except Exception as exc:
    write_state("error", device=device, note=f"GTK3/PyGObject fehlt: {exc}")
    print("Touch-Tester: GTK3/PyGObject konnte nicht geladen werden.")
    print(f"Fehler: {exc}")
    print("Falls nötig: sudo apt install gir1.2-gtk-3.0")
    sys.exit(3)


CSS = b"""
window#touch_host {
    background-color: rgba(0,0,0,0);
    background-image: none;
}
.touch-target {
    background-color: #ff1010;
    border: 5px solid #ffffff;
    border-radius: 14px;
    box-shadow: 0 4px 22px rgba(0,0,0,0.80);
}
.touch-target.target-red   { background-color: #ff1010; }
.touch-target.target-blue  { background-color: #006cff; }
.touch-target.target-green { background-color: #00d64b; }
.target-label {
    color: rgba(255,255,255,0.94);
    font-size: 14px;
    font-weight: 800;
}
.title-panel {
    background-color: rgba(18,18,18,0.78);
    border: 2px solid rgba(255,255,255,0.88);
    border-radius: 14px;
    box-shadow: 0 5px 28px rgba(0,0,0,0.75);
    padding: 13px 20px;
}
.main-title {
    color: white;
    font-size: 30px;
    font-weight: 900;
}
.progress {
    color: rgba(255,255,255,0.92);
    font-size: 15px;
    font-weight: 800;
}
.progress-ready {
    color: #37e06f;
}
.hint {
    color: rgba(255,255,255,0.72);
    font-size: 11px;
}
"""


class TouchTarget(Gtk.EventBox):
    W = 160
    H = 115

    def __init__(self, owner, target_id):
        super().__init__()
        self.owner = owner
        self.target_id = target_id
        self.done = False
        self.touch_down = False

        self.set_size_request(self.W, self.H)
        self.set_visible_window(True)
        self.add_events(Gdk.EventMask.TOUCH_MASK)

        ctx = self.get_style_context()
        ctx.add_class("touch-target")
        ctx.add_class("target-red")

        self.connect("touch-event", self.on_touch_event)

    def set_state(self, state):
        ctx = self.get_style_context()
        for cls in ("target-red", "target-blue", "target-green"):
            ctx.remove_class(cls)
        ctx.add_class(state)

    def on_touch_event(self, widget, event):
        et = event.type
        if et == Gdk.EventType.TOUCH_BEGIN:
            self.touch_down = True
            self.set_state("target-blue")
            return True
        if et in (Gdk.EventType.TOUCH_END, Gdk.EventType.TOUCH_CANCEL):
            if not self.touch_down:
                return True
            self.touch_down = False
            if et == Gdk.EventType.TOUCH_END:
                self.done = True
                self.set_state("target-green")
                self.owner.update_progress()
            else:
                self.set_state("target-green" if self.done else "target-red")
            return True
        return False


class TouchWindow(Gtk.Window):
    def __init__(self):
        super().__init__(type=Gtk.WindowType.TOPLEVEL)
        self.set_name("touch_host")
        self.set_title("Uwuntu Touch-Tester XWayland")
        self.set_decorated(False)
        self.set_keep_above(True)
        self.set_skip_taskbar_hint(True)
        self.set_skip_pager_hint(True)
        self.set_app_paintable(True)
        self.set_accept_focus(True)
        self.set_focus_on_map(True)
        self.finished = False
        self.front_attempts = 0
        self.completed = 0

        # GTK3/X11 specific: explicitly request a visual with an alpha channel.
        screen = self.get_screen()
        visual = screen.get_rgba_visual()
        if visual is not None and screen.is_composited():
            self.set_visual(visual)
            self.rgba_ok = True
        else:
            self.rgba_ok = False

        provider = Gtk.CssProvider()
        provider.load_from_data(CSS)
        Gtk.StyleContext.add_provider_for_screen(
            screen, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        )
        self._provider = provider

        self.fixed = Gtk.Fixed()
        self.fixed.set_hexpand(True)
        self.fixed.set_vexpand(True)
        self.add(self.fixed)

        self.targets = {
            "top-left": TouchTarget(self, "top-left"),
            "top-right": TouchTarget(self, "top-right"),
            "center": TouchTarget(self, "center"),
            "bottom-left": TouchTarget(self, "bottom-left"),
            "bottom-right": TouchTarget(self, "bottom-right"),
        }
        for target in self.targets.values():
            self.fixed.put(target, 0, 0)

        self.panel = self.build_panel()
        self.fixed.put(self.panel, 0, 0)

        self.connect("size-allocate", self.on_size_allocate)
        self.connect("key-press-event", self.on_key_press)
        self.connect("delete-event", self.on_delete)

        self.fullscreen()
        self.show_all()
        self.present()
        self.grab_focus()
        # Unter XWayland mehrfach nach vorne holen. Der Touch-Test soll
        # beim Kiosk-Start garantiert vor allen Diagnosefenstern liegen.
        GLib.timeout_add(180, self.force_front)

        display_name = Gdk.Display.get_default().get_name() if Gdk.Display.get_default() else "?"
        print(f"Touch-Tester Backend: X11/XWayland ({display_name})")
        print(f"RGBA-Visual: {'JA' if self.rgba_ok else 'NEIN'}")
        print(f"Compositor: {'JA' if screen.is_composited() else 'NEIN'}")

        if not self.rgba_ok:
            write_state(
                "error",
                completed=0,
                device=device_name or device,
                note="XWayland gestartet, aber kein RGBA-Visual/Compositor verfügbar",
            )
        else:
            write_state(
                "running",
                completed=0,
                device=device_name or device,
                note="XWayland GTK3 RGBA Touch-Tester gestartet",
            )

    def force_front(self):
        if self.finished:
            return False
        self.front_attempts += 1
        try:
            self.set_keep_above(True)
            self.present()
            self.grab_focus()
        except Exception:
            pass
        return self.front_attempts < 12

    def build_panel(self):
        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        outer.set_size_request(350, 105)
        outer.get_style_context().add_class("title-panel")

        title = Gtk.Label(label="TOUCH-TESTER")
        title.get_style_context().add_class("main-title")
        outer.pack_start(title, True, True, 0)

        self.progress_label = Gtk.Label(label="0 / 5")
        self.progress_label.get_style_context().add_class("progress")
        outer.pack_start(self.progress_label, True, True, 0)

        hint = Gtk.Label(label="ESC / STRG+W = Abbruch")
        hint.get_style_context().add_class("hint")
        outer.pack_start(hint, True, True, 0)
        return outer

    def on_size_allocate(self, widget, allocation):
        sw, sh = allocation.width, allocation.height
        tw, th = TouchTarget.W, TouchTarget.H
        mx, my = 125, 85

        pos = {
            "top-left": (mx, my),
            "top-right": (max(mx, sw - mx - tw), my),
            "center": ((sw - tw)//2, (sh - th)//2),
            "bottom-left": (mx, max(my, sh - my - th)),
            "bottom-right": (max(mx, sw - mx - tw), max(my, sh - my - th)),
        }
        for key, (x, y) in pos.items():
            self.fixed.move(self.targets[key], x, y)

        pw, ph = 350, 105
        center_y = (sh - th)//2
        gap = 22
        self.fixed.move(self.panel, (sw - pw)//2, max(12, center_y - ph - gap))

    def update_progress(self):
        self.completed = sum(1 for t in self.targets.values() if t.done)
        self.progress_label.set_text(f"{self.completed} / {TOTAL}")
        write_state(
            "running",
            completed=self.completed,
            device=device_name or device,
            note="XWayland Touch-Test läuft",
        )
        if self.completed == TOTAL:
            self.progress_label.get_style_context().add_class("progress-ready")
            self.progress_label.set_text("5 / 5  ✓")
            GLib.timeout_add(500, self.finish_success)

    def finish_success(self):
        if self.finished:
            return False
        self.finished = True
        write_state(
            "success",
            completed=TOTAL,
            device=device_name or device,
            note="Alle fünf Touch-Flächen erfolgreich getestet (XWayland)",
        )
        Gtk.main_quit()
        return False

    def abort(self):
        if self.finished:
            return
        self.finished = True
        write_state(
            "aborted",
            completed=self.completed,
            device=device_name or device,
            note="Touch-Test durch Benutzer abgebrochen (XWayland)",
        )
        Gtk.main_quit()

    def on_key_press(self, widget, event):
        ctrl = bool(event.state & Gdk.ModifierType.CONTROL_MASK)
        if event.keyval == Gdk.KEY_Escape or (ctrl and event.keyval in (Gdk.KEY_w, Gdk.KEY_W)):
            self.abort()
            return True
        if ctrl and event.keyval in (Gdk.KEY_q, Gdk.KEY_Q):
            if not self.finished:
                self.finished = True
                write_state(
                    "aborted",
                    completed=self.completed,
                    device=device_name or device,
                    note="Touch-Test durch STRG+Q beendet (XWayland)",
                )
            helper = Path.home() / ".local/bin/close-diagnostic-apps.sh"
            try:
                subprocess.Popen(
                    [str(helper)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                )
            except Exception:
                pass
            return True
        return False

    def on_delete(self, *_args):
        self.abort()
        return True


win = TouchWindow()
Gtk.main()
PY
TOUCH_TEST_EOF
    chmod +x "$TOUCH_TEST_SCRIPT"
    mkdir -p "$(dirname "$TOUCH_STATE_FILE")"

    echo "OK: Touch-Tester installiert/aktualisiert."
    echo "Programm: $TOUCH_TEST_SCRIPT"
    echo "Status:   $TOUCH_STATE_FILE"
    return 0
}

install_wipe_auto_app() {
    echo "--- Wipe Auto prüfen ---"

    install_close_apps_helper

    if ! command -v python3 >/dev/null 2>&1; then
        echo "FEHLER: python3 wurde nicht gefunden."
        return 1
    fi
    if ! python3 -c 'import gi; gi.require_version("Gtk","4.0"); from gi.repository import Gtk' >/dev/null 2>&1; then
        echo "GTK4/Python fehlt. Installation wird versucht."

        if sudo -n true 2>/dev/null; then
            sudo -n apt-get install -y python3-gi gir1.2-gtk-4.0 upower util-linux psmisc
        else
            sudo apt-get install -y python3-gi gir1.2-gtk-4.0 upower util-linux psmisc
        fi
    fi
    if ! python3 -c 'import gi; gi.require_version("Gtk","4.0"); from gi.repository import Gtk' >/dev/null 2>&1; then
        echo "FEHLER: GTK4/Python ist nicht verfügbar."
        return 1
    fi

    cat > "$WIPE_AUTO_SCRIPT" <<'WIPE_AUTO_EOF'
#!/usr/bin/env bash
set -u
# ============================================================
# Wipe Auto - GTK4
# ============================================================

for cmd in upower lsblk wipefs partprobe; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "FEHLER: $cmd fehlt."
        exit 10
    fi
done

TMP_PY="$(mktemp /tmp/wipe-auto-XXXXXX.py)"
trap 'rm -f "$TMP_PY"' EXIT

cat > "$TMP_PY" <<'PY'
#!/usr/bin/env python3

import gi
gi.require_version("Gtk", "4.0")

from gi.repository import Gtk, GLib, Gdk
import os
import re
import subprocess
import threading
from pathlib import Path
from datetime import datetime

VERSION = "3.3"
DISK = "/dev/nvme0n1"
BATTERY_BAD_BELOW = 75.0
LOG = Path.home() / "wipe_auto.log"

ENV_C = os.environ.copy()
ENV_C["LC_ALL"] = "C"
ENV_C["LANG"] = "C"

def log(message):
    line = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}  {message}"
    try:
        with LOG.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass
    print(line, flush=True)

def run_text(args, timeout=8):
    try:
        p = subprocess.run(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
            env=ENV_C,
        )
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    except Exception as e:
        return 99, "", str(e)


def sudo_cmd(args, timeout=30):
    return run_text(["sudo", "-n"] + args, timeout=timeout)

def compact_battery_time(seconds):
    if seconds is None:
        return None

    try:
        seconds = float(seconds)
    except Exception:
        return None

    if seconds <= 0 or seconds > 7 * 24 * 3600:
        return None

    minutes = max(1, int(round(seconds / 60.0)))
    hours, mins = divmod(minutes, 60)

    if hours:
        return f"{hours}h {mins:02d}m"

    return f"{mins}m"

def parse_upower_time(value):
    """
    UPower läuft durch ENV_C auf Englisch und liefert z.B.
    '1.5 hours', '42.0 minutes' oder '120 seconds'.
    """
    if not value:
        return None

    m = re.match(
        r"\s*([0-9]+(?:\.[0-9]+)?)\s+"
        r"(second|seconds|minute|minutes|hour|hours|day|days)\s*$",
        value,
        re.I,
    )

    if not m:
        return None

    amount = float(m.group(1))
    unit = m.group(2).lower()
    if unit.startswith("second"):
        return amount
    if unit.startswith("minute"):
        return amount * 60.0
    if unit.startswith("hour"):
        return amount * 3600.0
    if unit.startswith("day"):
        return amount * 86400.0

    return None


def battery_power_w_sysfs(battery_name):
    if not battery_name:
        return None

    base = Path("/sys/class/power_supply") / battery_name
    if not base.exists():
        return None
    def number(name):
        try:
            return float((base / name).read_text().strip())
        except Exception:
            return None

    power_now = number("power_now")
    if power_now is not None and power_now >= 0:
        # µW -> W
        return power_now / 1_000_000.0

    current_now = number("current_now")
    voltage_now = number("voltage_now")
    if (
        current_now is not None
        and voltage_now is not None
        and current_now >= 0
        and voltage_now > 0
    ):
        # µA * µV = 1e-12 W; geteilt durch 1e12.
        return (current_now * voltage_now) / 1_000_000_000_000.0

    return None


def format_battery_power(power_w, state):
    if power_w is None:
        return ""

    try:
        power_w = abs(float(power_w))
    except Exception:
        return ""
    # Solange noch kein sinnvoller Leistungswert vorliegt,
    # nichts anzeigen statt "0.0 W".
    if power_w < 0.05:
        return ""

    state_l = (state or "").strip().lower()

    # Laden positiv, Entladen negativ.
    if state_l == "discharging":
        power_w = -power_w

    return f"{power_w:.1f} W"


def battery_info():
    rc, out, _ = run_text(["upower", "-e"])
    if rc != 0:
        return None, None, None, None
    bat = None
    for line in out.splitlines():
        if "BAT" in line:
            bat = line.strip()
            break

    if not bat:
        return None, None, None, None

    rc, info, _ = run_text(["upower", "-i", bat])
    if rc != 0:
        return None, None, None, None

    health = None
    state = None
    time_to_empty = None
    time_to_full = None
    power_w = None
    for line in info.splitlines():
        m = re.match(r"\s*capacity:\s*([0-9.,]+)%", line, re.I)
        if m:
            try:
                health = float(m.group(1).replace(",", "."))
            except Exception:
                health = None

        m = re.match(r"\s*state:\s*(.+?)\s*$", line, re.I)
        if m:
            state = m.group(1).strip().lower()
        m = re.match(r"\s*time to empty:\s*(.+?)\s*$", line, re.I)
        if m:
            time_to_empty = parse_upower_time(m.group(1))

        m = re.match(r"\s*time to full:\s*(.+?)\s*$", line, re.I)
        if m:
            time_to_full = parse_upower_time(m.group(1))
        # UPower liefert die aktuelle Akku-Leistung in Watt.
        m = re.match(
            r"\s*energy-rate:\s*([0-9.,]+)\s*W\s*$",
            line,
            re.I,
        )
        if m:
            try:
                power_w = float(m.group(1).replace(",", "."))
            except Exception:
                power_w = None
    # Fallback direkt über /sys/class/power_supply/BATx.
    if power_w is None:
        battery_name = bat.rsplit("/", 1)[-1]
        if battery_name.startswith("battery_"):
            battery_name = battery_name[len("battery_"):]
        power_w = battery_power_w_sysfs(battery_name)

    remaining = None

    if state == "discharging":
        remaining = time_to_empty
    elif state in {"charging", "pending-charge"}:
        remaining = time_to_full
    return (
        health,
        state,
        compact_battery_time(remaining),
        power_w,
    )

def disk_details():
    if not Path(DISK).exists():
        return None

    rc, out, _ = run_text(
        ["lsblk", "-dn", "-o", "SIZE,MODEL", DISK]
    )
    if rc != 0:
        return {"size": "--", "model": "--"}

    parts = out.split(None, 1)
    size = parts[0] if parts else "--"
    model = parts[1].strip() if len(parts) > 1 else "--"
    return {"size": size, "model": model}

def disk_is_clean():
    # 1) Keine bekannten Signaturen mehr auf dem Hauptgerät.
    # Das Lesen der Signaturen auf einem Blockgerät benötigt ebenfalls
    # Root-Rechte. Im persistenten Live-System funktioniert sudo -n
    # passwortlos.
    rc, signatures, err = sudo_cmd(["wipefs", "-n", DISK], timeout=10)
    if rc != 0:
        return False, f"Prüfung fehlgeschlagen: {err or 'sudo wipefs -n'}"

    if signatures.strip():
        return False, "Es sind noch Datenträger-Signaturen vorhanden."
    # 2) Keine Partitionen mehr unterhalb des NVMe-Geräts.
    rc, out, err = run_text(["lsblk", "-nr", "-o", "NAME,TYPE", DISK])
    if rc != 0:
        return False, f"Prüfung fehlgeschlagen: {err or 'lsblk'}"

    lines = [line.strip() for line in out.splitlines() if line.strip()]
    child_parts = [
        line for line in lines[1:]
        if line.split()[-1] == "part"
    ]

    if child_parts:
        return False, "Partitionen werden weiterhin vom Kernel erkannt."

    return True, ""

class WipeAutoApp(Gtk.Application):
    def __init__(self):
        super().__init__(application_id="com.david.WipeAuto")
        self.window = None
        self.wiping = False
        self.soh_alert_active = False
        self.soh_blink_on = False

        # Letzte erkannte Größe + Modellbezeichnung der SSD.
        # Diese Information bleibt nach dem Wipe sichtbar.
        self.last_disk_display = None

    def do_activate(self):
        if self.window:
            self.window.present()
            GLib.idle_add(self.focus_wipe_button)
            return
        self.install_css()

        self.window = Gtk.ApplicationWindow(application=self)
        self.window.set_title("Wipe Auto")
        self.window.set_default_size(690, 395)

        key_controller = Gtk.EventControllerKey.new()
        key_controller.connect("key-pressed", self.on_key_pressed)
        self.window.add_controller(key_controller)
        # Sobald Wipe Auto wirklich das aktive Wayland-Fenster wird,
        # den Tastaturfokus sofort auf WIPE SSD legen.
        self.window.connect(
            "notify::is-active",
            self.on_window_active_changed
        )

        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        outer.set_margin_top(8)
        outer.set_margin_bottom(8)
        outer.set_margin_start(10)
        outer.set_margin_end(10)
        # ----------------------------------------------------
        # Kopfzeile
        # ----------------------------------------------------
        top = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)

        title_line = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)
        title_line.set_hexpand(True)

        title = Gtk.Label(label="WIPE AUTO")
        title.set_xalign(0)
        title.add_css_class("main-title")
        version = Gtk.Label(label=f"v{VERSION}")
        version.set_xalign(0)
        version.add_css_class("version")

        title_line.append(title)
        title_line.append(version)

        self.refresh_button = Gtk.Button(label="REFRESH")
        self.refresh_button.add_css_class("action")
        self.refresh_button.set_valign(Gtk.Align.CENTER)
        self.refresh_button.set_focusable(False)
        self.refresh_button.connect("clicked", self.on_refresh)
        top.append(title_line)
        top.append(self.refresh_button)
        outer.append(top)

        # ----------------------------------------------------
        # Akku
        # ----------------------------------------------------
        self.battery_card = Gtk.Box(
            orientation=Gtk.Orientation.VERTICAL,
            spacing=6
        )
        self.battery_card.add_css_class("card")

        bhead = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        btitle = Gtk.Label(label="BATTERY")
        btitle.set_xalign(0)
        btitle.set_hexpand(True)
        btitle.add_css_class("card-title")

        bhead.append(btitle)
        self.battery_card.append(bhead)

        # Links ein kompakteres SoH-Feld, rechts mehr Platz für
        # Status + Restzeit + Lade-/Entladeleistung.
        battery_metrics = Gtk.Box(
            orientation=Gtk.Orientation.HORIZONTAL,
            spacing=8
        )
        battery_metrics.set_homogeneous(False)
        self.health_metric = Gtk.Box(
            orientation=Gtk.Orientation.VERTICAL,
            spacing=2
        )
        self.health_metric.add_css_class("metric")
        self.health_metric.set_size_request(220, -1)
        self.health_metric.set_hexpand(False)

        self.battery_value = Gtk.Label(label="--")
        self.battery_value.add_css_class("metric-value")
        self.battery_value.add_css_class("neutral")

        self.health_metric.append(self.battery_value)
        charging_metric = Gtk.Box(
            orientation=Gtk.Orientation.VERTICAL,
            spacing=2
        )
        charging_metric.add_css_class("metric")
        charging_metric.set_hexpand(True)

        self.charging_value = Gtk.Label(label="--")
        self.charging_value.add_css_class("metric-value")
        self.charging_value.add_css_class("neutral")

        charging_metric.append(self.charging_value)
        battery_metrics.append(self.health_metric)
        battery_metrics.append(charging_metric)
        self.battery_card.append(battery_metrics)

        self.battery_note = Gtk.Label(label="")
        self.battery_note.set_xalign(0)
        self.battery_note.set_wrap(True)
        self.battery_note.add_css_class("note")
        self.battery_card.append(self.battery_note)

        outer.append(self.battery_card)
        # ----------------------------------------------------
        # SSD
        # ----------------------------------------------------
        self.disk_card = Gtk.Box(
            orientation=Gtk.Orientation.VERTICAL,
            spacing=6
        )
        self.disk_card.add_css_class("card")

        dhead = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        dtitle = Gtk.Label(label="SSD")
        dtitle.set_xalign(0)
        dtitle.set_hexpand(True)
        dtitle.add_css_class("card-title")

        self.disk_badge = Gtk.Label(label="CHECKING")
        self.disk_badge.add_css_class("badge")
        self.set_class(self.disk_badge, "warn")

        dhead.append(dtitle)
        dhead.append(self.disk_badge)
        self.disk_card.append(dhead)
        self.disk_device = Gtk.Label(label=DISK)
        self.disk_device.set_xalign(0)
        self.disk_device.add_css_class("interface")
        self.disk_card.append(self.disk_device)

        self.disk_value = Gtk.Label(label="--")
        self.disk_value.set_xalign(0)
        self.disk_value.add_css_class("disk-result")
        self.disk_value.add_css_class("neutral")
        self.disk_card.append(self.disk_value)
        self.disk_note = Gtk.Label(label="")
        self.disk_note.set_xalign(0)
        self.disk_note.set_wrap(True)
        self.disk_note.add_css_class("note")
        self.disk_card.append(self.disk_note)

        self.action_area = Gtk.Box(
            orientation=Gtk.Orientation.HORIZONTAL,
            spacing=8
        )
        self.action_area.set_halign(Gtk.Align.END)
        self.wipe_button = Gtk.Button(label="WIPE SSD")
        self.wipe_button.add_css_class("danger-action")
        self.wipe_button.connect("clicked", self.on_wipe_clicked)
        self.wipe_button.connect(
            "notify::has-focus",
            self.on_wipe_focus_changed
        )

        self.action_area.append(self.wipe_button)
        self.disk_card.append(self.action_area)

        outer.append(self.disk_card)

        self.window.set_child(outer)
        # ENTER soll direkt WIPE SSD auslösen.
        self.window.set_default_widget(self.wipe_button)
        self.wipe_button.grab_focus()

        self.window.present()

        log("Wipe Auto gestartet.")
        self.refresh_all()

        # Charging Status jede Sekunde aktuell halten, ohne SSD-Ergebnis
        # oder Bestätigungszustand anzufassen.
        GLib.timeout_add_seconds(1, self.refresh_battery_timer)
        # Unter 75 % SoH blinkt das komplette linke SoH-Feld rot.
        GLib.timeout_add(450, self.update_soh_blink)
        # Nach dem Refresh Fokus sicher wieder auf WIPE SSD setzen.
        GLib.idle_add(self.focus_wipe_button)

    def install_css(self):
        css = b"""
        window {
            background: #101216;
            color: #f4f4f4;
        }

        .main-title {
            font-size: 17px;
            font-weight: 800;
            letter-spacing: 0.6px;
        }

        .version {
            color: #7f8792;
            font-size: 9px;
            font-weight: 700;
        }
        .card {
            background: #191c22;
            border: 2px solid #303641;
            border-radius: 12px;
            padding: 8px;
        }

        .card-title {
            font-size: 19px;
            font-weight: 800;
        }

        .interface {
            color: #aeb4be;
            font-size: 12px;
        }

        .badge {
            border-radius: 9px;
            padding: 5px 10px;
            font-weight: 800;
        }
        .metric {
            background: #111318;
            border: 2px solid transparent;
            border-radius: 9px;
            padding: 6px 5px;
        }

        .metric.soh-alert {
            background: #9b1414;
            border-color: #ff4c4c;
        }

        .metric.soh-alert .bad {
            color: #ffffff;
            background: transparent;
        }

        .metric-caption {
            color: #8f97a3;
            font-size: 11px;
            font-weight: 700;
        }

        .metric-value {
            font-size: 24px;
            font-weight: 800;
        }
        .disk-result {
            background: #111318;
            border-radius: 9px;
            padding: 8px;
            font-size: 18px;
            font-weight: 800;
        }

        .note {
            color: #aeb4be;
            font-size: 11px;
        }

        .good {
            color: #61d36b;
        }

        .bad {
            color: #ff4c4c;
            background: #3b1212;
        }

        .warn {
            color: #ffb84d;
        }
        .neutral {
            color: #d8dde5;
        }

        .live {
            color: #70c7ff;
        }

        button.action {
            font-weight: 800;
            padding: 1px 12px;
            min-height: 18px;
        }

        button.danger-action {
            font-weight: 800;
            padding: 4px 14px;
        }
        /* Sehr deutlich sichtbarer Tastaturfokus */
        button.danger-action.keyboard-focus,
        button.danger-action:focus {
            background: #1976d2;
            color: #ffffff;
            border-color: #70c7ff;
            outline: 3px solid #70c7ff;
            outline-offset: 2px;
        }

        .confirm-warning {
            color: #ff6464;
            background: #4a1515;
            border-radius: 9px;
            padding: 7px 12px;
            font-weight: 900;
        }
        button.confirm {
            color: #ff6464;
            font-weight: 900;
            padding: 4px 14px;
        }

        button.confirm.keyboard-focus,
        button.confirm:focus {
            background: #1976d2;
            color: #ffffff;
            border-color: #70c7ff;
            outline: 3px solid #70c7ff;
            outline-offset: 2px;
        }

        button.cancel {
            font-weight: 800;
            padding: 4px 14px;
        }
        """
        provider = Gtk.CssProvider()
        provider.load_from_data(css)

        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
        )

    def set_class(self, widget, klass):
        for c in ("good", "bad", "warn", "neutral", "live"):
            widget.remove_css_class(c)
        widget.add_css_class(klass)
    def on_wipe_focus_changed(self, widget, pspec):
        try:
            focused = widget.get_property("has-focus")
        except Exception:
            focused = False

        if focused:
            widget.add_css_class("keyboard-focus")
        else:
            widget.remove_css_class("keyboard-focus")

    def on_window_active_changed(self, window, pspec):
        try:
            active = window.get_property("is-active")
        except Exception:
            active = False
        if active and not self.wiping:
            GLib.idle_add(self.focus_wipe_button)

    def focus_wipe_button(self):
        if (
            self.window is not None
            and not self.wiping
            and self.wipe_button.get_sensitive()
        ):
            self.window.set_default_widget(self.wipe_button)
            self.wipe_button.grab_focus()
        return False
    def on_refresh(self, button):
        if not self.wiping:
            # Nach einem erfolgreichen Wipe ist der WIPE-Button bewusst
            # ausgeblendet. REFRESH setzt die SSD-Karte wieder auf den
            # normalen Ausgangszustand zurück.
            self.restore_wipe_button()
            self.refresh_all()
            GLib.idle_add(self.focus_wipe_button)

    def refresh_battery(self):
        health, state, remaining, power_w = battery_info()
        power_text = format_battery_power(power_w, state)
        self.set_soh_alert(
            health is not None and health < BATTERY_BAD_BELOW
        )
        # ----------------------------------------------------
        # LINKS: nur State of Health
        # ----------------------------------------------------
        if health is None:
            self.battery_value.set_text("-- SoH")
            self.set_class(self.battery_value, "warn")
            self.battery_note.set_text(
                "Akku nicht erkannt oder Battery Health konnte nicht gelesen werden."
            )
        elif health < BATTERY_BAD_BELOW:
            self.battery_value.set_text(f"{health:.1f} % SoH")
            self.set_class(self.battery_value, "bad")
            self.battery_note.set_text(
                f"Akku unter {BATTERY_BAD_BELOW:.0f} % – Gerät prüfen!"
            )
        else:
            self.battery_value.set_text(f"{health:.1f} % SoH")
            self.set_class(self.battery_value, "good")
            self.battery_note.set_text(
                "Battery Health innerhalb der Prüfgrenze."
            )
        # ----------------------------------------------------
        # RECHTS: Charging/Discharging + Restzeit + Leistung
        # ----------------------------------------------------
        charging_states = {
            "charging",
            "fully-charged",
            "pending-charge",
        }

        if state in charging_states:
            if state == "fully-charged":
                parts = ["Fully Charged"]
            else:
                parts = ["Charging"]
                if remaining:
                    parts.append(remaining)

            if power_text:
                parts.append(power_text)

            self.charging_value.set_text(" · ".join(parts))
            self.set_class(self.charging_value, "good")

        elif state is None:
            parts = ["--"]

            if power_text:
                parts.append(power_text)

            self.charging_value.set_text(" · ".join(parts))
            self.set_class(self.charging_value, "warn")
        else:
            parts = ["Discharging"]

            if remaining:
                parts.append(remaining)

            if power_text:
                parts.append(power_text)

            self.charging_value.set_text(" · ".join(parts))
            self.set_class(self.charging_value, "warn")

    def set_soh_alert(self, active):
        active = bool(active)
        if active == self.soh_alert_active:
            return

        self.soh_alert_active = active
        self.soh_blink_on = active

        if active:
            self.health_metric.add_css_class("soh-alert")
        else:
            self.health_metric.remove_css_class("soh-alert")

    def update_soh_blink(self):
        if self.window is None:
            return False

        if not self.soh_alert_active:
            self.soh_blink_on = False
            self.health_metric.remove_css_class("soh-alert")
            return True

        self.soh_blink_on = not self.soh_blink_on
        if self.soh_blink_on:
            self.health_metric.add_css_class("soh-alert")
        else:
            self.health_metric.remove_css_class("soh-alert")

        return True

    def refresh_battery_timer(self):
        if self.window is None:
            return False

        self.refresh_battery()
        return True

    def refresh_all(self):
        self.refresh_battery()
        # SSD
        details = disk_details()
        if details is None:
            self.disk_badge.set_text("NOT FOUND")
            self.set_class(self.disk_badge, "warn")
            self.disk_value.set_text("SSD NICHT GEFUNDEN")
            self.set_class(self.disk_value, "warn")
            self.disk_note.set_text(
                f"{DISK} ist nicht vorhanden – Hardware prüfen."
            )
            self.wipe_button.set_sensitive(False)
        else:
            self.disk_badge.set_text("READY")
            self.set_class(self.disk_badge, "neutral")
            self.last_disk_display = (
                f"{details['size']}  •  {details['model']}"
            )

            self.disk_value.set_text(self.last_disk_display)
            self.set_class(self.disk_value, "neutral")
            self.disk_note.set_text("Bereit zum Löschen.")
            self.wipe_button.set_sensitive(True)
    def clear_action_area(self):
        child = self.action_area.get_first_child()
        while child:
            nxt = child.get_next_sibling()
            self.action_area.remove(child)
            child = nxt
    def restore_wipe_button(self):
        self.clear_action_area()
        self.action_area.set_hexpand(False)
        self.action_area.set_halign(Gtk.Align.END)
        self.action_area.append(self.wipe_button)
        self.wipe_button.set_sensitive(True)
        self.window.set_default_widget(self.wipe_button)

    def on_wipe_clicked(self, button):
        if self.wiping:
            return

        self.clear_action_area()
        # Bestätigungszeile über die verfügbare Breite ziehen.
        self.action_area.set_halign(Gtk.Align.FILL)
        self.action_area.set_hexpand(True)

        warning = Gtk.Label(label="WIRKLICH LÖSCHEN?")
        warning.set_xalign(0)
        warning.set_hexpand(True)
        warning.add_css_class("confirm-warning")
        yes = Gtk.Button(label="YES")
        yes.add_css_class("confirm")
        yes.connect("clicked", self.on_confirm_wipe)
        yes.connect(
            "notify::has-focus",
            self.on_wipe_focus_changed
        )

        cancel = Gtk.Button(label="CANCEL")
        cancel.add_css_class("cancel")
        cancel.connect("clicked", self.on_cancel_wipe)

        self.action_area.append(warning)
        self.action_area.append(cancel)
        self.action_area.append(yes)
        # Zweites ENTER bestätigt direkt mit YES.
        self.window.set_default_widget(yes)
        yes.grab_focus()

        self.disk_badge.set_text("CONFIRM")
        self.set_class(self.disk_badge, "warn")
        self.disk_note.set_text(
            f"Alle Partitions-/Dateisystem-Signaturen auf {DISK} werden entfernt."
        )

    def on_cancel_wipe(self, button):
        if self.wiping:
            return
        self.restore_wipe_button()
        self.refresh_all()
        GLib.idle_add(self.focus_wipe_button)

    def on_confirm_wipe(self, button):
        if self.wiping:
            return

        self.wiping = True
        self.refresh_button.set_sensitive(False)

        self.clear_action_area()

        self.disk_badge.set_text("WIPING")
        self.set_class(self.disk_badge, "live")
        if self.last_disk_display:
            self.disk_value.set_text(
                f"{self.last_disk_display} • Wird Gelöscht …"
            )
        else:
            self.disk_value.set_text("SSD WIRD GELÖSCHT …")

        self.set_class(self.disk_value, "live")
        self.disk_note.set_text("Bitte warten.")

        thread = threading.Thread(target=self.wipe_worker, daemon=True)
        thread.start()

    def wipe_worker(self):
        log(f"Wipe gestartet: {DISK}")
        # Sicherheitscheck: Zielgerät muss existieren und ein block device sein.
        if not Path(DISK).exists():
            GLib.idle_add(
                self.finish_wipe_error,
                f"{DISK} wurde nicht gefunden."
            )
            return

        # Alle Child-Partitionen zuerst aushängen.
        rc, out, _ = run_text(["lsblk", "-nrpo", "NAME,TYPE", DISK])
        if rc == 0:
            children = []
            for line in out.splitlines()[1:]:
                parts = line.split()
                if len(parts) >= 2 and parts[-1] == "part":
                    children.append(parts[0])

            for part in reversed(children):
                sudo_cmd(["umount", part], timeout=10)
                sudo_cmd(["fuser", "-k", part], timeout=10)
        # Hauptgerät vorsichtshalber ebenfalls unmount/fuser.
        sudo_cmd(["umount", DISK], timeout=10)
        sudo_cmd(["fuser", "-k", DISK], timeout=10)

        # Eigentliche destruktive Aktion.
        rc, out, err = sudo_cmd(["wipefs", "-a", DISK], timeout=30)
        if rc != 0:
            log(f"wipefs FEHLER rc={rc}: {err}")
            GLib.idle_add(
                self.finish_wipe_error,
                f"wipefs fehlgeschlagen: {err or 'unbekannter Fehler'}"
            )
            return

        # Kernel-Partitionstabelle neu einlesen.
        sudo_cmd(["partprobe", DISK], timeout=15)

        clean, reason = disk_is_clean()
        if not clean:
            log(f"Verifikation FEHLER: {reason}")
            GLib.idle_add(
                self.finish_wipe_error,
                reason
            )
            return

        log(f"Wipe erfolgreich verifiziert: {DISK}")
        GLib.idle_add(self.finish_wipe_success)

    def finish_wipe_success(self):
        self.wiping = False
        self.refresh_button.set_sensitive(True)

        self.disk_badge.set_text("PASS")
        self.set_class(self.disk_badge, "good")
        if self.last_disk_display:
            self.disk_value.set_text(
                f"{self.last_disk_display} • Erfolgreich Gelöscht"
            )
        else:
            self.disk_value.set_text("Erfolgreich Gelöscht")

        self.set_class(self.disk_value, "good")

        self.disk_note.set_text(
            f"{DISK}: keine Signaturen und keine Partitionen mehr erkannt."
        )

        self.clear_action_area()
        # Nach Erfolg bewusst NICHT refresh_all() aufrufen:
        # Der Erfolg soll sichtbar stehen bleiben.
        return False

    def finish_wipe_error(self, message):
        self.wiping = False
        self.refresh_button.set_sensitive(True)

        self.disk_badge.set_text("ERROR")
        self.set_class(self.disk_badge, "bad")
        if self.last_disk_display:
            self.disk_value.set_text(
                f"{self.last_disk_display} • Löschen Fehlgeschlagen"
            )
        else:
            self.disk_value.set_text("Löschen Fehlgeschlagen")

        self.set_class(self.disk_value, "bad")

        self.disk_note.set_text(message)

        self.restore_wipe_button()
        return False

    def on_key_pressed(self, controller, keyval, keycode, state):
        name = Gdk.keyval_name(keyval) or ""
        if state & Gdk.ModifierType.CONTROL_MASK:
            if name.lower() == "w":
                self.quit()
                return True
            if name.lower() == "q":
                helper = Path.home() / ".local/bin/close-diagnostic-apps.sh"
                try:
                    subprocess.Popen(
                        [str(helper)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        start_new_session=True,
                    )
                except Exception as exc:
                    log(f"Strg+Q Fehler: {exc}")
                return True
        return False

    def do_shutdown(self):
        log("Wipe Auto beendet.")
        Gtk.Application.do_shutdown(self)


app = WipeAutoApp()
raise SystemExit(app.run(None))
PY

python3 "$TMP_PY"
WIPE_AUTO_EOF

    chmod +x "$WIPE_AUTO_SCRIPT"
    cat > "$WIPE_AUTO_APP_DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=Wipe Auto
Comment=Battery Health und SSD Wipe
Exec=$WIPE_AUTO_SCRIPT
Icon=drive-harddisk-symbolic
Terminal=false
StartupNotify=true
StartupWMClass=com.david.WipeAuto
Categories=Utility;System;
NoDisplay=false
EOF

    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "$APP_DIR" >/dev/null 2>&1 || true
    fi
    echo "OK: Wipe Auto GTK-App installiert/aktualisiert."
    echo "App-ID: com.david.WipeAuto"
    echo "Programm: $WIPE_AUTO_SCRIPT"
    echo "Desktop:  $WIPE_AUTO_APP_DESKTOP"

    return 0
}


install_hardware_check_app() {
    echo
    echo "--- Hardware Check installieren / aktualisieren ---"

    install_close_apps_helper
    install_force_update_helper

    cat > "$HARDWARE_CHECK_SCRIPT" <<'HARDWARE_CHECK_EOF'
#!/usr/bin/env bash
set -u

TMP_PY="$(mktemp /tmp/hardware-check.XXXXXX.py)"
trap 'rm -f "$TMP_PY"' EXIT
cat > "$TMP_PY" <<'PY'
#!/usr/bin/env python3
import gi
gi.require_version("Gtk", "4.0")
gi.require_version("Gdk", "4.0")

from gi.repository import Gtk, Gdk, GLib
from pathlib import Path
import glob
import json
import math
import os
import re
import shutil
import signal
import struct
import subprocess
import sys
import tempfile
import threading
import time
import wave
import select

APP_ID = "com.david.HardwareCheck"
LOG_FILE = Path.home() / "hardware_check.log"

SYS_USB = Path("/sys/bus/usb/devices")
SYS_TYPEC = Path("/sys/class/typec")
CSS = """
window { background: #17171c; color: #f4f4f5; }
.header-title { font-size: 22px; font-weight: 800; }
.header-version { color: #8f8f99; font-size: 10px; font-weight: 700; padding-top: 7px; }
.card { background: #232329; border: 1px solid #34343c; border-radius: 14px; padding: 10px; }
.card-title { color: #aaaaaf; font-size: 9px; font-weight: 700; }
.big-status { font-size: 14px; font-weight: 800; }
.status-green { color: #48d17a; }
.status-blue { color: #5aa2ff; }
.status-orange { color: #f5a623; }
.status-yellow { color: #ffd34d; }
.status-red { color: #ff5c5c; }
.muted { color: #9d9da7; font-size: 10px; }
button.action { min-height: 44px; border-radius: 10px; font-weight: 800; }
button.action-orange { background: #3a3020; color: #f5a623; border: 1px solid #71501c; }
button.action-green { background: #1d3c29; color: #48d17a; border: 1px solid #2e7547; }
button.secondary { min-height: 34px; border-radius: 9px; }
button.speaker-button {
    min-height: 26px;
    min-width: 44px;
    padding: 0px 6px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 800;
}

button.refresh-button {
    min-height: 28px;
    padding: 2px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 800;
}


button.tiny-button {
    min-height: 25px;
    padding: 0px 8px;
    border-radius: 7px;
    font-size: 10px;
    font-weight: 800;
}
button.benchmark-open {
    min-height: 27px;
    padding: 1px 8px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 800;
}

button.benchmark-choice {
    min-height: 48px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 800;
}

.benchmark-status {
    font-size: 13px;
    font-weight: 800;
}

.benchmark-result {
    font-size: 15px;
    font-weight: 800;
}

.speaker-card {
    padding-top: 5px;
    padding-bottom: 5px;
}
button.speaker-both {
    min-height: 26px;
    min-width: 44px;
    padding: 0px 6px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 800;
}
.usb-row {
    background: #1d1d22;
    border: 1px solid #34343c;
    border-radius: 8px;
    padding: 4px 8px;
}
.usb-port-name { font-size: 11px; font-weight: 800; }
.usb-port-state { font-size: 9px; font-weight: 800; }
.key {
    background: #292930;
    color: #e8e8ea;
    border: 1px solid #44444e;
    border-radius: 6px;
    padding: 2px 4px;
    font-size: 9px;
    font-weight: 700;
}
.key-tested { background: #1e6b3b; color: #ffffff; border-color: #45d47a; }
.key-tested-blue { background: #245ea8; color: #ffffff; border-color: #5a9df2; }
.progress-label { font-size: 14px; font-weight: 800; }
.info-title { font-size: 20px; font-weight: 800; }
.info-card {
    background: #232329;
    border: 1px solid #34343c;
    border-radius: 14px;
    padding: 14px;
}
.info-label {
    color: #9d9da7;
    font-size: 11px;
    font-weight: 700;
}
.info-value {
    color: #f4f4f5;
    font-size: 14px;
    font-weight: 800;
}
button.info-serial-link {
    color: #5aa2ff;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 2px 6px;
    min-height: 24px;
    font-size: 14px;
    font-weight: 800;
}
button.info-serial-link:focus {
    background: #1d2f4a;
    border-color: #5aa2ff;
    outline: 2px solid #5aa2ff;
    outline-offset: 1px;
}
.hotkey-grid {
    background: #232329;
    border: 1px solid #34343c;
    border-radius: 14px;
    padding: 12px;
}
.hotkey-key {
    color: #70c7ff;
    font-size: 12px;
    font-weight: 900;
}
.hotkey-desc {
    color: #f4f4f5;
    font-size: 12px;
    font-weight: 700;
}
.hotkey-note {
    color: #9d9da7;
    font-size: 10px;
}
.update-status {
    background: #232329;
    border: 1px solid #34343c;
    border-radius: 10px;
    padding: 12px;
    color: #f4f4f5;
    font-size: 14px;
    font-weight: 800;
}
"""
def log(msg):
    try:
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')}  {msg}\n")
    except Exception:
        pass

def read_text(path):
    try:
        return Path(path).read_text(encoding="utf-8", errors="ignore").strip()
    except Exception:
        return ""

def detect_tpm():
    tpm = Path("/sys/class/tpm/tpm0")
    if not tpm.exists():
        return "red", "TPM AUS", "Kein TPM erkannt"
    for p in (tpm/"tpm_version_major", tpm/"device"/"tpm_version_major"):
        v = read_text(p)
        if v == "2":
            return "green", "TPM 2.0 AN", "TPM 2.0 erkannt"
        if v == "1":
            return "orange", "TPM AN", "TPM 1.x erkannt"

    if Path("/dev/tpmrm0").exists():
        return "green", "TPM 2.0 AN", "TPM 2.0 Resource Manager erkannt"

    caps = read_text(tpm/"caps").lower()
    if "2.0" in caps:
        return "green", "TPM 2.0 AN", "TPM 2.0 erkannt"
    return "orange", "TPM AN", "TPM vorhanden, Version nicht eindeutig"
def detect_secure_boot():
    if shutil.which("mokutil"):
        try:
            env = os.environ.copy()
            env["LC_ALL"] = "C"
            p = subprocess.run(["mokutil", "--sb-state"], capture_output=True, text=True, timeout=3, env=env)
            s = (p.stdout + " " + p.stderr).lower()
            if "secureboot enabled" in s or "secure boot enabled" in s:
                return "green", "SECURE BOOT AN", "UEFI Secure Boot aktiv"
            if "secureboot disabled" in s or "secure boot disabled" in s:
                return "orange", "SECURE BOOT AUS", "UEFI Secure Boot deaktiviert"
        except Exception:
            pass
    for f in glob.glob("/sys/firmware/efi/efivars/SecureBoot-*"):
        try:
            b = Path(f).read_bytes()
            if len(b) >= 5:
                return ("green", "SECURE BOOT AN", "UEFI Secure Boot aktiv") if b[4] == 1 else ("orange", "SECURE BOOT AUS", "UEFI Secure Boot deaktiviert")
        except Exception:
            pass

    return "orange", "SECURE BOOT AUS", "Secure Boot nicht aktiv/ermittelbar"
def read_float(path):
    try:
        return float(read_text(path))
    except Exception:
        return None


def natural_key(value):
    return [
        int(part) if part.isdigit() else part.lower()
        for part in re.split(r"(\d+)", str(value))
    ]


def symlink_target(path):
    try:
        if path.exists() or path.is_symlink():
            return str(path.resolve())
    except Exception:
        pass
    return ""


def root_usb_hubs():
    result = []
    if not SYS_USB.exists():
        return result

    for link in sorted(SYS_USB.glob("usb*"), key=lambda p: natural_key(p.name)):
        if not re.fullmatch(r"usb\d+", link.name):
            continue

        bus = link.name[3:]
        speed = read_float(link / "speed") or 0.0

        try:
            resolved = link.resolve()
        except Exception:
            continue

        interface = resolved / f"{bus}-0:1.0"
        if not interface.exists():
            candidates = sorted(
                resolved.glob(f"{bus}-0:*"),
                key=lambda p: natural_key(p.name),
            )
            interface = candidates[0] if candidates else None

        if not interface or not interface.exists():
            continue

        result.append({
            "bus": bus,
            "speed": speed,
            "root": resolved,
            "interface": interface,
        })

    return result

def port_number_from_name(name):
    m = re.search(r"-port(\d+)$", name)
    if not m:
        return None
    return int(m.group(1))


def port_device_name(bus, port_no):
    return f"{bus}-{port_no}"


def collect_root_port_objects(include_unknown=False, superspeed_only=False):
    objects = []

    for hub in root_usb_hubs():
        if superspeed_only and hub["speed"] <= 480.0:
            continue

        pattern = f"usb{hub['bus']}-port*"
        for port in sorted(
            hub["interface"].glob(pattern),
            key=lambda p: natural_key(p.name),
        ):
            connect_type = read_text(port / "connect_type").lower()
            port_no = port_number_from_name(port.name)

            if port_no is None:
                continue

            if not include_unknown and connect_type != "hotplug":
                continue
            if include_unknown and connect_type in {"hardwired", "not used", "unused"}:
                continue

            peer = symlink_target(port / "peer")
            connector = symlink_target(port / "connector")
            objects.append({
                "path": str(port.resolve()),
                "name": port.name,
                "bus": hub["bus"],
                "port_no": port_no,
                "speed": hub["speed"],
                "connect_type": connect_type or "unknown",
                "peer": peer,
                "connector": connector,
                "device_name": port_device_name(hub["bus"], port_no),
            })

    return objects

def canonical_group_key(obj):
    paths = [obj["path"]]
    if obj["peer"]:
        paths.append(obj["peer"])
    return " | ".join(sorted(set(paths)))


def group_physical_ports(objects):
    groups = {}

    for obj in objects:
        key = canonical_group_key(obj)
        groups.setdefault(key, []).append(obj)

    changed = True
    while changed:
        changed = False
        keys = list(groups)

        for i, key_a in enumerate(keys):
            if key_a not in groups:
                continue
            paths_a = {
                item["path"] for item in groups[key_a]
            } | {
                item["peer"] for item in groups[key_a] if item["peer"]
            }

            for key_b in keys[i + 1:]:
                if key_b not in groups:
                    continue

                paths_b = {
                    item["path"] for item in groups[key_b]
                } | {
                    item["peer"] for item in groups[key_b] if item["peer"]
                }
                if paths_a & paths_b:
                    groups[key_a].extend(groups.pop(key_b))
                    changed = True
                    break

            if changed:
                break

    result = []

    for idx, items in enumerate(groups.values(), 1):
        unique = {}
        for item in items:
            unique[item["path"]] = item
        items = list(unique.values())
        typec_name = None
        for item in items:
            connector = item["connector"]
            if not connector:
                continue

            base = Path(connector).name
            if re.fullmatch(r"port\d+", base):
                typec_name = base
                break

            m = re.search(r"/(port\d+)(?:/|$)", connector)
            if m:
                typec_name = m.group(1)
                break
        result.append({
            "key": f"physical-{idx}",
            "raw_key": " | ".join(sorted(x["path"] for x in items)),
            "items": items,
            "typec_name": typec_name,
        })

    return result


def discover_typec_ports():
    result = []

    if not SYS_TYPEC.exists():
        return result

    for path in sorted(SYS_TYPEC.glob("port*"), key=lambda p: natural_key(p.name)):
        if not re.fullmatch(r"port\d+", path.name):
            continue
        result.append({
            "name": path.name,
            "path": str(path.resolve()),
            "partner": (path / f"{path.name}-partner"),
        })

    return result


def group_present(group):
    for item in group["items"]:
        if (SYS_USB / item["device_name"]).exists():
            return True
    return False

def boot_usb_device_name():
    try:
        source = subprocess.check_output(
            ["findmnt", "-n", "-o", "SOURCE", "/cdrom"],
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=2,
        ).strip()

        if not source.startswith("/dev/"):
            return None

        parent = subprocess.check_output(
            ["lsblk", "-no", "PKNAME", source],
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=2,
        ).strip()
        if not parent:
            return None

        dev = (Path("/sys/class/block") / parent / "device").resolve()

        for part in reversed(dev.parts):
            if re.fullmatch(r"\d+-\d+(?:\.\d+)*", part):
                return part

    except Exception:
        pass

    return None


def discover_physical_ports():
    mode = "hotplug"
    objects = collect_root_port_objects(
        include_unknown=False,
        superspeed_only=False,
    )
    if not objects:
        mode = "fallback-superspeed"
        objects = collect_root_port_objects(
            include_unknown=True,
            superspeed_only=True,
        )

    if not objects:
        mode = "fallback-usb"
        objects = collect_root_port_objects(
            include_unknown=True,
            superspeed_only=False,
        )

    groups = group_physical_ports(objects)
    typec = discover_typec_ports()

    raw_count = len(groups)
    c_count_hint = min(len(typec), len(groups))
    a_map = {}
    c_map = {}
    classification = "generic"

    def group_max_speed(group):
        values = [float(item.get("speed") or 0.0) for item in group["items"]]
        return max(values) if values else 0.0

    def group_port_numbers(group):
        return sorted({
            int(item["port_no"])
            for item in group["items"]
            if item.get("port_no") is not None
        })

    def group_has_peer(group):
        return any(bool(item.get("peer")) for item in group["items"])
    unpaired_ss = [
        g for g in groups
        if not group_has_peer(g) and group_max_speed(g) > 480.0
    ]

    unpaired_usb2 = [
        g for g in groups
        if not group_has_peer(g) and group_max_speed(g) <= 480.0
    ]

    ss_by_port = {}
    usb2_by_port = {}

    for group in unpaired_ss:
        ports = group_port_numbers(group)
        if len(ports) == 1:
            ss_by_port[ports[0]] = group
    for group in unpaired_usb2:
        ports = group_port_numbers(group)
        if len(ports) == 1:
            usb2_by_port[ports[0]] = group

    common_ports = sorted(set(ss_by_port) & set(usb2_by_port))

    if c_count_hint > 0 and len(common_ports) >= c_count_hint:
        classification = "ucsi-companion-topology"
        c_ports = common_ports[:c_count_hint]
        used_keys = set()
        for idx, port_no in enumerate(c_ports):
            ss_group = ss_by_port[port_no]
            usb2_group = usb2_by_port[port_no]

            c_map[ss_group["raw_key"]] = idx
            c_map[usb2_group["raw_key"]] = idx
            used_keys.add(ss_group["raw_key"])
            used_keys.add(usb2_group["raw_key"])
        a_groups = [g for g in groups if g["raw_key"] not in used_keys]
        a_groups.sort(
            key=lambda g: (
                min(group_port_numbers(g) or [999]),
                g["raw_key"],
            )
        )

        for idx, group in enumerate(a_groups):
            a_map[group["raw_key"]] = idx

        c_count = len(c_ports)
        a_count = len(a_groups)
        physical_total = a_count + c_count
    else:
        classification = "generic-fallback"
        direct_c = [g for g in groups if g.get("typec_name")]
        direct_c.sort(key=lambda g: natural_key(g.get("typec_name") or ""))

        for idx, group in enumerate(direct_c):
            c_map[group["raw_key"]] = idx

        c_count = max(len(direct_c), c_count_hint)
        c_count = min(c_count, len(groups))
        used_keys = set(c_map)
        a_groups = [g for g in groups if g["raw_key"] not in used_keys]
        if c_count > 0 and len(groups) >= 2 * c_count:
            physical_total = max(c_count, len(groups) - c_count)
        else:
            physical_total = len(groups)

        a_count = max(0, physical_total - c_count)

        for idx, group in enumerate(a_groups[:a_count]):
            a_map[group["raw_key"]] = idx
    return {
        "mode": mode,
        "classification": classification,
        "groups": groups,
        "typec": typec,
        "raw_group_count": raw_count,
        "physical_total": physical_total,
        "usb_a_count": a_count,
        "usb_c_count": c_count,
        "a_map": a_map,
        "c_map": c_map,
    }


def usb_device_snapshot():
    result = {}

    if not SYS_USB.exists():
        return result
    for dev in SYS_USB.iterdir():
        name = dev.name
        if not re.fullmatch(r"\d+-\d+(?:\.\d+)*", name):
            continue
        if not (dev / "idVendor").exists():
            continue

        maker = read_text(dev / "manufacturer")
        product = read_text(dev / "product")
        title = " ".join(x for x in (maker, product) if x).strip() or "USB-Gerät"
        result[name] = title

    return result

def group_contains_device(group, device_name):
    if not device_name:
        return False

    for item in group["items"]:
        root_name = item["device_name"]
        if device_name == root_name or device_name.startswith(root_name + "."):
            return True

    return False


def group_min_port(group):
    ports = [
        int(item["port_no"])
        for item in group["items"]
        if item.get("port_no") is not None
    ]
    return min(ports) if ports else 999
def make_tone(channel):
    # Kurzer, weicher 3-Ton-Testklang: C5 - E5 - G5.
    # Derselbe Klang wird ausschließlich auf dem gewählten Stereokanal
    # ausgegeben. Nicht zu laut, damit der Test angenehm bleibt.
    sr = 48000
    amp = 0.22
    notes = [
        (523.25, 0.18),  # C5
        (659.25, 0.18),  # E5
        (783.99, 0.28),  # G5
    ]
    gap = 0.035

    path = Path(tempfile.gettempdir()) / f"hardware-check-{channel}.wav"

    frames = bytearray()
    def add_sample(left, right):
        frames.extend(struct.pack("<hh", left, right))

    for note_index, (freq, duration) in enumerate(notes):
        count = int(sr * duration)

        for i in range(count):
            # Sanfter Ein-/Ausklang je Ton.
            fade_len = max(1, int(sr * 0.025))
            fade_in = min(1.0, i / fade_len)
            fade_out = min(1.0, (count - 1 - i) / fade_len)
            envelope = max(0.0, min(fade_in, fade_out))
            # Grundton + sehr leise zweite Harmonische, damit es
            # weniger nach technischem Sinuston klingt.
            t = i / sr
            sample = (
                math.sin(2 * math.pi * freq * t)
                + 0.16 * math.sin(2 * math.pi * freq * 2 * t)
            ) / 1.16

            value = int(32767 * amp * envelope * sample)
            if channel == "left":
                left, right = value, 0
            elif channel == "right":
                left, right = 0, value
            else:
                left, right = value, value

            add_sample(left, right)

        if note_index != len(notes) - 1:
            for _ in range(int(sr * gap)):
                add_sample(0, 0)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(bytes(frames))

    return path
def read_cpu_temperature():
    """
    CPU-Package-/Die-Temperatur in °C.
    Ein Fehler bei Sensoren darf den Benchmark NIEMALS verhindern.
    """
    def read_text(path):
        try:
            return Path(path).read_text(
                encoding="utf-8",
                errors="ignore",
            ).strip()
        except Exception:
            return ""

    try:
        preferred = []
        fallback = []
        for hwmon in Path("/sys/class/hwmon").glob("hwmon*"):
            name = read_text(hwmon / "name").lower()

            if name not in {
                "coretemp",
                "k10temp",
                "zenpower",
                "cpu_thermal",
                "cpu-thermal",
            }:
                continue
            for temp_file in hwmon.glob("temp*_input"):
                try:
                    raw = float(temp_file.read_text().strip())
                    value = raw / 1000.0 if raw > 500 else raw
                except Exception:
                    continue

                if not (-20.0 <= value <= 130.0):
                    continue

                stem = temp_file.name.replace("_input", "")
                label = read_text(hwmon / f"{stem}_label").lower()
                if any(
                    token in label
                    for token in (
                        "package",
                        "tctl",
                        "tdie",
                        "cpu",
                    )
                ):
                    preferred.append(value)
                else:
                    fallback.append(value)

        values = preferred or fallback
        if values:
            return max(values)
        for zone in Path("/sys/class/thermal").glob("thermal_zone*"):
            ztype = read_text(zone / "type").lower()

            if not any(
                token in ztype
                for token in (
                    "x86_pkg_temp",
                    "cpu",
                    "soc",
                    "package",
                )
            ):
                continue
            try:
                raw = float((zone / "temp").read_text().strip())
                value = raw / 1000.0 if raw > 500 else raw
            except Exception:
                continue

            if -20.0 <= value <= 130.0:
                return value

    except Exception:
        # Temperaturanzeige ist Zusatzinformation.
        # Der Benchmark muss trotzdem immer starten.
        pass

    return None

CPU_BENCH_WORKER = r"""
import hashlib
import multiprocessing as mp
import os
import queue
import sys
import time

duration = float(sys.argv[1])
workers = max(1, int(sys.argv[2]))

def worker(deadline, q, seed):
    count = 0
    block = (b"Uwuntu-CPU-Benchmark-" + bytes([seed & 0xff])) * 64
    digest = hashlib.sha256(block).digest()

    while time.monotonic() < deadline:
        digest = hashlib.sha256(digest + block).digest()
        count += 1

    q.put(count)
if __name__ == "__main__":
    ctx = mp.get_context("fork")
    q = ctx.Queue()
    start = time.monotonic()
    deadline = start + duration

    procs = [
        ctx.Process(target=worker, args=(deadline, q, i))
        for i in range(workers)
    ]

    for p in procs:
        p.start()

    for p in procs:
        p.join()

    total = 0
    for _ in procs:
        try:
            total += q.get(timeout=1.0)
        except queue.Empty:
            pass
    elapsed = max(0.001, time.monotonic() - start)
    print(f"RESULT CPU {total} {elapsed:.6f} {workers}", flush=True)
"""

RAM_TEST_WORKER = r"""
import mmap
import os
import sys
import time

duration = float(sys.argv[1])
mode = sys.argv[2]

MIB = 1024 * 1024
GIB = 1024 * MIB
CHUNK = 1 * MIB
def mem_available():
    try:
        with open("/proc/meminfo", "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("MemAvailable:"):
                    return int(line.split()[1]) * 1024
    except Exception:
        pass
    return 512 * MIB

available = mem_available()
# Genug RAM für GNOME / Live-System freilassen.
reserve = max(768 * MIB, int(available * 0.25))
usable = max(64 * MIB, available - reserve)

if mode == "short":
    target = min(usable, 512 * MIB)
    patterns = [0x00, 0xFF, 0xAA, 0x55]
else:
    target = min(usable, int(available * 0.65), 8 * GIB)
    patterns = [0x00, 0xFF, 0xAA, 0x55, 0x33, 0xCC, 0x0F, 0xF0]

target = max(64 * MIB, int(target))
target = (target // CHUNK) * CHUNK
try:
    mem = mmap.mmap(-1, target, access=mmap.ACCESS_WRITE)
except Exception as exc:
    print(f"ERROR RAM Speicherreservierung fehlgeschlagen: {exc}", flush=True)
    raise SystemExit(2)

start = time.monotonic()
deadline = start + duration
checked = 0
errors = 0
passes = 0

try:
    while time.monotonic() < deadline:
        for pattern in patterns:
            expected = bytes([pattern]) * CHUNK
            # Schreiben: alle Seiten wirklich anfassen.
            for offset in range(0, target, CHUNK):
                end = min(offset + CHUNK, target)
                mem[offset:end] = expected[:end-offset]

            # Lesen + vergleichen.
            for offset in range(0, target, CHUNK):
                end = min(offset + CHUNK, target)
                data = mem[offset:end]
                if data != expected[:end-offset]:
                    errors += 1
                checked += end - offset
            passes += 1

            if time.monotonic() >= deadline:
                break
finally:
    mem.close()

elapsed = max(0.001, time.monotonic() - start)
print(
    f"RESULT RAM {errors} {checked} {elapsed:.6f} {target} {passes}",
    flush=True,
)
"""


def get_keyboard_event_paths():
    """Linux-event-Geräte ermitteln, die wirklich als Tastatur (kbd) gelten.

    /proc/bus/input/devices ist auch ohne Root lesbar und nennt pro Gerät die
    Handler, z. B. ``Handlers=sysrq kbd event3 leds``. Damit vermeiden wir,
    dass ein lesbares Touchpad-/Sensor-event fälschlich als funktionierender
    globaler Tastaturzugriff gewertet wird.
    """
    paths = set()
    try:
        text = Path("/proc/bus/input/devices").read_text(
            encoding="utf-8", errors="ignore"
        )
        for block in text.split("\n\n"):
            handlers = ""
            for line in block.splitlines():
                if line.startswith("H: Handlers="):
                    handlers = line.split("=", 1)[1].strip()
                    break
            tokens = handlers.split()
            if "kbd" not in tokens:
                continue
            for token in tokens:
                if token.startswith("event") and token[5:].isdigit():
                    paths.add(f"/dev/input/{token}")
    except OSError:
        pass

    # Fallback für ungewöhnliche Systeme, auf denen /proc unvollständig ist.
    if not paths:
        for link in glob.glob("/dev/input/by-path/*-event-kbd"):
            try:
                paths.add(os.path.realpath(link))
            except OSError:
                pass

    return sorted(paths)


def run_global_arrow_monitor(parent_pid):
    """Globale Diagnose-Hotkeys von echten Linux-Tastaturgeräten ausgeben.

    Dieser Modus läuft als separater Hilfsprozess. Kann der normale Benutzer
    auch nur eines der erkannten Tastatur-event-Geräte nicht öffnen, beendet
    sich der Helfer beim ersten Scan mit Code 77. Der Hauptprozess startet ihn
    dann erneut über ``sudo -n``. Es wird kein EVIOCGRAB verwendet: Die Tasten
    bleiben für das Vordergrundprogramm vollständig erhalten.
    """
    event_struct = struct.Struct("llHHI")
    ev_key = 0x01
    key_map = {
        105: "left",       # KEY_LEFT
        106: "right",      # KEY_RIGHT
        103: "both",       # KEY_UP
        48: "benchmark",   # KEY_B
        19: "ram",         # KEY_R
        23: "info",        # KEY_I
        22: "update",      # KEY_U
        34: "warranty",    # KEY_G
        59: "hotkeys",     # KEY_F1
        20: "touch",       # KEY_T
    }
    fds = {}
    next_scan = 0.0
    first_scan = True

    while Path(f"/proc/{parent_pid}").exists():
        now = time.monotonic()
        if now >= next_scan:
            next_scan = now + 2.0
            current_paths = set(get_keyboard_event_paths())

            for fd, path in list(fds.items()):
                if path not in current_paths:
                    try:
                        os.close(fd)
                    except OSError:
                        pass
                    fds.pop(fd, None)

            opened_paths = set(fds.values())
            open_failures = 0
            for path in sorted(current_paths - opened_paths):
                try:
                    fd = os.open(path, os.O_RDONLY | os.O_NONBLOCK)
                except OSError:
                    open_failures += 1
                    continue
                fds[fd] = path

            if first_scan:
                # Wichtig: Ein lesbares Touchpad kann diesen Test nicht mehr
                # positiv machen, weil current_paths ausschließlich kbd-Geräte
                # enthält. Bei Teilzugriff ebenfalls Root-Fallback verlangen.
                if not fds or open_failures:
                    for fd in list(fds):
                        try:
                            os.close(fd)
                        except OSError:
                            pass
                    return 77
                try:
                    print(f"ready {len(fds)}", flush=True)
                except BrokenPipeError:
                    return 0
                first_scan = False

        if not fds:
            time.sleep(0.25)
            continue

        try:
            ready, _, _ = select.select(list(fds), [], [], 0.35)
        except (OSError, ValueError):
            ready = []

        for fd in ready:
            try:
                data = os.read(fd, event_struct.size * 32)
            except BlockingIOError:
                continue
            except OSError:
                try:
                    os.close(fd)
                except OSError:
                    pass
                fds.pop(fd, None)
                continue

            usable = len(data) - (len(data) % event_struct.size)
            for offset in range(0, usable, event_struct.size):
                _, _, event_type, code, value = event_struct.unpack_from(data, offset)
                if event_type != ev_key or value != 1:
                    continue
                channel = key_map.get(code)
                if channel:
                    try:
                        print(channel, flush=True)
                    except BrokenPipeError:
                        return 0

    for fd in list(fds):
        try:
            os.close(fd)
        except OSError:
            pass
    return 0


def clean_dmi_value(value):
    value = (value or "").strip()
    if not value:
        return "--"

    placeholders = {
        "none",
        "not specified",
        "not applicable",
        "to be filled by o.e.m.",
        "default string",
        "system serial number",
    }
    if value.lower() in placeholders:
        return "--"
    return value


def read_first_value(*paths):
    for path in paths:
        value = clean_dmi_value(read_text(path))
        if value != "--":
            return value
    return "--"


def detect_cpu_name():
    try:
        text = Path("/proc/cpuinfo").read_text(
            encoding="utf-8", errors="ignore"
        )
        for line in text.splitlines():
            if line.lower().startswith("model name") and ":" in line:
                value = line.split(":", 1)[1].strip()
                if value:
                    return re.sub(r"\s+", " ", value)
    except Exception:
        pass

    try:
        env = os.environ.copy()
        env["LC_ALL"] = "C"
        out = subprocess.check_output(
            ["lscpu"],
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=2,
            env=env,
        )
        for line in out.splitlines():
            if line.startswith("Model name:"):
                value = line.split(":", 1)[1].strip()
                if value:
                    return re.sub(r"\s+", " ", value)
    except Exception:
        pass

    return "--"


def detect_ram_size():
    try:
        text = Path("/proc/meminfo").read_text(
            encoding="utf-8", errors="ignore"
        )
        m = re.search(r"^MemTotal:\s+(\d+)\s+kB$", text, re.M)
        if m:
            gib = int(m.group(1)) * 1024 / (1024 ** 3)
            return f"{gib:.1f} GB"
    except Exception:
        pass
    return "--"


def detect_ssd_info():
    try:
        env = os.environ.copy()
        env["LC_ALL"] = "C"
        out = subprocess.check_output(
            [
                "lsblk", "-bdn",
                "-o", "NAME,SIZE,MODEL,ROTA,TYPE,RM",
            ],
            text=True,
            stderr=subprocess.DEVNULL,
            timeout=3,
            env=env,
        )
    except Exception:
        return "--"

    candidates = []
    for raw in out.splitlines():
        parts = raw.split()
        if len(parts) < 5:
            continue

        name = parts[0]
        try:
            size = int(parts[1])
        except Exception:
            continue

        # Die letzten drei Spalten sind sicher ROTA, TYPE und RM.
        try:
            rota = int(parts[-3])
            dev_type = parts[-2]
            removable = int(parts[-1])
        except Exception:
            continue

        model = " ".join(parts[2:-3]).strip() or "Unbekanntes Modell"

        if dev_type != "disk" or removable != 0 or rota != 0:
            continue

        size_gb = size / 1_000_000_000.0
        display = f"{size_gb:.0f} GB · {model}"
        priority = 0 if name == "nvme0n1" else 1
        candidates.append((priority, natural_key(name), display))

    if not candidates:
        return "--"

    candidates.sort(key=lambda item: (item[0], item[1]))
    return candidates[0][2]


def detect_system_serial():
    # Bewährte Seriennummer-Erkennung aus dem separaten Dell-Test.
    # Wichtig ist die Reihenfolge: erst Geräte-/Chassis-Seriennummern,
    # Mainboard-Seriennummer nur als letzter sysfs-Fallback.
    candidates = [
        Path("/sys/class/dmi/id/product_serial"),
        Path("/sys/devices/virtual/dmi/id/product_serial"),
        Path("/sys/class/dmi/id/chassis_serial"),
        Path("/sys/class/dmi/id/board_serial"),
    ]

    for path in candidates:
        value = clean_dmi_value(read_text(path))
        if value != "--":
            return value

    # Auf Uwuntu steht dmidecode über sudo -n bereits ohne Interaktion zur
    # Verfügung. Das liefert auf getesteten Dell-Geräten zuverlässig den
    # Service-Tag / die System-Seriennummer.
    try:
        result = subprocess.run(
            ["sudo", "-n", "dmidecode", "-s", "system-serial-number"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=5,
            check=False,
        )
        value = clean_dmi_value(result.stdout or "")
        if value != "--":
            return value
    except Exception:
        pass

    return "--"


def system_information():
    dmi = Path("/sys/class/dmi/id")
    return [
        ("Hersteller", read_first_value(dmi / "sys_vendor", dmi / "board_vendor")),
        ("Modell", read_first_value(dmi / "product_name", dmi / "board_name")),
        ("Seriennummer", detect_system_serial()),
        ("CPU", detect_cpu_name()),
        ("RAM", detect_ram_size()),
        ("SSD", detect_ssd_info()),
    ]


def dell_support_target():
    """Dell-Supportziel nur für eindeutig nutzbare Geräteinformationen.

    Aktuell unterstützen wir bewusst ausschließlich Dell. Hersteller anderer
    Geräte oder unbrauchbare Seriennummern führen zu ``None`` und damit zu
    keinerlei Browser-Aktion.
    """
    dmi = Path("/sys/class/dmi/id")
    manufacturer = read_first_value(
        dmi / "sys_vendor",
        dmi / "board_vendor",
    )
    serial = detect_system_serial()

    if manufacturer == "--" or "dell" not in manufacturer.lower():
        return None

    # Dell Service-Tags bestehen aus Buchstaben/Ziffern. Die etwas großzügige
    # Längenprüfung lässt auch ältere/abweichende Dell-Seriennummern zu, ohne
    # beliebigen DMI-Text in eine URL zu übernehmen.
    if serial == "--" or not re.fullmatch(r"[A-Za-z0-9]{5,20}", serial):
        return None

    url = (
        "https://www.dell.com/support/product-details/de-de/servicetag/"
        + serial
        + "/overview"
    )
    return manufacturer, serial, url


def format_test_clock(seconds):
    seconds = max(0, int(seconds))
    minutes, sec = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours:d}:{minutes:02d}:{sec:02d}"
    return f"{minutes:02d}:{sec:02d}"

class App(Gtk.Application):
    def __init__(self):
        super().__init__(application_id=APP_ID)
        self.window = None
        self.stack = None
        self.usb_discovery = None
        self.usb_slots = []
        self.usb_group_to_slot = {}
        self.usb_tested = set()
        self.usb_connected = set()
        self.usb_last_group_present = {}
        self.usb_last_devices = {}
        self.usb_fallback = {}
        self.usb_boot_device = None
        self.usb_boot_slot = None
        self.key_widgets = {}
        self.key_aliases = {}
        self.key_tested = set()
        self.key_phase = {}
        self.speaker_tested = {"left": False, "right": False}
        # Globaler, nicht-blockierender Pfeiltasten-Listener. Er liest
        # /dev/input/event* nur mit und greift die Geräte ausdrücklich
        # NICHT exklusiv. Damit funktionieren die Pfeiltasten im gerade
        # aktiven Programm weiterhin ganz normal.
        self.global_input_stop = threading.Event()
        self.global_input_thread = None
        self.global_input_proc = None
        self.global_input_active = False
        self.last_global_speaker_at = {"left": 0.0, "right": 0.0, "both": 0.0}
        self.last_global_hotkey_at = {
            "benchmark": 0.0,
            "ram": 0.0,
            "info": 0.0,
            "update": 0.0,
            "warranty": 0.0,
            "hotkeys": 0.0,
            "touch": 0.0,
        }
        self.info_window = None
        self.hotkeys_window = None
        self.update_window = None
        self.update_status_label = None
        self.update_proc = None
        self.left_tone = make_tone("left")
        self.right_tone = make_tone("right")
        self.both_tone = make_tone("both")
        self.test_proc = None
        self.test_kind = None
        self.test_duration = 0.0
        self.test_started = 0.0
        self.test_cancelled = False
        self.benchmark_buttons = []
        self.touch_state_file = Path.home() / ".local/state/uwuntu/touch_tester_status.json"
        self.touch_script = Path.home() / ".local/bin/uwuntu-touch-tester.sh"
        self.touch_status_cache = None
        self.touch_present_cache = None
        self.touch_present_checked_at = 0.0
    def do_activate(self):
        if self.window:
            self.window.present()
            return

        self.window = Gtk.ApplicationWindow(application=self)
        self.window.set_title("Hardware Check")
        self.window.set_default_size(860, 360)

        provider = Gtk.CssProvider()
        provider.load_from_data(CSS.encode())
        Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
        controller = Gtk.EventControllerKey.new()
        controller.connect("key-pressed", self.on_key)
        self.window.add_controller(controller)

        self.stack = Gtk.Stack()
        self.stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
        self.stack.add_named(self.build_overview(), "overview")
        self.stack.add_named(self.build_keyboard(), "keyboard")
        self.stack.add_named(self.build_benchmarks(), "benchmarks")
        # Die Hardware-Test-Buttons dürfen niemals Tastaturfokus bekommen.
        # Dadurch kann z.B. SPACE im Tastatur-Test nicht versehentlich
        # "ÜBERSICHT", "RESET" oder einen anderen Button auslösen.
        self.disable_button_focus(self.stack)

        self.window.set_child(self.stack)

        self.refresh_security()
        self.usb_rediscover(reset=True)
        self.refresh_touch_status()
        GLib.timeout_add(300, self.poll_usb)
        GLib.timeout_add(500, self.poll_touch_status)
        self.start_global_speaker_listener()

        log("Hardware Check gestartet")
        self.window.present()
    def header(self, title, back=False, refresh=False, version=None):
        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        row.set_margin_start(10)
        row.set_margin_end(10)
        row.set_margin_top(5)
        row.set_margin_bottom(3)

        if back:
            b = Gtk.Button(label="← ÜBERSICHT")
            b.add_css_class("secondary")
            b.connect("clicked", self.show_overview)
            row.append(b)
        title_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        title_row.set_hexpand(True)

        t = Gtk.Label(label=title)
        t.set_xalign(0)
        t.add_css_class("header-title")
        title_row.append(t)

        if version:
            v = Gtk.Label(label=version)
            v.set_xalign(0)
            v.set_valign(Gtk.Align.START)
            v.add_css_class("header-version")
            title_row.append(v)

        row.append(title_row)
        if refresh:
            b = Gtk.Button(label="REFRESH")
            b.add_css_class("refresh-button")
            b.set_valign(Gtk.Align.CENTER)
            b.connect("clicked", self.reset_all)
            row.append(b)

        return row

    def disable_button_focus(self, widget):
        if isinstance(widget, Gtk.Button):
            widget.set_focusable(False)
        child = widget.get_first_child()
        while child is not None:
            self.disable_button_focus(child)
            child = child.get_next_sibling()

    def card(self, title):
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        box.add_css_class("card"); box.set_hexpand(True)
        l = Gtk.Label(label=title); l.set_xalign(0); l.add_css_class("card-title")
        box.append(l)
        return box
    def build_overview(self):
        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        root.append(self.header("HARDWARE CHECK", refresh=True, version="v4.5.0"))

        content = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        content.set_margin_start(8)
        content.set_margin_end(8)
        content.set_margin_bottom(6)
        # =====================================================
        # LINKE SPALTE
        # TPM -> Secure Boot -> Lautsprecher -> Tastatur
        # =====================================================
        left = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        left.set_size_request(285, -1)
        left.set_hexpand(False)
        # TPM
        tpm = self.card("TPM")
        self.tpm_status = Gtk.Label(label="● PRÜFE …")
        self.tpm_status.set_xalign(0)
        self.tpm_status.add_css_class("big-status")

        self.tpm_detail = Gtk.Label()
        self.tpm_detail.set_xalign(0)
        self.tpm_detail.add_css_class("muted")

        tpm.append(self.tpm_status)
        tpm.append(self.tpm_detail)
        left.append(tpm)
        # Secure Boot
        sb = self.card("SECURE BOOT")
        self.sb_status = Gtk.Label(label="● PRÜFE …")
        self.sb_status.set_xalign(0)
        self.sb_status.add_css_class("big-status")

        self.sb_detail = Gtk.Label()
        self.sb_detail.set_xalign(0)
        self.sb_detail.add_css_class("muted")

        sb.append(self.sb_status)
        sb.append(self.sb_detail)
        left.append(sb)
        # Lautsprecher
        speaker = self.card("LAUTSPRECHER")
        speaker.add_css_class("speaker-card")

        sr = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        sr.set_halign(Gtk.Align.CENTER)

        self.speaker_buttons = {}
        left_btn = Gtk.Button(label="←")
        left_btn.add_css_class("speaker-button")
        left_btn.add_css_class("action-orange")
        left_btn.set_tooltip_text("Linken Lautsprecher testen")
        left_btn.connect("clicked", self.test_speaker, "left")
        self.speaker_buttons["left"] = left_btn
        sr.append(left_btn)
        both_btn = Gtk.Button(label="🔊")
        both_btn.add_css_class("speaker-both")
        both_btn.add_css_class("action-orange")
        both_btn.set_tooltip_text("Beide Lautsprecher testen")
        both_btn.connect("clicked", self.test_speaker, "both")
        self.speaker_buttons["both"] = both_btn
        sr.append(both_btn)
        right_btn = Gtk.Button(label="→")
        right_btn.add_css_class("speaker-button")
        right_btn.add_css_class("action-orange")
        right_btn.set_tooltip_text("Rechten Lautsprecher testen")
        right_btn.connect("clicked", self.test_speaker, "right")
        self.speaker_buttons["right"] = right_btn
        sr.append(right_btn)

        speaker.append(sr)
        left.append(speaker)

        # Tastatur
        kb = self.card("TASTATUR")
        kb_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)

        self.keyboard_summary = Gtk.Label(label="● Noch nicht getestet")
        self.keyboard_summary.set_xalign(0)
        self.keyboard_summary.set_hexpand(True)
        self.keyboard_summary.add_css_class("status-orange")

        kb_btn = Gtk.Button(label="TEST →")
        kb_btn.add_css_class("tiny-button")
        kb_btn.set_valign(Gtk.Align.START)
        kb_btn.connect("clicked", self.show_keyboard)
        kb_row.append(self.keyboard_summary)
        kb_row.append(kb_btn)
        kb.append(kb_row)
        left.append(kb)

        benchmark_btn = Gtk.Button(label="Benchmark (B)")
        benchmark_btn.add_css_class("benchmark-open")
        benchmark_btn.connect("clicked", self.show_benchmarks)
        left.append(benchmark_btn)
        # =====================================================
        # RECHTE SPALTE
        # USB kompakter, darunter der Touch-Test-Status.
        # =====================================================
        right = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        right.set_hexpand(True)

        usb = self.card("USB-PORTS")
        usb.set_hexpand(True)
        usb.set_vexpand(True)

        scroll = Gtk.ScrolledWindow()
        scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scroll.set_vexpand(True)
        scroll.set_min_content_height(145)
        self.usb_box = Gtk.Box(
            orientation=Gtk.Orientation.VERTICAL,
            spacing=4
        )
        scroll.set_child(self.usb_box)
        usb.append(scroll)
        right.append(usb)

        touch = self.card("TOUCH-TEST")
        touch.set_hexpand(True)
        touch_row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=7)
        touch_row.add_css_class("usb-row")

        self.touch_status_dot = Gtk.Label(label="●")
        self.touch_status_dot.add_css_class("status-orange")
        self.touch_status_text = Gtk.Label(label="NICHT GETESTET")
        self.touch_status_text.set_xalign(0)
        self.touch_status_text.set_hexpand(True)
        self.touch_status_text.add_css_class("usb-port-name")
        self.touch_status_text.add_css_class("status-orange")
        self.touch_status_detail = Gtk.Label(label="T")
        self.touch_status_detail.set_xalign(1)
        self.touch_status_detail.add_css_class("usb-port-state")
        self.touch_status_detail.add_css_class("status-orange")

        touch_row.append(self.touch_status_dot)
        touch_row.append(self.touch_status_text)
        touch_row.append(self.touch_status_detail)
        touch.append(touch_row)
        right.append(touch)

        content.append(left)
        content.append(right)

        root.append(content)
        return root
    def set_status(self, widget, color, text):
        for c in ("status-green", "status-orange", "status-red"):
            widget.remove_css_class(c)
        widget.add_css_class("status-" + color)
        widget.set_text("● " + text)
    def refresh_security(self):
        c, t, d = detect_tpm()
        self.set_status(self.tpm_status, c, t); self.tpm_detail.set_text(d)
        c, t, d = detect_secure_boot()
        self.set_status(self.sb_status, c, t); self.sb_detail.set_text(d)
        log(f"Security aktualisiert: {self.tpm_status.get_text()} | {self.sb_status.get_text()}")

    def touchscreen_present(self, force=False):
        now = time.monotonic()
        if (
            not force
            and self.touch_present_cache is not None
            and now - self.touch_present_checked_at < 5.0
        ):
            return self.touch_present_cache

        present = False
        for dev in sorted(glob.glob("/dev/input/event*")):
            try:
                p = subprocess.run(
                    ["udevadm", "info", "--query=property", f"--name={dev}"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    timeout=1.5,
                    check=False,
                )
            except Exception:
                continue
            if any(line.strip() == "ID_INPUT_TOUCHSCREEN=1" for line in p.stdout.splitlines()):
                present = True
                break

        self.touch_present_cache = present
        self.touch_present_checked_at = now
        return present

    def set_touch_status_ui(self, color, text, detail="T"):
        if not hasattr(self, "touch_status_text"):
            return False
        for widget in (self.touch_status_dot, self.touch_status_text, self.touch_status_detail):
            for cls in ("status-green", "status-orange", "status-red"):
                widget.remove_css_class(cls)
            widget.add_css_class("status-" + color)
        self.touch_status_text.set_text(text)
        self.touch_status_detail.set_text(detail)
        return False

    def refresh_touch_status(self):
        data = None
        try:
            if self.touch_state_file.exists():
                data = json.loads(self.touch_state_file.read_text(encoding="utf-8"))
        except Exception as exc:
            log(f"Touch-Status nicht lesbar: {exc}")

        result = (data or {}).get("result")
        completed = int((data or {}).get("completed_fields") or 0)
        total = int((data or {}).get("total_fields") or 5)
        present = self.touchscreen_present()

        # Statusdatei liegt auf dem persistenten Uwuntu-System. Deshalb hat
        # die aktuell erkannte Hardware immer Vorrang vor einem alten Ergebnis
        # von einem zuvor getesteten Notebook.
        if not present:
            self.set_touch_status_ui("orange", "KEIN TOUCHSCREEN", "--")
        elif result == "success":
            self.set_touch_status_ui("green", "GETESTET", f"{total}/{total}")
        elif result == "running":
            self.set_touch_status_ui("orange", "TEST LÄUFT", f"{completed}/{total}")
        elif result in {"error", "failed"}:
            self.set_touch_status_ui("red", "NICHT BESTANDEN", f"{completed}/{total}")
        elif result == "aborted":
            self.set_touch_status_ui("orange", "NICHT SICHER / ABGEBROCHEN", f"{completed}/{total}")
        elif result == "no_touchscreen":
            self.set_touch_status_ui("orange", "NICHT GETESTET", "T")
        else:
            self.set_touch_status_ui("orange", "NICHT GETESTET", "T")

        self.touch_status_cache = result
        return False

    def poll_touch_status(self):
        if self.window is None:
            return False
        self.refresh_touch_status()
        return True

    def start_touch_test(self, *_):
        if not self.touchscreen_present(force=True):
            self.set_touch_status_ui("orange", "KEIN TOUCHSCREEN", "--")
            log("Touch-Test per T ignoriert: kein Touchscreen erkannt")
            return False

        if not self.touch_script.exists():
            self.set_touch_status_ui("red", "TOUCH-TESTER FEHLT", "T")
            log("Touch-Test per T fehlgeschlagen: Script fehlt")
            return False

        try:
            running = subprocess.run(
                ["pgrep", "-f", str(self.touch_script)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=1.0,
                check=False,
            ).returncode == 0
        except Exception:
            running = False

        if running:
            log("Touch-Test per T bereits geöffnet")
            return False

        try:
            subprocess.Popen(
                [str(self.touch_script)],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
            self.set_touch_status_ui("orange", "TEST WIRD GESTARTET", "T")
            log("Touch-Test per T gestartet")
        except Exception as exc:
            self.set_touch_status_ui("red", "TOUCH-TEST STARTFEHLER", "T")
            log(f"Touch-Test per T Startfehler: {exc}")
        return False

    def start_global_speaker_listener(self):
        """Pfeiltasten auch ohne Fensterfokus erkennen.

        Der Monitor liest nur mit und greift kein Eingabegerät exklusiv.
        Zuerst wird er als normaler Benutzer probiert; falls Ubuntu den Zugriff
        auf /dev/input/event* verweigert, folgt automatisch ``sudo -n``.
        """
        if self.global_input_thread and self.global_input_thread.is_alive():
            return

        self.global_input_stop.clear()
        self.global_input_thread = threading.Thread(
            target=self.global_speaker_listener_loop,
            name="hardware-check-global-arrows",
            daemon=True,
        )
        self.global_input_thread.start()

    def start_input_monitor_process(self, use_sudo=False):
        cmd = [
            sys.executable,
            "-u",
            sys.argv[0],
            "--global-arrow-monitor",
            str(os.getpid()),
        ]
        if use_sudo:
            sudo = shutil.which("sudo")
            if not sudo:
                return None
            cmd = [sudo, "-n"] + cmd

        try:
            return subprocess.Popen(
                cmd,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                bufsize=0,
            )
        except Exception as exc:
            log(
                "Globaler Hotkey-Monitor konnte nicht gestartet werden: "
                f"{exc}"
            )
            return None

    def sudo_input_monitor_available(self):
        sudo = shutil.which("sudo")
        if not sudo:
            return False
        try:
            check = subprocess.run(
                [sudo, "-n", "true"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=1.5,
            )
            return check.returncode == 0
        except Exception:
            return False

    def stop_input_monitor_process(self, proc):
        if proc is None or proc.poll() is not None:
            return
        try:
            proc.terminate()
            proc.wait(timeout=0.5)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

    def run_input_monitor_session(self, use_sudo):
        """Eine Monitor-Sitzung ausführen.

        True = echte Tastatur wurde geöffnet (ready empfangen).
        False = Start/Handshake fehlgeschlagen, anderer Modus probieren.
        """
        proc = self.start_input_monitor_process(use_sudo=use_sudo)
        if proc is None or proc.stdout is None:
            return False

        mode = "sudo -n" if use_sudo else "direkter Zugriff"
        self.global_input_proc = proc
        self.global_input_active = False

        pending = b""
        fd = proc.stdout.fileno()
        ready_seen = False
        ready_deadline = time.monotonic() + 1.5

        try:
            while not self.global_input_stop.is_set() and proc.poll() is None:
                # Erst nach einem echten 'ready N' gilt der globale Listener
                # als aktiv. So kann ein kurzlebiger/fehlerhafter Helfer den
                # GTK-Fallback nicht fälschlich abschalten.
                if not ready_seen and time.monotonic() >= ready_deadline:
                    log(
                        "Globaler Hotkey-Monitor ohne Tastatur-READY "
                        f"({mode})"
                    )
                    break

                try:
                    ready, _, _ = select.select([fd], [], [], 0.25)
                except (OSError, ValueError):
                    break
                if not ready:
                    continue

                try:
                    chunk = os.read(fd, 4096)
                except OSError:
                    break
                if not chunk:
                    break

                pending += chunk
                while b"\n" in pending:
                    raw, pending = pending.split(b"\n", 1)
                    token = raw.decode("ascii", errors="ignore").strip()

                    if token.startswith("ready "):
                        ready_seen = True
                        self.global_input_active = True
                        log(
                            "Globaler Hotkey-Monitor aktiv ("
                            + mode
                            + "): "
                            + token.split(" ", 1)[1]
                            + " Tastaturgerät(e)"
                        )
                        continue

                    if token in {
                        "left", "right", "both",
                        "benchmark", "ram", "info", "update", "warranty",
                        "hotkeys", "touch"
                    }:
                        GLib.idle_add(self.handle_global_hotkey, token)
        finally:
            self.global_input_active = False
            self.global_input_proc = None
            self.stop_input_monitor_process(proc)

        if ready_seen and not self.global_input_stop.is_set():
            log(
                "Globaler Hotkey-Monitor unerwartet beendet; "
                "wird automatisch neu gestartet"
            )

        return ready_seen

    def global_speaker_listener_loop(self):
        # Selbstheilender Listener: Der globale Monitor läuft so lange neu an,
        # wie Hardware Check geöffnet ist. Auf Uwuntu bevorzugen wir sudo -n,
        # weil /dev/input/event* für normale Desktop-Benutzer häufig nur
        # teilweise lesbar ist. Direkter Zugriff bleibt als Fallback erhalten.
        while not self.global_input_stop.is_set():
            modes = []
            if self.sudo_input_monitor_available():
                modes.append(True)
            modes.append(False)

            had_ready = False
            for use_sudo in modes:
                if self.global_input_stop.is_set():
                    break

                had_ready = self.run_input_monitor_session(use_sudo)
                if had_ready:
                    # Eine funktionierende Sitzung ist erst hierher
                    # zurückgekehrt, wenn sie beendet wurde. Danach nicht noch
                    # einen zweiten Modus starten, sondern sauber neu verbinden.
                    break

            if self.global_input_stop.is_set():
                break

            if not had_ready:
                log(
                    "Globaler Hotkey-Monitor: keine Tastatur lesbar; "
                    "erneuter Versuch in 1 Sekunde"
                )
                self.global_input_stop.wait(1.0)
            else:
                self.global_input_stop.wait(0.35)

    def close_system_info(self, *_):
        window = self.info_window
        self.info_window = None
        if window is not None:
            try:
                window.destroy()
            except Exception:
                pass
        return True

    def on_info_key(self, controller, keyval, keycode, state):
        name = Gdk.keyval_name(keyval) or ""
        if name == "Escape" or (
            state & Gdk.ModifierType.CONTROL_MASK and name.lower() == "w"
        ):
            self.close_system_info()
            return True
        return False

    def restore_center_new_windows(self, previous):
        try:
            subprocess.run(
                [
                    "gsettings", "set",
                    "org.gnome.mutter",
                    "center-new-windows",
                    previous,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=1.5,
                check=False,
            )
        except Exception:
            pass
        return False

    def present_centered(self, window):
        # Unter Wayland dürfen Anwendungen Fenster nicht selbst per X/Y
        # verschieben. Für dieses einzelne Infofenster bitten wir daher
        # Mutter kurzzeitig um zentrierte Platzierung und stellen die
        # vorherige Einstellung direkt danach wieder her.
        previous = None
        try:
            current = subprocess.check_output(
                [
                    "gsettings", "get",
                    "org.gnome.mutter",
                    "center-new-windows",
                ],
                text=True,
                stderr=subprocess.DEVNULL,
                timeout=1.5,
            ).strip().lower()
            if current in {"true", "false"}:
                previous = current
                if current != "true":
                    subprocess.run(
                        [
                            "gsettings", "set",
                            "org.gnome.mutter",
                            "center-new-windows",
                            "true",
                        ],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=1.5,
                        check=False,
                    )
        except Exception:
            previous = None

        window.present()

        if previous == "false":
            GLib.timeout_add(500, self.restore_center_new_windows, previous)

    def copy_serial_to_clipboard(self, serial):
        """Service-Tag für anschließendes Strg+V in die Zwischenablage legen.

        GTK/GDK funktioniert dabei nativ unter Wayland und X11. Ein Fehler beim
        Kopieren darf das Öffnen der Dell-Seite nicht verhindern.
        """
        if not serial:
            return False

        try:
            clipboard = (
                self.window.get_clipboard()
                if self.window is not None
                else Gdk.Display.get_default().get_clipboard()
            )
            clipboard.set_text(serial)
            log(f"Dell Service-Tag in Zwischenablage kopiert: {serial}")
            return True
        except Exception as exc:
            log(f"Service-Tag konnte nicht in Zwischenablage kopiert werden: {exc}")
            return False

    def open_dell_support(self, *_):
        target = dell_support_target()
        if target is None:
            # Gewolltes No-op: aktuell wird nur Dell unterstützt.
            log("Dell-Support per G/Klick ignoriert: kein unterstütztes Dell-Gerät oder keine nutzbare Seriennummer")
            return False

        _, serial, url = target

        # Vor jedem Öffnen zuerst kopieren. Falls Dell auf der direkten
        # Supportseite nichts anzeigt, kann der Service-Tag anschließend
        # auf einer anderen Dell-Seite sofort per Strg+V eingefügt werden.
        self.copy_serial_to_clipboard(serial)

        opener = shutil.which("xdg-open")
        cmd = [opener, url] if opener else None

        if cmd is None:
            gio = shutil.which("gio")
            if gio:
                cmd = [gio, "open", url]

        if cmd is None:
            log("Dell-Support konnte nicht geöffnet werden: xdg-open/gio fehlt")
            return False

        try:
            subprocess.Popen(
                cmd,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
            log(f"Dell-Support geöffnet: Service-Tag {serial}")
        except Exception as exc:
            log(f"Dell-Support konnte nicht geöffnet werden: {exc}")

        return False

    def focus_info_serial_button(self, button):
        if self.info_window is not None:
            try:
                button.grab_focus()
            except Exception:
                pass
        return False

    def show_system_info(self, *_):
        if not self.stack or self.stack.get_visible_child_name() == "keyboard":
            return False

        if self.info_window is not None:
            try:
                self.info_window.present()
                return False
            except Exception:
                self.info_window = None

        info = Gtk.ApplicationWindow(application=self)
        info.set_title("Systeminformationen")
        info.set_default_size(560, 330)
        info.set_resizable(False)
        info.connect("close-request", self.close_system_info)

        key_controller = Gtk.EventControllerKey.new()
        key_controller.connect("key-pressed", self.on_info_key)
        info.add_controller(key_controller)

        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        outer.set_margin_top(14)
        outer.set_margin_bottom(14)
        outer.set_margin_start(16)
        outer.set_margin_end(16)

        title = Gtk.Label(label="SYSTEMINFORMATIONEN")
        title.set_xalign(0)
        title.add_css_class("info-title")
        outer.append(title)

        card = Gtk.Grid()
        card.set_row_spacing(8)
        card.set_column_spacing(18)
        card.add_css_class("info-card")

        info_values = system_information()
        support_target = dell_support_target()
        support_serial = support_target[1] if support_target else None
        serial_button = None

        for row, (label_text, value_text) in enumerate(info_values):
            label = Gtk.Label(label=label_text)
            label.set_xalign(0)
            label.set_valign(Gtk.Align.START)
            label.add_css_class("info-label")

            if (
                label_text == "Seriennummer"
                and support_serial is not None
                and value_text == support_serial
            ):
                # Bei unterstützten Dell-Geräten ist die Seriennummer direkt
                # bedienbar. Sie bekommt beim Öffnen Fokus, damit Enter oder
                # Leertaste ohne weitere Navigation die Dell-Seite öffnet.
                value = Gtk.Button(label=value_text)
                value.set_halign(Gtk.Align.START)
                value.set_focusable(True)
                value.add_css_class("info-serial-link")
                value.set_tooltip_text(
                    "Dell Support / Garantieabfrage öffnen (Enter oder Leertaste)"
                )
                value.connect("clicked", self.open_dell_support)
                serial_button = value
            else:
                value = Gtk.Label(label=value_text)
                value.set_xalign(0)
                value.set_hexpand(True)
                value.set_wrap(True)
                # Alle übrigen Info-Werte sind reine Anzeige und bekommen
                # keinen Fokus bzw. keine Textauswahl.
                value.set_selectable(False)
                value.set_focusable(False)
                value.add_css_class("info-value")

            card.attach(label, 0, row, 1, 1)
            card.attach(value, 1, row, 1, 1)

        outer.append(card)
        info.set_child(outer)

        self.info_window = info
        if serial_button is not None:
            info.set_default_widget(serial_button)
        self.present_centered(info)
        if serial_button is not None:
            GLib.timeout_add(60, self.focus_info_serial_button, serial_button)
        log("Systeminformationen per I mittig geöffnet")
        return False

    def close_hotkeys_window(self, *_):
        window = self.hotkeys_window
        self.hotkeys_window = None
        if window is not None:
            try:
                window.destroy()
            except Exception:
                pass
        return True

    def on_hotkeys_key(self, controller, keyval, keycode, state):
        name = Gdk.keyval_name(keyval) or ""
        if name in {"Escape", "F1"} or (
            state & Gdk.ModifierType.CONTROL_MASK and name.lower() == "w"
        ):
            self.close_hotkeys_window()
            return True
        return False

    def show_hotkeys(self, *_):
        # Während des Tastatur-Tests bleibt F1 eine reine Prüftaste.
        if not self.stack or self.stack.get_visible_child_name() == "keyboard":
            return False

        if self.hotkeys_window is not None:
            try:
                self.hotkeys_window.present()
                return False
            except Exception:
                self.hotkeys_window = None

        window = Gtk.ApplicationWindow(application=self)
        window.set_title("Shortcuts / Hotkeys")
        window.set_default_size(650, 485)
        window.set_resizable(False)
        window.connect("close-request", self.close_hotkeys_window)

        key_controller = Gtk.EventControllerKey.new()
        key_controller.connect("key-pressed", self.on_hotkeys_key)
        window.add_controller(key_controller)

        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        outer.set_margin_top(14)
        outer.set_margin_bottom(14)
        outer.set_margin_start(16)
        outer.set_margin_end(16)

        title = Gtk.Label(label="SHORTCUTS / HOTKEYS")
        title.set_xalign(0)
        title.add_css_class("info-title")
        outer.append(title)

        grid = Gtk.Grid()
        grid.set_row_spacing(8)
        grid.set_column_spacing(22)
        grid.add_css_class("hotkey-grid")

        shortcuts = [
            ("F1", "Diese Übersicht öffnen / schließen"),
            ("STRG+D", "4-Felder-Diagnose-Layout starten"),
            ("←", "Linken Lautsprecher testen"),
            ("→", "Rechten Lautsprecher testen"),
            ("↑", "Beide Lautsprecher testen"),
            ("B", "Benchmark-Seite öffnen / CPU-Benchmark starten"),
            ("R", "RAM-Test auf der Benchmark-Seite starten"),
            ("I", "Systeminformationen anzeigen"),
            ("U", "Uwuntu-Update suchen und installieren"),
            ("G", "Dell-Support für erkannte Seriennummer öffnen"),
            ("T", "Touch-Tester manuell öffnen"),
            ("ENTER", "Wipe Auto: WIPE SSD / danach YES bestätigen"),
            ("STRG+W", "Aktuelles Diagnosefenster schließen"),
            ("STRG+Q", "Alle Uwuntu-Diagnosefenster schließen"),
            ("ESC", "Info-, Update- oder Hotkey-Fenster schließen"),
        ]

        for row, (key_text, desc_text) in enumerate(shortcuts):
            key = Gtk.Label(label=key_text)
            key.set_xalign(0)
            key.set_valign(Gtk.Align.START)
            key.set_size_request(105, -1)
            key.add_css_class("hotkey-key")

            desc = Gtk.Label(label=desc_text)
            desc.set_xalign(0)
            desc.set_hexpand(True)
            desc.set_wrap(True)
            desc.add_css_class("hotkey-desc")

            grid.attach(key, 0, row, 1, 1)
            grid.attach(desc, 1, row, 1, 1)

        outer.append(grid)

        note = Gtk.Label(
            label=(
                "Hinweis: Im TASTATUR TEST sind F1, B, R, I, U, G, T und die "
                "Pfeiltasten ausschließlich normale Prüftasten."
            )
        )
        note.set_xalign(0)
        note.set_wrap(True)
        note.set_focusable(False)
        note.add_css_class("hotkey-note")
        outer.append(note)

        window.set_child(outer)
        self.hotkeys_window = window
        self.present_centered(window)
        log("Shortcut-/Hotkey-Übersicht per F1 geöffnet")
        return False

    def close_update_window(self, *_):
        # Während eines laufenden Updates darf das Statusfenster zwar mit ESC
        # geschlossen werden, der Update-Prozess läuft bewusst weiter.
        window = self.update_window
        self.update_window = None
        self.update_status_label = None
        if window is not None:
            try:
                window.destroy()
            except Exception:
                pass
        return True

    def on_update_key(self, controller, keyval, keycode, state):
        name = Gdk.keyval_name(keyval) or ""
        if name == "Escape" or (
            state & Gdk.ModifierType.CONTROL_MASK and name.lower() == "w"
        ):
            self.close_update_window()
            return True
        return False

    def set_update_status(self, text):
        if self.update_status_label is not None:
            self.update_status_label.set_text(text)
        return False

    def auto_close_update_window(self):
        if self.update_proc is None and self.update_window is not None:
            self.close_update_window()
        return False

    def finish_force_update(self, returncode, last_status):
        self.update_proc = None

        if returncode == 0:
            if last_status in {
                "Bereits aktuell",
                "GitHub-Version ist älter · kein Update",
            }:
                GLib.timeout_add(2500, self.auto_close_update_window)
            return False

        if last_status.startswith("FEHLER:"):
            self.set_update_status(last_status)
        else:
            self.set_update_status("FEHLER: Update konnte nicht ausgeführt werden.")
        return False

    def force_update_worker(self, helper):
        last_status = "Suche nach Update …"
        try:
            proc = subprocess.Popen(
                [str(helper)],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                start_new_session=True,
            )
            self.update_proc = proc

            if proc.stdout is not None:
                for raw in proc.stdout:
                    line = raw.strip()
                    if not line.startswith("STATUS|"):
                        continue
                    last_status = line.split("|", 1)[1].strip()
                    GLib.idle_add(self.set_update_status, last_status)

            returncode = proc.wait()
        except Exception as exc:
            returncode = 99
            last_status = f"FEHLER: {exc}"

        GLib.idle_add(
            self.finish_force_update,
            returncode,
            last_status,
        )

    def show_force_update(self, *_):
        if not self.stack or self.stack.get_visible_child_name() == "keyboard":
            return False

        if self.update_proc is not None and self.update_proc.poll() is None:
            if self.update_window is not None:
                try:
                    self.update_window.present()
                except Exception:
                    pass
            return False

        helper = Path.home() / ".local/bin/uwuntu-force-update.sh"

        if self.update_window is not None:
            try:
                self.update_window.destroy()
            except Exception:
                pass
            self.update_window = None
            self.update_status_label = None

        window = Gtk.ApplicationWindow(application=self)
        window.set_title("Uwuntu Update")
        window.set_default_size(440, 145)
        window.set_resizable(False)
        window.connect("close-request", self.close_update_window)

        key_controller = Gtk.EventControllerKey.new()
        key_controller.connect("key-pressed", self.on_update_key)
        window.add_controller(key_controller)

        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        outer.set_margin_top(16)
        outer.set_margin_bottom(16)
        outer.set_margin_start(18)
        outer.set_margin_end(18)

        title = Gtk.Label(label="UWUNTU UPDATE")
        title.set_xalign(0)
        title.add_css_class("info-title")
        outer.append(title)

        status = Gtk.Label(label="Suche nach Update …")
        status.set_xalign(0)
        status.set_wrap(True)
        status.set_focusable(False)
        status.add_css_class("update-status")
        outer.append(status)

        window.set_child(outer)
        self.update_window = window
        self.update_status_label = status
        self.present_centered(window)

        if not helper.exists():
            self.set_update_status(
                "FEHLER: Update-Helfer fehlt · Hardware Check neu installieren."
            )
            return False

        log("Manuelles GitHub-Update per U gestartet")
        threading.Thread(
            target=self.force_update_worker,
            args=(helper,),
            name="uwuntu-force-update",
            daemon=True,
        ).start()
        return False

    def handle_global_hotkey(self, action):
        if action in {"left", "right", "both"}:
            return self.handle_global_speaker_key(action)

        if not self.window or not self.stack:
            return False

        # Im Tastatur-Test sind B, R, I, U, G, T und F1 ausschließlich normale Prüftasten.
        # Globale Diagnose-Hotkeys dürfen die Seite nicht verlassen.
        if self.stack.get_visible_child_name() == "keyboard":
            return False

        # Wenn Hardware Check selbst den Fokus hat, kommt dieselbe Taste
        # sowohl über GTK als auch über /dev/input. Sehr kurze Duplikate
        # zusammenfassen, damit EIN B nicht gleichzeitig öffnet UND startet.
        now = time.monotonic()
        if now - self.last_global_hotkey_at.get(action, 0.0) < 0.05:
            return False
        self.last_global_hotkey_at[action] = now

        visible = self.stack.get_visible_child_name()

        if action == "info":
            self.show_system_info()
            return False

        if action == "update":
            self.show_force_update()
            return False

        if action == "warranty":
            self.open_dell_support()
            return False

        if action == "hotkeys":
            self.show_hotkeys()
            return False

        if action == "touch":
            self.start_touch_test()
            return False

        if action == "benchmark":
            if visible == "benchmarks":
                self.start_test(None, "cpu-short", 10.0)
                log("Globaler Hotkey B: CPU Benchmark gestartet")
            else:
                self.show_benchmarks()
                log("Globaler Hotkey B: Benchmark-Seite geöffnet")
            return False

        if action == "ram" and visible == "benchmarks":
            self.start_test(None, "ram-short", 30.0)
            log("Globaler Hotkey R: RAM Test gestartet")
            return False

        return False

    def handle_global_speaker_key(self, channel):
        # Im Tastatur-Test sollen die Pfeiltasten weiterhin ausschließlich
        # als Prüftasten dienen und keinen Lautsprecherton auslösen.
        if not self.window or not self.stack:
            return False
        if self.stack.get_visible_child_name() == "keyboard":
            return False

        # Manche Tastaturen tauchen über mehr als ein Event-Device auf.
        # Sehr kurze Duplikate deshalb zusammenfassen.
        now = time.monotonic()
        if now - self.last_global_speaker_at.get(channel, 0.0) < 0.12:
            return False
        self.last_global_speaker_at[channel] = now

        button = self.speaker_buttons.get(channel)
        if button is not None:
            self.test_speaker(button, channel)
        return False

    def set_speaker_button_state(self, ch, tested):
        b = self.speaker_buttons.get(ch)
        if not b:
            return
        b.remove_css_class("action-orange")
        b.remove_css_class("action-green")

        if ch == "left":
            b.set_label("←")
        elif ch == "right":
            b.set_label("→")
        else:
            b.set_label("🔊")

        b.add_css_class("action-green" if tested else "action-orange")

    def update_both_speaker_state(self):
        both_ok = self.speaker_tested["left"] and self.speaker_tested["right"]
        self.set_speaker_button_state("both", both_ok)
    def test_speaker(self, button, ch):
        player = shutil.which("paplay") or shutil.which("aplay")
        if not player:
            button.set_label("AUDIO FEHLT")
            return

        if ch == "left":
            tone = self.left_tone
        elif ch == "right":
            tone = self.right_tone
        else:
            tone = self.both_tone

        subprocess.Popen(
            [player, str(tone)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        if ch == "both":
            self.speaker_tested["left"] = True
            self.speaker_tested["right"] = True
            self.set_speaker_button_state("left", True)
            self.set_speaker_button_state("right", True)
            self.set_speaker_button_state("both", True)
        else:
            self.speaker_tested[ch] = True
            self.set_speaker_button_state(ch, True)
            self.update_both_speaker_state()

        log(f"Lautsprechertest {ch}")
    def reset_speakers(self):
        self.speaker_tested = {"left": False, "right": False}
        self.set_speaker_button_state("left", False)
        self.set_speaker_button_state("right", False)
        self.set_speaker_button_state("both", False)
    def reset_all(self, *_):
        # REFRESH setzt den kompletten Hardware-Test auf Anfang.
        # Aktuell belegte Ports werden direkt wieder blau erkannt.
        self.refresh_security()
        self.reset_speakers()
        self.reset_usb()
        self.reset_keyboard()

        self.stack.set_visible_child_name("overview")
        self.window.set_default_size(860, 360)

        log("REFRESH: kompletter Hardware-Test zurückgesetzt")
    def build_usb_slots(self):
        discovery = self.usb_discovery
        groups_by_key = {
            group["raw_key"]: group
            for group in discovery["groups"]
        }
        raw_slots = {}

        for raw_key, local_idx in discovery.get("a_map", {}).items():
            slot = raw_slots.setdefault(
                ("USB-A", int(local_idx)),
                {"type": "USB-A", "groups": set()},
            )
            slot["groups"].add(raw_key)
        for raw_key, local_idx in discovery.get("c_map", {}).items():
            slot = raw_slots.setdefault(
                ("USB-C", int(local_idx)),
                {"type": "USB-C", "groups": set()},
            )
            slot["groups"].add(raw_key)

        mapped = {
            raw_key
            for slot in raw_slots.values()
            for raw_key in slot["groups"]
        }

        expected = int(discovery.get("physical_total") or 0)
        missing = max(0, expected - len(raw_slots))
        if missing:
            unmapped = [
                group
                for group in discovery["groups"]
                if group["raw_key"] not in mapped
            ]
            unmapped.sort(key=lambda g: (group_min_port(g), g["raw_key"]))

            for idx, group in enumerate(unmapped[:missing]):
                raw_slots[("USB", idx)] = {
                    "type": "USB",
                    "groups": {group["raw_key"]},
                }
        slots = []
        for slot in raw_slots.values():
            groups = [
                groups_by_key[key]
                for key in slot["groups"]
                if key in groups_by_key
            ]
            slot["sort"] = min(
                (group_min_port(group) for group in groups),
                default=999,
            )
            slots.append(slot)
        slots.sort(
            key=lambda slot: (
                slot["sort"],
                0 if slot["type"] == "USB-C" else 1,
                slot["type"],
            )
        )

        self.usb_slots = slots
        self.usb_group_to_slot = {}
        for slot_idx, slot in enumerate(self.usb_slots):
            for raw_key in slot["groups"]:
                self.usb_group_to_slot[raw_key] = slot_idx
    def usb_slot_for_device(self, device_name):
        if not device_name or not self.usb_discovery:
            return None

        for group in self.usb_discovery["groups"]:
            if group_contains_device(group, device_name):
                slot_idx = self.usb_group_to_slot.get(group["raw_key"])
                if slot_idx is not None:
                    return slot_idx

        return None
    def usb_group_states(self):
        if not self.usb_discovery:
            return {}
        return {
            group["raw_key"]: group_present(group)
            for group in self.usb_discovery["groups"]
        }

    def sync_usb_connected(self, group_states, mark_tested=True):
        connected = set()

        for raw_key, present in group_states.items():
            if not present:
                continue
            slot_idx = self.usb_group_to_slot.get(raw_key)
            if slot_idx is None:
                continue

            connected.add(slot_idx)
            if mark_tested:
                self.usb_tested.add(slot_idx)

        self.usb_connected = connected

    def rebuild_usb(self):
        child = self.usb_box.get_first_child()
        while child:
            nxt = child.get_next_sibling()
            self.usb_box.remove(child)
            child = nxt
        for idx, slot in enumerate(self.usb_slots):
            connected = idx in self.usb_connected
            tested = idx in self.usb_tested

            if connected:
                css_class = "status-blue"
                state_text = "BELEGT"
            elif tested:
                css_class = "status-green"
                state_text = "GETESTET"
            else:
                css_class = "status-orange"
                state_text = "NICHT GETESTET"
            label = f"USB-Port {idx + 1} · {slot['type']}"
            if idx == self.usb_boot_slot:
                label += " · Uwuntu Stick"

            row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=7)
            row.add_css_class("usb-row")

            dot = Gtk.Label(label="●")
            dot.add_css_class(css_class)
            name = Gtk.Label(label=label)
            name.set_xalign(0)
            name.set_hexpand(True)
            name.set_ellipsize(3)
            name.add_css_class("usb-port-name")

            state = Gtk.Label(label=state_text)
            state.set_xalign(1)
            state.add_css_class(css_class)
            state.add_css_class("usb-port-state")

            row.append(dot)
            row.append(name)
            row.append(state)
            self.usb_box.append(row)
        # Backup: nur neue/geänderte Geräte, die keiner bekannten
        # physischen Buchse sicher zugeordnet werden konnten.
        for dev_name in sorted(self.usb_fallback, key=natural_key):
            info = self.usb_fallback[dev_name]
            connected = bool(info.get("connected"))

            css_class = "status-blue" if connected else "status-green"
            state_text = "BELEGT" if connected else "GETESTET"
            row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=7)
            row.add_css_class("usb-row")

            dot = Gtk.Label(label="●")
            dot.add_css_class(css_class)

            title = info.get("title") or "USB-Gerät"
            name = Gtk.Label(label=f"Backup · {title} · Pfad {dev_name}")
            name.set_xalign(0)
            name.set_hexpand(True)
            name.set_ellipsize(3)
            name.add_css_class("usb-port-name")
            state = Gtk.Label(label=state_text)
            state.set_xalign(1)
            state.add_css_class(css_class)
            state.add_css_class("usb-port-state")

            row.append(dot)
            row.append(name)
            row.append(state)
            self.usb_box.append(row)
        if not self.usb_slots and not self.usb_fallback:
            empty = Gtk.Label(label="Keine USB-Ports erkannt")
            empty.set_xalign(0)
            empty.add_css_class("muted")
            self.usb_box.append(empty)

    def usb_rediscover(self, reset=False):
        self.usb_discovery = discover_physical_ports()
        self.build_usb_slots()

        if reset:
            self.usb_tested.clear()
            self.usb_connected.clear()
            self.usb_fallback.clear()
        self.usb_boot_device = boot_usb_device_name()
        self.usb_boot_slot = self.usb_slot_for_device(self.usb_boot_device)

        group_states = self.usb_group_states()
        self.usb_last_group_present = dict(group_states)
        self.sync_usb_connected(group_states, mark_tested=True)
        self.usb_last_devices = usb_device_snapshot()
        discovery = self.usb_discovery
        log(
            "USB Topologie: "
            f"mode={discovery['mode']} | "
            f"classification={discovery['classification']} | "
            f"logische_Pfade={discovery['raw_group_count']} | "
            f"physische_Ports={discovery['physical_total']} | "
            f"USB-A={discovery['usb_a_count']} | "
            f"USB-C={discovery['usb_c_count']}"
        )
        for idx, slot in enumerate(self.usb_slots):
            log(
                f"USB-Port {idx + 1}: type={slot['type']} | "
                f"groups={' || '.join(sorted(slot['groups']))}"
            )
        if self.usb_boot_device:
            if self.usb_boot_slot is not None:
                log(
                    f"Uwuntu Stick: USB-Port {self.usb_boot_slot + 1} "
                    f"({self.usb_boot_device})"
                )
            else:
                log(
                    f"Uwuntu Stick ohne sichere Port-Zuordnung: "
                    f"{self.usb_boot_device}"
                )

        self.rebuild_usb()
    def poll_usb(self):
        if self.window is None or not self.usb_discovery:
            return False

        current_groups = self.usb_group_states()
        old_connected = set(self.usb_connected)
        changed = False

        for raw_key, present in current_groups.items():
            before = self.usb_last_group_present.get(raw_key, False)
            if present == before:
                continue
            slot_idx = self.usb_group_to_slot.get(raw_key)
            if present:
                if slot_idx is not None:
                    self.usb_tested.add(slot_idx)
                    log(f"USB-Port {slot_idx + 1} verbunden")
                else:
                    log(f"Nicht zugeordneter USB-Pfad verbunden: {raw_key}")
            else:
                if slot_idx is not None:
                    log(f"USB-Port {slot_idx + 1}: Pfad entfernt")
            changed = True
        self.sync_usb_connected(current_groups, mark_tested=True)
        if self.usb_connected != old_connected:
            changed = True
        self.usb_last_group_present = dict(current_groups)

        current_devices = usb_device_snapshot()
        previous_names = set(self.usb_last_devices)
        current_names = set(current_devices)
        for dev_name in sorted(current_names - previous_names, key=natural_key):
            if self.usb_slot_for_device(dev_name) is not None:
                continue

            info = self.usb_fallback.setdefault(dev_name, {})
            info["title"] = current_devices[dev_name]
            info["connected"] = True
            log(
                f"USB Backup neu erkannt: {dev_name} | "
                f"{current_devices[dev_name]}"
            )
            changed = True
        for dev_name in sorted(previous_names - current_names, key=natural_key):
            if dev_name not in self.usb_fallback:
                continue

            self.usb_fallback[dev_name]["connected"] = False
            log(f"USB Backup entfernt: {dev_name}")
            changed = True
        for dev_name in current_names:
            if dev_name in self.usb_fallback:
                if not self.usb_fallback[dev_name].get("connected"):
                    changed = True
                self.usb_fallback[dev_name]["connected"] = True
                self.usb_fallback[dev_name]["title"] = current_devices[dev_name]

        self.usb_last_devices = current_devices

        if changed:
            self.rebuild_usb()

        return True
    def reset_usb(self, *_):
        log("USB REFRESH / Neu-Erkennung")
        self.usb_rediscover(reset=True)


    def build_benchmarks(self):
        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        root.append(self.header("BENCHMARKS", back=True))

        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=7)
        body.set_margin_start(10)
        body.set_margin_end(10)
        body.set_margin_bottom(8)
        grid = Gtk.Grid()
        grid.set_row_spacing(6)
        grid.set_column_spacing(6)
        grid.set_column_homogeneous(True)

        specs = [
            ("Benchmark (B)", "cpu-short", 10.0, 0, 0),
            ("BENCHMARK (ERWEITERT)", "cpu-long", 600.0, 1, 0),
            ("RAM TEST (R)", "ram-short", 30.0, 0, 1),
            ("RAM TEST (ERWEITERT)", "ram-long", 600.0, 1, 1),
        ]

        self.benchmark_buttons = []
        for label, kind, duration, col, row in specs:
            b = Gtk.Button(label=label)
            b.add_css_class("benchmark-choice")
            b.set_hexpand(True)
            b.connect("clicked", self.start_test, kind, duration)
            self.benchmark_buttons.append(b)
            grid.attach(b, col, row, 1, 1)

        body.append(grid)
        self.benchmark_status = Gtk.Label(label="Bereit")
        self.benchmark_status.set_xalign(0)
        self.benchmark_status.add_css_class("benchmark-status")
        body.append(self.benchmark_status)

        self.benchmark_progress = Gtk.ProgressBar()
        self.benchmark_progress.set_fraction(0.0)
        self.benchmark_progress.set_show_text(False)
        body.append(self.benchmark_progress)
        progress_row = Gtk.Box(
            orientation=Gtk.Orientation.HORIZONTAL,
            spacing=8
        )

        self.benchmark_time = Gtk.Label(label="00:00 / 00:00")
        self.benchmark_time.set_xalign(0)
        self.benchmark_time.set_hexpand(True)
        self.benchmark_time.add_css_class("muted")
        self.cancel_test_button = Gtk.Button(label="ABBRECHEN")
        self.cancel_test_button.add_css_class("tiny-button")
        self.cancel_test_button.set_sensitive(False)
        self.cancel_test_button.connect("clicked", self.cancel_test)

        progress_row.append(self.benchmark_time)
        progress_row.append(self.cancel_test_button)
        body.append(progress_row)
        self.benchmark_result = Gtk.Label(label="")
        self.benchmark_result.set_xalign(0)
        self.benchmark_result.set_wrap(True)
        self.benchmark_result.add_css_class("benchmark-result")
        body.append(self.benchmark_result)

        root.append(body)
        return root

    def set_benchmark_result_class(self, color):
        for cls in ("status-green", "status-orange", "status-red"):
            self.benchmark_result.remove_css_class(cls)
        if color:
            self.benchmark_result.add_css_class("status-" + color)

    def set_benchmark_status_temp_class(self, temp_c):
        for cls in ("status-yellow", "status-red"):
            self.benchmark_status.remove_css_class(cls)

        if temp_c is None:
            return

        if temp_c >= 97.0:
            self.benchmark_status.add_css_class("status-red")
        elif temp_c >= 90.0:
            self.benchmark_status.add_css_class("status-yellow")
    def update_cpu_benchmark_status(self):
        cores = os.cpu_count() or 1

        # Die Temperatur ist nur Zusatzinformation.
        # Sensorfehler dürfen die CPU-Lastmessung niemals blockieren.
        try:
            temp_c = read_cpu_temperature()
        except Exception as exc:
            temp_c = None
            log(f"CPU-Temperatur nicht lesbar: {exc}")

        text = f"CPU Benchmark läuft · {cores} Threads / Kerne"

        if temp_c is not None:
            text += f" · {temp_c:.0f}°C"
        self.benchmark_status.set_text(text)
        self.set_benchmark_status_temp_class(temp_c)

    def set_benchmark_controls(self, running):
        for b in self.benchmark_buttons:
            b.set_sensitive(not running)

        if hasattr(self, "cancel_test_button"):
            self.cancel_test_button.set_sensitive(running)

    def show_benchmarks(self, *_):
        self.stack.set_visible_child_name("benchmarks")
        self.window.set_default_size(860, 360)
    def start_test(self, button, kind, duration):
        if self.test_proc is not None and self.test_proc.poll() is None:
            return

        self.stop_test_process()

        self.test_kind = kind
        self.test_duration = float(duration)
        self.test_started = time.monotonic()
        self.test_cancelled = False
        self.benchmark_progress.set_fraction(0.0)
        self.benchmark_time.set_text(
            f"00:00 / {format_test_clock(duration)}"
        )
        self.benchmark_result.set_text("")
        self.set_benchmark_result_class(None)

        if kind.startswith("cpu"):
            cores = os.cpu_count() or 1

            log(
                f"CPU Benchmark wird vorbereitet: "
                f"{kind}, Dauer={duration:.0f}s, Kerne={cores}"
            )
            self.update_cpu_benchmark_status()
            args = [
                sys.executable,
                "-c",
                CPU_BENCH_WORKER,
                str(duration),
                str(cores),
            ]
        else:
            self.set_benchmark_status_temp_class(None)
            mode = "short" if kind == "ram-short" else "long"
            if mode == "short":
                self.benchmark_status.set_text(
                    "RAM Test läuft · mehrere Bitmuster"
                )
            else:
                self.benchmark_status.set_text(
                    "RAM Test (Erweitert) läuft · Dauerprüfung"
                )
            args = [
                sys.executable,
                "-c",
                RAM_TEST_WORKER,
                str(duration),
                mode,
            ]

        log(
            f"Test gestartet: {kind}, Dauer={duration:.0f}s"
        )
        try:
            self.test_proc = subprocess.Popen(
                args,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                start_new_session=True,
            )
        except Exception as exc:
            self.test_proc = None
            self.benchmark_status.set_text("Test konnte nicht gestartet werden")
            self.benchmark_result.set_text(str(exc))
            self.set_benchmark_result_class("red")
            return
        self.set_benchmark_controls(True)
        GLib.timeout_add(200, self.poll_test)

    def poll_test(self):
        proc = self.test_proc

        if proc is None:
            return False

        elapsed = max(0.0, time.monotonic() - self.test_started)
        duration = max(0.1, self.test_duration)
        if proc.poll() is None:
            fraction = min(0.99, elapsed / duration)
            self.benchmark_progress.set_fraction(fraction)
            self.benchmark_time.set_text(
                f"{format_test_clock(elapsed)} / "
                f"{format_test_clock(duration)}"
            )

            if self.test_kind and self.test_kind.startswith("cpu"):
                self.update_cpu_benchmark_status()

            return True
        try:
            output = proc.communicate(timeout=1)[0] or ""
        except Exception:
            output = ""

        self.test_proc = None
        self.benchmark_progress.set_fraction(1.0)
        self.benchmark_time.set_text(
            f"{format_test_clock(elapsed)} / "
            f"{format_test_clock(duration)}"
        )
        self.set_benchmark_controls(False)

        if self.test_cancelled:
            return False
        self.finish_test_result(output, proc.returncode)
        return False

    def finish_test_result(self, output, returncode):
        lines = [
            line.strip()
            for line in output.splitlines()
            if line.strip()
        ]

        result = next(
            (line for line in reversed(lines) if line.startswith("RESULT ")),
            None,
        )
        error = next(
            (line for line in reversed(lines) if line.startswith("ERROR ")),
            None,
        )
        if returncode != 0 or not result:
            self.set_benchmark_status_temp_class(None)
            self.benchmark_status.set_text("Test fehlgeschlagen")
            self.benchmark_result.set_text(
                error[6:] if error else (
                    lines[-1] if lines else "Keine Ergebnisdaten"
                )
            )
            self.set_benchmark_result_class("red")
            log(
                f"Test fehlgeschlagen: {self.test_kind}; "
                f"returncode={returncode}; output={output[-1000:]}"
            )
            return
        parts = result.split()

        if len(parts) >= 5 and parts[1] == "CPU":
            total = int(parts[2])
            elapsed = float(parts[3])
            workers = int(parts[4])

            points = int((total / max(0.001, elapsed)) / 1000.0)
            points_text = f"{points:,}".replace(",", ".")
            self.set_benchmark_status_temp_class(None)
            self.benchmark_status.set_text("CPU Benchmark abgeschlossen")
            self.benchmark_result.set_text(
                f"{points_text} Punkte · "
                f"{workers} Threads · "
                f"{elapsed:.1f}s"
            )
            self.set_benchmark_result_class("green")
            log(
                f"CPU Benchmark fertig: "
                f"{points} Punkte, {workers} Threads, {elapsed:.2f}s"
            )
            return

        if len(parts) >= 7 and parts[1] == "RAM":
            errors = int(parts[2])
            checked = int(parts[3])
            elapsed = float(parts[4])
            target = int(parts[5])
            passes = int(parts[6])
            target_gib = target / (1024 ** 3)
            checked_gib = checked / (1024 ** 3)
            throughput = checked_gib / max(0.001, elapsed)
            if errors == 0:
                self.benchmark_status.set_text("RAM Test abgeschlossen")
                self.benchmark_result.set_text(
                    f"0 Fehler · "
                    f"{target_gib:.1f} GB RAM · "
                    f"{checked_gib:.1f} GB geprüft · "
                    f"{throughput:.1f} GB/s"
                )
                self.set_benchmark_result_class("green")
            else:
                self.benchmark_status.set_text(
                    "RAM FEHLER ERKANNT"
                )
                self.benchmark_result.set_text(
                    f"{errors} fehlerhafte Blöcke · "
                    f"{target_gib:.1f} GB RAM · "
                    f"{passes} Prüfmuster"
                )
                self.set_benchmark_result_class("red")
            log(
                f"RAM Test fertig: errors={errors}, "
                f"target={target}, checked={checked}, "
                f"elapsed={elapsed:.2f}s, passes={passes}"
            )
            return

        self.benchmark_status.set_text("Unbekanntes Testergebnis")
        self.benchmark_result.set_text(result)
        self.set_benchmark_result_class("red")

    def stop_test_process(self):
        proc = self.test_proc

        if proc is None:
            return
        if proc.poll() is None:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except Exception:
                try:
                    proc.terminate()
                except Exception:
                    pass
            try:
                proc.wait(timeout=2.0)
            except Exception:
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except Exception:
                    try:
                        proc.kill()
                    except Exception:
                        pass

        self.test_proc = None

    def cancel_test(self, *_):
        if self.test_proc is None:
            return
        self.test_cancelled = True
        self.stop_test_process()
        self.set_benchmark_controls(False)

        self.set_benchmark_status_temp_class(None)
        self.benchmark_status.set_text("Test abgebrochen")
        self.benchmark_progress.set_fraction(0.0)
        self.benchmark_result.set_text("")
        self.set_benchmark_result_class("orange")

        log(f"Test abgebrochen: {self.test_kind}")

    def build_keyboard(self):
        root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        root.append(self.header("TASTATUR TEST", back=True))

        tools = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        tools.set_margin_start(8)
        tools.set_margin_end(8)
        tools.set_margin_bottom(4)
        self.keyboard_progress = Gtk.Label(label="0 / 0 getestet")
        self.keyboard_progress.set_xalign(0)
        self.keyboard_progress.set_hexpand(True)
        self.keyboard_progress.add_css_class("progress-label")

        reset = Gtk.Button(label="RESET")
        reset.add_css_class("secondary")
        reset.connect("clicked", self.reset_keyboard)

        tools.append(self.keyboard_progress)
        tools.append(reset)
        root.append(tools)
        scroll = Gtk.ScrolledWindow()
        scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        scroll.set_vexpand(True)

        board = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        board.set_margin_start(8)
        board.set_margin_end(8)
        board.set_margin_bottom(8)

        def add_key(parent, label, aliases, width, height=25):
            key = Gtk.Label(label=label)
            key.add_css_class("key")
            key.set_size_request(width, height)
            key_id = label + "|" + ",".join(aliases)
            self.key_widgets[key_id] = key

            for alias in aliases:
                self.key_aliases[alias] = key_id

            parent.append(key)
            return key

        rows = self.keyboard_layout()

        for row_index, row_spec in enumerate(rows):
            row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=3)

            for label, aliases, width in row_spec:
                add_key(row, label, aliases, width)
            # Pfeilblock rechts neben der untersten Tastenreihe:
            #
            #       ↑
            #     ← ↓ →
            #
            # Damit entspricht die Anordnung einer echten Tastatur und
            # verbraucht trotzdem möglichst wenig Breite.
            if row_index == len(rows) - 1:
                arrows = Gtk.Box(
                    orientation=Gtk.Orientation.VERTICAL,
                    spacing=2
                )
                upper = Gtk.Box(
                    orientation=Gtk.Orientation.HORIZONTAL,
                    spacing=2
                )
                lower = Gtk.Box(
                    orientation=Gtk.Orientation.HORIZONTAL,
                    spacing=2
                )

                blank_left = Gtk.Box()
                blank_left.set_size_request(24, 22)
                blank_right = Gtk.Box()
                blank_right.set_size_request(24, 22)
                upper.append(blank_left)
                add_key(upper, "↑", ("Up",), 24, 22)
                upper.append(blank_right)

                add_key(lower, "←", ("Left",), 24, 22)
                add_key(lower, "↓", ("Down",), 24, 22)
                add_key(lower, "→", ("Right",), 24, 22)

                arrows.append(upper)
                arrows.append(lower)
                row.append(arrows)

            board.append(row)

        scroll.set_child(board)
        root.append(scroll)
        self.update_keyboard()
        return root

    def keyboard_layout(self):
        K = lambda l, a=None, w=32: (l, tuple(a or (l,)), w)
        return [
            [
                K("Esc", ("Escape",), 34),
                K("F1"), K("F2"), K("F3"), K("F4"),
                K("F5"), K("F6"), K("F7"), K("F8"),
                K("F9"), K("F10"), K("F11"), K("F12"),
                K("PrtSc", ("Print",), 40),
                K("ScrLk", ("Scroll_Lock",), 40),
                K("Pause", ("Pause",), 40),
            ],
            [
                K("`", ("grave", "asciitilde")),
                K("1", ("1", "exclam")),
                K("2", ("2", "at")),
                K("3", ("3", "numbersign")),
                K("4", ("4", "dollar")),
                K("5", ("5", "percent")),
                K("6", ("6", "asciicircum")),
                K("7", ("7", "ampersand")),
                K("8", ("8", "asterisk")),
                K("9", ("9", "parenleft")),
                K("0", ("0", "parenright")),
                K("-", ("minus", "underscore")),
                K("=", ("equal", "plus")),
                K("Backspace", ("BackSpace",), 62),
                K("Ins", ("Insert",), 36),
                K("Home", ("Home",), 40),
                K("PgUp", ("Page_Up",), 40),
            ],
            [
                K("Tab", ("Tab", "ISO_Left_Tab"), 50),
                K("Q", ("q",)),
                K("W", ("w",)),
                K("E", ("e",)),
                K("R", ("r",)),
                K("T", ("t",)),
                K("Y", ("y",)),
                K("U", ("u",)),
                K("I", ("i",)),
                K("O", ("o",)),
                K("P", ("p",)),
                K("[", ("bracketleft", "braceleft")),
                K("]", ("bracketright", "braceright")),
                K("\\", ("backslash", "bar"), 44),
                K("Del", ("Delete",), 36),
                K("End", ("End",), 40),
                K("PgDn", ("Page_Down",), 40),
            ],
            [
                K("Caps", ("Caps_Lock",), 58),
                K("A", ("a",)),
                K("S", ("s",)),
                K("D", ("d",)),
                K("F", ("f",)),
                K("G", ("g",)),
                K("H", ("h",)),
                K("J", ("j",)),
                K("K", ("k",)),
                K("L", ("l",)),
                K(";", ("semicolon", "colon")),
                K("'", ("apostrophe", "quotedbl")),
                K("Enter", ("Return",), 70),
            ],
            [
                K("Shift L", ("Shift_L",), 76),
                K("Z", ("z",)),
                K("X", ("x",)),
                K("C", ("c",)),
                K("V", ("v",)),
                K("B", ("b",)),
                K("N", ("n",)),
                K("M", ("m",)),
                K(",", ("comma", "less")),
                K(".", ("period", "greater")),
                K("/", ("slash", "question")),
                K("Shift R", ("Shift_R",), 84),
            ],
            [
                K("Ctrl L", ("Control_L",), 48),
                K("Super L", ("Super_L", "Meta_L"), 52),
                K("Alt L", ("Alt_L",), 44),
                K("Space", ("space",), 180),
                K("AltGr", ("ISO_Level3_Shift", "Alt_R"), 48),
                K("Super R", ("Super_R", "Meta_R"), 52),
                K("Menu", ("Menu",), 44),
                K("Ctrl R", ("Control_R",), 48),
            ],
        ]
    def show_keyboard(self, *_):
        self.stack.set_visible_child_name("keyboard")
        self.window.set_default_size(860, 360)

    def show_overview(self, *_):
        if (
            self.stack.get_visible_child_name() == "benchmarks"
            and self.test_proc is not None
            and self.test_proc.poll() is None
        ):
            self.benchmark_status.set_text(
                "Test läuft noch · zuerst abbrechen oder warten"
            )
            return
        self.stack.set_visible_child_name("overview")
        self.window.set_default_size(860, 360)

    def reset_keyboard(self, *_):
        self.key_tested.clear()
        self.key_phase.clear()

        for w in self.key_widgets.values():
            w.remove_css_class("key-tested")
            w.remove_css_class("key-tested-blue")

        self.update_keyboard()
        log("Keyboard-Test zurückgesetzt")
    def update_keyboard(self):
        total, tested = len(self.key_widgets), len(self.key_tested)
        if hasattr(self, "keyboard_progress"):
            self.keyboard_progress.set_text(f"{tested} / {total} getestet")
        if hasattr(self, "keyboard_summary"):
            self.keyboard_summary.remove_css_class("status-green")
            self.keyboard_summary.remove_css_class("status-orange")
            if total and tested >= total:
                self.keyboard_summary.set_text("● Alle angezeigten Tasten getestet"); self.keyboard_summary.add_css_class("status-green")
            elif tested:
                self.keyboard_summary.set_text(f"● {tested} / {total} Tasten"); self.keyboard_summary.add_css_class("status-orange")
            else:
                self.keyboard_summary.set_text("● Noch nicht getestet"); self.keyboard_summary.add_css_class("status-orange")

    def do_shutdown(self):
        if self.info_window is not None:
            try:
                self.info_window.destroy()
            except Exception:
                pass
            self.info_window = None
        if self.hotkeys_window is not None:
            try:
                self.hotkeys_window.destroy()
            except Exception:
                pass
            self.hotkeys_window = None
        if self.update_window is not None:
            try:
                self.update_window.destroy()
            except Exception:
                pass
            self.update_window = None
        self.global_input_stop.set()
        self.stop_input_monitor_process(self.global_input_proc)
        self.stop_test_process()
        # Update-Prozess NICHT beenden: Nach erfolgreicher Installation muss
        # der externe Helfer Hardware Check schließen und den Kiosk neu starten
        # können. Er läuft bewusst in einer eigenen Prozessgruppe.
        log("Hardware Check beendet.")
        Gtk.Application.do_shutdown(self)


    def on_key(self, controller, keyval, keycode, state):
        name = Gdk.keyval_name(keyval) or ""

        if state & Gdk.ModifierType.CONTROL_MASK:
            if name.lower() == "w":
                log("Beendet per Strg+W")
                self.quit()
                return True
            if name.lower() == "q":
                log("Strg+Q: alle Uwuntu-Diagnosefenster beenden")
                helper = Path.home() / ".local/bin/close-diagnostic-apps.sh"
                try:
                    subprocess.Popen(
                        [str(helper)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        start_new_session=True,
                    )
                except Exception as exc:
                    log(f"Strg+Q Fehler: {exc}")
                return True

        # Fallback für Systeme, auf denen /dev/input/event* für den Benutzer
        # nicht lesbar ist: Solange Hardware Check selbst den Fokus hat,
        # funktionieren die Pfeiltasten weiterhin wie bisher. Wenn der globale
        # Listener aktiv ist, übernimmt ausschließlich dieser, damit kein Ton
        # doppelt gestartet wird.
        if (
            not self.global_input_active
            and self.stack.get_visible_child_name() != "keyboard"
        ):
            speaker_shortcuts = {
                "Left": "left",
                "Right": "right",
                "Up": "both",
            }
            channel = speaker_shortcuts.get(name)
            if channel:
                button = self.speaker_buttons.get(channel)
                if button is not None:
                    self.test_speaker(button, channel)
                    return True

        # B/R/I/U/G/F1 auch über GTK behandeln, wenn Hardware Check den Fokus hat.
        # Der Hotkey-Handler entprellt das parallele /dev/input-Ereignis.
        lower_name = name.lower()
        visible = self.stack.get_visible_child_name()
        if lower_name == "b" and visible != "keyboard":
            self.handle_global_hotkey("benchmark")
            return True
        if lower_name == "r" and visible == "benchmarks":
            self.handle_global_hotkey("ram")
            return True
        if lower_name == "i" and visible != "keyboard":
            self.handle_global_hotkey("info")
            return True
        if lower_name == "u" and visible != "keyboard":
            self.handle_global_hotkey("update")
            return True
        if lower_name == "g" and visible != "keyboard":
            self.handle_global_hotkey("warranty")
            return True
        if lower_name == "t" and visible != "keyboard":
            self.handle_global_hotkey("touch")
            return True
        if name == "F1" and visible != "keyboard":
            self.handle_global_hotkey("hotkeys")
            return True

        # Normale Tasten nur dann als Tastaturtest auswerten, wenn
        # ausdrücklich die Seite "TASTATUR TEST" geöffnet wurde.
        # Auf der Hardware-Check-Übersicht wird nichts mitgezählt.
        if self.stack.get_visible_child_name() != "keyboard":
            return False

        lookup = name.lower() if len(name) == 1 and name.isalpha() else name
        key_id = self.key_aliases.get(lookup)

        if key_id:
            widget = self.key_widgets[key_id]
            if key_id not in self.key_tested:
                # Erster Anschlag = grün.
                self.key_tested.add(key_id)
                self.key_phase[key_id] = 0
            else:
                # Jeder weitere Anschlag wechselt grün <-> blau.
                self.key_phase[key_id] = 1 - self.key_phase.get(key_id, 0)

            widget.remove_css_class("key-tested")
            widget.remove_css_class("key-tested-blue")
            if self.key_phase.get(key_id, 0) == 0:
                widget.add_css_class("key-tested")
            else:
                widget.add_css_class("key-tested-blue")

            self.update_keyboard()

            # Verhindert insbesondere, dass SPACE oder ENTER zusätzlich
            # irgendeine GTK-Button-Aktion auslösen.
            return True

        return False

if len(sys.argv) >= 3 and sys.argv[1] == "--global-arrow-monitor":
    try:
        monitor_parent_pid = int(sys.argv[2])
    except (TypeError, ValueError):
        raise SystemExit(2)
    raise SystemExit(run_global_arrow_monitor(monitor_parent_pid))

app = App()
raise SystemExit(app.run([]))
PY
if ! python3 -c 'import gi; gi.require_version("Gtk","4.0"); from gi.repository import Gtk' >/dev/null 2>&1; then
    echo "FEHLER: Python GTK4 / PyGObject fehlt."
    echo "Benötigt werden python3-gi und GTK4."
    exit 1
fi

python3 "$TMP_PY"
HARDWARE_CHECK_EOF

    chmod +x "$HARDWARE_CHECK_SCRIPT"
    cat > "$HARDWARE_CHECK_APP_DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=Hardware Check
Comment=TPM Secure Boot Lautsprecher USB und Tastatur testen
Exec=$HARDWARE_CHECK_SCRIPT
Icon=utilities-system-monitor-symbolic
Terminal=false
StartupNotify=true
StartupWMClass=com.david.HardwareCheck
Categories=Utility;System;
NoDisplay=false
EOF

    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "$APP_DIR" >/dev/null 2>&1 || true
    fi
    echo "OK: Hardware Check installiert/aktualisiert."
    echo "App-ID: com.david.HardwareCheck"
    echo "Programm: $HARDWARE_CHECK_SCRIPT"
    echo "Desktop:  $HARDWARE_CHECK_APP_DESKTOP"

    return 0
}


setup_wipe_dock_favorite() {
    local desktop_id="com.david.WipeAuto.desktop"

    if ! command -v gsettings >/dev/null 2>&1; then
        echo "FEHLER: gsettings wurde nicht gefunden."
        return 1
    fi
    local current new_value
    current="$(gsettings get org.gnome.shell favorite-apps 2>/dev/null || echo "[]")"

    new_value="$(
        python3 - "$current" "$desktop_id" <<'PY'
import ast
import sys

raw = sys.argv[1].strip()
desktop_id = sys.argv[2]

try:
    items = ast.literal_eval(raw)
except Exception:
    items = []
# Alte Dublette entfernen.
items = [x for x in items if x != desktop_id]
# Wipe Auto anhängen. Super+1 ... Super+9 funktionieren für die ersten
# neun Favoriten. Falls bereits >=9 Favoriten existieren, Wipe Auto an
# Position 9 setzen; die übrigen Favoriten bleiben erhalten.
if len(items) < 9:
    items.append(desktop_id)
else:
    items.insert(8, desktop_id)

print(repr(items))
PY
    )"

    gsettings set org.gnome.shell favorite-apps "$new_value" >/dev/null 2>&1 || {
        echo "FEHLER: Wipe Auto konnte nicht als GNOME-Favorit eingetragen werden."
        return 1
    }
    local pos
    pos="$(
        python3 - "$new_value" "$desktop_id" <<'PY'
import ast
import sys
items = ast.literal_eval(sys.argv[1])
desktop_id = sys.argv[2]
print(items.index(desktop_id) + 1)
PY
    )"

    if [ "$pos" -lt 1 ] || [ "$pos" -gt 9 ]; then
        echo "FEHLER: Wipe Auto liegt außerhalb Super+1..Super+9."
        return 1
    fi

    echo "OK: Wipe Auto ist GNOME-Favorit auf Position $pos (Super+$pos)."
    return 0
}

install_kiosk() {
    header
    echo "4-Felder Diagnose-Kiosk einrichten"
    echo "------------------------------------------------------------"
    echo
    echo "Layout:"
    echo "  oben links   = Network Check"
    echo "  oben rechts  = Uwuntu Kamera Test"
    echo "  unten links  = Wipe Auto"
    echo "  unten rechts = Hardware Check"
    echo

    if [ ! -x "$NETWORK_CHECK_SCRIPT" ]; then
        echo "FEHLER: Network Check ist noch nicht installiert."
        echo
        echo "Bitte zuerst Menüpunkt 11:"
        echo "  Network Check installieren / aktualisieren"
        pause
        return
    fi

    if [ ! -f "$NETWORK_CHECK_APP_DESKTOP" ]; then
        echo "Network-Check-App-Eintrag fehlt und wird neu erstellt."
        write_network_check_desktop
    fi

    if ! install_camera_test_app; then
        pause
        return
    fi
    if ! install_touch_test_app; then
        pause
        return
    fi
    if ! install_wipe_auto_app; then
        pause
        return
    fi
    if ! install_hardware_check_app; then
        pause
        return
    fi

    cleanup_legacy_kiosk_items

    if ! setup_ydotool; then
        echo
        echo "FEHLER bei der ydotool-Einrichtung."
        pause
        return
    fi

    if ! setup_pyatspi; then
        echo
        echo "FEHLER bei der AT-SPI-Einrichtung."
        pause
        return
    fi
    if ! setup_wipe_dock_favorite; then
        echo
        echo "FEHLER beim Einrichten des GNOME-Dock-Fokus."
        pause
        return
    fi
    # Network Check darf im 4-Felder-Modus NICHT zusätzlich separat
    # per GNOME-Autostart starten. Er wird vom Tiling Assistant
    # zusammen mit Kamera-Test und Wipe Auto gestartet.
    if [ -f "$NETWORK_CHECK_AUTOSTART" ]; then
        write_network_check_autostart false
        echo
        echo "Hinweis: Separater Network-Check-Autostart wurde deaktiviert,"
        echo "damit Network Check nicht doppelt startet."
    fi

    cat > "$KIOSK_LAUNCHER" <<'EOF'
#!/usr/bin/env bash
set -u
LOG="$HOME/kiosk_start.log"

MAX_TILING_WAIT_SECONDS=90
MAX_SOCKET_WAIT_SECONDS=30
POLL_SECONDS=0.25

exec >>"$LOG" 2>&1

echo
echo "============================================================"
echo "4-Felder-Kiosk Start: $(date)"
echo "============================================================"
# ------------------------------------------------------------
# Bildschirmhelligkeit auf Maximum
# ------------------------------------------------------------

set_max_brightness() {
    echo "Setze Bildschirmhelligkeit auf Maximum ..."

    if command -v brightnessctl >/dev/null 2>&1; then
        if brightnessctl -q set 100% >/dev/null 2>&1; then
            echo "Bildschirmhelligkeit: 100% (brightnessctl)"
            return 0
        fi
    fi

    local changed=0
    local dev max value_file
    for dev in /sys/class/backlight/*; do
        [ -d "$dev" ] || continue

        max="$(cat "$dev/max_brightness" 2>/dev/null || true)"
        value_file="$dev/brightness"

        [ -n "$max" ] || continue

        if [ -w "$value_file" ]; then
            printf '%s\n' "$max" > "$value_file" 2>/dev/null || true
        elif sudo -n true >/dev/null 2>&1; then
            printf '%s\n' "$max" \
                | sudo -n tee "$value_file" >/dev/null 2>&1 || true
        fi
        if [ "$(cat "$value_file" 2>/dev/null || true)" = "$max" ]; then
            changed=1
        fi
    done

    if [ "$changed" -eq 1 ]; then
        echo "Bildschirmhelligkeit: Maximum (sysfs)"
    else
        echo "WARNUNG: Bildschirmhelligkeit konnte nicht gesetzt werden."
    fi
}

set_max_brightness
# ------------------------------------------------------------
# 1) Auf Tiling Assistant warten
# ------------------------------------------------------------

echo "Warte auf Tiling Assistant ..."

TILING_READY=0
TILING_LOOPS="$(python3 -c "print(int(${MAX_TILING_WAIT_SECONDS}/${POLL_SECONDS}))")"
for i in $(seq 1 "$TILING_LOOPS"); do
    if gnome-extensions info tiling-assistant@ubuntu.com 2>/dev/null \
        | grep -qE 'State:[[:space:]]*ACTIVE|ACTIVE'
    then
        TILING_READY=1
        break
    fi

    sleep "$POLL_SECONDS"
done

if [ "$TILING_READY" -ne 1 ]; then
    echo "FEHLER: Tiling Assistant wurde nach ${MAX_TILING_WAIT_SECONDS}s nicht ACTIVE."
    exit 30
fi

echo "Tiling Assistant ist bereit."
# AT-SPI für den abschließenden, gezielten Tastaturfokus aktivieren.
OLD_TOOLKIT_ACCESSIBILITY="$(
    gsettings get org.gnome.desktop.interface toolkit-accessibility 2>/dev/null         || echo false
)"
ACCESSIBILITY_CHANGED=0

if [ "$OLD_TOOLKIT_ACCESSIBILITY" != "true" ]; then
    gsettings set org.gnome.desktop.interface toolkit-accessibility true         >/dev/null 2>&1 || true
    ACCESSIBILITY_CHANGED=1
fi
restore_accessibility() {
    if [ "$ACCESSIBILITY_CHANGED" -eq 1 ]; then
        gsettings set org.gnome.desktop.interface toolkit-accessibility             "$OLD_TOOLKIT_ACCESSIBILITY" >/dev/null 2>&1 || true
        ACCESSIBILITY_CHANGED=0
    fi
}

trap restore_accessibility EXIT
# ------------------------------------------------------------
# 2) Auf ydotool warten
# ------------------------------------------------------------

find_socket() {
    for s in \
        "/run/ydotool-kiosk.sock" \
        "${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/.ydotool_socket" \
        "/run/user/$(id -u)/.ydotool_socket" \
        "/tmp/.ydotool_socket"
    do
        if [ -S "$s" ] && [ -w "$s" ]; then
            echo "$s"
            return 0
        fi
    done

    return 1
}
echo "Warte auf ydotool ..."

YD_SOCKET=""
SOCKET_LOOPS="$(python3 -c "print(int(${MAX_SOCKET_WAIT_SECONDS}/${POLL_SECONDS}))")"

for i in $(seq 1 "$SOCKET_LOOPS"); do
    YD_SOCKET="$(find_socket || true)"

    if [ -n "$YD_SOCKET" ]; then
        break
    fi

    sleep "$POLL_SECONDS"
done

if [ -z "$YD_SOCKET" ]; then
    echo "FEHLER: Kein nutzbarer ydotool-Socket nach ${MAX_SOCKET_WAIT_SECONDS}s."
    exit 31
fi

export YDOTOOL_SOCKET="$YD_SOCKET"
echo "ydotool ist bereit: $YDOTOOL_SOCKET"
# ------------------------------------------------------------
# 3) Tiling-Assistant-Layout EINMAL starten
#
# Das Layout selbst startet:
#   oben links   Network Check
#   oben rechts  Uwuntu Kamera Test
#   unten links  Wipe Auto
#   unten rechts Hardware Check
#
# Firefox ist vollständig aus dem Kiosk entfernt.
# ------------------------------------------------------------

echo "Starte 4-Felder-Layout mit Strg+D ..."

/usr/bin/ydotool key 29:1 32:1 32:0 29:0

echo "Layout-Aufruf gesendet."
# ------------------------------------------------------------
# Kamera-Test erst sichtbar werden lassen
# ------------------------------------------------------------
# Der Kamera-Test ersetzt Snapshot und muss vor dem späteren Wipe-Fokus
# stabil im oberen rechten Feld stehen.
echo "Warte kurz auf das Kamera-Test-Fenster ..."

if python3 - <<'PY'
import time
import pyatspi
MAX_SECONDS = 12.0
STABLE_SECONDS = 1.2
POLL_SECONDS = 0.12

deadline = time.monotonic() + MAX_SECONDS
last_geometry = None
stable_since = None

def geometry(obj):
    try:
        e = obj.queryComponent().getExtents(pyatspi.DESKTOP_COORDS)
        if e.width > 100 and e.height > 100:
            return (e.x, e.y, e.width, e.height)
    except Exception:
        pass
    return None

def find_camera_window():
    try:
        desktop = pyatspi.Registry.getDesktop(0)
    except Exception:
        return None

    try:
        app_count = desktop.childCount
    except Exception:
        app_count = 0

    for i in range(app_count):
        try:
            app = desktop.getChildAtIndex(i)
            app_name = (app.name or "").strip().lower()
            child_count = app.childCount
        except Exception:
            continue
        for j in range(child_count):
            try:
                child = app.getChildAtIndex(j)
                role = child.getRoleName()
                child_name = (child.name or "").strip().lower()
            except Exception:
                continue

            if role not in ("frame", "window", "dialog"):
                continue

            haystack = f"{app_name} {child_name}"
            if "uwuntu kamera test" not in haystack and "kamera test" not in haystack:
                continue
            g = geometry(child)
            if g:
                return g

    return None

while time.monotonic() < deadline:
    current = find_camera_window()

    if current is None:
        last_geometry = None
        stable_since = None
        time.sleep(POLL_SECONDS)
        continue
    if current != last_geometry:
        last_geometry = current
        stable_since = time.monotonic()
    elif stable_since is not None and time.monotonic() - stable_since >= STABLE_SECONDS:
        raise SystemExit(0)

    time.sleep(POLL_SECONDS)

raise SystemExit(1)
PY
then
    echo "Kamera-Test-Fenster ist bereit."
else
    echo "WARNUNG: Kamera-Test-Fenster nach 12s nicht eindeutig erkannt."
    echo "Fokus wird trotzdem fortgesetzt."
fi
# ------------------------------------------------------------
# Hardware Check ebenfalls vollständig erscheinen lassen
# ------------------------------------------------------------
# Das neue vierte Fenster darf nach dem finalen Wipe-Fokus nicht verspätet
# auftauchen und den Fokus wieder stehlen. Deshalb warten wir hier
# zustandsbasiert auf ein stabiles Hardware-Check-Fenster.
echo "Warte kurz auf das Hardware-Check-Fenster ..."

if python3 - <<'PY'
import time
import pyatspi
MAX_SECONDS = 12.0
STABLE_SECONDS = 0.8
POLL_SECONDS = 0.12

deadline = time.monotonic() + MAX_SECONDS
last_geometry = None
stable_since = None

def geometry(obj):
    try:
        e = obj.queryComponent().getExtents(pyatspi.DESKTOP_COORDS)
        if e.width > 100 and e.height > 100:
            return (e.x, e.y, e.width, e.height)
    except Exception:
        pass
    return None
def find_hardware_check_window():
    try:
        desktop = pyatspi.Registry.getDesktop(0)
    except Exception:
        return None

    try:
        app_count = desktop.childCount
    except Exception:
        app_count = 0

    for i in range(app_count):
        try:
            app = desktop.getChildAtIndex(i)
            app_name = (app.name or "").strip().lower()
            child_count = app.childCount
        except Exception:
            continue
        for j in range(child_count):
            try:
                child = app.getChildAtIndex(j)
                role = child.getRoleName()
                child_name = (child.name or "").strip().lower()
            except Exception:
                continue

            if role not in ("frame", "window", "dialog"):
                continue

            haystack = f"{app_name} {child_name}"
            if "hardware check" not in haystack and "hardwarecheck" not in haystack:
                continue
            g = geometry(child)
            if g:
                return g

    return None

while time.monotonic() < deadline:
    current = find_hardware_check_window()

    if current is None:
        last_geometry = None
        stable_since = None
        time.sleep(POLL_SECONDS)
        continue
    if current != last_geometry:
        last_geometry = current
        stable_since = time.monotonic()
    elif stable_since is not None and time.monotonic() - stable_since >= STABLE_SECONDS:
        raise SystemExit(0)

    time.sleep(POLL_SECONDS)

raise SystemExit(1)
PY
then
    echo "Hardware-Check-Fenster ist bereit."
else
    echo "WARNUNG: Hardware Check nach 12s nicht eindeutig erkannt."
    echo "Fokus wird trotzdem versucht."
fi
# ------------------------------------------------------------
# Touchscreen: falls vorhanden, Touch-Test ZUERST erledigen
# ------------------------------------------------------------
has_touchscreen() {
    local dev
    for dev in /dev/input/event*; do
        [ -e "$dev" ] || continue
        if udevadm info --query=property --name="$dev" 2>/dev/null \
            | grep -q '^ID_INPUT_TOUCHSCREEN=1$'
        then
            return 0
        fi
    done
    return 1
}

# Ergebnis gehört immer nur zum aktuell getesteten Notebook.
rm -f "$HOME/.local/state/uwuntu/touch_tester_status.json" 2>/dev/null || true

if has_touchscreen; then
    echo "Touchscreen erkannt: Touch-Test wird als erstes geöffnet ..."

    if [ -x "$HOME/.local/bin/uwuntu-touch-tester.sh" ]; then
        "$HOME/.local/bin/uwuntu-touch-tester.sh" >>"$LOG" 2>&1 &
        TOUCH_PID=$!
        # Der XWayland-Touch-Tester ist fullscreen + keep-above und holt sich
        # während der ersten Sekunden mehrfach nach vorne. Solange er offen
        # ist, wird der abschließende Wipe-Auto-Fokus bewusst NICHT gesetzt.
        wait "$TOUCH_PID" || true
        echo "Touch-Test geschlossen/abgeschlossen; fahre mit Kiosk-Fokus fort."
    else
        echo "WARNUNG: Touch-Tester ist nicht installiert."
    fi
else
    echo "Kein Touchscreen erkannt: Touch-Test wird nicht automatisch gestartet."
fi

# Keine separate 90-Sekunden-App-Erkennung mehr.
# Die anschließende AT-SPI-Fokusprüfung wartet selbst darauf,
# dass Wipe Auto und der Button WIPE SSD wirklich vorhanden sind.
# Dadurch gibt es beim Boot keinen unnötigen 90s-Timeout mehr.
# Falls Wipe Auto bereits registriert ist, vorhandene Instanz aktivieren.
# Falls noch nicht, ist das unkritisch: AT-SPI wartet weiter auf den Button.
if command -v gapplication >/dev/null 2>&1; then
    gapplication activate com.david.WipeAuto >/dev/null 2>&1 || true
else
    gtk-launch com.david.WipeAuto >/dev/null 2>&1 || true
fi
# Wipe Auto gezielt über GNOMEs native Dock-/Favoriten-Tastenkürzel aktivieren.
#
# Wipe Auto wurde beim Kiosk-Setup als Favorit eingetragen. GNOME Shell
# unterstützt Super+1 bis Super+9 nativ zum Starten/Aktivieren genau des
# jeweiligen Favoriten.
#
# Das ist entscheidend unter Wayland:
# GNOME Shell selbst führt die Fensteraktivierung aufgrund eines echten
# Tastaturereignisses aus.
#
# KEIN Alt+Tab.
# KEIN Alt+Esc.
# KEIN Alt+F2.
# KEINE Maus.
# KEIN Durchschalten durch andere Fenster.
#
# Anschließend bestätigt AT-SPI, dass WIPE SSD wirklich FOCUSED ist.
echo "Aktiviere Wipe Auto gezielt über GNOME Super+N ..."
FOCUS_OK=0

if python3 - <<'PY'
import ast
import os
import subprocess
import time
import pyatspi

DESKTOP_ID = "com.david.WipeAuto.desktop"
MAX_SECONDS = 10.0
POLL_SECONDS = 0.12
RETRY_SECONDS = 1.0
def get_favorite_position():
    try:
        out = subprocess.check_output(
            [
                "gsettings", "get",
                "org.gnome.shell",
                "favorite-apps"
            ],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        items = ast.literal_eval(out)
        pos = items.index(DESKTOP_ID) + 1
        if 1 <= pos <= 9:
            return pos
    except Exception:
        pass
    return None
def walk(obj):
    try:
        count = obj.childCount
    except Exception:
        count = 0

    for i in range(count):
        try:
            child = obj.getChildAtIndex(i)
        except Exception:
            continue
        yield child
        yield from walk(child)

def find_wipe_button():
    try:
        desktop = pyatspi.Registry.getDesktop(0)
    except Exception:
        return None
    for item in walk(desktop):
        try:
            name = (item.name or "").strip()
            role = item.getRoleName()
        except Exception:
            continue

        if name == "WIPE SSD" and role in ("push button", "button"):
            return item

    return None

def focused(obj):
    if obj is None:
        return False
    try:
        return obj.getState().contains(pyatspi.STATE_FOCUSED)
    except Exception:
        return False
def grab(obj):
    if obj is None:
        return
    try:
        obj.queryComponent().grabFocus()
    except Exception:
        pass

def send_super_number(pos):
    # Linux evdev:
    # KEY_LEFTMETA = 125
    # KEY_1 = 2 ... KEY_9 = 10
    number_keycode = pos + 1
    try:
        subprocess.run(
            [
                "/usr/bin/ydotool", "key",
                "125:1",
                f"{number_keycode}:1",
                f"{number_keycode}:0",
                "125:0",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=2,
            env=os.environ.copy(),
            check=False,
        )
    except Exception:
        pass
pos = get_favorite_position()
if pos is None:
    print("Wipe Auto ist nicht unter GNOME Super+1..Super+9.", flush=True)
    raise SystemExit(2)

print(f"Wipe Auto Dock-Position: {pos}; verwende Super+{pos}", flush=True)

deadline = time.monotonic() + MAX_SECONDS
last_activation = -999.0
attempt = 0

while time.monotonic() < deadline:
    button = find_wipe_button()

    if focused(button):
        raise SystemExit(0)
    now = time.monotonic()
    if now - last_activation >= RETRY_SECONDS:
        attempt += 1
        print(f"Super+{pos} Fokusversuch {attempt}", flush=True)
        send_super_number(pos)
        last_activation = now

        # GTK bekommt über die Shell-Aktivierung Zeit für present()/is-active.
        time.sleep(0.25)

        button = find_wipe_button()
        if button is not None:
            grab(button)
            time.sleep(0.08)
            if focused(button):
                raise SystemExit(0)

    time.sleep(POLL_SECONDS)

raise SystemExit(1)
PY
then
    FOCUS_OK=1
    echo "OK: WIPE SSD hat bestätigten Tastaturfokus."
else
    echo "WARNUNG: WIPE SSD konnte nicht sicher fokussiert werden."
fi

restore_accessibility
# ------------------------------------------------------------
# Begrüßungs-/Bereitschaftssound
# ------------------------------------------------------------
# Der Sound kommt ganz am Ende. Damit ist er gleichzeitig das Signal:
# Wipe Auto ist bereit und WIPE SSD sollte den Tastaturfokus haben.
LOGIN_SOUND="/usr/share/sounds/Yaru/stereo/desktop-login.oga"
if [ "$FOCUS_OK" -eq 1 ]; then
    if command -v paplay >/dev/null 2>&1 && [ -f "$LOGIN_SOUND" ]; then
        echo "Spiele Bereitschaftssound ..."
        paplay "$LOGIN_SOUND" >/dev/null 2>&1 &
    else
        echo "Hinweis: Bereitschaftssound nicht verfügbar."
    fi
else
    echo "Kein Bereitschaftssound: WIPE SSD hat keinen bestätigten Fokus."
fi

echo "Kiosk fertig: $(date)"
EOF

    chmod +x "$KIOSK_LAUNCHER"
    # Alten Firefox/Snapshot-Autostart entfernen, damit nicht zwei
    # Kiosk-Einträge gleichzeitig feuern.
    rm -f "$OLD_KIOSK_DESKTOP"

    cat > "$KIOSK_DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=Diagnostic 4-Tile Kiosk
Comment=Startet das Diagnose-Layout über Tiling Assistant
Exec=$KIOSK_LAUNCHER
Terminal=false
X-GNOME-Autostart-enabled=true
Hidden=false
NoDisplay=false
EOF
    echo
    echo "OK: 4-Felder-Kiosk eingerichtet."
    echo
    echo "Autostart:"
    echo "  $KIOSK_DESKTOP"
    echo
    echo "Tiling-Assistant Layout:"
    echo "  1) 0--0--0.5--0.5       -> Network Check"
    echo "  2) 0.5--0--0.5--0.5     -> Uwuntu Kamera Test"
    echo "  3) 0--0.5--0.5--0.5     -> Wipe Auto"
    echo "  4) 0.5--0.5--0.5--0.5   -> Hardware Check"
    echo
    echo "WICHTIG:"
    echo "Im Tiling Assistant die Apps genau diesen vier Feldern zuordnen."
    echo "Der Shortcut bleibt Strg+D."
    echo
    echo "Firefox wird vom Kiosk nicht mehr gestartet."
    echo
    echo "Startfokus:"
    echo "  Wipe Auto wird nach dem Start aktiviert und WIPE SSD"
    echo "  bekommt über AT-SPI gezielt den Tastaturfokus."
    echo "  Es gibt keine zusätzliche 90s-App-Wartezeit mehr."
    echo "  Kamera-Test und Hardware Check müssen zuerst stabil erschienen sein."
    echo "  Danach wird Wipe Auto über GNOMEs nativen Super+N-Dock-Shortcut aktiviert."
    echo "  Kein Alt+Tab, kein Alt+Esc, kein Alt+F2 und keine Maus."
    echo "  Ein fokussierter WIPE-SSD-Button wird deutlich BLAU."
    echo "  Sobald der Fokus einmal bestätigt ist, beendet sich die"
    echo "  Fokus-Automatik sofort - Enter/YES kann direkt bedient werden."
    echo "  Der Bereitschaftssound kommt direkt nach bestätigtem Fokus."
    echo "  ENTER 1 = WIPE SSD"
    echo "  ENTER 2 = YES / Löschen bestätigen"
    echo
    echo "Bereitschaftssound:"
    echo "  /usr/share/sounds/Yaru/stereo/desktop-login.oga"
    echo "  Er ertönt erst, wenn der Kiosk vollständig bereit ist."
    pause
}

test_kiosk() {
    header

    if [ ! -x "$KIOSK_LAUNCHER" ]; then
        echo "4-Felder-Kiosk ist noch nicht installiert."
        echo "Bitte zuerst Menüpunkt 1 verwenden."
        pause
        return
    fi
    echo "4-Felder-Kiosk wird jetzt manuell gestartet."
    echo
    echo "Für einen sauberen Test vorher schließen:"
    echo "  - Network Check"
    echo "  - Uwuntu Kamera Test"
    echo "  - Touch-Tester (falls geöffnet)"
    echo "  - Hardware Check"
    echo "  - offene Wipe-Auto/Zenity-Fenster"
    echo
    echo "Danach sollte Strg+D genau einmal ausgelöst werden."
    echo

    "$KIOSK_LAUNCHER" &
    echo "Gestartet."
    echo
    echo "Log:"
    echo "$HOME/kiosk_start.log"

    pause
}
show_kiosk_log() {
    header
    echo "KIOSK-LOG"
    echo "------------------------------------------------------------"
    if [ -f "$HOME/kiosk_start.log" ]; then
        tail -n 200 "$HOME/kiosk_start.log"
    else
        echo "Noch kein Log vorhanden."
    fi
    pause
}


network_check_status() {
    if [ ! -x "$NETWORK_CHECK_SCRIPT" ]; then
        echo "NICHT INSTALLIERT"
        return
    fi
    if [ ! -f "$NETWORK_CHECK_AUTOSTART" ]; then
        echo "INSTALLIERT / AUTOSTART AUS"
        return
    fi

    if grep -qiE '^Hidden=true$' "$NETWORK_CHECK_AUTOSTART" 2>/dev/null \
        || grep -qiE '^X-GNOME-Autostart-enabled=false$' "$NETWORK_CHECK_AUTOSTART" 2>/dev/null
    then
        echo "AUTOSTART AUS"
    else
        echo "AUTOSTART EIN"
    fi
}
write_network_check_desktop() {
    cat > "$NETWORK_CHECK_APP_DESKTOP" <<EOF
[Desktop Entry]
Type=Application
Name=Network Check
Comment=LAN/WLAN Link- und Speedtest
Exec=$NETWORK_CHECK_SCRIPT
Icon=network-transmit-receive-symbolic
Terminal=false
StartupNotify=true
StartupWMClass=com.david.NetworkCheck
Categories=Utility;System;
NoDisplay=false
EOF
}

write_network_check_autostart() {
    local enabled="${1:-true}"

    cp "$NETWORK_CHECK_APP_DESKTOP" "$NETWORK_CHECK_AUTOSTART"
    if [ "$enabled" = "true" ]; then
        printf '\nX-GNOME-Autostart-enabled=true\nHidden=false\n' >> "$NETWORK_CHECK_AUTOSTART"
    else
        printf '\nX-GNOME-Autostart-enabled=false\nHidden=true\n' >> "$NETWORK_CHECK_AUTOSTART"
    fi
}

install_network_check() {
    install_close_apps_helper
    header
    echo "Network Check installieren / aktualisieren"
    echo "------------------------------------------------------------"
    echo
    echo "Installiere die aktuell getestete Network-Check-Version v2.7."
    echo "Das Programm bleibt ein eigenes Fenster."
    echo

    cat > "$NETWORK_CHECK_SCRIPT" <<'NETWORK_CHECK_SCRIPT_EOF'
#!/usr/bin/env bash
set -u
# ============================================================
# Network Check - separater Test
# ============================================================
# - Verändert den bestehenden Kiosk / Autostart NICHT
# - Eigenes GTK4-Fenster
# - LAN und WLAN getrennt
# - Live Download / Upload
# - Automatischer Test beim Start NUR für die aktive Verbindung
# - Automatischer Test bei Verbindungswechsel
# - REFRESH = nur die aktuell aktive LAN/WLAN-Verbindung neu testen
# - EXIT = Programm beenden
#
# Speedtest:
#   Download: Datalix Looking Glass Frankfurt
#   Upload:   Cloudflare /__up
# ============================================================
need_install=0

if ! python3 -c 'import gi; gi.require_version("Gtk","4.0"); from gi.repository import Gtk' >/dev/null 2>&1; then
    need_install=1
fi

for cmd in curl nmcli ip iw; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        need_install=1
    fi
done

if [ "$need_install" -eq 1 ]; then
    echo "Einige kleine Abhängigkeiten fehlen."
    echo "Installiere GTK-Python, curl, NetworkManager-Tools, iproute2 und iw ..."
    if sudo -n true 2>/dev/null; then
        sudo -n apt-get install -y \
            python3-gi gir1.2-gtk-4.0 curl network-manager iproute2 iw
    else
        sudo apt-get install -y \
            python3-gi gir1.2-gtk-4.0 curl network-manager iproute2 iw
    fi
fi

if ! python3 -c 'import gi; gi.require_version("Gtk","4.0"); from gi.repository import Gtk' >/dev/null 2>&1; then
    echo "FEHLER: GTK4/Python ist nicht verfügbar."
    exit 10
fi
for cmd in curl nmcli ip; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "FEHLER: $cmd fehlt."
        exit 11
    fi
done

TMP_PY="$(mktemp /tmp/network-check-XXXXXX.py)"
trap 'rm -f "$TMP_PY"' EXIT

cat > "$TMP_PY" <<'PY'
#!/usr/bin/env python3

import gi
gi.require_version("Gtk", "4.0")

from gi.repository import Gtk, GLib, Gdk

import os
import re
import signal
import subprocess
import threading
import time
import queue
from datetime import datetime
from pathlib import Path
VERSION = "2.7"
# ============================================================
# EINSTELLUNGEN
# Diese Grenzwerte sind für den ersten Praxistest bewusst
# einfach gehalten und können später angepasst werden.
# ============================================================

# Harte LAN-Regel:
LAN_LINK_MIN = 1000.0       # Mbps

# WLAN-Link: vorläufiger Mindestwert
WIFI_LINK_MIN = 100.0       # Mbps
# Internet-Durchsatz: vorläufige PASS-Grenzen
LAN_DOWNLOAD_MIN = 800.0    # Mbps
LAN_UPLOAD_MIN = 800.0      # Mbps
WIFI_DOWNLOAD_MIN = 50.0    # Mbps
WIFI_UPLOAD_MIN = 100.0     # Mbps

# Je Richtung maximal ungefähr 2,5 Sekunden.
# Gesamttest pro Verbindung damit ungefähr 5 Sekunden.
PHASE_SECONDS = 5.0
SAMPLE_SECONDS = 0.25
# Mehrere parallele Transfers sättigen schnelle Gigabit-Leitungen.
#
# Download:
# 4 parallele Streams gegen eine 10-GB-Testdatei in Frankfurt.
# Kein Stream kann innerhalb unserer 5 Sekunden fertig werden.
DOWNLOAD_STREAMS = 4
#
# Upload:
# 4 Streams reichen; jeder Stream bekommt 250 MB Daten angeboten.
# Bei insgesamt 1 Gbit/s wird auch davon keiner innerhalb von 5 Sekunden fertig.
UPLOAD_STREAMS = 4
# Die ersten Millisekunden enthalten Verbindungsaufbau / Hochlauf.
# Sie werden live angezeigt, aber nicht in den End-Durchschnitt genommen.
WARMUP_SECONDS = 0.5

# Endwert: Durchschnitt der schnellsten 50 % der stabilisierten Samples.
# Dadurch zieht der TCP-Hochlauf den Endwert nicht künstlich herunter,
# einzelne kurze Peaks bestimmen das Ergebnis aber ebenfalls nicht allein.
TOP_SAMPLE_FRACTION = 0.50

# Kleine Cloudflare-Anfrage als Internet-Bereitschaftstest.
CONNECTIVITY_TIMEOUT = 15.0
# Der öffentliche Cloudflare-Endpunkt reagiert bei sehr großen
# Einzelrequests nicht auf allen Systemen zuverlässig.
# 99.999.999 Bytes pro Stream ist groß genug für unseren kurzen Test.
# Download:
# Datalix Looking Glass in Frankfurt stellt große Speedtest-Dateien bereit.
# 10 GB pro Stream sind absichtlich viel größer als nötig:
# Wir brechen nach 5 Sekunden ab, sodass kein Stream neu gestartet werden muss.
DOWNLOAD_URL = "https://lg.datalix.de/download.php?size=10gb"
# Upload bleibt bei Cloudflare, weil dieser Test bei uns stabil funktioniert.
CF_UP_BYTES = 250000000

CF_CHECK = "https://speed.cloudflare.com/__down?bytes=1000"
CF_UP = "https://speed.cloudflare.com/__up"
LOG = Path.home() / "network_check.log"

ENV_C = os.environ.copy()
ENV_C["LC_ALL"] = "C"
ENV_C["LANG"] = "C"
# ============================================================
# Hilfsfunktionen
# ============================================================

def log(message):
    line = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}  {message}"
    try:
        with LOG.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass
    print(line, flush=True)

def run_text(args, timeout=4):
    try:
        p = subprocess.run(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=timeout,
            env=ENV_C,
        )
        return p.stdout.strip()
    except Exception:
        return ""


def format_mbps(value, decimals=0):
    if value is None:
        return "--"
    if decimals:
        return f"{value:.1f} Mbps"
    return f"{value:,.0f}".replace(",", ".") + " Mbps"

def get_devices():
    """
    Liefert pro Typ (ethernet/wifi) alle von NetworkManager
    bekannten Geräte. Verbundene Geräte werden zuerst sortiert.
    """
    out = run_text(["nmcli", "-t", "-f", "DEVICE,TYPE,STATE", "device", "status"])
    result = {"ethernet": [], "wifi": []}
    for raw in out.splitlines():
        # nmcli escaped Doppelpunkte sind bei normalen Interface-Namen
        # nicht relevant; maxsplit hält den Parser trotzdem klein.
        parts = raw.split(":", 2)
        if len(parts) != 3:
            continue

        dev, typ, state = parts
        if typ not in result:
            continue
        if not dev or dev == "lo":
            continue
        result[typ].append({
            "iface": dev,
            "type": typ,
            "state": state,
            "connected": state == "connected",
        })

    for typ in result:
        result[typ].sort(key=lambda d: (not d["connected"], d["iface"]))

    return result


def get_default_iface():
    out = run_text(["ip", "-4", "route", "show", "default"])
    candidates = []

    for line in out.splitlines():
        parts = line.split()
        if "dev" not in parts:
            continue
        try:
            iface = parts[parts.index("dev") + 1]
        except Exception:
            continue

        metric = 0
        if "metric" in parts:
            try:
                metric = int(parts[parts.index("metric") + 1])
            except Exception:
                metric = 999999

        candidates.append((metric, iface))

    if not candidates:
        return None

    candidates.sort()
    return candidates[0][1]

def ethernet_link_speed(iface):
    p = Path("/sys/class/net") / iface / "speed"
    try:
        raw = p.read_text().strip()
        speed = float(raw)
        if speed > 0:
            return speed
    except Exception:
        pass
    return None


def wifi_link_speed(iface):
    if not shutil_which("iw"):
        return None

    out = run_text(["iw", "dev", iface, "link"])
    # Bevorzugt RX, falls vorhanden, sonst TX.
    rx = re.search(r"rx bitrate:\s*([0-9.]+)\s*MBit/s", out, re.I)
    tx = re.search(r"tx bitrate:\s*([0-9.]+)\s*MBit/s", out, re.I)

    match = rx or tx
    if not match:
        return None

    try:
        return float(match.group(1))
    except Exception:
        return None

def shutil_which(cmd):
    for directory in os.environ.get("PATH", "").split(os.pathsep):
        p = Path(directory) / cmd
        if p.exists() and os.access(p, os.X_OK):
            return str(p)
    return None


def link_speed(iface, kind):
    if kind == "lan":
        return ethernet_link_speed(iface)
    return wifi_link_speed(iface)

def iface_counter(iface, direction):
    stat = "rx_bytes" if direction == "download" else "tx_bytes"
    p = Path("/sys/class/net") / iface / "statistics" / stat
    try:
        return int(p.read_text().strip())
    except Exception:
        return 0

def iface_mac(iface):
    """Aktuelle MAC-Adresse des Interfaces aus sysfs lesen."""
    p = Path("/sys/class/net") / iface / "address"
    try:
        mac = p.read_text().strip().upper()
        if re.fullmatch(r"[0-9A-F]{2}(?::[0-9A-F]{2}){5}", mac):
            return mac
    except Exception:
        pass
    return None
# ============================================================
# GTK-Karte
# ============================================================

class ConnectionCard:
    def __init__(self, title):
        self.title = title
        self.base_title = title

        self.root = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        self.root.add_css_class("card")

        header = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        self.title_label = Gtk.Label(label=title)
        self.title_label.set_xalign(0)
        self.title_label.add_css_class("card-title")
        self.title_label.set_hexpand(True)

        self.state_label = Gtk.Label(label="CHECKING")
        self.state_label.add_css_class("badge")
        self.set_widget_class(self.state_label, "warn")

        header.append(self.title_label)
        header.append(self.state_label)
        self.root.append(header)
        self.interface_label = Gtk.Label(label="Interface: --")
        self.interface_label.set_xalign(0)
        self.interface_label.add_css_class("interface")
        self.root.append(self.interface_label)

        metrics = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=8)
        metrics.set_homogeneous(True)

        self.link_value = self.metric(metrics, "LINK")
        self.down_value = self.metric(metrics, "DOWNLOAD")
        self.up_value = self.metric(metrics, "UPLOAD")
        self.root.append(metrics)

        self.note_label = Gtk.Label(label="")
        self.note_label.set_xalign(0)
        self.note_label.set_wrap(True)
        self.note_label.add_css_class("note")
        self.root.append(self.note_label)

    def metric(self, parent, caption):
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        box.add_css_class("metric")

        cap = Gtk.Label(label=caption)
        cap.add_css_class("metric-caption")
        value = Gtk.Label(label="--")
        value.add_css_class("metric-value")
        value.add_css_class("neutral")

        box.append(cap)
        box.append(value)
        parent.append(box)
        return value

    def set_widget_class(self, widget, klass):
        for c in ("good", "bad", "warn", "neutral", "live"):
            widget.remove_css_class(c)
        widget.add_css_class(klass)
    def set_title_mac(self, mac=None, adapter_present=True):
        # Fehlende Hardware bzw. nicht lesbare MAC = orange/unklar.
        # Eine echte Null-MAC bleibt rot, weil das ein klarer Fehler ist.
        self.title_label.remove_css_class("mac-error")
        self.title_label.remove_css_class("mac-warning")

        if not adapter_present:
            self.title_label.set_text(f"{self.base_title} - KEINE NETZWERKKARTE")
            self.title_label.add_css_class("mac-warning")
            return

        if not mac:
            self.title_label.set_text(f"{self.base_title} - KEINE MAC")
            self.title_label.add_css_class("mac-warning")
            return

        self.title_label.set_text(f"{self.base_title} - {mac}")

        if mac == "00:00:00:00:00:00":
            self.title_label.add_css_class("mac-error")

    def set_state(self, text, klass):
        self.state_label.set_text(text)
        self.set_widget_class(self.state_label, klass)
    def set_metric(self, which, text, klass="neutral"):
        widget = {
            "link": self.link_value,
            "down": self.down_value,
            "up": self.up_value,
        }[which]
        widget.set_text(text)
        self.set_widget_class(widget, klass)
# ============================================================
# Hauptanwendung
# ============================================================

class NetworkCheckApp(Gtk.Application):
    def __init__(self):
        super().__init__(application_id="com.david.NetworkCheck")

        self.window = None
        self.cards = {}
        self.stop_event = threading.Event()
        self.test_queue = queue.Queue()
        self.pending = set()
        self.testing_kinds = set()
        self.testing_ifaces = {}
        self.current_proc = {"lan": None, "wifi": None}
        self.proc_lock = threading.Lock()

        self.last_connected = set()
        self.last_default = None
        self.last_lan_link = {}
        self.max_wifi_link = {}
        self.initial_scan_done = False
        # Ergebnisse bleiben während der gesamten Programmsitzung erhalten.
        self.results = {
            "lan": {
                "iface": None,
                "link": None,
                "down": None,
                "up": None,
                "tested": False,
                "passed": None,
            },
            "wifi": {
                "iface": None,
                "link": None,
                "down": None,
                "up": None,
                "tested": False,
                "passed": None,
            },
        }
    # --------------------------------------------------------
    # GUI
    # --------------------------------------------------------

    def do_activate(self):
        if self.window:
            self.window.present()
            return

        self.install_css()

        self.window = Gtk.ApplicationWindow(application=self)
        self.window.set_title("Network Check")
        self.window.set_default_size(690, 395)
        key_controller = Gtk.EventControllerKey.new()
        key_controller.connect("key-pressed", self.on_key_pressed)
        self.window.add_controller(key_controller)

        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        outer.set_margin_top(8)
        outer.set_margin_bottom(8)
        outer.set_margin_start(10)
        outer.set_margin_end(10)

        top = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        title_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=1)
        title_box.set_hexpand(True)

        title_line = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=5)

        title = Gtk.Label(label="NETWORK CHECK")
        title.set_xalign(0)
        title.add_css_class("main-title")

        version_label = Gtk.Label(label=f"v{VERSION}")
        version_label.set_xalign(0)
        version_label.add_css_class("version")
        title_line.append(title)
        title_line.append(version_label)

        self.global_status = Gtk.Label(label="Starting …")
        self.global_status.set_xalign(0)
        self.global_status.add_css_class("global-status")

        title_box.append(title_line)

        refresh_button = Gtk.Button(label="REFRESH")
        refresh_button.add_css_class("action")
        refresh_button.set_valign(Gtk.Align.CENTER)
        refresh_button.connect("clicked", self.on_test_clicked)
        top.append(title_box)
        top.append(refresh_button)

        outer.append(top)

        self.cards["lan"] = ConnectionCard("LAN")
        self.cards["wifi"] = ConnectionCard("WLAN")

        outer.append(self.cards["lan"].root)
        outer.append(self.cards["wifi"].root)

        self.window.set_child(outer)
        self.window.present()

        log("Network Check gestartet.")

        # Zwei Worker erlauben LAN- und WLAN-Test gleichzeitig.
        for worker_no in range(2):
            threading.Thread(
                target=self.worker,
                name=f"network-check-worker-{worker_no + 1}",
                daemon=True,
            ).start()
        # Zustandsüberwachung. Kein fester Start-Sleep:
        # die App reagiert, sobald NetworkManager einen Zustand meldet.
        GLib.timeout_add(750, self.poll_network)

    def install_css(self):
        css = b"""
        window {
            background: #101216;
            color: #f4f4f4;
        }

        .main-title {
            font-size: 17px;
            font-weight: 800;
            letter-spacing: 0.6px;
        }
        .version {
            color: #7f8792;
            font-size: 9px;
            font-weight: 700;
        }

        .global-status {
            color: #aeb4be;
            font-size: 12px;
        }

        .card {
            background: #191c22;
            border: 2px solid #303641;
            border-radius: 12px;
            padding: 8px;
        }

        .card-title {
            font-size: 19px;
            font-weight: 800;
        }
        .mac-error {
            color: #ff4c4c;
        }
        .mac-warning {
            color: #f5a623;
        }

        .interface {
            color: #aeb4be;
            font-size: 12px;
        }

        .badge {
            border-radius: 9px;
            padding: 5px 10px;
            font-weight: 800;
        }

        .metric {
            background: #111318;
            border-radius: 9px;
            padding: 6px 5px;
        }
        .metric-caption {
            color: #8f97a3;
            font-size: 11px;
            font-weight: 700;
        }

        .metric-value {
            font-size: 20px;
            font-weight: 800;
        }

        .note {
            color: #aeb4be;
            font-size: 11px;
        }

        .good {
            color: #61d36b;
        }

        .bad {
            color: #ff4c4c;
            background: #3b1212;
        }

        .warn {
            color: #ffd34d;
        }
        .neutral {
            color: #d8dde5;
        }

        .live {
            color: #70c7ff;
        }

        button.action {
            font-weight: 800;
            padding: 1px 12px;
            min-height: 18px;
        }
        """
        provider = Gtk.CssProvider()
        provider.load_from_data(css)
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
        )
    # --------------------------------------------------------
    # Netzwerkzustand
    # --------------------------------------------------------

    def best_device(self, device_list):
        if not device_list:
            return None
        return device_list[0]

    def poll_network(self):
        if self.stop_event.is_set():
            return False

        devices = get_devices()
        default_iface = get_default_iface()
        lan = self.best_device(devices["ethernet"])
        wifi = self.best_device(devices["wifi"])

        current_connected = set()
        iface_to_kind = {}

        for dev in devices["ethernet"]:
            iface_to_kind[dev["iface"]] = "lan"
            if dev["connected"]:
                current_connected.add(dev["iface"])

        for dev in devices["wifi"]:
            iface_to_kind[dev["iface"]] = "wifi"
            if dev["connected"]:
                current_connected.add(dev["iface"])
        self.refresh_card_presence("lan", lan, default_iface)
        self.refresh_card_presence("wifi", wifi, default_iface)

        # Beim ersten Scan alle verbundenen LAN-/WLAN-Interfaces einplanen.
        # Mit zwei Workern laufen LAN und WLAN parallel.
        if not self.initial_scan_done:
            self.initial_scan_done = True
            self.last_connected = set(current_connected)
            self.last_default = default_iface
            for iface in sorted(current_connected):
                kind = iface_to_kind.get(iface)
                if kind:
                    self.enqueue_test(iface, kind, "initial connected interface")
        else:
            # Neu verbundene Interfaces sofort testen, unabhängig davon, ob
            # sie gerade die Default-Route stellen.
            for iface in sorted(current_connected - self.last_connected):
                kind = iface_to_kind.get(iface)
                if kind:
                    self.enqueue_test(iface, kind, "interface connected")

            if default_iface != self.last_default and default_iface in current_connected:
                kind = iface_to_kind.get(default_iface)
                if kind:
                    self.enqueue_test(default_iface, kind, "active connection changed")
            # LAN-Link-Speed-Wechsel ist wichtig:
            # z.B. 1000 -> 100 Mbps bei Stecker/Kontaktproblem.
            for dev in devices["ethernet"]:
                iface = dev["iface"]
                if not dev["connected"]:
                    continue

                speed = ethernet_link_speed(iface)
                previous = self.last_lan_link.get(iface)
                self.last_lan_link[iface] = speed
                if (
                    previous is not None
                    and speed is not None
                    and int(previous) != int(speed)
                ):
                    log(f"LAN Link-Speed geändert: {iface}: {previous} -> {speed} Mbps")
                    self.enqueue_test(iface, "lan", "LAN link changed")

            self.last_connected = set(current_connected)
            self.last_default = default_iface
        return True

    def refresh_card_presence(self, kind, dev, default_iface):
        card = self.cards[kind]
        result = self.results[kind]
        if dev is None:
            card.set_title_mac(None, adapter_present=False)
            card.interface_label.set_text("Interface: --")
            if kind not in self.testing_kinds:
                card.set_state("NOT FOUND", "warn")
                card.note_label.set_text(
                    "Kein Adapter erkannt – nicht verbaut oder prüfen."
                )
            return

        iface = dev["iface"]
        mac = iface_mac(iface)
        card.set_title_mac(mac)
        is_default = iface == default_iface
        suffix = " • ACTIVE" if is_default else ""
        card.interface_label.set_text(f"Interface: {iface}{suffix}")

        if not dev["connected"]:
            if kind not in self.testing_kinds:
                card.set_state("NOT CONNECTED", "warn")
                card.note_label.set_text(
                    "Adapter vorhanden, aktuell aber nicht verbunden."
                )
            return
        # Sichtbaren LINK-Wert nur für die Verbindung aktualisieren,
        # die gerade wirklich getestet wird.
        if kind in self.testing_kinds:
            speed = self.best_link_speed(iface, kind, link_speed(iface, kind))

            if speed is not None:
                result["link"] = speed
                result["iface"] = iface
                if kind == "lan":
                    klass = "good" if speed >= LAN_LINK_MIN else "bad"
                else:
                    klass = "good" if speed >= WIFI_LINK_MIN else "bad"

                card.set_metric("link", format_mbps(speed), klass)
        # Wenn gerade nicht getestet wird, vorheriges Testergebnis erhalten.
        if kind not in self.testing_kinds:
            if result["tested"]:
                self.apply_final_state(kind)
            else:
                card.set_state("CONNECTED", "neutral")
                card.note_label.set_text("Bereit für Speedtest.")

    # --------------------------------------------------------
    # Queue / Buttons
    # --------------------------------------------------------
    def best_link_speed(self, iface, kind, speed):
        if speed is None:
            return None

        if kind != "wifi":
            return speed

        previous = self.max_wifi_link.get(iface)

        if previous is None or speed > previous:
            self.max_wifi_link[iface] = speed
            log(
                f"WLAN neuer maximaler LINK {iface}: "
                f"{speed} Mbps"
            )

        return self.max_wifi_link[iface]
    def enqueue_test(self, iface, kind, reason):
        key = (iface, kind)

        if key in self.pending:
            return
        if kind in self.testing_kinds:
            return

        self.pending.add(key)
        self.test_queue.put((iface, kind, reason))
        log(f"Test eingeplant: {kind.upper()} {iface} ({reason})")

    def on_test_clicked(self, button):
        devices = get_devices()
        scheduled = 0

        for dev in devices["ethernet"]:
            if dev["connected"]:
                self.enqueue_test(dev["iface"], "lan", "manual REFRESH")
                scheduled += 1

        for dev in devices["wifi"]:
            if dev["connected"]:
                self.enqueue_test(dev["iface"], "wifi", "manual REFRESH")
                scheduled += 1

        if scheduled == 0:
            self.global_status.set_text("No connected LAN/WLAN interface.")
        else:
            self.global_status.set_text("LAN/WLAN tests scheduled in parallel.")

    # --------------------------------------------------------
    # Worker
    # --------------------------------------------------------
    def worker(self):
        while not self.stop_event.is_set():
            try:
                iface, kind, reason = self.test_queue.get(timeout=0.5)
            except queue.Empty:
                continue

            self.pending.discard((iface, kind))

            if self.stop_event.is_set():
                break
            # Ist Interface immer noch verbunden?
            devices = get_devices()
            typ = "ethernet" if kind == "lan" else "wifi"
            still_connected = any(
                d["iface"] == iface and d["connected"]
                for d in devices[typ]
            )

            if not still_connected:
                log(f"Test übersprungen, nicht mehr verbunden: {iface}")
                continue

            if kind in self.testing_kinds:
                continue

            self.testing_kinds.add(kind)
            self.testing_ifaces[kind] = iface
            try:
                self.run_full_test(iface, kind, reason)
            except Exception as e:
                log(f"Testfehler {iface}: {e!r}")
                GLib.idle_add(self.mark_test_error, kind, iface, str(e))
            finally:
                self.testing_kinds.discard(kind)
                self.testing_ifaces.pop(kind, None)
    def run_full_test(self, iface, kind, reason):
        log(f"START {kind.upper()} {iface} ({reason})")
        GLib.idle_add(self.mark_testing, kind, iface, "WAITING FOR INTERNET")

        if not self.wait_for_internet(iface):
            raise RuntimeError("Cloudflare nicht über dieses Interface erreichbar")

        if self.stop_event.is_set():
            return
        current_link = self.best_link_speed(iface, kind, link_speed(iface, kind))
        if current_link is not None:
            self.results[kind]["link"] = current_link
            self.results[kind]["iface"] = iface
            GLib.idle_add(self.update_link, kind, current_link)

        GLib.idle_add(self.mark_testing, kind, iface, "DOWNLOAD")
        down = self.measure_phase(iface, kind, "download")

        if self.stop_event.is_set():
            return
        # Downloadphase ist fertig:
        # sofort den endgültigen TOP-AVG-Wert anzeigen und bewerten.
        self.results[kind]["down"] = down
        GLib.idle_add(
            self.update_phase_final_value,
            kind,
            "down",
            down,
        )

        GLib.idle_add(self.mark_testing, kind, iface, "UPLOAD")
        up = self.measure_phase(iface, kind, "upload")

        if self.stop_event.is_set():
            return
        # Uploadphase ist fertig:
        # ebenfalls sofort den endgültigen Wert anzeigen.
        self.results[kind]["up"] = up
        GLib.idle_add(
            self.update_phase_final_value,
            kind,
            "up",
            up,
        )

        result = self.results[kind]
        result["iface"] = iface
        result["down"] = down
        result["up"] = up
        result["tested"] = True
        # Link nach dem Test nochmals lesen.
        final_link = self.best_link_speed(iface, kind, link_speed(iface, kind))
        if final_link is not None:
            result["link"] = final_link

        result["passed"] = self.result_passes(kind)

        log(
            f"FERTIG {kind.upper()} {iface}: "
            f"Link={result['link']} Mbps, "
            f"Down={down:.1f} Mbps, Up={up:.1f} Mbps, "
            f"PASS={result['passed']}"
        )
        GLib.idle_add(self.apply_result_to_ui, kind)

    # --------------------------------------------------------
    # Bereitschaft
    # --------------------------------------------------------

    def wait_for_internet(self, iface):
        deadline = time.monotonic() + CONNECTIVITY_TIMEOUT
        while time.monotonic() < deadline and not self.stop_event.is_set():
            try:
                p = subprocess.run(
                    [
                        "curl",
                        "--interface", iface,
                        "--silent",
                        "--fail",
                        "--connect-timeout", "2",
                        "--max-time", "3",
                        "--output", "/dev/null",
                        CF_CHECK,
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    env=ENV_C,
                )
                if p.returncode == 0:
                    log(f"Internet bereit auf {iface}")
                    return True
            except Exception:
                pass
            # Zustandsbasiertes Retry, kein Start-Delay.
            for _ in range(5):
                if self.stop_event.is_set():
                    return False
                time.sleep(0.1)

        return False

    # --------------------------------------------------------
    # Speedtest
    # --------------------------------------------------------
    def launch_download_stream(self, iface, remaining, stream_no):
        # Große Datalix-Testdatei aus Frankfurt.
        # Cache-Buster nur zur Sicherheit; der Transfer wird nach 5s beendet.
        sep = "&" if "?" in DOWNLOAD_URL else "?"
        url = f"{DOWNLOAD_URL}{sep}stream={stream_no}-{time.time_ns()}"
        cmd = [
            "curl",
            "--ipv4",
            "--interface", iface,
            "--silent",
            "--show-error",
            "--fail",
            "--location",
            "--connect-timeout", "2",
            "--max-time", f"{max(0.5, remaining):.2f}",
            "--header", "Cache-Control: no-cache",
            "--output", "/dev/null",
            url,
        ]
        return subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=ENV_C,
            start_new_session=True,
        )
    def launch_upload_stream(self, iface, remaining, stream_no):
        # Cloudflares eigener Referenz-Speedtest verwendet Uploadgrößen
        # bis 50 MB. Mehrere parallele Streams vermeiden, dass eine
        # Gigabit-Leitung durch einen einzelnen TCP-Stream limitiert wird.
        shell = (
            'head -c "$4" /dev/zero | '
            'curl --interface "$1" '
            '--silent --connect-timeout 2 '
            '--max-time "$2" '
            '--output /dev/null '
            '--request POST '
            '--header "Content-Type: application/octet-stream" '
            '--header "Cache-Control: no-cache" '
            '--data-binary @- '
            '"$3"'
        )
        return subprocess.Popen(
            [
                "bash", "-c", shell,
                "_",
                iface,
                f"{max(0.5, remaining):.2f}",
                CF_UP,
                str(CF_UP_BYTES),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            env=ENV_C,
            start_new_session=True,
        )

    def set_current_proc(self, kind, procs):
        with self.proc_lock:
            self.current_proc[kind] = procs
    def kill_process(self, proc):
        if proc is None:
            return

        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except Exception:
            try:
                proc.terminate()
            except Exception:
                pass
        try:
            proc.wait(timeout=0.5)
        except Exception:
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

    def kill_processes(self, procs):
        if not procs:
            return
        for proc in procs:
            self.kill_process(proc)
    def kill_current_process(self):
        with self.proc_lock:
            current = dict(self.current_proc)
            self.current_proc = {"lan": None, "wifi": None}

        for procs in current.values():
            if procs is None:
                continue
            if isinstance(procs, (list, tuple)):
                self.kill_processes(procs)
            else:
                self.kill_process(procs)

    def start_parallel_streams(self, iface, kind, direction, remaining):
        procs = []
        stream_count = (
            DOWNLOAD_STREAMS
            if direction == "download"
            else UPLOAD_STREAMS
        )

        for stream_no in range(stream_count):
            if direction == "download":
                proc = self.launch_download_stream(
                    iface, remaining, stream_no
                )
            else:
                proc = self.launch_upload_stream(
                    iface, remaining, stream_no
                )
            procs.append(proc)
        self.set_current_proc(kind, procs)
        return procs

    def measure_phase(self, iface, kind, direction):
        start_t = time.monotonic()
        deadline = start_t + PHASE_SECONDS

        last_bytes = iface_counter(iface, direction)
        last_t = start_t

        # Endwert = Mittelwert der stabilisierten Live-Samples.
        # Der Hochlauf der ersten WARMUP_SECONDS wird nicht eingerechnet.
        stable_samples = []
        all_samples = []
        procs = self.start_parallel_streams(
            iface,
            kind,
            direction,
            PHASE_SECONDS,
        )

        while time.monotonic() < deadline and not self.stop_event.is_set():
            time.sleep(SAMPLE_SECONDS)

            now = time.monotonic()
            cur = iface_counter(iface, direction)

            dt = now - last_t
            delta = max(0, cur - last_bytes)
            if dt > 0:
                live = delta * 8.0 / dt / 1_000_000.0
                all_samples.append(live)

                if now - start_t >= WARMUP_SECONDS:
                    stable_samples.append(live)

                GLib.idle_add(
                    self.update_live_speed,
                    kind,
                    direction,
                    live,
                )

            last_bytes = cur
            last_t = now
            # Falls alle Transfers auf einer schnellen Leitung schon
            # komplett fertig sind, sofort neue parallele Streams starten.
            if procs and all(p.poll() is not None for p in procs):
                remaining = deadline - time.monotonic()
                if remaining > 0.35:
                    procs = self.start_parallel_streams(
                        iface,
                        kind,
                        direction,
                        remaining,
                    )
        self.kill_processes(procs)
        self.set_current_proc(kind, None)

        samples = stable_samples if stable_samples else all_samples

        # Null-/Fehlersamples nicht schönrechnen.
        useful = [v for v in samples if v > 0.05]

        if not useful:
            raise RuntimeError(f"Keine {direction}-Daten gemessen")
        # Nicht den gesamten Mittelwert verwenden:
        # Der Verbindungsaufbau am Anfang ist real, aber für unsere
        # Prüfstation interessiert die stabil erreichbare Geschwindigkeit.
        #
        # Deshalb sortieren wir die stabilisierten Samples und bilden
        # den Mittelwert aus den schnellsten 50 %. Das ist robuster als
        # einfach den Maximalwert zu nehmen.
        sorted_samples = sorted(useful, reverse=True)
        top_count = max(1, int(len(sorted_samples) * TOP_SAMPLE_FRACTION + 0.5))
        top_samples = sorted_samples[:top_count]
        raw_avg = sum(useful) / len(useful)
        avg = sum(top_samples) / len(top_samples)

        stream_count = (
            DOWNLOAD_STREAMS
            if direction == "download"
            else UPLOAD_STREAMS
        )

        log(
            f"{iface} {direction}: TOP-AVG {avg:.1f} Mbps "
            f"(Gesamt-AVG={raw_avg:.1f}, "
            f"Top={top_count}/{len(useful)} Samples, "
            f"Streams={stream_count}, Phase={PHASE_SECONDS:.1f}s)"
        )

        return avg
    # --------------------------------------------------------
    # Bewertung
    # --------------------------------------------------------

    def result_passes(self, kind):
        r = self.results[kind]

        if r["link"] is None or r["down"] is None or r["up"] is None:
            return False

        if kind == "lan":
            return (
                r["link"] >= LAN_LINK_MIN
                and r["down"] >= LAN_DOWNLOAD_MIN
                and r["up"] >= LAN_UPLOAD_MIN
            )
        return (
            r["link"] >= WIFI_LINK_MIN
            and r["down"] >= WIFI_DOWNLOAD_MIN
            and r["up"] >= WIFI_UPLOAD_MIN
        )

    def metric_class(self, kind, metric, value):
        if value is None:
            return "warn"
        if metric == "link":
            minimum = LAN_LINK_MIN if kind == "lan" else WIFI_LINK_MIN
        elif metric == "down":
            minimum = LAN_DOWNLOAD_MIN if kind == "lan" else WIFI_DOWNLOAD_MIN
        else:
            minimum = LAN_UPLOAD_MIN if kind == "lan" else WIFI_UPLOAD_MIN

        return "good" if value >= minimum else "bad"

    # --------------------------------------------------------
    # UI-Updates aus Worker
    # --------------------------------------------------------
    def mark_testing(self, kind, iface, phase):
        card = self.cards[kind]
        card.interface_label.set_text(f"Interface: {iface}")
        card.set_state(phase, "live")
        card.note_label.set_text("Speedtest läuft …")
        # Die gerade laufende Phase ist vom ersten Moment an GELB.
        # Bereits abgeschlossene Werte bleiben in ihrer Endfarbe sichtbar.
        if phase == "DOWNLOAD":
            card.set_metric("down", "0.0 Mbps", "warn")
        elif phase == "UPLOAD":
            card.set_metric("up", "0.0 Mbps", "warn")

        self.global_status.set_text(f"{kind.upper()} {iface}: {phase}")
        return False
    def update_link(self, kind, speed):
        card = self.cards[kind]
        card.set_metric(
            "link",
            format_mbps(speed),
            self.metric_class(kind, "link", speed),
        )
        return False

    def update_live_speed(self, kind, direction, speed):
        card = self.cards[kind]
        metric = "down" if direction == "download" else "up"
        # Solange die Messung läuft, ist der Live-Wert bewusst GELB.
        # So ist auf einen Blick erkennbar, dass noch gemessen wird.
        # Erst der fertige Messwert wird wieder grün/rot bewertet.
        card.set_metric(
            metric,
            format_mbps(speed, decimals=1),
            "warn",
        )
        return False

    def update_phase_final_value(self, kind, metric, speed):
        card = self.cards[kind]
        # Nach Abschluss einer Phase sofort den gleichen Endwert einsetzen,
        # der später auch im fertigen Ergebnis stehen wird.
        card.set_metric(
            metric,
            format_mbps(speed, decimals=0),
            self.metric_class(kind, metric, speed),
        )
        return False
    def mark_test_error(self, kind, iface, error):
        card = self.cards[kind]
        card.set_state("TEST ERROR", "bad")
        card.note_label.set_text(error)
        self.global_status.set_text(f"{kind.upper()} test failed")
        return False

    def apply_result_to_ui(self, kind):
        r = self.results[kind]
        card = self.cards[kind]
        card.set_metric(
            "link",
            format_mbps(r["link"]),
            self.metric_class(kind, "link", r["link"]),
        )
        card.set_metric(
            "down",
            format_mbps(r["down"], decimals=0),
            self.metric_class(kind, "down", r["down"]),
        )
        card.set_metric(
            "up",
            format_mbps(r["up"], decimals=0),
            self.metric_class(kind, "up", r["up"]),
        )

        self.apply_final_state(kind)
        self.global_status.set_text(
            f"{kind.upper()} test finished • "
            f"Down {r['down']:.1f} / Up {r['up']:.1f} Mbps"
        )

        return False

    def apply_final_state(self, kind):
        r = self.results[kind]
        card = self.cards[kind]

        if not r["tested"]:
            return
        # LAN-Linkfehler hat Priorität.
        if kind == "lan" and r["link"] is not None and r["link"] < LAN_LINK_MIN:
            card.set_state("LAN LINK ERROR", "bad")
            card.note_label.set_text(
                "LAN unter 1.000 Mbps – Stecker, Buchse oder Kontakt prüfen!"
            )
            return
        if r["passed"]:
            card.set_state("PASS", "good")
            card.note_label.set_text(
                "Endwerte = Durchschnitt der schnellsten stabilen Messwerte."
            )
        else:
            card.set_state("TOO SLOW", "bad")
            card.note_label.set_text(
                "Endwerte = schnelle stabile Messwerte; mindestens ein Wert ist zu niedrig."
            )
    # --------------------------------------------------------
    # Ende
    # --------------------------------------------------------

    def on_key_pressed(self, controller, keyval, keycode, state):
        name = Gdk.keyval_name(keyval) or ""

        if state & Gdk.ModifierType.CONTROL_MASK:
            if name.lower() == "w":
                self.quit()
                return True
            if name.lower() == "q":
                helper = Path.home() / ".local/bin/close-diagnostic-apps.sh"
                try:
                    subprocess.Popen(
                        [str(helper)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        start_new_session=True,
                    )
                except Exception as exc:
                    log(f"Strg+Q Fehler: {exc}")
                return True
        return False

    def do_shutdown(self):
        self.stop_event.set()
        self.kill_current_process()
        log("Network Check beendet.")
        Gtk.Application.do_shutdown(self)


app = NetworkCheckApp()
raise SystemExit(app.run(None))
PY

python3 "$TMP_PY"
NETWORK_CHECK_SCRIPT_EOF

    chmod +x "$NETWORK_CHECK_SCRIPT"

    # App-Launcher für GNOME / Tiling Assistant
    write_network_check_desktop
    # Beim ersten Installieren standardmäßig Autostart EIN.
    # Bei Updates bestehenden EIN/AUS-Zustand beibehalten.
    if [ -f "$NETWORK_CHECK_AUTOSTART" ]; then
        if grep -qiE '^Hidden=true$' "$NETWORK_CHECK_AUTOSTART" 2>/dev/null \
            || grep -qiE '^X-GNOME-Autostart-enabled=false$' "$NETWORK_CHECK_AUTOSTART" 2>/dev/null
        then
            write_network_check_autostart false
        else
            write_network_check_autostart true
        fi
    else
        write_network_check_autostart true
    fi
    # Desktop-Datenbank aktualisieren, falls vorhanden.
    if command -v update-desktop-database >/dev/null 2>&1; then
        update-desktop-database "$APP_DIR" >/dev/null 2>&1 || true
    fi
    echo
    echo "OK: Network Check installiert/aktualisiert."
    echo
    echo "Programm:"
    echo "  $NETWORK_CHECK_SCRIPT"
    echo
    echo "GNOME-App:"
    echo "  $NETWORK_CHECK_APP_DESKTOP"
    echo
    echo "Autostart:"
    echo "  $NETWORK_CHECK_AUTOSTART"
    echo
    echo "Status: $(network_check_status)"
    echo
    echo "Im Tiling Assistant sollte die Anwendung als"
    echo "  Network Check"
    echo "auftauchen."

    pause
}

enable_network_check_autostart() {
    header
    if [ ! -x "$NETWORK_CHECK_SCRIPT" ]; then
        echo "Network Check ist noch nicht installiert."
        echo "Bitte zuerst Menüpunkt 11 verwenden."
        pause
        return
    fi

    write_network_check_desktop
    write_network_check_autostart true

    echo "Network Check Autostart: AKTIVIERT"
    echo
    echo "Beim nächsten Login startet Network Check als eigenes Fenster."
    pause
}

disable_network_check_autostart() {
    header
    if [ ! -x "$NETWORK_CHECK_SCRIPT" ]; then
        echo "Network Check ist noch nicht installiert."
        pause
        return
    fi

    write_network_check_desktop
    write_network_check_autostart false

    echo "Network Check Autostart: DEAKTIVIERT"
    echo
    echo "Das Programm bleibt installiert und kann weiterhin manuell"
    echo "oder über den Tiling Assistant gestartet werden."
    pause
}

start_network_check() {
    header
    if [ ! -x "$NETWORK_CHECK_SCRIPT" ]; then
        echo "Network Check ist noch nicht installiert."
        echo "Bitte zuerst Menüpunkt 11 verwenden."
        pause
        return
    fi

    if pgrep -f '/network-check\.sh|com\.david\.NetworkCheck' >/dev/null 2>&1; then
        echo "Network Check scheint bereits zu laufen."
    else
        nohup "$NETWORK_CHECK_SCRIPT" >/dev/null 2>&1 &
        echo "Network Check gestartet."
    fi

    echo
    echo "Es läuft als separates Fenster."
    pause
}

install_wipe_auto_menu() {
    header
    echo "Wipe Auto installieren / aktualisieren"
    echo "------------------------------------------------------------"
    echo

    if install_wipe_auto_app; then
        echo
        echo "OK."
        echo "Tiling Assistant App: Wipe Auto"
        echo "App-ID: com.david.WipeAuto"
    fi

    pause
}

start_wipe_auto() {
    header
    if [ ! -x "$WIPE_AUTO_SCRIPT" ]; then
        echo "Wipe Auto ist noch nicht installiert."
        echo "Bitte zuerst Menüpunkt 15 verwenden."
        pause
        return
    fi

    nohup "$WIPE_AUTO_SCRIPT" >/dev/null 2>&1 &

    echo "Wipe Auto gestartet."
    echo "Bei einer bereits laufenden Instanz wird das vorhandene Fenster aktiviert."
    pause
}

install_hardware_check_menu() {
    header
    echo "Hardware Check installieren / aktualisieren"
    echo "------------------------------------------------------------"
    echo

    if install_hardware_check_app; then
        echo
        echo "OK."
        echo "Tiling Assistant App: Hardware Check"
        echo "App-ID: com.david.HardwareCheck"
    fi

    pause
}

start_hardware_check() {
    header
    if [ ! -x "$HARDWARE_CHECK_SCRIPT" ]; then
        echo "Hardware Check ist noch nicht installiert."
        echo "Bitte zuerst Menüpunkt 17 verwenden."
        pause
        return
    fi

    nohup "$HARDWARE_CHECK_SCRIPT" >/dev/null 2>&1 &

    echo "Hardware Check gestartet."
    echo "Bei einer bereits laufenden Instanz wird das vorhandene Fenster aktiviert."
    pause
}


main_menu() {
    while true; do
        header
        echo "KIOSK"
        echo "  1) 4-Felder Diagnose-Kiosk installieren/aktualisieren"
        echo "  2) 4-Felder-Kiosk jetzt testen"
        echo "  3) Kiosk-Log anzeigen"
        echo
        echo "GNOME AUTOSTART"
        echo "  4) Alle Autostarts anzeigen"
        echo "  5) Details eines Eintrags anzeigen"
        echo "  6) Autostart deaktivieren"
        echo "  7) Autostart aktivieren"
        echo "  8) Benutzer-Autostart löschen"
        echo
        echo "SYSTEMD BENUTZERDIENSTE"
        echo "  9) Aktivierte Benutzer-Services anzeigen"
        echo " 10) Benutzer-Service deaktivieren"
        echo
        echo "NETWORK CHECK  [$(network_check_status)]"
        echo " 11) Installieren / aktualisieren"
        echo " 12) Autostart aktivieren"
        echo " 13) Autostart deaktivieren"
        echo " 14) Jetzt starten"
        echo
        echo "WIPE AUTO"
        echo " 15) Installieren / aktualisieren"
        echo " 16) Jetzt starten"
        echo
        echo "HARDWARE CHECK"
        echo " 17) Installieren / aktualisieren"
        echo " 18) Jetzt starten"
        echo
        echo "  0) Beenden"
        echo
        local choice
        read -r -p "Auswahl: " choice
        case "$choice" in
            1) install_kiosk ;;
            2) test_kiosk ;;
            3) show_kiosk_log ;;
            4)
                header
                show_autostarts
                pause
                ;;
            5) show_details ;;
            6) disable_autostart ;;
            7) enable_autostart ;;
            8) delete_user_autostart ;;
            9) show_user_services ;;
            10) disable_user_service ;;
            11) install_network_check ;;
            12) enable_network_check_autostart ;;
            13) disable_network_check_autostart ;;
            14) start_network_check ;;
            15) install_wipe_auto_menu ;;
            16) start_wipe_auto ;;
            17) install_hardware_check_menu ;;
            18) start_hardware_check ;;
            0)
                echo
                echo "Beendet."
                exit 0
                ;;
            *)
                echo "Ungültige Auswahl."
                sleep 1
                ;;
        esac
    done
}

apply_update_noninteractive() {
    AUTO_MODE=1

    # Netzwerkmodul zuerst aktualisieren, danach das komplette 4-Felder-
    # Kiosk-Setup. install_kiosk aktualisiert Wipe Auto, Hardware Check,
    # Helper, Launcher und die benötigten GNOME-/ydotool-Einstellungen.
    install_network_check || return 1
    install_kiosk || return 1
    return 0
}

if [ "${1:-}" = "--apply-update" ]; then
    if apply_update_noninteractive; then
        exit 0
    fi
    exit 1
fi

main_menu
