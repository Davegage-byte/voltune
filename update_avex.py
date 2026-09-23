"""AVEX Euskirchen: official EC-terminal schedule, independent source diagnostics."""
import json
import math
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

TIMEZONE = ZoneInfo('Europe/Berlin')
SCRAPER_VERSION = '2026-09-23-v5'
URLS = {
    'avex': 'https://e-preis.avex-tankstellen.de',
    'e-stations': 'https://www.e-stations.de/ladestationen/euskirchen/avex-euskirchen-108',
    'adhocladen': 'https://adhocladen.de/euskirchen/avex-mineraloelhandelsgesellschaft/',
}
EVSES = {f'DE*AVX*E262{x}' for x in ('414', '415', '426', '427', '430', '431', '451', '452')}


def timestamp(value):
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if dt.tzinfo is None:
        raise ValueError('Timezone missing')
    return dt


def valid_price(value):
    if isinstance(value, bool):
        raise ValueError('Boolean price')
    value = float(str(value).replace(',', '.'))
    if not math.isfinite(value) or not 0.05 <= value <= 3:
        raise ValueError('Implausible price')
    return value


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def html_to_text(html):
    parser = TextExtractor()
    parser.feed(html)
    return ' '.join(' '.join(parser.parts).split())


def parse_schedule(html):
    match = re.search(r'\bconst\s+DATA\s*=\s*', html)
    if not match:
        raise ValueError('Official DATA object missing')
    data, _ = json.JSONDecoder().raw_decode(html[match.end():])
    if data.get('product') != 'DC' or data.get('timezone') != 'Europe/Berlin':
        raise ValueError('Unexpected product/timezone')
    intervals = []
    for day in data['days']:
        for entry in day['prices']:
            start, end = timestamp(entry['valid_from']), timestamp(entry['valid_to'])
            if start >= end or end - start > timedelta(days=1, hours=1):
                raise ValueError('Invalid price interval')
            intervals.append({'valid_from': start.isoformat(), 'valid_to': end.isoformat(),
                              'price': valid_price(entry['price'])})
    intervals.sort(key=lambda x: timestamp(x['valid_from']))
    if any(timestamp(a['valid_to']) > timestamp(b['valid_from']) for a, b in zip(intervals, intervals[1:])):
        raise ValueError('Overlapping price intervals')
    if not intervals:
        raise ValueError('Empty schedule')
    return intervals


def current_entry(schedule, now):
    matches = [x for x in schedule if timestamp(x['valid_from']) <= now < timestamp(x['valid_to'])]
    return matches[0] if len(matches) == 1 else None


def parse_estations(html):
    text = html_to_text(html)
    blocks = re.split(r'EVSE-ID:\s*', text)[1:]
    points, prices = {}, []
    states = {'Verfügbar': 'free', 'Lädt': 'occupied', 'Belegt': 'occupied',
              'Reserviert': 'occupied', 'Blockiert': 'occupied', 'Außer Dienst': 'offline',
              'Außer Betrieb': 'offline', 'Unbekannt': 'unknown'}
    for block in blocks:
        match = re.match(r'(DE\*AVX\*E\d+)\s+(.+?)\s+Stand\s', block)
        if not match or match[1] not in EVSES:
            continue
        if match[1] in points or match[2] not in states:
            raise ValueError('Duplicate EVSE or unsupported status')
        points[match[1]] = states[match[2]]
        price = re.search(r'Ad-Hoc-Tarif\s+HPC\s+(\d+[,.]\d+)\s*€\s*/kWh', block)
        if price:
            prices.append(valid_price(price[1]))
    if set(points) != EVSES:
        raise ValueError('Expected exactly the eight Euskirchen EVSEs')
    publication = re.search(r'Stand:\s*(\d{2}\.\d{2}\.\d{4},\s*\d{2}:\d{2})\s*Uhr', text)
    observed = datetime.strptime(publication[1], '%d.%m.%Y, %H:%M').replace(tzinfo=TIMEZONE) if publication else None
    result = {key: list(points.values()).count(key) for key in ('free', 'occupied', 'offline', 'unknown')}
    result.update(price=prices[0] if len(prices) == 8 and len(set(prices)) == 1 else None,
                  published_at=observed.isoformat() if observed else None)
    return result


def parse_adhoc(html):
    text = html_to_text(html)
    if not EVSES.issubset(set(re.findall(r'DE\*AVX\*E\d+', text))):
        raise ValueError('Euskirchen EVSE identity missing')
    match = re.search(r'Günstigster\s+Ad[- ]hoc[- ]Preis\s+(\d+[,.]\d+)\s*€\s*/\s*kWh', text, re.I)
    if not match:
        raise ValueError('Station price label missing; refusing page-wide price guessing')
    result = {'price': valid_price(match[1]), 'published_at': None}
    for key, label in [('free', 'frei'), ('occupied', 'belegt'), ('offline', 'offline')]:
        match = re.search(r'<strong[^>]*>\s*(\d+)\s*</strong>\s*<span[^>]*>\s*'+label, html, re.I)
        if match:
            result[key] = int(match[1])
    return result


