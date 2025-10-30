class ModeSelectionScreen {
  constructor() {
    this.buttons = [];
    this.title = 'Selecciona el modo de juego';
  }

  setup() {
    const bw = Math.min(260, width * 0.3);
    const bh = Math.min(120, height * 0.15);
    const spacing = Math.min(40, width * 0.05);
    const total = 2 * bw + spacing;
    const startX = width / 2 - total / 2;
    const y = height * 0.52 - bh / 2;

    this.buttons = [
      { label: 'Cooperativo', x: startX, y, w: bw, h: bh, mode: 'cooperative' },
      { label: 'Competitivo', x: startX + bw + spacing, y, w: bw, h: bh, mode: 'competitive' }
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

    // Imagen de copa
    const img = (typeof window !== 'undefined' ? window.trophyImage : null);
    if (img) {
      const imgSize = Math.min(120, height * 0.15);
      ctx.imageMode(CENTER);
      ctx.image(img, width / 2, height * 0.34, imgSize, imgSize);
    }

    // Botones
    ctx.rectMode(CORNER);
    for (const btn of this.buttons) {
      // Sombra ligera
      ctx.fill(0, 0, 0, 120);
      ctx.rect(btn.x + 4, btn.y + 4, btn.w, btn.h, 12);

      // Fondo del botón
      ctx.fill(255, 255, 255, 220);
      ctx.rect(btn.x, btn.y, btn.w, btn.h, 12);

      // Texto del botón
      ctx.fill(20);
      ctx.textAlign(CENTER, CENTER);
      ctx.textSize(Math.min(32, height * 0.045));
      ctx.text(btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
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