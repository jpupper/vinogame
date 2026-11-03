/* ============================================================
   DELI & WINE · LLENÁ LAS COPAS  (v4 — 60 segundos, botella por dedo)
   ------------------------------------------------------------
   PARTIDA DE 60 SEGUNDOS, ritmo constante.
   · Arriba: UNA BOTELLA POR CADA PUNTO que toca la pantalla (cada dedo
     tiene la suya; con mouse hay una sola que sigue al cursor). Todas
     comparten la misma altura (bocaY) y vierten por gravedad (Matter.js).
   · Abajo: van apareciendo copas, cada una con su RELOJ. De la boca sale un
     chorro de gotas que caen, entran por la boca de la copa y la llenan.
     · Copa llena a tiempo  -> +100 puntos (+ bonus por lo que sobró de reloj)
     · Reloj en cero        -> −50 puntos (ya no corta la partida)
     · Desbordar una copa   -> −30 puntos
   · Al llegar a 0 el reloj general: pantalla final con el puntaje.
   · El vino que cae ALIMENTA EL FLUIDO DEL FONDO (pointers del shader).
   ============================================================ */
(() => {
  'use strict';

  const SA = document.getElementById('escena');
  const ctx = SA.getContext('2d');
  const M = window.Matter;

  // ---------------- CONFIG ----------------
  const CFG = {
    duracion: 60000,        // reloj general de la partida (ms)
    gotasPorFrame: 1,
    radioGota: 6.0,
    pisoCopas: 0.93,        // fracción de alto donde apoyan las copas
    maxCopas: 3,            // copas simultáneas en pantalla
    esperaCopa: [1500, 2400], // ms entre aparición y aparición
    tiempoCopa: 9000,       // ms que tenés para llenarla
    puntosCopa: 100,
    bonusMax: 60,           // puntos extra si la llenás con el reloj entero
    penalidadCopa: 50,      // por dejar que se venza el reloj
    penalidadDesborde: 30,  // por seguir tirando en una copa ya llena
    maxBotellas: 6,         // una por dedo, tope para no fundir el celu
    maxParticulas: 900
  };

  // ---------------- ESTADO ----------------
  const E = {
    listo: false, jugando: false, pausado: false,
    ancho: 0, alto: 0, dpr: 1,
    puntos: 0, copas: 0, fallas: 0,
    restante: CFG.duracion,
    bocaY: 0,
    botellas: [],           // {id, x, vx, prevX, tilt, alfa, alfaObj}
    copasArr: [], particulas: [], motas: [], chispas: [], avisos: [],
    ultimo: 0, destello: 0, tSpawn: 400
  };

  // ---------------- IMÁGENES ----------------
  const IMG = { botella: new Image(), copa: new Image(), logo: new Image() };
  let cargadas = 0;
  ['botella', 'copa', 'logo'].forEach((k) => {
    IMG[k].onload = IMG[k].onerror = () => {
      cargadas++;
      if (cargadas >= 3) { E.listo = true; document.getElementById('cargando').classList.remove('visible'); }
    };
  });
  IMG.botella.src = 'img/botella.png';
  IMG.copa.src = 'img/copa.png';
  IMG.logo.src = 'img/logo.png';

  // ---------------- GEOMETRÍA DE LA COPA ----------------
  // img/copa.png es 512x512 y el dibujo (contorno opaco) va de 167..341 en X y
  // 21..483 en Y. Estas fracciones son de la IMAGEN COMPLETA, así se dibuja el
  // sprite entero escalado y todo cae en su lugar sin cuentas raras.
  const COPA_F = {
    xIzq: 0.335,       // borde izquierdo del cáliz (arriba)
    xDer: 0.660,       // borde derecho
    yBorde: 0.068,     // boca del cáliz
    yVientre: 0.345,   // donde el cáliz es más ancho
    yFondo: 0.452,     // fondo interior del cáliz
    xVientreIzq: 0.325,
    xVientreDer: 0.670,
    yVinoNativo: 0.371 // la imagen ya trae vino hasta acá
  };

  // La copa se apoya siempre en la mesa; c.dy es el desplazamiento vertical de
  // la animación de entrada (sube desde abajo) y de salida (se hunde).
  function ubicar(c) {
    const sx = c.cx - c.ancho / 2;
    const sy = (c.yBase + c.dy) - c.alto;
    const X = (f) => sx + c.ancho * f;
    const Y = (f) => sy + c.alto * f;
    c.sprite = { x: sx, y: sy, w: c.ancho, h: c.alto };
    c.xBordeIzq = X(COPA_F.xIzq);
    c.xBordeDer = X(COPA_F.xDer);
    c.xVientreIzq = X(COPA_F.xVientreIzq);
    c.xVientreDer = X(COPA_F.xVientreDer);
    c.yBorde = Y(COPA_F.yBorde);
    c.yVientre = Y(COPA_F.yVientre);
    c.yFondo = Y(COPA_F.yFondo);
    return c;
  }

  function crearCopa(cx, yBase, ancho, lane) {
    const alto = ancho;                    // la imagen es cuadrada
    const copa = {
      cx, yBase, ancho, alto, lane,
      nivel: 0, llena: false, sobrante: 0, temblor: 0,
      estado: 'entrando',     // entrando -> activa -> llena -> saliendo
      tEstado: 0,
      vida: CFG.tiempoCopa,
      dy: 0,
      conteo: 0
    };
    copa.dy = alto * 0.95;   // arranca debajo de la mesa
    ubicar(copa);
    const yVinoNativo = (copa.yBase - copa.alto) + copa.alto * COPA_F.yVinoNativo;
    copa.nivelObjetivo = Math.min(0.95, Math.max(0.5,
      (copa.yFondo - yVinoNativo) / (copa.yFondo - copa.yBorde)));
    return copa;
  }

  // ---------------- CARRILES ----------------
  // Las copas ya no se mueven: aparecen en uno de los carriles libres, así se
  // puede apuntar con la botella sin correr detrás de una cinta.
  function carriles() { return E.ancho < 680 ? 3 : 4; }
  function centroCarril(i) {
    const n = carriles();
    return (E.ancho / n) * (i + 0.5);
  }
  function anchoCopa() {
    const n = carriles();
    return Math.min((E.ancho / n) * 0.88, E.alto * 0.36);
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

  // ---------------- MUNDO ----------------
  let mundo = null, motor = null;

  function crearMundo() {
    motor = M.Engine.create({ gravity: { x: 0, y: 1.25 } });
    mundo = motor.world;
    const g = 160;
    M.Composite.add(mundo, [
      M.Bodies.rectangle(-g / 2, E.alto / 2, g, E.alto * 3, { isStatic: true }),
      M.Bodies.rectangle(E.ancho + g / 2, E.alto / 2, g, E.alto * 3, { isStatic: true })
    ]);
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

    // canvas del shader de fluido (mismo tamaño CSS, resolución 1:1 para que el
    // campo de metaballs no cueste 4x en pantallas con DPR alto)
    const CF = document.getElementById('fluido');
    if (CF) {
      CF.style.width = E.ancho + 'px';
      CF.style.height = E.alto + 'px';
      if (!window.Fluido.disponible()) window.Fluido.iniciar(CF);
      // el tamaño interno lo maneja el shader (0.6 de escala); acá sólo el CSS
    }

    // Botellas: ocupan el tercio de arriba, boca abajo, con la boca a 0.445·alto
    // (debajo del HUD para no tapar los números). TODAS comparten bocaY.
    E.bocaY = E.alto * 0.445;
    E.botellas.forEach((b) => { b.x = Math.min(E.ancho - 10, Math.max(10, b.x)); });

    // fondo de agua con la imagen del viñedo
    iniciarFondo();

    // reacomodar copas vivas a su carril con el nuevo tamaño
    const yBase = E.alto * CFG.pisoCopas;
    const ancho = anchoCopa();
    E.copasArr.forEach((c) => {
      c.yBase = yBase;
      c.ancho = ancho;
      c.alto = ancho;
      c.cx = centroCarril(Math.min(c.lane, carriles() - 1));
      if (c.estado === 'entrando') c.dy = c.alto * 0.95;
      ubicar(c);
    });
    if (!mundo) crearMundo();
  }

  // ---------------- PARTÍCULAS ----------------
  function crearGota(x, y, vx, vy) {
    if (E.particulas.length >= CFG.maxParticulas) {
      const p0 = E.particulas.shift();
      M.World.remove(mundo, p0.cuerpo);
    }
    const r = CFG.radioGota * (0.85 + Math.random() * 0.3);
    const cuerpo = M.Bodies.circle(x, y, r, {
      frictionAir: 0.0006,
      restitution: 0.02,
      density: 0.0018,
      slop: 0.02,
      // las gotas no chocan entre sí: si no, el chorro se abre en abanico
      collisionFilter: { group: -1, category: 0x0002, mask: 0xFFFF }
    });
    M.Body.setVelocity(cuerpo, { x: vx, y: vy });
    M.World.add(mundo, cuerpo);
    const p = { cuerpo, r, contada: false, px: x, py: y };
    E.particulas.push(p);
    return p;
  }

  // ---------------- BOTELLAS (una por punto) ----------------
  // Cada puntero activo tiene su botella. `id` es el pointerId (o 'mouse').
  // Entran y salen con un fade corto: no aparecen de golpe.
  function crearBotella(id, x) {
    const b = {
      id,
      x: Math.max(10, Math.min(E.ancho - 10, x)),
      vx: 0, prevX: x, tilt: 0,
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
    const medio = (E.alto * 0.36 * 0.318) * 0.42;
    b.x = Math.max(margen + medio, Math.min(E.ancho - margen - medio, clientX - rect.left));
  }

  SA.addEventListener('pointerdown', (ev) => {
    try { SA.setPointerCapture?.(ev.pointerId); } catch (e) { /* pointerId sintético: no importa */ }
    const esMouse = ev.pointerType === 'mouse' || ev.pointerType === 'pen';
    const id = esMouse ? 'mouse' : 'p' + ev.pointerId;
    const b = abrirBotella(id, ev.clientX - SA.getBoundingClientRect().left);
    if (b) moverA(id, ev.clientX);
  });

  SA.addEventListener('pointermove', (ev) => {
    const esMouse = ev.pointerType === 'mouse' || ev.pointerType === 'pen';
    const id = esMouse ? 'mouse' : 'p' + ev.pointerId;
    if (!botellaDe(id)) {
      // el mouse no necesita apretar: su botella existe siempre en partida
      if (esMouse && E.jugando && E.botellas.length < CFG.maxBotellas) {
        abrirBotella(id, ev.clientX - SA.getBoundingClientRect().left);
      } else return;
    }
    moverA(id, ev.clientX);
  });

  function soltar(ev) {
    const esMouse = ev.pointerType === 'mouse' || ev.pointerType === 'pen';
    if (esMouse) return;                       // la del mouse no se va
    cerrarBotella('p' + ev.pointerId);
  }
  SA.addEventListener('pointerup', soltar);
  SA.addEventListener('pointercancel', soltar);
  SA.addEventListener('pointerleave', (ev) => { if (ev.pointerType !== 'mouse') cerrarBotella('p' + ev.pointerId); });

  // respaldo para navegadores sin pointer events en touch
  window.addEventListener('touchmove', (ev) => {
    for (const t of ev.touches) moverA('p' + t.identifier, t.clientX);
  }, { passive: true });

  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'p' || ev.key === 'P') alternarPausa();
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
      const b = E.botellas[0];
      if (b) moverA(b.id, b.x + (ev.key === 'ArrowLeft' ? -70 : 70) + SA.getBoundingClientRect().left);
    }
  });

  // ---------------- BUCLE ----------------
  // Medidor de rendimiento: si el shader de metaballs arrastra los fps (teléfonos
  // con GPU floja, WebGL por software), se apaga y el vino pasa al respaldo 2D.
  const REND = { muestras: [], apagadoShader: false };
  function medirFps(dt) {
    if (REND.apagadoShader) return;
    REND.muestras.push(dt);
    if (REND.muestras.length > 45) REND.muestras.shift();
    if (REND.muestras.length === 45) {
      const prom = REND.muestras.reduce((a, b) => a + b, 0) / REND.muestras.length;
      if (prom > 42 && window.Fluido && window.Fluido.disponible()) {
        REND.apagadoShader = true;
        window.Fluido.apagar();
        console.warn('fluido: shader apagado por rendimiento (' + prom.toFixed(0) + ' ms/frame), paso a 2D');
      }
    }
  }

  function frame(t) {
    const dt = Math.min(48, t - (E.ultimo || t));
    E.ultimo = t;
    if (E.listo) {
      if (E.jugando && !E.pausado) paso(dt);
      dibujar(dt);
      medirFps(dt);
    }
    requestAnimationFrame(frame);
  }

  function paso(dt) {
    // ---- reloj general: 60 s y a la pantalla final ----
    E.restante -= dt;
    actualizarHud();
    if (E.restante <= 0) { E.restante = 0; terminar(); return; }

    // ---- fade de entrada/salida de las botellas ----
    for (let i = E.botellas.length - 1; i >= 0; i--) {
      const b = E.botellas[i];
      b.alfa += (b.alfaObj - b.alfa) * Math.min(1, dt / 140);
      if (b.alfaObj === 0 && b.alfa < 0.02) E.botellas.splice(i, 1);
    }

    // ---- aparición de copas (un solo nivel: ritmo parejo) ----
    E.tSpawn -= dt;
    if (E.tSpawn <= 0) {
      const libres = carrilesLibres();
      if (libres.length && copasEnJuego() < CFG.maxCopas) {
        const lane = libres[Math.floor(Math.random() * libres.length)];
        E.copasArr.push(crearCopa(centroCarril(lane), E.alto * CFG.pisoCopas, anchoCopa(), lane));
        E.tSpawn = CFG.esperaCopa[0] + Math.random() * (CFG.esperaCopa[1] - CFG.esperaCopa[0]);
      } else {
        E.tSpawn = 260;
      }
    }

    // Física a PASO FIJO: con dt variable, en un celular a 30 fps el vino caía a la
    // mitad de velocidad y las gotas se apilaban en la boca de la botella.
    const pasos = Math.max(1, Math.min(3, Math.round(dt / 16.67)));

    // ---- CHORRO: una boca por botella ----
    // Cada botella vierte su propio chorro y ninguna queda en "cuentas": el
    // mínimo son 2 gotas por frame por boca (con 1 sola se veían bolitas
    // separadas cuando había varios dedos).
    const vivas = E.botellas.filter((b) => b.alfa > 0.35);
    const base = E.ancho < 700 ? 2 : CFG.gotasPorFrame;
    const cuantas = Math.max(2, base - (vivas.length - 1));

    vivas.forEach((b) => {
      // INERCIA: el vino hereda el movimiento de SU botella
      const dxBotella = b.x - b.prevX;
      b.prevX = b.x;
      const vInst = dxBotella * (16.67 / Math.max(1, dt));   // px por frame de 16.67 ms
      b.vx = b.vx * 0.7 + vInst * 0.3;                        // suavizado (no vibra con el mouse)
      b.vx = Math.max(-90, Math.min(90, b.vx));
      // inclinación visual: la botella se "queda atrás" cuando la arrastrás
      const tiltObjetivo = Math.max(-0.2, Math.min(0.2, -b.vx * 0.006));
      b.tilt += (tiltObjetivo - b.tilt) * Math.min(1, dt / 110);

      // Cuánto del movimiento hereda el vino. Con 0.5 el chorro se iba 140 px al
      // costado con un arrastre normal y no había forma de llenar una copa:
      // 0.18 da una curva visible (~50 px) y sólo se escapa si sacudís fuerte.
      const inercia = Math.max(-4, Math.min(4, b.vx * 0.18));
      const sacudida = Math.abs(b.vx);
      // más rápido = más desparramo y algo más de velocidad de caída
      const dispersion = 0.3 + Math.min(1.6, sacudida * 0.04);
      const vy = 1.6 + Math.min(0.8, sacudida * 0.012);
      // cuando la botella va rápido el chorro se estira y se corta en cuentas:
      // se tira una gota extra por frame para que la vena siga siendo continua
      const extra = sacudida > 12 ? 1 : 0;
      const n = (cuantas + extra) * pasos;
      for (let i = 0; i < n; i++) {
        crearGota(
          b.x + (Math.random() - 0.5) * 3,
          E.bocaY + Math.random() * 4,
          inercia + (Math.random() - 0.5) * dispersion,
          vy
        );
      }
    });

    for (let k = 0; k < pasos; k++) M.Engine.update(motor, 16.67);

    // conteo y limpieza de gotas
    const activas = E.copasArr.filter((c) => c.estado === 'activa' || c.estado === 'llena');
    activas.forEach((c) => { c.conteo = 0; });
    for (let i = E.particulas.length - 1; i >= 0; i--) {
      const p = E.particulas[i];
      const pos = p.cuerpo.position;
      let quitar = false;

      const c = copaDeGota(pos, activas);
      if (c) {
        if (!p.contada && pos.y > c.yBorde + 2) {
          p.contada = true;
          c.conteo++;
          // el golpe de la gota agita la superficie del vino
          c.agit = Math.min(1, (c.agit || 0) + 0.1);
        }
        if (p.contada && pos.y > c.yFondo - 2) quitar = true;
      } else if (pos.y > E.alto * CFG.pisoCopas + 10 || pos.x < -40 || pos.x > E.ancho + 40) {
        // salpicadura: el vino que no entra en una copa revienta contra la mesa
        if (pos.y > E.alto * CFG.pisoCopas - 6) {
          const vel = p.cuerpo.velocity;
          for (let s = 0; s < 2; s++) {
            E.chispas.push({
              x: pos.x, y: pos.y,
              vx: vel.x * 0.4 + (Math.random() - 0.5) * 3.2,
              vy: -Math.random() * 2.6,
              vida: 0.5, color: Math.random() > 0.5 ? '#b4142f' : '#7d0b1e'
            });
          }
        }
        quitar = true;
      }
      if (quitar) {
        M.World.remove(mundo, p.cuerpo);
        E.particulas.splice(i, 1);
      }
    }

    // ---- ciclo de vida de cada copa ----
    for (let i = E.copasArr.length - 1; i >= 0; i--) {
      const c = E.copasArr[i];
      c.tEstado += dt;

      if (c.estado === 'entrando') {
        const t = Math.min(1, c.tEstado / 420);
        c.dy = c.alto * 0.95 * (1 - salidaSuave(t));
        if (t >= 1) { c.estado = 'activa'; c.tEstado = 0; c.dy = 0; }
      } else if (c.estado === 'activa') {
        c.vida -= dt;
        actualizarCopa(c);
        if (c.estado === 'activa' && c.vida <= 0) copaPerdida(c);
      } else if (c.estado === 'llena') {
        c.dy = -Math.sin(Math.min(1, c.tEstado / 600) * Math.PI) * c.alto * 0.06;
        if (c.tEstado > 620) { c.estado = 'saliendo'; c.tEstado = 0; }
      } else if (c.estado === 'saliendo') {
        c.dy = c.alto * 0.95 * Math.min(1, c.tEstado / 360);
        if (c.tEstado > 380) {
          E.copasArr.splice(i, 1);
          continue;
        }
      }
      if (c.temblor > 0) c.temblor -= dt;
      if (c.agit > 0) c.agit = Math.max(0, c.agit - dt / 900);
      ubicar(c);
    }

    // motas, destello, chispas, avisos
    E.motas.forEach((m) => { m.y += m.v; if (m.y > E.alto) { m.y = -8; m.x = Math.random() * E.ancho; } });
    if (E.destello > 0) E.destello -= dt;
    for (let i = E.chispas.length - 1; i >= 0; i--) {
      const s = E.chispas[i];
      s.x += s.vx; s.y += s.vy; s.vy += 0.28; s.vida -= 0.02;
      if (s.vida <= 0) E.chispas.splice(i, 1);
    }
    for (let i = E.avisos.length - 1; i >= 0; i--) {
      const a = E.avisos[i];
      a.y -= dt * 0.035;
      a.vida -= dt;
      if (a.vida <= 0) E.avisos.splice(i, 1);
    }
  }

  function salidaSuave(t) { return 1 - Math.pow(1 - t, 3); }

  function copaDeGota(pos, lista) {
    for (const c of lista) {
      if (pos.x > c.xBordeIzq - 2 && pos.x < c.xBordeDer + 2 && pos.y > c.yBorde - 40) return c;
    }
    return null;
  }

  function actualizarCopa(c) {
    if (c.conteo > 0) {
      c.nivel = Math.min(1.25, c.nivel + c.conteo * 0.02);
    }
    if (!c.llena && c.nivel >= c.nivelObjetivo) {
      copaLlena(c);
      return;
    }
    if (c.llena) {
      // seguir tirando en una copa llena descuenta un poco (no hace perder falla)
      c.sobrante += c.conteo;
      if (c.sobrante > 180 && !c.desbordada) {
        c.desbordada = true;
        E.puntos = Math.max(0, E.puntos - CFG.penalidadDesborde);
        avisar(c.cx, c.yBorde - c.alto * 0.12, '−' + CFG.penalidadDesborde, '#ff7a8a');
        actualizarHud();
      }
    }
  }

  function copaLlena(c) {
    c.llena = true;
    c.temblor = 500;
    c.estado = 'llena';
    c.tEstado = 0;

    const resto = Math.max(0, c.vida) / CFG.tiempoCopa;
    const bonus = Math.round(CFG.bonusMax * resto);
    const total = CFG.puntosCopa + bonus;
    E.puntos += total;
    E.copas++;
    E.destello = 320;

    for (let i = 0; i < 18; i++) {
      E.chispas.push({
        x: c.cx, y: c.yBorde + 30,
        vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 7 - 2,
        vida: 1, color: Math.random() > 0.4 ? '#e8c477' : '#ff4f6a'
      });
    }
    avisar(c.cx, c.yBorde - c.alto * 0.1, '+' + total, '#f4d79b');
    actualizarHud();
  }

  // El reloj de una copa se venció: resta puntos, pero la partida sigue
  // (ahora dura 60 s y no se corta por fallas).
  function copaPerdida(c) {
    c.estado = 'saliendo';
    c.tEstado = 0;
    E.fallas++;
    E.puntos = Math.max(0, E.puntos - CFG.penalidadCopa);
    avisar(c.cx, c.yBorde - c.alto * 0.1, '−' + CFG.penalidadCopa, '#ff5d6c');
    actualizarHud();
  }

  function avisar(x, y, texto, color) {
    E.avisos.push({ x, y, texto, color, vida: 1100, total: 1100 });
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

  // ---------------- FEED AL FONDO DE AGUA ----------------
  // El vino que cae EMPUJA el agua: cada gota entra como un punto con su
  // posición anterior (estela). Las coordenadas van en px del canvas del fondo
  // y con y = 0 ABAJO, como gl_FragCoord.
  const FONDOS = ['img/fondo1.jpg', 'img/fondo2.jpg', 'img/fondo3.jpg'];
  const FEED = [];

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

  function alimentarFondo() {
    if (!window.FondoAgua || !window.FondoAgua.disponible()) return;

    // 12 como máximo: es lo que declara el shader del pase de simulación
    const lista = E.particulas;
    const tope = 12;
    const salto = Math.max(1, Math.ceil(lista.length / tope));
    FEED.length = 0;
    for (let i = 0; i < lista.length && FEED.length < tope; i += salto) {
      const p = lista[i];
      const pos = p.cuerpo.position;
      FEED.push({
        x: pos.x,
        y: E.alto - pos.y,          // 0 abajo
        px: p.px,
        py: E.alto - p.py
      });
      p.px = pos.x;
      p.py = pos.y;
    }
    window.FondoAgua.dibujar(FEED);
  }

  // ---------------- DIBUJO ----------------
  function dibujar(dt) {
    const W = E.ancho, H = E.alto;
    ctx.clearRect(0, 0, W, H);

    // velo: deja ver el fluido del fondo (es el protagonista), sólo baja el
    // contraste lo justo para que el HUD y las copas se lean
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(12,3,7,.26)');
    g.addColorStop(0.5, 'rgba(34,8,17,.12)');
    g.addColorStop(1, 'rgba(74,12,28,.20)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const halo = ctx.createRadialGradient(W * 0.5, H * 0.16, 10, W * 0.5, H * 0.16, W * 0.6);
    halo.addColorStop(0, 'rgba(232,196,119,.10)');
    halo.addColorStop(1, 'rgba(232,196,119,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    if (!E.motas.length) {
      for (let i = 0; i < 36; i++) {
        E.motas.push({ x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 2, v: 0.15 + Math.random() * 0.5 });
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    E.motas.forEach((m) => { ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 6.283); ctx.fill(); });

    // mesa
    const yMesa = H * CFG.pisoCopas;
    const mesa = ctx.createLinearGradient(0, yMesa - 14, 0, yMesa + 30);
    mesa.addColorStop(0, 'rgba(232,196,119,.2)');
    mesa.addColorStop(1, 'rgba(232,196,119,0)');
    ctx.fillStyle = mesa;
    ctx.fillRect(0, yMesa - 14, W, 46);

    E.copasArr.forEach((c) => dibujarCopa(c));
    E.botellas.forEach((b) => dibujarBotella(b));

    E.chispas.forEach((s) => {
      ctx.globalAlpha = Math.max(0, s.vida);
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, 2 + s.vida * 2.4, 0, 6.283); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // avisos flotantes (+100 / −50)
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

    // vino: metaballs en shader, encima de la copa y debajo del HUD
    if (!(window.Fluido && window.Fluido.disponible())) {
      dibujarGotas2D();
    } else {
      // las gotas que ya entraron en la copa no se dibujan: ahí manda el nivel
      // del líquido de la copa (si no, el chorro se ve POR ENCIMA del vidrio)
      const gotas = [];
      for (const p of E.particulas) {
        const pos = p.cuerpo.position;
        let dentro = false;
        for (const c of E.copasArr) {
          if (pos.x > c.xBordeIzq - 4 && pos.x < c.xBordeDer + 4 && pos.y > c.yBorde - 2) { dentro = true; break; }
        }
        const k = E.ancho < 700 ? 2.0 : 1.75;   // apenas más gordo en el celular
        if (!dentro) gotas.push({ x: pos.x, y: pos.y, r: p.r * k });
      }
      window.Fluido.dibujar(gotas, Math.round(W), Math.round(H), performance.now() / 1000);
    }

    // el vino que cae alimenta el agua del fondo
    alimentarFondo();
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

  // Reloj de la copa: barra en la mesa + segundos arriba de la boca.
  // Es la pieza nueva del juego: sin esto no se entiende por qué se pierde.
  function dibujarReloj(c) {
    if (c.estado !== 'activa' && c.estado !== 'llena') return;
    const frac = c.estado === 'llena' ? 1 : Math.max(0, c.vida / CFG.tiempoCopa);
    const seg = Math.ceil(Math.max(0, c.vida) / 1000);

    const bw = c.ancho * 0.66;
    const bh = Math.max(6, c.alto * 0.026);
    const bx = c.cx - bw / 2;
    const by = c.yBase + c.alto * 0.03 + c.dy;

    // canal
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    redondo(bx - 2, by - 2, bw + 4, bh + 4, (bh + 4) / 2);
    ctx.fill();

    // relleno
    const col = c.estado === 'llena'
      ? '#f4d79b'
      : (frac > 0.5 ? '#e8c477' : (frac > 0.25 ? '#f0a04b' : '#ff4f5f'));
    ctx.fillStyle = col;
    if (frac > 0.001) {
      redondo(bx, by, Math.max(bh, bw * frac), bh, bh / 2);
      ctx.fill();
    }

    // brillo cuando queda poco
    if (c.estado === 'activa' && frac <= 0.25) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 120) * 0.3;
      ctx.fillStyle = '#ff4f5f';
      redondo(bx - 4, by - 4, bw + 8, bh + 8, (bh + 8) / 2);
      ctx.fill();
      ctx.restore();
    }

    // segundos
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

  function dibujarCopa(c) {
    const sp = c.sprite;
    const t = c.temblor > 0 ? Math.sin(c.temblor * 0.09) * 2 : 0;

    // sombra en la mesa
    ctx.save();
    ctx.globalAlpha = 0.3 * (c.dy >= 0 ? Math.max(0, 1 - c.dy / (c.alto * 0.6)) : 1);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(c.cx, c.yBase - 4, c.ancho * 0.16, c.ancho * 0.035, 0, 0, 6.283);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(t, 0);

    // copa
    if (IMG.copa.complete && IMG.copa.naturalWidth) {
      ctx.drawImage(IMG.copa, sp.x, sp.y, sp.w, sp.h);
    }

    // vino del jugador: se tapa el que trae la imagen y se dibuja el nivel
    const rx = (c.xVientreDer - c.xVientreIzq) / 2;
    const cxB = (c.xVientreDer + c.xVientreIzq) / 2;
    const rBorde = (c.xBordeDer - c.xBordeIzq) / 2;

    ctx.save();
    ctx.beginPath();
    // forma del cáliz: recto en la boca, panza abajo
    ctx.moveTo(c.xBordeIzq, c.yBorde);
    ctx.lineTo(c.xBordeDer, c.yBorde);
    ctx.lineTo(c.xVientreDer, c.yVientre);
    ctx.quadraticCurveTo(c.xVientreDer - 1, c.yFondo, cxB, c.yFondo);
    ctx.quadraticCurveTo(c.xVientreIzq + 1, c.yFondo, c.xVientreIzq, c.yVientre);
    ctx.closePath();
    ctx.clip();

    // fondo del cáliz (tapa el vino nativo del sprite: la copa arranca VACÍA)
    const vacio = ctx.createLinearGradient(0, c.yBorde, 0, c.yFondo);
    vacio.addColorStop(0, 'rgba(26,17,26,1)');
    vacio.addColorStop(0.55, 'rgba(15,11,18,1)');
    vacio.addColorStop(1, 'rgba(8,6,11,1)');
    ctx.fillStyle = vacio;
    ctx.fillRect(sp.x, c.yBorde - 2, sp.w, (c.yFondo - c.yBorde) + 6);
    // reflejo del vidrio vacío: una franja clara en diagonal, para que se lea
    // "copa vacía" y no "copa con vino oscuro"
    const brillo = ctx.createLinearGradient(c.xBordeIzq, c.yBorde, c.xBordeDer, c.yFondo);
    brillo.addColorStop(0, 'rgba(255,255,255,.16)');
    brillo.addColorStop(0.35, 'rgba(255,255,255,.04)');
    brillo.addColorStop(0.6, 'rgba(255,255,255,0)');
    ctx.fillStyle = brillo;
    ctx.fillRect(sp.x, c.yBorde - 2, sp.w, (c.yFondo - c.yBorde) + 6);

    if (c.nivel > 0) {
      const alto = c.yFondo - c.yBorde;
      const sup = c.yFondo - alto * Math.min(1, c.nivel);
      const lg = ctx.createLinearGradient(0, sup, 0, c.yFondo);
      lg.addColorStop(0, '#7d0b1e');
      lg.addColorStop(0.25, '#5c0716');
      lg.addColorStop(0.75, '#3c0410');
      lg.addColorStop(1, '#26030a');
      ctx.fillStyle = lg;
      ctx.fillRect(sp.x, sup, sp.w, c.yFondo - sup + 3);

      // luz que atraviesa el vino cerca de la superficie (degradé suave, sin banda)
      const altoLuz = (c.yFondo - sup) * 0.55;
      const luz = ctx.createLinearGradient(0, sup, 0, sup + altoLuz);
      luz.addColorStop(0, 'rgba(196,40,70,.42)');
      luz.addColorStop(0.55, 'rgba(150,18,42,.16)');
      luz.addColorStop(1, 'rgba(120,10,30,0)');
      ctx.fillStyle = luz;
      ctx.fillRect(sp.x, sup, sp.w, altoLuz);

      // menisco: el borde del líquido toca el vidrio (y tiembla con las gotas)
      const agit = c.agit || 0;
      const onda = agit * Math.sin(performance.now() / 90 + c.cx * 0.05);
      const supOnda = sup - onda * 2.2;
      ctx.strokeStyle = 'rgba(214,60,86,' + (0.75 + agit * 0.2) + ')';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(cxB, supOnda, Math.max(6, rBorde * (0.9 + agit * 0.05)), 3.2 + agit * 1.4, 0, 0, 6.283);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,150,168,' + (0.35 + agit * 0.25) + ')';
      ctx.beginPath();
      ctx.ellipse(cxB, supOnda, Math.max(5, rBorde * 0.86), 2.4 + agit * 1.2, 0, 0, 6.283);
      ctx.fill();
      // brillo del vidrio sobre la superficie
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath();
      ctx.ellipse(cxB - rBorde * 0.34, sup + 1, rBorde * 0.2, 1.1, 0, 0, 6.283);
      ctx.fill();
    }
    ctx.restore();

    // reflejo del vidrio
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(c.xBordeIzq + rBorde * 0.55, (c.yBorde + c.yFondo) / 2, Math.max(2, rBorde * 0.16), (c.yFondo - c.yBorde) * 0.34, -0.1, 0, 6.283);
    ctx.fill();
    ctx.restore();

    // aro dorado cuando está llena
    if (c.llena) {
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(performance.now() / 240) * 0.25;
      ctx.strokeStyle = '#e8c477';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(cxB, c.yBorde + 2, rBorde * 0.95, 5, 0, 0, 6.283);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    dibujarReloj(c);
  }

  // El vino del chorro NO se dibuja acá: va en el canvas WebGL del shader de
  // metaballs (js/fluido.js), así las gotas se funden en una masa continua.
  // Respaldo sin WebGL: metaballs "de pobres" con blur + contraste sobre un
  // canvas offscreen (se funden igual, sin shader). Se usa sólo si Fluido no está.
  let off = null, offCtx = null, off2 = null, off2Ctx = null;
  function dibujarGotas2D() {
    if (!off) {
      off = document.createElement('canvas');
      offCtx = off.getContext('2d');
      off2 = document.createElement('canvas');
      off2Ctx = off2.getContext('2d');
    }
    const W = E.ancho, H = E.alto;
    if (off.width !== W || off.height !== H) {
      off.width = W; off.height = H;
      off2.width = W; off2.height = H;
    }

    // 1) campo de densidad: cada gota como mancha blanca que se suma
    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    offCtx.clearRect(0, 0, W, H);
    offCtx.globalCompositeOperation = 'lighter';
    for (const p of E.particulas) {
      const pos = p.cuerpo.position;
      const r = p.r * 2.6;
      const g = offCtx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.5, 'rgba(255,255,255,.6)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      offCtx.fillStyle = g;
      offCtx.beginPath();
      offCtx.arc(pos.x, pos.y, r, 0, 6.283);
      offCtx.fill();
    }
    offCtx.globalCompositeOperation = 'source-over';

    // 2) umbral (blur + contraste) y color: se hace en un canvas aparte para no
    // pintar la escena entera (bug: con source-atop sobre el canvas principal
    // toda la pantalla quedaba roja)
    off2Ctx.setTransform(1, 0, 0, 1, 0, 0);
    off2Ctx.clearRect(0, 0, W, H);
    off2Ctx.globalCompositeOperation = 'source-over';
    off2Ctx.filter = 'blur(5px) contrast(15)';
    off2Ctx.drawImage(off, 0, 0);
    off2Ctx.filter = 'none';
    off2Ctx.globalCompositeOperation = 'source-in';
    const lg = off2Ctx.createLinearGradient(0, E.bocaY, 0, H);
    lg.addColorStop(0, 'rgba(214,30,58,.97)');
    lg.addColorStop(0.55, 'rgba(158,18,42,.97)');
    lg.addColorStop(1, 'rgba(88,8,26,.97)');
    off2Ctx.fillStyle = lg;
    off2Ctx.fillRect(0, 0, W, H);
    off2Ctx.globalCompositeOperation = 'source-over';

    // 3) al canvas del juego
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(off2, 0, 0);
    ctx.restore();
  }

  function dibujarBotella(b) {
    if (!(IMG.botella.complete && IMG.botella.naturalWidth)) return;
    const alto = E.alto * 0.36;
    const ancho = alto * 0.318;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, b.alfa));
    // La botella va BOCA ABAJO: se rota 180° y se ancla por la boca, así el
    // pico queda en (b.x, bocaY) y el cuerpo sube hacia el borde de arriba.
    ctx.translate(b.x, E.bocaY);
    ctx.rotate(Math.PI + b.tilt);
    ctx.save();
    ctx.globalAlpha *= 0.45;
    ctx.shadowColor = 'rgba(0,0,0,.85)';
    ctx.shadowBlur = 28;
    ctx.shadowOffsetY = 12;
    // sólo el contenido del PNG (bbox medido), con la boca en el origen
    // recorte: se saltea el corcho del PNG (los primeros ~38 px del contenido),
    // así la botella vierte por una boca abierta y no por el tapón.
    ctx.drawImage(IMG.botella, 192, 62, 150, 431, -ancho / 2, 0, ancho, alto);
    ctx.restore();
    ctx.restore();
  }

  // ---------------- FLUJO ----------------
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
    E.tSpawn = 500;
    E.particulas.forEach((p) => M.World.remove(mundo, p.cuerpo));
    E.particulas = [];
    if (!mundo) crearMundo();

    // arranca con la botella del mouse (o donde estaba la última)
    const xIni = E.botellas[0] ? E.botellas[0].x : E.ancho / 2;
    E.botellas = [crearBotella('mouse', xIni)];
    E.botellas[0].alfa = 1;

    actualizarHud();
    document.getElementById('hud').classList.remove('hud-off');
    ['pantallaInicio', 'pantallaFin', 'pantallaPausa'].forEach((id) => document.getElementById(id).classList.remove('visible'));
  }

  function alternarPausa() {
    if (!E.jugando) return;
    E.pausado = !E.pausado;
    document.getElementById('pantallaPausa').classList.toggle('visible', E.pausado);
  }

  // Animación del puntaje final: cuenta de 0 al total en ~900 ms.
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

  document.getElementById('btnJugar').addEventListener('click', empezar);
  document.getElementById('btnOtra').addEventListener('click', empezar);
  document.getElementById('btnSeguir').addEventListener('click', alternarPausa);
  document.getElementById('btnReiniciar').addEventListener('click', empezar);
  document.getElementById('btnPausa').addEventListener('click', alternarPausa);

  let tRes = null;
  window.addEventListener('resize', () => { clearTimeout(tRes); tRes = setTimeout(ajustarTamano, 180); });

  ajustarTamano();
  requestAnimationFrame(frame);

  // API mínima para verificar desde consola
  window.VinoGame = {
    estado: E,
    empezar,
    gotas: () => E.particulas.length,
    botellas: () => E.botellas.map((b) => ({ id: b.id, x: Math.round(b.x), alfa: +b.alfa.toFixed(2) })),
    fondo: () => (window.FondoAgua ? window.FondoAgua.estado() : { listo: false }),
    punterosFondo: () => FEED.length,
    copas: () => E.copasArr.map((c) => ({
      lane: c.lane,
      estado: c.estado,
      nivel: +c.nivel.toFixed(2),
      objetivo: +c.nivelObjetivo.toFixed(2),
      vida: Math.round(c.vida)
    })),
    apuntar: (i) => { const b = E.botellas[0]; const c = E.copasArr[i || 0]; if (b && c) b.x = c.cx; },
    // fuerzan un desenlace para probar sin jugar
    vencer: (i) => { const c = E.copasArr[i || 0]; if (c && c.estado === 'activa') copaPerdida(c); },
    llenar: (i) => { const c = E.copasArr[i || 0]; if (c && c.estado === 'activa') { c.nivel = 1; copaLlena(c); } },
    terminar
  };
})();
