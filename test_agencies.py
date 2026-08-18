import urllib.request
import json

for agency in ['fii_only', '18', '17']:
    url = f'http://127.0.0.1:8000/api/noticias?agencia={agency}&periodo=mes'
    try:
        res = urllib.request.urlopen(url, timeout=25).read().decode('utf-8')
        data = json.loads(res)
        print(f"Agency [{agency}] count: {data.get('total')}")
        if data.get('items'):
            print(f"  Sample: {data.get('items')[0]['headline']}")
    except Exception as e:
        print(f"Error on [{agency}]: {e}")
