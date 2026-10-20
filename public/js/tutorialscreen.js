// Pantalla tutorial que se muestra antes de iniciar el modo competitivo
// Muestra los objetos reales del juego (copas, botellas, uvas vs bichos) pasando
// con sus auras doradas y rojas e interactuando también con el shader de agua de fondo.
class TutorialScreen {
  constructor() {
    this.duration = 5500; // 5.5 segundos
    this.startTime = null;
    this.active = false;
    this.glowPhase = 0;

    // Streams de objetos pasando por las zonas de ejemplo (izquierda y derecha)
    this.passingStreams = {
      left: { good: [], bad: [] },
      right: { good: [], bad: [] }
    };
  }

  start() {
    this.active = true;
    this.startTime = millis();
    this.glowPhase = 0;
    this.initStreams();
  }

  initStreams() {
    const sides = ['left', 'right'];
    const itemCount = 3;
    for (const side of sides) {
      this.passingStreams[side].good = [];
      this.passingStreams[side].bad = [];
      for (let i = 0; i < itemCount; i++) {
        this.passingStreams[side].good.push({
          progress: i / itemCount,
          speed: 0.0055,
          imgIndex: i,
          wobbleSeed: i * 2.1 + (side === 'left' ? 0 : 1.3),
          rotation: (i - 1) * 0.08
        });
        this.passingStreams[side].bad.push({
          progress: (i / itemCount + 0.16) % 1.0,
          speed: 0.0062,
          imgIndex: i,
          wobbleSeed: i * 1.9 + (side === 'left' ? 0.7 : 2.4),
          rotation: (i - 1) * -0.1
        });
      }
    }
  }

  isFinished() {
    if (!this.active || this.startTime === null) return false;
    return (millis() - this.startTime) >= this.duration;
  }

  // Expone las posiciones actuales de los objetos pasando en el tutorial
  // para que background.js también los inyecte al shader de agua (agua-nikos)
  getActiveShowcaseItems() {
    const result = { good: [], bad: [] };
    if (!this.active) return result;

    const sides = ['left', 'right'];
    for (const side of sides) {
      const centerX = side === 'left' ? width * 0.25 : width * 0.75;
      const goodY = height * 0.34;
      const badY = height * 0.62;
      const spanX = Math.min(340, width * 0.32);

      const goodList = this.passingStreams[side]?.good || [];
      for (let i = 0; i < goodList.length; i++) {
        const item = goodList[i];
        const x = centerX + (item.progress - 0.5) * spanX;
        const y = goodY + Math.sin(this.glowPhase * 2.0 + item.wobbleSeed) * 14;
        result.good.push({
          id: `tut_good_${side}_${i}`,
          x,
          y
        });
      }

      const badList = this.passingStreams[side]?.bad || [];
      for (let i = 0; i < badList.length; i++) {
        const item = badList[i];
        const x = centerX + (item.progress - 0.5) * spanX;
        const y = badY + Math.cos(this.glowPhase * 2.3 + item.wobbleSeed) * 14;
        result.bad.push({
          id: `tut_bad_${side}_${i}`,
          x,
          y
        });
      }
    }
    return result;
  }

  display(ctx = window) {
    if (!this.active) return;

    ctx.push();
    ctx.rectMode(CORNER);

    // Velo oscuro translúcido que deja ver el agua refractada del fondo
    ctx.noStroke();
    ctx.fill(10, 2, 8, 145);
    ctx.rect(0, 0, width, height);

    this.glowPhase += 0.045;
    this.updateStreams();

    // Instrucciones para LADO IZQUIERDO (Equipo 1) y LADO DERECHO (Equipo 2)
    this.drawInstructionsForSide(ctx, 'left');
    this.drawInstructionsForSide(ctx, 'right');

    // Línea divisoria central dorada
    ctx.stroke(255, 215, 106, 150);
    ctx.strokeWeight(2.5);
    ctx.line(width / 2, 40, width / 2, height - 110);
    ctx.noStroke();

    // Contador regresivo en el centro inferior con estética Deli & Wine
    const remaining = Math.max(1, Math.ceil((this.duration - (millis() - this.startTime)) / 1000));
    const pillW = Math.min(480, width * 0.44);
    const pillH = 66;
    const pillX = width / 2 - pillW / 2;
    const pillY = height * 0.875;

    ctx.fill(22, 5, 14, 230);
    ctx.stroke(255, 215, 106, 200);
    ctx.strokeWeight(2);
    ctx.rect(pillX, pillY, pillW, pillH, 33);

    ctx.noStroke();
    ctx.textAlign(CENTER, CENTER);
    ctx.textFont('Cinzel, Georgia, serif');
    ctx.textStyle(BOLD);
    ctx.textSize(Math.min(26, width * 0.022));
    ctx.fill(255, 223, 128);
    ctx.text(`LA VENDIMIA COMIENZA EN ${remaining}...`, width / 2, pillY + pillH / 2);

    ctx.pop();
  }

