# Photosynthesis & Environment Interaction Simulator

Prototype web app demonstrating how CO₂, temperature, and sunlight affect photosynthesis, oxygen output, and the carbon cycle.

## Features
- Real-time sliders for CO₂, Temperature, and Sunlight
- Canvas-based animated plant with physics-based leaf sway (Matter.js)
- D3 visualizations: Oxygen timeline and animated carbon flow
- Animated carbon particles that move along the carbon cycle to show flow direction and intensity
- Reusable educational tooltips and microcopy explaining scientific concepts
- Scenario presets (Pre-Industrial, Present-day, High-emissions, Recovery) for quick exploration
- A guided interactive tour that walks you through key scenarios and explains what to watch for
- Dynamic carbon particle spawn rates: particle frequency and speed adapt to real-time carbon flow magnitudes
- Automatic visual tuning: an Auto-tune button computes visual parameters to maximize clarity across scenarios
- Manual tuning: advanced sliders allow adjusting `apScale`, `psScale`, `saScale`, and `durationScale` for fine-grained control
- Offline auto-tune runner: run `python scripts/auto_tune_runner.py` to compute a robust "best of 3" set and save to `configs/best_particle_configs.json`.
- Side-by-side scenario comparison: open the "Scenario Comparison" card and click "Run Comparison" to see four presets animated simultaneously using the tuned visuals.
- Persist a chosen top config:
  - Use the UI: click **Load Best Config** then click **Use** on a top-3 item to apply it live, or **Download** to save the JSON locally.
  - To persist to the repository, run: `node scripts/apply_selected_config.js --index N` (requires Node) which writes `configs/active_particle_config.json` that the app loads on startup.
- Lightweight CCM model (`js/ccm.js`) implementing photosynthesis and balance calculations

## Tech stack
- D3.js (visualizations)
- Canvas API (plant rendering)
- Matter.js (physics for motion)
- `js/ccm.js` (Plotter/CCM-style modeling functions)

## Quick start
1. Open `index.html` in a modern browser (Chrome/Edge/Firefox)
2. Adjust sliders and toggles to see how the simulation reacts

## Notes
- This is a prototype intended for education and visualization. Formulas are simplified for clarity.
- Want enhancements? I can add: more plant species, climate scenarios, exportable data, or step-by-step lessons.
