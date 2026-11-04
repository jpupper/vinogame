/* ============================================================
   BODEGA BUSTER · Deli & Wine  (v1.0)
   ------------------------------------------------------------
   Arkanoide con estética de bodega: la barra (borgoña + doble
   filete dorado) sigue al jugador y hay que romper las cajas de
   vino. 1 o 2 jugadores en canchas divididas.

   Todo se mide en "unidades U" = min(ancho, alto) en píxeles, así
   el juego se ve igual en un monitor 16:9, en un piso LIDAR ancho
   o en un celular vertical. Las posiciones nunca dependen del
   tamaño de la ventana.

   Entrada: pointer events (mouse, touch, y los blobs del LIDAR que
   `lidar-pointer.js` convierte en punteros reales).
   ============================================================ */
(function () {
    'use strict';

    // ---------------------------------------------------------------- utilidades
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function rnd(a, b) { return a + Math.random() * (b - a); }

    function rrect(ctx, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    // ---------------------------------------------------------------- audio
    var Sonido = (function () {
        var ctx = null, on = true, listo = false;
        function ac() {
            if (!ctx) {
                try {
                    var AC = window.AudioContext || window.webkitAudioContext;
                    if (AC) ctx = new AC();
                } catch (e) { ctx = null; }
            }
            if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
            listo = !!ctx;
            return ctx;
        }
        function tono(freq, dur, tipo, vol) {
            var c = ac();
            if (!c || !on) return;
            try {
                var o = c.createOscillator(), g = c.createGain();
                o.type = tipo || 'sine';
                o.frequency.value = freq;
                var t = c.currentTime;
                g.gain.setValueAtTime(0.0001, t);
                g.gain.linearRampToValueAtTime(vol || 0.07, t + 0.008);
                g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
                o.connect(g); g.connect(c.destination);
                o.start(t); o.stop(t + dur + 0.02);
            } catch (e) { }
        }
        return {
            desbloquear: ac,
            listo: function () { return listo; },
            on: function (v) { on = !!v; },
            blip: function () { tono(680, 0.05, 'triangle', 0.045); },
            hit: function () { tono(320, 0.09, 'square', 0.045); },
            pop: function () { tono(920, 0.07, 'sine', 0.05); },
            mal: function () { tono(150, 0.26, 'sawtooth', 0.055); },
            fanfarria: function () {
                [523, 659, 784, 1046].forEach(function (f, i) {
                    setTimeout(function () { tono(f, 0.24, 'triangle', 0.055); }, i * 95);
                });
            }
        };
    })();

    var UVAS_POR_COPA = 12;   // cada 12 uvas se sirve una copa

    // ---------------------------------------------------------------- configuración
    var CFG_DEF = { velocidad: 1, paleta: 1, filas: 5, vidas: 3, modo: 1 };

    var COLORES = [
        ['#4a0b19', '#7a1330'],
        ['#7a1330', '#a8203f'],
        ['#a8203f', '#c93a55'],
        ['#b3862a', '#d9a441'],
        ['#d9a441', '#f0cd8c'],
        ['#e8c477', '#fff2c3'],
        ['#4a2c1a', '#7d4c26'],
        ['#2c3a2c', '#546a56'],
        ['#6d0b1e', '#a4132f']
    ];

    // ---------------------------------------------------------------- estado
    var E = {
        canvas: null, ctx: null,
        W: 0, H: 0, U: 1, VW: 1, VH: 1, dpr: 1,
        estado: 'inicio',            // inicio | jugando | pausa | fin
        t: 0, ultimo: 0, dt: 0,
        cfg: Object.assign({}, CFG_DEF),
        campos: [],
        nivel: 1,
        puntos: 0, cosecha: 0, uvas: 0,
        flotantes: [],
        racimoImg: null, copaImg: null, ladrillos: [],
        punteros: new Map(),
        lider: null,
        particulas: [],
        mensaje: null,
        logoImg: null,
        record: 0,
        ganador: null
    };

    // ---------------------------------------------------------------- DOM
    var $ = function (sel) { return document.querySelector(sel); };
    var el = {};

    function cachearDom() {
        el.hud = $('#hud');
        el.hudEtqP1 = $('#hudEtqP1');
        el.hudPuntos = $('#hudPuntos');
        el.hudUvas = $('#hudUvas');
        el.hudCopas = $('#hudCopas');
        el.hudNivel = $('#hudNivel');
        el.hudNivelBloque = $('#hudNivelBloque');
        el.hudVidas = $('#hudVidas');
        el.hudPlayer2 = $('#hudPlayer2');
        el.hudEtqP2 = $('#hudEtqP2');
        el.hudPuntosDer = $('#hudPuntosDer');
        el.hudUvasP2 = $('#hudUvasP2');
        el.hudCopasP2 = $('#hudCopasP2');
        el.hudVidasP2 = $('#hudVidasP2');

        el.inicio = $('#pantallaInicio');
        el.fin = $('#pantallaFin');
        el.btnJugar = $('#btnJugar');
        el.btnOtra = $('#btnOtra');
        el.btnReiniciar = $('#btnReiniciar');
        el.btnSalir = $('#btnSalir');
        el.finPuntos = $('#finPuntos');
        el.finBloques = $('#finBloques');
        el.finCopas = $('#finCopas');
        el.finNivel = $('#finNivel');
        el.finRecord = $('#finRecord');
        el.finCartel = $('#finCartel');
        el.finKicker = $('#finKicker');
    }

    function pantalla(vis) {
        [el.inicio, el.pausa, el.fin].forEach(function (p) {
            if (!p) return;
            p.classList.toggle('visible', p === vis);
        });
    }

    // ---------------------------------------------------------------- vida útil del canvas
    function redimensionar() {
        var c = E.canvas;
        var w = window.innerWidth, h = window.innerHeight;
        E.dpr = Math.min(2, window.devicePixelRatio || 1);
        E.W = w; E.H = h;
        c.width = Math.round(w * E.dpr);
        c.height = Math.round(h * E.dpr);
        c.style.width = w + 'px';
        c.style.height = h + 'px';
        var ctx = E.ctx;
        ctx.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);

        E.U = Math.min(w, h);
        E.VW = w / E.U;
        E.VH = h / E.U;

        // reacomodar lo que ya existe (no se pierde el estado de la partida)
        E.campos.forEach(function (campo) {
            campo.padY = E.VH - 0.085;
            campo.padW = 0.148 * E.cfg.paleta;
            campo.padX = clamp(campo.padX, campo.x0 + campo.padW / 2, campo.x1 - campo.padW / 2);
            layoutBloques(campo);
            if (campo.ball) {
                campo.ball.x = clamp(campo.ball.x, campo.x0 + 0.02, campo.x1 - 0.02);
                campo.ball.y = clamp(campo.ball.y, 0.03, E.VH - 0.02);
            }
        });
    }

    // ---------------------------------------------------------------- partículas
    function estallido(x, y, color, n, vel) {
        for (var i = 0; i < n; i++) {
            var a = Math.random() * Math.PI * 2;
            var v = rnd(vel * 0.25, vel);
            E.particulas.push({
                x: x, y: y,
                vx: Math.cos(a) * v, vy: Math.sin(a) * v - vel * 0.25,
                vida: rnd(0.35, 0.85), max: 0.85,
                r: rnd(0.004, 0.011), color: color
            });
            if (E.particulas.length > 220) E.particulas.shift();
        }
    }

    function actualizarParticulas(dt) {
        for (var i = E.particulas.length - 1; i >= 0; i--) {
            var p = E.particulas[i];
            p.vida -= dt;
            if (p.vida <= 0) { E.particulas.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 1.6 * dt;
        }
    }

    // ---------------------------------------------------------------- campos y bloques
    function nuevoCampo(i, n) {
        var x0, x1;
        if (n === 1) { x0 = 0.02; x1 = E.VW - 0.02; }
        else if (i === 0) { x0 = 0.012; x1 = E.VW / 2 - 0.012; }
        else { x0 = E.VW / 2 + 0.012; x1 = E.VW - 0.012; }

        var campo = {
            lane: i,
            x0: x0, x1: x1,
            padX: (x0 + x1) / 2,
            padY: E.VH - 0.085,
            padW: 0.192 * E.cfg.paleta,
            bricks: [],
            vidas: E.cfg.vidas | 0,
            out: false,
            puntos: 0,
            uvas: 0,
            col: i === 0 ? '#ffd25f' : '#e8788f',
            brillo: i === 0 ? 'rgba(255,210,95,' : 'rgba(232,120,143,',
            ball: null,
            total: 0
        };
        generarBloques(campo, n);
        nuevaBola(campo);
        return campo;
    }

    function filasActuales() {
        return Math.min(9, (E.cfg.filas | 0) + (E.nivel - 1));
    }

    function columnasActuales(n) {
        var cuantos = n || E.campos.length || 1;
        return cuantos === 2 ? 6 : 10;
    }

    function generarBloques(campo, nCampos) {
        var filas = filasActuales();
        var cols = columnasActuales(nCampos);
        var gap = 0.0055;
        var x0 = campo.x0 + 0.014, x1 = campo.x1 - 0.014;
        var bw = (x1 - x0 - gap * (cols - 1)) / cols;
        var bh = 0.045;
        var top = 0.128;
        campo.bricks = [];
        for (var r = 0; r < filas; r++) {
            for (var c = 0; c < cols; c++) {
                campo.bricks.push({
                    row: r, col: c,
                    x: x0 + c * (bw + gap),
                    y: top + r * (bh + gap),
                    w: bw, h: bh,
                    alive: true, hit: 0
                });
            }
        }
        campo.total = filas * cols;
    }

    // Recalcula geometría sin perder qué bloques están vivos (resize / cambio de filas)
    function layoutBloques(campo) {
        if (!campo.bricks.length) return;
        var filas = Math.max.apply(null, campo.bricks.map(function (b) { return b.row; })) + 1;
        var cols = Math.max.apply(null, campo.bricks.map(function (b) { return b.col; })) + 1;
        var gap = 0.0055;
        var x0 = campo.x0 + 0.014, x1 = campo.x1 - 0.014;
        var bw = (x1 - x0 - gap * (cols - 1)) / cols;
        var bh = 0.045;
        var top = 0.128;
        campo.bricks.forEach(function (b) {
            b.w = bw; b.h = bh;
            b.x = x0 + b.col * (bw + gap);
            b.y = top + b.row * (bh + gap);
        });
    }

    function nuevaBola(campo) {
        campo.ball = {
            x: campo.padX,
            y: campo.padY - 0.032,
            r: 0.023,
            vx: 0, vy: 0,
            pegada: true,
            espera: 0.85,
            estela: []
        };
    }

    function lanzar(campo) {
        var b = campo.ball;
        var ang = -Math.PI / 2 + rnd(-0.28, 0.28);
        var sp = velocidadBase();
        b.vx = Math.cos(ang) * sp;
        b.vy = Math.sin(ang) * sp;
        b.pegada = false;
    }

    function velocidadBase() {
        // En una pantalla alta (celular vertical) la cancha mide 2+ U: sin este
        // factor la bola tarda 7 s en ir y volver y el juego se siente congelado.
        var alto = clamp(E.VH / 1.25, 1, 1.7);
        return 0.60 * E.cfg.velocidad * alto * (1 + (E.nivel - 1) * 0.055);
    }

    function bloquesVivos(campo) {
        var n = 0;
        campo.bricks.forEach(function (b) { if (b.alive) n++; });
        return n;
    }

    // ---------------------------------------------------------------- partida
    function empezar() {
        Sonido.desbloquear();
        E.estado = 'jugando';
        E.nivel = 1;
        E.puntos = 0;
        E.cosecha = 0;
        E.uvas = 0;
        E.flotantes.length = 0;
        E.particulas.length = 0;
        E.mensaje = null;

        var n = E.cfg.modo === 2 ? 2 : 1;
        E.campos = [];
        E.ganador = null;
        for (var i = 0; i < n; i++) E.campos.push(nuevoCampo(i, n));

        pantalla(null);
        el.hud.classList.remove('hud-off');
        el.hud.classList.toggle('modo-2', n === 2);
        if (n === 2) {
            if (el.hudEtqP1) el.hudEtqP1.textContent = 'JUGADOR 1';
            if (el.hudEtqP2) el.hudEtqP2.textContent = 'JUGADOR 2';
        } else {
            if (el.hudEtqP1) el.hudEtqP1.textContent = 'PUNTOS';
        }
        pintarVidas();
        actualizarHud();
        E.mensaje = { texto: n === 2 ? '¡A DOS BARRAS!' : '¡A ROMPER LA COSECHA!', hasta: E.t + 2.2 };
    }

    function pausar() {
        if (E.estado !== 'jugando') return;
        E.estado = 'pausa';
        pantalla(el.pausa);
    }

    function seguir() {
        if (E.estado !== 'pausa') return;
        E.estado = 'jugando';
        pantalla(null);
        Sonido.desbloquear();
    }

    function alInicio() {
        if (E.timerFin) { clearTimeout(E.timerFin); E.timerFin = null; }
        E.estado = 'inicio';
        E.campos = [];
        E.ganador = null;
        E.puntos = 0;
        E.uvas = 0;
        E.nivel = 1;
        pantalla(el.inicio);   // pantalla de seleccion (1 / 2 jugadores)
        el.hud.classList.add('hud-off');
        el.hud.classList.remove('modo-2');
    }

    // Un solo lugar decide cuando se vuelve a la pantalla de seleccion.
    function alFin() {
        if (E.timerFin) clearTimeout(E.timerFin);
        E.timerFin = setTimeout(function () {
            E.timerFin = null;
            if (E.estado === 'fin') alInicio();
        }, 6000);
    }

    function terminar() {
        E.estado = 'fin';
        alFin();
        var r = E.record;
        if (E.puntos > r) {
            r = E.puntos;
            E.record = r;
            try { localStorage.setItem('dw:buster:record', String(r)); } catch (e) { }
        }
        var dos = E.campos.length === 2;
        var a = dos ? E.campos[0] : null, b = dos ? E.campos[1] : null;

        el.finPuntos.textContent = E.puntos;
        el.finBloques.textContent = E.uvas;
        if (el.finCopas) el.finCopas.textContent = Math.floor(E.uvas / UVAS_POR_COPA);
        el.finNivel.textContent = dos ? 1 : E.nivel;
        el.finRecord.textContent = r;

        if (dos) {
            var winner = ganadorLane();
            el.finPuntos.textContent = Math.max(a.puntos, b.puntos);
            el.finBloques.textContent = (a.uvas || 0) + (b.uvas || 0);
            if (el.finCopas) el.finCopas.textContent = Math.floor(((a.uvas || 0) + (b.uvas || 0)) / UVAS_POR_COPA);
            el.finNivel.textContent = 1;
            el.finRecord.textContent = r;

            var sts = el.fin.querySelectorAll('.fin-stat');
            if (sts[0]) sts[0].innerHTML = '<span class="fin-stat-etq">JUGADOR 1</span><span class="fin-stat-val">' + a.puntos + '</span>';
            if (sts[1]) sts[1].innerHTML = '<span class="fin-stat-etq">JUGADOR 2</span><span class="fin-stat-val">' + b.puntos + '</span>';
            if (sts[2]) sts[2].innerHTML = '<span class="fin-stat-etq">COPAS</span><span class="fin-stat-val">' + Math.floor(((a.uvas || 0) + (b.uvas || 0)) / UVAS_POR_COPA) + '</span>';
            if (sts[3]) sts[3].innerHTML = '<span class="fin-stat-etq">GANADOR</span><span class="fin-stat-val">JUG. ' + (winner + 1) + '</span>';

            var winnerText = winner === 0 ? '¡GANA EL JUGADOR 1 (IZQUIERDA)!' : '¡GANA EL JUGADOR 2 (DERECHA)!';
            if (a.puntos === b.puntos && (E.ganador === null || E.ganador === undefined)) {
                winnerText = '¡DUELO EMPATADO!';
            }
            if (el.finCartel) el.finCartel.textContent = winnerText;
            if (el.finKicker) el.finKicker.textContent = '✦ ¡FIN DEL DUELO! ✦';
            if (el.btnOtra) el.btnOtra.textContent = 'SELECCIÓN';
        } else {
            el.finPuntos.textContent = E.puntos;
            el.finBloques.textContent = E.uvas;
            if (el.finCopas) el.finCopas.textContent = Math.floor(E.uvas / UVAS_POR_COPA);
            el.finNivel.textContent = E.nivel;
            el.finRecord.textContent = r;
            var sts1 = el.fin.querySelectorAll('.fin-stat');
            if (sts1[0]) sts1[0].innerHTML = '<span class="fin-stat-etq">UVAS</span><span class="fin-stat-val">' + E.uvas + '</span>';
            if (sts1[1]) sts1[1].innerHTML = '<span class="fin-stat-etq">COPAS</span><span class="fin-stat-val">' + Math.floor(E.uvas / UVAS_POR_COPA) + '</span>';
            if (sts1[2]) sts1[2].innerHTML = '<span class="fin-stat-etq">NIVEL</span><span class="fin-stat-val">' + E.nivel + '</span>';
            if (sts1[3]) sts1[3].innerHTML = '<span class="fin-stat-etq">RÉCORD</span><span class="fin-stat-val">' + r + '</span>';
            if (el.finCartel) el.finCartel.textContent = 'TU MEJOR MARCA: ' + r;
            if (el.finKicker) el.finKicker.textContent = '✦ Se terminó la cosecha ✦';
            if (el.btnOtra) el.btnOtra.textContent = 'JUGAR OTRA VEZ';
        }

        pantalla(el.fin);
        el.hud.classList.add('hud-off');
        // 2) al terminar vuelve SOLO a la pantalla de seleccion. El tiempo se
        // administra en un unico timer (alFin) para que nunca queden dos.

        Sonido.mal();
    }

    // quién ganó la partida de 2: el que tiene más puntos (0 = izquierda)
    function ganadorLane() {
        if (E.campos.length !== 2) return 0;
        var a = E.campos[0], b = E.campos[1];
        if (E.ganador !== null && E.ganador !== undefined) return E.ganador;
        if (a.puntos === b.puntos) return 0;
        return a.puntos > b.puntos ? 0 : 1;
    }

    function perderVida(campo) {
        campo.vidas--;
        var b = campo.ball;
        estallido(b.x, b.y, ['#a4132f', '#ffd25f', '#fff2c3'], 26, 1.5);
        if (window.Impactos) {
            window.Impactos.golpe(b.x / E.VW, Math.min(1, b.y / E.VH), { color: 'vino', fuerza: 1.3 });
        }
        Sonido.mal();
        if (campo.vidas <= 0) {
            campo.out = true;
            campo.vidas = 0;
            E.mensaje = { texto: E.campos.length === 2 ? (campo.lane === 0 ? '¡SE CAYÓ LA BARRERA IZQUIERDA!' : '¡SE CAYÓ LA BARRERA DERECHA!') : '¡ÚLTIMA BOTELLA!', hasta: E.t + 1.8 };
            if (E.campos.every(function (c) { return c.out; })) {
                if (E.campos.length === 2) {
                    var a = E.campos[0], bb = E.campos[1];
                    el.finKicker.textContent = a.puntos === bb.puntos ? '✦ Empate de bodega ✦' :
                        (a.puntos > bb.puntos ? '✦ Gana el jugador izquierdo ✦' : '✦ Gana el jugador derecho ✦');
                }
                setTimeout(terminar, 700);
            }
            return;
        }
        E.mensaje = { texto: campo.vidas + (campo.vidas === 1 ? ' vida' : ' vidas'), hasta: E.t + 1.4 };
        nuevaBola(campo);
        pintarVidas();
    }

    function nivelCompleto(campo) {
        // 2 JUGADORES: el que termina la cosecha gana el duelo, no pasa de nivel.
        if (E.campos.length === 2) {
            var bonus = 250 + (E.nivel - 1) * 100;
            campo.puntos += bonus;
            E.puntos += bonus;
            E.ganador = campo.lane;
            E.mensaje = { texto: campo.lane === 0 ? '¡GANA EL JUGADOR 1 (IZQUIERDA)!' : '¡GANA EL JUGADOR 2 (DERECHA)!', hasta: E.t + 3.0 };
            var cx2 = (campo.x0 + campo.x1) / 2, cy2 = E.VH * 0.32;
            estallido(cx2, cy2, ['#ffd25f', '#fff2c3', '#e8788f'], 60, 2.2);
            Sonido.fanfarria();
            actualizarHud();
            setTimeout(terminar, 900);
            return;
        }
        // 1 JUGADOR: bonus y nivel siguiente (la partida sigue)
        var bonus = 250 + (E.nivel - 1) * 100;
        campo.puntos += bonus;
        E.puntos += bonus;
        E.nivel++;
        E.mensaje = { texto: '¡COSECHA COMPLETA!  +' + bonus, hasta: E.t + 2.2 };
        var cx = (campo.x0 + campo.x1) / 2, cy = E.VH * 0.32;
        estallido(cx, cy, ['#ffd25f', '#fff2c3', '#e8788f'], 60, 2.2);
        Sonido.fanfarria();
        generarBloques(campo);
        nuevaBola(campo);
        actualizarHud();
    }

    // ---------------------------------------------------------------- entrada
    function objetivoCampo(campo) {
        // devuelve x en unidades U del puntero que le corresponde a la cancha
        var mejor = null, mejorD = Infinity;
        var mitad = E.VW / 2;
        E.punteros.forEach(function (p, id) {
            var x = p.x / E.U;
            if (E.campos.length === 2) {
                var lado = campo.lane === 0 ? (x < mitad) : (x >= mitad);
                if (!lado) return;
            } else if (E.lider !== null && E.punteros.size > 1 && id !== E.lider) {
                return;
            }
            var d = Math.abs(x - campo.padX);
            if (d < mejorD) { mejorD = d; mejor = x; }
        });
        return mejor;
    }

    function moverPaletas(dt) {
        E.campos.forEach(function (campo) {
            var obj = objetivoCampo(campo);
            if (obj === null || obj === undefined) return;
            var lim = campo.padW / 2;
            var destino = clamp(obj, campo.x0 + lim + 0.006, campo.x1 - lim - 0.006);
            campo.padX += (destino - campo.padX) * Math.min(1, dt * 13);
        });
    }

    function conectarEntrada() {
        var canvas = E.canvas;

        function punto(ev) {
            return { x: ev.clientX, y: ev.clientY };
        }
        function abajo(ev) {
            Sonido.desbloquear();
            if (E.estado !== 'jugando') return;
            var p = punto(ev);
            E.punteros.set(ev.pointerId, p);
            if (E.lider === null) E.lider = ev.pointerId;
        }
        function mover(ev) {
            if (E.estado !== 'jugando') return;
            var p = punto(ev);
            if (!E.punteros.has(ev.pointerId) && ev.pointerType === 'mouse') {
                // el mouse no necesita botón apretado: es el comportamiento del original
                E.punteros.set(ev.pointerId, p);
                if (E.lider === null) E.lider = ev.pointerId;
            } else {
                E.punteros.set(ev.pointerId, p);
            }
        }
        function arriba(ev) {
            if (ev.pointerType === 'mouse') return;  // el mouse queda "vivo" siempre
            E.punteros.delete(ev.pointerId);
            if (E.lider === ev.pointerId) {
                E.lider = null;
                E.punteros.forEach(function (v, id) { if (E.lider === null) E.lider = id; });
            }
        }

        canvas.addEventListener('pointerdown', abajo);
        window.addEventListener('pointermove', mover, { passive: true });
        window.addEventListener('pointerup', arriba);
        window.addEventListener('pointercancel', arriba);
        window.addEventListener('blur', function () { E.punteros.clear(); E.lider = null; });

        // teclado
        window.addEventListener('keydown', function (ev) {
            if (ev.code === 'Space' || ev.code === 'Enter') {
                ev.preventDefault();
                if (E.estado === 'inicio') empezar();
                else if (E.estado === 'fin') {
                    if (E.cfg.modo === 2 || E.campos.length === 2) alInicio();
                    else empezar();
                }
            } else if (ev.code === 'KeyR') {
                if (E.estado !== 'inicio') alInicio();
            }
        });

        // botones
        var boton = function (b, fn) { if (b) b.addEventListener('click', fn); };
        boton(el.btnJugar, empezar);
        boton(el.btnReiniciar, empezar);
        boton(el.btnSalir, alInicio);
        boton(el.btnOtra, function () {
            if (E.cfg.modo === 2 || E.campos.length === 2) alInicio();
            else empezar();
        });
        document.querySelectorAll('.modo').forEach(function (b) {
            b.addEventListener('click', function () {
                var m = Number(b.getAttribute('data-modo')) || 1;
                E.cfg.modo = m;
                document.querySelectorAll('.modo').forEach(function (o) {
                    o.classList.toggle('activo', o === b);
                });
                Sonido.desbloquear();
            });
        });
    }

    // ---------------------------------------------------------------- lógica
    function moverBola(campo, dt) {
        var b = campo.ball;
        var paredIzq = campo.x0 + 0.009;
        var paredDer = campo.x1 - 0.009;

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // paredes laterales
        if (b.x - b.r < paredIzq) { b.x = paredIzq + b.r; b.vx = Math.abs(b.vx); Sonido.blip(); }
        if (b.x + b.r > paredDer) { b.x = paredDer - b.r; b.vx = -Math.abs(b.vx); Sonido.blip(); }
        // techo
        if (b.y - b.r < 0.012) { b.y = 0.012 + b.r; b.vy = Math.abs(b.vy); Sonido.blip(); }

        // paleta
        var padTop = campo.padY - 0.014;
        var padBot = campo.padY + 0.014;
        if (b.vy > 0 &&
            b.y + b.r >= padTop && b.y - b.r <= padBot &&
            b.x >= campo.padX - campo.padW / 2 - b.r && b.x <= campo.padX + campo.padW / 2 + b.r) {
            var off = clamp((b.x - campo.padX) / (campo.padW / 2), -1, 1);
            var ang = off * 1.02 - Math.PI / 2;
            var sp = Math.hypot(b.vx, b.vy) || velocidadBase();
            b.vx = Math.cos(ang) * sp;
            b.vy = Math.sin(ang) * sp;
            b.y = padTop - b.r;
            Sonido.hit();
            estallido(b.x, b.y, [campo.col, '#fff2c3'], 7, 0.85);
            if (window.Impactos) {
                window.Impactos.golpe(b.x / E.VW, b.y / E.VH, { color: 'vino', fuerza: 1.0 });
            }
        }

        // bloques
        for (var i = 0; i < campo.bricks.length; i++) {
            var br = campo.bricks[i];
            if (!br.alive) continue;
            var cx = clamp(b.x, br.x, br.x + br.w);
            var cy = clamp(b.y, br.y, br.y + br.h);
            var dx = b.x - cx, dy = b.y - cy;
            if (dx * dx + dy * dy > b.r * b.r) continue;

            br.alive = false;
            br.hit = 1;
            campo.puntos += 10;
            campo.uvas = (campo.uvas || 0) + 3;
            E.puntos += 10;
            E.cosecha++;
            E.uvas += 3;
            E.flotantes.push({ x: br.x + br.w / 2, y: br.y + br.h / 2, texto: '+3', vida: 0.9, max: 0.9 });
            if (dx === 0 && dy === 0) {
                b.vy = -b.vy;
            } else if (Math.abs(dx) > Math.abs(dy)) {
                b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
            } else {
                b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
            }
            estallido(br.x + br.w / 2, br.y + br.h / 2, ['#a44bb8', '#5d1c6d', '#ffd25f', '#6f8a3f'], 12, 1.5);
            if (window.Impactos) {
                window.Impactos.golpe((br.x + br.w / 2) / E.VW, (br.y + br.h / 2) / E.VH,
                    { color: 'oro', fuerza: 0.75 });
            }
            Sonido.pop();
            break;
        }

        // estela
        b.estela.push({ x: b.x, y: b.y });
        if (b.estela.length > 9) b.estela.shift();

        // se cayó
        if (b.y - b.r > E.VH) {
            perderVida(campo);
            return;
        }

        // nivel completo
        if (bloquesVivos(campo) === 0) {
            nivelCompleto(campo);
        }
    }

    function actualizar(dt) {
        E.t += dt;
        actualizarParticulas(dt);
        for (var i = E.flotantes.length - 1; i >= 0; i--) {
            var f = E.flotantes[i];
            f.vida -= dt;
            f.y -= 0.045 * dt;
            if (f.vida <= 0) E.flotantes.splice(i, 1);
        }
        if (E.mensaje && E.t > E.mensaje.hasta) E.mensaje = null;

        if (E.estado !== 'jugando') return;

        moverPaletas(dt);

        for (var i = 0; i < E.campos.length; i++) {
            var campo = E.campos[i];
            if (campo.out) continue;
            var b = campo.ball;

            if (b.pegada) {
                b.x = campo.padX;
                b.y = campo.padY - 0.032;
                b.espera -= dt;
                if (b.espera <= 0) lanzar(campo);
                continue;
            }

            // límite de velocidad (que no se acelere ni se frene de más)
            var sp = Math.hypot(b.vx, b.vy);
            var base = velocidadBase();
            var minS = base * 0.72, maxS = base * 1.45;
            if (sp > 0.0001 && (sp < minS || sp > maxS)) {
                var f = clamp(sp, minS, maxS) / sp;
                b.vx *= f; b.vy *= f;
            }

            // subpasos: con dt grande la bola no atraviesa bloques
            var pasos = clamp(Math.ceil((Math.hypot(b.vx, b.vy) * dt) / (b.r * 0.7)), 1, 8);
            for (var s = 0; s < pasos; s++) {
                moverBola(campo, dt / pasos);
                if (campo.out || campo.ball.pegada) break;
            }
        }

        actualizarHud();
    }

    // ---------------------------------------------------------------- HUD
    var GLASS_SVG = '<svg class="vida" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M6.6 3h10.8l-1.3 6.1A4.9 4.9 0 0 1 12 13.3a4.9 4.9 0 0 1-4.1-4.2Z" fill="#8a1738" stroke="#ffd25f" stroke-width="1.3" stroke-linejoin="round"/>' +
        '<path d="M12 13.3V19" stroke="#ffd25f" stroke-width="1.2"/>' +
        '<path d="M8.4 20.6h7.2" stroke="#ffd25f" stroke-width="1.5" stroke-linecap="round"/></svg>';

    function pintarVidas() {
        if (!el.hudVidas) return;
        var total = Math.max(E.cfg.vidas, 3);
        var n1 = E.campos.length ? E.campos[0].vidas : E.cfg.vidas;
        var html1 = '';
        for (var i = 0; i < total; i++) {
            html1 += GLASS_SVG.replace('class="vida"', 'class="vida' + (i < n1 ? '' : ' off') + '"');
        }
        el.hudVidas.innerHTML = html1;

        if (el.hudVidasP2 && E.campos.length === 2) {
            var n2 = E.campos[1].vidas;
            var html2 = '';
            for (var j = 0; j < total; j++) {
                html2 += GLASS_SVG.replace('class="vida"', 'class="vida' + (j < n2 ? '' : ' off') + '"');
            }
            el.hudVidasP2.innerHTML = html2;
        }
    }

    function actualizarHud() {
        if (!el.hudPuntos) return;
        if (E.estado === 'fin' || E.estado === 'inicio') return;

        if (E.campos.length === 2) {
            var p1 = E.campos[0], p2 = E.campos[1];
            if (el.hudPuntos) el.hudPuntos.textContent = p1.puntos;
            if (el.hudUvas) el.hudUvas.textContent = p1.uvas || 0;
            if (el.hudCopas) el.hudCopas.textContent = Math.floor((p1.uvas || 0) / UVAS_POR_COPA);

            if (el.hudPuntosDer) el.hudPuntosDer.textContent = p2.puntos;
            if (el.hudUvasP2) el.hudUvasP2.textContent = p2.uvas || 0;
            if (el.hudCopasP2) el.hudCopasP2.textContent = Math.floor((p2.uvas || 0) / UVAS_POR_COPA);
            pintarVidas();
        } else {
            if (el.hudPuntos) el.hudPuntos.textContent = E.puntos;
            if (el.hudUvas) el.hudUvas.textContent = E.uvas;
            if (el.hudCopas) el.hudCopas.textContent = Math.floor(E.uvas / UVAS_POR_COPA);
            if (el.hudNivel) el.hudNivel.textContent = E.nivel;
            if (E.campos.length === 1) {
                pintarVidas();
            }
        }
    }

    // ---------------------------------------------------------------- dibujo
    function dibujarFondo(ctx, t) {
        var W = E.W, H = E.H, U = E.U;
        var fotos = !!(window.FondoDW && window.FondoDW.activo && window.FondoDW.activo());

        if (!fotos) {
            var g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, '#0c0508');
            g.addColorStop(0.55, '#0a0406');
            g.addColorStop(1, '#15070d');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);

            // brillos de bodega
            var fl = 0.5 + 0.5 * Math.sin(t * 0.35);
            var r1 = ctx.createRadialGradient(W * 0.5, H * -0.1, 0, W * 0.5, H * -0.1, H * 0.95);
            r1.addColorStop(0, 'rgba(164,19,47,' + (0.30 + fl * 0.06).toFixed(3) + ')');
            r1.addColorStop(1, 'rgba(164,19,47,0)');
            ctx.fillStyle = r1;
            ctx.fillRect(0, 0, W, H);

            var r2 = ctx.createRadialGradient(W * 0.12, H * 1.05, 0, W * 0.12, H * 1.05, H * 0.8);
            r2.addColorStop(0, 'rgba(255,210,95,' + (0.075 + fl * 0.03).toFixed(3) + ')');
            r2.addColorStop(1, 'rgba(255,210,95,0)');
            ctx.fillStyle = r2;
            ctx.fillRect(0, 0, W, H);

            var r3 = ctx.createRadialGradient(W * 0.9, H * 0.9, 0, W * 0.9, H * 0.9, H * 0.7);
            r3.addColorStop(0, 'rgba(90,19,41,' + (0.34 + fl * 0.04).toFixed(3) + ')');
            r3.addColorStop(1, 'rgba(90,19,41,0)');
            ctx.fillStyle = r3;
            ctx.fillRect(0, 0, W, H);
        } else {
            // fotos del viñedo con displace: sólo un velo para que se lean las cajas
            ctx.fillStyle = 'rgba(10,4,6,.15)';
            ctx.fillRect(0, 0, W, H);
        }

        // (marco dorado exterior: se saco del juego)

        // marca de agua de la bodega, detrás de todo
        if (E.logoImg && E.logoImg.width) {
            var lw = U * 0.46;
            var lh = lw * (E.logoImg.height / E.logoImg.width);
            ctx.save();
            ctx.globalAlpha = fotos ? 0.035 : 0.032;
            ctx.drawImage(E.logoImg, W / 2 - lw / 2, (E.VH * U) * 0.52 - lh / 2, lw, lh);
            ctx.restore();
        }

        // (marco inferior / barra de bodega: se saco del juego)
    }

    function dibujarBloque(ctx, b, U) {
        var x = b.x * U, y = b.y * U, w = b.w * U, h = b.h * U;
        var radios = Math.min(h * 0.22, U * 0.010);

        ctx.save();
        rrect(ctx, x, y, w, h, radios);
        ctx.clip();

        var img = E.ladrillos.length ? E.ladrillos[b.row % E.ladrillos.length] : null;
        if (img && img.naturalWidth) {
            // COVER: la imagen del ladrillo se recorta, nunca se estira. Cada bloque
            // es UNA imagen entera (nada de repetirla ni subdividirla).
            var iw = img.naturalWidth, ih = img.naturalHeight;
            var esc = Math.max(w / iw, h / ih);
            var dw = iw * esc, dh = ih * esc;
            ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
        } else {
            var par = COLORES[b.row % COLORES.length];
            var g = ctx.createLinearGradient(0, y, 0, y + h);
            g.addColorStop(0, par[1]);
            g.addColorStop(1, par[0]);
            ctx.fillStyle = g;
            ctx.fillRect(x, y, w, h);
        }

        // sombra en los bordes para que cada ladrillo despegue del de al lado
        var gs = ctx.createLinearGradient(0, y, 0, y + h);
        gs.addColorStop(0, 'rgba(255,242,195,.12)');
        gs.addColorStop(0.18, 'rgba(0,0,0,0)');
        gs.addColorStop(0.82, 'rgba(0,0,0,0)');
        gs.addColorStop(1, 'rgba(0,0,0,.42)');
        ctx.fillStyle = gs;
        ctx.fillRect(x, y, w, h);

        if (b.hit > 0) {
            ctx.globalAlpha = Math.min(1, b.hit) * 0.8;
            ctx.fillStyle = '#fff2c3';
            ctx.fillRect(x, y, w, h);
            ctx.globalAlpha = 1;
        }
        ctx.restore();

        // filete dorado fino
        ctx.save();
        ctx.strokeStyle = 'rgba(255,210,95,.45)';
        ctx.lineWidth = Math.max(1, U * 0.0018);
        rrect(ctx, x, y, w, h, radios);
        ctx.stroke();
        ctx.restore();
    }

    function dibujarPaleta(ctx, campo, U) {
        var pw = campo.padW * U;
        var ph = Math.max(12, U * 0.034);
        var x = campo.padX * U - pw / 2;
        var y = campo.padY * U - ph / 2;
        var r = ph / 2;

        ctx.save();
        ctx.shadowColor = campo.brillo + '.55)';
        ctx.shadowBlur = U * 0.045;

        var g = ctx.createLinearGradient(0, y, 0, y + ph);
        g.addColorStop(0, '#6d1730');
        g.addColorStop(0.45, '#4a0c1e');
        g.addColorStop(1, '#2c0611');
        ctx.fillStyle = g;
        rrect(ctx, x, y, pw, ph, r);
        ctx.fill();

        // la barra es un listón de roble de la bodega (misma familia que los ladrillos)
        var madera = E.ladrillos.length > 1 ? E.ladrillos[1] : null;
        if (madera && madera.naturalWidth) {
            ctx.save();
            rrect(ctx, x, y, pw, ph, r);
            ctx.clip();
            var iw = madera.naturalWidth, ih = madera.naturalHeight;
            var esc = Math.max(pw / iw, ph / ih);
            ctx.globalAlpha = 0.85;
            ctx.drawImage(madera, x + (pw - iw * esc) / 2, y + (ph - ih * esc) / 2, iw * esc, ih * esc);
            ctx.globalAlpha = 1;
            var sombra = ctx.createLinearGradient(0, y, 0, y + ph);
            sombra.addColorStop(0, 'rgba(255,242,195,.16)');
            sombra.addColorStop(1, 'rgba(0,0,0,.45)');
            ctx.fillStyle = sombra;
            ctx.fillRect(x, y, pw, ph);
            ctx.restore();
        }
        ctx.restore();

        // filete dorado doble (el ADN visual de los botones de Deli & Wine)
        ctx.save();
        ctx.strokeStyle = '#ffd25f';
        ctx.lineWidth = Math.max(1.6, U * 0.0042);
        rrect(ctx, x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, pw - ctx.lineWidth, ph - ctx.lineWidth, r);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,242,195,.8)';
        ctx.lineWidth = Math.max(1, U * 0.0016);
        rrect(ctx, x + ctx.lineWidth * 3.4, y + ctx.lineWidth * 3.4, pw - ctx.lineWidth * 6.8, ph - ctx.lineWidth * 6.8, r * 0.7);
        ctx.stroke();

        // destello central
        ctx.fillStyle = 'rgba(255,210,95,.55)';
        ctx.beginPath();
        ctx.arc(campo.padX * U, campo.padY * U, Math.max(1.4, U * 0.0035), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function dibujarBola(ctx, campo, U) {
        var b = campo.ball;
        if (!b) return;
        var bx = b.x * U, by = b.y * U, r = b.r * U;

        // estela
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < b.estela.length; i++) {
            var p = b.estela[i];
            var f = (i + 1) / b.estela.length;
            ctx.fillStyle = 'rgba(164,19,47,' + (f * 0.18).toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(p.x * U, p.y * U, r * (0.35 + f * 0.8), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // halo
        ctx.save();
        var halo = ctx.createRadialGradient(bx, by, 0, bx, by, r * 4);
        halo.addColorStop(0, 'rgba(255,210,95,.35)');
        halo.addColorStop(0.4, 'rgba(164,19,47,.30)');
        halo.addColorStop(1, 'rgba(164,19,47,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(bx, by, r * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // la BOLA ES UNA SOLA UVA DE VINO
        var img = E.uvaImg;
        if (img && img.naturalWidth) {
            var s = r * 2.2;
            var giro = b.estela.length ? Math.atan2(b.vy, b.vx) : 0;
            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(giro * 0.4);
            var halo2 = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.65);
            halo2.addColorStop(0, 'rgba(255,210,95,.35)');
            halo2.addColorStop(1, 'rgba(255,210,95,0)');
            ctx.fillStyle = halo2;
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.65, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowColor = 'rgba(255,210,95,.6)';
            ctx.shadowBlur = U * 0.018;
            ctx.drawImage(img, -s / 2, -s / 2, s, s);
            ctx.restore();
            return;
        }

        // respaldo (sin sprite): uva esférica en tonos vino
        ctx.save();
        var g = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, r * 0.1, bx, by, r);
        g.addColorStop(0, '#f0cd8c');
        g.addColorStop(0.25, '#a4132f');
        g.addColorStop(0.7, '#6d0b1e');
        g.addColorStop(1, '#2c0611');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function dibujarParticulas(ctx, U) {
        if (!E.particulas.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < E.particulas.length; i++) {
            var p = E.particulas[i];
            var a = clamp(p.vida / p.max, 0, 1);
            ctx.globalAlpha = a;
            ctx.fillStyle = Array.isArray(p.color) ? p.color[i % p.color.length] : p.color;
            ctx.beginPath();
            ctx.arc(p.x * U, p.y * U, p.r * U, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function dibujarFlotantes(ctx, U) {
        if (!E.flotantes.length) return;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var fs = Math.max(15, U * 0.030);
        ctx.font = '600 ' + fs + 'px Cinzel, Georgia, serif';
        for (var i = 0; i < E.flotantes.length; i++) {
            var f = E.flotantes[i];
            ctx.globalAlpha = Math.max(0, f.vida / f.max);
            ctx.fillStyle = 'rgba(10,4,6,.6)';
            ctx.fillText(f.texto, f.x * U + 1.5, f.y * U + 1.5);
            ctx.fillStyle = '#c98bd0';
            ctx.fillText(f.texto, f.x * U, f.y * U);
        }
        ctx.restore();
    }

    function dibujarMensaje(ctx, U) {
        if (!E.mensaje) return;
        var resto = E.mensaje.hasta - E.t;
        var a = clamp(resto < 0.5 ? resto / 0.5 : 1, 0, 1);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var fs = Math.max(20, U * 0.058);
        ctx.font = '700 ' + fs + 'px Cinzel, Georgia, serif';
        ctx.fillStyle = 'rgba(10,4,6,.55)';
        ctx.fillText(E.mensaje.texto, E.W / 2, E.VH * U * 0.46 + 3);
        ctx.fillStyle = '#fff2c3';
        ctx.shadowColor = 'rgba(255,210,95,.7)';
        ctx.shadowBlur = 24;
        ctx.fillText(E.mensaje.texto, E.W / 2, E.VH * U * 0.46);
        ctx.restore();
    }

    function dibujar(dt) {
        var ctx = E.ctx, U = E.U;
        ctx.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
        // OJO: sin clearRect el velo se acumula y tapa el fondo de fotos
        ctx.clearRect(0, 0, E.W, E.H);

        if (window.FondoDW && window.FondoDW.dibujar) {
            var pts = [];
            E.campos.forEach(function (c) {
                if (c.out || !c.ball) return;
                pts.push({ x: c.padX / E.VW, y: 1 - c.padY / E.VH, fuerza: 0.9 });
                pts.push({ x: c.ball.x / E.VW, y: 1 - c.ball.y / E.VH, fuerza: 0.5 });
            });
            window.FondoDW.dibujar(pts);
        }

        dibujarFondo(ctx, E.t);


        E.campos.forEach(function (campo) {
            // cancha
            ctx.save();
            ctx.strokeStyle = campo.brillo + '.10)';
            ctx.lineWidth = 1;
            ctx.strokeRect(campo.x0 * U, U * 0.02, (campo.x1 - campo.x0) * U, (E.VH - 0.04) * U);
            ctx.restore();

            campo.bricks.forEach(function (b) { if (b.alive) dibujarBloque(ctx, b, U); });

            if (campo.out) {
                ctx.save();
                ctx.fillStyle = 'rgba(164,19,47,.14)';
                ctx.fillRect(campo.x0 * U, 0, (campo.x1 - campo.x0) * U, E.H);
                ctx.fillStyle = 'rgba(255,210,95,.55)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = '700 ' + Math.max(18, U * 0.05) + 'px Cinzel, Georgia, serif';
                ctx.fillText('✕', ((campo.x0 + campo.x1) / 2) * U, (E.VH / 2) * U);
                ctx.restore();
                return;
            }

            dibujarPaleta(ctx, campo, U);
            dibujarBola(ctx, campo, U);
        });

        dibujarParticulas(ctx, U);
        dibujarFlotantes(ctx, U);
        dibujarMensaje(ctx, U);

        // parpadeo de bloques golpeados
        E.campos.forEach(function (campo) {
            campo.bricks.forEach(function (b) { if (b.hit > 0) b.hit -= dt * 3.2; });
        });
    }

    // ---------------------------------------------------------------- loop
    function loop(ts) {
        if (!E.ultimo) E.ultimo = ts;
        var dt = (ts - E.ultimo) / 1000;
        E.ultimo = ts;
        dt = clamp(dt, 0, 0.05);
        actualizar(dt);
        dibujar(dt);
        requestAnimationFrame(loop);
    }

    // ---------------------------------------------------------------- API pública
    function valores() {
        return {
            velocidad: E.cfg.velocidad,
            paleta: E.cfg.paleta,
            filas: E.cfg.filas,
            vidas: E.cfg.vidas,
            modo: E.cfg.modo
        };
    }

    function aplicar(clave, valor) {
        if (!(clave in E.cfg)) return;
        if (clave === 'modo') valor = Number(valor) === 2 ? 2 : 1;
        if (clave === 'filas') valor = clamp(Number(valor) | 0, 3, 9);
        if (clave === 'vidas') valor = clamp(Number(valor) | 0, 1, 5);
        if (clave === 'velocidad') valor = clamp(Number(valor), 0.4, 2.2);
        if (clave === 'paleta') valor = clamp(Number(valor), 0.5, 2);
        if (!isFinite(valor)) return;

        var cambiaEstructura = (clave === 'filas' || clave === 'modo' || clave === 'vidas' || clave === 'paleta');
        E.cfg[clave] = valor;

        // reflejar el modo en los botones de la pantalla de inicio
        document.querySelectorAll('.modo').forEach(function (b) {
            b.classList.toggle('activo', Number(b.getAttribute('data-modo')) === E.cfg.modo);
        });

        if (clave === 'paleta') {
            E.campos.forEach(function (c) { c.padW = 0.192 * E.cfg.paleta; });
        }
        if (E.estado === 'jugando' || E.estado === 'pausa') {
            if (cambiaEstructura) empezar();
            else if (clave === 'velocidad') {
                E.campos.forEach(function (c) {
                    var b = c.ball;
                    if (!b || b.pegada) return;
                    var sp = Math.hypot(b.vx, b.vy) || 1;
                    var f = velocidadBase() / sp;
                    b.vx *= f; b.vy *= f;
                });
            }
        }
    }

    // ---------------------------------------------------------------- arranque
    function iniciar() {
        E.canvas = document.getElementById('escena');
        E.ctx = E.canvas.getContext('2d');
        E.logoImg = new Image();
        E.logoImg.src = 'img/logo.svg';
        E.racimoImg = new Image();
        E.racimoImg.src = 'img/racimo.png';
        E.ladrillos = [];
        for (var li = 1; li <= 6; li++) {
            var lim = new Image();
            lim.src = 'img/ladrillos/lad' + li + '.jpg';
            E.ladrillos.push(lim);
        }
        E.copaImg = new Image();
        E.copaImg.src = 'img/copa.png';
        E.uvaImg = new Image();              // la bola es una uva
        E.uvaImg.src = 'img/uva.png';
        E.botellaImg = new Image();
        E.botellaImg.src = 'img/botella.png';
        if (window.Impactos) window.Impactos.crear({ contenedor: '#app', panel: false });
        if (window.FondoDW) {
            window.FondoDW.crear({
                contenedor: '#app',
                intervalo: 16000,
                intensidad: 0.022,
                velocidad: 0.055,
                tinte: 0.26,
                oscurecer: 0.22
            });
        }
        cachearDom();
        try {
            var r = Number(localStorage.getItem('dw:buster:record'));
            E.record = isFinite(r) ? r : 0;
        } catch (e) { E.record = 0; }
        redimensionar();
        conectarEntrada();
        window.addEventListener('resize', redimensionar);
        window.addEventListener('orientationchange', function () {
            setTimeout(redimensionar, 220);
        });
        pantalla(el.inicio);
        el.hud.classList.add('hud-off');
        requestAnimationFrame(loop);
        // kiosco / capturas: ?auto=1 arranca la partida solo
        if (/[?&]auto=1/.test(window.location.search)) { document.body.classList.add('sin-transicion'); setTimeout(empezar, 120); }
    }

    window.Buster = {
        version: '1.0.0',
        valores: valores,
        aplicar: aplicar,
        empezar: empezar,
        pausar: pausar,
        seguir: seguir,
        estado: function () {
            return {
                estado: E.estado, puntos: E.puntos, nivel: E.nivel, cosecha: E.cosecha,
                uvas: E.uvas, copas: Math.floor(E.uvas / UVAS_POR_COPA),
                campos: E.campos.map(function (c) {
                    return { vidas: c.vidas, out: c.out, puntos: c.puntos, bloques: bloquesVivos(c) };
                })
            };
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
