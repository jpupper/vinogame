/* ============================================================
   DELI & WINE · LLENÁ LAS COPAS  (v5 — Fluidos por partículas con colisión)
   ------------------------------------------------------------
   PARTIDA DE 60 SEGUNDOS:
   · Arriba: UNA BOTELLA POR CADA DEDO / CURSOR con el logo oficial Deli & Wine.
   · El vino (#450B02) cae como partículas físicas que colisionan entre sí
     y contra el contorno interior exacto de la copa (medido de copa-vacia-mask.png),
     acumulándose físicamente desde la base hasta llenar el cáliz oscuro.
   · Copa llena a tiempo  -> +100 puntos + bonus + animación suave de escala
                             con aceleración y desaceleración (sin trofeo).
   · Reloj en cero        -> −50 puntos (la partida sigue).
   · Desbordar una copa   -> −30 puntos.
   ============================================================ */
(() => {
  'use strict';

  const SA = document.getElementById('escena');
  const ctx = SA.getContext('2d');

  // ---------------- CONFIG ----------------
  const CFG = {
    duracion: 60000,          // reloj general de la partida (ms)
    gotasPorFrame: 2,         // caudal base por botella activa
    radioGota: 5.5,           // radio base de referencia
    pisoCopas: 0.93,          // fracción de alto donde apoyan las copas
    maxCopas: 3,              // copas simultáneas en pantalla
    esperaCopa: [1200, 2000], // ms entre aparición y aparición
    tiempoCopa: 9500,         // ms que tenés para llenarla
    puntosCopa: 100,
    bonusMax: 60,
    penalidadCopa: 50,
    penalidadDesborde: 30,
    maxBotellas: 6,
    maxParticulas: 1400,
    capacidadCopa: 48,        // partículas colisionando que llenan la copa hasta la marca
    sobranteDesborde: 30,     // partículas que tienen que salirse para cobrar el desborde
    inclinarbotella: true     // true = botella inclinada a 45° (izq/der según mitad); false = vertical (180°)
  };

  // ---------------- ESTADO ----------------
  const E = {
    listo: false, jugando: false, pausado: false,
    ancho: 0, alto: 0, dpr: 1,
    puntos: 0, copas: 0, fallas: 0,
    restante: CFG.duracion,
    bocaY: 0,
    evento: 'DELI & WINE',
    botellas: [],
    copasArr: [],
    particulas: [],
    motas: [],
    chispas: [],
    avisos: [],
    ultimo: 0,
    destello: 0,
    tSpawn: 350
  };

  (function () {
    let v = '';
    try { v = new URLSearchParams(location.search).get('evento') || ''; } catch (e) { }
    if (!v) v = document.body.getAttribute('data-evento') || '';
    E.evento = String(v || 'DELI & WINE').trim().toUpperCase().slice(0, 22);
  })();

  // ---------------- IMÁGENES Y SPRITES PROCESADOS ----------------
  const IMG = {
    botella: new Image(),
    copaVacia: new Image(),
    copaMask: new Image(),
    logo: new Image()
  };

  let SPRITE_COPA_OSCURA = null;
  let SPRITE_COPA_REFLEJO = null;

  let cargadas = 0;
  ['botella', 'copaVacia', 'copaMask', 'logo'].forEach((k) => {
    IMG[k].onload = IMG[k].onerror = () => {
      cargadas++;
      if (cargadas >= 4) {
        prepararSpritesCopa();
        prepararEtiqueta();
        E.listo = true;
        const elCargando = document.getElementById('cargando');
        if (elCargando) elCargando.classList.remove('visible');
        if (location.search.indexOf('captura=') !== -1) {
          setTimeout(prepararEscenaCaptura, 120);
        }
      }
    };
  });
  IMG.botella.src = 'img/botella.png';
  IMG.copaVacia.src = 'img/copa-vacia.png';
  IMG.copaMask.src = 'img/copa-vacia-mask.png';
  IMG.logo.src = 'img/logo.png';

  // Procesa copa-vacia.png + copa-vacia-mask.png para quitar el fondo blanco
  // [238,238,238] del interior del cáliz y dejar una copa de cristal oscuro real.
  function prepararSpritesCopa() {
    if (!(IMG.copaVacia.complete && IMG.copaVacia.naturalWidth)) return;
    const W = IMG.copaVacia.naturalWidth;
    const H = IMG.copaVacia.naturalHeight;

    const cSrc = document.createElement('canvas');
    cSrc.width = W; cSrc.height = H;
    const gSrc = cSrc.getContext('2d');
    gSrc.drawImage(IMG.copaVacia, 0, 0);
    const dSrc = gSrc.getImageData(0, 0, W, H).data;

    let dMask = null;
    if (IMG.copaMask.complete && IMG.copaMask.naturalWidth) {
      const cM = document.createElement('canvas');
      cM.width = W; cM.height = H;
      const gM = cM.getContext('2d');
      gM.drawImage(IMG.copaMask, 0, 0, W, H);
      dMask = gM.getImageData(0, 0, W, H).data;
    }

    const cBase = document.createElement('canvas');
    cBase.width = W; cBase.height = H;
    const gBase = cBase.getContext('2d');
    const imgBase = gBase.createImageData(W, H);
    const dstB = imgBase.data;

    const cRef = document.createElement('canvas');
    cRef.width = W; cRef.height = H;
    const gRef = cRef.getContext('2d');
    const imgRef = gRef.createImageData(W, H);
    const dstR = imgRef.data;

    for (let i = 0; i < dSrc.length; i += 4) {
      const r = dSrc[i];
      const g = dSrc[i + 1];
      const b = dSrc[i + 2];
      const a = dSrc[i + 3];
      if (a < 8) continue;

      const mA = dMask ? dMask[i + 3] : 0;
      const lum = (r + g + b) / 3;

      if (mA > 20) {
        // Interior del cáliz: reemplazamos el gris/blanco de estudio (lum ~238)
        // por cristal ahumado oscuro para que la copa se vea oscura y el vino #450B02 resalte.
        const oscuridadBorde = Math.max(0, (226 - lum) / 226); // bordes oscuros del vidrio
        const esBrillo = Math.max(0, (lum - 241) / 14);        // reflejo especular puro

        // Sprite trasero (copa vacía oscura)
        dstB[i]     = Math.round(18 + esBrillo * 90);
        dstB[i + 1] = Math.round(7 + esBrillo * 75);
        dstB[i + 2] = Math.round(10 + esBrillo * 80);
        dstB[i + 3] = Math.min(255, Math.round((0.76 + oscuridadBorde * 0.22) * a));

        // Sprite delantero (contorno de vidrio oscuro + reflejo especular sutil encima del vino)
        if (oscuridadBorde > 0.08) {
          dstR[i] = 10;
          dstR[i + 1] = 3;
          dstR[i + 2] = 5;
          dstR[i + 3] = Math.min(245, Math.round(oscuridadBorde * 255));
        } else if (esBrillo > 0.05) {
          dstR[i] = 255;
          dstR[i + 1] = 240;
          dstR[i + 2] = 230;
          dstR[i + 3] = Math.min(48, Math.round(esBrillo * 48));
        }
      } else {
        // Tallo y base de la copa (fuera del cáliz): oscurecer un poco el blanco puro
        dstB[i]     = Math.round(r * 0.78);
        dstB[i + 1] = Math.round(g * 0.72);
        dstB[i + 2] = Math.round(b * 0.74);
        dstB[i + 3] = a;
      }
    }

    gBase.putImageData(imgBase, 0, 0);
    gRef.putImageData(imgRef, 0, 0);
    SPRITE_COPA_OSCURA = cBase;
    SPRITE_COPA_REFLEJO = cRef;
  }

  // ---------------- ETIQUETA EN LA BOTELLA (CON EL LOGO OFICIAL) ----------------
  // img/logo.png es blanco sobre transparente. Antes se dibujaba directo sobre
  // papel crema y quedaba invisible, viéndose sólo texto Cinzel. Ahora teñimos
  // img/logo.png en color vino #450B02 (o sobre banda oscura) para que en la
  // botella se vea exactamente el logo oficial de Deli & Wine.
  let ETQ = null;
  function prepararEtiqueta() {
    const W = 300, H = 210;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');

    // La botella YA trae su etiqueta: no se tapa con un rectángulo crema
    // (eso era lo que se veía "pegado"). Solo un velo tenue que unifica el papel
    // y deja pasar las guardas y la textura originales.
    const fondo = g.createLinearGradient(0, 0, W, 0);
    fondo.addColorStop(0, 'rgba(247,241,227,0)');
    fondo.addColorStop(0.12, 'rgba(247,241,227,.30)');
    fondo.addColorStop(0.5, 'rgba(255,250,240,.16)');
    fondo.addColorStop(0.88, 'rgba(243,236,220,.30)');
    fondo.addColorStop(1, 'rgba(247,241,227,0)');
    g.fillStyle = fondo;
    g.fillRect(0, 0, W, H);

    // sombra suave arriba y abajo: apoya la impresión en el vidrio
    const sombra = g.createLinearGradient(0, 0, 0, H);
    sombra.addColorStop(0, 'rgba(40,10,18,.20)');
    sombra.addColorStop(0.14, 'rgba(40,10,18,0)');
    sombra.addColorStop(0.86, 'rgba(40,10,18,0)');
    sombra.addColorStop(1, 'rgba(40,10,18,.18)');
    g.fillStyle = sombra;
    g.fillRect(0, 0, W, H);

    // Dibujar el LOGO OFICIAL (img/logo.png) teñido en #450B02 para que contraste
    // perfecto sobre la etiqueta crema de la botella
    if (IMG.logo.complete && IMG.logo.naturalWidth) {
      const cLogo = document.createElement('canvas');
      cLogo.width = IMG.logo.naturalWidth;
      cLogo.height = IMG.logo.naturalHeight;
      const gL = cLogo.getContext('2d');
      gL.drawImage(IMG.logo, 0, 0);
      gL.globalCompositeOperation = 'source-in';
      gL.fillStyle = '#450B02';
      gL.fillRect(0, 0, cLogo.width, cLogo.height);

      const esEventoCustom = E.evento && E.evento !== 'DELI & WINE';
      const lw = W * (esEventoCustom ? 0.78 : 0.84);
      const lh = lw * (cLogo.height / cLogo.width);
      const ly = esEventoCustom ? (H * 0.36 - lh / 2) : ((H - lh) / 2);
      g.drawImage(cLogo, (W - lw) / 2, ly, lw, lh);

      if (esEventoCustom) {
        g.strokeStyle = 'rgba(69,11,2,.38)';
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(W * 0.2, H * 0.64);
        g.lineTo(W * 0.8, H * 0.64);
        g.stroke();

        let size = 28;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        do {
          g.font = '700 ' + size + 'px Cinzel, Georgia, serif';
          if (g.measureText(E.evento).width <= W - 36 || size <= 11) break;
          size -= 1.5;
        } while (true);
        g.fillStyle = '#450B02';
        g.fillText(E.evento, W / 2, H * 0.79);
      }
    }

    ETQ = c;

    // También vestimos la botella de la pantalla final con cápsula borgoña y filetes dorados
    if (IMG.botella.complete && IMG.botella.naturalWidth) {
      const cFin = document.createElement('canvas');
      cFin.width = 512;
      cFin.height = 512;
      const gF = cFin.getContext('2d');
      gF.drawImage(IMG.botella, 0, 0);
      gF.save();
      gF.globalCompositeOperation = 'source-atop';
      const gradCap = gF.createLinearGradient(228, 68, 274, 68);
      gradCap.addColorStop(0, 'rgba(56,6,14,.92)');
      gradCap.addColorStop(0.32, 'rgba(136,19,55,.95)');
      gradCap.addColorStop(0.68, 'rgba(92,11,32,.95)');
      gradCap.addColorStop(1, 'rgba(42,4,10,.95)');
      gF.fillStyle = gradCap;
      gF.fillRect(220, 68, 64, 72);
      gF.fillStyle = 'rgba(255,214,110,.92)';
      gF.fillRect(220, 135, 64, 2.5);
      gF.fillRect(220, 71, 64, 1.8);
      gF.restore();
      const imgFin = document.querySelector('.botella-fin-img');
      if (imgFin) imgFin.src = cFin.toDataURL();
    }
  }
  prepararEtiqueta();

  function pintarEvento() {
    document.querySelectorAll('[data-evento-nombre]').forEach((el) => {
      el.textContent = E.evento;
    });
  }
  pintarEvento();

  // ---------------- PERFIL EXACTO DE LA COPA (MEDIDO DE copa-vacia-mask.png) ----------------
  // En copa-vacia.png (512x512), el eje central del cáliz está en x = 0.4941 (253px)
  // y la máscara interior va de yf = 0.078 (boca) a yf = 0.492 (fondo del cáliz).
  // Cada par [yf, rf] es la fracción de altura y el semiancho interior real (con 2.5px
  // de margen interno para que ni una gota asome fuera del borde oscuro del vidrio).
  const PERFIL_MASCARA = [
    [0.078, 0.111],
    [0.100, 0.118],
    [0.130, 0.125],
    [0.160, 0.132],
    [0.190, 0.139],
    [0.220, 0.146],
    [0.250, 0.151],
    [0.280, 0.156],
    [0.310, 0.160],
    [0.340, 0.163],
    [0.360, 0.164],
    [0.380, 0.162],
    [0.400, 0.158],
    [0.420, 0.151],
    [0.440, 0.139],
    [0.460, 0.123],
    [0.478, 0.098],
    [0.490, 0.064],
    [0.496, 0.000]
  ];

  const COPA_F = {
    xCentro: 0.4941,    // centro real del cáliz en el PNG de 512x512
    rBorde: 0.111,      // semiancho real en la boca
    rVientre: 0.164,    // semiancho real en el vientre
    yBorde: 0.078,      // boca del cáliz
    yVientre: 0.360,    // parte más ancha del cáliz
    yFondo: 0.494,      // fondo interior del cáliz
    fracObjetivo: 0.72  // fracción de altura de llenado objetivo
  };

  function ubicar(c) {
    const sx = c.cx - c.ancho * COPA_F.xCentro;
    const sy = (c.yBase + c.dy) - c.alto;
    const Y = (f) => sy + c.alto * f;
    c.sprite = { x: sx, y: sy, w: c.ancho, h: c.alto };
    c.rBorde = c.ancho * COPA_F.rBorde;
    c.rVientre = c.ancho * COPA_F.rVientre;
    c.xBordeIzq = c.cx - c.rBorde;
    c.xBordeDer = c.cx + c.rBorde;
    c.xVientreIzq = c.cx - c.rVientre;
    c.xVientreDer = c.cx + c.rVientre;
    c.yBorde = Y(COPA_F.yBorde);
    c.yVientre = Y(COPA_F.yVientre);
    c.yFondo = Y(COPA_F.yFondo);
    c.yObjetivo = c.yFondo - (c.yFondo - c.yBorde) * COPA_F.fracObjetivo;
    return c;
  }

  // Semiancho interior exacto interpolando la tabla medida de copa-vacia-mask.png
  function radioInteriorCopa(c, y) {
    const yf = (y - c.sprite.y) / Math.max(1, c.alto);
    if (yf <= PERFIL_MASCARA[0][0]) return PERFIL_MASCARA[0][1] * c.ancho;
    const ult = PERFIL_MASCARA.length - 1;
    if (yf >= PERFIL_MASCARA[ult][0]) return 0;

    for (let i = 0; i < ult; i++) {
      const a = PERFIL_MASCARA[i];
      const b = PERFIL_MASCARA[i + 1];
      if (yf >= a[0] && yf <= b[0]) {
        const t = (yf - a[0]) / Math.max(0.0001, b[0] - a[0]);
        return (a[1] + (b[1] - a[1]) * t) * c.ancho;
      }
    }
    return 0;
  }

  // Camino exacto del interior del cáliz para recortar el fluido sin que asome ni 1px afuera
  function trazarInteriorCopa(g, c) {
    const sy = c.sprite.y;
    const n = PERFIL_MASCARA.length;
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const yf = PERFIL_MASCARA[i][0];
      const rf = PERFIL_MASCARA[i][1];
      const x = c.cx + rf * c.ancho;
      const y = sy + yf * c.alto;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    for (let i = n - 1; i >= 0; i--) {
      const yf = PERFIL_MASCARA[i][0];
      const rf = PERFIL_MASCARA[i][1];
      const x = c.cx - rf * c.ancho;
      const y = sy + yf * c.alto;
      g.lineTo(x, y);
    }
    g.closePath();
  }

  function crearCopa(cx, yBase, ancho, lane) {
    const alto = ancho;
    const copa = {
      cx: cx,
      yBase: yBase,
      ancho: ancho,
      alto: alto,
      lane: lane,
      nivel: 0,
      nivelObjetivo: 1.0,
      capacidad: CFG.capacidadCopa,
      llena: false,
      desbordada: false,
      sobrante: 0,
      temblor: 0,
      agit: 0,
      escala: 1,
      estado: 'entrando',
      tEstado: 0,
      vida: CFG.tiempoCopa,
      dy: alto * 0.95,
      prevDy: alto * 0.95,
      deltaDy: 0,
      particulasDentro: 0
    };
    ubicar(copa);
    return copa;
  }

  // ---------------- CARRILES ----------------
  function carriles() { return E.ancho < 680 ? 3 : 4; }
  function centroCarril(i) {
    const n = carriles();
    return (E.ancho / n) * (i + 0.5);
  }
  function anchoCopa() {
    const n = carriles();
    return Math.min((E.ancho / n) * 0.88, E.alto * 0.36);
  }
  function radioFisicoGota() {
    return Math.max(3.6, anchoCopa() * 0.0235);
  }
  function carrilesLibres() {
    const ocupados = new Set();
    E.copasArr.forEach((c) => { if (c.estado !== 'saliendo') ocupados.add(c.lane); });
    const libres = [];
    for (let i = 0; i < carriles(); i++) if (!ocupados.has(i)) libres.push(i);
    return libres;
  }
  function copasEnJuego() {
    return E.copasArr.filter((c) => c.estado !== 'saliendo').length;
  }

  // ---------------- LAYOUT ----------------
  function ajustarTamano() {
    const rect = SA.parentElement.getBoundingClientRect();
    E.ancho = Math.max(320, Math.round(rect.width));
    E.alto = Math.max(420, Math.round(rect.height));
    E.dpr = Math.min(2, window.devicePixelRatio || 1);
    SA.width = Math.round(E.ancho * E.dpr);
    SA.height = Math.round(E.alto * E.dpr);
    SA.style.width = E.ancho + 'px';
    SA.style.height = E.alto + 'px';
    ctx.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);

    const CF = document.getElementById('fluido');
    if (CF) {
      CF.style.width = E.ancho + 'px';
      CF.style.height = E.alto + 'px';
      if (window.Fluido && !window.Fluido.disponible()) {
        window.Fluido.iniciar(CF);
      }
    }

    E.bocaY = E.alto * 0.445;
    E.botellas.forEach((b) => { b.x = Math.min(E.ancho - 10, Math.max(10, b.x)); });

    iniciarFondo();

    const yBase = E.alto * CFG.pisoCopas;
    const ancho = anchoCopa();
    const rNuevo = radioFisicoGota();
    E.copasArr.forEach((c) => {
      const oldCx = c.cx;
      const oldYFondo = c.yFondo;
      c.yBase = yBase;
      c.ancho = ancho;
      c.alto = ancho;
      c.cx = centroCarril(Math.min(c.lane, carriles() - 1));
      if (c.estado === 'entrando') c.dy = c.alto * 0.95;
      ubicar(c);
      const dx = c.cx - oldCx;
      const dy = c.yFondo - oldYFondo;
      E.particulas.forEach((p) => {
        if (p.copa === c) {
          p.x += dx;
          p.y += dy;
          p.r = rNuevo;
        }
      });
    });
  }

  // ---------------- SISTEMA FÍSICO DE FLUIDO (PARTÍCULAS CON COLISIÓN) ----------------
  function crearGota(x, y, vx, vy) {
    if (E.particulas.length >= CFG.maxParticulas) {
      let idx = E.particulas.findIndex((p) => !p.copa);
      if (idx === -1) idx = 0;
      E.particulas.splice(idx, 1);
    }
    const r = radioFisicoGota() * (0.94 + Math.random() * 0.12);
    const p = {
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      r: r,
      copa: null,
      desbordada: false,
      vidaMesa: 0,
      edad: 0
    };
    E.particulas.push(p);
    return p;
  }

  const grilla = new Map();
  function claveCelda(cx, cy) {
    return (cx << 16) ^ (cy & 0xffff);
  }

  function simularFluido(dt, pasosTiempo) {
    const N = E.particulas.length;
    if (!N) return;

    const SUBPASOS = 4;
    const dtSub = pasosTiempo / SUBPASOS;
    const gravLibre = 0.30;
    const gravCopa = 0.24;
    const yMesa = E.alto * CFG.pisoCopas;
    const copasVivas = E.copasArr.filter((c) => c.estado !== 'saliendo');
    const rRef = radioFisicoGota();
    const tamCelda = Math.max(10, Math.round(rRef * 2.2));

    for (let sub = 0; sub < SUBPASOS; sub++) {
      // 1) Integración de velocidades
      for (let i = 0; i < N; i++) {
        const p = E.particulas[i];
        p.edad += dt / SUBPASOS;

        if (p.copa) {
          const c = p.copa;
          p.y += c.deltaDy / SUBPASOS;
          p.vy += gravCopa * dtSub;
          p.vx *= 0.976;
          p.vy *= 0.976;
        } else if (p.vidaMesa > 0) {
          p.vx *= 0.88;
          p.vy = 0;
        } else {
          p.vy += gravLibre * dtSub;
          p.vx *= 0.996;
          p.vy *= 0.998;
        }

        p.x += p.vx * dtSub;
        p.y += p.vy * dtSub;

        // Comprobar entrada a una copa
        if (!p.copa && p.vidaMesa <= 0) {
          for (let k = 0; k < copasVivas.length; k++) {
            const c = copasVivas[k];
            if (p.y >= c.yBorde - p.r && p.y <= c.yFondo) {
              const dx = p.x - c.cx;
              const adx = Math.abs(dx);
              // Si cae apuntando a la boca de la copa, canalizarla hacia adentro
              // para que no queden gotas pegadas por fuera del vidrio.
              if (!p.desbordada && p.y <= c.yBorde + Math.max(22, Math.abs(p.vy) * 2.5) && adx <= c.rBorde * 1.18) {
                p.copa = c;
                const maxIn = Math.max(2, c.rBorde - p.r * 1.1);
                if (adx > maxIn) {
                  p.x = c.cx + (dx >= 0 ? maxIn : -maxIn);
                }
                p.vx *= 0.45;
                p.vy *= 0.72;
                c.agit = Math.min(1, (c.agit || 0) + 0.07);
                break;
              }
              // Si viene de costado muy lejos de la boca y toca el exterior del cáliz,
              // alejarla limpiamente hacia afuera
              const rExt = radioInteriorCopa(c, p.y) + p.r * 2.4;
              if (adx < rExt) {
                const sgn = dx >= 0 ? 1 : -1;
                p.x = c.cx + sgn * rExt;
                if (p.vx * sgn < 0) {
                  p.vx = -p.vx * 0.4 + sgn * 1.2;
                }
              }
            }
          }

          // Impacto contra la mesa
          if (!p.copa && p.y >= yMesa - p.r * 0.4) {
            p.y = yMesa - p.r * 0.4;
            p.vidaMesa = 180;
            const velImpacto = Math.abs(p.vy);
            p.vx = (p.vx + (Math.random() - 0.5) * 3.0) * 0.65;
            p.vy = 0;
            if (velImpacto > 2.2 && E.chispas.length < 90) {
              E.chispas.push({
                x: p.x,
                y: yMesa - 2,
                vx: p.vx + (Math.random() - 0.5) * 2.6,
                vy: -Math.random() * 2.2 - 0.5,
                vida: 0.45,
                color: Math.random() > 0.4 ? '#450B02' : '#651204'
              });
            }
          }
        }
      }

      // 2) Grilla espacial
      grilla.clear();
      for (let i = 0; i < N; i++) {
        const p = E.particulas[i];
        const cx = Math.floor(p.x / tamCelda);
        const cy = Math.floor(p.y / tamCelda);
        const k = claveCelda(cx, cy);
        let celda = grilla.get(k);
        if (!celda) {
          celda = [];
          grilla.set(k, celda);
        }
        celda.push(i);
      }

      // 3) Colisiones partícula-partícula
      for (let i = 0; i < N; i++) {
        const pi = E.particulas[i];
        const cxi = Math.floor(pi.x / tamCelda);
        const cyi = Math.floor(pi.y / tamCelda);

        for (let ox = -1; ox <= 1; ox++) {
          for (let oy = -1; oy <= 1; oy++) {
            const celda = grilla.get(claveCelda(cxi + ox, cyi + oy));
            if (!celda) continue;

            for (let m = 0; m < celda.length; m++) {
              const j = celda[m];
              if (j <= i) continue;
              const pj = E.particulas[j];

              if (pi.copa !== pj.copa) continue;

              const dx = pj.x - pi.x;
              const dy = pj.y - pi.y;
              const d2 = dx * dx + dy * dy;
              const enCopa = !!(pi.copa && pj.copa);
              const dMin = (pi.r + pj.r) * (enCopa ? 0.90 : 0.72);

              if (d2 < dMin * dMin) {
                const d = Math.sqrt(Math.max(0.0001, d2));
                const nx = dx / d;
                const ny = dy / d;
                const pen = (dMin - d) * (enCopa ? 0.52 : 0.30);

                pi.x -= nx * pen;
                pi.y -= ny * pen;
                pj.x += nx * pen;
                pj.y += ny * pen;

                const rvx = pj.vx - pi.vx;
                const rvy = pj.vy - pi.vy;
                const vn = rvx * nx + rvy * ny;
                if (vn < 0) {
                  const imp = -vn * (enCopa ? 0.54 : 0.35);
                  pi.vx -= nx * imp;
                  pi.vy -= ny * imp;
                  pj.vx += nx * imp;
                  pj.vy += ny * imp;
                }

                const visc = enCopa ? 0.16 : 0.10;
                pi.vx += rvx * visc;
                pi.vy += rvy * visc;
                pj.vx -= rvx * visc;
                pj.vy -= rvy * visc;
              }
            }
          }
        }
      }

      // 4) Restricción exacta dentro del contorno interior de la copa
      for (let i = 0; i < N; i++) {
        const p = E.particulas[i];
        const c = p.copa;
        if (!c) continue;

        const padPared = p.r * 1.15;

        // Piso curvo del cáliz
        const yMaxFondo = c.yFondo - padPared;
        if (p.y > yMaxFondo) {
          p.y = yMaxFondo;
          if (p.vy > 0) p.vy = -p.vy * 0.08;
          p.vx *= 0.92;
        }

        if (p.y >= c.yBorde - p.r * 0.5) {
          const rPared = Math.max(2, radioInteriorCopa(c, p.y) - padPared);
          const dx = p.x - c.cx;
          if (Math.abs(dx) > rPared) {
            const sgn = dx >= 0 ? 1 : -1;
            p.x = c.cx + sgn * rPared;
            // En la mitad inferior del cáliz la pared curva empuja también hacia el centro/arriba
            if (p.y > c.yVientre) {
              p.vy -= Math.abs(dx - sgn * rPared) * 0.08;
            }
            if (p.vx * sgn > 0) {
              p.vx = -p.vx * 0.15;
              p.vy *= 0.94;
            }
          }
        } else {
          // Desborde por encima de la boca
          const dx = p.x - c.cx;
          if (Math.abs(dx) > c.rBorde - p.r * 0.4 || c.particulasDentro > c.capacidad * 1.32) {
            p.copa = null;
            p.desbordada = true;
            const sgn = dx >= 0 ? 1 : -1;
            p.vx = sgn * (1.5 + Math.random() * 1.2);
            p.vy = Math.min(p.vy, -0.5);
            c.sobrante = (c.sobrante || 0) + 1;
          }
        }
      }
    }

    // 5) Recuento de partículas por copa
    for (let k = 0; k < E.copasArr.length; k++) {
      E.copasArr[k].particulasDentro = 0;
    }

    for (let i = E.particulas.length - 1; i >= 0; i--) {
      const p = E.particulas[i];
      if (p.vidaMesa > 0) {
        p.vidaMesa -= dt;
        if (p.vidaMesa <= 0) {
          E.particulas.splice(i, 1);
          continue;
        }
      }
      if (!p.copa && (p.y > E.alto + 30 || p.x < -50 || p.x > E.ancho + 50)) {
        E.particulas.splice(i, 1);
        continue;
      }
      if (p.copa) {
        if (!E.copasArr.includes(p.copa)) {
          E.particulas.splice(i, 1);
          continue;
        }
        p.copa.particulasDentro++;
      }
    }
  }

  // ---------------- BOTELLAS ----------------
  function anguloBaseBotella(x) {
    if (!CFG.inclinarbotella) return 0;
    return x < E.ancho * 0.5 ? -Math.PI / 4 : Math.PI / 4;
  }

  function crearBotella(id, x) {
    const bx = Math.max(10, Math.min(E.ancho - 10, x));
    const b = {
      id: id,
      x: bx,
      vx: 0, prevX: bx, tilt: 0,
      inclinacionBase: anguloBaseBotella(bx),
      alfa: 0, alfaObj: 1
    };
    b.prevX = b.x;
    return b;
  }

  function botellaDe(id) {
    const key = String(id);
    return E.botellas.find((b) => b.id === key) || null;
  }

  function abrirBotella(id, x) {
    let b = botellaDe(id);
    if (b) { b.alfaObj = 1; return b; }
    if (E.botellas.filter((x2) => x2.alfaObj > 0).length >= CFG.maxBotellas) return null;
    b = crearBotella(String(id), x);
    E.botellas.push(b);
    return b;
  }

  function cerrarBotella(id) {
    const b = botellaDe(id);
    if (b) b.alfaObj = 0;
  }

  // ---------------- ENTRADA ----------------
  function moverA(id, clientX) {
    const b = botellaDe(id);
    if (!b) return;
    const rect = SA.getBoundingClientRect();
    const margen = E.ancho * 0.05;
    const medio = (E.alto * 0.40 * 0.318) * 0.42;
    b.x = Math.max(margen + medio, Math.min(E.ancho - margen - medio, clientX - rect.left));
  }

  SA.addEventListener('pointerdown', (ev) => {
    try { SA.setPointerCapture?.(ev.pointerId); } catch (e) { }
    const esMouse = ev.pointerType === 'mouse' || ev.pointerType === 'pen';
    const id = esMouse ? 'mouse' : 'p' + ev.pointerId;
    const b = abrirBotella(id, ev.clientX - SA.getBoundingClientRect().left);
    if (b) moverA(id, ev.clientX);
  });

  SA.addEventListener('pointermove', (ev) => {
    const esMouse = ev.pointerType === 'mouse' || ev.pointerType === 'pen';
    const id = esMouse ? 'mouse' : 'p' + ev.pointerId;
    if (!botellaDe(id)) {
      if (esMouse && E.jugando && E.botellas.length < CFG.maxBotellas) {
        abrirBotella(id, ev.clientX - SA.getBoundingClientRect().left);
      } else return;
    }
    moverA(id, ev.clientX);
  });

  function soltar(ev) {
    const esMouse = ev.pointerType === 'mouse' || ev.pointerType === 'pen';
    if (esMouse) return;
    cerrarBotella('p' + ev.pointerId);
  }
  SA.addEventListener('pointerup', soltar);
  SA.addEventListener('pointercancel', soltar);
  SA.addEventListener('pointerleave', (ev) => { if (ev.pointerType !== 'mouse') cerrarBotella('p' + ev.pointerId); });

  window.addEventListener('touchmove', (ev) => {
    for (const t of ev.touches) moverA('p' + t.identifier, t.clientX);
  }, { passive: true });

  window.addEventListener('keydown', (ev) => {
    // Sin pausa: el kiosco no se detiene. (Espacio ya no hace nada.)
    if (ev.key === ' ' || ev.code === 'Space') { ev.preventDefault(); }
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      const b = E.botellas[0];
      if (b) moverA(b.id, b.x + (ev.key === 'ArrowLeft' ? -70 : 70) + SA.getBoundingClientRect().left);
    }
  });

  // ---------------- BUCLE ----------------
  function frame(t) {
    const dt = Math.min(48, t - (E.ultimo || t));
    E.ultimo = t;
    if (E.listo) {
      if (E.jugando && !E.pausado) paso(dt);
      dibujar(dt);
    }
    requestAnimationFrame(frame);
  }

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function salidaSuave(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function paso(dt) {
    E.restante -= dt;
    actualizarHud();
    if (E.restante <= 0) { E.restante = 0; terminar(); return; }

    for (let i = E.botellas.length - 1; i >= 0; i--) {
      const b = E.botellas[i];
      b.alfa += (b.alfaObj - b.alfa) * Math.min(1, dt / 140);
      if (b.alfaObj === 0 && b.alfa < 0.02) E.botellas.splice(i, 1);
    }

    E.tSpawn -= dt;
    if (E.tSpawn <= 0) {
      const libres = carrilesLibres();
      if (libres.length && copasEnJuego() < CFG.maxCopas) {
        const lane = libres[Math.floor(Math.random() * libres.length)];
        E.copasArr.push(crearCopa(centroCarril(lane), E.alto * CFG.pisoCopas, anchoCopa(), lane));
        E.tSpawn = CFG.esperaCopa[0] + Math.random() * (CFG.esperaCopa[1] - CFG.esperaCopa[0]);
      } else {
        E.tSpawn = 220;
      }
    }

    const pasosTiempo = Math.max(0.8, Math.min(2.4, dt / 16.67));

    const vivas = E.botellas.filter((b) => b.alfa > 0.35);
    const rGota = radioFisicoGota();
    const caudal = Math.max(1, Math.min(3, Math.round(CFG.gotasPorFrame)));

    vivas.forEach((b) => {
      const dxBotella = b.x - b.prevX;
      b.prevX = b.x;
      const vInst = dxBotella * (16.67 / Math.max(1, dt));
      b.vx = b.vx * 0.72 + vInst * 0.28;
      b.vx = Math.max(-80, Math.min(80, b.vx));

      const tiltObjetivo = Math.max(-0.2, Math.min(0.2, -b.vx * 0.006));
      b.tilt += (tiltObjetivo - b.tilt) * Math.min(1, dt / 110);

      const objBase = anguloBaseBotella(b.x);
      if (typeof b.inclinacionBase !== 'number') b.inclinacionBase = objBase;
      b.inclinacionBase += (objBase - b.inclinacionBase) * Math.min(1, dt / 95);

      const inercia = Math.max(-3.0, Math.min(3.0, b.vx * 0.14));
      const sacudida = Math.abs(b.vx);
      const dispersion = 0.20 + Math.min(0.95, sacudida * 0.025);
      const vyIni = 2.4 + Math.min(0.9, sacudida * 0.01);

      for (let i = 0; i < caudal; i++) {
        const frac = caudal > 1 ? i / caudal : 0;
        crearGota(
          b.x + (Math.random() - 0.5) * (rGota * 0.45),
          E.bocaY + frac * (rGota * 1.35),
          inercia + (Math.random() - 0.5) * dispersion,
          vyIni + frac * 0.35
        );
      }
    });

    for (let i = E.copasArr.length - 1; i >= 0; i--) {
      const c = E.copasArr[i];
      c.prevDy = c.dy;
      c.tEstado += dt;

      if (c.estado === 'entrando') {
        const t = Math.min(1, c.tEstado / 420);
        c.dy = c.alto * 0.95 * (1 - salidaSuave(t));
        c.escala = 1;
        if (t >= 1) { c.estado = 'activa'; c.tEstado = 0; c.dy = 0; }
      } else if (c.estado === 'activa') {
        c.dy = 0;
        c.escala = 1;
        c.vida -= dt;
      } else if (c.estado === 'llena') {
        const durLlena = 720;
        const p = Math.min(1, c.tEstado / durLlena);
        if (p < 0.48) {
          c.escala = 1 + 0.15 * easeInOutCubic(p / 0.48);
        } else {
          c.escala = 1 + 0.15 * (1 - easeInOutCubic((p - 0.48) / 0.52));
        }
        c.dy = 0;
        if (c.tEstado >= durLlena) {
          c.escala = 1;
          c.estado = 'saliendo';
          c.tEstado = 0;
        }
      } else if (c.estado === 'saliendo') {
        const t = Math.min(1, c.tEstado / 380);
        c.dy = c.alto * 0.98 * easeInOutCubic(t);
        c.escala = 1;
        if (c.tEstado >= 380) {
          for (let j = E.particulas.length - 1; j >= 0; j--) {
            if (E.particulas[j].copa === c) E.particulas.splice(j, 1);
          }
          E.copasArr.splice(i, 1);
          continue;
        }
      }

      c.deltaDy = c.dy - c.prevDy;
      if (c.temblor > 0) c.temblor -= dt;
      if (c.agit > 0) c.agit = Math.max(0, c.agit - dt / 900);
      ubicar(c);
    }

    simularFluido(dt, pasosTiempo);

    for (let i = E.copasArr.length - 1; i >= 0; i--) {
      const c = E.copasArr[i];
      if (c.estado === 'activa' || c.estado === 'llena' || c.estado === 'entrando') {
        actualizarCopa(c);
      }
      if (c.estado === 'activa' && c.vida <= 0) {
        copaPerdida(c);
      }
    }

    E.motas.forEach((m) => { m.y += m.v; if (m.y > E.alto) { m.y = -8; m.x = Math.random() * E.ancho; } });
    if (E.destello > 0) E.destello -= dt;
    for (let i = E.chispas.length - 1; i >= 0; i--) {
      const s = E.chispas[i];
      s.x += s.vx; s.y += s.vy; s.vy += 0.26; s.vida -= 0.022;
      if (s.vida <= 0) E.chispas.splice(i, 1);
    }
    for (let i = E.avisos.length - 1; i >= 0; i--) {
      const a = E.avisos[i];
      a.y -= dt * 0.035;
      a.vida -= dt;
      if (a.vida <= 0) E.avisos.splice(i, 1);
    }
  }

  function actualizarCopa(c) {
    // El nivel sólo sube: las partículas que rebotan pierden `copa` en algunos
    // frames y el recuento cae; si se usara el valor crudo la copa podía
    // "des-llenarse" un instante antes de quedar llena.
    const crudo = Math.min(1.3, c.particulasDentro / Math.max(1, c.capacidad));
    c.nivel = Math.max(c.nivel || 0, crudo);

    if (!c.llena && c.estado === 'activa' && c.nivel >= c.nivelObjetivo) {
      copaLlena(c);
      return;
    }

    // REGLA: llenar la copa NUNCA resta puntos. El desborde sólo penaliza
    // mientras se está sirviendo (copa activa); si la copa se llena en el
    // mismo frame en que se desborda, el jugador no pierde nada.
    if (!c.llena && c.estado === 'activa' && !c.desbordada && c.sobrante > CFG.sobranteDesborde) {
      c.desbordada = true;
      E.puntos = Math.max(0, E.puntos - CFG.penalidadDesborde);
      avisar(c.cx, c.yBorde - c.alto * 0.12, '−' + CFG.penalidadDesborde, '#ff7a8a');
      actualizarHud();
    }
  }

  function copaLlena(c) {
    c.llena = true;
    c.temblor = 0;
    c.estado = 'llena';
    c.tEstado = 0;
    c.escala = 1;

    const resto = Math.max(0, c.vida) / CFG.tiempoCopa;
    const bonus = Math.round(CFG.bonusMax * resto);
    const total = CFG.puntosCopa + bonus;
    E.puntos += total;
    E.copas++;
    E.destello = 280;

    for (let i = 0; i < 16; i++) {
      E.chispas.push({
        x: c.cx, y: c.yBorde + 18,
        vx: (Math.random() - 0.5) * 5.5, vy: -Math.random() * 6.5 - 1.8,
        vida: 0.95, color: Math.random() > 0.35 ? '#e8c477' : '#651204'
      });
    }
    avisar(c.cx, c.yBorde - c.alto * 0.1, '+' + total, '#f4d79b');
    actualizarHud();
  }

  function copaPerdida(c) {
    c.estado = 'saliendo';
    c.tEstado = 0;
    E.fallas++;
    E.puntos = Math.max(0, E.puntos - CFG.penalidadCopa);
    avisar(c.cx, c.yBorde - c.alto * 0.1, '−' + CFG.penalidadCopa, '#ff5d6c');
    actualizarHud();
  }

  function avisar(x, y, texto, color) {
    E.avisos.push({ x: x, y: y, texto: texto, color: color, vida: 1100, total: 1100 });
  }

  function dos(n) { return n < 10 ? '0' + n : String(n); }
  function tiempoTexto(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + dos(s % 60);
  }

  function actualizarHud() {
    document.getElementById('hudPuntos').textContent = E.puntos;
    document.getElementById('hudCopas').textContent = E.copas;
    const el = document.getElementById('hudTiempo');
    if (el) {
      el.textContent = tiempoTexto(E.restante);
      el.classList.toggle('poco', E.restante <= 10000);
    }
  }

  // ---------------- FONDO LIMPIO ----------------
  const FONDOS = ['img/fondo1.jpg', 'img/fondo2.jpg', 'img/fondo3.jpg'];

  function iniciarFondo() {
    const wrap = document.getElementById('fondoAgua');
    if (!wrap || !window.FondoAgua) return;
    if (!window.FondoAgua.disponible()) {
      if (window.FondoAgua.iniciar(wrap, E.ancho, E.alto)) {
        window.FondoAgua.cargar(FONDOS);
      }
    } else {
      window.FondoAgua.redimensionar(E.ancho, E.alto);
    }
  }

  // ---------------- DIBUJO ----------------
  function dibujar() {
    const W = E.ancho, H = E.alto;
    ctx.clearRect(0, 0, W, H);

    if (window.FondoAgua && window.FondoAgua.disponible()) {
      window.FondoAgua.dibujar();
    }

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(12,3,7,.18)');
    g.addColorStop(0.5, 'rgba(26,5,10,.08)');
    g.addColorStop(1, 'rgba(42,6,14,.16)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const halo = ctx.createRadialGradient(W * 0.5, H * 0.16, 10, W * 0.5, H * 0.16, W * 0.6);
    halo.addColorStop(0, 'rgba(232,196,119,.08)');
    halo.addColorStop(1, 'rgba(232,196,119,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    if (!E.motas.length) {
      for (let i = 0; i < 32; i++) {
        E.motas.push({ x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 1.8, v: 0.15 + Math.random() * 0.45 });
      }
    }
    ctx.fillStyle = 'rgba(255,245,220,.025)';
    E.motas.forEach((m) => { ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fill(); });

    const yMesa = H * CFG.pisoCopas;
    const mesa = ctx.createLinearGradient(0, yMesa - 14, 0, yMesa + 30);
    mesa.addColorStop(0, 'rgba(232,196,119,.22)');
    mesa.addColorStop(1, 'rgba(232,196,119,0)');
    ctx.fillStyle = mesa;
    ctx.fillRect(0, yMesa - 14, W, 46);

    const enCopas = [];
    const libres = [];
    for (let i = 0; i < E.particulas.length; i++) {
      const p = E.particulas[i];
      if (p.copa) {
        enCopas.push(p);
      } else {
        libres.push(p);
      }
    }

    const usaGL = !!(window.Fluido && window.Fluido.disponible());

    // 1) Dibujar el chorro libre que cae desde las botellas (detrás de las copas
    //    para que al entrar por la boca nunca pinte por fuera del borde del cáliz)
    if (libres.length > 0) {
      if (usaGL) {
        if (window.Fluido.renderizarGrupo(libres, W, H, 2.45)) {
          ctx.drawImage(window.Fluido.canvas(), 0, 0, W, H);
        }
      } else {
        dibujarGrupo2D(libres, 2.25);
      }
    }

    // 2) Renderizar las partículas dentro de las copas en el buffer WebGL
    let hayFluidoCopas = false;
    if (usaGL && enCopas.length > 0) {
      hayFluidoCopas = window.Fluido.renderizarGrupo(enCopas, W, H, 2.95);
    }

    // 3) Dibujar cada copa (cristal oscuro -> fluido recortado exactamente a la máscara -> reflejo)
    E.copasArr.forEach((c) => dibujarCopa(c, hayFluidoCopas, usaGL));

    // 4) Botellas con el logo oficial de Deli & Wine
    E.botellas.forEach((b) => dibujarBotella(b));

    // 5) Chispas
    E.chispas.forEach((s) => {
      ctx.globalAlpha = Math.max(0, s.vida);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2 + s.vida * 2.4, 0, 6.283);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // 6) Avisos flotantes
    E.avisos.forEach((a) => {
      const t = a.vida / a.total;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.font = '700 ' + Math.round(E.alto * 0.038) + 'px "Bebas Neue", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillText(a.texto, a.x + 2, a.y + 2);
      ctx.fillStyle = a.color;
      ctx.fillText(a.texto, a.x, a.y);
      ctx.globalAlpha = 1;
    });

    if (E.destello > 0) {
      ctx.fillStyle = 'rgba(232,196,119,' + (E.destello / 3400) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function dibujarGrupo2D(lista, kR) {
    ctx.save();
    ctx.fillStyle = '#450B02';
    ctx.beginPath();
    for (let i = 0; i < lista.length; i++) {
      const p = lista[i];
      const r = p.r * (kR || 2.35);
      ctx.moveTo(p.x + r, p.y);
      ctx.arc(p.x, p.y, r, 0, 6.283);
    }
    ctx.fill();
    ctx.restore();
  }

  function redondo(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function dibujarReloj(c) {
    if (c.estado !== 'activa' && c.estado !== 'llena') return;
    const frac = c.estado === 'llena' ? 1 : Math.max(0, c.vida / CFG.tiempoCopa);
    const seg = Math.ceil(Math.max(0, c.vida) / 1000);

    const bw = c.ancho * 0.66;
    const bh = Math.max(6, c.alto * 0.026);
    const bx = c.cx - bw / 2;
    const by = c.yBase + c.alto * 0.03 + c.dy;

    ctx.fillStyle = 'rgba(0,0,0,.55)';
    redondo(bx - 2, by - 2, bw + 4, bh + 4, (bh + 4) / 2);
    ctx.fill();

    const col = c.estado === 'llena'
      ? '#f4d79b'
      : (frac > 0.5 ? '#e8c477' : (frac > 0.25 ? '#f0a04b' : '#ff4f5f'));
    ctx.fillStyle = col;
    if (frac > 0.001) {
      redondo(bx, by, Math.max(bh, bw * frac), bh, bh / 2);
      ctx.fill();
    }

    if (c.estado === 'activa' && frac <= 0.25) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 120) * 0.3;
      ctx.fillStyle = '#ff4f5f';
      redondo(bx - 4, by - 4, bw + 8, bh + 8, (bh + 8) / 2);
      ctx.fill();
      ctx.restore();
    }

    if (c.estado === 'activa') {
      ctx.save();
      ctx.font = '700 ' + Math.round(c.alto * 0.11) + 'px "Bebas Neue", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.7)';
      const ty = c.yBorde - c.alto * 0.075;
      ctx.fillText(seg + 's', c.cx + 2, ty + 2);
      ctx.fillStyle = col;
      ctx.fillText(seg + 's', c.cx, ty);
      ctx.restore();
    }
  }

  function dibujarCopa(c, hayFluidoCopas, usaGL) {
    const sp = c.sprite;
    const esc = c.escala || 1;
    const pivoteY = (c.yBorde + c.yFondo) * 0.5;

    // Sombra en la mesa
    ctx.save();
    ctx.globalAlpha = 0.35 * (c.dy >= 0 ? Math.max(0, 1 - c.dy / (c.alto * 0.6)) : 1);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(c.cx, c.yBase - 4, c.ancho * 0.16 * esc, c.ancho * 0.035, 0, 0, 6.283);
    ctx.fill();
    ctx.restore();

    ctx.save();
    if (Math.abs(esc - 1) > 0.001) {
      ctx.translate(c.cx, pivoteY);
      ctx.scale(esc, esc);
      ctx.translate(-c.cx, -pivoteY);
    }

    // 1) Copa base oscura (sin el relleno blanco de copa-vacia.png)
    const imgBase = SPRITE_COPA_OSCURA || IMG.copaVacia;
    if (imgBase) {
      ctx.drawImage(imgBase, sp.x, sp.y, sp.w, sp.h);
    }

    // (La linea punteada que marcaba el nivel objetivo se saco: el propio
    // borde del vino es la marca. Pedido del duenio.)

    // 2) Fluido de partículas colisionando estrictamente recortado al interior de la copa
    if (c.particulasDentro > 0) {
      ctx.save();
      trazarInteriorCopa(ctx, c);
      ctx.clip();

      if (usaGL && hayFluidoCopas) {
        ctx.drawImage(window.Fluido.canvas(), 0, 0, E.ancho, E.alto);
      } else {
        const propias = E.particulas.filter((p) => p.copa === c);
        dibujarGrupo2D(propias, 2.15);
      }
      ctx.restore();
    }

    // 3) Contorno oscuro del cristal y brillo especular sutil por delante del vino
    if (SPRITE_COPA_REFLEJO) {
      ctx.drawImage(SPRITE_COPA_REFLEJO, sp.x, sp.y, sp.w, sp.h);
    }

    // Aro dorado en la boca cuando la copa se llena
    if (c.llena) {
      ctx.save();
      ctx.globalAlpha = 0.65 + Math.sin(performance.now() / 180) * 0.25;
      ctx.strokeStyle = '#e8c477';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(c.cx, c.yBorde + 1, c.rBorde * 0.98, 4.2, 0, 0, 6.283);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    dibujarReloj(c);
  }

  function dibujarBotella(b) {
    if (!(IMG.botella.complete && IMG.botella.naturalWidth)) return;
    const alto = E.alto * 0.40;
    const ancho = alto * (121 / 431);

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, b.alfa));
    ctx.translate(b.x, E.bocaY);
    const inc = typeof b.inclinacionBase === 'number' ? b.inclinacionBase : anguloBaseBotella(b.x);
    ctx.rotate(Math.PI + inc + b.tilt);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.85)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    // Recorte simétrico respecto al centro real de botella.png (cx=251.5, x=191..312)
    ctx.drawImage(IMG.botella, 191, 62, 121, 431, -ancho / 2, 0, ancho, alto);

    if (ETQ) {
      const wEtq = ancho * 0.95;
      const hEtq = alto * 0.25;
      ctx.save();
      ctx.translate(0, alto * 0.755);
      ctx.rotate(Math.PI);
      ctx.drawImage(ETQ, -wEtq / 2, -hEtq / 2, wEtq, hEtq);
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
  }

  // ---------------- FLUJO DE PARTIDA ----------------
  function empezar() {
    if (!E.listo) return;
    E.jugando = true;
    E.pausado = false;
    E.puntos = 0;
    E.copas = 0;
    E.fallas = 0;
    E.restante = CFG.duracion;
    E.chispas = [];
    E.avisos = [];
    E.copasArr = [];
    E.particulas = [];
    E.tSpawn = 350;

    const xIni = E.botellas[0] ? E.botellas[0].x : E.ancho / 2;
    E.botellas = [crearBotella('mouse', xIni)];
    E.botellas[0].alfa = 1;

    actualizarHud();
    document.getElementById('hud').classList.remove('hud-off');
    ['pantallaInicio', 'pantallaFin'].forEach((id) => {
      const p = document.getElementById(id);
      if (p) p.classList.remove('visible');
    });
    E.pausado = false;
  }

  // La pausa se saco del juego (pedido del duenio): el kiosco no pausa nunca.
  // Se conserva la funcion como no-op para que Space / botones viejos no rompan.
  function alternarPausa() {}

  function animarPuntaje(total) {
    const el = document.getElementById('finPuntos');
    const ini = performance.now();
    function tick(t) {
      const k = Math.min(1, (t - ini) / 900);
      const suave = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(total * suave);
      if (k < 1) requestAnimationFrame(tick);
    }
    el.textContent = '0';
    requestAnimationFrame(tick);
  }

  function terminar() {
    E.jugando = false;
    E.botellas = [];
    document.getElementById('hud').classList.add('hud-off');
    let record = 0;
    try { record = Number(localStorage.getItem('vinogame_wine_record') || 0); } catch (e) { }
    const nuevoRecord = E.puntos > record;
    if (nuevoRecord) {
      record = E.puntos;
      try { localStorage.setItem('vinogame_wine_record', String(record)); } catch (e) { }
    }

    animarPuntaje(E.puntos);
    document.getElementById('finCopas').textContent = E.copas;
    document.getElementById('finFallas').textContent = E.fallas;
    document.getElementById('finRecord').textContent = record;

    const medalla = document.getElementById('finMedalla');
    if (medalla) medalla.classList.toggle('nuevo-record', nuevoRecord);
    const cartel = document.getElementById('finCartel');
    if (cartel) cartel.textContent = nuevoRecord ? '¡NUEVO RÉCORD!' : 'TU MEJOR MARCA: ' + record;

    document.getElementById('pantallaFin').classList.add('visible');
  }

  function prepararEscenaCaptura() {
    const btnAj = document.getElementById('btnAjustes');
    if (btnAj) btnAj.style.display = 'none';
    if (location.search.indexOf('captura=fin') !== -1) {
      empezar();
      E.puntos = 480;
      E.copas = 4;
      E.fallas = 0;
      terminar();
      setTimeout(() => {
        document.getElementById('finPuntos').textContent = '480';
      }, 950);
      return;
    }
    empezar();
    E.tSpawn = 999999;
    E.copasArr = [0, 1, 2].map((lane) => {
      const c = crearCopa(centroCarril(lane), E.alto * CFG.pisoCopas, anchoCopa(), lane);
      c.estado = 'activa';
      c.dy = 0;
      ubicar(c);
      return c;
    });
    const cIzq = E.copasArr[0];
    const cMed = E.copasArr[1];
    const cDer = E.copasArr[2];
    if (E.botellas[0]) {
      E.botellas[0].x = cMed.cx;
      E.botellas[0].prevX = cMed.cx;
    }
    for (let step = 0; step < 30; step++) {
      paso(16.67);
    }
    const r = radioFisicoGota();
    const poblarCopa = (c, frac) => {
      const n = Math.round(c.capacidad * frac);
      for (let i = c.particulasDentro; i < n; i++) {
        const yf = 0.22 + ((i / Math.max(1, n)) * 0.25);
        const y = c.sprite.y + c.sprite.h * yf;
        const rInt = Math.max(4, radioInteriorCopa(c, y) - r * 1.15);
        const p = crearGota(c.cx + ((i * 37) % 100 / 50 - 1) * rInt * 0.82, y, 0, 0);
        p.copa = c;
        c.particulasDentro++;
      }
      c.nivel = frac;
      c.estado = 'activa';
      c.llena = false;
      c.dy = 0;
      c.vida = 7200;
    };
    poblarCopa(cIzq, 0.28);
    poblarCopa(cMed, 0.52);
    poblarCopa(cDer, 0.82);
    for (let step = 0; step < 6; step++) {
      simularFluido(16.67, 1);
    }
    E.avisos = [{ x: cDer.cx, y: cDer.yBorde - cDer.alto * 0.22, texto: '+140', color: '#f4d79b', vida: 1050, total: 1100 }];
    E.puntos = 280;
    E.copas = 2;
    E.restante = 48000;
    E.jugando = false; // Congelar el frame exacto para la captura
    const hudEl = document.getElementById('hud');
    if (hudEl) { hudEl.style.transition = 'none'; hudEl.classList.remove('hud-off'); }
    actualizarHud();
    dibujar();
  }

  document.getElementById('btnJugar').addEventListener('click', empezar);
  document.getElementById('btnOtra').addEventListener('click', empezar);
  [['btnSeguir', alternarPausa], ['btnReiniciar', empezar], ['btnPausa', alternarPausa]].forEach(([id, fn]) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', fn);
  });

  const chkInclinar = document.getElementById('chkInclinarBotella');
  if (chkInclinar) {
    chkInclinar.checked = !!CFG.inclinarbotella;
    chkInclinar.addEventListener('change', () => {
      CFG.inclinarbotella = !!chkInclinar.checked;
    });
  }

  let tRes = null;
  window.addEventListener('resize', () => { clearTimeout(tRes); tRes = setTimeout(ajustarTamano, 180); });

  ajustarTamano();
  requestAnimationFrame(frame);

  window.VinoGame = {
    estado: E,
    cfg: CFG,
    empezar: empezar,
    gotas: () => E.particulas.length,
    botellas: () => E.botellas.map((b) => ({ id: b.id, x: Math.round(b.x), alfa: +b.alfa.toFixed(2) })),
    fondo: () => (window.FondoAgua ? window.FondoAgua.estado() : { listo: false }),
    punterosFondo: () => 0,
    evento: (nombre) => {
      E.evento = String(nombre || '').trim().toUpperCase().slice(0, 22) || 'DELI & WINE';
      prepararEtiqueta();
      pintarEvento();
      return E.evento;
    },
    copas: () => E.copasArr.map((c) => ({
      lane: c.lane,
      estado: c.estado,
      particulas: c.particulasDentro,
      capacidad: c.capacidad,
      nivel: +c.nivel.toFixed(2),
      escala: +c.escala.toFixed(3),
      vida: Math.round(c.vida)
    })),
    apuntar: (i) => { const b = E.botellas[0]; const c = E.copasArr[i || 0]; if (b && c) b.x = c.cx; },
    vencer: (i) => { const c = E.copasArr[i || 0]; if (c && c.estado === 'activa') copaPerdida(c); },
    llenar: (i) => {
      const c = E.copasArr[i || 0];
      if (c && c.estado === 'activa') {
        const r = radioFisicoGota();
        while (c.particulasDentro < c.capacidad) {
          const p = crearGota(
            c.cx + (Math.random() - 0.5) * c.rBorde * 0.9,
            c.yVientre + (Math.random() - 0.5) * (c.yFondo - c.yBorde) * 0.35,
            0, 0
          );
          p.copa = c;
          p.r = r;
          c.particulasDentro++;
        }
        c.nivel = 1;
        copaLlena(c);
      }
    },
    terminar: terminar
  };
})();
