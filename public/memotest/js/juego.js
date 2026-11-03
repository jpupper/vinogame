/* ============================================================
   DELI & WINE · MEMOTEST
   Encontrá los pares de botellas en 60 segundos. Cada viña tiene su etiqueta.
   ============================================================ */
(function () {
  'use strict';

  const $ = (sel, raiz) => (raiz || document).querySelector(sel);

  const PROPORCION = 0.76; // ancho / alto ideal de cada carta
  const CLAVE_RECORDS = 'deliwine.memotest.v1';
  const CLAVE_CFG = 'deliwine.memotest.cfg.v1';
  const PARES_UNICO = 6; // Dificultad unificada (6 pares = 12 cartas)
  const TIEMPO_MAX = 60000; // 60 segundos máximo por partida

  const CFG_DEF = {
    escala: 1,
    offsetX: 0,
    offsetY: 0
  };

  const CFG = Object.assign({}, CFG_DEF, leerCfg());

  const E = {
    nivel: PARES_UNICO,
    cartas: [],
    abiertas: [],
    bloqueado: true,
    jugando: false,
    movimientos: 0,
    encontrados: 0,
    puntos: 0,
    combo: 0,
    inicio: 0,
    ms: 0,
    restante: TIEMPO_MAX,
    reloj: null,
    timerFalla1: 0,
    timerFalla2: 0
  };

  const el = {
    hud: $('#hud'),
    tablero: $('#tablero'),
    tableroWrap: $('#tableroWrap'),
    zona: $('#zona'),
    pantallaInicio: $('#pantallaInicio'),
    pantallaFin: $('#pantallaFin'),
    hudPuntos: $('#hudPuntos'),
    hudPares: $('#hudPares'),
    hudMov: $('#hudMov'),
    hudTiempo: $('#hudTiempo'),
    cargando: $('#cargando'),
    capaFlotantes: $('#capaFlotantes'),
    btnJugar: $('#btnJugar'),
    btnOtra: $('#btnOtra'),
    btnReiniciar: $('#btnReiniciar'),
    btnSalir: $('#btnSalir'),
    finPuntos: $('#finPuntos'),
    finCartel: $('#finCartel'),
    finMedalla: $('#finMedalla'),
    finPares: $('#finPares'),
    finMov: $('#finMov'),
    finTiempo: $('#finTiempo'),
    finRecord: $('#finRecord'),
    finBonus: $('#finBonus'),
    finKicker: $('#finKicker'),
    panelCfgCartas: $('#panelCfgCartas'),
    btnCerrarCfgCartas: $('#btnCerrarCfgCartas'),
    btnResetCfgCartas: $('#btnResetCfgCartas'),
    inpCfgTam: $('#inpCfgTam'),
    inpCfgOffX: $('#inpCfgOffX'),
    inpCfgOffY: $('#inpCfgOffY'),
    valCfgTam: $('#valCfgTam'),
    valCfgOffX: $('#valCfgOffX'),
    valCfgOffY: $('#valCfgOffY')
  };

  let ultimoTam = { w: 0, h: 0, escala: 0 };
  let temporizadorAjuste = 0;

  // ── utilidades ───────────────────────────────────────────
  function barajar(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function mmss(ms, redondeoArriba) {
    const t = Math.max(0, redondeoArriba ? Math.ceil(ms / 1000) : Math.round(ms / 1000));
    const m = Math.floor(t / 60);
    const s = t % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function limpiarTimersFalla() {
    clearTimeout(E.timerFalla1);
    clearTimeout(E.timerFalla2);
    E.timerFalla1 = 0;
    E.timerFalla2 = 0;
  }

  function leerRecords() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_RECORDS)) || {};
    } catch (e) {
      return {};
    }
  }

  function guardarRecords(r) {
    try {
      localStorage.setItem(CLAVE_RECORDS, JSON.stringify(r));
    } catch (e) { /* modo privado: seguimos sin récord */ }
  }

  function leerCfg() {
    try {
      const raw = JSON.parse(localStorage.getItem(CLAVE_CFG));
      if (!raw || typeof raw !== 'object') return {};
      return {
        escala: Number.isFinite(Number(raw.escala)) ? Math.max(0.5, Math.min(1.6, Number(raw.escala))) : 1,
        offsetX: Number.isFinite(Number(raw.offsetX)) ? Math.max(-300, Math.min(300, Number(raw.offsetX))) : 0,
        offsetY: Number.isFinite(Number(raw.offsetY)) ? Math.max(-300, Math.min(300, Number(raw.offsetY))) : 0
      };
    } catch (e) {
      return {};
    }
  }

  function guardarCfg() {
    try {
      localStorage.setItem(CLAVE_CFG, JSON.stringify(CFG));
    } catch (e) { /* sin storage */ }
  }

  // ── HUD ──────────────────────────────────────────────────
  function pintarHUD() {
    el.hudPuntos.textContent = E.puntos;
    el.hudPares.textContent = E.encontrados + '/' + E.nivel;
    el.hudMov.textContent = E.movimientos;
    pintarTiempo();
  }

  function pintarTiempo() {
    el.hudTiempo.textContent = mmss(E.restante, true);
    el.hudTiempo.classList.toggle('poco', E.jugando && E.restante <= 10000);
  }

  // ── tablero ──────────────────────────────────────────────
  function calcularGrilla(n) {
    const caja = el.tableroWrap.getBoundingClientRect();
    const W = Math.max(200, caja.width - 4);
    const H = Math.max(200, caja.height - 4);
    const gap = Math.max(6, Math.min(16, Math.round(Math.min(W, H) * 0.017)));
    let mejor = null;

    for (let cols = 2; cols <= n; cols++) {
      if (n % cols) continue;
      const filas = n / cols;
      let ch = (H - gap * (filas - 1)) / filas;
      let cw = ch * PROPORCION;
      if (cw * cols + gap * (cols - 1) > W) {
        cw = (W - gap * (cols - 1)) / cols;
        ch = cw / PROPORCION;
      }
      if (cw < 34 || ch < 44) continue;
      const anchoTablero = cw * cols + gap * (cols - 1);
      const altoTablero = ch * filas + gap * (filas - 1);
      const aspecto = anchoTablero / altoTablero;
      if (aspecto < 0.55 || aspecto > 1.95) continue;
      const puntos = cw * ch;
      if (!mejor || puntos > mejor.puntos) {
        mejor = { cols: cols, filas: filas, cw: cw, ch: ch, gap: gap, puntos: puntos };
      }
    }

    if (!mejor) {
      const cols = Math.ceil(Math.sqrt(n * W / Math.max(1, H)));
      const filas = Math.ceil(n / cols);
      const cw = (W - gap * (cols - 1)) / cols;
      const ch = (H - gap * (filas - 1)) / filas;
      mejor = { cols: cols, filas: filas, cw: cw, ch: ch, gap: gap, puntos: 0 };
    }
    return mejor;
  }

  function aplicarOffsetsTablero() {
    if (!el.tablero) return;
    el.tablero.style.setProperty('--offset-x', Math.round(CFG.offsetX) + 'px');
    el.tablero.style.setProperty('--offset-y', Math.round(CFG.offsetY) + 'px');
  }

  function ajustarTablero(forzar) {
    aplicarOffsetsTablero();
    const n = E.cartas.length;
    if (!n) return;
    const caja = el.tableroWrap.getBoundingClientRect();
    if (!forzar &&
        el.tablero.style.width &&
        Math.abs(caja.width - ultimoTam.w) < 1 &&
        Math.abs(caja.height - ultimoTam.h) < 1 &&
        Math.abs(CFG.escala - ultimoTam.escala) < 0.001) return;
    ultimoTam = { w: caja.width, h: caja.height, escala: CFG.escala };

    const g = calcularGrilla(n);
    const esc = CFG.escala || 1;
    const cw = g.cw * esc;
    const ch = g.ch * esc;
    const gap = Math.max(4, Math.round(g.gap * esc));

    el.tablero.style.setProperty('--cols', g.cols);
    el.tablero.style.setProperty('--filas', g.filas);
    el.tablero.style.gap = gap + 'px';
    el.tablero.style.width = Math.round(cw * g.cols + gap * (g.cols - 1)) + 'px';
    el.tablero.style.height = Math.round(ch * g.filas + gap * (g.filas - 1)) + 'px';
    el.tablero.style.setProperty('--carta-w', Math.max(32, Math.round(cw)) + 'px');
    el.tablero.style.setProperty('--carta-h', Math.max(42, Math.round(ch)) + 'px');

    const ancho = Math.max(1, Math.floor(cw));
    const alto = Math.max(1, Math.floor(ch));
    E.cartas.forEach((c) => {
      if (!c.canvas) return;
      Botellas.frente(c.canvas, c.v, ancho, alto);
    });
  }

  function sincronizarPanelCfg() {
    if (!el.panelCfgCartas) return;
    el.inpCfgTam.value = CFG.escala;
    el.inpCfgOffX.value = CFG.offsetX;
    el.inpCfgOffY.value = CFG.offsetY;
    el.valCfgTam.textContent = Number(CFG.escala).toFixed(2) + '×';
    el.valCfgOffX.textContent = Math.round(CFG.offsetX) + ' px';
    el.valCfgOffY.textContent = Math.round(CFG.offsetY) + ' px';
  }

  function alternarPanelCfg(forzar) {
    if (!el.panelCfgCartas) return;
    const ver = typeof forzar === 'boolean' ? forzar : !el.panelCfgCartas.classList.contains('ver');
    el.panelCfgCartas.classList.toggle('ver', ver);
    el.panelCfgCartas.setAttribute('aria-hidden', ver ? 'false' : 'true');
  }

  function crearCarta(c, i) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'carta repartiendo';
    b.style.setProperty('--i', i);
    b.setAttribute('aria-label', 'Carta ' + (i + 1) + ', boca abajo');
    b.innerHTML =
      '<span class="carta-int">' +
        '<span class="cara dorso">' +
          '<img class="dorso-logo" src="img/logo.png" alt="">' +
          '<span class="dorso-txt">MEMOTEST</span>' +
        '</span>' +
        '<span class="cara frente">' +
          '<canvas aria-hidden="true"></canvas>' +
          '<span class="sello" aria-hidden="true">✓</span>' +
        '</span>' +
      '</span>';
    b.addEventListener('animationend', (ev) => {
      if (ev.animationName === 'repartir') {
        b.classList.remove('repartiendo');
      }
    });
    b.addEventListener('click', () => voltear(i));
    c.el = b;
    c.canvas = b.querySelector('canvas');
    return b;
  }

  function nuevaPartida() {
    limpiarTimersFalla();
    clearInterval(E.reloj);
    E.reloj = null;

    const pares = PARES_UNICO;
    E.nivel = pares;
    E.cartas = [];
    E.abiertas = [];
    E.bloqueado = false;
    E.jugando = true;
    E.movimientos = 0;
    E.encontrados = 0;
    E.puntos = 0;
    E.combo = 0;
    E.inicio = 0;
    E.ms = 0;
    E.restante = TIEMPO_MAX;

    // una viña por par, distinta en cada partida
    const vinas = barajar(Botellas.VARIETALES.slice()).slice(0, pares);
    const mazo = [];
    vinas.forEach((v) => {
      mazo.push({ v: v, id: v.id });
      mazo.push({ v: v, id: v.id });
    });
    barajar(mazo);

    el.tablero.innerHTML = '';
    el.capaFlotantes.innerHTML = '';
    mazo.forEach((c, i) => {
      E.cartas.push(c);
      el.tablero.appendChild(crearCarta(c, i));
    });

    el.pantallaInicio.classList.remove('visible');
    el.pantallaFin.classList.remove('visible');
    el.hud.classList.remove('hud-off');

    void el.tableroWrap.offsetHeight;
    ultimoTam = { w: 0, h: 0, escala: 0 };
    ajustarTablero(true);
    requestAnimationFrame(() => {
      ajustarTablero(true);
      requestAnimationFrame(() => ajustarTablero(true));
    });
    pintarHUD();
    arrancarReloj();
  }

  // ── juego ────────────────────────────────────────────────
  function arrancarReloj() {
    if (E.reloj) clearInterval(E.reloj);
    E.inicio = performance.now();
    E.reloj = setInterval(() => {
      if (!E.jugando) return;
      E.ms = performance.now() - E.inicio;
      E.restante = Math.max(0, TIEMPO_MAX - E.ms);
      pintarTiempo();
      if (E.restante <= 0) {
        terminar(true);
      }
    }, 100);
  }

  function voltear(i) {
    if (!E.jugando || E.bloqueado) return;
    const c = E.cartas[i];
    if (!c || c.volteada || c.encontrada) return;

    if (!E.inicio) arrancarReloj();

    c.volteada = true;
    c.el.classList.remove('repartiendo', 'falla');
    c.el.classList.add('volteada');
    c.el.setAttribute('aria-label', c.v.nombre);
    E.abiertas.push(i);

    if (E.abiertas.length === 2) {
      E.movimientos++;
      pintarHUD();
      const a = E.abiertas[0];
      const b = E.abiertas[1];
      if (E.cartas[a].v.id === E.cartas[b].v.id) acierto(a, b);
      else falla(a, b);
    }
  }

  function acierto(a, b) {
    E.combo++;
    const bonus = Math.min(4, E.combo - 1) * 25;
    const suma = 100 + bonus;
    E.puntos += suma;
    E.encontrados++;

    [a, b].forEach((i) => {
      const c = E.cartas[i];
      c.encontrada = true;
      c.el.classList.add('acierto');
      c.el.setAttribute('aria-label', c.v.nombre + ', encontrado');
    });

    E.abiertas = [];
    pintarHUD();
    sumarFlotante(E.cartas[b].el, '+' + suma);
    E.bloqueado = false;

    if (E.encontrados === E.nivel) terminar(false);
  }

  function falla(a, b) {
    E.bloqueado = true;
    E.combo = 0;
    limpiarTimersFalla();

    // Esperamos un instante a que la segunda carta termine de girar para que el
    // jugador vea la cepa y enseguida sacudimos ambas cartas con borde rojo.
    E.timerFalla1 = setTimeout(() => {
      if (!E.jugando) return;
      [a, b].forEach((i) => {
        const c = E.cartas[i];
        if (!c || !c.el) return;
        c.el.classList.remove('repartiendo', 'falla');
        void c.el.offsetWidth; // reflow para reiniciar animación limpio
        c.el.classList.add('falla');
      });
    }, 280);

    E.timerFalla2 = setTimeout(() => {
      if (!E.jugando) return;
      [a, b].forEach((i) => {
        const c = E.cartas[i];
        if (!c || !c.el) return;
        c.volteada = false;
        c.el.classList.remove('volteada', 'falla');
        c.el.setAttribute('aria-label', 'Carta ' + (i + 1) + ', boca abajo');
      });
      E.abiertas = [];
      E.bloqueado = false;
    }, 880);
  }

  function sumarFlotante(cartaEl, texto) {
    if (!cartaEl) return;
    const r = cartaEl.getBoundingClientRect();
    const z = el.tableroWrap.getBoundingClientRect();
    const d = document.createElement('span');
    d.className = 'flotante';
    d.textContent = texto;
    d.style.left = (r.left - z.left + r.width / 2) + 'px';
    d.style.top = (r.top - z.top + r.height * 0.4) + 'px';
    el.capaFlotantes.appendChild(d);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 900);
  }

  // ── fin de partida ───────────────────────────────────────
  function terminar(porTiempo) {
    if (!E.jugando) return;
    E.jugando = false;
    E.bloqueado = true;
    limpiarTimersFalla();

    if (porTiempo) {
      E.ms = TIEMPO_MAX;
      E.restante = 0;
    } else if (E.inicio) {
      E.ms = Math.min(TIEMPO_MAX, performance.now() - E.inicio);
      E.restante = Math.max(0, TIEMPO_MAX - E.ms);
    }
    clearInterval(E.reloj);
    E.reloj = null;
    pintarTiempo();

    const completo = !porTiempo && E.encontrados === E.nivel;
    const eficiencia = completo ? Math.max(0, E.nivel * 2 - E.movimientos) * 40 : 0;
    const total = E.puntos + eficiencia;

    const records = leerRecords();
    const previo = records[E.nivel];
    const esRecord = total > 0 && (!previo || total > previo.puntos);
    if (esRecord) {
      records[E.nivel] = { puntos: total, movimientos: E.movimientos, ms: Math.round(E.ms) };
      guardarRecords(records);
    }
    const record = records[E.nivel] ? records[E.nivel].puntos : total;

    el.finPuntos.textContent = '0';
    el.finPares.textContent = E.encontrados + '/' + E.nivel;
    el.finMov.textContent = E.movimientos;
    el.finTiempo.textContent = mmss(E.ms, false);
    el.finRecord.textContent = record;
    el.finBonus.textContent = eficiencia > 0 ? 'Eficiencia +' + eficiencia : '';
    el.finCartel.textContent = esRecord ? '¡NUEVO RÉCORD!' : 'TU MEJOR MARCA: ' + record;
    el.finMedalla.classList.toggle('nuevo-record', esRecord && !!previo);

    if (porTiempo && E.encontrados < E.nivel) {
      el.finKicker.textContent = '✦ SE TERMINÓ EL TIEMPO ✦';
    } else if (E.movimientos === E.nivel) {
      el.finKicker.textContent = '✦ MEMORIA PERFECTA ✦';
    } else {
      el.finKicker.textContent = '✦ BODEGA COMPLETA ✦';
    }

    setTimeout(() => {
      el.pantallaFin.classList.add('visible');
      el.hud.classList.add('hud-off');
      animarPuntaje(total);
    }, porTiempo ? 380 : 760);
  }

  function animarPuntaje(total) {
    const desde = performance.now();
    const dur = 900;
    function paso(ahora) {
      const k = Math.min(1, (ahora - desde) / dur);
      const suave = 1 - Math.pow(1 - k, 3);
      el.finPuntos.textContent = Math.round(total * suave);
      if (k < 1) requestAnimationFrame(paso);
      else el.finPuntos.textContent = total;
    }
    requestAnimationFrame(paso);
  }

  // ── pantallas ────────────────────────────────────────────
  function volverAlInicio() {
    E.jugando = false;
    E.bloqueado = true;
    limpiarTimersFalla();
    clearInterval(E.reloj);
    E.reloj = null;
    E.restante = TIEMPO_MAX;
    el.pantallaFin.classList.remove('visible');
    el.pantallaInicio.classList.add('visible');
    el.hud.classList.add('hud-off');
    el.capaFlotantes.innerHTML = '';
  }

  // ── eventos ──────────────────────────────────────────────
  function enganchar() {
    el.btnJugar.addEventListener('click', () => nuevaPartida());
    el.btnOtra.addEventListener('click', () => nuevaPartida());
    el.btnSalir.addEventListener('click', volverAlInicio);
    el.btnReiniciar.addEventListener('click', () => {
      if (E.jugando) nuevaPartida();
    });

    if (el.panelCfgCartas) {
      sincronizarPanelCfg();
      el.inpCfgTam.addEventListener('input', () => {
        CFG.escala = Number(el.inpCfgTam.value) || 1;
        sincronizarPanelCfg();
        guardarCfg();
        ajustarTablero(true);
      });
      el.inpCfgOffX.addEventListener('input', () => {
        CFG.offsetX = Number(el.inpCfgOffX.value) || 0;
        sincronizarPanelCfg();
        guardarCfg();
        aplicarOffsetsTablero();
      });
      el.inpCfgOffY.addEventListener('input', () => {
        CFG.offsetY = Number(el.inpCfgOffY.value) || 0;
        sincronizarPanelCfg();
        guardarCfg();
        aplicarOffsetsTablero();
      });
      el.btnCerrarCfgCartas.addEventListener('click', () => alternarPanelCfg(false));
      el.btnResetCfgCartas.addEventListener('click', () => {
        Object.assign(CFG, CFG_DEF);
        sincronizarPanelCfg();
        guardarCfg();
        ajustarTablero(true);
      });
    }

    document.addEventListener('keydown', (ev) => {
      const tag = ev.target && ev.target.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && (ev.key === 'p' || ev.key === 'P')) {
        ev.preventDefault();
        alternarPanelCfg();
        return;
      }
      if (ev.key === 'Escape') {
        if (el.panelCfgCartas && el.panelCfgCartas.classList.contains('ver')) {
          alternarPanelCfg(false);
          return;
        }
        if (el.pantallaFin.classList.contains('visible')) volverAlInicio();
      }
      if (ev.key === 'Enter' && el.pantallaInicio.classList.contains('visible') && !el.btnJugar.disabled) {
        nuevaPartida();
      }
    });

    function agendarAjuste() {
      clearTimeout(temporizadorAjuste);
      temporizadorAjuste = setTimeout(() => requestAnimationFrame(() => ajustarTablero(false)), 70);
    }
    if (window.ResizeObserver) {
      new ResizeObserver(agendarAjuste).observe(el.tableroWrap);
    }
    window.addEventListener('resize', agendarAjuste);
    window.addEventListener('orientationchange', agendarAjuste);
  }

  // ── arranque ─────────────────────────────────────────────
  function arrancar() {
    enganchar();
    aplicarOffsetsTablero();
    el.hudPares.textContent = '0/' + PARES_UNICO;
    Botellas.cargar()
      .then(() => {
        el.cargando.classList.remove('visible');
        el.btnJugar.disabled = false;
        el.btnJugar.textContent = 'JUGAR';
        if (location.search.indexOf('captura=1') !== -1) {
          nuevaPartida();
          E.cartas.forEach((c, idx) => {
            if (idx < 6) {
              c.volteada = true;
              c.el.classList.remove('repartiendo');
              c.el.classList.add('volteada');
            }
          });
          if (location.search.indexOf('panel=1') !== -1) {
            alternarPanelCfg(true);
          }
        }
      })
      .catch((err) => {
        el.cargando.innerHTML = 'NO SE PUDIERON CARGAR LAS BOTELLAS<br><small>' +
          (err && err.message ? err.message : '') + '</small>';
        console.error(err);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else arrancar();

  // API para probar sin jugar (consola):
  window.Memotest = {
    estado: E,
    cfg: CFG,
    empezar: () => nuevaPartida(),
    cartas: () => E.cartas.map((c, i) => ({
      i: i, id: c.v.id, nombre: c.v.nombre,
      volteada: !!c.volteada, encontrada: !!c.encontrada
    })),
    girar: (i) => voltear(i),
    vencerTiempo: () => { E.restante = 0; terminar(true); },
    resolver: () => {
      const porId = {};
      E.cartas.forEach((c, i) => { (porId[c.v.id] = porId[c.v.id] || []).push(i); });
      Object.values(porId).forEach(([a, b]) => {
        if (!E.cartas[a].encontrada) { voltear(a); E.bloqueado = false; voltear(b); E.bloqueado = false; }
      });
    }
  };
})();
