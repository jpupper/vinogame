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
    { sec: 'VINO', k: 'escalaParticulas', etq: 'Escala de las partículas', min: 0.4, max: 1.8, paso: 0.05 },
    { sec: 'VINO', k: 'caudalVelocidad', etq: 'Velocidad del caudal', min: 0.4, max: 3, paso: 0.1 },
    { sec: 'JUEGO', k: 'duracion', etq: 'Duración (segundos)', min: 15, max: 180, paso: 5, escala: 1000, unidad: 's' },
    { sec: 'JUEGO', k: 'tiempoCopa', etq: 'Reloj por copa (s)', min: 3, max: 20, paso: 0.5, escala: 1000, unidad: 's' },
    { sec: 'JUEGO', k: 'maxCopas', etq: 'Copas a la vez', min: 1, max: 5, paso: 1 },
    { sec: 'JUEGO', k: 'escalaCopas', etq: 'Escala de las copas', min: 0.5, max: 1.8, paso: 0.05 },
    { sec: 'JUEGO', k: 'escalaBotella', etq: 'Tamaño de la botella', min: 0.4, max: 2, paso: 0.05 },
    { sec: 'JUEGO', k: 'offsetY', etq: 'Offset Y de la botella (px)', min: -400, max: 400, paso: 5 },
    { sec: 'JUEGO', k: 'puntosCopa', etq: 'Puntos por copa', min: 10, max: 500, paso: 10 },
    { sec: 'JUEGO', k: 'bonusMax', etq: 'Bonus máximo', min: 0, max: 300, paso: 5 },
    { sec: 'JUEGO', k: 'penalidadCopa', etq: 'Penalidad por vencer', min: 0, max: 300, paso: 5 },
    { sec: 'JUEGO', k: 'penalidadDesborde', etq: 'Penalidad por desborde', min: 0, max: 300, paso: 5 },
    { sec: 'FONDO', k: 'tinte', etq: 'Oscuridad del fondo', min: 0, max: 0.7, paso: 0.02 },
    { sec: 'FONDO', k: 'intervalo', etq: 'Cambio de fondo (s)', min: 4, max: 60, paso: 1, escala: 1000, unidad: 's' }
  ];

  const DEFAULTS = {};
  // estas claves cambian la geometría (copas / gotas / botella): hay que re-aplicarla
  const REAJUSTAN = { escalaCopas: 1, escalaParticulas: 1, escalaBotella: 1, offsetY: 1 };
  let panel = null, abierto = false, estadoEl = null, campoBotella = null, campoYSigue = null;

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
  // OJO con `escala`: los campos con escala (duración, reloj por copa, cambio de
  // fondo) trabajan en SEGUNDOS en el slider y en ms dentro del juego.
  function aplicar(campo, v) {
    const F = window.FondoAgua, V = window.VinoGame;
    if (!F || !V) return;
    const raw = campo.escala ? v * campo.escala : v;
    if (campo.k === 'intervalo') { F.setIntervalo(raw); return; }
    if (campo.sec === 'FONDO') { F.params[campo.k] = raw; return; }
    if (campo.sec === 'JUEGO' || campo.sec === 'VINO') {
      V.cfg[campo.k] = raw;
      if (REAJUSTAN[campo.k] && typeof V.reajustar === 'function') V.reajustar();
      return;
    }
  }

  function valorActual(campo) {
    const F = window.FondoAgua, V = window.VinoGame;
    if (!F || !V) return campo.min;
    let val;
    if (campo.k === 'intervalo') val = F.intervalo();
    else if (campo.sec === 'FONDO') val = F.params[campo.k];
    else val = V.cfg[campo.k];
    if (typeof val !== 'number') return campo.min;
    return campo.escala ? val / campo.escala : val;
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
      const n = Math.round(v * 100) / 100;
      val.textContent = n + (campo.unidad || '');
    };

    const ini = valorActual(campo);
    input.value = ini;
    mostrar(ini);

    input.addEventListener('input', () => {
      const v = Number(input.value);
      mostrar(v);
      aplicar(campo, v);
      // eco al Grid Sequencer (el cambio vino del slider, no del inspector)
      if (typeof PanelCfg !== 'undefined' && PanelCfg.emitir) PanelCfg.emitir(campo.k, v);
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

  // ── fila de switch reutilizable (BOTELLA) ──
  function filaSwitch(etq, sub, id, marcado, alCambiar) {
    const filaSw = document.createElement('div');
    filaSw.className = 'cfg-fila cfg-fila-switch';

    const cab = document.createElement('div');
    cab.className = 'cfg-cab';
    cab.innerHTML = '<span>' + etq + (sub ? '<br><small style="opacity:.6">' + sub + '</small>' : '') + '</span>';

    const sw = document.createElement('label');
    sw.className = 'switch-inclinar cfg-switch';
    sw.setAttribute('title', etq);
    sw.innerHTML = '<input id="' + id + '" type="checkbox">' +
      '<span class="switch-track"><span class="switch-thumb"></span></span>';

    filaSw.appendChild(cab);
    filaSw.appendChild(sw);

    const chk = sw.querySelector('input');
    chk.checked = !!marcado;
    chk.addEventListener('change', () => alCambiar(chk));
    return { fila: filaSw, chk: chk };
  }

  // ── BOTELLA: switches adentro del panel (antes el de inclinar estaba en el HUD) ──
  function bloqueBotella() {
    const sec = document.createElement('section');
    sec.className = 'cfg-sec';
    const h = document.createElement('h4');
    h.textContent = 'BOTELLA';
    sec.appendChild(h);

    const V0 = window.VinoGame;

    const swInc = filaSwitch(
      'Inclinar botella a 45°', 'según la mitad de la pantalla',
      'chkInclinarBotella', V0 && V0.cfg ? !!V0.cfg.inclinarbotella : true,
      (chk) => {
        if (window.VinoGame) window.VinoGame.cfg.inclinarbotella = !!chk.checked;
        aviso(chk.checked ? 'Botella inclinada' : 'Botella vertical');
        if (typeof PanelCfg !== 'undefined' && PanelCfg.emitir) PanelCfg.emitir('inclinarbotella', !!chk.checked);
      }
    );
    sec.appendChild(swInc.fila);
    campoBotella = { k: 'inclinarbotella', _input: swInc.chk };

    const swYs = filaSwitch(
      'Y según el punto', 'apagado = Y fija + offset',
      'chkYSeguirPunto', V0 && V0.cfg ? !!V0.cfg.ySeguirPunto : false,
      (chk) => {
        if (window.VinoGame) window.VinoGame.cfg.ySeguirPunto = !!chk.checked;
        if (window.VinoGame && typeof window.VinoGame.reajustar === 'function') window.VinoGame.reajustar();
        aviso(chk.checked ? 'La botella sigue el Y del punto' : 'Y fija (usa el offset)');
        if (typeof PanelCfg !== 'undefined' && PanelCfg.emitir) PanelCfg.emitir('ySeguirPunto', !!chk.checked);
      }
    );
    sec.appendChild(swYs.fila);
    campoYSigue = { k: 'ySeguirPunto', _input: swYs.chk };

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
    body.appendChild(bloqueBotella());
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
      if (typeof PanelCfg !== 'undefined' && PanelCfg.emitir) PanelCfg.emitir('evento', inp.value);
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
      obj.inclinarbotella = window.VinoGame ? !!window.VinoGame.cfg.inclinarbotella : true;
      obj.ySeguirPunto = window.VinoGame ? !!window.VinoGame.cfg.ySeguirPunto : false;
      escribir(obj);
      // además deja la config en Games/servewine/config.json (sistema LIDAR)
      if (window.DeliGrid && window.DeliGrid.save) window.DeliGrid.save().catch(function () { });
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

  // ── Parámetros del sistema LIDAR (config.json) ──
  // El sitio publicado no tiene Grid Sequencer: para que el juego se comporte
  // IGUAL que en el LIDAR, se leen los valores de `config.json` (los que el
  // inspector guarda en Games/servewine/config.json) y se aplican como base.
  // Un GUARDAR hecho en este dispositivo (localStorage) tiene prioridad.
  let CFG_SISTEMA = null;
  function cargarConfigSistema() {
    if (!window.fetch) return;
    fetch('config.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !d.values) return;
        CFG_SISTEMA = d.values;
        cargar();
      })
      .catch(() => { });
  }

  function cargar() {
    const g = leer();
    const F = window.FondoAgua, V = window.VinoGame;
    if (!F || !V) return;

    CAMPOS.forEach((c) => {
      const clave = c.sec + ':' + c.k;
      const def = valorActual(c);
      DEFAULTS[clave] = def;
      let raw = g[clave];
      if (typeof raw !== 'number' && CFG_SISTEMA && typeof CFG_SISTEMA[c.k] === 'number') {
        raw = CFG_SISTEMA[c.k];
      }
      if (typeof raw === 'number') {
        aplicar(c, raw);
        if (c._input) { c._input.value = raw; c._mostrar(raw); }
      }
    });
    const evento = g.evento || (CFG_SISTEMA && CFG_SISTEMA.evento) || '';
    if (evento) V.evento(evento);
    if (typeof g.intervalo === 'number') F.setIntervalo(g.intervalo);
    const inc = (typeof g.inclinarbotella === 'boolean') ? g.inclinarbotella
      : (CFG_SISTEMA && typeof CFG_SISTEMA.inclinarbotella === 'boolean' ? CFG_SISTEMA.inclinarbotella : null);
    if (inc !== null) aplicarClave('inclinarbotella', inc);
    const ysig = (typeof g.ySeguirPunto === 'boolean') ? g.ySeguirPunto
      : (CFG_SISTEMA && typeof CFG_SISTEMA.ySeguirPunto === 'boolean' ? CFG_SISTEMA.ySeguirPunto : null);
    if (ysig !== null) aplicarClave('ySeguirPunto', ysig);
  }

  function sincronizar() {
    if (campoBotella && campoBotella._input && window.VinoGame) {
      campoBotella._input.checked = !!window.VinoGame.cfg.inclinarbotella;
    }
    if (campoYSigue && campoYSigue._input && window.VinoGame) {
      campoYSigue._input.checked = !!window.VinoGame.cfg.ySeguirPunto;
    }
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
      // Basta con que existan los dos módulos: `disponible()` es sólo WebGL y si
      // el shader no arranca los parámetros tienen que aplicarse igual.
      if (window.VinoGame && window.FondoAgua) {
        clearInterval(t);
        cargar();
        cargarConfigSistema();   // valores del LIDAR (config.json) como base
      } else if (tries > 60) {
        clearInterval(t);
      }
    }, 400);
  }

  // ── API para el Grid Sequencer (game_param_change) y el adaptador ──
  function aplicarClave(k, v) {
    const V = window.VinoGame;
    if (!V) return false;
    if (k === 'inclinarbotella') {
      V.cfg.inclinarbotella = !!v;
      if (campoBotella && campoBotella._input) campoBotella._input.checked = !!v;
      return true;
    }
    if (k === 'ySeguirPunto') {
      V.cfg.ySeguirPunto = !!v;
      if (campoYSigue && campoYSigue._input) campoYSigue._input.checked = !!v;
      if (typeof V.reajustar === 'function') V.reajustar();
      return true;
    }
    if (k === 'evento') { V.evento(String(v || '')); return true; }
    const campo = CAMPOS.find((c) => c.k === k);
    if (!campo) return false;
    aplicar(campo, Number(v));
    if (campo._input) { campo._input.value = Number(v); campo._mostrar(Number(v)); }
    return true;
  }

  function valores() {
    const out = {};
    const V = window.VinoGame;
    CAMPOS.forEach((c) => { out[c.k] = Math.round(valorActual(c) * 100) / 100; });
    if (V) {
      out.inclinarbotella = !!V.cfg.inclinarbotella;
      out.ySeguirPunto = !!V.cfg.ySeguirPunto;
    }
    return out;
  }

  function campos() {
    return CAMPOS.map((c) => ({
      sec: c.sec, k: c.k, etq: c.etq, min: c.min, max: c.max, paso: c.paso, unidad: c.unidad || ''
    }));
  }

  window.PanelCfg = {
    abrir: () => alternar(true),
    cerrar: () => alternar(false),
    alternar,
    aplicar: aplicarClave,
    valores,
    campos,
    emitir: (k, v) => { if (window.DeliGrid && window.DeliGrid.emit) window.DeliGrid.emit(k, v); }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
