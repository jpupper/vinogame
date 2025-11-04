// Animación unificada de fin de juego (victoria/derrota)
// Soporta modo colaborativo (pantalla completa) y competitivo (pantalla dividida)
// Uso: 
//   Colaborativo: new EndAnimation({ type: 'win' | 'lose' })
//   Competitivo: new EndAnimation({ type: 'win' | 'lose', side: 'left' | 'right', x, y, width, height })
class EndAnimation {
  constructor({ 
    type = 'win',           // 'win' o 'lose'
    side = null,            // null para colaborativo, 'left' o 'right' para competitivo
    x = 0,                  // posición x del área (para competitivo)
    y = 0,                  // posición y del área (para competitivo)
    areaWidth = null,       // ancho del área (null = pantalla completa)
    areaHeight = null       // alto del área (null = pantalla completa)
  } = {}) {
    this.type = type;
    this.side = side;
    this.isCompetitive = side !== null;
    
    // Área de renderizado
    this.x = x;
    this.y = y;
    this.areaWidth = areaWidth || width;
    this.areaHeight = areaHeight || height;
    this.centerX = this.x + this.areaWidth / 2;
    this.centerY = this.y + this.areaHeight / 2;
    
    // Configuración
    const baseCfg = (type === 'win') ? (CONFIG.win || {}) : (CONFIG.gameOver || {});
    this.duration = baseCfg.duration || 5000;
    this.startTime = millis();
    
    // Colores según tipo
    this.isWin = type === 'win';
    this.glowColor = this.isWin ? [255, 215, 0] : [255, 60, 60]; // Dorado o Rojo
    this.waveColor = this.isWin ? [255, 215, 0] : [255, 0, 0];
    
    // Texto a mostrar
    this.text = this.isWin ? 'GANASTE' : 'PERDISTE';
    
    // Animación de letras
    this.letters = [];
    this.initLetters();
    
    // Ondas expansivas
    this.waves = [];
    this.lastWaveTime = this.startTime;
    this.waveInterval = 800; // Spawn cada 800ms
  }
  
  initLetters() {
    // Crear array de letras con propiedades de animación
    for (let i = 0; i < this.text.length; i++) {
      this.letters.push({
        char: this.text[i],
        index: i,
        delay: i * 100, // Cada letra aparece 100ms después de la anterior
        alpha: 0,
        scale: 0,
        glowIntensity: 0
      });
    }
  }
  
  createWave() {
    // Crear onda expansiva desde el centro del texto
    return {
      x: this.centerX,
      y: this.centerY,
      radius: 0,
      maxRadius: max(this.areaWidth, this.areaHeight) * 0.8,
      alpha: 255,
      thickness: 8,
      speed: 4,
      startTime: millis()
    };
  }

