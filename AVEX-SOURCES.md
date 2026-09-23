# AVEX Euskirchen data sources

## Official terminal tariff (primary)

The operator's location page at
https://www.avex-tankstellen.de/standorte/53881-euskirchen.html
embeds https://e-preis.avex-tankstellen.de under “Aktuelle E-Ladepreise”.
That display explicitly describes **Direktzahlung am EC Terminal**, not roaming.
Its `const DATA` JSON contains DC price intervals with UTC `valid_from` and
`valid_to`, plus the Europe/Berlin timezone. No login, key or JavaScript
execution is needed. Checked against the live page on 23 September 2026.

The scraper accepts exactly one currently valid interval, using start-inclusive,
end-exclusive boundaries. Invalid, overlapping or expired schedules are rejected.
The last downloaded schedule remains usable during an outage only within its
published intervals. The website also selects intervals locally every second,
so GitHub scheduling delays do not delay known price transitions. This is a
published schedule, not a guarantee against subsequent operator revisions.

## Comparison sources and occupancy

- e-Stations: https://www.e-stations.de/ladestationen/euskirchen/avex-euskirchen-108
- adhocladen: https://adhocladen.de/euskirchen/avex-mineraloelhandelsgesellschaft/

Both are fetched independently with bounded timeouts. Parsers validate the eight
Euskirchen EVSE IDs (DE*AVX*E262414/415/426/427/430/431/451/452). The old
page-wide “most frequent price” heuristic is removed. e-Stations prices must
agree across all eight points; nearby stations and script contents are excluded.

Portal observations can be delayed and need not describe exactly the same payment
method. Their fetch time, page publication time and EVSE status-change time do
**not** establish when a tariff became effective. Therefore “last downloaded
wins” or “last observed change wins” would silently roll back official prices.
A valid official interval always wins; disagreements are exposed in `sources`
and `price_conflict`. If the official schedule expires, the last known price is
marked unconfirmed. Only on an empty installation can a portal supply an initial,
explicitly unconfirmed value. Unconfirmed prices do not enter price history.

Occupancy is independent of price. A successful HTML download alone is not live
status evidence. The feed publication must be no older than 30 minutes; otherwise
the counts are displayed as not currently confirmed. Unknown is distinct from
offline. e-Stations is preferred; adhocladen can supply unconfirmed counts when
needed. HTTP failures are recorded, not bypassed.

## Operations

`python update_avex.py` writes backward-compatible `avex-data.json` and
`avex-history.json`, plus validity, source, quality and diagnostic fields.
`price_fresh` means a valid official interval is available, including a cached
schedule; `price_quality` distinguishes `official`, `cached_schedule`, `stale`
and `unconfirmed`. `price_checked_at` is the last successful official fetch;
`checked_at` is the attempted run. Neither is the source's tariff-change time.

The GitHub workflow requests runs every five minutes (actual starts can be
late). A missing valid official price gives a nonzero exit code, allowing retries
and a failed workflow signal. The final commit step still publishes stale flags.
The website independently expires the schedule and status even if jobs stop.
History retains observed price changes, not future schedule entries or inferred
backdated prices. Existing history is retained, so old portal-based history may
still be inaccurate until it leaves the 24-hour window.

Run regression tests with:

    python -m unittest discover -s tests -p test_avex.py

This remains in the existing live repository to preserve URLs and the active
workflow. A separate `avex-price-scraper` repository was not accessible at the
time of this change; no repository migration is performed here.
