/* ============================================================
   FONDO DELI & WINE · fotos del viñedo con displace  (v1.0)
   ------------------------------------------------------------
   El fondo estándar de TODOS los juegos de Deli & Wine:

     · Las fotos de la bodega (fondo1..3.jpg) rotan solas cada N
       segundos con crossfade.
     · Un shader de displace las deforma con ruido fbm en
       movimiento + ondas que responden a los puntos/jugadores.
     · Cover correcto en cualquier aspecto (no se estira nunca).
     · Tinte borgoña, viñeta y grano suave para que el texto se
       lea arriba.
     · Si no hay WebGL, cae a un crossfade 2D de las mismas fotos:
       el fondo nunca queda en negro.

   Uso (el juego llama una sola vez, en su iniciar()):

     FondoDW.crear({
       contenedor: '#app',                 // dónde se inserta (primer hijo)
       fotos: ['../comun/img/fondo1.jpg', '../comun/img/fondo2.jpg', '../comun/img/fondo3.jpg'],
       intervalo: 16000,                   // ms entre fotos
       intensidad: 0.022,                  // fuerza del displace
       velocidad: 0.055,
       tinte: 0.26,
       oscurecer: 0.34                     // velo para legibilidad
     });

     FondoDW.dibujar([{x: 0.4, y: 0.7, fuerza: 1}])   // opcional, cada frame
     FondoDW.activo()  → true si hay shader/canvas corriendo
     FondoDW.apagar() / FondoDW.intervalo(ms)
   ============================================================ */
