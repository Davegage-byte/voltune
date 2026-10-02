"""Build compact Tesla dashboard data for the AVEX/Tesla start page."""

import json
import math
import re
import urllib.request
from html import unescape
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

TIMEZONE = ZoneInfo("Europe/Berlin")
OUTPUT = Path("tesla-dashboard-data.json")
SUPERCHARGERS_URL = "https://raw.githubusercontent.com/Niek/tesla-superchargers/main/superchargers-with-pricing.json"
NEWS_URL = "https://www.notateslaapp.com/rss"
AVEX = {"name": "AVEX Euskirchen", "latitude": 50.686726020023045, "longitude": 6.838122769536388}
REFRESH_AFTER = timedelta(minutes=30)
# Keep a compact Europe-wide pool so the browser can pick the 12 nearest sites
# from the user's live GPS position without calling a third-party API client-side.
EUROPE_BOUNDS = {"min_lat": 34.0, "max_lat": 72.0, "min_lon": -12.0, "max_lon": 32.0}
MAX_SUPERCHARGERS = 2500
DATA_VERSION = 5
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Voltune-Tesla-Dashboard/1.2"

PUBLIC_PRICE_SOURCES = {
    "Bonn, Germany": "https://adhoccharging.eu/de/city/bonn/tesla-am-bonner-bogen-1/",
    "Frechen, Germany": "https://adhoccharging.eu/de/city/frechen/tesla-europaallee-8/",
    "Kerpen, Germany": "https://adhoccharging.eu/de/city/sindorf/tesla-kerpener-strasse-150/",
}


def load_json(path, default):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError, OSError):
        return default


def timestamp(value):
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=TIMEZONE)
        return dt.astimezone(TIMEZONE)
    except (TypeError, ValueError):
        return None


def download_bytes(url, max_bytes=20_000_000):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Cache-Control": "no-cache",
            "Accept": "*/*",
        },
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        data = response.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ValueError("Response too large")
    return data


def haversine_km(lat1, lon1, lat2, lon2):
    radius = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def normalize_rates(block):
    if not isinstance(block, dict):
        return None
    raw_rates = block.get("rates")
    if not isinstance(raw_rates, list):
        return None
    rates = []
    for value in raw_rates:
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if math.isfinite(number) and 0 <= number <= 5:
            rates.append(round(number, 4))
    rates = sorted(set(rates))
    if not rates:
        return None
    return {
        "rates": rates,
        "currency": block.get("currency"),
        "metric": block.get("metric"),
    }


def fetch_public_price(site_name, now):
    url = PUBLIC_PRICE_SOURCES.get(site_name)
    if not url:
        return None

    raw = download_bytes(url, max_bytes=3_000_000).decode("utf-8", errors="replace")
    text = unescape(re.sub(r"<[^>]+>", " ", raw))
    text = " ".join(text.split())

    patterns = (
        r"Ad-hoc\s+(?:ab|from)\s+€?\s*(\d+[,.]\d+)\s*€?\s*/\s*kWh",
        r"(?:Energiepreis|Energy rate)\s+(\d+[,.]\d+)\s*EUR\s*/\s*kWh",
    )

    parsed = []
    for pattern in patterns:
        for value in re.findall(pattern, text, flags=re.I):
            try:
                number = float(value.replace(",", "."))
            except ValueError:
                continue
            if 0.05 <= number <= 3:
                parsed.append(round(number, 4))
        if parsed:
            break

    unique = sorted(set(parsed))
    if not unique:
        raise ValueError("no public tariff found in response")
    if len(unique) != 1:
        raise ValueError(f"ambiguous public tariffs: {unique}")

    return {
        "rate": unique[0],
        "currency": "EUR",
        "metric": "kWh",
        "source": "adhoccharging.eu / Mobilithek",
        "url": url,
        "checked_at": now.isoformat(timespec="seconds"),
        "kind": "public",
    }


