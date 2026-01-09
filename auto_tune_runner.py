import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'configs' / 'best_particle_configs.json'

# Reimplement the same functions as CCM

def clamp(x,a,b):
    return max(a, min(b, x))

def tempFactor(temp):
    opt = 25.0; sigma = 10.0
    f = math.exp(-((temp - opt)**2)/(2*sigma*sigma))
    return clamp(f, 0.0, 1.0)

def co2Factor(co2):
    km = 600.0
    return clamp(co2 / (co2 + km), 0.0, 1.0)

def lightFactor(lightPercent):
    return clamp(lightPercent/100.0, 0.0, 1.2)

def photosynthesisRate(params):
    co2 = params['co2']; temp = params['temp']; light = params['light']; stressEvents = params.get('stressEvents',0); pollution = params.get('pollution',False)
    base = 1.0
    t = tempFactor(temp)
    c = co2Factor(co2)
    l = lightFactor(light)
    rate = base * t * c * l
    rate *= (0.85 ** stressEvents)
    if pollution:
        rate *= 0.7
    return clamp(rate, 0.0, 2.0)

def carbonFlow(pRate, biomass):
    absorbed = pRate * biomass * 0.9
    emitted = biomass * 0.05
    return {'absorbed': absorbed, 'emitted': emitted}

# presets
PRESETS = {
    'pre': {'co2':280, 'temp':14, 'light':70, 'storms':False, 'pollution':False},
    'present': {'co2':420, 'temp':25, 'light':80, 'storms':False, 'pollution':False},
    'high': {'co2':950, 'temp':36, 'light':95, 'storms':True, 'pollution':True},
    'recover': {'co2':360, 'temp':22, 'light':85, 'storms':False, 'pollution':False}
}

# scoring similar to JS

def score_config(cfg):
    scenarioKeys = ['pre','present','high','recover']
    rates = []
    for k in scenarioKeys:
        sc = PRESETS[k]
        prate = photosynthesisRate(sc)
        cf = carbonFlow(prate, 50)
        pAP = min(1.0, (cf['absorbed']/22.0) * cfg['apScale'])
        pPS = min(1.0, (cf['emitted']/28.0) * cfg['psScale'])
        pSA = min(1.0, (cf['emitted']/55.0) * cfg['saScale'])
        rates.append(pAP + pPS + pSA)
    mean = sum(rates)/len(rates)
    sd = (sum((r-mean)**2 for r in rates)/len(rates))**0.5
    meanPenalty = abs(mean - 0.85)
    saturationPenalty = max(0.0, mean - 1.25)
    return sd - meanPenalty - saturationPenalty*1.5


def run_search(trials=15000):
    ranges = {'ap':(0.4,2.0),'ps':(0.4,1.6),'sa':(0.4,1.4),'dur':(0.6,1.6)}
    results = []
    for i in range(trials):
        cfg = {
            'apScale': round(random.uniform(*ranges['ap']), 3),
            'psScale': round(random.uniform(*ranges['ps']), 3),
            'saScale': round(random.uniform(*ranges['sa']), 3),
            'durationScale': round(random.uniform(*ranges['dur']), 3)
        }
        s = score_config(cfg)
        results.append({'cfg': cfg, 'score': s})
    results.sort(key=lambda x: x['score'], reverse=True)
    return results[:3]

if __name__ == '__main__':
    print('Running broader auto-tune search (this may take a few seconds)...')
    top3 = run_search(8000)
    payload = {'generatedAt': None, 'top3': top3}
    payload['generatedAt'] = __import__('datetime').datetime.utcnow().isoformat() + 'Z'
    with OUT.open('w', encoding='utf8') as f:
        json.dump(payload, f, indent=2)
    print(f'Wrote top-3 configs to {OUT}')
    for i,t in enumerate(top3, start=1):
        print(f"{i}: score={t['score']:.4f} cfg={t['cfg']}")
