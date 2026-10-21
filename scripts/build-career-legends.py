"""Regenerate src/lib/career/legends-data.json (Manager Mode Legend Vault) from the player database."""
import json
lg = json.load(open('data/legends.json'))
h = json.load(open('data/historic-players.json'))
best = {}
for r in lg + [x for x in h if x.get('category') == 'legend']:
    if r.get('availableInGame') is False:
        continue
    pk = r.get('peakRating') or 90
    if r['name'] in best and (best[r['name']]['peakRating']) >= pk:
        continue
    best[r['name']] = {'name': r['name'], 'peakRating': pk, 'position': r.get('position'),
                       'club': r.get('club', ''), 'nationality': r.get('nationality', 'England')}
out = sorted(best.values(), key=lambda x: (-x['peakRating'], x['name']))
json.dump(out, open('src/lib/career/legends-data.json', 'w'), indent=1, ensure_ascii=False)
print(len(out), 'legends')