def download(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'AVEX-Price-Monitor/5.0', 'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read(2_000_000).decode('utf-8')


def fetch_source(name):
    try:
        html = download(URLS[name])
        parser = {'avex': parse_schedule, 'e-stations': parse_estations, 'adhocladen': parse_adhoc}[name]
        return name, {'ok': True, 'url': URLS[name], 'data': parser(html)}
    except Exception as exc:
        return name, {'ok': False, 'url': URLS[name], 'error': str(exc)}


def load_json(path, default):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except (FileNotFoundError, ValueError):
        return default


def build_data(old, sources, now):
    iso = now.isoformat(timespec='seconds')
    official = sources['avex']
    schedule = official['data'] if official['ok'] else old.get('price_schedule', [])
    try:
        entry = current_entry(schedule, now)
    except (KeyError, TypeError, ValueError):
        schedule, entry = [], None
    data = {key: old.get(key) for key in ('price', 'free', 'occupied', 'offline', 'unknown',
            'price_source', 'status_source', 'price_checked_at', 'status_checked_at', 'price_changed_at')}
    data.update(updated=now.strftime('%H:%M'), checked_at=iso, scraper_version=SCRAPER_VERSION,
                price_fresh=False, status_fresh=False, price_valid_from=None, price_valid_to=None,
                price_schedule=schedule, price_conflict=False, price_quality='stale', sources=sources)
    if entry:
        data.update(price=f"{entry['price']:.2f}".replace('.', ','), price_source='avex',
                    price_fresh=True, price_quality='official' if official['ok'] else 'cached_schedule',
                    price_valid_from=entry['valid_from'], price_valid_to=entry['valid_to'])
        if official['ok']:
            data['price_checked_at'] = iso
    # Aggregator timestamps are NOT tariff effective times. Do not let a freshly
    # fetched, delayed portal overwrite a valid official terminal interval.
    secondary = [(name, src['data']) for name, src in sources.items()
                 if name != 'avex' and src['ok']]
    if not entry and data['price'] in (None, '?'):
        candidates = [s for s in secondary if s[1].get('price') is not None]
        if candidates:
            name, candidate = candidates[0]
            data.update(price=f"{candidate['price']:.2f}".replace('.', ','), price_source=name,
                        price_quality='unconfirmed', price_checked_at=iso)
    data['price'] = data['price'] or '?'
    if entry:
        data['price_conflict'] = any(c.get('price') is not None and abs(c['price'] - entry['price']) > .0001
                                     for _, c in secondary)
        if data['price'] != old.get('price'):
            data['price_changed_at'] = iso
    status_selected = False
    for name, candidate in secondary:
        if all(isinstance(candidate.get(k), int) for k in ('free', 'occupied', 'offline')):
            counts = {k: candidate.get(k, 0) for k in ('free', 'occupied', 'offline', 'unknown')}
            if sum(counts.values()) != 8 or min(counts.values()) < 0:
                continue
            # A changed-at timestamp per EVSE is not proof of a current feed.
            publication = candidate.get('published_at')
            fresh = bool(publication and timedelta(0) <= now - timestamp(publication) <= timedelta(minutes=30))
            if fresh or not status_selected:
                data.update(counts, status_source=name, status_fresh=fresh, status_checked_at=iso,
                            status_published_at=publication)
                status_selected = True
            if fresh:
                break
    return data


def update_history(history, data, now):
    points = []
    for point in history:
        try:
            dt = timestamp(point['time'])
            valid_price(point['price'])
            if dt <= now:
                points.append(point)
        except (KeyError, ValueError, TypeError):
            pass
    points.sort(key=lambda x: timestamp(x['time']))
    if data['price_fresh']:
        value = valid_price(data['price'])
        if not points or float(points[-1]['price']) != value:
            points.append({'time': now.isoformat(timespec='seconds'), 'price': value, 'source': data['price_source']})
    cutoff = now - timedelta(hours=24)
    before = [p for p in points if timestamp(p['time']) < cutoff]
    return before[-1:] + [p for p in points if timestamp(p['time']) >= cutoff]


def main():
    old = load_json('avex-data.json', {})
    with ThreadPoolExecutor(max_workers=3) as pool:
        sources = dict(pool.map(fetch_source, URLS))
    now = datetime.now(TIMEZONE)
    data = build_data(old, sources, now)
    history = update_history(load_json('avex-history.json', []), data, now)
    for filename, value in [('avex-data.json', data), ('avex-history.json', history)]:
        path = Path(filename)
        tmp = path.with_suffix('.tmp')
        tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        tmp.replace(path)
    print(json.dumps({k: v for k, v in data.items() if k not in ('price_schedule', 'sources')}, ensure_ascii=False, indent=2))
    for name, source in sources.items():
        print(name, 'OK' if source['ok'] else source['error'])
    return 0 if data['price_fresh'] else 1


if __name__ == '__main__':
    sys.exit(main())
