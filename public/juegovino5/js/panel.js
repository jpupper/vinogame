/* ============================================================
   PANEL DE AJUSTES DE SERVE WINE
   ------------------------------------------------------------
   Un panel (tecla P o el botón ⚙) con TODAS las variables del juego:
   agua, vino, reglas de la partida, rotación de fondos y nombre del evento.

   · Los sliders aplican EN VIVO (no hace falta recargar).
   · GUARDAR deja la config en localStorage; RESET vuelve a los defaults.
   · Sin alert/confirm/prompt: el aviso va en una línea de estado del panel.
   ============================================================ */
(function () {
  'use strict';

  const CLAVE = 'vinowine:cfg:v1';

  // sec: 'vino' · 'juego' (VinoGame.cfg) · 'fondo' (FondoAgua.params)
  const CAMPOS = [
    { sec: 'VINO', k: 'gotasPorFrame', etq: 'Caudal del chorro', min: 1, max: 4, paso: 1 },
    { sec: 'VINO', k: 'capacidadCopa', etq: 'Partículas para llenar copa', min: 25, max: 90, paso: 1 },
    { sec: 'JUEGO', k: 'duracion', etq: 'Duración (segundos)', min: 15, max: 180, paso: 5, escala: 1000, unidad: 's' },
    { sec: 'JUEGO', k: 'tiempoCopa', etq: 'Reloj por copa (s)', min: 3, max: 20, paso: 0.5, escala: 1000, unidad: 's' },
    { sec: 'JUEGO', k: 'maxCopas', etq: 'Copas a la vez', min: 1, max: 5, paso: 1 },
    { sec: 'JUEGO', k: 'puntosCopa', etq: 'Puntos por copa', min: 10, max: 500, paso: 10 },
    { sec: 'JUEGO', k: 'bonusMax', etq: 'Bonus máximo', min: 0, max: 300, paso: 5 },
    { sec: 'JUEGO', k: 'penalidadCopa', etq: 'Penalidad por vencer', min: 0, max: 300, paso: 5 },
    { sec: 'JUEGO', k: 'penalidadDesborde', etq: 'Penalidad por desborde', min: 0, max: 300, paso: 5 },
    { sec: 'FONDO', k: 'tinte', etq: 'Oscuridad del fondo', min: 0, max: 0.7, paso: 0.02 },
    { sec: 'FONDO', k: 'intervalo', etq: 'Cambio de fondo (s)', min: 4, max: 60, paso: 1, escala: 1000, unidad: 's' }
  ];

  const DEFAULTS = {};
  let panel = null, abierto = false, estadoEl = null;

  function leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE) || '{}'); } catch (e) { return {}; }
  }
  function escribir(obj) {
    try { localStorage.setItem(CLAVE, JSON.stringify(obj)); } catch (e) { }
  }

  function agrupar(lista) {
    const out = {};
    lista.forEach((c) => { (out[c.sec] = out[c.sec] || []).push(c); });
    return out;
  }

  // ── aplicar un valor al sistema que corresponde ──
  function aplicar(campo, v) {
    const F = window.FondoAgua, V = window.VinoGame;
    if (!F || !V) return;
    if (campo.k === 'intervalo') { F.setIntervalo(v); return; }
    if (campo.sec === 'FONDO') { F.params[campo.k] = v; return; }
    if (campo.sec === 'JUEGO' || campo.sec === 'VINO') { V.cfg[campo.k] = v; return; }
  }

  function valorActual(campo) {
    const F = window.FondoAgua, V = window.VinoGame;
    if (!F || !V) return campo.min;
    if (campo.k === 'intervalo') return F.intervalo();
    if (campo.sec === 'FONDO') return F.params[campo.k];
    return V.cfg[campo.k];
  }

  function aviso(texto) {
    if (!estadoEl) return;
    estadoEl.textContent = texto;
    clearTimeout(aviso._t);
    aviso._t = setTimeout(() => { estadoEl.textContent = ''; }, 2600);
  }

  function fila(campo) {
    const wrap = document.createElement('label');
    wrap.className = 'cfg-fila';

    const cab = document.createElement('div');
    cab.className = 'cfg-cab';
    const nom = document.createElement('span');
    nom.textContent = campo.etq;
    const val = document.createElement('b');
    cab.appendChild(nom);
    cab.appendChild(val);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = campo.min;
    input.max = campo.max;
    input.step = campo.paso;

    const mostrar = (v) => {
      const n = campo.escala ? (v / campo.escala) : v;
      val.textContent = (campo.escala ? Math.round(n) : (Math.round(v * 100) / 100)) + (campo.unidad || '');
    };

    const ini = valorActual(campo);
    input.value = ini;
    mostrar(ini);

    input.addEventListener('input', () => {
      const v = Number(input.value);
      mostrar(v);
      aplicar(campo, v);
    });

    campo._input = input;
    campo._mostrar = mostrar;
    wrap.appendChild(cab);
    wrap.appendChild(input);
    return wrap;
  }

  function bloque(titulo, campos) {
    const sec = document.createElement('section');
    sec.className = 'cfg-sec';
    const h = document.createElement('h4');
    h.textContent = titulo;
    sec.appendChild(h);
    campos.forEach((c) => sec.appendChild(fila(c)));
    return sec;
  }

  function construir() {
    const cont = document.createElement('div');
    cont.id = 'panelCfg';
    cont.className = 'cfg-panel';
    cont.innerHTML = '';

    const head = document.createElement('header');
    head.className = 'cfg-head';
    head.innerHTML = '<strong>⚙ Ajustes del juego</strong>';
    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'cfg-x';
    cerrar.textContent = '✕';
    cerrar.addEventListener('click', () => alternar(false));
    head.appendChild(cerrar);
    cont.appendChild(head);

    const body = document.createElement('div');
    body.className = 'cfg-body';

    const grupos = agrupar(CAMPOS);
    ['VINO', 'JUEGO', 'FONDO'].forEach((sec) => {
      if (grupos[sec]) body.appendChild(bloque(sec, grupos[sec]));
    });

    // evento (texto) + logo
    const secEv = document.createElement('section');
    secEv.className = 'cfg-sec';
    secEv.innerHTML = '<h4>EVENTO</h4>';
    const lab = document.createElement('label');
    lab.className = 'cfg-fila';
    lab.innerHTML = '<div class="cfg-cab"><span>Nombre del evento (va con el logo)</span></div>';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'cfg-texto';
    inp.maxLength = 22;
    inp.value = window.VinoGame ? window.VinoGame.estado.evento : '';
    inp.addEventListener('input', () => {
      if (window.VinoGame) window.VinoGame.evento(inp.value);
    });
    lab.appendChild(inp);
    secEv.appendChild(lab);
    body.appendChild(secEv);

    cont.appendChild(body);

    const pie = document.createElement('footer');
    pie.className = 'cfg-pie';
    estadoEl = document.createElement('p');
    estadoEl.className = 'cfg-estado';

    const guardar = document.createElement('button');
    guardar.type = 'button';
    guardar.className = 'cfg-btn';
    guardar.textContent = 'GUARDAR';
    guardar.addEventListener('click', () => {
      const obj = {};
      CAMPOS.forEach((c) => { obj[c.sec + ':' + c.k] = valorActual(c); });
      obj.evento = window.VinoGame ? window.VinoGame.estado.evento : '';
      escribir(obj);
      aviso('Configuración guardada');
    });

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'cfg-btn cfg-btn-sec';
    reset.textContent = 'RESET';
    reset.addEventListener('click', () => {
      try { localStorage.removeItem(CLAVE); } catch (e) { }
      aviso('Volviendo a los valores por defecto…');
      setTimeout(() => location.reload(), 500);
    });

    pie.appendChild(guardar);
    pie.appendChild(reset);
    pie.appendChild(estadoEl);
    cont.appendChild(pie);

    document.body.appendChild(cont);
    return cont;
  }

  function cargar() {
    const g = leer();
    const F = window.FondoAgua, V = window.VinoGame;
    if (!F || !V) return;

    CAMPOS.forEach((c) => {
      const def = valorActual(c);
      DEFAULTS[c.sec + ':' + c.k] = def;
      const raw = g[c.sec + ':' + c.k];
      if (typeof raw === 'number') {
        aplicar(c, raw);
        if (c._input) { c._input.value = raw; c._mostrar(raw); }
      }
    });
    if (g.evento) V.evento(g.evento);
    if (typeof g.intervalo === 'number') F.setIntervalo(g.intervalo);
  }

  function sincronizar() {
    CAMPOS.forEach((c) => {
      const v = valorActual(c);
      if (c._input) { c._input.value = v; c._mostrar(v); }
    });
    const inp = panel && panel.querySelector('.cfg-texto');
    if (inp && window.VinoGame) inp.value = window.VinoGame.estado.evento;
  }

  function alternar(forzar) {
    if (!panel) panel = construir();
    abierto = typeof forzar === 'boolean' ? forzar : !abierto;
    panel.classList.toggle('ver', abierto);
    if (abierto) sincronizar();
  }

  function init() {
    const btn = document.createElement('button');
    btn.id = 'btnAjustes';
    btn.type = 'button';
    btn.title = 'Ajustes (P)';
    btn.textContent = '⚙';
    btn.addEventListener('click', () => alternar());
    document.body.appendChild(btn);

    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'p' || ev.key === 'P') {
        // no pisar el atajo si se está escribiendo en el input del evento
        const t = ev.target;
        if (t && t.tagName === 'INPUT' && t.type === 'text') return;
        ev.preventDefault();
        alternar();
      }
    });

    // esperar a que el juego esté listo
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (window.VinoGame && window.FondoAgua && window.FondoAgua.disponible()) {
        clearInterval(t);
        cargar();
      } else if (tries > 60) {
        clearInterval(t);
      }
    }, 400);
  }

  window.PanelCfg = { abrir: () => alternar(true), cerrar: () => alternar(false), alternar };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
