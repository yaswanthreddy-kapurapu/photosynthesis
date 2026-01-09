/* plantRenderer.js
   Renders a stylized plant on Canvas and applies gentle physics-based sway with Matter.js
*/
class PlantRenderer {
  constructor(canvasId){
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width; this.height = this.canvas.height;

    // simple plant state
    this.growth = 0; // 0..1
    this.leafAngle = 0;

    // Matter.js world for physics-based sway
    this.engine = Matter.Engine.create();
    this.bodies = [];
    this.setupPhysics();

    this.last = performance.now();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupPhysics(){
    const world = this.engine.world;
    world.gravity.y = 0; // no gravity; just gentle forces
    // add a very light perlin-like push to create motion using runner events

    // create a few small circular bodies representing leaves connected along stem
    const startY = this.height - 60;
    const parts = [];

    for(let i=0;i<5;i++){
      const b = Matter.Bodies.circle(this.width/2 + (i%2? -10: 10), startY - i*40, 8, {frictionAir:0.02, restitution:0.8});
      parts.push(b);
      Matter.World.add(world, b);
      this.bodies.push(b);
    }

    // constraints to hold leaves near stem
    for(let i=0;i<parts.length;i++){
      const anchor = { x:this.width/2, y:startY - i*40 };
      const cons = Matter.Constraint.create({ bodyA: parts[i], pointB: anchor, length:12, stiffness:0.07 });
      Matter.World.add(world, cons);
    }
  }

  setGrowth(g){ this.growth = Math.max(0, Math.min(1, g)); }

  applyWind(strength){
    // apply small lateral force to bodies
    for(const b of this.bodies){
      const f = (Math.random()-0.5) * strength * 0.0006;
      Matter.Body.applyForce(b, b.position, {x: f, y: 0});
    }
  }

  drawPlant(){
    const ctx = this.ctx;
    ctx.clearRect(0,0,this.width,this.height);

    const stemHeight = 120 + this.growth*160;
    const baseX = this.width/2, baseY = this.height - 40;

    // draw soil
    ctx.fillStyle = '#dfeee1';
    ctx.fillRect(0, baseY+40, this.width, 100);

    // stem
    ctx.strokeStyle = '#114b23'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(baseX-12, baseY - stemHeight/2, baseX, baseY - stemHeight);
    ctx.stroke();

    // leaves: draw at positions of physics bodies
    ctx.fillStyle = '#2a9d4f';
    for(const b of this.bodies){
      const x = b.position.x, y = b.position.y;
      const size = 12 + this.growth * 12;
      ctx.beginPath(); ctx.ellipse(x, y, size, size*0.6, b.angle, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.stroke();
    }

    // flower/top if big
    if(this.growth > 0.6){
      ctx.beginPath(); ctx.fillStyle = '#ffd166'; ctx.arc(baseX, baseY - stemHeight - 8, 10 + (this.growth-0.6)*10,0,Math.PI*2); ctx.fill();
    }
  }

  animate(ts){
    const dt = (ts - this.last)/1000; this.last = ts;
    // run physics
    Matter.Engine.update(this.engine, dt*1000);

    // apply gentle wind depending on time
    const wind = Math.sin(ts/1500) * (0.2 + this.growth*0.6);
    this.applyWind(Math.abs(wind));

    this.drawPlant();
    requestAnimationFrame(this.animate);
  }
}

// Expose
if(typeof window !== 'undefined') window.PlantRenderer = PlantRenderer;