(function (root) {
    'use strict';

    var DEFAULTS = {
        contenedor: '#app',
        fotos: ['../comun/img/fondo1.jpg', '../comun/img/fondo2.jpg', '../comun/img/fondo3.jpg'],
        intervalo: 16000,
        intensidad: 0.022,
        velocidad: 0.055,
        tinte: 0.26,
        oscurecer: 0.34,
        crossfade: 2.6,
        // Escala y desplazamiento del recorte (las fotos siempre con cover):
        //   1 = cubre la pantalla justo; >1 acerca, <1 aleja
        escala: 1,
        offsetX: 0,   // en fracciones del ancho de la pantalla (-0.5 .. 0.5)
        offsetY: 0    // en fracciones del alto (-0.5 .. 0.5), positivo = sube la foto
    };

    var F = {
        ok: false,
        modo: 'off',            // 'gl' | '2d' | 'off'
        canvas: null,
        gl: null, prog: null,
        tex: [], img: [], ar: [],
        idx: 0, mezcla: 0, tCambio: 0,
        t0: 0, ultimo: 0,
        css: { w: 1, h: 1 },
        punteros: [],
        cfg: Object.assign({}, DEFAULTS),
        uni: {},
        buf: null
    };

    var VERT = [
        'attribute vec2 p;',
        'void main(){ gl_Position = vec4(p, 0.0, 1.0); }'
    ].join('\n');

    var FRAG = [
        'precision highp float;',
        'uniform vec2 u_res;',
        'uniform sampler2D u_imgA;',
        'uniform sampler2D u_imgB;',
        'uniform float u_mezcla;',
        'uniform float u_t;',
        'uniform float u_intensidad;',
        'uniform float u_velocidad;',
        'uniform float u_tinte;',
        'uniform float u_oscurecer;',
        'uniform float u_arA;',
        'uniform float u_arB;',
        'uniform float u_esc;',             // escala del recorte (1 = cover justo)
        'uniform vec2  u_off;',             // desplazamiento en fraccion de pantalla
        'uniform vec3 u_pt[4];',            // x, y, fuerza (uv 0..1, y abajo)
        'uniform int u_npt;',
        '',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        '',
        'float ruido(vec2 p){',
        '  vec2 i = floor(p); vec2 f = fract(p);',
        '  vec2 u = f * f * (3.0 - 2.0 * f);',
        '  float a = hash(i);',
        '  float b = hash(i + vec2(1.0, 0.0));',
        '  float c = hash(i + vec2(0.0, 1.0));',
        '  float d = hash(i + vec2(1.0, 1.0));',
        '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
        '}',
        '',
        'float fbm(vec2 p){',
        '  float v = 0.0, a = 0.5;',
        '  for (int i = 0; i < 4; i++){',
        '    v += a * ruido(p);',
        '    p = p * 2.02 + vec2(3.1, 1.7);',
        '    a *= 0.5;',
        '  }',
        '  return v;',
        '}',
        '',
        '// cover: recorta la foto sin estirarla nunca',
        'vec2 cover(vec2 uv, float ar){',
        '  float sr = u_res.x / u_res.y;',
        '  vec2 p = uv - 0.5;',
        '  if (sr > ar) p.y *= ar / sr;',
        '  else p.x *= sr / ar;',
        '  // encuadre: aleja/acerca y corre el recorte (siempre sin estirar)',
        '  p = p / max(u_esc, 0.001) - u_off;',
        '  return p + 0.5;',
        '}',
        '',
        'void main(){',
        '  vec2 uv = gl_FragCoord.xy / u_res;',
        '  vec2 disp = vec2(0.0);',
        '',
        '  // ruido en movimiento (el displace del viñedo)',
        '  float n1 = fbm(uv * 3.0 + vec2(u_t * u_velocidad, u_t * u_velocidad * 0.6));',
        '  float n2 = fbm(uv * 3.6 + vec2(7.3, 2.1) - u_t * u_velocidad * 0.8);',
        '  disp += vec2(n1, n2) - 0.5;',
        '',
        '  // ondas: responden a los jugadores (o a un foco que respira solo)',
        '  for (int i = 0; i < 4; i++){',
        '    if (i >= u_npt) break;',
        '    vec3 pt = u_pt[i];',
        '    vec2 d = (uv - pt.xy) * vec2(u_res.x / u_res.y, 1.0);',
        '    float r = length(d);',
        '    float onda = sin(r * 26.0 - u_t * 2.4) * exp(-r * 6.5);',
        '    disp += normalize(d + 0.0001) * onda * 0.010 * pt.z;',
        '  }',
        '',
        '  vec2 uvA = cover(uv + disp * u_intensidad, u_arA);',
        '  vec2 uvB = cover(uv + disp * u_intensidad * 1.15, u_arB);',
        '  vec3 a = texture2D(u_imgA, clamp(uvA, 0.002, 0.998)).rgb;',
        '  vec3 b = texture2D(u_imgB, clamp(uvB, 0.002, 0.998)).rgb;',
        '  vec3 col = mix(a, b, u_mezcla);',
        '',
        '  // tinte borgoña + viñeta + grano',
        '  col = mix(col, col * vec3(1.06, 0.66, 0.74), u_tinte);',
        '  float vig = smoothstep(1.25, 0.32, length((uv - 0.5) * vec2(1.15, 1.0)));',
        '  col *= mix(0.52, 1.0, vig);',
        '  col *= (1.0 - u_oscurecer);',
        '  col += (hash(uv * u_res + u_t) - 0.5) * 0.014;',
        '',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
    ].join('\n');

    // ---------------------------------------------------------------- helpers
    function compilar(gl, tipo, fuente) {
        var s = gl.createShader(tipo);
        gl.shaderSource(s, fuente);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.warn('[FondoDW] shader:', gl.getShaderInfoLog(s));
            return null;
        }
        return s;
    }

    function textura(gl) {
        var t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
            new Uint8Array([20, 6, 10, 255]));
        return t;
    }

    function subir(gl, tex, img) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    }

    // ---------------------------------------------------------------- 2D fallback
    function crear2d() {
        var c = document.createElement('canvas');
        var ctx = c.getContext('2d');
        if (!ctx) return false;
        F.canvas = c;
        F.ctx2d = ctx;
        F.modo = '2d';
        F.ok = true;
        return true;
    }

    function dibujar2d() {
        var ctx = F.ctx2d;
        var w = F.canvas.width, h = F.canvas.height;
        var t = (performance.now() - F.t0) / 1000;
        ctx.fillStyle = '#140407';
        ctx.fillRect(0, 0, w, h);
        if (!F.img.length) return;

        var a = F.img[F.idxA % F.img.length];
        var b = F.img[F.idxB % F.img.length];
        if (a) drawCover(ctx, a, w, h, 1, t);
        if (b) drawCover(ctx, b, w, h, F.mezcla, t);
        // tinte cálido suave (nada de multiply: apagaba la foto entera)
        ctx.fillStyle = 'rgba(96,18,38,' + (F.cfg.tinte * 0.28).toFixed(3) + ')';
        ctx.fillRect(0, 0, w, h);
        // viñeta
        var vg = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.25, w / 2, h * 0.45, Math.max(w, h) * 0.75);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(8,3,5,' + (0.55 + F.cfg.oscurecer * 0.6).toFixed(2) + ')');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
    }

    function drawCover(ctx, img, w, h, alfa) {
        var iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
        // mismo encuadre que el shader: escala + offset (0 = centrado)
        var esc = Math.max(w / iw, h / ih) * (F.cfg.escala || 1);
        var dw = iw * esc, dh = ih * esc;
        var ox = (F.cfg.offsetX || 0) * w;
        var oy = (F.cfg.offsetY || 0) * h;   // positivo = sube la foto
        ctx.save();
        ctx.globalAlpha = alfa;
        ctx.drawImage(img, (w - dw) / 2 + ox, (h - dh) / 2 - oy, dw, dh);
        ctx.restore();
    }

    // ---------------------------------------------------------------- API
    function crear(opts) {
        if (F.ok) return true;
        F.cfg = Object.assign({}, DEFAULTS, opts || {});
        F.t0 = performance.now();
        F.tCambio = F.t0;
        F.ultimo = F.t0;
        F.idxA = 0; F.idxB = 1; F.mezcla = 0;

        var cont = typeof F.cfg.contenedor === 'string'
            ? document.querySelector(F.cfg.contenedor)
            : F.cfg.contenedor;
        if (!cont) cont = document.body;

        var c = document.createElement('canvas');
        c.id = 'fondoDW';
        c.setAttribute('aria-hidden', 'true');
        c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;pointer-events:none;';
        cont.insertBefore(c, cont.firstChild);
        F.canvas = c;

        var gl = null;
        try {
            gl = c.getContext('webgl', {
                alpha: false, antialias: false, depth: false, stencil: false,
                premultipliedAlpha: false, preserveDrawingBuffer: false,
                powerPreference: 'low-power'
            });
        } catch (e) { gl = null; }

        // ?fondo=2d fuerza el crossfade 2D (capturas headless / GPU floja)
        if (/[?&]fondo=2d/.test(root.location.search)) gl = null;

        if (!gl) {
            console.warn('[FondoDW] sin WebGL: crossfade 2D');
            crear2d();
            cargarFotos();
            loop();
            return true;
        }

        var vs = compilar(gl, gl.VERTEX_SHADER, VERT);
        var fs = compilar(gl, gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) {
            crear2d();
            cargarFotos();
            loop();
            return true;
        }
        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.warn('[FondoDW] link:', gl.getProgramInfoLog(prog));
            crear2d();
            cargarFotos();
            loop();
            return true;
        }
        gl.useProgram(prog);

        F.gl = gl;
        F.prog = prog;
        F.modo = 'gl';
        F.ok = true;

        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        var nombres = ['u_res', 'u_imgA', 'u_imgB', 'u_mezcla', 'u_t', 'u_intensidad',
            'u_velocidad', 'u_tinte', 'u_oscurecer', 'u_arA', 'u_arB', 'u_pt', 'u_npt',
            'u_esc', 'u_off'];
        nombres.forEach(function (n) { F.uni[n] = gl.getUniformLocation(prog, n); });

        F.tex[0] = textura(gl);
        F.tex[1] = textura(gl);

        cargarFotos();
        loop();
        return true;
    }

    function cargarFotos() {
        F.img = [];
        F.ar = [];
        F.cfg.fotos.forEach(function (url, i) {
            var im = new Image();
            im.crossOrigin = 'anonymous';
            im.onload = function () {
                F.img[i] = im;
                F.ar[i] = im.naturalWidth / Math.max(1, im.naturalHeight);
                // sólo las dos primeras van a los slots fijos; las demás entran
                // en el slot B cuando les toca rotar (si no, la 3ª pisa la A)
                if (F.modo === 'gl' && F.gl && i < 2) {
                    subir(F.gl, F.tex[i], im);
                }
            };
            im.onerror = function () { console.warn('[FondoDW] no se pudo cargar', url); };
            im.src = url;
        });
    }

    function redimensionar() {
        if (!F.canvas) return;
        var w = root.innerWidth, h = root.innerHeight;
        var dpr = Math.min(1.25, root.devicePixelRatio || 1);
        var pw = Math.max(320, Math.round(w * dpr));
        var ph = Math.max(240, Math.round(h * dpr));
        F.css = { w: w, h: h };
        if (F.canvas.width === pw && F.canvas.height === ph) return;
        F.canvas.width = pw;
        F.canvas.height = ph;
        F.canvas.style.width = w + 'px';
        F.canvas.style.height = h + 'px';
        if (F.gl) F.gl.viewport(0, 0, pw, ph);
    }

    function dibujar(punteros) {
        if (!F.ok) return;
        F.punteros = Array.isArray(punteros) ? punteros.slice(0, 4) : [];
    }

    function loop() {
        if (!F.ok) return;
        requestAnimationFrame(loop);

        var ahora = performance.now();
        var t = (ahora - F.t0) / 1000;
        var intervalo = F.cfg.intervalo;
        var dur = F.cfg.crossfade * 1000;
        var desde = ahora - F.tCambio;

        if (desde > intervalo) {
            F.tCambio = ahora;
            F.idxA = F.idxB;
            F.idxB = (F.idxB + 1) % Math.max(1, F.cfg.fotos.length);
            F.mezcla = 0;
            if (F.modo === 'gl' && F.gl) {
                // BUG que hacía "reiniciar" el fondo: el slot A se quedaba con la
                // textura VIEJA, así que al terminar el fundido volvía a la foto 1.
                // Ahora el slot A recibe la foto que acaba de entrar y el B la siguiente.
                if (F.img[F.idxA]) subir(F.gl, F.tex[0], F.img[F.idxA]);
                if (F.img[F.idxB]) subir(F.gl, F.tex[1], F.img[F.idxB]);
            }
        }
        if (desde > intervalo - dur && desde <= intervalo) {
            F.mezcla = Math.min(1, (desde - (intervalo - dur)) / dur);
        } else if (desde > intervalo) {
            F.mezcla = 0;
        }

        redimensionar();

        if (F.modo === '2d') { dibujar2d(); return; }

        var gl = F.gl, u = F.uni, c = F.canvas;
        gl.viewport(0, 0, c.width, c.height);
        gl.useProgram(F.prog);
        gl.uniform2f(u.u_res, c.width, c.height);
        gl.uniform1f(u.u_mezcla, F.mezcla);
        gl.uniform1f(u.u_t, t);
        gl.uniform1f(u.u_intensidad, F.cfg.intensidad);
        gl.uniform1f(u.u_velocidad, F.cfg.velocidad);
        gl.uniform1f(u.u_tinte, F.cfg.tinte);
        gl.uniform1f(u.u_oscurecer, F.cfg.oscurecer);
        gl.uniform1f(u.u_arA, F.ar[F.idxA] || 1.78);
        gl.uniform1f(u.u_arB, F.ar[F.idxB] || 1.78);
        gl.uniform1f(u.u_esc, typeof F.cfg.escala === 'number' ? F.cfg.escala : 1);
        gl.uniform2f(u.u_off, F.cfg.offsetX || 0, F.cfg.offsetY || 0);

        var pts = new Float32Array(12);
        var n = 0;
        for (var i = 0; i < F.punteros.length && i < 4; i++) {
            var p = F.punteros[i] || {};
            pts[i * 3] = typeof p.x === 'number' ? p.x : 0.5;
            pts[i * 3 + 1] = typeof p.y === 'number' ? p.y : 0.5;
            pts[i * 3 + 2] = typeof p.fuerza === 'number' ? p.fuerza : 1;
            n++;
        }
        gl.uniform3fv(u.u_pt, pts);
        gl.uniform1i(u.u_npt, n);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, F.tex[0]);
        gl.uniform1i(u.u_imgA, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, F.tex[1]);
        gl.uniform1i(u.u_imgB, 1);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    root.FondoDW = {
        crear: crear,
        dibujar: dibujar,
        activo: function () { return F.ok; },
        modo: function () { return F.modo; },
        intervalo: function (ms) {
            if (typeof ms === 'number') F.cfg.intervalo = Math.max(3000, ms);
            return F.cfg.intervalo;
        },
        params: function (cambios) {
            if (cambios) Object.assign(F.cfg, cambios);
            return Object.assign({}, F.cfg);
        },
        // forma corta para el inspector del grid: escala + offset del recorte
        encuadre: function (cfg) {
            if (cfg) {
                if (typeof cfg.escala === 'number') F.cfg.escala = Math.max(0.5, Math.min(3, cfg.escala));
                if (typeof cfg.offsetX === 'number') F.cfg.offsetX = Math.max(-0.5, Math.min(0.5, cfg.offsetX));
                if (typeof cfg.offsetY === 'number') F.cfg.offsetY = Math.max(-0.5, Math.min(0.5, cfg.offsetY));
            }
            return { escala: F.cfg.escala, offsetX: F.cfg.offsetX, offsetY: F.cfg.offsetY };
        },
        apagar: function () {
            F.ok = false;
            if (F.canvas && F.canvas.parentNode) F.canvas.parentNode.removeChild(F.canvas);
        },
        _estado: function () {
            return { modo: F.modo, ok: F.ok, fotos: F.img.length, idxA: F.idxA, idxB: F.idxB, mezcla: F.mezcla };
        }
    };
})(window);
