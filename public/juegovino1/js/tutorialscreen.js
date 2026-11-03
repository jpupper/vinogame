// Pantalla tutorial que se muestra antes de iniciar el modo competitivo
class TutorialScreen {
  constructor() {
    this.duration = 5000; // 5 segundos
    this.startTime = null;
    this.active = false;
    
    // Ejemplos de objetos
    this.goodExample = {
      x: 0,
      y: 0,
      size: 80,
      glowPhase: 0
    };
    
    this.badExample = {
      x: 0,
      y: 0,
      size: 80,
      glowPhase: Math.PI
    };
  }
  
  start() {
    this.active = true;
    this.startTime = millis();
  }
  
  isFinished() {
    if (!this.active || this.startTime === null) return false;
    return (millis() - this.startTime) >= this.duration;
  }
  
  display(ctx = window) {
    if (!this.active) return;
    
    ctx.push();
    
    // Fondo semitransparente
    ctx.fill(0, 0, 0, 200);
    ctx.rect(0, 0, width, height);
    
    // Actualizar fases de glow
    this.goodExample.glowPhase += 0.05;
    this.badExample.glowPhase += 0.05;
    
    // Dibujar instrucciones para LADO IZQUIERDO (Jugador 1)
    this.drawInstructionsForSide(ctx, 'left');
    
    // Dibujar instrucciones para LADO DERECHO (Jugador 2)
    this.drawInstructionsForSide(ctx, 'right');
    
    // Línea divisoria central
    ctx.stroke(255, 255, 255, 100);
    ctx.strokeWeight(2);
    ctx.line(width / 2, 0, width / 2, height);
    ctx.noStroke();
    
    // Contador regresivo en el centro
    const remaining = Math.ceil((this.duration - (millis() - this.startTime)) / 1000);
    ctx.textSize(32);
    ctx.fill(255, 255, 255);
    ctx.textAlign(CENTER, CENTER);
    ctx.textFont('Arial Black, sans-serif');
    
    // Fondo para el contador
    ctx.fill(0, 0, 0, 180);
    ctx.rect(width / 2 - 200, height * 0.88, 400, 60, 10);
    
    ctx.fill(200, 200, 200);
    ctx.text(`El juego comienza en ${remaining}...`, width / 2, height * 0.91);
    
    ctx.pop();
  }
  
  drawInstructionsForSide(ctx, side) {
    // Calcular posiciones según el lado
    const centerX = side === 'left' ? width * 0.25 : width * 0.75;
    const centerY = height * 0.5;
    const goodY = centerY - 100;
    const badY = centerY + 100;
    
    ctx.textAlign(CENTER, CENTER);
    ctx.textFont('Arial Black, sans-serif');
    
    // Título para este lado
    ctx.textSize(28);
    ctx.fill(255, 255, 255);
    ctx.text('¡Aprende a jugar!', centerX, height * 0.12);
    
    // OBJETO BUENO (arriba)
    const goodExample = {
      x: centerX,
      y: goodY,
      size: 70,
      glowPhase: this.goodExample.glowPhase
    };
    this.drawObjectExample(ctx, goodExample, [255, 215, 0], true);
    
    // Texto para objeto bueno
    const goodTextY = goodY + 80;
    ctx.textSize(20);
    ctx.fill(255, 215, 0);
    ctx.text('Aura amarilla', centerX, goodTextY);
    ctx.textSize(18);
    ctx.fill(200, 200, 100);
    ctx.text('SUMA PUNTOS', centerX, goodTextY + 25);
    
    // OBJETO MALO (abajo)
    const badExample = {
      x: centerX,
      y: badY,
      size: 70,
      glowPhase: this.badExample.glowPhase
    };
    this.drawObjectExample(ctx, badExample, [255, 50, 50], false);
    
    // Texto para objeto malo
    const badTextY = badY + 80;
    ctx.textSize(20);
    ctx.fill(255, 50, 50);
    ctx.text('Aura roja', centerX, badTextY);
    ctx.textSize(18);
    ctx.fill(200, 100, 100);
    ctx.text('RESTA VIDAS', centerX, badTextY + 25);
  }
  
  drawObjectExample(ctx, obj, color, isGood) {
    ctx.push();
    
    const glowIntensity = 0.7 + 0.3 * sin(obj.glowPhase);
    
    // Aura exterior (múltiples capas)
    ctx.noStroke();
    for (let i = 6; i > 0; i--) {
      const glowSize = obj.size + (i * 20 * glowIntensity);
      const glowAlpha = (60 / i) * glowIntensity;
      ctx.fill(color[0], color[1], color[2], glowAlpha);
      ctx.ellipse(obj.x, obj.y, glowSize, glowSize);
    }
    
    // Objeto principal (simulando una copa o botella)
    // Fondo del objeto
    ctx.fill(150, 100, 200);
    ctx.ellipse(obj.x, obj.y, obj.size, obj.size);
    
    // Borde brillante
    ctx.stroke(color[0], color[1], color[2], 255);
    ctx.strokeWeight(4);
    ctx.noFill();
    ctx.ellipse(obj.x, obj.y, obj.size, obj.size);
    
    // Símbolo en el centro
    ctx.noStroke();
    ctx.textAlign(CENTER, CENTER);
    ctx.textSize(obj.size * 0.5);
    ctx.fill(255, 255, 255);
    ctx.text(isGood ? '+' : '-', obj.x, obj.y);
    
    // Partículas flotantes alrededor
    if (!obj.particles) {
      obj.particles = [];
      for (let i = 0; i < 8; i++) {
        obj.particles.push({
          angle: (TWO_PI / 8) * i,
          speed: 0.3 + Math.random() * 0.2,
          distance: 1.2,
          size: 3 + Math.random() * 3
        });
      }
    }
    
    for (let p of obj.particles) {
      p.angle += p.speed * 0.03;
      const px = obj.x + cos(p.angle) * (obj.size * 0.7) * p.distance;
      const py = obj.y + sin(p.angle) * (obj.size * 0.7) * p.distance;
      const particleAlpha = 180 * glowIntensity;
      
      // Glow de partícula
      ctx.fill(color[0], color[1], color[2], particleAlpha * 0.4);
      ctx.ellipse(px, py, p.size * 2.5, p.size * 2.5);
      
      // Partícula sólida
      ctx.fill(255, 255, 255, particleAlpha);
      ctx.ellipse(px, py, p.size, p.size);
    }
    
    ctx.pop();
  }
  
  reset() {
    this.active = false;
    this.startTime = null;
  }
}
