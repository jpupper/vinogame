/* ============================================================
   FONDO · Fotografías de viñedo con crossfade suave
   ------------------------------------------------------------
   Se eliminó por completo el displace de agua y la visualización
   del fluido en el shader de fondo: el fondo ahora muestra las
   imágenes del viñedo limpias, con proporción cover, viñeta
   atmosférica suave y transición entre fotos.
   ============================================================ */
(function () {
  'use strict';

  const P = {
    tinte: 0.22,
    brillo: 0.88,
    vineta: 0.45
  };

  const F = {
    canvas: null,
    ctx: null,
    res: { w: 0, h: 0 },
    dpr: 1,
    imagenes: [],
    idx: 0,
    mezcla: 0,
    tUltimoCambio: 0,
    intervalo: 16000,
    listo: false,
    frame: 0
  };

  function iniciar(contenedor, ancho, alto) {
    if (F.canvas) {
      redimensionar(ancho, alto);
      return true;
    }
    const c = document.createElement('canvas');
    c.id = 'fondoAguaCanvas';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    contenedor.appendChild(c);

    const ctx = c.getContext('2d');
    if (!ctx) return false;

    F.canvas = c;
    F.ctx = ctx;
    F.listo = true;
    redimensionar(ancho, alto);
    return true;
  }

  function redimensionar(ancho, alto) {
    if (!F.listo || !F.canvas) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.max(160, Math.round(ancho * dpr));
    const h = Math.max(160, Math.round(alto * dpr));
    if (F.res.w === w && F.res.h === h) return;

    F.dpr = dpr;
    F.res = { w: w, h: h };
    F.canvas.width = w;
    F.canvas.height = h;
    F.canvas.style.width = ancho + 'px';
    F.canvas.style.height = alto + 'px';
  }

  function cargar(urls) {
    F.imagenes = [];
    urls.forEach((u, i) => {
      const img = new Image();
      img.onload = () => {
        F.imagenes[i] = {
          img: img,
          ar: img.naturalWidth / Math.max(1, img.naturalHeight),
          ok: true
        };
      };
      img.onerror = () => console.warn('fondo: no se pudo cargar', u);
      img.src = u;
    });
  }

  function dibujarCover(ctx, imgObj, w, h, alfa) {
    if (!imgObj || !imgObj.ok || !imgObj.img) return;
    const img = imgObj.img;
    const iw = img.naturalWidth || 1;
    const ih = img.naturalHeight || 1;
    const escala = Math.max(w / iw, h / ih);
    const dw = iw * escala;
    const dh = ih * escala;
    const dx = (w - dw) * 0.5;
    const dy = (h - dh) * 0.42;

    ctx.save();
    ctx.globalAlpha = alfa;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  function dibujar() {
    if (!F.listo || !F.ctx) return;
    const ctx = F.ctx;
    const w = F.res.w;
    const h = F.res.h;
    const t = performance.now() / 1000;
    F.frame++;

    // Base oscura borgoña
    ctx.fillStyle = '#140407';
    ctx.fillRect(0, 0, w, h);

    // Crossfade entre imágenes cargadas
    const listas = F.imagenes.filter((i) => i && i.ok);
    if (listas.length > 1) {
      if (!F.tUltimoCambio) F.tUltimoCambio = t;
      const dt = t - F.tUltimoCambio;
      const desde = (F.intervalo / 1000) * 0.78;
      const dur = (F.intervalo / 1000) * 0.22;
      F.mezcla = dt < desde ? 0 : Math.min(1, (dt - desde) / dur);
      if (F.mezcla >= 1) {
        F.idx = (F.idx + 1) % F.imagenes.length;
        F.mezcla = 0;
        F.tUltimoCambio = t;
      }
    } else {
      F.mezcla = 0;
      F.tUltimoCambio = t;
    }

    const imgA = (F.imagenes[F.idx] && F.imagenes[F.idx].ok) ? F.imagenes[F.idx] : listas[0];
    const sigIdx = (F.idx + 1) % Math.max(1, F.imagenes.length);
    const imgB = (F.imagenes[sigIdx] && F.imagenes[sigIdx].ok) ? F.imagenes[sigIdx] : imgA;

    if (imgA) {
      dibujarCover(ctx, imgA, w, h, P.brillo);
      if (imgB && imgB !== imgA && F.mezcla > 0.001) {
        dibujarCover(ctx, imgB, w, h, F.mezcla * P.brillo);
      }
    }

    // Tinte cálido de bodega + viñeta suave para que las copas y el vino #450B02 resalten
    if (P.tinte > 0) {
      ctx.fillStyle = 'rgba(28, 5, 8, ' + Math.min(0.85, P.tinte) + ')';
      ctx.fillRect(0, 0, w, h);
    }

    const rad = ctx.createRadialGradient(w * 0.5, h * 0.42, Math.min(w, h) * 0.18, w * 0.5, h * 0.48, Math.max(w, h) * 0.75);
    rad.addColorStop(0, 'rgba(10, 2, 4, 0.10)');
    rad.addColorStop(1, 'rgba(6, 1, 2, ' + Math.min(0.92, 0.42 + P.vineta * 0.45) + ')');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, w, h);
  }

  window.FondoAgua = {
    iniciar: iniciar,
    redimensionar: redimensionar,
    cargar: cargar,
    dibujar: dibujar,
    params: P,
    setIntervalo: (ms) => { F.intervalo = Math.max(3000, Math.min(120000, ms | 0)); },
    intervalo: () => F.intervalo,
    fondos: () => F.imagenes.map((i) => (i && i.ok ? 'ok' : 'pendiente')),
    estado: () => ({
      listo: F.listo,
      res: F.res,
      imagenes: F.imagenes.map((i) => (i && i.ok ? 'ok' : 'pendiente')),
      indice: F.idx,
      mezcla: +F.mezcla.toFixed(2),
      frame: F.frame
    }),
    disponible: () => F.listo
  };
})();
