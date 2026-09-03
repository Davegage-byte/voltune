# AVEX Scraper Version: 2026-09-03-v3

import re
import json
import urllib.request
from collections import Counter
from datetime import datetime, timedelta
from html.parser import HTMLParser
from zoneinfo import ZoneInfo


# --------------------------------------------------
# Quellen
# --------------------------------------------------

# Preis:
# e-Stations zeigt den AFIR-/Mobilithek-Datensatz von EW Pricing
PRICE_URL = (
    "https://www.e-stations.de/ladestationen/"
    "euskirchen/avex-euskirchen-108"
)

# Belegung:
# Bestehende Quelle beibehalten, da sie im bisherigen Projekt funktioniert
STATUS_URL = (
    "https://adhocladen.de/euskirchen/"
    "avex-mineraloelhandelsgesellschaft/"
)

TIMEZONE = ZoneInfo("Europe/Berlin")

SCRAPER_VERSION = "2026-09-03-v3"

DATA_FILE = "avex-data.json"
HISTORY_FILE = "avex-history.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/152.0.0.0 Safari/537.36"
    ),
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,*/*;q=0.8"
    ),
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.7",
}


# --------------------------------------------------
# Hilfsfunktionen
# --------------------------------------------------

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def get_text(self):
        return "\n".join(self.parts)


def download(url):
    req = urllib.request.Request(
        url,
        headers=HEADERS
    )

    with urllib.request.urlopen(
        req,
        timeout=30
    ) as response:
        return response.read().decode(
            "utf-8",
            errors="ignore"
        )


def html_to_text(html):
    parser = TextExtractor()
    parser.feed(html)

    text = parser.get_text()
    text = text.replace("\xa0", " ")

    return text


def load_json(filename, default):
    try:
        with open(
            filename,
            "r",
            encoding="utf-8"
        ) as f:
            return json.load(f)

    except (
        FileNotFoundError,
        json.JSONDecodeError
    ):
        return default


print("AVEX Scraper Version:", SCRAPER_VERSION)

# --------------------------------------------------
# Vorherige Werte laden
# --------------------------------------------------

old_data = load_json(
    DATA_FILE,
    {}
)

old_price = str(
    old_data.get("price", "?")
)

old_free = int(
    old_data.get("free", 0)
)

old_occupied = int(
    old_data.get("occupied", 0)
)

old_offline = int(
    old_data.get("offline", 0)
)


# --------------------------------------------------
# PREIS
# e-Stations -> Mobilithek -> EW Pricing
# --------------------------------------------------

price_text = old_price
price_fresh = False
price_candidates = []

try:
    price_html = download(
        PRICE_URL
    )

    price_page_text = html_to_text(
        price_html
    )

    # --------------------------------------------------
    # Robuste Preiserkennung
    # --------------------------------------------------
    #
    # e-Stations wiederholt den aktuellen Ad-Hoc-Preis
    # bei jedem der 8 Ladepunkte.
    #
    # Deshalb suchen wir ALLE €/kWh-Werte und nehmen
    # den am häufigsten vorkommenden Wert.
    #
    # Aktuell sollte 0,56 €/kWh achtmal vorkommen.
    normalized_text = price_page_text.replace(
        "\xa0",
        " "
    )

    normalized_text = re.sub(
        r"\s+",
        " ",
        normalized_text
    )

    all_price_candidates = re.findall(
        r'(\d+[,.]\d{2})\s*'
        r'(?:€|EUR)\s*/\s*kWh',
        normalized_text,
        re.I
    )

    all_price_candidates = [
        value.replace(".", ",")
        for value in all_price_candidates
    ]

    if not all_price_candidates:
        # Zusätzlicher Fallback direkt auf dem HTML,
        # falls das €-Zeichen als HTML-Entity codiert ist.
        all_price_candidates = re.findall(
            r'(\d+[,.]\d{2})\s*'
            r'(?:€|EUR|&euro;|&#8364;)\s*/\s*kWh',
            price_html,
            re.I
        )

        all_price_candidates = [
            value.replace(".", ",")
            for value in all_price_candidates
        ]

    if not all_price_candidates:
        raise ValueError(
            "Auf e-Stations wurde kein €/kWh-Wert gefunden"
        )

    all_counter = Counter(
        all_price_candidates
    )

    most_common_price, occurrences = (
        all_counter.most_common(1)[0]
    )

    # Bei dieser AVEX-Station wird derselbe Preis
    # normalerweise 8x angezeigt. Zwei Treffer reichen
    # als Sicherheitscheck, falls sich die Seite ändert.
    if occurrences < 2:
        raise ValueError(
            "Kein eindeutig wiederholter Preis gefunden. "
            f"Treffer: {all_price_candidates}"
        )

    price_candidates = [
        most_common_price
    ] * occurrences

    print(
        "Preis-Kandidaten auf e-Stations:",
        dict(all_counter)
    )

    # Auf der Station wird derselbe Tarif bei
    # mehreren EVSEs wiederholt.
    #
    # Falls die Seite einmal unterschiedliche Preise
    # liefert, verwenden wir den am häufigsten
    # vorkommenden und schreiben eine Warnung ins Log.
    counter = Counter(
        price_candidates
    )

    price_text = counter.most_common(
        1
    )[0][0]

    price_fresh = True

    unique_prices = sorted(
        set(price_candidates)
    )

    if len(unique_prices) > 1:
        print(
            "WARNUNG: Unterschiedliche "
            "Ad-Hoc-Preise gefunden:",
            unique_prices
        )

