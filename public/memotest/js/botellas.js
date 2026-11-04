/* ============================================================
   DELI & WINE · MEMOTEST — botellas de vino bordelesas estilizadas
   ------------------------------------------------------------
   Dibuja directamente a resolución nativa (HiDPI) una botella de
   vino bordelesa alargada (cuello esbelto con gollete y cápsula,
   hombros altos definidos y cuerpo cilíndrico largo de vidrio
   oscuro con reflejos de estudio) + etiqueta nítida sin reescalado
   destructivo para evitar cualquier pixelado.

   API:
     Botellas.cargar()                -> Promise
     Botellas.VARIETALES              -> lista de viñas
     Botellas.sprite(v)               -> canvas de la botella
     Botellas.frente(canvas, v, w, h) -> pinta la cara de la carta
   ============================================================ */
(function (global) {
  'use strict';

  const VARIETALES = [
    { id: 'malbec',     nombre: 'MALBEC',             lineas: ['MALBEC'],                color: '#57102e', papel: ['#fbf6ea', '#efe4ca'] },
    { id: 'bonarda',    nombre: 'BONARDA',            lineas: ['BONARDA'],               color: '#881337', papel: ['#fcf5ea', '#f0e3c8'] },
    { id: 'syrah',      nombre: 'SYRAH',              lineas: ['SYRAH'],                 color: '#3b1038', papel: ['#fbf5eb', '#ede1ca'] },
    { id: 'cabernet',   nombre: 'CABERNET SAUVIGNON', lineas: ['CABERNET', 'SAUVIGNON'], color: '#6b0f1c', papel: ['#fbf5e9', '#ece0c4'] },
    { id: 'merlot',     nombre: 'MERLOT',             lineas: ['MERLOT'],                color: '#8a1c14', papel: ['#fcf6ea', '#efe3c8'] },
    { id: 'pinot',      nombre: 'PINOT NOIR',         lineas: ['PINOT', 'NOIR'],         color: '#9e2339', papel: ['#fbf4ec', '#eee2d6'] },
    { id: 'rose',       nombre: 'ROSÉ',               lineas: ['ROSÉ'],                  color: '#c44569', papel: ['#fdf6f2', '#f3e3db'] },
    { id: 'chardonnay', nombre: 'CHARDONNAY',         lineas: ['CHARDONNAY'],            color: '#9c7216', papel: ['#fdf8ea', '#f0e3c4'] },
    { id: 'sauvignon',  nombre: 'SAUVIGNON BLANC',    lineas: ['SAUVIGNON', 'BLANC'],    color: '#2e6b2e', papel: ['#faf8ec', '#e6e6d3'] },
    { id: 'torrontes',  nombre: 'TORRONTÉS',          lineas: ['TORRONTÉS'],             color: '#7c8216', papel: ['#fbf8ea', '#eae4c6'] }
  ];

  const RECORTE = { x: 0, y: 0, w: 120, h: 520 };
  const ETQ = { x: 8, y: 215, w: 104, h: 175 };

  const IMG = { botella: null, logo: null, logoMip: null };
  const SPRITES = {};

  function cargarImagen(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('No se pudo cargar ' + src));
      img.src = src;
    });
  }

  // Genera una versión pre-filtrada en escalones 50% del logo para que al dibujarse
  // pequeño en la etiqueta de la botella no sufra aliasing bilinear
  function crearMipLogo(img) {
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    let actual = img;
    while (w > 220) {
      w = Math.max(160, Math.round(w * 0.5));
      h = Math.max(40, Math.round(h * 0.5));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(actual, 0, 0, w, h);
      actual = c;
    }
    return actual;
  }

  function rgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function aclarar(hex, k) {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * k));
    const g = Math.min(255, Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * k));
    const b = Math.min(255, Math.round((n & 255) + (255 - (n & 255)) * k));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function oscurecer(hex, k) {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - k)));
    const g = Math.max(0, Math.round(((n >> 8) & 255) + (1 - k) * 0));
    const g2 = Math.max(0, Math.round(((n >> 8) & 255) * (1 - k)));
    const b = Math.max(0, Math.round((n & 255) * (1 - k)));
    return 'rgb(' + r + ',' + g2 + ',' + b + ')';
  }

  function rectRedondeado(g, x, y, w, h, r) {
    if (g.roundRect) {
      g.beginPath();
      g.roundRect(x, y, w, h, r);
      return;
    }
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function ajustarFuente(g, texto, maxW, peso, familia, sizeMax, sizeMin) {
    let s = sizeMax;
    while (s > sizeMin) {
      g.font = peso + ' ' + s + 'px ' + familia;
      if (g.measureText(texto).width <= maxW) break;
      s -= 0.4;
    }
    return s;
  }

  // Traza el contorno exacto de una botella de vino bordelesa alargada
  // centrada en cx, desde yTop hasta yTop + H, con ancho de cuerpo W.
  function trazarSiluetaBordelesa(g, cx, yTop, W, H) {
    const rCuerpo = W * 0.50;          // semiancho del cilindro principal
    const rCuello = W * 0.145;         // cuello esbelto y alargado
    const rGollete = W * 0.165;        // anillo superior (gollete)
    const rBase = W * 0.485;           // leve cierre en el talón inferior

    const yBoca      = yTop + H * 0.028;
    const yGollete1  = yTop + H * 0.040;
    const yGollete2  = yTop + H * 0.064;
    const yCuelloFin = yTop + H * 0.255; // cuello largo clásico de vino
    const yHombroFin = yTop + H * 0.365; // hombro bordelés alto y elegante
    const yTalon     = yTop + H * 0.968;
    const yFondo     = yTop + H * 0.995;

    g.beginPath();
    // Mitad derecha (de arriba hacia abajo)
    g.moveTo(cx - rCuello * 0.92, yBoca);
    g.lineTo(cx + rCuello * 0.92, yBoca);
    g.lineTo(cx + rGollete, yGollete1);
    g.lineTo(cx + rGollete, yGollete2);
    g.lineTo(cx + rCuello, yGollete2 + H * 0.008);
    g.lineTo(cx + rCuello, yCuelloFin);
    // Curva suave del hombro bordelés hacia el cilindro largo
    g.bezierCurveTo(
      cx + rCuello, yCuelloFin + (yHombroFin - yCuelloFin) * 0.38,
      cx + rCuerpo, yCuelloFin + (yHombroFin - yCuelloFin) * 0.44,
      cx + rCuerpo, yHombroFin
    );
    // Cuerpo cilíndrico largo y recto
    g.lineTo(cx + rCuerpo, yTalon);
    g.quadraticCurveTo(cx + rCuerpo, yFondo, cx + rBase, yFondo);

    // Base con leve concavidad central
    g.lineTo(cx - rBase, yFondo);

    // Mitad izquierda (de abajo hacia arriba)
    g.quadraticCurveTo(cx - rCuerpo, yFondo, cx - rCuerpo, yTalon);
    g.lineTo(cx - rCuerpo, yHombroFin);
    g.bezierCurveTo(
      cx - rCuerpo, yCuelloFin + (yHombroFin - yCuelloFin) * 0.44,
      cx - rCuello, yCuelloFin + (yHombroFin - yCuelloFin) * 0.38,
      cx - rCuello, yCuelloFin
    );
    g.lineTo(cx - rCuello, yGollete2 + H * 0.008);
    g.lineTo(cx - rGollete, yGollete2);
    g.lineTo(cx - rGollete, yGollete1);
    g.closePath();
  }

  // Dibuja la botella bordelesa completa + etiqueta directamente en el contexto g
  // a las coordenadas (bx, by, W, H) para máxima nitidez vectorial.
  function dibujarBotellaBordelesa(g, v, bx, by, W, H) {
    const cx = bx + W * 0.5;
    const rCuerpo = W * 0.50;
    const rCuello = W * 0.145;

    // 1) Corcho natural asomando arriba de la boca
    const rCorcho = rCuello * 0.80;
    const yCorchoTop = by + H * 0.004;
    const hCorcho = H * 0.032;
    g.save();
    rectRedondeado(g, cx - rCorcho, yCorchoTop, rCorcho * 2, hCorcho, Math.max(1.5, rCorcho * 0.25));
    const gradCorcho = g.createLinearGradient(cx - rCorcho, 0, cx + rCorcho, 0);
    gradCorcho.addColorStop(0, '#8c673e');
    gradCorcho.addColorStop(0.35, '#d5b284');
    gradCorcho.addColorStop(0.7, '#b88f5d');
    gradCorcho.addColorStop(1, '#6e4e2c');
    g.fillStyle = gradCorcho;
    g.fill();
    g.restore();

    // 2) Cuerpo de vidrio oscuro recortado a la silueta bordelesa
    g.save();
    trazarSiluetaBordelesa(g, cx, by, W, H);
    g.clip();

    // Gradiente cilíndrico de vidrio oscuro de bodega con tinte profundo de vino
    const gradVidrio = g.createLinearGradient(bx, 0, bx + W, 0);
    gradVidrio.addColorStop(0, '#070506');
    gradVidrio.addColorStop(0.16, '#1a0c10');
    gradVidrio.addColorStop(0.34, '#240b11');
    gradVidrio.addColorStop(0.55, '#120608');
    gradVidrio.addColorStop(0.84, '#1c090e');
    gradVidrio.addColorStop(1, '#060405');
    g.fillStyle = gradVidrio;
    g.fillRect(bx, by, W, H);

    // Trasluz rubí sutil en el eje central inferior del cuerpo
    const haloVino = g.createRadialGradient(
      cx, by + H * 0.68, W * 0.04,
      cx, by + H * 0.68, H * 0.34
    );
    haloVino.addColorStop(0, rgba(v.color, 0.34));
    haloVino.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = haloVino;
    g.fillRect(bx, by + H * 0.32, W, H * 0.68);

    // 3) Cápsula del cuello con el color de la cepa (de la boca hasta 21% de la altura)
    const yCapTop = by + H * 0.026;
    const hCap = H * 0.185;
    const gradCap = g.createLinearGradient(cx - rCuello * 1.2, 0, cx + rCuello * 1.2, 0);
    gradCap.addColorStop(0, oscurecer(v.color, 0.35));
    gradCap.addColorStop(0.30, aclarar(v.color, 0.20));
    gradCap.addColorStop(0.66, v.color);
    gradCap.addColorStop(1, oscurecer(v.color, 0.42));
    g.fillStyle = gradCap;
    g.fillRect(bx, yCapTop, W, hCap);

    // Anillo de sombra bajo el gollete y doble filete dorado de la cápsula
    g.fillStyle = 'rgba(0,0,0,.28)';
    g.fillRect(bx, by + H * 0.063, W, H * 0.006);
    g.fillStyle = '#f2cf7d';
    g.fillRect(bx, yCapTop + hCap - Math.max(1.2, H * 0.008), W, Math.max(1, H * 0.0045));
    g.fillRect(bx, yCapTop + Math.max(1.5, H * 0.010), W, Math.max(0.8, H * 0.0035));

    // 4) Reflejos especulares de estudio sobre el cuello, hombro y cilindro (detrás de la etiqueta)
    // Reflejo largo izquierdo
    const reflIzq = g.createLinearGradient(cx - rCuerpo * 0.78, 0, cx - rCuerpo * 0.42, 0);
    reflIzq.addColorStop(0, 'rgba(255,255,255,0)');
    reflIzq.addColorStop(0.45, 'rgba(255,252,245,.26)');
    reflIzq.addColorStop(0.7, 'rgba(255,252,245,.12)');
    reflIzq.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = reflIzq;
    g.fillRect(cx - rCuerpo * 0.80, by + H * 0.36, rCuerpo * 0.40, H * 0.60);

    // Reflejo curvo en el hombro izquierdo y cuello
    g.save();
    g.strokeStyle = 'rgba(255,252,245,.28)';
    g.lineWidth = Math.max(1.2, W * 0.055);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - rCuello * 0.52, by + H * 0.075);
    g.lineTo(cx - rCuello * 0.52, by + H * 0.25);
    g.bezierCurveTo(
      cx - rCuello * 0.55, by + H * 0.29,
      cx - rCuerpo * 0.64, by + H * 0.32,
      cx - rCuerpo * 0.64, by + H * 0.38
    );
    g.stroke();
    g.restore();

    // Contraluz fino en el borde derecho
    const reflDer = g.createLinearGradient(cx + rCuerpo * 0.62, 0, cx + rCuerpo * 0.90, 0);
    reflDer.addColorStop(0, 'rgba(255,255,255,0)');
    reflDer.addColorStop(0.6, 'rgba(255,244,225,.14)');
    reflDer.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = reflDer;
    g.fillRect(cx + rCuerpo * 0.60, by + H * 0.37, rCuerpo * 0.32, H * 0.58);

    // 5) ETIQUETA DE BODEGA NÍTIDA (sobre la mitad central del cilindro largo: 41% a 77% de H)
    // Deja ver claramente el vidrio oscuro del hombro arriba y el vidrio oscuro de la base abajo.
    const etqW = W * 0.92;
    const etqH = H * 0.355;
    const etqX = cx - etqW * 0.5;
    const etqY = by + H * 0.415;

    pintarEtiquetaDirecta(g, v, etqX, etqY, etqW, etqH);

    // 6) Picada (fondo cóncavo del vidrio en la base)
    const gradBase = g.createLinearGradient(0, by + H * 0.94, 0, by + H);
    gradBase.addColorStop(0, 'rgba(0,0,0,0)');
    gradBase.addColorStop(1, 'rgba(0,0,0,.65)');
    g.fillStyle = gradBase;
    g.fillRect(bx, by + H * 0.94, W, H * 0.06);

    g.restore();

    // Contorno exterior sutil para definir el cristal oscuro
    g.save();
    trazarSiluetaBordelesa(g, cx, by, W, H);
    g.strokeStyle = 'rgba(255,240,210,.14)';
    g.lineWidth = 0.8;
    g.stroke();
    g.restore();
  }

  // Dibuja la etiqueta directamente en las coordenadas finales (sin reescalar canvas)
  function pintarEtiquetaDirecta(g, v, x, y, W, H) {
    g.save();
    g.translate(x, y);
    rectRedondeado(g, 0, 0, W, H, Math.max(1.5, W * 0.035));
    g.clip();

    // Papel crema de alto contraste
    const papel = g.createLinearGradient(0, 0, 0, H);
    papel.addColorStop(0, v.papel[0]);
    papel.addColorStop(1, v.papel[1]);
    g.fillStyle = papel;
    g.fillRect(0, 0, W, H);

    // Banda superior con el logo oficial Deli & Wine
    const bandaTop = H * 0.255;
    const gradTop = g.createLinearGradient(0, 0, 0, bandaTop);
    gradTop.addColorStop(0, aclarar(v.color, 0.14));
    gradTop.addColorStop(1, oscurecer(v.color, 0.14));
    g.fillStyle = gradTop;
    g.fillRect(0, 0, W, bandaTop);

    // Filete dorado bajo la banda superior
    const altoFilete = Math.max(0.9, H * 0.015);
    g.fillStyle = '#e8c477';
    g.fillRect(0, bandaTop, W, altoFilete);

    const srcLogo = IMG.logoMip || IMG.logo;
    if (srcLogo) {
      const natW = srcLogo.width || srcLogo.naturalWidth;
      const natH = srcLogo.height || srcLogo.naturalHeight;
      const lw = W * 0.72;
      const lh = lw * (natH / Math.max(1, natW));
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(srcLogo, (W - lw) / 2, (bandaTop - lh) / 2, lw, lh);
    }

    // Banda inferior del color de la cepa
    const bandaPie = H * 0.105;
    const yBandaPie = H - bandaPie;
    g.fillStyle = v.color;
    g.fillRect(0, yBandaPie, W, bandaPie);
    g.fillStyle = '#e8c477';
    g.fillRect(0, yBandaPie - altoFilete * 0.85, W, altoFilete * 0.85);

    // Marco interior fino sobre el papel
    const padM = Math.max(2, W * 0.045);
    g.strokeStyle = rgba(v.color, 0.34);
    g.lineWidth = Math.max(0.7, W * 0.012);
    g.strokeRect(
      padM,
      bandaTop + padM * 0.9,
      W - padM * 2,
      yBandaPie - bandaTop - padM * 1.8
    );

    // ── NOMBRE DE LA CEPA RENDERIZADO EN RESOLUCIÓN NATIVA (CERO PIXELADO) ──
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const areaTop = bandaTop + padM;
    const areaBot = yBandaPie - padM * 0.6;
    const centroY = (areaTop + areaBot) * 0.5;
    const maxW = W - padM * 2.8;
    const familia = '"Bebas Neue", Impact, "Arial Narrow", sans-serif';

    if (v.lineas.length === 1) {
      const size = ajustarFuente(g, v.lineas[0], maxW, '700', familia, H * 0.36, 7);
      g.font = '700 ' + size + 'px ' + familia;
      g.fillStyle = oscurecer(v.color, 0.14);
      g.fillText(v.lineas[0], W / 2, centroY);
    } else {
      const sMax = H * 0.255;
      const size = Math.min(
        ajustarFuente(g, v.lineas[0], maxW, '700', familia, sMax, 6.5),
        ajustarFuente(g, v.lineas[1], maxW, '700', familia, sMax, 6.5)
      );
      g.font = '700 ' + size + 'px ' + familia;
      const salto = size * 0.92;
      g.fillStyle = oscurecer(v.color, 0.14);
      g.fillText(v.lineas[0], W / 2, centroY - salto * 0.5);
      g.fillText(v.lineas[1], W / 2, centroY + salto * 0.5);
    }

    // Tres rombos dorados en la banda inferior
    const yPie = yBandaPie + bandaPie * 0.5;
    const d = Math.max(1.1, W * 0.022);
    g.fillStyle = '#f5d98e';
    [-1, 0, 1].forEach((k) => {
      const rx = W * 0.5 + k * W * 0.09;
      g.beginPath();
      g.moveTo(rx, yPie - d);
      g.lineTo(rx + d, yPie);
      g.lineTo(rx, yPie + d);
      g.lineTo(rx - d, yPie);
      g.closePath();
      g.fill();
    });

    // Sombreado cilíndrico suave en los bordes laterales de la etiqueta
    const sombra = g.createLinearGradient(0, 0, W, 0);
    sombra.addColorStop(0, 'rgba(0,0,0,.22)');
    sombra.addColorStop(0.15, 'rgba(0,0,0,0)');
    sombra.addColorStop(0.85, 'rgba(0,0,0,0)');
    sombra.addColorStop(1, 'rgba(0,0,0,.26)');
    g.fillStyle = sombra;
    g.fillRect(0, 0, W, H);

    g.restore();
  }

  function crearSprite(v) {
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 1040;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    dibujarBotellaBordelesa(g, v, 10, 10, 220, 1020);
    return c;
  }

  // ── cara de la carta: renderizado directo a alta densidad de píxeles ──
  function frente(canvas, v, w, h) {
    // Usamos dpr >= 2.5 para que la etiqueta y tipografía sobre la botella se vean ultra nítidas
    const dpr = Math.max(2.5, Math.min(3, (global.devicePixelRatio || 1) * 2));
    const W = Math.max(1, Math.round(w * dpr));
    const H = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.clearRect(0, 0, w, h);

    // Papel de la carta
    const fondo = g.createLinearGradient(0, 0, w * 0.35, h);
    fondo.addColorStop(0, '#fdfaf1');
    fondo.addColorStop(0.5, '#f6efdf');
    fondo.addColorStop(1, '#e8dcc2');
    g.fillStyle = fondo;
    g.fillRect(0, 0, w, h);

    // Halo con tinte sutil del color de la cepa detrás de la botella
    const halo = g.createRadialGradient(w * 0.5, h * 0.42, w * 0.04, w * 0.5, h * 0.42, w * 0.72);
    halo.addColorStop(0, rgba(v.color, 0.16));
    halo.addColorStop(0.6, 'rgba(255,252,240,.5)');
    halo.addColorStop(1, 'rgba(255,252,240,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, w, h);

    // Marco fino interior
    const m = Math.max(3, Math.min(7, w * 0.04));
    g.strokeStyle = rgba(v.color, 0.28);
    g.lineWidth = 1.2;
    g.strokeRect(m + 0.5, m + 0.5, w - m * 2 - 1, h - m * 2 - 1);

    // Proporción esbelta y alargada de botella de vino bordelesa (ancho / alto = 0.225)
    const propBordelesa = 0.225;
    let altoBotella = h * 0.765;
    let anchoBotella = altoBotella * propBordelesa;
    if (anchoBotella > w * 0.38) {
      anchoBotella = w * 0.38;
      altoBotella = anchoBotella / propBordelesa;
    }
    const bx = (w - anchoBotella) * 0.5;
    const by = h * 0.022;

    // Sombra de apoyo bajo la base de la botella
    const yBase = by + altoBotella * 0.992;
    const rx = anchoBotella * 0.65;
    const ry = Math.max(2, rx * 0.18);
    const sombra = g.createRadialGradient(w / 2, yBase, 0.5, w / 2, yBase, rx);
    sombra.addColorStop(0, 'rgba(38,10,8,.38)');
    sombra.addColorStop(0.55, 'rgba(38,10,8,.18)');
    sombra.addColorStop(1, 'rgba(38,10,8,0)');
    g.fillStyle = sombra;
    g.beginPath();
    g.ellipse(w / 2, yBase, rx, ry, 0, 0, Math.PI * 2);
    g.fill();

    // Dibuja la botella y su etiqueta directamente a resolución nativa (sin pixelado)
    dibujarBotellaBordelesa(g, v, bx, by, anchoBotella, altoBotella);

    // ── CARTEL DE LA CEPA AL PIE DE LA CARTA ──
    const padX = Math.max(4, w * 0.055);
    const bandaH = Math.max(18, Math.round(h * 0.175));
    const bandaY = h - bandaH - Math.max(3, h * 0.028);
    const bandaW = w - padX * 2;
    const radioBanda = Math.min(7, bandaH * 0.3);

    g.save();
    rectRedondeado(g, padX, bandaY, bandaW, bandaH, radioBanda);
    const gradBanda = g.createLinearGradient(0, bandaY, 0, bandaY + bandaH);
    gradBanda.addColorStop(0, aclarar(v.color, 0.12));
    gradBanda.addColorStop(1, oscurecer(v.color, 0.18));
    g.fillStyle = gradBanda;
    g.fill();
    g.strokeStyle = 'rgba(232,196,119,.85)';
    g.lineWidth = 1.2;
    g.stroke();

    const nombre = v.nombre;
    const capW = bandaW - 8;
    const familia = '"Bebas Neue", Impact, sans-serif';
    let size = Math.max(10, Math.min(bandaH * 0.78, w * 0.24));
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 ' + size + 'px ' + familia;
    while (size > 8.5 && g.measureText(nombre).width > capW) {
      size -= 0.5;
      g.font = '700 ' + size + 'px ' + familia;
    }
    g.fillStyle = 'rgba(0,0,0,.45)';
    g.fillText(nombre, w / 2 + 0.8, bandaY + bandaH / 2 + 1.2);
    g.fillStyle = '#fff6e0';
    g.fillText(nombre, w / 2, bandaY + bandaH / 2 + 0.5);
    g.restore();

    return canvas;
  }

  let promesa = null;
  function cargar() {
    if (promesa) return promesa;
    promesa = Promise.all([
      cargarImagen('img/botella.png'),
      cargarImagen('img/logo.svg')
    ])
      .then(([botella, logo]) => {
        IMG.botella = botella;
        IMG.logo = logo;
        IMG.logoMip = crearMipLogo(logo);
        const fuentes = (global.document && document.fonts && document.fonts.ready)
          ? document.fonts.ready.catch(() => {})
          : Promise.resolve();
        return fuentes.then(() => {
          VARIETALES.forEach((v) => { SPRITES[v.id] = crearSprite(v); });
          return true;
        });
      })
      .catch((err) => {
        promesa = null;
        throw err;
      });
    return promesa;
  }

  global.Botellas = {
    VARIETALES: VARIETALES,
    RECORTE: RECORTE,
    ETQ: ETQ,
    cargar: cargar,
    sprite: (v) => SPRITES[v.id] || null,
    frente: frente
  };
})(window);
