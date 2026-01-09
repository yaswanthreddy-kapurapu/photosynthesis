/* Auto-tune runner (Node)
   Runs a broader randomized search using the CCM model (from js/ccm.js) and writes the top-3 configs
   to configs/best_particle_configs.json for use in the app.

   Usage: node scripts/auto_tune_runner.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ccmPath = path.join(__dirname, '..', 'js', 'ccm.js');
const outPath = path.join(__dirname, '..', 'configs');
if(!fs.existsSync(outPath)) fs.mkdirSync(outPath);
const outFile = path.join(outPath, 'best_particle_configs.json');

const code = fs.readFileSync(ccmPath, 'utf8');
// append a module export to get the CCM object from the evaluated code
const wrapped = `${code}\n;typeof CCM !== 'undefined' ? global.CCM = CCM : null;`;
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(wrapped, sandbox);
const CCM = sandbox.CCM;
if(!CCM) { console.error('Failed to load CCM from js/ccm.js'); process.exit(1); }

// randomized search
function runSearch(trials=5000){
  const ranges = { ap:[0.4,2.0], ps:[0.4,1.6], sa:[0.4,1.4], dur:[0.6,1.6] };
  const scenarioKeys = ['pre','present','high','recover'];
  const presets = {
    pre: {co2:280, temp:14, light:70, storms:false, pollution:false},
    present: {co2:420, temp:25, light:80, storms:false, pollution:false},
    high: {co2:950, temp:36, light:95, storms:true, pollution:true},
    recover: {co2:360, temp:22, light:85, storms:false, pollution:false}
  };

  function sample(){ const s=(a,b)=> a + Math.random()*(b-a); return {apScale: Number(s(...ranges.ap).toFixed(3)), psScale: Number(s(...ranges.ps).toFixed(3)), saScale: Number(s(...ranges.sa).toFixed(3)), durationScale: Number(s(...ranges.dur).toFixed(3))}; }

  function scoreConfig(cfg){
    const rates = [];
    for(const k of scenarioKeys){
      const sc = presets[k];
      const prate = CCM.photosynthesisRate(sc);
      const cf = CCM.carbonFlow(prate, 50);
      const pAP = Math.min(1, (cf.absorbed/22) * cfg.apScale);
      const pPS = Math.min(1, (cf.emitted/28) * cfg.psScale);
      const pSA = Math.min(1, (cf.emitted/55) * cfg.saScale);
      rates.push(pAP + pPS + pSA);
    }
    const mean = rates.reduce((a,b)=>a+b,0)/rates.length;
    const variance = rates.reduce((a,b)=>a+Math.pow(b-mean,2),0)/rates.length;
    const sd = Math.sqrt(variance);
    const meanPenalty = Math.abs(mean - 0.85);
    const saturationPenalty = Math.max(0, mean - 1.25);
    return sd - meanPenalty - saturationPenalty*1.5;
  }

  const scored = [];
  for(let i=0;i<trials;i++){
    const cfg = sample(); const s = scoreConfig(cfg);
    scored.push({cfg, score:s});
  }
  scored.sort((a,b)=>b.score - a.score);
  return scored.slice(0,3);
}

console.log('Running auto-tune search (this may take a few seconds)...');
const top3 = runSearch(8000);
fs.writeFileSync(outFile, JSON.stringify({generatedAt: new Date().toISOString(), top3}, null, 2));
console.log(`Wrote top-3 configurations to ${outFile}`);
console.log('Top 3 summary:'); top3.forEach((t,i)=> console.log(`${i+1}: score=${t.score.toFixed(3)} cfg=${JSON.stringify(t.cfg)}`));
