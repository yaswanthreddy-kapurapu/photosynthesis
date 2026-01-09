/* plots.js — encapsulates Plotly-based plots for oxygen and carbon time-series */
(function(){
  const maxHistory = 40;
  let oxyX = [], oxyY = [];
  let carbX = [], carbAbs = [], carbEm = [];

  function initOxygenPlot(){
    const el = document.getElementById('oxygenPlot'); if(!el) return;
    const data = [{ x: oxyX, y: oxyY, mode: 'lines+markers', line:{color:'#2a9d8f'}, name:'O₂' }];
    const layout = { margin:{l:36,r:10,t:20,b:28}, height:140, xaxis:{showticklabels:false}, yaxis:{title:'O₂ units', rangemode:'tozero'} };
    Plotly.newPlot(el, data, layout, {responsive:true, displayModeBar:false});
  }

  function updateOxygenPlot(val){
    const el = document.getElementById('oxygenPlot'); if(!el) return;
    oxyX.push(new Date()); oxyY.push(val);
    if(oxyY.length > maxHistory){ oxyX.shift(); oxyY.shift(); }
    Plotly.react(el, [{ x: oxyX, y: oxyY, mode: 'lines+markers', line:{color:'#2a9d8f'}, name:'O₂' }],
      { margin:{l:36,r:10,t:20,b:28}, height:140, xaxis:{showticklabels:false}, yaxis:{title:'O₂ units', range:[0, Math.max(100, Math.max(...oxyY)||0)] } }, {displayModeBar:false});
  }

  function initCarbonPlot(){
    const el = document.getElementById('carbonPlot'); if(!el) return;
    const data = [
      { x: carbX, y: carbAbs, mode:'lines', name:'Absorbed', line:{color:'#7ccfb6'}, fill:'tozeroy', fillcolor:'rgba(124,207,182,0.08)' },
      { x: carbX, y: carbEm, mode:'lines', name:'Emitted', line:{color:'#e76f51'}, fill:'tozeroy', fillcolor:'rgba(231,111,81,0.08)' }
    ];
    const layout = { margin:{l:36,r:10,t:16,b:28}, height:140, xaxis:{showticklabels:false}, yaxis:{title:'CO₂ (units)'} };
    Plotly.newPlot(el, data, layout, {responsive:true, displayModeBar:false});
  }

  function updateCarbonPlot(abs, emit){
    const el = document.getElementById('carbonPlot'); if(!el) return;
    carbX.push(new Date()); carbAbs.push(abs); carbEm.push(emit);
    if(carbAbs.length > maxHistory){ carbX.shift(); carbAbs.shift(); carbEm.shift(); }
    Plotly.react(el, [
      { x: carbX, y: carbAbs, mode:'lines', name:'Absorbed', line:{color:'#7ccfb6'}, fill:'tozeroy', fillcolor:'rgba(124,207,182,0.08)' },
      { x: carbX, y: carbEm, mode:'lines', name:'Emitted', line:{color:'#e76f51'}, fill:'tozeroy', fillcolor:'rgba(231,111,81,0.08)' }
    ], { margin:{l:36,r:10,t:16,b:28}, height:140, xaxis:{showticklabels:false}, yaxis:{title:'CO₂ (units)'} }, {displayModeBar:false});
  }

  // expose globally so app.js can call them
  window.initOxygenPlot = initOxygenPlot;
  window.updateOxygenPlot = updateOxygenPlot;
  window.initCarbonPlot = initCarbonPlot;
  window.updateCarbonPlot = updateCarbonPlot;
})();