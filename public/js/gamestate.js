class ModeSelectionScreen {
  constructor() {
    this.buttons = [];
    this.title = '¡COMPITE CON ALGUIEN PARA VER QUIÉN HACE MÁS PUNTOS!';
    this.hoverRequiredMs = 500; // medio segundo para activar por hover
  }

  setup() {
    this.updateButtonLayout();
  }

  updateButtonLayout() {
    const bw = Math.min(360, width * 0.36);
    const bh = Math.min(140, height * 0.165);
    const spacing = Math.min(64, width * 0.065);
    const y = height * 0.75 - bh / 2;

    // Determinar qué botones mostrar
    const showCoop = typeof window !== 'undefined' && typeof window.showCooperativeButton !== 'undefined'
      ? window.showCooperativeButton : true;
    const showComp = typeof window !== 'undefined' && typeof window.showCompetitiveButton !== 'undefined'
      ? window.showCompetitiveButton : true;

    const visibleButtons = [];

    if (showCoop) {
      visibleButtons.push({
        label: 'COOPERATIVO',
        subtitle: 'JUEGO EN EQUIPO',
        mode: 'cooperative',
        color: [218, 175, 85],       // Oro suave
        bgColor: [38, 12, 24],       // Borgoña profundo
        accentColor: [255, 232, 165],
        glowPhase: 0
      });
    }

    if (showComp) {
      visibleButtons.push({
        label: 'COMPETIR',
        subtitle: 'DUELO DE VENDIMIA · 1 VS 1',
        mode: 'competitive',
        color: [255, 210, 95],       // Champagne Gold brillante
        bgColor: [68, 10, 28],       // Vino Reserva intenso
        accentColor: [255, 242, 195],
        glowPhase: Math.PI
      });
    }

    let startX;
    if (visibleButtons.length === 1) {
      startX = width / 2 - bw / 2;
    } else {
      const total = 2 * bw + spacing;
      startX = width / 2 - total / 2;
    }

    this.buttons = [];
    for (let i = 0; i < visibleButtons.length; i++) {
      const btn = visibleButtons[i];
      const x = visibleButtons.length === 1 ? startX : startX + i * (bw + spacing);

      this.buttons.push({
        label: btn.label,
        subtitle: btn.subtitle,
        x: x,
        y: y,
        w: bw,
        h: bh,
        mode: btn.mode,
        hoverMs: 0,
        glowPhase: btn.glowPhase,
        color: btn.color,
        bgColor: btn.bgColor,
        accentColor: btn.accentColor
      });
    }
  }

  updateButtonVisibility(showCoop, showComp) {
    this.updateButtonLayout();
  }

  display(ctx = window) {
    ctx.push();
    const t = millis() / 1000.0;
    ctx.rectMode(CORNER);

    for (const btn of this.buttons) {
      btn.glowPhase += 0.03;

      const hoverProgress = constrain(btn.hoverMs / this.hoverRequiredMs, 0, 1);
      const glowIntensity = 0.65 + 0.35 * sin(btn.glowPhase);

      let scale = 1.0 + hoverProgress * 0.12;
      if (btn.mode === 'competitive') {
        const pulseScale = 1.0 + 0.045 * sin(t * 2.8);
        scale *= pulseScale;
      }

      const centerX = btn.x + btn.w / 2;
      const centerY = btn.y + btn.h / 2;
      const scaledW = btn.w * scale;
      const scaledH = btn.h * scale;
      const scaledX = centerX - scaledW / 2;
      const scaledY = centerY - scaledH / 2;
      const cornerRadius = 22;

      ctx.push();

      const c = btn.color;
      const bg = btn.bgColor;
      const acc = btn.accentColor;

      // === HALO EXTERIOR DORADO / VINO ===
      ctx.noStroke();
      for (let i = 6; i > 0; i--) {
        const glowSize = i * 16 * glowIntensity;
        const glowAlpha = (38 / i) * glowIntensity * (0.75 + hoverProgress * 0.35);
        ctx.fill(c[0], c[1], c[2], glowAlpha);
        ctx.rect(
          scaledX - glowSize / 2,
          scaledY - glowSize / 2,
          scaledW + glowSize,
          scaledH + glowSize,
          cornerRadius + i * 3
        );
      }

      // === SOMBRA PROFUNDA ===
      ctx.fill(0, 0, 0, 195);
      ctx.rect(scaledX + 6, scaledY + 10, scaledW, scaledH, cornerRadius);

      // === CUERPO DEL BOTÓN (GRAN RESERVA BORGOÑA + REFLEJO) ===
      ctx.fill(bg[0], bg[1], bg[2], 242);
      ctx.rect(scaledX, scaledY, scaledW, scaledH, cornerRadius);

      // Brillo cálido interior
      const innerGlowAlpha = 45 + glowIntensity * 35 + hoverProgress * 60;
      ctx.fill(c[0], c[1] * 0.6, c[2] * 0.4, innerGlowAlpha);
      ctx.rect(scaledX, scaledY, scaledW, scaledH, cornerRadius);

      // Highlight superior cristalino
      ctx.fill(255, 245, 220, 26 + glowIntensity * 18);
      ctx.rect(scaledX + 4, scaledY + 4, scaledW - 8, scaledH * 0.42, cornerRadius - 4);

      // === DOBLE MARCO DORADO ===
      ctx.noFill();
      ctx.stroke(c[0], c[1], c[2], 235);
      ctx.strokeWeight(3.2);
      ctx.rect(scaledX, scaledY, scaledW, scaledH, cornerRadius);

      ctx.stroke(acc[0], acc[1], acc[2], 115 + hoverProgress * 100);
      ctx.strokeWeight(1.2);
      ctx.rect(scaledX + 8, scaledY + 8, scaledW - 16, scaledH - 16, cornerRadius - 6);

      // Diamantes ornamentales laterales
      ctx.noStroke();
      ctx.fill(acc[0], acc[1], acc[2], 210);
      ctx.ellipse(scaledX + 22, centerY, 6, 6);
      ctx.ellipse(scaledX + scaledW - 22, centerY, 6, 6);

      // === PARTÍCULAS DE CHAMPAGNE FLOTANTES ===
      if (!btn.particles) {
        btn.particles = [];
        for (let i = 0; i < 10; i++) {
          btn.particles.push({
            angle: (TWO_PI / 10) * i,
            speed: 0.25 + random(0.2),
            distance: 0.92 + random(0.18),
            size: 3 + random(3.5)
          });
        }
      }

      for (let p of btn.particles) {
        p.angle += p.speed * 0.02;
        const px = centerX + cos(p.angle) * (scaledW * 0.54) * p.distance;
        const py = centerY + sin(p.angle) * (scaledH * 0.56) * p.distance;
        const particleAlpha = 165 * glowIntensity;

        ctx.fill(c[0], c[1], c[2], particleAlpha * 0.35);
        ctx.ellipse(px, py, p.size * 2.8, p.size * 2.8);

        ctx.fill(255, 250, 230, particleAlpha);
        ctx.ellipse(px, py, p.size, p.size);
      }

      // === TIPOGRAFÍA UNIFICADA DEL BOTÓN ===
      const mainTextSize = Math.min(36, height * 0.044) * scale;
      const subTextSize = Math.max(11, mainTextSize * 0.33);

      ctx.textAlign(CENTER, CENTER);

      // Subtítulo superior
      ctx.textFont('Montserrat, sans-serif');
      ctx.textStyle(BOLD);
      ctx.textSize(subTextSize);
      ctx.fill(c[0], c[1], c[2], 220);
      ctx.text(`✦  ${btn.subtitle}  ✦`, centerX, centerY - mainTextSize * 0.62);

      // Etiqueta principal ("COMPETIR" / "COOPERATIVO")
      ctx.textFont('Cinzel, Georgia, serif');
      ctx.textStyle(BOLD);
      ctx.textSize(mainTextSize);

      // Sombra del texto
      ctx.fill(0, 0, 0, 210);
      ctx.text(btn.label, centerX + 2, centerY + mainTextSize * 0.14 + 3);

      // Resplandor dorado del texto
      ctx.fill(c[0], c[1], c[2], 95 * glowIntensity);
      ctx.text(btn.label, centerX, centerY + mainTextSize * 0.14);

      // Texto principal blanco-champagne
      ctx.fill(255, 250, 238, 255);
      ctx.text(btn.label, centerX, centerY + mainTextSize * 0.12);

      ctx.pop();

      // === BARRA DE PROGRESO DE HOVER ===
      if (hoverProgress > 0) {
        const barW = scaledW * 0.84;
        const barH = 12;
        const barX = centerX - barW / 2;
        const barY = scaledY - 24;

        ctx.noStroke();
        ctx.fill(c[0], c[1], c[2], 90 * glowIntensity);
        ctx.rect(barX - 4, barY - 4, barW + 8, barH + 8, 8);

        ctx.fill(22, 5, 14, 230);
        ctx.rect(barX, barY, barW, barH, 6);

        const progressW = barW * hoverProgress;
        ctx.fill(c[0], c[1], c[2], 255);
        ctx.rect(barX, barY, progressW, barH, 6);

        ctx.fill(255, 255, 255, 160);
        ctx.rect(barX, barY, progressW, barH * 0.4, 6);
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

  updateHoverFromPoints(points) {
    let selected = null;
    for (const btn of this.buttons) {
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
          for (const b of this.buttons) b.hoverMs = 0;
          break;
        }
      } else {
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
