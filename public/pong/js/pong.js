/* ============================================================
   PONG VENDIMIA · Deli & Wine  (v1.0)
   ------------------------------------------------------------
   Ping pong de bodega. Cada jugador es una botella; el corcho
   viaja de lado a lado y el rally no se puede cortar.

   Modos:
     · COOPERATIVO → los dos sostienen el rally, 3 vidas en común.
     · DUELO       → el que deja pasar el corcho le da un punto al
                     otro; gana el primero en llegar al objetivo.

   Todo se mide en "unidades U" = min(ancho, alto) en píxeles:
   la velocidad horizontal se define por TIEMPO DE CRUCE, así el
   juego se siente igual en 16:9, en un piso LIDAR ancho o en un
   celular vertical.

   Entrada: pointer events (mouse, touch y los blobs del LIDAR que
   `lidar-pointer.js` convierte en punteros reales).
   ============================================================ */
(function () {
    'use strict';

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
        var ctx = null, on = true;
        function ac() {
            if (!ctx) {
                try {
                    var AC = window.AudioContext || window.webkitAudioContext;
                    if (AC) ctx = new AC();
                } catch (e) { ctx = null; }
            }
            if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
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
                g.gain.linearRampToValueAtTime(vol || 0.06, t + 0.008);
                g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
                o.connect(g); g.connect(c.destination);
                o.start(t); o.stop(t + dur + 0.02);
            } catch (e) { }
        }
        return {
            desbloquear: ac,
            on: function (v) { on = !!v; },
            blip: function () { tono(720, 0.05, 'triangle', 0.04); },
            hit: function () { tono(392, 0.08, 'square', 0.045); },
            pop: function () { tono(980, 0.06, 'sine', 0.05); },
            mal: function () { tono(160, 0.26, 'sawtooth', 0.055); },
            fanfarria: function () {
                [523, 659, 784, 1046].forEach(function (f, i) {
                    setTimeout(function () { tono(f, 0.24, 'triangle', 0.055); }, i * 95);
                });
            }
        };
    })();

    // ---------------------------------------------------------------- configuración
    var CFG_DEF = { velocidad: 1, paleta: 1, vidas: 3, modo: 'coop', objetivo: 7 };

    var E = {
        canvas: null, ctx: null,
        W: 0, H: 0, U: 1, VW: 1, VH: 1, dpr: 1,
        estado: 'inicio',
        t: 0, ultimo: 0,
        cfg: Object.assign({}, CFG_DEF),
        punteros: new Map(),        // id -> {x, y, lado}
        particulas: [],
        particulasTinta: [],
        corcho: null,
        izq: null, der: null,
        puntos: 0, toques: 0, rally: 0, mejorRally: 0,
        p1: 0, p2: 0,
        vidas: 3,
        cruce: 2.6,
        mensaje: null,
        logoImg: null,
        record: 0,
        ultimoToque: 0
    };

    var $ = function (s) { return document.querySelector(s); };
    var el = {};

    function cachearDom() {
        el.hud = $('#hud');
        el.etqA = $('#hudEtqA'); el.valA = $('#hudValA');
        el.etqB = $('#hudEtqB'); el.valB = $('#hudValB');
        el.hudVidas = $('#hudVidas');
        el.hudVidasBloque = $('.hud-vidas');
        el.inicio = $('#pantallaInicio');
        el.pausa = $('#pantallaPausa');
        el.fin = $('#pantallaFin');
        el.btnJugar = $('#btnJugar');
        el.btnPausa = $('#btnPausa');
        el.btnReiniciar = $('#btnReiniciar');
        el.btnSeguir = $('#btnSeguir');
        el.btnSalir = $('#btnSalir');
        el.btnOtra = $('#btnOtra');
        el.finKicker = $('#finKicker');
        el.finPuntos = $('#finPuntos');
        el.finMedallaEtq = $('#finMedallaEtq');
        el.finCartel = $('#finCartel');
        el.finToques = $('#finToques');
        el.finRally = $('#finRally');
        el.finRecord = $('#finRecord');
        el.finEtqRecord = $('#finEtqRecord');
    }

    function pantalla(vis) {
        [el.inicio, el.pausa, el.fin].forEach(function (p) {
            if (p) p.classList.toggle('visible', p === vis);
        });
    }

    // ---------------------------------------------------------------- botella (sprite)
    // La botella del memotest (PNG de bodega) recortada a su contenido, con la
    // etiqueta de Deli & Wine compuesta encima. Se dibuja escalada como paleta.
    var BOT = { cx: 192, cy: 24, cw: 134, ch: 470, ratio: 134 / 470, sprite: null, listo: false };

    function crearSpriteBotella() {
        if (BOT.listo) return;
        if (!E.botellaImg || !E.botellaImg.naturalWidth) return;
        if (!E.logoImg || !E.logoImg.naturalWidth) return;

        var W = 260;
        var H = Math.round(W * (BOT.ch / BOT.cw));
        var S = 2;
        var cv = document.createElement('canvas');
        cv.width = Math.round(W * S);
        cv.height = Math.round(H * S);
        var g = cv.getContext('2d');
        g.scale(S, S);

        g.drawImage(E.botellaImg, BOT.cx, BOT.cy, BOT.cw, BOT.ch, 0, 0, W, H);

        // Etiqueta INTEGRADA: no se pinta ningún rectángulo. Se usa el papel
        // que ya trae la botella y se le imprime el logo + el nombre en borgoña
        // (tintado desde el logo blanco), centrado en el hueco blanco de la etiqueta.
        var lx = W * 0.03, lw = W * 0.88;         // zona de la etiqueta
        var ly = H * 0.700, lh = H * 0.150;       // hueco blanco entre las guardas
        var cxL = lx + lw / 2;

        // 1) velo de papel muy suave: unifica el tono sin tapar la textura
        g.save();
        var gp = g.createLinearGradient(0, ly, 0, ly + lh);
        gp.addColorStop(0, 'rgba(247,239,221,.30)');
        gp.addColorStop(0.5, 'rgba(255,250,240,.18)');
        gp.addColorStop(1, 'rgba(240,230,212,.30)');
        g.fillStyle = gp;
        g.fillRect(lx, ly, lw, lh);
        // sombra del papel (para que se apoye en el vidrio)
        var gs = g.createLinearGradient(0, ly, 0, ly + lh);
        gs.addColorStop(0, 'rgba(40,10,18,.22)');
        gs.addColorStop(0.12, 'rgba(40,10,18,0)');
        gs.addColorStop(0.88, 'rgba(40,10,18,0)');
        gs.addColorStop(1, 'rgba(40,10,18,.20)');
        g.fillStyle = gs;
        g.fillRect(lx, ly, lw, lh);
        g.restore();

        // 2) logo tintado borgoña (el PNG original es blanco)
        if (!BOT.logoVino && E.logoImg && E.logoImg.naturalWidth) {
            var lc = document.createElement('canvas');
            lc.width = E.logoImg.naturalWidth;
            lc.height = E.logoImg.naturalHeight;
            var lg = lc.getContext('2d');
            lg.drawImage(E.logoImg, 0, 0);
            lg.globalCompositeOperation = 'source-in';
            lg.fillStyle = '#3f0a18';
            lg.fillRect(0, 0, lc.width, lc.height);
            BOT.logoVino = lc;
        }
        if (BOT.logoVino) {
            var anchoLogo = lw * 0.58;
            var altoLogo = anchoLogo * (BOT.logoVino.height / BOT.logoVino.width);
            if (altoLogo > lh * 0.52) {
                altoLogo = lh * 0.52;
                anchoLogo = altoLogo * (BOT.logoVino.width / BOT.logoVino.height);
            }
            g.save();
            g.globalAlpha = 0.92;
            g.drawImage(BOT.logoVino, cxL - anchoLogo / 2, ly + lh * 0.20, anchoLogo, altoLogo);
            g.restore();
        }

        // 3) nombre en borgoña, con letra espaciada
        g.save();
        g.fillStyle = 'rgba(63,10,24,.92)';
        g.font = '600 ' + Math.round(lh * 0.20) + 'px Cinzel, Georgia, serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        try { g.letterSpacing = Math.max(1, lw * 0.02).toFixed(1) + 'px'; } catch (e) { }
        g.fillText('DELI & WINE', cxL, ly + lh * 0.80);
        g.restore();

        BOT.sprite = cv;
        BOT.listo = true;
    }

    // ---------------------------------------------------------------- tamaño
    function redimensionar() {
        var c = E.canvas;
        var w = window.innerWidth, h = window.innerHeight;
        E.dpr = Math.min(2, window.devicePixelRatio || 1);
        E.W = w; E.H = h;
        c.width = Math.round(w * E.dpr);
        c.height = Math.round(h * E.dpr);
        c.style.width = w + 'px';
        c.style.height = h + 'px';
        E.ctx.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);

        E.U = Math.min(w, h);
        E.VW = w / E.U;
        E.VH = h / E.U;

        if (E.izq) E.izq.x = 0.058;
        if (E.der) E.der.x = E.VW - 0.058;
        if (E.corcho) {
            E.corcho.x = clamp(E.corcho.x, 0.02, E.VW - 0.02);
            E.corcho.y = clamp(E.corcho.y, 0.06, E.VH - 0.06);
        }
    }

    // ---------------------------------------------------------------- partículas
    function estallido(x, y, color, n, vel) {
        for (var i = 0; i < n; i++) {
            var a = Math.random() * Math.PI * 2;
            var v = rnd(vel * 0.25, vel);
            E.particulas.push({
                x: x, y: y,
                vx: Math.cos(a) * v, vy: Math.sin(a) * v - vel * 0.15,
                vida: rnd(0.3, 0.8), max: 0.8,
                r: rnd(0.003, 0.009), color: color
            });
            if (E.particulas.length > 200) E.particulas.shift();
        }
    }

    function actualizarParticulas(dt) {
        for (var i = E.particulas.length - 1; i >= 0; i--) {
            var p = E.particulas[i];
            p.vida -= dt;
            if (p.vida <= 0) { E.particulas.splice(i, 1); continue; }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 1.2 * dt;
        }
    }

    // ---------------------------------------------------------------- paletas
    function nuevaPaleta(lado) {
        return {
            lado: lado,                       // -1 izquierda, +1 derecha
            x: lado < 0 ? 0.058 : E.VW - 0.058,
            y: E.VH / 2,
            mitad: 0.118 * E.cfg.paleta,
            ancho: 2 * (0.118 * E.cfg.paleta) * (134 / 470),
            auto: true
        };
    }

    function objetivoPaleta(paleta) {
        var mejor = null, mejorD = Infinity;
        E.punteros.forEach(function (p) {
            if (p.lado !== paleta.lado) return;
            var d = Math.abs(p.y / E.U - paleta.y);
            if (d < mejorD) { mejorD = d; mejor = p; }
        });
        return mejor;
    }

    // ---------------------------------------------------------------- partida
    function empezar() {
        Sonido.desbloquear();
        E.estado = 'jugando';
        E.puntos = 0; E.toques = 0; E.rally = 0; E.mejorRally = 0;
        E.p1 = 0; E.p2 = 0;
        E.vidas = E.cfg.vidas | 0;
        E.cruce = 2.6 / clamp(E.cfg.velocidad, 0.4, 2);
        E.particulas.length = 0;
        E.mensaje = null;
        E.punteros.clear();

        E.izq = nuevaPaleta(-1);
        E.der = nuevaPaleta(1);
        E.izq.y = E.VH / 2;
        E.der.y = E.VH / 2;
        E.corcho = nuevaBola(1);

        pantalla(null);
        el.hud.classList.remove('hud-off');
        aplicarModo();
        actualizarHud();
        E.mensaje = { texto: '¡A SOSTENER EL RALLY!', hasta: E.t + 2.0 };
    }

    function aplicarModo() {
        var duelo = E.cfg.modo === 'duelo';
        el.hudVidasBloque.style.display = duelo ? 'none' : '';
        el.etqA.textContent = duelo ? 'Jugador 1' : 'Puntos';
        el.etqB.textContent = duelo ? 'Jugador 2' : 'Rally';
        if (!duelo) pintarVidas();
    }

    function nuevaBola(dir) {
        return {
            x: E.VW / 2, y: E.VH / 2,
            r: 0.0215,
            vx: dir * (E.VW / E.cruce),
            vy: rnd(-0.18, 0.18) * (E.VW / E.cruce),
            giro: 0,
            estela: []
        };
    }

    function pausar() { if (E.estado === 'jugando') { E.estado = 'pausa'; pantalla(el.pausa); } }
    function seguir() { if (E.estado === 'pausa') { E.estado = 'jugando'; pantalla(null); Sonido.desbloquear(); } }
    function alInicio() {
        E.estado = 'inicio'; pantalla(el.inicio); el.hud.classList.add('hud-off');
    }

    function terminar(ganador) {
        E.estado = 'fin';
        var duelo = E.cfg.modo === 'duelo';

        if (duelo) {
            el.finMedallaEtq.textContent = 'MARCADOR';
            el.finPuntos.textContent = E.p1 + ' – ' + E.p2;
            el.finCartel.textContent = ganador === 1 ? '★ GANA EL JUGADOR 1 ★' : '★ GANA EL JUGADOR 2 ★';
            el.finKicker.textContent = '✦ Se terminó el duelo ✦';
            el.finEtqRecord.textContent = 'TOTAL';
            el.finRecord.textContent = E.p1 + E.p2;
        } else {
            var r = E.record;
            if (E.puntos > r) {
                r = Math.floor(E.puntos);
                E.record = r;
                try { localStorage.setItem('dw:pong:record', String(r)); } catch (e) { }
            }
            el.finMedallaEtq.textContent = 'PUNTOS';
            el.finPuntos.textContent = Math.floor(E.puntos);
            el.finCartel.textContent = 'TU MEJOR MARCA: ' + r;
            el.finKicker.textContent = '✦ Se cortó el rally ✦';
            el.finEtqRecord.textContent = 'RÉCORD';
            el.finRecord.textContent = r;
        }
        el.finToques.textContent = E.toques;
        el.finRally.textContent = E.mejorRally;

        pantalla(el.fin);
        el.hud.classList.add('hud-off');
        Sonido.mal();
    }

    function seEscapo(lado) {
        var duelo = E.cfg.modo === 'duelo';
        var x = lado < 0 ? 0.01 : E.VW - 0.01;
        estallido(x, E.corcho.y, ['#a4132f', '#ffd25f', '#fff2c3'], 26, 1.6);
        if (window.Impactos) {
            window.Impactos.golpe(Math.max(0.01, Math.min(0.99, x / E.VW)), E.corcho.y / E.VH,
                { color: 'vino', fuerza: 1.4 });
        }
        Sonido.mal();
        E.rally = 0;

        if (duelo) {
            if (lado < 0) E.p2++; else E.p1++;
            E.mensaje = { texto: lado < 0 ? '¡PUNTO PARA EL JUGADOR 2!' : '¡PUNTO PARA EL JUGADOR 1!', hasta: E.t + 1.6 };
            actualizarHud();
            if (E.p1 >= E.cfg.objetivo || E.p2 >= E.cfg.objetivo) {
                E.corcho = nuevaBola(1);          // que no vuelva a "escaparse" mientras cae el telón
                E.corcho.vx = 0; E.corcho.vy = 0;
                setTimeout(function () { terminar(E.p1 > E.p2 ? 1 : 2); }, 600);
                return;
            }
            E.corcho = nuevaBola(lado < 0 ? -1 : 1);
        } else {
            E.vidas--;
            pintarVidas();
            if (E.vidas <= 0) {
                E.mensaje = { texto: '¡SE CAYÓ EL CORCHO!', hasta: E.t + 1.5 };
                E.corcho = nuevaBola(1);
                E.corcho.vx = 0; E.corcho.vy = 0;
                setTimeout(function () { terminar(0); }, 600);
                return;
            }
            E.mensaje = { texto: E.vidas + (E.vidas === 1 ? ' vida' : ' vidas'), hasta: E.t + 1.5 };
            E.cruce = 2.6 / clamp(E.cfg.velocidad, 0.4, 2);
            E.corcho = nuevaBola(lado < 0 ? -1 : 1);
        }
        actualizarHud();
    }

    function golpe(paleta) {
        E.toques++;
        E.rally++;
        if (E.rally > E.mejorRally) E.mejorRally = E.rally;

        var b = E.corcho;
        E.cruce = Math.max(1.3, E.cruce * 0.962);
        var vel = E.VW / E.cruce;
        var off = clamp((b.y - paleta.y) / (paleta.mitad + b.r), -1, 1);
        b.vx = (paleta.lado > 0 ? -1 : 1) * vel;
        b.vy = off * vel * 0.92 + rnd(-0.03, 0.03) * vel;
        b.x = paleta.x + (paleta.lado > 0 ? -1 : 1) * (paleta.ancho / 2 + b.r + 0.002);

        E.puntos += 10;
        if (E.toques % 10 === 0) {
            E.puntos += 100;
            E.mensaje = { texto: '¡' + E.toques + ' TOQUES!  +100', hasta: E.t + 1.6 };
            Sonido.fanfarria();
        } else {
            Sonido.pop();
        }
        estallido(b.x, b.y, ['#ffd25f', '#fff2c3'], 9, 1.0);
        if (window.Impactos) {
            window.Impactos.golpe(b.x / E.VW, b.y / E.VH, { color: 'oro', fuerza: 1.0 });
        }
        actualizarHud();
    }

    function actualizarHud() {
        if (!el.valA) return;
        var duelo = E.cfg.modo === 'duelo';
        if (duelo) {
            el.valA.textContent = E.p1;
            el.valB.textContent = E.p2;
        } else {
            el.valA.textContent = Math.floor(E.puntos);
            el.valB.textContent = E.rally;
        }
    }

    var COPAS_SVG = '<svg class="vida" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M6.6 3h10.8l-1.3 6.1A4.9 4.9 0 0 1 12 13.3a4.9 4.9 0 0 1-4.1-4.2Z" fill="#8a1738" stroke="#ffd25f" stroke-width="1.3" stroke-linejoin="round"/>' +
        '<path d="M12 13.3V19" stroke="#ffd25f" stroke-width="1.2"/>' +
        '<path d="M8.4 20.6h7.2" stroke="#ffd25f" stroke-width="1.5" stroke-linecap="round"/></svg>';

    function pintarVidas() {
        if (!el.hudVidas) return;
        var total = Math.max(E.cfg.vidas | 0, 1);
        var html = '';
        for (var i = 0; i < total; i++) {
            html += COPAS_SVG.replace('class="vida"', 'class="vida' + (i < E.vidas ? '' : ' off') + '"');
        }
        el.hudVidas.innerHTML = html;
    }

    // ---------------------------------------------------------------- entrada
    function conectarEntrada() {
        function ladoDe(x) { return x < E.W / 2 ? -1 : 1; }

        function abajo(ev) {
            Sonido.desbloquear();
            if (E.estado !== 'jugando') return;
            E.punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, lado: ladoDe(ev.clientX) });
        }
        function mover(ev) {
            if (E.estado !== 'jugando') return;
            var p = E.punteros.get(ev.pointerId);
            if (!p) {
                if (ev.pointerType !== 'mouse') return;
                p = { x: ev.clientX, y: ev.clientY, lado: ladoDe(ev.clientX) };
                E.punteros.set(ev.pointerId, p);
            }
            p.x = ev.clientX;
            p.y = ev.clientY;
        }
        function arriba(ev) {
            if (ev.pointerType === 'mouse') return;
            E.punteros.delete(ev.pointerId);
        }

        E.canvas.addEventListener('pointerdown', abajo);
        window.addEventListener('pointermove', mover, { passive: true });
        window.addEventListener('pointerup', arriba);
        window.addEventListener('pointercancel', arriba);
        window.addEventListener('blur', function () { E.punteros.clear(); });

        window.addEventListener('keydown', function (ev) {
            if (ev.code === 'Space') {
                ev.preventDefault();
                if (E.estado === 'jugando') pausar();
                else if (E.estado === 'pausa') seguir();
                else if (E.estado === 'inicio' || E.estado === 'fin') empezar();
            } else if (ev.code === 'KeyR') {
                if (E.estado !== 'inicio') empezar();
            } else if (ev.code === 'Enter') {
                if (E.estado === 'inicio' || E.estado === 'fin') empezar();
            } else if (ev.code === 'Escape') {
                if (E.estado === 'jugando') pausar();
            }
        });

        el.btnJugar.addEventListener('click', empezar);
        el.btnOtra.addEventListener('click', empezar);
        el.btnReiniciar.addEventListener('click', function () { if (E.estado !== 'inicio') empezar(); });
        el.btnPausa.addEventListener('click', function () {
            if (E.estado === 'jugando') pausar(); else if (E.estado === 'pausa') seguir();
        });
        el.btnSeguir.addEventListener('click', seguir);
        el.btnSalir.addEventListener('click', alInicio);

        document.querySelectorAll('.modo').forEach(function (b) {
            b.addEventListener('click', function () {
                E.cfg.modo = b.getAttribute('data-modo') === 'duelo' ? 'duelo' : 'coop';
                document.querySelectorAll('.modo').forEach(function (o) { o.classList.toggle('activo', o === b); });
                aplicarModo();
                Sonido.desbloquear();
            });
        });
    }

    // ---------------------------------------------------------------- lógica
    function actualizar(dt) {
        E.t += dt;
        actualizarParticulas(dt);
        if (E.mensaje && E.t > E.mensaje.hasta) E.mensaje = null;
        if (E.estado !== 'jugando') return;

        var U = E.U;
        var b = E.corcho;
        var arribaY = 0.05, abajoY = E.VH - 0.05;

        // paletas: jugador si hay puntero de ese lado, si no automática
        [E.izq, E.der].forEach(function (p) {
            var ptr = objetivoPaleta(p);
            p.auto = !ptr;
            var destino;
            if (ptr) {
                destino = clamp(ptr.y / U, arribaY + p.mitad, abajoY - p.mitad);
                p.y += (destino - p.y) * Math.min(1, dt * 18);
            } else {
                var velAuto = 0.62 * clamp(E.cfg.velocidad, 0.4, 2);
                var dy = b.y - p.y;
                p.y += Math.sign(dy) * Math.min(velAuto * dt, Math.abs(dy));
                p.y = clamp(p.y + Math.sin(E.t * 2.1 + (p.lado > 0 ? 1.7 : 0)) * 0.0009, arribaY + p.mitad, abajoY - p.mitad);
            }
        });

        // corcho
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if (b.y - b.r < arribaY) { b.y = arribaY + b.r; b.vy = Math.abs(b.vy); Sonido.blip(); }
        if (b.y + b.r > abajoY) { b.y = abajoY - b.r; b.vy = -Math.abs(b.vy); Sonido.blip(); }

        // rebote en las botellas
        [E.izq, E.der].forEach(function (p) {
            var frente = p.x + (p.lado > 0 ? -1 : 1) * (p.ancho / 2);
            var dentroY = Math.abs(b.y - p.y) <= p.mitad + b.r;
            if (!dentroY) return;
            if (p.lado < 0 && b.vx < 0 && b.x - b.r <= frente && b.x > frente - 0.09) golpe(p);
            if (p.lado > 0 && b.vx > 0 && b.x + b.r >= frente && b.x < frente + 0.09) golpe(p);
        });

        // estela
        b.estela.push({ x: b.x, y: b.y });
        if (b.estela.length > 10) b.estela.shift();

        // afuera
        if (b.x < -0.02) { seEscapo(-1); return; }
        if (b.x > E.VW + 0.02) { seEscapo(1); return; }

        actualizarHud();
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

            var fl = 0.5 + 0.5 * Math.sin(t * 0.32);
            var r1 = ctx.createRadialGradient(W * 0.5, H * -0.12, 0, W * 0.5, H * -0.12, H * 1.0);
            r1.addColorStop(0, 'rgba(164,19,47,' + (0.32 + fl * 0.06).toFixed(3) + ')');
            r1.addColorStop(1, 'rgba(164,19,47,0)');
            ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H);

            var r2 = ctx.createRadialGradient(W * 0.08, H * 1.06, 0, W * 0.08, H * 1.06, H * 0.85);
            r2.addColorStop(0, 'rgba(255,210,95,' + (0.085 + fl * 0.03).toFixed(3) + ')');
            r2.addColorStop(1, 'rgba(255,210,95,0)');
            ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H);

            var r3 = ctx.createRadialGradient(W * 0.94, H * 0.95, 0, W * 0.94, H * 0.95, H * 0.75);
            r3.addColorStop(0, 'rgba(90,19,41,' + (0.36 + fl * 0.04).toFixed(3) + ')');
            r3.addColorStop(1, 'rgba(90,19,41,0)');
            ctx.fillStyle = r3; ctx.fillRect(0, 0, W, H);
        } else {
            // sobre las fotos alcanza un velo parejo para que se lea la cancha
            ctx.fillStyle = 'rgba(10,4,6,.13)';
            ctx.fillRect(0, 0, W, H);
        }

        // marco
        ctx.save();
        ctx.strokeStyle = 'rgba(255,210,95,' + (fotos ? '.26)' : '.16)');
        ctx.lineWidth = Math.max(1, U * 0.0022);
        ctx.strokeRect(U * 0.012, U * 0.012, W - U * 0.024, H - U * 0.024);
        ctx.strokeStyle = 'rgba(255,242,195,.10)';
        ctx.lineWidth = 1;
        ctx.strokeRect(U * 0.021, U * 0.021, W - U * 0.042, H - U * 0.042);
        ctx.restore();

        // marca de agua
        if (E.logoImg && E.logoImg.width) {
            var lw = U * 0.40;
            var lh = lw * (E.logoImg.height / E.logoImg.width);
            ctx.save();
            ctx.globalAlpha = fotos ? 0.030 : 0.022;
            ctx.drawImage(E.logoImg, W / 2 - lw / 2, H / 2 - lh / 2, lw, lh);
            ctx.restore();
        }
    }

    function dibujarCancha(ctx) {
        var U = E.U;
        // línea central punteada
        ctx.save();
        ctx.strokeStyle = 'rgba(255,210,95,.32)';
        ctx.lineWidth = Math.max(1.5, U * 0.0026);
        ctx.setLineDash([U * 0.018, U * 0.02]);
        ctx.beginPath();
        ctx.moveTo((E.VW / 2) * U, 0.05 * U);
        ctx.lineTo((E.VW / 2) * U, (E.VH - 0.05) * U);
        ctx.stroke();
        ctx.restore();

        // círculo central
        ctx.save();
        ctx.strokeStyle = 'rgba(255,210,95,.22)';
        ctx.lineWidth = Math.max(1, U * 0.002);
        ctx.beginPath();
        ctx.arc((E.VW / 2) * U, (E.VH / 2) * U, Math.min(E.VW, E.VH) * 0.09 * U, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // marcas de la cancha
        ctx.save();
        ctx.strokeStyle = 'rgba(255,210,95,.10)';
        ctx.lineWidth = 1;
        ctx.strokeRect(U * 0.030, 0.05 * U, (E.VW - 0.06) * U, (E.VH - 0.10) * U);
        ctx.restore();
    }

    // botella de bodega como paleta (sprite con la etiqueta de Deli & Wine)
    function dibujarBotella(ctx, paleta) {
        var U = E.U;
        var alto = paleta.mitad * 2 * U;
        var ancho = alto * BOT.ratio;
        var cx = paleta.x * U;
        var cy = paleta.y * U;

        ctx.save();
        var halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, alto * 0.68);
        halo.addColorStop(0, 'rgba(255,210,95,.22)');
        halo.addColorStop(0.5, 'rgba(164,19,47,.14)');
        halo.addColorStop(1, 'rgba(255,210,95,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, alto * 0.68, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (BOT.listo) {
            ctx.drawImage(BOT.sprite, cx - ancho / 2, cy - alto / 2, ancho, alto);
        } else {
            ctx.save();
            ctx.fillStyle = 'rgba(90,19,41,.9)';
            ctx.strokeStyle = 'rgba(255,210,95,.7)';
            ctx.lineWidth = Math.max(1, U * 0.0018);
            rrect(ctx, cx - ancho / 2, cy - alto / 2, ancho, alto, ancho * 0.4);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }

    function dibujarCorcho(ctx) {
        var b = E.corcho;
        if (!b) return;
        var U = E.U;
        var bx = b.x * U, by = b.y * U, r = b.r * U;

        // estela
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < b.estela.length; i++) {
            var p = b.estela[i];
            var f = (i + 1) / b.estela.length;
            ctx.fillStyle = 'rgba(164,71,184,' + (f * 0.20).toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(p.x * U, p.y * U, r * (0.3 + f * 0.72), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // halo cálido
        ctx.save();
        var halo = ctx.createRadialGradient(bx, by, 0, bx, by, r * 4.4);
        halo.addColorStop(0, 'rgba(255,210,95,.34)');
        halo.addColorStop(0.42, 'rgba(164,71,184,.30)');
        halo.addColorStop(1, 'rgba(164,71,184,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(bx, by, r * 4.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // cabito verde
        ctx.save();
        ctx.strokeStyle = '#6f8a3f';
        ctx.lineWidth = Math.max(1.1, U * 0.003);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, by - r * 0.86);
        ctx.quadraticCurveTo(bx + r * 0.5, by - r * 1.5, bx + r * 1.05, by - r * 1.22);
        ctx.stroke();
        // hojita
        ctx.fillStyle = 'rgba(111,138,63,.9)';
        ctx.beginPath();
        ctx.ellipse(bx + r * 0.95, by - r * 1.28, r * 0.42, r * 0.22, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // la uva
        var g = ctx.createRadialGradient(bx - r * 0.32, by - r * 0.36, r * 0.06, bx, by, r * 1.08);
        g.addColorStop(0, '#f0c4fb');
        g.addColorStop(0.26, '#a44bb8');
        g.addColorStop(0.62, '#5d1c6d');
        g.addColorStop(1, '#26082f');
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(bx, by, r * 1.06, r, 0, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,210,95,.38)';
        ctx.lineWidth = Math.max(1, U * 0.0014);
        ctx.stroke();
        ctx.restore();

        // brillo especular
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(bx - r * 0.34, by - r * 0.38, r * 0.30, r * 0.19, -0.55, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.78)';
        ctx.fill();
        ctx.restore();
    }

    function dibujarParticulas(ctx) {
        if (!E.particulas.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (var i = 0; i < E.particulas.length; i++) {
            var p = E.particulas[i];
            ctx.globalAlpha = clamp(p.vida / p.max, 0, 1);
            ctx.fillStyle = Array.isArray(p.color) ? p.color[i % p.color.length] : p.color;
            ctx.beginPath();
            ctx.arc(p.x * E.U, p.y * E.U, p.r * E.U, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    function dibujarMensaje(ctx) {
        if (!E.mensaje) return;
        var resto = E.mensaje.hasta - E.t;
        if (resto < 0) return;
        var a = clamp(resto < 0.5 ? resto / 0.5 : 1, 0, 1);
        var U = E.U;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        var fs = Math.max(19, U * 0.052);
        ctx.font = '700 ' + fs + 'px Cinzel, Georgia, serif';
        ctx.fillStyle = 'rgba(10,4,6,.6)';
        ctx.fillText(E.mensaje.texto, E.W / 2, E.H * 0.40 + 3);
        ctx.fillStyle = '#fff2c3';
        ctx.shadowColor = 'rgba(255,210,95,.7)';
        ctx.shadowBlur = 22;
        ctx.fillText(E.mensaje.texto, E.W / 2, E.H * 0.40);
        ctx.restore();
    }

    function dibujar() {
        var ctx = E.ctx;
        ctx.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
        // OJO: el canvas NO se limpia solo. Sin esto el velo semitransparente se
        // acumula frame a frame y tapa el fondo de fotos (pantalla negra).
        ctx.clearRect(0, 0, E.W, E.H);
        dibujarFondo(ctx, E.t);

        if (E.estado === 'inicio' && !E.izq) return;   // sólo fondo en la pantalla de inicio

        if (window.FondoDW && window.FondoDW.dibujar) {
            var pts = [];
            if (E.izq) pts.push({ x: E.izq.x / E.VW, y: 1 - E.izq.y / E.VH, fuerza: 1 });
            if (E.der) pts.push({ x: E.der.x / E.VW, y: 1 - E.der.y / E.VH, fuerza: 1 });
            if (E.corcho) pts.push({ x: E.corcho.x / E.VW, y: 1 - E.corcho.y / E.VH, fuerza: 0.6 });
            window.FondoDW.dibujar(pts);
        }

        dibujarCancha(ctx);
        if (E.izq) dibujarBotella(ctx, E.izq);
        if (E.der) dibujarBotella(ctx, E.der);
        dibujarCorcho(ctx);
        dibujarParticulas(ctx);
        dibujarMensaje(ctx);
    }

    // ---------------------------------------------------------------- loop
    function loop(ts) {
        if (!E.ultimo) E.ultimo = ts;
        var dt = (ts - E.ultimo) / 1000;
        E.ultimo = ts;
        dt = clamp(dt, 0, 0.05);
        actualizar(dt);
        dibujar();
        requestAnimationFrame(loop);
    }

    // ---------------------------------------------------------------- API
    function valores() {
        return {
            velocidad: E.cfg.velocidad,
            paleta: E.cfg.paleta,
            vidas: E.cfg.vidas,
            modo: E.cfg.modo,
            objetivo: E.cfg.objetivo
        };
    }

    function aplicar(clave, valor) {
        if (!(clave in E.cfg)) return;
        if (clave === 'modo') valor = String(valor) === 'duelo' ? 'duelo' : 'coop';
        if (clave === 'vidas') valor = clamp(Number(valor) | 0, 1, 5);
        if (clave === 'objetivo') valor = clamp(Number(valor) | 0, 3, 15);
        if (clave === 'velocidad') valor = clamp(Number(valor), 0.4, 2.2);
        if (clave === 'paleta') valor = clamp(Number(valor), 0.5, 2);
        if (valor === undefined || (typeof valor === 'number' && !isFinite(valor))) return;

        var cambia = (clave === 'vidas' || clave === 'modo' || clave === 'objetivo');
        E.cfg[clave] = valor;

        document.querySelectorAll('.modo').forEach(function (b) {
            b.classList.toggle('activo', b.getAttribute('data-modo') === E.cfg.modo);
        });
        aplicarModo();

        if (clave === 'paleta') {
            [E.izq, E.der].forEach(function (p) { if (p) { p.mitad = 0.118 * E.cfg.paleta; p.ancho = 2 * p.mitad * (134 / 470); } });
        }
        if (clave === 'velocidad') {
            E.cruce = Math.max(1.3, 2.6 / clamp(E.cfg.velocidad, 0.4, 2));
        }
        if ((E.estado === 'jugando' || E.estado === 'pausa') && cambia) empezar();
    }

    function iniciar() {
        E.canvas = document.getElementById('escena');
        E.ctx = E.canvas.getContext('2d');
        E.logoImg = new Image();
        E.logoImg.onload = crearSpriteBotella;
        E.logoImg.src = 'img/logo.png';
        E.botellaImg = new Image();
        E.botellaImg.onload = crearSpriteBotella;
        E.botellaImg.src = 'img/botella.png';
        if (window.Impactos) window.Impactos.crear({ contenedor: '#app', panel: true });
        if (window.FondoDW) {
            window.FondoDW.crear({
                contenedor: '#app',
                intervalo: 16000,
                intensidad: 0.024,
                velocidad: 0.06,
                tinte: 0.26,
                oscurecer: 0.20
            });
        }
        cachearDom();
        try {
            var r = Number(localStorage.getItem('dw:pong:record'));
            E.record = isFinite(r) ? r : 0;
        } catch (e) { E.record = 0; }
        redimensionar();
        conectarEntrada();
        window.addEventListener('resize', redimensionar);
        window.addEventListener('orientationchange', function () { setTimeout(redimensionar, 220); });
        pantalla(el.inicio);
        el.hud.classList.add('hud-off');
        requestAnimationFrame(loop);
        // kiosco / capturas: ?auto=1 arranca la partida solo
        if (/[?&]auto=1/.test(window.location.search)) { document.body.classList.add('sin-transicion'); setTimeout(empezar, 120); }
    }

    window.PongDW = {
        version: '1.0.0',
        valores: valores,
        aplicar: aplicar,
        empezar: empezar,
        pausar: pausar,
        seguir: seguir,
        estado: function () {
            return {
                estado: E.estado, modo: E.cfg.modo, puntos: Math.floor(E.puntos),
                toques: E.toques, rally: E.rally, mejorRally: E.mejorRally,
                p1: E.p1, p2: E.p2, vidas: E.vidas,
                corcho: E.corcho ? { x: E.corcho.x, y: E.corcho.y, vx: E.corcho.vx, vy: E.corcho.vy } : null,
                paletas: {
                    izq: E.izq ? { y: E.izq.y, auto: E.izq.auto } : null,
                    der: E.der ? { y: E.der.y, auto: E.der.auto } : null
                }
            };
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
