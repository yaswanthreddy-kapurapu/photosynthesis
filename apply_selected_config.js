/*
Apply a selected top-N config (from configs/best_particle_configs.json) and write it to configs/active_particle_config.json
Usage:
  node scripts/apply_selected_config.js --index 1   # apply top-1
  node scripts/apply_selected_config.js --index 2   # apply top-2
  node scripts/apply_selected_config.js --list      # show top-3
*/
const fs = require('fs'); const path = require('path');
const argv = require('minimist')(process.argv.slice(2));
const repoRoot = path.resolve(__dirname, '..');
const bestFile = path.join(repoRoot, 'configs', 'best_particle_configs.json');
const outFile = path.join(repoRoot, 'configs', 'active_particle_config.json');
if(!fs.existsSync(bestFile)){ console.error('Missing', bestFile); process.exit(1); }
const best = JSON.parse(fs.readFileSync(bestFile, 'utf8'));
if(argv.list){ console.log('Top configs:'); (best.top3||[]).forEach((t,i)=> console.log(`${i+1}: score=${t.score} cfg=${JSON.stringify(t.cfg)}`)); process.exit(0); }
const idx = Number(argv.index || 1) - 1; if(idx < 0 || idx >= (best.top3||[]).length){ console.error('Invalid index. Use --list to see available configs.'); process.exit(1); }
const chosen = best.top3[idx].cfg; fs.writeFileSync(outFile, JSON.stringify(chosen, null, 2)); console.log(`Wrote selected config to ${outFile}`);