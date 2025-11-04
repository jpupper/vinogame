class ModeSelectionScreen {
  constructor() {
    this.buttons = [];
    this.title = 'Selecciona el modo de juego';
    this.hoverRequiredMs = 500; // medio segundo para activar por hover
  }

  setup() {
    const bw = Math.min(300, width * 0.35);
    const bh = Math.min(150, height * 0.18);
    const spacing = Math.min(60, width * 0.07);
    const total = 2 * bw + spacing;
    const startX = width / 2 - total / 2;
    // Botones más abajo para mejor composición visual
    const y = height * 0.70 - bh / 2;

    this.buttons = [
      { 
        label: 'Cooperativo', 
        x: startX, 
        y, 
        w: bw, 
        h: bh, 
        mode: 'cooperative', 
        hoverMs: 0,
        glowPhase: 0,
        color: [100, 200, 255] // Azul cyan
      },
      { 
        label: 'Competitivo', 
        x: startX + bw + spacing, 
        y, 
        w: bw, 
        h: bh, 
        mode: 'competitive', 
        hoverMs: 0,
        glowPhase: Math.PI,
        color: [138, 43, 226] // Violeta vino
      }
    ];
  }

  display(ctx = window) {
    ctx.push();
    // Título y logo ahora se manejan en HTML/CSS
    // Solo dibujamos los botones aquí

    // Botones con glow constante y diseño mejorado
    const t = millis() / 1000.0;
    ctx.rectMode(CORNER);
    
    for (const btn of this.buttons) {
      // Actualizar fase de glow
      btn.glowPhase += 0.025;
      
      const isHover = mouseX >= btn.x && mouseX <= btn.x + btn.w && mouseY >= btn.y && mouseY <= btn.y + btn.h;
      const hoverProgress = constrain(btn.hoverMs / this.hoverRequiredMs, 0, 1);
      
      // Glow pulsante constante (0.6 a 1.0)
      const glowIntensity = 0.6 + 0.4 * sin(btn.glowPhase);
      
      // Escala con hover
      const scale = 1.0 + hoverProgress * 0.12;
      
      // Calcular centro y dimensiones escaladas
      const centerX = btn.x + btn.w / 2;
      const centerY = btn.y + btn.h / 2;
      const scaledW = btn.w * scale;
      const scaledH = btn.h * scale;
      const scaledX = centerX - scaledW / 2;
      const scaledY = centerY - scaledH / 2;
      
      ctx.push();
      
      // === GLOW EXTERIOR CONSTANTE (múltiples capas) ===
      ctx.noStroke();
      const c = btn.color;
      
      // 6 capas de glow para efecto más difuso y brillante
      for (let i = 6; i > 0; i--) {
        const glowSize = i * 18 * glowIntensity;
        const glowAlpha = (40 / i) * glowIntensity * (0.7 + hoverProgress * 0.3);
        ctx.fill(c[0], c[1], c[2], glowAlpha);
        ctx.rect(
          scaledX - glowSize/2, 
          scaledY - glowSize/2, 
          scaledW + glowSize, 
          scaledH + glowSize, 
          22 + i*3
        );
      }
      
      // === SOMBRA PROFUNDA ===
      ctx.fill(0, 0, 0, 180);
      ctx.rect(scaledX + 8, scaledY + 8, scaledW, scaledH, 18);
      
      // === FONDO DEL BOTÓN (gradiente simulado con capas) ===
      // Capa oscura base
      ctx.fill(c[0] * 0.3, c[1] * 0.3, c[2] * 0.3, 250);
      ctx.rect(scaledX, scaledY, scaledW, scaledH, 18);
      
      // Capa media con brillo
      const brightness = 0.6 + glowIntensity * 0.3 + hoverProgress * 0.4;
      ctx.fill(c[0] * brightness, c[1] * brightness, c[2] * brightness, 220);
      ctx.rect(scaledX, scaledY, scaledW, scaledH, 18);
      
      // === HIGHLIGHT SUPERIOR (efecto 3D) ===
      const highlightAlpha = 80 + glowIntensity * 30;
      ctx.fill(255, 255, 255, highlightAlpha);
      ctx.rect(scaledX, scaledY, scaledW, scaledH * 0.35, 18);
      
      // === BORDE BRILLANTE ANIMADO ===
      const borderBrightness = 0.8 + glowIntensity * 0.2;
      ctx.stroke(c[0] * borderBrightness, c[1] * borderBrightness, c[2] * borderBrightness, 255);
      ctx.strokeWeight(4);
      ctx.noFill();
      ctx.rect(scaledX, scaledY, scaledW, scaledH, 18);
      
      // Borde exterior más tenue
      ctx.stroke(c[0], c[1], c[2], 120 * glowIntensity);
      ctx.strokeWeight(2);
      ctx.rect(scaledX - 3, scaledY - 3, scaledW + 6, scaledH + 6, 20);
      ctx.noStroke();
      
      // === PARTÍCULAS FLOTANTES ALREDEDOR DEL BOTÓN ===
      if (!btn.particles) {
        btn.particles = [];
        for (let i = 0; i < 8; i++) {
          btn.particles.push({
            angle: (TWO_PI / 8) * i,
            speed: 0.3 + random(0.2),
            distance: 1.0,
            size: 3 + random(4)
          });
        }
      }
      
      for (let p of btn.particles) {
        p.angle += p.speed * 0.02;
        const px = centerX + cos(p.angle) * (scaledW * 0.6) * p.distance;
        const py = centerY + sin(p.angle) * (scaledH * 0.6) * p.distance;
        const particleAlpha = 150 * glowIntensity;
        
        // Glow de partícula
        ctx.fill(c[0], c[1], c[2], particleAlpha * 0.3);
        ctx.ellipse(px, py, p.size * 3, p.size * 3);
        
        // Partícula sólida
        ctx.fill(255, 255, 255, particleAlpha);
        ctx.ellipse(px, py, p.size, p.size);
      }
      
      // === TEXTO DEL BOTÓN CON GLOW ===
      const textSize = Math.min(38, height * 0.052) * scale;
      ctx.textAlign(CENTER, CENTER);
      ctx.textSize(textSize);
      ctx.textFont('Arial Black, sans-serif');
      
      // Glow del texto (3 capas)
      for (let i = 4; i > 0; i--) {
        const textGlowAlpha = (glowIntensity * 60) / i;
        ctx.fill(c[0], c[1], c[2], textGlowAlpha);
        ctx.text(btn.label, centerX, centerY);
      }
      
      // Sombra del texto
      ctx.fill(0, 0, 0, 200);
      ctx.text(btn.label, centerX + 2, centerY + 2);
      
      // Texto principal
      ctx.fill(255, 255, 255, 255);
      ctx.text(btn.label, centerX, centerY);
      
      // Highlight del texto
      ctx.fill(255, 255, 255, 120);
      ctx.textSize(textSize * 0.95);
      ctx.text(btn.label, centerX, centerY - textSize * 0.08);
      
      ctx.pop();
      
      // === BARRA DE PROGRESO DE HOVER ===
      if (hoverProgress > 0) {
        const barW = scaledW * 0.88;
        const barH = 12;
        const barX = centerX - barW / 2;
        const barY = scaledY - 25;
        
        ctx.noStroke();
        
        // Glow de la barra
        ctx.fill(c[0], c[1], c[2], 80 * glowIntensity);
        ctx.rect(barX - 4, barY - 4, barW + 8, barH + 8, 8);
        
        // Fondo de la barra
        ctx.fill(20, 10, 30, 220);
        ctx.rect(barX, barY, barW, barH, 6);
        
        // Progreso
        const progressW = barW * hoverProgress;
        
        // Glow del progreso
        ctx.fill(c[0], c[1], c[2], 150 * glowIntensity);
        ctx.rect(barX - 2, barY - 2, progressW + 4, barH + 4, 7);
        
        // Barra de progreso
        ctx.fill(c[0], c[1], c[2], 255);
        ctx.rect(barX, barY, progressW, barH, 6);
        
        // Highlight superior de la barra
        ctx.fill(255, 255, 255, 150);
        ctx.rect(barX, barY, progressW, barH * 0.4, 6);
        
        // Punto brillante al final de la barra
        if (progressW > 10) {
          ctx.fill(255, 255, 255, 200);
          ctx.ellipse(barX + progressW, barY + barH/2, 8, 8);
          ctx.fill(c[0], c[1], c[2], 100);
          ctx.ellipse(barX + progressW, barY + barH/2, 16, 16);
        }
      }
    }
    ctx.pop();
  }

  handleClick(mx, my) {
    for (const btn of this.buttons) {
      if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
        return btn.mode;
      }
    }
    return null;
  }

  // Actualizar progreso de hover en botones según puntos activos (LIDAR/mouse/touch)
  // Retorna el modo si se completa el hover, sino null
  updateHoverFromPoints(points) {
    let selected = null;
    for (const btn of this.buttons) {
      // Detectar si algún punto está sobre el botón
      let anyOver = false;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p.x >= btn.x && p.x <= btn.x + btn.w && p.y >= btn.y && p.y <= btn.y + btn.h) {
          anyOver = true;
          break;
        }
      }

      if (anyOver) {
        btn.hoverMs += (typeof deltaTime !== 'undefined' ? deltaTime : 16);
        if (btn.hoverMs >= this.hoverRequiredMs) {
          selected = btn.mode;
          // Resetear ambos botones para evitar dobles triggers
          for (const b of this.buttons) b.hoverMs = 0;
          break;
        }
      } else {
        // Decaimiento suave cuando se sale
        btn.hoverMs = Math.max(0, btn.hoverMs - (typeof deltaTime !== 'undefined' ? deltaTime * 0.6 : 10));
      }
    }
    return selected;
  }
}

class RankingSystem {
  constructor(prefix = 'vinogame_ranking_') {
    this.prefix = prefix;
  }

  _load(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (e) {
      return [];
    }
  }

  _save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  }

  saveCooperative(score) {
    const key = this.prefix + 'cooperative';
    const entries = this._load(key);
    entries.push({ score, date: new Date().toISOString() });
    entries.sort((a, b) => b.score - a.score);
    this._save(key, entries.slice(0, 10));
  }

  saveCompetitive(leftScore, rightScore, winnerSide = null) {
    const key = this.prefix + 'competitive';
    let winner = winnerSide;
    if (!winner) {
      winner = leftScore === rightScore ? 'empate' : (leftScore > rightScore ? 'izquierda' : 'derecha');
    }
    const entries = this._load(key);
    entries.push({ leftScore, rightScore, winner, date: new Date().toISOString() });
    // Ordenamos por el mejor puntaje de la partida
    entries.sort((a, b) => Math.max(b.leftScore, b.rightScore) - Math.max(a.leftScore, a.rightScore));
    this._save(key, entries.slice(0, 10));
  }

  getCooperative() {
    return this._load(this.prefix + 'cooperative');
  }

  getCompetitive() {
    return this._load(this.prefix + 'competitive');
  }
}