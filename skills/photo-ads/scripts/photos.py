#!/usr/bin/env python3
# Searches Unsplash and reports a chosen photo's use, as its API terms require. Never prints the key.
# usage: photos.py search "<words>" [count]   one JSON line per photo
#        photos.py use <photo id>             reports the use and prints the credit
import json, os, sys, urllib.parse, urllib.request

def key():
    if os.environ.get('UNSPLASH_ACCESS_KEY'):
        return os.environ['UNSPLASH_ACCESS_KEY']
    for path in filter(None, [os.environ.get('PHOTO_ADS_ENV'), '.env']):
        if os.path.exists(path):
            for line in open(path):
                if line.startswith('UNSPLASH_ACCESS_KEY='):
                    return line.split('=', 1)[1].strip()
    sys.exit('Stock search is off: no UNSPLASH_ACCESS_KEY found. Use the person\'s or the website\'s photos.')

def get(url):
    req = urllib.request.Request(url, headers={'Authorization': f'Client-ID {key()}', 'Accept-Version': 'v1'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)

api = 'https://api.unsplash.com'
if len(sys.argv) < 3 or sys.argv[1] not in ('search', 'use'):
    sys.exit('usage: photos.py search "<words>" [count] | photos.py use <photo id>')
if sys.argv[1] == 'search':
    count = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    query = urllib.parse.urlencode({'query': sys.argv[2], 'per_page': min(count, 30)})
    for p in get(f'{api}/search/photos?{query}')['results']:
        print(json.dumps({'id': p['id'], 'width': p['width'], 'height': p['height'], 'about': p.get('alt_description') or p.get('description'), 'photographer': p['user']['name'], 'url': p['urls']['raw'] + '&w=1600&q=85&auto=format', 'preview': p['urls']['small']}, ensure_ascii=False))
else:
    p = get(f'{api}/photos/{sys.argv[2]}')
    get(p['links']['download_location'])
    print(json.dumps({'id': p['id'], 'credit': f"Photo by {p['user']['name']} on Unsplash", 'page': p['links']['html']}, ensure_ascii=False))
