// Animación unificada de fin (victoria/derrota)
// Uso: new EndAnimation({ type: 'win' | 'lose' })
class EndAnimation {
  constructor({ type = 'win' } = {}) {
    this.type = type;
    const baseCfg = (type === 'win') ? (CONFIG.win || {}) : (CONFIG.gameOver || {});
    this.duration = baseCfg.duration || 5000;
    this.startTime = millis();

    // Partículas: para victoria usamos "uvas chiquitas"; para derrota, gotas rojas que caen
    this.particles = [];
    this.gravity = 0.18;
    this.floorY = height - 30;
    this.spawnDuration = this.duration * 0.7;
    this.spawnRate = (type === 'win') ? 24 : 18; // por segundo
    this.grapeColor = [150, 60, 180];
    this.grapeHighlight = [255, 230, 255];
    this.loseColor = baseCfg.text && baseCfg.text.color ? baseCfg.text.color : [255, 0, 0];
    this.lastSpawn = this.startTime;

    // Pre-spawn para que se vea desde el primer frame
    const preloadCount = (type === 'win') ? 40 : 30;
    for (let i = 0; i < preloadCount; i++) {
      this.particles.push(this.createParticle(type, random(0, width), random(-height * 0.4, -10)));
    }
  }

  createParticle(type, x, y) {
    const isWin = type === 'win';
    const size = isWin ? random(6, 14) : random(5, 12);
    return {
      type,
      pos: createVector(x, y),
      vel: createVector(random(-0.8, 0.8), random(2, 6)),
      rot: random(TWO_PI),
      rotSpeed: random(-0.03, 0.03),
      size,
      life: 255,
      alphaDecay: random(0.4, 0.8),
      wobblePhase: random(TWO_PI)
    };
  }

  update() {
    const elapsed = millis() - this.startTime;
    if (elapsed < this.spawnDuration) {
      const targetSpawns = this.spawnRate * (deltaTime / 1000.0);
      const count = floor(targetSpawns) + (random() < (targetSpawns % 1) ? 1 : 0);
      for (let i = 0; i < count; i++) {
        this.particles.push(this.createParticle(this.type, random(0, width), random(-height * 0.1, -10)));
      }
    }

    for (let p of this.particles) {
      p.vel.y += this.gravity;
      p.pos.add(p.vel);
      p.rot += p.rotSpeed;
      p.wobblePhase += 0.05;
      p.pos.x += sin(p.wobblePhase) * 0.2;
      if (p.pos.y > this.floorY) {
        p.pos.y = this.floorY;
        p.vel.y *= -0.25;
        p.vel.x *= 0.7;
        p.life -= p.alphaDecay;
      }
    }
    this.particles = this.particles.filter(p => p.life > 10);
  }

  display(ctx = window) {
    ctx.push();
    // Fondo suave para resaltar
    ctx.fill(0, 0, 0, 120);
    ctx.rect(0, 0, width, height);

    if (this.type === 'win') {
      // Uvas moradas
      for (let g of this.particles) {
        const alpha = g.life;
        const c = this.grapeColor;
        ctx.noStroke();
        ctx.fill(c[0]*0.6, c[1]*0.6, c[2]*0.6, alpha);
        ctx.ellipse(g.pos.x, g.pos.y, g.size * 1.05, g.size * 1.05);
        ctx.fill(c[0], c[1], c[2], alpha);
        ctx.ellipse(g.pos.x, g.pos.y, g.size, g.size);
        ctx.fill(this.grapeHighlight[0], this.grapeHighlight[1], this.grapeHighlight[2], alpha);
        ctx.ellipse(g.pos.x - g.size*0.2, g.pos.y - g.size*0.25, g.size*0.25, g.size*0.25);
      }

      // Trofeo e info
      if (typeof window !== 'undefined' && window.trophyImage) {
        if (!this.scaledTrophyImage) {
          const img = window.trophyImage;
          const aspect = img.height > 0 && img.width > 0 ? (img.height / img.width) : 1;
          const baseSize = min(width, height) * 0.18;
          const w = baseSize;
          const h = w * aspect;
          this.scaledTrophyImage = createGraphics(w, h);
          this.scaledTrophyImage.image(img, 0, 0, w, h);
        }
        const t = constrain((millis() - this.startTime) / this.duration, 0, 1);
        const intro = this.easeOutElastic(constrain((t - 0.1) * 3, 0, 1));
        ctx.imageMode(CENTER);
        ctx.noStroke();
        ctx.fill(0, 0, 0, 100 * intro);
        ctx.ellipse(width/2 + 5, height * 0.35 + 5, this.scaledTrophyImage.width * intro * 0.9, this.scaledTrophyImage.height * intro * 0.9);
        ctx.push();
        ctx.scale(intro);
        ctx.image(this.scaledTrophyImage, width/2/intro, height * 0.35/intro);
        ctx.pop();
      }

      // Puntuación final y combo
      const alpha = constrain(map(millis() - this.startTime, this.duration * 0.5, this.duration * 0.7, 0, 255), 0, 255);
      ctx.textAlign(CENTER, CENTER);
      ctx.textSize(40);
      ctx.fill(0, 0, 0, alpha * 0.7);
      ctx.text(`Puntuación Final: ${Math.floor(scoreSystem.score)}`, width/2 + 3, height * 0.7 + 3);
      ctx.fill(255, 255, 255, alpha);
      ctx.text(`Puntuación Final: ${Math.floor(scoreSystem.score)}`, width/2, height * 0.7);
      ctx.textSize(30);
      ctx.fill(255, 215, 0, alpha);
      ctx.text(`Combo más alto: x${scoreSystem.highestCombo}`, width/2, height * 0.7 + 50);
      if (millis() - this.startTime > this.duration * 0.8) {
        const pulseAlpha = 127 + 127 * sin(frameCount * 0.1);
        ctx.textSize(25);
        ctx.fill(255, 255, 255, pulseAlpha);
        ctx.text("Toca la pantalla para reiniciar", width/2, height * 0.85);
      }
    } else {
      // DERROTA: gotas rojas discretas y texto
      for (let p of this.particles) {
        const a = p.life;
        ctx.noStroke();
        ctx.fill(this.loseColor[0]*0.7, this.loseColor[1]*0.7, this.loseColor[2]*0.7, a);
        ctx.ellipse(p.pos.x, p.pos.y, p.size * 1.1, p.size * 1.1);
        ctx.fill(this.loseColor[0], this.loseColor[1], this.loseColor[2], a);
        ctx.ellipse(p.pos.x, p.pos.y, p.size, p.size);
      }
      const baseCfg = CONFIG.gameOver || {};
      const textColor = baseCfg.text && baseCfg.text.color ? baseCfg.text.color : [255, 0, 0];
      const textSize = baseCfg.text && baseCfg.text.size ? baseCfg.text.size : 0.15;
      ctx.textAlign(CENTER, CENTER);
      ctx.textSize(height * textSize);
      ctx.fill(0, 0, 0, 180);
      ctx.text("PERDISTE", width/2 + 5, height/2 + 5);
      ctx.fill(textColor[0], textColor[1], textColor[2]);
      ctx.text("PERDISTE", width/2, height/2);
    }

    ctx.pop();
  }

  easeOutElastic(x) {
    const c4 = (2 * Math.PI) / 3;
    return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  }

  isFinished() { return millis() - this.startTime > this.duration; }
}