  updateStreams() {
    const goodImgs = (typeof window !== 'undefined' && Array.isArray(window.goodItemImages)) ? window.goodItemImages : [];
    const badImgs = (typeof window !== 'undefined' && Array.isArray(window.badItemImages)) ? window.badItemImages : [];

    for (const side of ['left', 'right']) {
      for (let item of this.passingStreams[side].good) {
        item.progress += item.speed;
        if (item.progress > 1.0) {
          item.progress -= 1.0;
          if (goodImgs.length > 0) {
            item.imgIndex = (item.imgIndex + 3) % goodImgs.length;
          }
        }
      }
      for (let item of this.passingStreams[side].bad) {
        item.progress += item.speed;
        if (item.progress > 1.0) {
          item.progress -= 1.0;
          if (badImgs.length > 0) {
            item.imgIndex = (item.imgIndex + 2) % badImgs.length;
          }
        }
      }
    }
  }

  drawInstructionsForSide(ctx, side) {
    const centerX = side === 'left' ? width * 0.25 : width * 0.75;
    const cardW = Math.min(520, width * 0.42);
    const cardH = height * 0.72;
    const cardX = centerX - cardW / 2;
    const cardY = height * 0.11;

    ctx.push();
    ctx.rectMode(CORNER);

    // Marco vítreo por jugador
    ctx.fill(18, 4, 12, 165);
    ctx.stroke(255, 215, 106, 95);
    ctx.strokeWeight(1.8);
    ctx.rect(cardX, cardY, cardW, cardH, 24);

    // Encabezado
    ctx.noStroke();
    ctx.textAlign(CENTER, CENTER);
    ctx.textFont('Montserrat, sans-serif');
    ctx.textStyle(BOLD);
    ctx.textSize(13);
    ctx.fill(255, 215, 106, 210);
    ctx.text(side === 'left' ? '✦  JUGADOR IZQUIERDA  ✦' : '✦  JUGADOR DERECHA  ✦', centerX, cardY + 28);

    ctx.textFont('Cinzel, Georgia, serif');
    ctx.textStyle(BOLD);
    ctx.textSize(Math.min(30, width * 0.025));
    ctx.fill(0, 0, 0, 180);
    ctx.text('¡APRENDE A JUGAR!', centerX + 2, cardY + 58);
    ctx.fill(255, 248, 235);
    ctx.text('¡APRENDE A JUGAR!', centerX, cardY + 56);

    // Línea ornamental bajo el título
    ctx.stroke(255, 215, 106, 140);
    ctx.strokeWeight(1.5);
    ctx.line(centerX - cardW * 0.28, cardY + 80, centerX + cardW * 0.28, cardY + 80);

    // --- SECCIÓN 1: OBJETOS CON AURA AMARILLA PASANDO (ARRIBA) ---
    const goodY = height * 0.34;
    this.drawPassingShowcase(
      ctx,
      centerX,
      goodY,
      cardW * 0.82,
      this.passingStreams[side].good,
      [255, 215, 65],
      true
    );

    const goodTextY = goodY + 82;
    ctx.noStroke();
    ctx.textFont('Cinzel, Georgia, serif');
    ctx.textStyle(BOLD);
    ctx.textSize(21);
    ctx.fill(255, 220, 95);
    ctx.text('AURA DORADA · OBJETOS DEL VINO', centerX, goodTextY);

    ctx.textFont('Montserrat, sans-serif');
    ctx.textSize(16);
    ctx.fill(245, 235, 210);
    ctx.text('ATRÁPALOS AL PASAR · SUMAN PUNTOS Y COMBO', centerX, goodTextY + 26);

    // --- SECCIÓN 2: OBJETOS CON AURA ROJA PASANDO (ABAJO) ---
    const badY = height * 0.62;
    this.drawPassingShowcase(
      ctx,
      centerX,
      badY,
      cardW * 0.82,
      this.passingStreams[side].bad,
      [255, 55, 70],
      false
    );

    const badTextY = badY + 82;
    ctx.noStroke();
    ctx.textFont('Cinzel, Georgia, serif');
    ctx.textStyle(BOLD);
    ctx.textSize(21);
    ctx.fill(255, 90, 100);
    ctx.text('AURA ROJA · PLAGAS E INSECTOS', centerX, badTextY);

    ctx.textFont('Montserrat, sans-serif');
    ctx.textSize(16);
    ctx.fill(240, 195, 195);
    ctx.text('¡ESQUÍVALOS! · RESTAN PUNTOS Y VIDAS', centerX, badTextY + 26);

    ctx.pop();
  }

