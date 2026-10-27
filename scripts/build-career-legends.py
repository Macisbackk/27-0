"""Regenerate src/lib/career/legends-data.json (Manager Mode Legend Vault) from the player database."""
import json
lg = json.load(open('data/legends.json'))
h = json.load(open('data/historic-players.json'))
best = {}
# Great tier (one below Legend, owner v1.37) joins the vault too.
for r in lg + [x for x in h if x.get('category') == 'legend' or x.get('great') is True]:
    if r.get('availableInGame') is False:
        continue
    pk = r.get('peakRating') or 90
    if r['name'] in best and (best[r['name']]['peakRating']) >= pk:
        continue
    best[r['name']] = {'name': r['name'], 'peakRating': pk, 'position': r.get('position'),
                       'club': r.get('club', ''), 'nationality': r.get('nationality', 'England'),
                       **({'tier': 'great'} if r.get('great') is True else {})}
out = sorted(best.values(), key=lambda x: (-x['peakRating'], x['name']))
json.dump(out, open('src/lib/career/legends-data.json', 'w'), indent=1, ensure_ascii=False)
print(len(out), 'legends')
