// Animación unificada de fin de juego (victoria/derrota)
// Renderiza los círculos explosivos con un shader GPU dedicado (celebration.frag)
// y presenta tipografía de lujo unificada ("¡FELICITACIONES!" / "¡SEGUÍ PARTICIPANDO!")
// con kerning proporcional, soporte inteligente de líneas y medallas ornamentales.
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

    // Colores según tipo (Champagne Gold vs Ruby Wine)
    this.isWin = type === 'win';
    this.glowColor = this.isWin ? [255, 218, 105] : [255, 72, 92];
    this.secondaryColor = this.isWin ? [255, 165, 40] : [180, 20, 48];
    this.waveColor = this.isWin ? [255, 215, 90] : [255, 45, 70];

    // Texto a mostrar (usar textos personalizados si están disponibles)
    const defaultWinText = '¡FELICITACIONES!';
    const defaultLoseText = '¡SEGUÍ PARTICIPANDO!';
    const customWinText = (typeof window !== 'undefined' && window.winText) ? window.winText : defaultWinText;
    const customLoseText = (typeof window !== 'undefined' && window.loseText) ? window.loseText : defaultLoseText;
    this.rawText = (this.isWin ? customWinText : customLoseText).trim();
    this.text = this.rawText.toUpperCase();

    // Dividir en líneas inteligentes si el texto tiene varias palabras (ej. "SEGUI PARTICIPANDO")
    this.lines = this.computeLines(this.text);

    // Animación de letras por línea
    this.lineLetters = [];
    this.initLetters();

    // Ondas complementarias y chispas flotantes de celebración
    this.waves = [];
    this.sparks = [];
    this.lastWaveTime = this.startTime;
    this.waveInterval = 520;
    this.initSparks();
  }

  // Buffer WebGL compartido para el shader de círculos explosivos
  static getShaderBuffer(w, h) {
    const targetW = Math.max(256, Math.min(960, Math.floor(w * 0.65)));
    const targetH = Math.max(256, Math.min(960, Math.floor(h * 0.65)));
    if (
      !EndAnimation._shaderBuffer ||
      Math.abs(EndAnimation._shaderBuffer.width - targetW) > 32 ||
      Math.abs(EndAnimation._shaderBuffer.height - targetH) > 32
    ) {
      if (EndAnimation._shaderBuffer && typeof EndAnimation._shaderBuffer.remove === 'function') {
        try { EndAnimation._shaderBuffer.remove(); } catch (e) {}
      }
      EndAnimation._shaderBuffer = createGraphics(targetW, targetH, WEBGL);
      EndAnimation._shaderBuffer.noStroke();
    }
    return EndAnimation._shaderBuffer;
  }

  computeLines(str) {
    const words = str.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && (str.length > 12 || this.isCompetitive)) {
      const mid = Math.ceil(words.length / 2);
      return [
        words.slice(0, mid).join(' '),
        words.slice(mid).join(' ')
      ];
    }
    return [str];
  }

  initLetters() {
    this.lineLetters = [];
    let globalIdx = 0;
    for (let l = 0; l < this.lines.length; l++) {
      const lineStr = this.lines[l];
      const arr = [];
      for (let i = 0; i < lineStr.length; i++) {
        arr.push({
          char: lineStr[i],
          index: globalIdx,
          lineIndex: l,
          charIndex: i,
          delay: globalIdx * 45,
          alpha: 0,
          scale: 0,
          glowIntensity: 0
        });
        globalIdx++;
      }
      this.lineLetters.push(arr);
    }
  }

  initSparks() {
    const count = this.isWin ? 36 : 22;
    this.sparks = [];
    for (let i = 0; i < count; i++) {
      const angle = (TWO_PI / count) * i + random(-0.2, 0.2);
      this.sparks.push({
        angle: angle,
        radius: random(20, this.areaWidth * 0.12),
        speed: random(1.8, 5.2) * (this.isWin ? 1.2 : 0.85),
        orbitSpeed: random(-0.025, 0.025),
        size: random(4, 11),
        alpha: random(160, 255),
        maxRadius: max(this.areaWidth, this.areaHeight) * random(0.35, 0.62)
      });
    }
  }

  createWave() {
    return {
      x: this.centerX,
      y: this.centerY,
      radius: 12,
      maxRadius: max(this.areaWidth, this.areaHeight) * 0.72,
      alpha: 245,
      thickness: this.isWin ? 6 : 5,
      speed: this.isWin ? 6.5 : 4.8,
      startTime: millis()
    };
  }

  update() {
    const elapsed = millis() - this.startTime;

    // Actualizar área en caso de resize
    if (this.isCompetitive) {
      this.areaWidth = width / 2;
      this.areaHeight = height;
      this.x = this.side === 'left' ? 0 : width / 2;
      this.y = 0;
    } else {
      this.areaWidth = width;
      this.areaHeight = height;
      this.x = 0;
      this.y = 0;
    }
    this.centerX = this.x + this.areaWidth / 2;
    this.centerY = this.y + this.areaHeight / 2;

    // Actualizar letras
    for (let line of this.lineLetters) {
      for (let letter of line) {
        const letterElapsed = elapsed - letter.delay;
        if (letterElapsed > 0) {
          const appearDuration = 380;
          const t = constrain(letterElapsed / appearDuration, 0, 1);
          letter.alpha = t * 255;
          letter.scale = this.easeOutBack(t);
          if (t >= 1) {
            const pulseSpeed = 0.004;
            letter.glowIntensity = 0.55 + 0.45 * sin(millis() * pulseSpeed + letter.index * 0.45);
          }
        }
      }
    }

    // Spawn de ondas + alimentar también el shader de agua de fondo
    if (elapsed > 150 && millis() - this.lastWaveTime > this.waveInterval) {
      this.waves.push(this.createWave());
      this.lastWaveTime = millis();
      if (typeof createWave === 'function') {
        createWave(this.centerX + random(-60, 60), this.centerY + random(-45, 45));
      }
    }

    // Actualizar ondas
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wave = this.waves[i];
      wave.radius += wave.speed;
      const progress = wave.radius / wave.maxRadius;
      wave.alpha = 255 * Math.pow(1 - constrain(progress, 0, 1), 1.4);
      if (wave.radius >= wave.maxRadius) {
        this.waves.splice(i, 1);
      }
    }

    // Actualizar chispas orbitales
    for (let s of this.sparks) {
      s.radius += s.speed;
      s.angle += s.orbitSpeed;
      if (s.radius > s.maxRadius) {
        s.radius = random(15, 55);
      }
    }
  }

  display(ctx = window) {
    ctx.push();

    // Fondo atmosférico (solo en modo colaborativo)
    if (!this.isCompetitive) {
      ctx.fill(10, 2, 8, 130);
      ctx.noStroke();
      ctx.rectMode(CORNER);
      ctx.rect(0, 0, width, height);
    }

    // 1. Renderizar círculos explosivos mediante el shader GPU dedicado (celebration.frag)
    this.drawShaderCelebration(ctx);

    // 2. Dibujar anillos geométricos de refuerzo y chispas orbitales
    this.drawWaves(ctx);

    // 3. Dibujar tarjeta glassmórfica, emblema superior y texto con kerning proporcional
    this.drawText(ctx);

    // 4. Información adicional (en modo colaborativo)
    if (!this.isCompetitive && this.isWin) {
      this.drawWinInfo(ctx);
    }

    ctx.pop();
  }

  drawShaderCelebration(ctx) {
    const celebShader = (typeof window !== 'undefined' && window.celebrationShader)
      ? window.celebrationShader
      : (typeof celebrationShader !== 'undefined' ? celebrationShader : null);

    if (!celebShader) return;

    try {
      const buf = EndAnimation.getShaderBuffer(this.areaWidth, this.areaHeight);
      const elapsedSec = (millis() - this.startTime) / 1000.0;
      const progress = constrain(elapsedSec / (this.duration / 1000.0), 0.0, 1.0);

      buf.clear();
      buf.shader(celebShader);
      celebShader.setUniform('u_resolution', [buf.width, buf.height]);
      celebShader.setUniform('u_time', millis() / 1000.0);
      celebShader.setUniform('u_progress', progress);
      celebShader.setUniform('u_isWin', this.isWin ? 1.0 : 0.0);
      celebShader.setUniform('u_center', [0.5, 0.5]);
      buf.rect(-buf.width / 2, -buf.height / 2, buf.width, buf.height);

      ctx.push();
      ctx.imageMode(CORNER);
      if (typeof ADD !== 'undefined') {
        ctx.blendMode(ADD);
      }
      ctx.image(buf, this.x, this.y, this.areaWidth, this.areaHeight);
      ctx.pop();
    } catch (e) {
      // Fallback silencioso a drawWaves si WebGL falla
    }
  }

  drawWaves(ctx) {
    ctx.push();
    ctx.noFill();

    for (let i = 0; i < this.waves.length; i++) {
      const wave = this.waves[i];
      const c = this.waveColor;
      const sc = this.secondaryColor;

      // Halo exterior difuso
      ctx.stroke(sc[0], sc[1], sc[2], wave.alpha * 0.28);
      ctx.strokeWeight(wave.thickness * 3.2);
      ctx.ellipse(wave.x, wave.y, wave.radius * 2, wave.radius * 2);

      // Anillo principal brillante
      ctx.stroke(c[0], c[1], c[2], wave.alpha * 0.85);
      ctx.strokeWeight(wave.thickness);
      ctx.ellipse(wave.x, wave.y, wave.radius * 2, wave.radius * 2);

      // Filamento interior blanco/champagne
      ctx.stroke(255, 250, 235, wave.alpha * 0.65);
      ctx.strokeWeight(1.8);
      ctx.ellipse(wave.x, wave.y, wave.radius * 1.92, wave.radius * 1.92);
    }

    // Chispas orbitales
    ctx.noStroke();
    for (let s of this.sparks) {
      const sx = this.centerX + cos(s.angle) * s.radius;
      const sy = this.centerY + sin(s.angle) * s.radius;
      const fade = 1.0 - constrain(s.radius / s.maxRadius, 0, 1);
      const a = s.alpha * fade;
      ctx.fill(this.glowColor[0], this.glowColor[1], this.glowColor[2], a * 0.35);
      ctx.ellipse(sx, sy, s.size * 2.6, s.size * 2.6);
      ctx.fill(255, 250, 235, a);
      ctx.ellipse(sx, sy, s.size, s.size);
    }

    ctx.pop();
  }

  drawText(ctx) {
    const elapsed = millis() - this.startTime;
    const introT = constrain(elapsed / 500, 0, 1);
    const cardScale = this.easeOutBack(introT);

    // Tamaño de fuente base: garantizamos un piso elegante incluso si panel-config tiene 0.043
    const rawCustomSize = (typeof window !== 'undefined' && typeof window.winLoseTextSize !== 'undefined')
      ? Number(window.winLoseTextSize)
      : 0.11;
    const effectiveRatio = Math.max(0.085, rawCustomSize);

    let fontSize = (this.isCompetitive ? this.areaHeight : height) * effectiveRatio;

    ctx.push();
    ctx.textFont('Cinzel, Georgia, serif');
    ctx.textStyle(BOLD);
    ctx.textSize(fontSize);

    // Ajustar automáticamente el tamaño para que nunca se salga del área disponible
    const maxLineWidth = this.areaWidth * (this.isCompetitive ? 0.84 : 0.80);
    let longestMeasured = 1;
    for (let lineStr of this.lines) {
      const w = ctx.textWidth(lineStr) * 1.06; // margen por tracking
      if (w > longestMeasured) longestMeasured = w;
    }
    if (longestMeasured > maxLineWidth) {
      fontSize *= (maxLineWidth / longestMeasured);
      ctx.textSize(fontSize);
    }

    const lineHeight = fontSize * 1.22;
    const totalTextH = this.lines.length * lineHeight;

    // Dimensiones del cartel de lujo detrás del texto
    const badgeW = Math.min(this.areaWidth * 0.90, Math.max(longestMeasured * (fontSize / ((this.isCompetitive ? this.areaHeight : height) * effectiveRatio)) + fontSize * 1.6, this.areaWidth * 0.58));
    const badgeH = totalTextH + fontSize * 1.55;

    // Dibujar placa vítrea de fondo con marco dorado o rubí
    ctx.push();
    ctx.translate(this.centerX, this.centerY);
    ctx.scale(Math.max(0.01, cardScale));
    ctx.rectMode(CENTER);

    // Sombra exterior profunda
    ctx.noStroke();
    ctx.fill(0, 0, 0, 185 * introT);
    ctx.rect(0, 10, badgeW, badgeH, 26);

    // Fondo borgoña oscuro translúcido
    if (this.isWin) {
      ctx.fill(26, 8, 18, 215 * introT);
    } else {
      ctx.fill(22, 5, 12, 220 * introT);
    }
    ctx.stroke(this.glowColor[0], this.glowColor[1], this.glowColor[2], 210 * introT);
    ctx.strokeWeight(3);
    ctx.rect(0, 0, badgeW, badgeH, 24);

    // Marco interior fino estilo etiqueta de gran reserva
    ctx.noFill();
    ctx.stroke(this.glowColor[0], this.glowColor[1], this.glowColor[2], 95 * introT);
    ctx.strokeWeight(1.2);
    ctx.rect(0, 0, badgeW - 18, badgeH - 18, 18);

    // Ornamento superior (corona / diamante) y subtítulo de categoría
    const headerY = -badgeH / 2 + fontSize * 0.36;
    ctx.noStroke();
    ctx.fill(this.glowColor[0], this.glowColor[1], this.glowColor[2], 235 * introT);
    ctx.textFont('Montserrat, sans-serif');
    ctx.textStyle(BOLD);
    ctx.textSize(Math.max(13, fontSize * 0.24));
    ctx.textAlign(CENTER, CENTER);
    const subtitle = this.isWin ? '✦  GRAN RESERVA · VICTORIA  ✦' : '✦  DELI & WINE · FIN DEL JUEGO  ✦';
    ctx.text(subtitle, 0, headerY);

    // Línea divisoria ornamental inferior
    const footerLineY = badgeH / 2 - fontSize * 0.32;
    ctx.stroke(this.glowColor[0], this.glowColor[1], this.glowColor[2], 140 * introT);
    ctx.strokeWeight(1.5);
    ctx.line(-badgeW * 0.28, footerLineY, badgeW * 0.28, footerLineY);
    ctx.noStroke();
    ctx.fill(this.glowColor[0], this.glowColor[1], this.glowColor[2], 220 * introT);
    ctx.ellipse(0, footerLineY, 7, 7);

    ctx.pop();

    // Dibujar cada línea y letra con kerning proporcional real
    ctx.textFont('Cinzel, Georgia, serif');
    ctx.textStyle(BOLD);
    ctx.textSize(fontSize);
    ctx.textAlign(CENTER, CENTER);

    const tracking = fontSize * 0.04;
    const firstLineY = this.centerY - ((this.lines.length - 1) * lineHeight) / 2 + fontSize * 0.08;

    for (let l = 0; l < this.lines.length; l++) {
      const lineStr = this.lines[l];
      const letters = this.lineLetters[l];
      const lineY = firstLineY + l * lineHeight;

      // Medir ancho proporcional real con tracking
      const charWidths = [];
      let lineTotalW = 0;
      for (let i = 0; i < lineStr.length; i++) {
        const cw = Math.max(fontSize * 0.28, ctx.textWidth(lineStr[i])) + tracking;
        charWidths.push(cw);
        lineTotalW += cw;
      }

      let cursorX = this.centerX - lineTotalW / 2;

      for (let i = 0; i < letters.length; i++) {
        const letter = letters[i];
        const cw = charWidths[i];
        const charCenterX = cursorX + cw / 2;
        cursorX += cw;

        if (letter.alpha > 0) {
          ctx.push();
          const floatY = sin(millis() * 0.005 + letter.index * 0.4) * (fontSize * 0.035);
          ctx.translate(charCenterX, lineY + floatY);
          ctx.scale(letter.scale);

          const c = this.glowColor;
          const sc = this.secondaryColor;
          ctx.textSize(fontSize);

          // Sombra profunda 3D
          ctx.noStroke();
          ctx.fill(0, 0, 0, letter.alpha * 0.75);
          const shadowOff = Math.max(3, fontSize * 0.06);
          ctx.text(letter.char, shadowOff, shadowOff);

          // Resplandor exterior pulsante
          const glowAlpha = letter.alpha * (0.28 + 0.25 * letter.glowIntensity);
          ctx.fill(sc[0], sc[1], sc[2], glowAlpha);
          ctx.text(letter.char, -2, 0);
          ctx.text(letter.char, 2, 0);
          ctx.text(letter.char, 0, -2);
          ctx.text(letter.char, 0, 2);

          // Letra principal con contorno oscuro nítido y relleno champagne/rubí
          ctx.strokeWeight(Math.max(2, fontSize * 0.055));
          ctx.stroke(20, 4, 12, letter.alpha * 0.92);
          ctx.fill(c[0], c[1], c[2], letter.alpha);
          ctx.text(letter.char, 0, 0);

          // Brillo especular superior blanco/crema
          ctx.noStroke();
          ctx.fill(255, 252, 240, letter.alpha * (0.45 + 0.3 * letter.glowIntensity));
          ctx.text(letter.char, 0, -fontSize * 0.02);

          ctx.pop();
        }
      }
    }

    ctx.pop();
  }

  drawWinInfo(ctx) {
    // Trofeo e info (en modo colaborativo victoria)
    if (typeof window !== 'undefined' && window.trophyImage) {
      if (!this.scaledTrophyImage) {
        const img = window.trophyImage;
        const aspect = img.height > 0 && img.width > 0 ? (img.height / img.width) : 1;
        const baseSize = min(width, height) * 0.16;
        const w = baseSize;
        const h = w * aspect;
        this.scaledTrophyImage = createGraphics(w, h);
        this.scaledTrophyImage.image(img, 0, 0, w, h);
      }
      const t = constrain((millis() - this.startTime) / this.duration, 0, 1);
      const intro = this.easeOutElastic(constrain((t - 0.05) * 3, 0, 1));
      ctx.push();
      ctx.imageMode(CENTER);
      ctx.noStroke();
      ctx.fill(0, 0, 0, 110 * intro);
      ctx.ellipse(width / 2 + 5, height * 0.22 + 5, this.scaledTrophyImage.width * intro * 0.9, this.scaledTrophyImage.height * intro * 0.9);
      ctx.translate(width / 2, height * 0.22);
      ctx.scale(intro);
      ctx.image(this.scaledTrophyImage, 0, 0);
      ctx.pop();
    }

    const scoreSize = (typeof window !== 'undefined' && typeof window.scoreTextSize !== 'undefined')
      ? window.scoreTextSize : 40;
    const comboSize = (typeof window !== 'undefined' && typeof window.comboTextSize !== 'undefined')
      ? window.comboTextSize : 30;

    const alpha = constrain(map(millis() - this.startTime, this.duration * 0.25, this.duration * 0.45, 0, 255), 0, 255);
    ctx.push();
    ctx.textAlign(CENTER, CENTER);
    ctx.textFont('Cinzel, Georgia, serif');
    ctx.textStyle(BOLD);
    ctx.textSize(scoreSize);
    ctx.fill(0, 0, 0, alpha * 0.8);
    ctx.text(`PUNTUACIÓN FINAL: ${Math.floor(scoreSystem.score)}`, width / 2 + 3, height * 0.77 + 3);
    ctx.fill(255, 250, 240, alpha);
    ctx.text(`PUNTUACIÓN FINAL: ${Math.floor(scoreSystem.score)}`, width / 2, height * 0.77);

    ctx.textFont('Montserrat, sans-serif');
    ctx.textSize(comboSize);
    ctx.fill(255, 215, 106, alpha);
    ctx.text(`COMBO MÁS ALTO: x${scoreSystem.highestCombo}`, width / 2, height * 0.77 + 52);

    if (millis() - this.startTime > this.duration * 0.65) {
      const pulseAlpha = 135 + 120 * sin(frameCount * 0.1);
      ctx.textSize(22);
      ctx.fill(255, 240, 220, pulseAlpha);
      ctx.text('TOCA LA PANTALLA PARA REINICIAR', width / 2, height * 0.89);
    }
    ctx.pop();
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
