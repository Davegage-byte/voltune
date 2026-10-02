"""Build compact Tesla dashboard data for the AVEX/Tesla start page."""

import json
import math
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path
from zoneinfo import ZoneInfo

TIMEZONE = ZoneInfo("Europe/Berlin")
OUTPUT = Path("tesla-dashboard-data.json")
SUPERCHARGERS_URL = "https://raw.githubusercontent.com/Niek/tesla-superchargers/main/superchargers-with-pricing.json"
SUC_TRACKER_URL = "https://suc-tracker.eu/data/europe.json"
SUC_TRACKER_PAGE = "https://suc-tracker.eu/"
NEWS_URL = "https://www.notateslaapp.com/rss"
TESLAMAG_RSS_URL = "https://teslamag.de/feed"
AVEX = {"name": "AVEX Euskirchen", "latitude": 50.686726020023045, "longitude": 6.838122769536388}
REFRESH_AFTER = timedelta(minutes=30)
SUC_TRACKER_REFRESH_AFTER = timedelta(hours=2)
EUROPE_BOUNDS = {"min_lat": 34.0, "max_lat": 72.0, "min_lon": -12.0, "max_lon": 32.0}
MAX_SUPERCHARGERS = 2500
DATA_VERSION = 9
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Voltune-Tesla-Dashboard/1.3"


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


def normalize_site_name(value):
    value = unescape(str(value or "")).lower().strip()
    value = re.sub(r"\s+", " ", value)
    return value


def normalize_suc_pricing(block):
    if not isinstance(block, dict):
        return None
    if block.get("pricingStatus") != "available":
        return None

    unit = block.get("pricingUnit") or "kwh"
    raw_prices = block.get("prices")
    if unit != "kwh" or not isinstance(raw_prices, list):
        return None

    windows = []
    for item in raw_prices:
        if not isinstance(item, dict):
            continue
        try:
            days = int(item.get("days", 127))
            start = int(item["start"])
            end = int(item["end"])
            raw_price = float(item["price"])
        except (KeyError, TypeError, ValueError):
            continue

        if not (0 <= start <= 1440 and 0 <= end <= 1440 and end > start):
            continue

        rate = raw_price / 1_000_000.0
        if not math.isfinite(rate) or not (0 <= rate <= 5):
            continue

        windows.append(
            {
                "days": days,
                "start": start,
                "end": end,
                "rate": round(rate, 4),
            }
        )

    if not windows:
        return None

    windows.sort(key=lambda item: (item["start"], item["end"], item["rate"]))
    return {
        "currency": block.get("currency") or "EUR",
        "unit": "kwh",
        "status": "available",
        "windows": windows,
        "price_changed_at": block.get("priceChangedAt"),
    }


def fetch_suc_tracker_dataset(now):
    payload = json.loads(download_bytes(SUC_TRACKER_URL, max_bytes=30_000_000).decode("utf-8"))
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 2:
        raise ValueError("Unsupported SuC-Tracker dataset schema")

    stations = payload.get("stations")
    if not isinstance(stations, list):
        raise ValueError("SuC-Tracker stations missing")

    pricing_by_name = {}
    for station in stations:
        if not isinstance(station, dict):
            continue

        pricing = station.get("pricing")
        tesla = pricing.get("tesla") if isinstance(pricing, dict) else None
        normalized = normalize_suc_pricing(tesla)
        name = station.get("name")
        key = normalize_site_name(name)

        if key and normalized:
            pricing_by_name[key] = {
                "suc_tracker_id": station.get("id"),
                "pricing": normalized,
            }

    meta = {
        "name": "SuC Tracker",
        "page_url": SUC_TRACKER_PAGE,
        "dataset_url": SUC_TRACKER_URL,
        "schema_version": payload.get("schemaVersion"),
        "generated_at": payload.get("generatedAt"),
        "checked_at": now.isoformat(timespec="seconds"),
        "station_count": len(stations),
    }
    return meta, pricing_by_name


def merge_suc_pricing(superchargers, pricing_by_name):
    matched = 0
    for site in superchargers:
        match = pricing_by_name.get(normalize_site_name(site.get("name")))
        if not match:
            continue
        site["suc_tracker_id"] = match.get("suc_tracker_id")
        site["suc_pricing"] = match.get("pricing")
        matched += 1
    return matched


def copy_cached_suc_pricing(superchargers, old_superchargers):
    old_by_id = {
        item.get("id"): item
        for item in old_superchargers
        if isinstance(item, dict) and item.get("id")
    }
    matched = 0
    for site in superchargers:
        old_site = old_by_id.get(site.get("id"))
        if not old_site:
            continue
        if old_site.get("suc_pricing"):
            site["suc_pricing"] = old_site.get("suc_pricing")
            site["suc_tracker_id"] = old_site.get("suc_tracker_id")
            matched += 1
    return matched