except Exception as exc:
    print(
        "WARNUNG: Preis konnte nicht "
        "von e-Stations geladen werden:",
        repr(exc)
    )
    print(
        "Verwende letzten bekannten Preis:",
        old_price
    )


# --------------------------------------------------
# STATUS
# Bestehende adhocladen-Quelle
# --------------------------------------------------

free = old_free
occupied = old_occupied
offline = old_offline
status_fresh = False

try:
    status_html = download(
        STATUS_URL
    )

    free_match = re.search(
        r'<strong>(\d+)</strong>\s*'
        r'<span>\s*frei',
        status_html,
        re.I
    )

    occupied_match = re.search(
        r'<strong>(\d+)</strong>\s*'
        r'<span>\s*belegt',
        status_html,
        re.I
    )

    offline_match = re.search(
        r'<strong>(\d+)</strong>\s*'
        r'<span>\s*offline',
        status_html,
        re.I
    )

    # Frei + Belegt sollten vorhanden sein.
    # Offline darf fehlen -> dann 0.
    if (
        free_match is None
        or occupied_match is None
    ):
        raise ValueError(
            "Frei/Belegt konnte nicht "
            "aus adhocladen gelesen werden"
        )

    free = int(
        free_match.group(1)
    )

    occupied = int(
        occupied_match.group(1)
    )

    offline = (
        int(offline_match.group(1))
        if offline_match
        else 0
    )

    status_fresh = True

except Exception as exc:
    print(
        "WARNUNG: Status konnte nicht "
        "von adhocladen geladen werden:",
        repr(exc)
    )
    print(
        "Verwende letzten bekannten Status:",
        {
            "free": old_free,
            "occupied": old_occupied,
            "offline": old_offline
        }
    )


# --------------------------------------------------
# JSON schreiben
# --------------------------------------------------

now = datetime.now(
    TIMEZONE
)

data = {
    "price": price_text,
    "free": free,
    "occupied": occupied,
    "offline": offline,
    "updated": now.strftime("%H:%M"),

    # Zusätzliche Infos.
    # Die bestehende Webseite ignoriert diese Felder,
    # sie sind aber später für Diagnose praktisch.
    "price_source": "e-stations / Mobilithek / EW Pricing",
    "status_source": "adhocladen",
    "price_fresh": price_fresh,
    "status_fresh": status_fresh
}

with open(
    DATA_FILE,
    "w",
    encoding="utf-8"
) as f:
    json.dump(
        data,
        f,
        ensure_ascii=False,
        indent=2
    )


# --------------------------------------------------
# 24-Stunden Preisverlauf
# --------------------------------------------------

history = load_json(
    HISTORY_FILE,
    []
)

# Nur einen neuen Verlaufspunkt schreiben,
# wenn der Preis bei DIESEM Lauf erfolgreich
# von e-Stations gelesen wurde.
#
# Dadurch erzeugt ein Seiten-/Netzwerkfehler
# keine falsche Preisänderung.
if (
    price_fresh
    and price_text != "?"
):

    current_price = float(
        price_text.replace(
            ",",
            "."
        )
    )

    # Nur speichern, wenn sich der Preis
    # gegenüber dem letzten Verlaufspunkt
    # wirklich geändert hat.
    if (
        not history
        or float(
            history[-1]["price"]
        ) != current_price
    ):
        history.append({
            "time": now.isoformat(
                timespec="minutes"
            ),
            "price": current_price
        })

    # Nur die letzten 24 Stunden behalten.
    #
    # Zusätzlich den letzten Punkt VOR dem
    # 24h-Fenster behalten, damit das Diagramm
    # den zu Beginn gültigen Preis kennt.
    cutoff = now - timedelta(
        hours=24
    )

    older_points = []
    recent_points = []

    for point in history:

        try:
            point_time = (
                datetime.fromisoformat(
                    point["time"]
                )
            )
        except (
            KeyError,
            TypeError,
            ValueError
        ):
            continue

        if point_time < cutoff:
            older_points.append(
                point
            )
        else:
            recent_points.append(
                point
            )

    if older_points:
        recent_points.insert(
            0,
            older_points[-1]
        )

    history = recent_points

    with open(
        HISTORY_FILE,
        "w",
        encoding="utf-8"
    ) as f:
        json.dump(
            history,
            f,
            ensure_ascii=False,
            indent=2
        )


# --------------------------------------------------
# GitHub-Actions-Log
# --------------------------------------------------

print(
    json.dumps(
        data,
        ensure_ascii=False,
        indent=2
    )
)

if price_candidates:
    print(
        "Gefundene HPC-Preiswerte:",
        price_candidates
    )

print(
    "Price history:",
    history
)
