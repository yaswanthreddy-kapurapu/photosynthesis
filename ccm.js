/* ccm.js — Carbon Cycle & Environmental Model (lightweight Plotter/CCM)
   Purpose: Provide functions to compute photosynthesis rate, oxygen output,
   carbon flows, and global balance index using simple but reasonable formulas.
*/
const CCM = (() => {
  // Helpers
  function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }

  // Temperature effect: gaussian centered at 25°C with sigma 10
  function tempFactor(temp){
    const opt = 25; const sigma = 10;
    const f = Math.exp(-Math.pow((temp - opt),2)/(2*sigma*sigma));
    return clamp(f, 0, 1.0);
  }

  // CO2 effect: saturating function (Michaelis-Menten style)
  function co2Factor(co2){
    const km = 600; // half-saturation ppm
    return clamp(co2 / (co2 + km), 0, 1.0);
  }

  // Light effect: linear to 100% then saturates slightly after
  function lightFactor(lightPercent){
    return clamp(lightPercent/100, 0, 1.2);
  }

  // Compute photosynthesis rate (arbitrary units) per plant biomass
  function photosynthesisRate({co2, temp, light, stressEvents=0, pollution=false}){
    const base = 1.0; // base capacity per unit biomass
    const t = tempFactor(temp);
    const c = co2Factor(co2);
    const l = lightFactor(light);
    let rate = base * t * c * l;
    // stress reduces efficiency
    rate *= Math.pow(0.85, stressEvents);
    if(pollution) rate *= 0.7;
    return clamp(rate, 0, 2.0);
  }

  function oxygenOutput(photosynthesisRate, biomass){
    // O2 production proportional to rate and biomass
    return photosynthesisRate * biomass * 1.2; // units: arbitrary O2 units
  }

  function carbonFlow(photosynthesisRate, biomass){
    // carbon sequestered by plants per time unit
    const absorbed = photosynthesisRate * biomass * 0.9;
    // respiration & decay emits fraction
    const emitted = biomass * 0.05;
    return {absorbed, emitted};
  }

  function globalBalance({co2, temp, light, biomass, stressEvents=0, pollution=false}){
    // high-level index from 0 (collapse) to 100 (healthy)
    const p = photosynthesisRate({co2,temp,light,stressEvents,pollution});
    // biomass factor (if biomass < threshold, low resilience)
    const biomassFactor = clamp(biomass / 100, 0, 1);
    let index = (p * 60) + (biomassFactor * 30) + ((1 - (co2/2000)) * 10);
    // penalties
    if(pollution) index -= 8;
    index -= stressEvents * 4;
    index = Math.round(clamp(index, 0, 100));
    return index;
  }

  return {photosynthesisRate, oxygenOutput, carbonFlow, globalBalance};
})();

// Expose to window for easy access
if(typeof window !== 'undefined') window.CCM = CCM;