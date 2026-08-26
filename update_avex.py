import re
import json
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

URL = "https://adhocladen.de/euskirchen/avex-mineraloelhandelsgesellschaft/"

TIMEZONE = ZoneInfo("Europe/Berlin")

req = urllib.request.Request(
    URL,
    headers={
        "User-Agent": "Mozilla/5.0"
    }
)

with urllib.request.urlopen(req) as r:
    html = r.read().decode("utf-8", errors="ignore")

price = re.search(
    r'(\d+,\d{2})\s*€/kWh',
    html
)

free = re.search(
    r'<strong>(\d+)</strong><span>frei',
    html,
    re.I
)

occupied = re.search(
    r'<strong>(\d+)</strong><span>belegt',
    html,
    re.I
)

offline = re.search(
    r'<strong>(\d+)</strong><span>offline',
    html,
    re.I
)

now = datetime.now(TIMEZONE)

price_text = price.group(1) if price else "?"

data = {
    "price": price_text,
    "free": int(free.group(1)) if free else 0,
    "occupied": int(occupied.group(1)) if occupied else 0,
    "offline": int(offline.group(1)) if offline else 0,
    "updated": now.strftime("%H:%M")
}

with open("avex-data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)


# --------------------------------------------------
# 24-Stunden Preisverlauf
# --------------------------------------------------

history_file = "avex-history.json"

try:
    with open(history_file, "r", encoding="utf-8") as f:
        history = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    history = []


if price_text != "?":

    current_price = float(
        price_text.replace(",", ".")
    )

    # Nur speichern, wenn sich der Preis geändert hat
    if (
        not history
        or float(history[-1]["price"]) != current_price
    ):
        history.append({
            "time": now.isoformat(timespec="minutes"),
            "price": current_price
        })


    # Nur die letzten 24 Stunden behalten.
    # Zusätzlich den letzten Punkt VOR dem 24h-Fenster behalten,
    # damit der Startpreis des Diagramms bekannt bleibt.
    cutoff = now - timedelta(hours=24)

    older_points = []
    recent_points = []

    for point in history:

        point_time = datetime.fromisoformat(
            point["time"]
        )

        if point_time < cutoff:
            older_points.append(point)
        else:
            recent_points.append(point)

    if older_points:
        recent_points.insert(
            0,
            older_points[-1]
        )

    history = recent_points


    with open(
        history_file,
        "w",
        encoding="utf-8"
    ) as f:
        json.dump(
            history,
            f,
            ensure_ascii=False,
            indent=2
        )


print(data)
print("Price history:", history)