def fetch_superchargers():
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

        distance = haversine_km(AVEX["latitude"], AVEX["longitude"], lat, lon)
        prices = site.get("prices") or {}

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
                "member_price": normalize_rates(prices.get("member")),
                "other_price": normalize_rates(prices.get("user")),
            }
        )

    nearby.sort(key=lambda item: item["distance_km"])
    return nearby[:MAX_SUPERCHARGERS]



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


def fetch_regional_news():
    root = ET.fromstring(download_bytes(TESLAMAG_RSS_URL, max_bytes=3_000_000))
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
                "title": unescape(title),
                "url": link,
                "published_at": published_at,
                "source": "TeslaMag.de",
            }
        )
        if len(items) >= 12:
            break

    if not items:
        raise ValueError("no TeslaMag RSS items found")

    return items


def build_data(old, now):
    old_checked = timestamp(old.get("checked_at"))
    if (
        old_checked
        and old.get("data_version") == DATA_VERSION
        and now - old_checked < REFRESH_AFTER
        and old.get("superchargers")
        and old.get("news")
        and old.get("regional_news")
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
            "note": "Location and site metadata",
        },
        "suc_tracker_source": old.get("suc_tracker_source", {}),
        "news_source": {
            "name": "Not a Tesla App",
            "url": "https://www.notateslaapp.com/",
        },
        "regional_news_source": {
            "name": "TeslaMag.de",
            "url": "https://teslamag.de/",
            "rss_url": TESLAMAG_RSS_URL,
        },
        "superchargers": old.get("superchargers", []),
        "news": old.get("news", []),
        "regional_news": old.get("regional_news", []),
        "errors": {},
    }

    try:
        data["superchargers"] = fetch_superchargers()
        data["superchargers_updated_at"] = now.isoformat(timespec="seconds")
    except Exception as exc:
        data["errors"]["superchargers"] = str(exc)
        data["superchargers_updated_at"] = old.get("superchargers_updated_at")

    suc_checked = timestamp((old.get("suc_tracker_source") or {}).get("checked_at"))
    should_refresh_suc = not suc_checked or now - suc_checked >= SUC_TRACKER_REFRESH_AFTER

    if data.get("superchargers"):
        if should_refresh_suc:
            try:
                meta, pricing_by_name = fetch_suc_tracker_dataset(now)
                matched = merge_suc_pricing(data["superchargers"], pricing_by_name)
                meta["matched_stations"] = matched
                data["suc_tracker_source"] = meta
                print(f"SuC-Tracker pricing matched {matched}/{len(data['superchargers'])} dashboard sites")
            except Exception as exc:
                data["errors"]["suc_tracker"] = str(exc)
                matched = copy_cached_suc_pricing(
                    data["superchargers"], old.get("superchargers", [])
                )
                print(f"SuC-Tracker refresh failed; reused {matched} cached station prices")
        else:
            matched = copy_cached_suc_pricing(
                data["superchargers"], old.get("superchargers", [])
            )
            print(f"SuC-Tracker cache reused for {matched} station prices")

    try:
        data["news"] = fetch_news()
        data["news_updated_at"] = now.isoformat(timespec="seconds")
    except Exception as exc:
        data["errors"]["news"] = str(exc)
        data["news_updated_at"] = old.get("news_updated_at")

    try:
        data["regional_news"] = fetch_regional_news()
        data["regional_news_updated_at"] = now.isoformat(timespec="seconds")
    except Exception as exc:
        data["errors"]["regional_news"] = str(exc)
        data["regional_news"] = old.get("regional_news", [])
        data["regional_news_updated_at"] = old.get("regional_news_updated_at")

    return data


def probe_wdr_fuel_data():
    urls = [
        "https://datawrapper.dwcdn.net/dkS5c/dataset.csv",
        "https://datawrapper.dwcdn.net/dkS5c/8/dataset.csv",
        "https://datawrapper.dwcdn.net/dkS5c/8/",
    ]
    for url in urls:
        try:
            raw = download_bytes(url, max_bytes=2_000_000)
            sample = raw[:2500].decode("utf-8", errors="replace")
            print("WDR fuel probe", url, "bytes", len(raw), "sample", repr(sample))
        except Exception as exc:
            print("WDR fuel probe failed", url, repr(exc))


def main():
    probe_wdr_fuel_data()
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

    source = data.get("suc_tracker_source") or {}
    print(
        json.dumps(
            {
                "checked_at": data["checked_at"],
                "superchargers": len(data.get("superchargers", [])),
                "suc_prices_matched": source.get("matched_stations"),
                "suc_prices_generated_at": source.get("generated_at"),
                "news": len(data.get("news", [])),
                "regional_news": len(data.get("regional_news", [])),
                "errors": data.get("errors", {}),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
