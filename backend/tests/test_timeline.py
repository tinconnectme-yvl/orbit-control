import urllib.request
import json

def test_timeline_endpoint():
    req = urllib.request.Request(
        'http://127.0.0.1:8010/api/session/create',
        data=json.dumps({
            'scenario_id': 'P01_intro',
            'goal': 'priority',
            'algorithm': 'vector_smart'
        }).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        s = json.loads(resp.read().decode())
    sid = s['session_id']
    
    with urllib.request.urlopen(f'http://127.0.0.1:8010/api/session/{sid}/timeline') as resp:
        tl = json.loads(resp.read().decode())
        
    assert 'steps' in tl
    assert len(tl['steps']) == 49 # step 0 through step 48
    assert tl['steps'][-1]['summary']['revenue_usd'] > 0
    print(f"Timeline success! Steps: {len(tl['steps'])}, Final revenue: {tl['steps'][-1]['summary']['revenue_usd']}")

if __name__ == '__main__':
    test_timeline_endpoint()
