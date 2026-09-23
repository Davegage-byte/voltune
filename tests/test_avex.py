import json
import unittest
from datetime import datetime, timedelta
from update_avex import (TIMEZONE, EVSES, build_data, current_entry, parse_schedule,
                         parse_estations, parse_adhoc, update_history)

NOW = datetime(2026, 9, 23, 10, tzinfo=TIMEZONE)

def interval(start=NOW, price=.42):
    return {'valid_from': start.isoformat(), 'valid_to': (start+timedelta(hours=1)).isoformat(), 'price': price}

def sources(schedule=None):
    return {'avex': {'ok': schedule is not None, 'data': schedule},
            'e-stations': {'ok': False}, 'adhocladen': {'ok': False}}

class AvexTests(unittest.TestCase):
    def test_interval_boundary(self):
        schedule = [interval(NOW-timedelta(hours=1), .59), interval()]
        self.assertEqual(current_entry(schedule, NOW)['price'], .42)
        self.assertIsNone(current_entry(schedule, NOW+timedelta(hours=1)))

    def test_schedule_validation(self):
        def page(entries):
            return 'const DATA = '+json.dumps({'product': 'DC', 'timezone': 'Europe/Berlin', 'days': [{'prices': entries}]})+'; evil();'
        self.assertEqual(parse_schedule(page([interval()]))[0]['price'], .42)
        for entries in ([interval(), interval()], [interval(price=float('nan'))], [interval(price=True)]):
            with self.assertRaises(ValueError): parse_schedule(page(entries))

    def test_official_wins_portal_conflict(self):
        src = sources([interval()])
        src['e-stations'] = {'ok': True, 'data': {'price': .56}}
        data = build_data({}, src, NOW)
        self.assertEqual(data['price'], '0,42')
        self.assertTrue(data['price_conflict'])

    def test_cached_schedule_only_within_validity(self):
        old = {'price': '0,42', 'price_schedule': [interval()], 'price_source': 'avex', 'price_checked_at': 'previous'}
        data = build_data(old, sources(), NOW)
        self.assertTrue(data['price_fresh'])
        self.assertEqual(data['price_checked_at'], 'previous')
        expired = build_data(old, sources(), NOW+timedelta(hours=1))
        self.assertFalse(expired['price_fresh'])
        self.assertEqual(expired['price_quality'], 'stale')

    def test_portal_is_unconfirmed_and_does_not_replace_previous(self):
        src = sources()
        src['e-stations'] = {'ok': True, 'data': {'price': .56}}
        self.assertEqual(build_data({'price': '0,42'}, src, NOW)['price'], '0,42')
        data = build_data({}, src, NOW)
        self.assertEqual(data['price_quality'], 'unconfirmed')
        self.assertFalse(data['price_fresh'])

    def test_estations_exact_station_and_uniform_tariff(self):
        blocks = ''.join(f'<div>EVSE-ID: {evse} Verfügbar Stand 23.09.26, 08:00 Uhr Ad-Hoc-Tarif HPC 0,42 € /kWh</div>' for evse in sorted(EVSES))
        html = blocks+'<div>Stand: 23.09.2026, 10:00 Uhr</div><script>0,01 €/kWh</script>'
        result = parse_estations(html)
        self.assertEqual(result['price'], .42)
        self.assertEqual(result['free'], 8)
        with self.assertRaises(ValueError): parse_estations(html.replace('DE*AVX*E262414', 'DE*OTHER*123'))
        self.assertIsNone(parse_estations(html.replace('0,42', '0,55', 1))['price'])

    def test_stale_status_not_live(self):
        src = sources([interval()])
        src['e-stations'] = {'ok': True, 'data': {'free': 8, 'occupied': 0, 'offline': 0, 'published_at': (NOW-timedelta(hours=2)).isoformat()}}
        self.assertFalse(build_data({}, src, NOW)['status_fresh'])
        src['e-stations']['data']['published_at'] = NOW.isoformat()
        self.assertTrue(build_data({}, src, NOW)['status_fresh'])

    def test_no_page_wide_price_guess(self):
        with self.assertRaises(ValueError): parse_adhoc(' '.join(EVSES)+' recommended nearby 0,19 €/kWh')

    def test_history_no_stale_or_future_points(self):
        history = [{'time': (NOW-timedelta(days=2)).isoformat(), 'price': .55},
                   {'time': (NOW+timedelta(hours=1)).isoformat(), 'price': .99}]
        data = {'price_fresh': False}
        self.assertEqual(len(update_history(history, data, NOW)), 1)
        data.update(price_fresh=True, price='0,42', price_source='avex')
        result = update_history(history, data, NOW)
        self.assertEqual(len(result), 2)
        self.assertEqual(len(update_history(result, data, NOW)), 2)

if __name__ == '__main__': unittest.main()
