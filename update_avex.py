import re
import json
import urllib.request
from datetime import datetime

URL = "https://adhocladen.de/euskirchen/avex-mineraloelhandelsgesellschaft/"

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

data = {
    "price": price.group(1) if price else "?",
    "free": int(free.group(1)) if free else 0,
    "occupied": int(occupied.group(1)) if occupied else 0,
    "offline": int(offline.group(1)) if offline else 0,
    "updated": datetime.now().strftime("%H:%M")
}

with open("avex-data.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("PRICE:",
      price.group(0) if price else "NICHT GEFUNDEN")

print("FREE:",
      free.group(0) if free else "NICHT GEFUNDEN")

print("OCCUPIED:",
      occupied.group(0) if occupied else "NICHT GEFUNDEN")

print("OFFLINE:",
      offline.group(0) if offline else "NICHT GEFUNDEN")

print(data) 