  update() {
    const elapsed = millis() - this.startTime;
    
    // Actualizar letras
    for (let letter of this.letters) {
      const letterElapsed = elapsed - letter.delay;
      
      if (letterElapsed > 0) {
        // Fade in y scale in
        const appearDuration = 400;
        const t = constrain(letterElapsed / appearDuration, 0, 1);
        letter.alpha = t * 255;
        letter.scale = this.easeOutBack(t);
        
        // Glow pulsante continuo después de aparecer
        if (t >= 1) {
          const pulseSpeed = 0.003;
          letter.glowIntensity = 0.5 + 0.5 * sin(millis() * pulseSpeed + letter.index * 0.5);
        }
      }
    }
    
    // Spawn de ondas
    if (elapsed > 500 && millis() - this.lastWaveTime > this.waveInterval) {
      this.waves.push(this.createWave());
      this.lastWaveTime = millis();
    }
    
    // Actualizar ondas
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wave = this.waves[i];
      wave.radius += wave.speed;
      
      // Fade out cuando se acerca al máximo
      const progress = wave.radius / wave.maxRadius;
      wave.alpha = 255 * (1 - progress);
      
      // Remover ondas completadas
      if (wave.radius >= wave.maxRadius) {
        this.waves.splice(i, 1);
      }
    }
  }

  display(ctx = window) {
    ctx.push();
    
    // Fondo semitransparente (solo en modo colaborativo)
    if (!this.isCompetitive) {
      ctx.fill(0, 0, 0, 120);
      ctx.noStroke();
      ctx.rect(0, 0, width, height);
    }
    
    // Dibujar ondas expansivas
    this.drawWaves(ctx);
    
    // Dibujar texto con glow
    this.drawText(ctx);
    
    // Información adicional (solo en modo colaborativo win)
    if (!this.isCompetitive && this.isWin) {
      this.drawWinInfo(ctx);
    }
    
    ctx.pop();
  }
  
  drawWaves(ctx) {
    ctx.noFill();
    ctx.strokeWeight(8);
    
    for (let wave of this.waves) {
      // Color con alpha
      const c = this.waveColor;
      ctx.stroke(c[0], c[1], c[2], wave.alpha);
      
      // Dibujar círculo expansivo
      ctx.ellipse(wave.x, wave.y, wave.radius * 2, wave.radius * 2);
      
      // Glow adicional
      ctx.stroke(c[0], c[1], c[2], wave.alpha * 0.3);
      ctx.strokeWeight(16);
      ctx.ellipse(wave.x, wave.y, wave.radius * 2, wave.radius * 2);
    }
  }
  
  drawText(ctx) {
    const elapsed = millis() - this.startTime;
    
    // Tamaño de fuente según modo
    const baseFontSize = this.isCompetitive ? 
      this.areaHeight * 0.12 : 
      height * 0.15;
    
    ctx.textAlign(CENTER, CENTER);
    ctx.textFont('Arial Black, sans-serif');
    
    // Calcular ancho total del texto para centrado
    ctx.textSize(baseFontSize);
    const totalWidth = ctx.textWidth(this.text);
    const letterSpacing = totalWidth / this.text.length;
    const startX = this.centerX - totalWidth / 2 + letterSpacing / 2;
    
    // Dibujar cada letra
    for (let i = 0; i < this.letters.length; i++) {
      const letter = this.letters[i];
      const x = startX + i * letterSpacing;
      const y = this.centerY;
      
      if (letter.alpha > 0) {
        ctx.push();
        ctx.translate(x, y);
        ctx.scale(letter.scale);
        
        // Glow effect (múltiples capas)
        const glowSize = baseFontSize * (1 + letter.glowIntensity * 0.3);
        const c = this.glowColor;
        
        // Glow exterior (más difuso)
        for (let g = 4; g > 0; g--) {
          const glowAlpha = letter.alpha * letter.glowIntensity * 0.15 * (g / 4);
          ctx.fill(c[0], c[1], c[2], glowAlpha);
          ctx.textSize(baseFontSize + g * 8);
          ctx.text(letter.char, 0, 0);
        }
        
        // Sombra
        ctx.fill(0, 0, 0, letter.alpha * 0.7);
        ctx.textSize(baseFontSize);
        ctx.text(letter.char, 3, 3);
        
        // Letra principal
        ctx.fill(c[0], c[1], c[2], letter.alpha);
        ctx.text(letter.char, 0, 0);
        
        // Highlight interno
        ctx.fill(255, 255, 255, letter.alpha * 0.6);
        ctx.textSize(baseFontSize * 0.9);
        ctx.text(letter.char, 0, -baseFontSize * 0.05);
        
        ctx.pop();
      }
    }
  }
  
  drawWinInfo(ctx) {
    // Trofeo e info (solo en modo colaborativo victoria)
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
  }
  
  easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * pow(x - 1, 3) + c1 * pow(x - 1, 2);
  }

  easeOutElastic(x) {
    const c4 = (2 * Math.PI) / 3;
    return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  }

  isFinished() { 
    return millis() - this.startTime > this.duration; 
  }
}