def fetch_superchargers(now):
    payload = json.loads(download_bytes(SUPERCHARGERS_URL).decode("utf-8"))
    nearby = []

    for site_id, site in payload.items():
        if not isinstance(site, dict) or site.get("type") != "SITE_TYPE_SUPERCHARGER":
            continue

        location = site.get("location") or {}
        try:
            lat = float(location["latitude"])
            lon = float(location["longitude"])
        except (KeyError, TypeError, ValueError):
            continue

        if not (
            EUROPE_BOUNDS["min_lat"] <= lat <= EUROPE_BOUNDS["max_lat"]
            and EUROPE_BOUNDS["min_lon"] <= lon <= EUROPE_BOUNDS["max_lon"]
        ):
            continue

        distance = haversine_km(
            AVEX["latitude"], AVEX["longitude"], lat, lon
        )

        prices = site.get("prices") or {}
        member = normalize_rates(prices.get("member"))
        user = normalize_rates(prices.get("user"))

        public_price = None
        if site.get("name") in PUBLIC_PRICE_SOURCES:
            try:
                public_price = fetch_public_price(site.get("name"), now)
            except Exception as exc:
                print(f"Public price unavailable for {site.get('name')}: {exc}")
                public_price = None

        nearby.append(
            {
                "id": site_id,
                "name": site.get("name") or "Tesla Supercharger",
                "latitude": lat,
                "longitude": lon,
                "distance_km": round(distance, 1),
                "power_kw": site.get("power"),
                "stalls": site.get("stalls"),
                "access": site.get("access"),
                "member_price": member,
                "other_price": user,
                "public_price": public_price,
            }
        )

    nearby.sort(key=lambda item: item["distance_km"])
    return nearby[:MAX_SUPERCHARGERS]


def probe_suc_tracker():
    """One-run-safe diagnostics for discovering SuC-Tracker's public browser data path."""
    base = "https://suc-tracker.eu/"
    try:
        html = download_bytes(base, max_bytes=2_000_000).decode("utf-8", errors="replace")
    except Exception as exc:
        print(f"SuC-Tracker probe homepage failed: {exc}")
        return

    script_srcs = re.findall(r'<script[^>]+src=["\\\']([^"\\\']+)["\\\']', html, flags=re.I)
    links = re.findall(r'(?:href|src)=["\\\']([^"\\\']+)["\\\']', html, flags=re.I)
    print("SuC-Tracker scripts:", script_srcs[:20])
    print("SuC-Tracker asset links:", [x for x in links if "asset" in x.lower()][:20])

    for src in script_srcs[:8]:
        if src.startswith("//"):
            url = "https:" + src
        elif src.startswith("http://") or src.startswith("https://"):
            url = src
        else:
            url = base.rstrip("/") + "/" + src.lstrip("/")

        try:
            js = download_bytes(url, max_bytes=5_000_000).decode("utf-8", errors="replace")
        except Exception as exc:
            print(f"SuC-Tracker asset failed {url}: {exc}")
            continue

        candidates = set()
        for match in re.findall(r'["\\\']([^"\\\']{3,300})["\\\']', js):
            low = match.lower()
            if (
                "/api/" in low
                or low.endswith(".json")
                or "supercharger" in low
                or "pricing" in low
                or "tariff" in low
                or "station" in low
                or "charger" in low
                or "price" in low and ("/" in match or "http" in low)
            ):
                if len(match) <= 280:
                    candidates.add(match)

        absolute_urls = sorted(set(re.findall(r'https?://[^"\\\'\\s)]+', js)))
        fetch_snippets = []
        for needle in ("fetch(", "axios", "supabase", "firebase", "/api/", ".json", "chargers", "stations", "prices"):
            start = 0
            hits = 0
            low_js = js.lower()
            low_needle = needle.lower()
            while hits < 8:
                pos = low_js.find(low_needle, start)
                if pos < 0:
                    break
                snippet = js[max(0, pos - 180): min(len(js), pos + 360)]
                fetch_snippets.append((needle, " ".join(snippet.split())))
                start = pos + len(needle)
                hits += 1

        print(f"SuC-Tracker asset bytes {url}: {len(js)}")
        print(f"SuC-Tracker absolute URLs from {url}:", absolute_urls[:80])
        print(f"SuC-Tracker candidates from {url}:", sorted(candidates)[:160])
        print(f"SuC-Tracker snippets from {url}:", fetch_snippets[:80])

    try:
        dataset = json.loads(download_bytes(base.rstrip("/") + "/data/europe.json", max_bytes=30_000_000).decode("utf-8"))
        stations = dataset.get("stations", []) if isinstance(dataset, dict) else []
        print("SuC-Tracker dataset keys:", sorted(dataset.keys()) if isinstance(dataset, dict) else type(dataset).__name__)
        print("SuC-Tracker schema/count:", dataset.get("schemaVersion") if isinstance(dataset, dict) else None, len(stations))
        for station in stations:
            hay = " ".join(str(station.get(k, "")) for k in ("name", "city", "address", "id")).lower()
            if any(term in hay for term in ("kerpen", "frechen", "bonn", "erftstadt", "troisdorf")):
                slim = {
                    "id": station.get("id"),
                    "name": station.get("name"),
                    "city": station.get("city"),
                    "country": station.get("country"),
                    "latitude": station.get("latitude"),
                    "longitude": station.get("longitude"),
                    "pricing": station.get("pricing"),
                }
                print("SuC-Tracker sample station:", json.dumps(slim, ensure_ascii=False))
    except Exception as exc:
        print(f"SuC-Tracker dataset probe failed: {exc}")


