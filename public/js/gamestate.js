class ModeSelectionScreen {
  constructor() {
    this.buttons = [];
    this.title = 'Selecciona el modo de juego';
    this.hoverRequiredMs = 500; // medio segundo para activar por hover
  }

  setup() {
    const bw = Math.min(260, width * 0.3);
    const bh = Math.min(120, height * 0.15);
    const spacing = Math.min(40, width * 0.05);
    const total = 2 * bw + spacing;
    const startX = width / 2 - total / 2;
    // Botones más abajo para mejor composición visual
    const y = height * 0.70 - bh / 2;

    this.buttons = [
      { label: 'Cooperativo', x: startX, y, w: bw, h: bh, mode: 'cooperative', hoverMs: 0 },
      { label: 'Competitivo', x: startX + bw + spacing, y, w: bw, h: bh, mode: 'competitive', hoverMs: 0 }
    ];
  }

  display(ctx = window) {
    ctx.push();
    // Título
    ctx.textAlign(CENTER, TOP);
    ctx.noStroke();
    ctx.fill(255);
    ctx.textSize(Math.min(48, height * 0.06));
    ctx.text(this.title, width / 2, height * 0.18);

    // Imagen de copa (más grande y con animación sutil)
    const img = (typeof window !== 'undefined' ? window.trophyImage : null);
    if (img) {
      // Tamaño mayor y oscilación vertical suave
      const t = millis() / 1000.0;
      const imgSize = Math.min(220, height * 0.28);
      const bob = sin(t * 1.6) * Math.min(8, height * 0.01);
      const cx = width / 2;
      const cy = height * 0.34 + bob;
      // Brillo suave detrás de la copa
      //ctx.noStroke();
     // ctx.fill(170, 110, 255, 55);
    //  ctx.ellipse(cx, cy, imgSize * 1.5 + sin(t * 1.2) * 10, imgSize * 1.2 + sin(t * 1.2) * 8);
      // Copa
      ctx.imageMode(CENTER);
      ctx.image(img, cx, cy, imgSize, imgSize);
    }

    // Botones
    ctx.rectMode(CORNER);
    for (const btn of this.buttons) {
      const isHover = mouseX >= btn.x && mouseX <= btn.x + btn.w && mouseY >= btn.y && mouseY <= btn.y + btn.h;

      // Sombra ligera
      ctx.noStroke();
      ctx.fill(0, 0, 0, 120);
      ctx.rect(btn.x + 5, btn.y + 5, btn.w, btn.h, 14);

      // Fondo del botón con paleta violeta
      const base = isHover ? [170, 110, 255, 235] : [150, 90, 220, 225];
      ctx.fill(base[0], base[1], base[2], base[3]);
      ctx.rect(btn.x, btn.y, btn.w, btn.h, 14);

      // Highlight superior suave para efecto de profundidad
      ctx.fill(255, 255, 255, isHover ? 40 : 28);
      ctx.rect(btn.x, btn.y, btn.w, btn.h * 0.45, 14);

      // Borde
      ctx.stroke(isHover ? 255 : 230, isHover ? 210 : 200, 255, 180);
      ctx.strokeWeight(2);
      ctx.noFill();
      ctx.rect(btn.x, btn.y, btn.w, btn.h, 14);
      ctx.noStroke();

      // Texto del botón
      ctx.fill(255);
      ctx.textAlign(CENTER, CENTER);
      ctx.textSize(Math.min(32, height * 0.045));
      ctx.text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);

      // Barra de progreso de hover (arriba del botón)
      if (btn.hoverMs && btn.hoverMs > 0) {
        const progress = constrain(btn.hoverMs / this.hoverRequiredMs, 0, 1);
        const barW = btn.w * 0.8;
        const barH = 8;
        const barX = btn.x + (btn.w - barW) / 2;
        const barY = btn.y - 14;
        ctx.noStroke();
        // Fondo
        ctx.fill(40, 20, 60, 180);
        ctx.rect(barX, barY, barW, barH, 4);
        // Progreso (violeta)
        ctx.fill(160, 120, 255, 220);
        ctx.rect(barX, barY, barW * progress, barH, 4);
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