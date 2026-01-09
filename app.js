/* app.js — ties controls, model (CCM), plant renderer, and D3 visualizations together */

document.addEventListener('DOMContentLoaded', ()=>{
  // elements
  const co2 = document.getElementById('co2'); const co2Val = document.getElementById('co2Val');
  const temp = document.getElementById('temp'); const tempVal = document.getElementById('tempVal');
  const light = document.getElementById('light'); const lightVal = document.getElementById('lightVal');
  const storms = document.getElementById('storms'); const pollution = document.getElementById('pollution');
  const gVal = document.getElementById('gVal'); const gIndicator = document.getElementById('gIndicator');
  const oxygenMeter = document.getElementById('oxygenMeter');
  const carbonSvg = d3.select('#carbonCycle');

  // TOOLTIP: reusable tiny tooltip shown for elements with data-tooltip
  const tooltip = d3.select('body').append('div').attr('class','tooltip-box').style('display','none');
  function showTooltip(evt, text){
    tooltip.style('display','block').text(text);
    const x = evt.pageX + 12, y = evt.pageY + 12;
    tooltip.style('left', x + 'px').style('top', y + 'px');
  }
  function hideTooltip(){ tooltip.style('display','none'); }

  // attach hover handlers for any .help elements (icons with data-tooltip)
  document.querySelectorAll('.help[data-tooltip]').forEach(el=>{
    el.addEventListener('mouseenter', (e)=> showTooltip(e, el.getAttribute('data-tooltip')));
    el.addEventListener('mousemove', (e)=> showTooltip(e, el.getAttribute('data-tooltip')));
    el.addEventListener('mouseleave', hideTooltip);
    el.addEventListener('click', (e)=> { e.stopPropagation(); showTooltip(e, el.getAttribute('data-tooltip')); setTimeout(hideTooltip, 3500); });
  });

  // Preset scenarios
  const presetButtons = {
    pre: document.getElementById('preset-pre'),
    present: document.getElementById('preset-present'),
    high: document.getElementById('preset-high'),
    recover: document.getElementById('preset-recover')
  };
  const presets = {
    pre: {co2:280, temp:14, light:70, storms:false, pollution:false},
    present: {co2:420, temp:25, light:80, storms:false, pollution:false},
    high: {co2:950, temp:36, light:95, storms:true, pollution:true},
    recover: {co2:360, temp:22, light:85, storms:false, pollution:false}
  };
  function applyPreset(key){
    const p = presets[key]; if(!p) return;
    co2.value = p.co2; temp.value = p.temp; light.value = p.light;
    storms.checked = p.storms; pollution.checked = p.pollution;
    // visual active state
    Object.values(presetButtons).forEach(btn=> btn?.classList.remove('active'));
    presetButtons[key]?.classList.add('active');
    updateUI();
  }
  Object.entries(presetButtons).forEach(([k,btn])=> { if(btn) btn.addEventListener('click', ()=> applyPreset(k)); });

  // plant renderer
  const plant = new PlantRenderer('plantCanvas');
  let biomass = 50; // initial biomass (arbitrary units)

  // time series
  const oxygenHistory = [];
  const maxHistory = 40;

  // initialize Plotly-based plots (if available)
  if(window.initOxygenPlot) window.initOxygenPlot();
  if(window.initCarbonPlot) window.initCarbonPlot();

  // Carbon cycle nodes
  const nodes = [{id:'atmos',x:80,y:40,label:'Atmosphere'},{id:'plants',x:160,y:120,label:'Plants'},{id:'soil',x:80,y:200,label:'Soil'}];
  carbonSvg.selectAll('circle').data(nodes).enter().append('circle').attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',18).attr('fill','#a7f0d6');
  carbonSvg.selectAll('text').data(nodes).enter().append('text').attr('x',d=>d.x+26).attr('y',d=>d.y+6).text(d=>d.label).style('font-size','11px');

  // build flow paths for particles and strokes
  const nodeById = Object.fromEntries(nodes.map(n=>[n.id,n]));
  const flowDefs = [
    {id:'atm-plants', source:'atmos', target:'plants', color:'#7ccfb6', baseWidth:2},
    {id:'plants-soil', source:'plants', target:'soil', color:'#9bd8c3', baseWidth:1.6},
    {id:'soil-atm', source:'soil', target:'atmos', color:'#c9e9de', baseWidth:1.2}
  ];
  const flowGroup = carbonSvg.select('#flowPaths');
  flowGroup.selectAll('path').data(flowDefs).enter().append('path')
    .attr('id', d=>d.id)
    .attr('class','flowPath')
    .attr('d', d => `M ${nodeById[d.source].x} ${nodeById[d.source].y} L ${nodeById[d.target].x} ${nodeById[d.target].y}`)
    .attr('stroke', d=>d.color)
    .attr('fill','none')
    .attr('stroke-width', d=>d.baseWidth);

  const particles = carbonSvg.select('#particles');

  function spawnParticle(pathId, color, duration=1500){
    const pathEl = carbonSvg.select('#'+pathId).node();
    const len = pathEl.getTotalLength();
    const start = pathEl.getPointAtLength(0);
    const c = particles.append('circle').attr('r',4).attr('fill',color).attr('class','particle').attr('transform',`translate(${start.x},${start.y})`);
    c.transition().duration(duration).ease(d3.easeLinear)
      .attrTween('transform', function(){ return function(t){ const p = pathEl.getPointAtLength(t*len); return `translate(${p.x},${p.y})`; }; })
      .on('end', function(){ d3.select(this).remove(); });
  }

  // Dynamic particle spawner configuration — adjustable by auto-tuner
  let currentFlows = {absorbed:1, emitted:1};
  const particleConfig = {
    apScale: 1.0,        // scales atm->plants probability (multiplier)
    psScale: 1.0,        // scales plants->soil probability
    saScale: 1.0,        // scales soil->atmos probability
    durationScale: 1.0,  // scales particle duration (higher -> faster particles)
    tickInterval: 280
  };

  function dynamicSpawnerTick(){
    const flows = currentFlows;
    // atm -> plants (driven by absorbed)
    const pAP = Math.min(1, (flows.absorbed/22) * particleConfig.apScale);
    if(Math.random() < pAP) spawnParticle('atm-plants', '#7ccfb6', Math.max(400, (1700 / particleConfig.durationScale) - flows.absorbed*3));

    // plants -> soil (driven by emitted / biomass decay)
    const pPS = Math.min(1, (flows.emitted/28) * particleConfig.psScale);
    if(Math.random() < pPS) spawnParticle('plants-soil', '#9bd8c3', Math.max(300, (1100 / particleConfig.durationScale) - flows.emitted*2));

    // soil -> atmos (driven by emitted as well)
    const pSA = Math.min(1, (flows.emitted/55) * particleConfig.saScale);
    if(Math.random() < pSA) spawnParticle('soil-atm', '#c9e9de', Math.max(700, (2400 / particleConfig.durationScale) - flows.emitted*1.2));
  }
  // replace interval with one we can update if needed
  let dynamicSpawner = d3.interval(dynamicSpawnerTick, particleConfig.tickInterval);

  function updateCarbonVisual(flows){
    // flows: {absorbed, emitted}
    currentFlows = flows; // update the global for the spawner

    // adapt stroke widths
    const width = 1 + Math.max(0, flows.absorbed/30);
    flowGroup.selectAll('path').transition().duration(400).attr('stroke-width', d=>d.baseWidth * width);

    // update numeric readouts
    const absEl = document.getElementById('absVal'); const emitEl = document.getElementById('emitVal');
    if(absEl) absEl.textContent = Math.round(flows.absorbed);
    if(emitEl) emitEl.textContent = Math.round(flows.emitted);
    // update Plotly carbon plot as well
    if(window.updateCarbonPlot) updateCarbonPlot(flows.absorbed, flows.emitted);
  }

  // Broader Auto-tuning routine: performs a randomized search over a larger parameter space
  function autoTuneParticleParams(showToast=true, trials=800){
    const ranges = { ap:[0.4,2.0], ps:[0.4,1.6], sa:[0.4,1.4], dur:[0.6,1.6] };
    const scenarioKeys = ['pre','present','high','recover'];

    function sample(){
      const s = (min,max) => min + Math.random()*(max-min);
      return { apScale: Number(s(...ranges.ap).toFixed(3)), psScale: Number(s(...ranges.ps).toFixed(3)), saScale: Number(s(...ranges.sa).toFixed(3)), durationScale: Number(s(...ranges.dur).toFixed(3)) };
    }

    function scoreConfig(cfg){
      const rates = [];
      for(const k of scenarioKeys){
        const sc = presets[k];
        // map UI preset keys to model parameter names
        const params = { co2: sc.co2, temp: sc.temp, light: sc.light, stressEvents: sc.storms?1:0, pollution: sc.pollution };
        const prate = CCM.photosynthesisRate(params);
        const cf = CCM.carbonFlow(prate, 50);
        const pAP = Math.min(1, (cf.absorbed/22) * cfg.apScale);
        const pPS = Math.min(1, (cf.emitted/28) * cfg.psScale);
        const pSA = Math.min(1, (cf.emitted/55) * cfg.saScale);
        rates.push(pAP + pPS + pSA);
      }
      const mean = d3.mean(rates); const sd = d3.deviation(rates) || 0;
      // objective: high sd across scenarios but mean should be in a useful range (~0.6..1.1)
      const meanPenalty = Math.abs(mean - 0.85);
      const saturationPenalty = Math.max(0, mean - 1.25);
      // final score combines variance and penalties
      return sd - meanPenalty - saturationPenalty*1.5;
    }

    let best = null; let bestScore = -Infinity; const top = [];
    for(let i=0;i<trials;i++){
      const c = sample(); const s = scoreConfig(c);
      if(s > bestScore){ bestScore = s; best = c; }
      top.push({cfg:c,score:s});
    }
    top.sort((a,b)=>b.score - a.score);

    if(best){
      particleConfig.apScale = best.apScale; particleConfig.psScale = best.psScale; particleConfig.saScale = best.saScale; particleConfig.durationScale = best.durationScale;
      // restart the interval to ensure changes propagate
      dynamicSpawner.stop(); dynamicSpawner = d3.interval(dynamicSpawnerTick, particleConfig.tickInterval);

      // update sliders if present
      const sAp = document.getElementById('sliderAp'); const sPs = document.getElementById('sliderPs'); const sSa = document.getElementById('sliderSa'); const sDur = document.getElementById('sliderDur');
      if(sAp) { sAp.value = particleConfig.apScale; document.getElementById('sliderApVal').textContent = particleConfig.apScale.toFixed(2); }
      if(sPs) { sPs.value = particleConfig.psScale; document.getElementById('sliderPsVal').textContent = particleConfig.psScale.toFixed(2); }
      if(sSa) { sSa.value = particleConfig.saScale; document.getElementById('sliderSaVal').textContent = particleConfig.saScale.toFixed(2); }
      if(sDur) { sDur.value = particleConfig.durationScale; document.getElementById('sliderDurVal').textContent = particleConfig.durationScale.toFixed(2); }

      const msg = `Auto-tune: ap=${best.apScale}, ps=${best.psScale}, sa=${best.saScale}, dur=${best.durationScale}`;
      console.info(msg);
      const ts = document.getElementById('tuneStatus'); if(ts) ts.textContent = msg;
      if(showToast){ ts.style.opacity = 1; setTimeout(()=>ts.style.opacity=0.95, 200); setTimeout(()=>ts.style.opacity=1, 500); }

      // also print a small summary of top 3 configs for debugging
      const summary = top.slice(0,3).map((t,i)=> `${i+1}. ap=${t.cfg.apScale},ps=${t.cfg.psScale},sa=${t.cfg.saScale},dur=${t.cfg.durationScale} (score=${t.score.toFixed(3)})`).join(' | ');
      console.info('Top configs:', summary);
    }
    return best;
  }

  // wire Auto-Tune button
  const autoTuneBtn = document.getElementById('autoTune');
  if(autoTuneBtn){ autoTuneBtn.addEventListener('click', ()=>{ autoTuneParticleParams(true, 900); }); }

  // 'Load Best' button wiring (loads configs/best_particle_configs.json if available) and shows top-3 list
  const loadBestBtn = document.getElementById('loadBest');
  async function loadBestFromRepo(){
    try{
      const r = await fetch('configs/best_particle_configs.json');
      if(!r.ok) throw new Error('not available');
      const j = await r.json();
      const list = document.getElementById('bestList'); if(!list) return;
      list.innerHTML = '';
      if(j && j.top3 && j.top3.length){
        j.top3.forEach((t, i)=>{
          const item = document.createElement('div'); item.className='best-item';
          const pre = document.createElement('pre'); pre.textContent = `#${i+1} ap=${t.cfg.apScale} ps=${t.cfg.psScale} sa=${t.cfg.saScale} dur=${t.cfg.durationScale}`;
          item.appendChild(pre);
          const actions = document.createElement('div'); actions.className='actions';
          const useBtn = document.createElement('button'); useBtn.className='preset'; useBtn.textContent='Use'; useBtn.addEventListener('click', ()=>{ applyConfigToLive(t.cfg); document.getElementById('bestInfo').textContent = `Applied top-${i+1}`; });
          const dlBtn = document.createElement('button'); dlBtn.className='preset'; dlBtn.textContent='Download'; dlBtn.addEventListener('click', ()=>{ downloadObjectAsJson(t.cfg, `particle-config-top${i+1}.json`); });
          const cmdBtn = document.createElement('button'); cmdBtn.className='preset'; cmdBtn.textContent='Copy save cmd'; cmdBtn.addEventListener('click', ()=>{ copyToClipboard(`node scripts/apply_selected_config.js --index ${i+1}`); document.getElementById('bestInfo').textContent = 'Copied command to clipboard'; });
          actions.appendChild(useBtn); actions.appendChild(dlBtn); actions.appendChild(cmdBtn);
          item.appendChild(actions);
          list.appendChild(item);
        });
      }
    }catch(err){ console.warn('No best config available:', err); const bi = document.getElementById('bestInfo'); if(bi) bi.textContent = 'No saved config available (serve files over HTTP)'; }
  }
  if(loadBestBtn) loadBestBtn.addEventListener('click', loadBestFromRepo);

  // helpers: apply config to live spawner + update sliders
  function applyConfigToLive(cfg){
    particleConfig.apScale = cfg.apScale; particleConfig.psScale = cfg.psScale; particleConfig.saScale = cfg.saScale; particleConfig.durationScale = cfg.durationScale;
    dynamicSpawner.stop(); dynamicSpawner = d3.interval(dynamicSpawnerTick, particleConfig.tickInterval);
    const sAp = document.getElementById('sliderAp'); const sPs = document.getElementById('sliderPs'); const sSa = document.getElementById('sliderSa'); const sDur = document.getElementById('sliderDur');
    if(sAp) { sAp.value = particleConfig.apScale; document.getElementById('sliderApVal').textContent = particleConfig.apScale.toFixed(2); }
    if(sPs) { sPs.value = particleConfig.psScale; document.getElementById('sliderPsVal').textContent = particleConfig.psScale.toFixed(2); }
    if(sSa) { sSa.value = particleConfig.saScale; document.getElementById('sliderSaVal').textContent = particleConfig.saScale.toFixed(2); }
    if(sDur) { sDur.value = particleConfig.durationScale; document.getElementById('sliderDurVal').textContent = particleConfig.durationScale.toFixed(2); }
  }

  function downloadObjectAsJson(exportObj, exportName){
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObj, null, 2));
    const dlAnchor = document.createElement('a'); dlAnchor.setAttribute('href', dataStr); dlAnchor.setAttribute('download', exportName); document.body.appendChild(dlAnchor); dlAnchor.click(); dlAnchor.remove();
  }

  function copyToClipboard(text){ navigator.clipboard?.writeText(text).catch(()=>{}); }

  // try to load an active config (persisted) on startup
  (async function loadActiveConfig(){
    try{
      const r = await fetch('configs/active_particle_config.json'); if(!r.ok) throw new Error('missing');
      const cfg = await r.json(); applyConfigToLive(cfg); const ts = document.getElementById('tuneStatus'); if(ts) ts.textContent = 'Loaded active config from disk';
    }catch(e){ /* no active config available, skip */ }
  })();
  // slider bindings (manual tuning)
  function bindTuningSliders(){
    const sAp = document.getElementById('sliderAp'); const sPs = document.getElementById('sliderPs'); const sSa = document.getElementById('sliderSa'); const sDur = document.getElementById('sliderDur');
    if(!sAp) return;
    sAp.addEventListener('input', ()=>{ particleConfig.apScale = +sAp.value; document.getElementById('sliderApVal').textContent = (+sAp.value).toFixed(2); dynamicSpawner.stop(); dynamicSpawner = d3.interval(dynamicSpawnerTick, particleConfig.tickInterval); });
    sPs.addEventListener('input', ()=>{ particleConfig.psScale = +sPs.value; document.getElementById('sliderPsVal').textContent = (+sPs.value).toFixed(2); dynamicSpawner.stop(); dynamicSpawner = d3.interval(dynamicSpawnerTick, particleConfig.tickInterval); });
    sSa.addEventListener('input', ()=>{ particleConfig.saScale = +sSa.value; document.getElementById('sliderSaVal').textContent = (+sSa.value).toFixed(2); dynamicSpawner.stop(); dynamicSpawner = d3.interval(dynamicSpawnerTick, particleConfig.tickInterval); });
    sDur.addEventListener('input', ()=>{ particleConfig.durationScale = +sDur.value; document.getElementById('sliderDurVal').textContent = (+sDur.value).toFixed(2); dynamicSpawner.stop(); dynamicSpawner = d3.interval(dynamicSpawnerTick, particleConfig.tickInterval); });

    document.getElementById('applyManual').addEventListener('click', ()=>{ const ts=document.getElementById('tuneStatus'); ts.textContent = `Applied manual settings`; });
    document.getElementById('resetManual').addEventListener('click', ()=>{ sAp.value=1; sPs.value=1; sSa.value=1; sDur.value=1; sAp.dispatchEvent(new Event('input')); sPs.dispatchEvent(new Event('input')); sSa.dispatchEvent(new Event('input')); sDur.dispatchEvent(new Event('input')); document.getElementById('tuneStatus').textContent='Manual reset to defaults'; });
  }

  // run a silent broader auto-tune on first load, then bind sliders
  const initialBest = autoTuneParticleParams(false, 600);
  if(initialBest){ const ts = document.getElementById('tuneStatus'); if(ts) ts.textContent = `Auto-tuned visuals (ap=${initialBest.apScale})`; }
  bindTuningSliders();

  // --- Comparison panel logic ---
  const comparisonPanel = document.getElementById('comparisonPanel');
  const runComparisonBtn = document.getElementById('runComparison');
  const stopComparisonBtn = document.getElementById('stopComparison');
  let comparisonIntervals = [];
  function makeMiniSVG(container, scenarioKey){
    const w = 160, h = 110;
    const svg = d3.select(container).append('svg').attr('class','comp-svg').attr('width',w).attr('height',h);
    const nodes = [{id:'atmos',x:30,y:20,label:'A'},{id:'plants',x:110,y:55,label:'P'},{id:'soil',x:30,y:90,label:'S'}];
    svg.selectAll('circle').data(nodes).enter().append('circle').attr('cx',d=>d.x).attr('cy',d=>d.y).attr('r',6).attr('fill','#a7f0d6');
    svg.selectAll('text').data(nodes).enter().append('text').attr('x',d=>d.x+12).attr('y',d=>d.y+4).text(d=>d.label).style('font-size','10px');
    svg.append('g').attr('class','pflows'); svg.append('g').attr('class','pparticles');
    return svg;
  }

  function startComparison(){
    stopComparison();
    const scenarioKeys = ['pre','present','high','recover'];
    scenarioKeys.forEach((k,idx)=>{
      const card = document.createElement('div'); card.className='comp-card';
      const title = document.createElement('h4'); title.textContent = k.charAt(0).toUpperCase()+k.slice(1); card.appendChild(title);
      comparisonPanel.appendChild(card);
      const svg = makeMiniSVG(card, k);
      const pathDef = `M 30 20 L 110 55`;
      svg.select('.pflows').append('path').attr('d', pathDef).attr('stroke','#7ccfb6').attr('stroke-width',2).attr('fill','none');
      const particlesG = svg.select('.pparticles');

      // map preset to model params and spawn particles driven by scenario flows
      const sc = presets[k];
      const params = { co2: sc.co2, temp: sc.temp, light: sc.light, stressEvents: sc.storms?1:0, pollution: sc.pollution };
      const prate = CCM.photosynthesisRate(params);
      const cf = CCM.carbonFlow(prate, 50);
      const spawnFn = ()=>{
        const pAP = Math.min(1, (cf.absorbed/22) * particleConfig.apScale);
        if(Math.random() < pAP){
          const pathEl = svg.select('.pflows').select('path').node(); const len = pathEl.getTotalLength();
          const c = particlesG.append('circle').attr('r',3).attr('fill','#7ccfb6').attr('class','particle');
          const dur = Math.max(400, (1700 / particleConfig.durationScale) - cf.absorbed*3);
          c.transition().duration(dur).ease(d3.easeLinear).attrTween('transform', function(){ return function(t){ const p = pathEl.getPointAtLength(t*len); return `translate(${p.x},${p.y})`; }; }).on('end', function(){ d3.select(this).remove(); });
        }
      };
      const it = d3.interval(spawnFn, 350 + idx*80);
      comparisonIntervals.push(it);
      const stat = document.createElement('div'); stat.className='comp-stats'; stat.textContent = `O₂ est: ${Math.round(CCM.oxygenOutput(prate,50))}`; card.appendChild(stat);
    });
  }
  function stopComparison(){ comparisonIntervals.forEach(i=>i.stop()); comparisonIntervals = []; comparisonPanel.innerHTML=''; }
  if(runComparisonBtn) runComparisonBtn.addEventListener('click', startComparison); if(stopComparisonBtn) stopComparisonBtn.addEventListener('click', stopComparison);



  // --- Guided tour logic ---
  const tourOverlay = document.getElementById('tourOverlay');
  const tourTitle = document.getElementById('tourTitle');
  const tourText = document.getElementById('tourText');
  const tourHint = document.getElementById('tourHint');
  const tourPrev = document.getElementById('tourPrev');
  const tourNext = document.getElementById('tourNext');
  const tourClose = document.getElementById('tourClose');
  const startTourBtn = document.getElementById('startTour');

  const tourSteps = [
    {title:'Welcome', text:'This tour explores how CO₂, temperature and sunlight influence plants, oxygen output and carbon flows. Click Next to try preset scenarios.', hint:'Tip: You can stop the tour anytime.'},
    {title:'Pre-Industrial', key:'pre', text:'Pre-Industrial: low CO₂ and cool temperatures. Notice modest carbon uptake and stable balance.', target:'#preset-pre'},
    {title:'Present-day', key:'present', text:'Present-day: CO₂ has risen. See how oxygen output changes and carbon flows strengthen.', target:'#preset-present'},
    {title:'High Emissions', key:'high', text:'High-emissions: elevated CO₂, heat stress, and pollution reduce balance—watch the Global Balance index.', target:'#preset-high'},
    {title:'Recovery', key:'recover', text:'Recovery shows how modest reductions in CO₂ and policy can help restore balance over time.', target:'#preset-recover'},
    {title:'Explore', text:'You finished the tour — experiment with sliders and presets to see different outcomes. Try combinations and observe the Global Balance Index.'}
  ];
  let tourIdx = 0;

  function clearHighlights(){ document.querySelectorAll('.highlight').forEach(el=>el.classList.remove('highlight')); }
  function showStep(i){
    tourIdx = i; if(tourIdx < 0) tourIdx = 0; if(tourIdx >= tourSteps.length) { closeTour(); return; }
    const s = tourSteps[tourIdx];
    tourTitle.textContent = s.title || 'Tour'; tourText.textContent = s.text || ''; tourHint.textContent = s.hint || '';
    tourOverlay.setAttribute('aria-hidden', 'false');
    // highlight target if available
    clearHighlights();
    if(s.target){ const el = document.querySelector(s.target); if(el) el.classList.add('highlight'); }
    // apply preset if step defines it
    if(s.key){ applyPreset(s.key); }
  }
  function nextStep(){ showStep(tourIdx+1); }
  function prevStep(){ showStep(tourIdx-1); }
  function closeTour(){ tourOverlay.setAttribute('aria-hidden','true'); clearHighlights(); }

  tourNext.addEventListener('click', nextStep); tourPrev.addEventListener('click', prevStep); tourClose.addEventListener('click', closeTour);
  startTourBtn.addEventListener('click', ()=>{ showStep(0); });

  // allow pressing ESC to close tour
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeTour(); });

  function updateUI(){
    co2Val.textContent = co2.value; tempVal.textContent = temp.value; lightVal.textContent = light.value;

    // compute model
    const params = {co2:+co2.value, temp:+temp.value, light:+light.value, stressEvents: storms.checked?1:0, pollution: pollution.checked};
    const pRate = CCM.photosynthesisRate(params);
    const o2 = CCM.oxygenOutput(pRate, biomass);
    const cf = CCM.carbonFlow(pRate, biomass);
    // Slight negative feedback: if global index is low, accelerate biomass decay
    if(CCM.globalBalance({...params, biomass}) < 30) biomass *= 0.998;
    const gIdx = CCM.globalBalance({...params, biomass});

    // update plant growth (growth mapped to rate & biomass)
    const growth = clamp((pRate * (biomass/100)), 0, 1);
    plant.setGrowth(growth);

    // oxygen meter (update width)
    const meterVal = clamp(Math.round(o2), 0, 140);
    const meterWidth = Math.min(100, meterVal); // cap visual width to 100%
    const meterBar = oxygenMeter.querySelector('.bar');
    if(!meterBar){
      const b = document.createElement('div'); b.className='bar'; b.style.height='100%'; b.style.width=meterWidth+'%'; b.style.background='linear-gradient(90deg,#ffd166,#2a9d8f)'; oxygenMeter.appendChild(b);
    } else { meterBar.style.width = meterWidth+'%'; }
    // quick value label (show actual O2 value even if bar capped)
    let small = oxygenMeter.querySelector('small'); if(!small){ small = document.createElement('small'); oxygenMeter.appendChild(small); }
    small.textContent = meterVal + ' O₂ units';
    // adjust bar color slightly based on global index (greenish when healthy)
    if(gIdx > 65){ meterBar.style.background = 'linear-gradient(90deg,#bfead3,#2a9d8f)'; }
    else if(gIdx > 35){ meterBar.style.background = 'linear-gradient(90deg,#ffd166,#ffb247)'; }
    else { meterBar.style.background = 'linear-gradient(90deg,#ffd6d6,#e76f51)'; }

    // oxygen history (Plotly)
    if(window.updateOxygenPlot) updateOxygenPlot(meterVal);

    // carbon visuals
    updateCarbonVisual(cf);

    // global index
    gVal.textContent = gIdx + ' / 100';
    gIndicator.style.background = gIdx>65? '#bfead3': (gIdx>35? '#ffebc6' : '#ffd6d6');

    // biomass changes slowly based on net carbon
    biomass += (cf.absorbed - cf.emitted) * 0.02; biomass = clamp(biomass, 2, 300);

    // pass changes to plant physics (wind stronger with more light)
    const windStrength = +light.value/100;
    plant.applyWind(0.3 * windStrength);
  }

  function clamp(x,a,b){return Math.max(a,Math.min(b,x));}

  // Event wiring
  [co2,temp,light].forEach(el=>el.addEventListener('input', updateUI));
  [storms,pollution].forEach(el=>el.addEventListener('change', updateUI));

  // initial render
  updateUI();

  // start small update loop for charts & UI
  setInterval(updateUI, 900);

  // small interaction: click carbon SVG to simulate a pulse of increased CO2
  carbonSvg.on('click', ()=>{ co2.value = Math.min(2000, +co2.value + 120); updateUI(); });
});