def fetch_news():
    root = ET.fromstring(download_bytes(NEWS_URL, max_bytes=3_000_000))
    items = []

    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        pub_date = (item.findtext("pubDate") or "").strip()

        if not title or not link:
            continue

        published_at = None
        if pub_date:
            try:
                dt = parsedate_to_datetime(pub_date)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=TIMEZONE)
                published_at = dt.astimezone(TIMEZONE).isoformat(timespec="seconds")
            except (TypeError, ValueError, OverflowError):
                pass

        items.append(
            {
                "title": title,
                "url": link,
                "published_at": published_at,
            }
        )

        if len(items) >= 8:
            break

    return items


def build_data(old, now):
    old_checked = timestamp(old.get("checked_at"))
    if (
        old_checked
        and old.get("data_version") == DATA_VERSION
        and now - old_checked < REFRESH_AFTER
        and old.get("superchargers")
        and old.get("news")
    ):
        print("Tesla dashboard cache is fresh")
        return None

    data = {
        "data_version": DATA_VERSION,
        "checked_at": now.isoformat(timespec="seconds"),
        "origin": AVEX,
        "supercharger_source": {
            "name": "Niek/tesla-superchargers",
            "url": "https://github.com/Niek/tesla-superchargers",
            "note": "Unofficial daily Tesla-app pricing dataset",
        },
        "news_source": {
            "name": "Not a Tesla App",
            "url": "https://www.notateslaapp.com/",
        },
        "superchargers": old.get("superchargers", []),
        "news": old.get("news", []),
        "errors": {},
    }

    try:
        data["superchargers"] = fetch_superchargers(now)
        data["superchargers_updated_at"] = now.isoformat(timespec="seconds")
    except Exception as exc:
        data["errors"]["superchargers"] = str(exc)
        data["superchargers_updated_at"] = old.get("superchargers_updated_at")

    try:
        data["news"] = fetch_news()
        data["news_updated_at"] = now.isoformat(timespec="seconds")
    except Exception as exc:
        data["errors"]["news"] = str(exc)
        data["news_updated_at"] = old.get("news_updated_at")

    return data


def main():
    probe_suc_tracker()
    now = datetime.now(TIMEZONE)
    old = load_json(OUTPUT, {})
    data = build_data(old, now)

    if data is None:
        return 0

    tmp = OUTPUT.with_suffix(".tmp")
    tmp.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp.replace(OUTPUT)

    print(
        json.dumps(
            {
                "checked_at": data["checked_at"],
                "superchargers": len(data.get("superchargers", [])),
                "news": len(data.get("news", [])),
                "errors": data.get("errors", {}),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