  drawPassingShowcase(ctx, centerX, centerY, spanX, streamItems, color, isGood) {
    ctx.push();

    // Pista luminosa sutil por donde desfilan los objetos
    ctx.noFill();
    ctx.stroke(color[0], color[1], color[2], 55);
    ctx.strokeWeight(2);
    ctx.line(centerX - spanX * 0.48, centerY, centerX + spanX * 0.48, centerY);

    const imagesArray = isGood
      ? ((typeof window !== 'undefined' && Array.isArray(window.goodItemImages)) ? window.goodItemImages : [])
      : ((typeof window !== 'undefined' && Array.isArray(window.badItemImages)) ? window.badItemImages : []);

    const validImages = imagesArray.filter(img => img && img.width > 0);
    const baseSize = Math.min(86, width * 0.062);

    // Ordenar para que el objeto más cercano al centro se dibuje encima
    const sorted = streamItems.slice().sort((a, b) => Math.abs(b.progress - 0.5) - Math.abs(a.progress - 0.5));

    for (let item of sorted) {
      const distFromCenter = Math.abs(item.progress - 0.5) * 2.0; // 0 en el centro, 1 en los bordes
      const envelope = Math.sin(constrain(item.progress, 0, 1) * Math.PI); // Entrada y salida suaves
      const focusScale = 0.68 + 0.45 * Math.pow(1.0 - distFromCenter, 1.3);
      const itemSize = baseSize * focusScale;

      const x = centerX + (item.progress - 0.5) * spanX;
      const y = centerY + (isGood
        ? Math.sin(this.glowPhase * 2.0 + item.wobbleSeed) * 12
        : Math.cos(this.glowPhase * 2.3 + item.wobbleSeed) * 12);

      const alphaFactor = Math.pow(envelope, 0.65);
      const pulse = 0.78 + 0.22 * Math.sin(this.glowPhase * 2.2 + item.wobbleSeed);

      ctx.push();
      ctx.translate(x, y);

      // Estela de movimiento horizontal
      ctx.noStroke();
      for (let t = 1; t <= 3; t++) {
        const trailX = -t * 14 * focusScale;
        ctx.fill(color[0], color[1], color[2], (32 / t) * alphaFactor);
        ctx.ellipse(trailX, 0, itemSize * (0.9 - t * 0.12), itemSize * (0.7 - t * 0.1));
      }

      // Aura exterior multicapa (dorada para objetos buenos, roja para malos)
      for (let layer = 5; layer >= 1; layer--) {
        const haloDia = itemSize * (1.05 + layer * 0.24 * pulse);
        const haloAlpha = (72 / layer) * alphaFactor * pulse;
        ctx.fill(color[0], color[1], color[2], haloAlpha);
        ctx.ellipse(0, 0, haloDia, haloDia);
      }

      // Anillo de energía alrededor del objeto
      ctx.noFill();
      ctx.stroke(color[0], color[1], color[2], 210 * alphaFactor);
      ctx.strokeWeight(2.5 * focusScale);
      ctx.ellipse(0, 0, itemSize * 1.12, itemSize * 1.12);

      // Si es objeto bueno y pasa por el centro, mostrar arco de captura progresivo
      if (isGood && distFromCenter < 0.42) {
        const captureArc = map(1.0 - distFromCenter / 0.42, 0, 1, 0.2, TWO_PI);
        ctx.stroke(255, 250, 210, 235 * alphaFactor);
        ctx.strokeWeight(3.5);
        ctx.arc(0, 0, itemSize * 1.28, itemSize * 1.28, -HALF_PI, -HALF_PI + captureArc);
      }

      // Dibujar el sprite real del objeto (copa, botella, uva, bicho, etc.)
      const img = validImages.length > 0 ? validImages[item.imgIndex % validImages.length] : null;
      if (img) {
        ctx.push();
        const rot = Math.sin(this.glowPhase * 1.5 + item.wobbleSeed) * 0.14;
        ctx.rotate(rot);
        ctx.imageMode(CENTER);
        ctx.tint(255, 255 * alphaFactor);
        const aspect = img.height / img.width;
        const drawW = aspect > 1 ? itemSize / aspect : itemSize;
        const drawH = aspect > 1 ? itemSize : itemSize * aspect;
        ctx.image(img, 0, 0, drawW * 0.92, drawH * 0.92);
        ctx.noTint();
        ctx.pop();
      } else {
        // Fallback geométrico si las imágenes aún están cargando
        ctx.noStroke();
        ctx.fill(color[0], color[1], color[2], 200 * alphaFactor);
        ctx.ellipse(0, 0, itemSize * 0.7, itemSize * 0.7);
      }

      // Partículas brillantes orbitando el aura
      ctx.noStroke();
      for (let p = 0; p < 4; p++) {
        const ang = this.glowPhase * 1.6 + item.wobbleSeed + p * HALF_PI;
        const r = itemSize * 0.62;
        const px = Math.cos(ang) * r;
        const py = Math.sin(ang) * r;
        ctx.fill(255, 250, 230, 190 * alphaFactor);
        ctx.ellipse(px, py, 4.5 * focusScale, 4.5 * focusScale);
      }

      ctx.pop();
    }

    ctx.pop();
  }

  reset() {
    this.active = false;
    this.startTime = null;
  }
}
