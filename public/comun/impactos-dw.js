/* ============================================================
   IMPACTOS DELI & WINE · shader de golpes + panel de control  (v1.1)
   ------------------------------------------------------------
   El lenguaje visual del `celebration.frag` del Remastered (anillos de
   choque, destello central, rayos tipo pétalos) disparado por IMPACTOS:
   pelota contra paleta / botellas / ladrillos.

   REGULABLE EN VIVO (tecla I o el botón ✦):
     Brillo · Apertura · Rayos · Duración · Fuerza   (se guarda en localStorage)

   Uso:
     Impactos.crear({ contenedor: '#app', panel: true });
     Impactos.golpe(0.4, 0.7, { color: 'oro', fuerza: 1 });   // x,y 0..1, y desde ARRIBA
   ============================================================ */
(function (root) {
    'use strict';

    var MAX = 8;
    var CLAVE_LS = 'dw:impactos:v1';

    var PALETA = {
        oro: [1.00, 0.84, 0.22],
        vino: [1.00, 0.18, 0.28],
        uva: [0.72, 0.32, 0.82],
        crema: [1.00, 0.97, 0.82]
    };

    var DEF = { brillo: 0.55, apertura: 0.60, rayos: 0.55, duracion: 0.85, fuerza: 1.0 };

    var I = {
        ok: false,
        canvas: null,
        gl: null, prog: null, uni: {},
        css: { w: 1, h: 1 },
        golpes: [],
        corriendo: false,
        cfg: Object.assign({}, DEF),
        panel: null,
        t0: 0
    };

    var VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

    var FRAG = [
        'precision highp float;',
        'uniform vec2 u_res;',
        'uniform float u_t;',
        'uniform vec4 u_hit[' + MAX + '];',
        'uniform vec3 u_col[' + MAX + '];',
        'uniform int u_n;',
        'uniform float u_ap;',
        'uniform float u_ray;',
        'uniform float u_brillo;',
        'uniform float u_vida;',
        '',
        'void main(){',
        '  vec2 uv = gl_FragCoord.xy / u_res;',
        '  float aspect = u_res.x / max(u_res.y, 1.0);',
        '  vec3 acc = vec3(0.0);',
        '',
        '  for (int i = 0; i < ' + MAX + '; i++){',
        '    if (i >= u_n) break;',
        '    vec4 h = u_hit[i];',
        '    if (h.z < 0.0) continue;',
        '    vec2 p = (uv - h.xy) * vec2(aspect, 1.0);',
        '    float d = length(p);',
        '    float ang = atan(p.y, p.x);',
        '    float edad = h.z / max(u_vida, 0.05);',
        '    if (edad > 1.0) continue;',
        '    float vida = 1.0 - edad;',
        '    float f = h.w;',
        '',
        '    float r = edad * u_ap * f;',
        '    float anillo = exp(-pow((d - r) / (0.012 + edad * 0.03), 2.0)) * vida * vida;',
        '    float flash = exp(-d * 26.0) * exp(-edad * 7.0) * f;',
        '    float petalos = 10.0 + f * 4.0;',
        '    float rayos = pow(max(0.0, sin(ang * petalos + float(i) * 1.7)), 6.0)',
        '                  * exp(-d * 4.2) * exp(-edad * 5.0) * u_ray * f;',
        '    float r2 = edad * u_ap * 1.5 * f;',
        '    float onda2 = exp(-pow((d - r2) / 0.03, 2.0)) * vida * 0.30;',
        '',
        '    acc += u_col[i] * (anillo * 1.4 + flash * 1.1 + rayos + onda2);',
        '  }',
        '',
        '  acc *= u_brillo;',
        '  acc = acc / (1.0 + acc * 0.55);',
        '  float a = clamp(max(acc.r, max(acc.g, acc.b)), 0.0, 1.0);',
        '  gl_FragColor = vec4(acc, a);',
        '}'
    ].join('\n');

    function compilar(gl, tipo, fuente) {
        var s = gl.createShader(tipo);
        gl.shaderSource(s, fuente);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.warn('[Impactos] shader:', gl.getShaderInfoLog(s));
            return null;
        }
        return s;
    }

    function cargarCfg() {
        try {
            var g = JSON.parse(root.localStorage.getItem(CLAVE_LS) || '{}');
            Object.keys(DEF).forEach(function (k) {
                if (typeof g[k] === 'number' && isFinite(g[k])) I.cfg[k] = g[k];
            });
        } catch (e) { }
    }

    function guardarCfg() {
        try { root.localStorage.setItem(CLAVE_LS, JSON.stringify(I.cfg)); } catch (e) { }
    }

    function crear(opts) {
        if (I.ok) return true;
        var cfg = opts || {};
        cargarCfg();

        var cont = typeof cfg.contenedor === 'string'
            ? document.querySelector(cfg.contenedor) : cfg.contenedor;
        if (!cont) cont = document.body;

        var c = document.createElement('canvas');
        c.id = 'impactosDW';
        c.setAttribute('aria-hidden', 'true');
        c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;' +
            'z-index:3;pointer-events:none;';
        cont.appendChild(c);
        I.canvas = c;

        var gl = null;
        try {
            gl = c.getContext('webgl', {
                alpha: true, premultipliedAlpha: true, antialias: false,
                depth: false, stencil: false, preserveDrawingBuffer: false
            });
        } catch (e) { gl = null; }
        if (!gl) { console.warn('[Impactos] sin WebGL'); return false; }

        var vs = compilar(gl, gl.VERTEX_SHADER, VERT);
        var fs = compilar(gl, gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) return false;
        var prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.warn('[Impactos] link:', gl.getProgramInfoLog(prog));
            return false;
        }
        gl.useProgram(prog);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        I.gl = gl; I.prog = prog;
        var buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(prog, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

        ['u_res', 'u_t', 'u_hit', 'u_col', 'u_n', 'u_ap', 'u_ray', 'u_brillo', 'u_vida']
            .forEach(function (n) { I.uni[n] = gl.getUniformLocation(prog, n); });

        I.ok = true;
        I.t0 = performance.now();
        redimensionar();
        root.addEventListener('resize', redimensionar);
        if (cfg.panel !== false) armarPanel();
        return true;
    }

    function redimensionar() {
        if (!I.canvas) return;
        var w = root.innerWidth, h = root.innerHeight;
        var dpr = Math.min(1.25, root.devicePixelRatio || 1);
        var pw = Math.max(320, Math.round(w * dpr));
        var ph = Math.max(240, Math.round(h * dpr));
        if (I.canvas.width === pw && I.canvas.height === ph) return;
        I.canvas.width = pw;
        I.canvas.height = ph;
        I.css = { w: w, h: h };
        if (I.gl) I.gl.viewport(0, 0, pw, ph);
    }

    function golpe(x, y, opts) {
        if (!I.ok) return;
        var o = opts || {};
        var col = PALETA[o.color] || PALETA.oro;
        I.golpes.push({
            x: Math.max(0, Math.min(1, x)),
            y: 1 - Math.max(0, Math.min(1, y)),
            edad: 0,
            fuerza: (typeof o.fuerza === 'number' ? o.fuerza : 1) * I.cfg.fuerza,
            col: col
        });
        while (I.golpes.length > MAX) I.golpes.shift();
        if (!I.corriendo) {
            I.corriendo = true;
            I.ultimo = performance.now();
            requestAnimationFrame(loop);
        }
    }

    function loop(ts) {
        if (!I.ok) return;
        var dt = Math.min(0.05, (ts - (I.ultimo || ts)) / 1000);
        I.ultimo = ts;
        var gl = I.gl, c = I.canvas;

        for (var i = I.golpes.length - 1; i >= 0; i--) {
            I.golpes[i].edad += dt;
            if (I.golpes[i].edad > I.cfg.duracion) I.golpes.splice(i, 1);
        }

        redimensionar();
        gl.viewport(0, 0, c.width, c.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (!I.golpes.length) { I.corriendo = false; return; }

        var hits = new Float32Array(MAX * 4);
        var cols = new Float32Array(MAX * 3);
        for (var k = 0; k < I.golpes.length; k++) {
            var g = I.golpes[k];
            hits[k * 4] = g.x;
            hits[k * 4 + 1] = g.y;
            hits[k * 4 + 2] = g.edad;
            hits[k * 4 + 3] = g.fuerza;
            cols[k * 3] = g.col[0];
            cols[k * 3 + 1] = g.col[1];
            cols[k * 3 + 2] = g.col[2];
        }

        gl.useProgram(I.prog);
        gl.uniform2f(I.uni.u_res, c.width, c.height);
        gl.uniform1f(I.uni.u_t, (ts - I.t0) / 1000);
        gl.uniform4fv(I.uni.u_hit, hits);
        gl.uniform3fv(I.uni.u_col, cols);
        gl.uniform1i(I.uni.u_n, I.golpes.length);
        gl.uniform1f(I.uni.u_ap, I.cfg.apertura);
        gl.uniform1f(I.uni.u_ray, I.cfg.rayos);
        gl.uniform1f(I.uni.u_brillo, I.cfg.brillo);
        gl.uniform1f(I.uni.u_vida, I.cfg.duracion);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        requestAnimationFrame(loop);
    }

    // ---------------------------------------------------------------- panel
    var CAMPOS = [
        { k: 'brillo', etq: 'Brillo', min: 0, max: 2, step: 0.05 },
        { k: 'apertura', etq: 'Apertura', min: 0.2, max: 1.6, step: 0.02 },
        { k: 'rayos', etq: 'Rayos', min: 0, max: 2, step: 0.05 },
        { k: 'duracion', etq: 'Duracion', min: 0.3, max: 2, step: 0.05, unidad: 's' },
        { k: 'fuerza', etq: 'Fuerza', min: 0.2, max: 2, step: 0.05 }
    ];

    function armarPanel() {
        if (I.panel) return;
        var st = document.createElement('style');
        st.textContent =
            '#dwImpactosPanel{position:fixed;right:14px;bottom:70px;z-index:60;width:236px;' +
            'font-family:Montserrat,system-ui,sans-serif;color:#fff2c3;' +
            'background:linear-gradient(180deg,rgba(30,9,16,.97),rgba(13,4,8,.985));' +
            'border:2px solid rgba(255,210,95,.55);border-radius:16px;padding:12px 14px;' +
            'box-shadow:0 24px 60px rgba(0,0,0,.75);display:none}' +
            '#dwImpactosPanel.visible{display:block}' +
            '#dwImpactosPanel h4{margin:0 0 8px;font-family:Cinzel,Georgia,serif;font-size:12px;' +
            'letter-spacing:.18em;text-transform:uppercase;color:#ffd25f}' +
            '#dwImpactosPanel label{display:block;font-size:10.5px;letter-spacing:.06em;margin:7px 0 2px;' +
            'color:rgba(243,230,208,.75)}' +
            '#dwImpactosPanel input[type=range]{width:100%;accent-color:#ffd25f}' +
            '#dwImpactosBtn{position:fixed;right:14px;bottom:14px;z-index:61;width:44px;height:44px;' +
            'border-radius:50%;cursor:pointer;border:2px solid rgba(255,210,95,.6);' +
            'background:linear-gradient(180deg,#5a1329,#440a1c);color:#fff2c3;font-size:17px}' +
            '#dwImpactosPanel .reset{width:100%;margin-top:10px;padding:6px;cursor:pointer;border-radius:8px;' +
            'border:1px solid rgba(255,210,95,.45);background:transparent;color:#e8c477;' +
            'font-family:Montserrat,sans-serif;font-size:10.5px;letter-spacing:.1em}';
        document.head.appendChild(st);

        var p = document.createElement('div');
        p.id = 'dwImpactosPanel';
        p.innerHTML = '<h4>Impactos</h4>';
        CAMPOS.forEach(function (c) {
            var l = document.createElement('label');
            l.textContent = c.etq + (c.unidad ? ' (' + c.unidad + ')' : '');
            var inp = document.createElement('input');
            inp.type = 'range';
            inp.min = c.min; inp.max = c.max; inp.step = c.step;
            inp.value = I.cfg[c.k];
            inp.oninput = function () {
                I.cfg[c.k] = Number(inp.value);
                guardarCfg();
            };
            p.appendChild(l);
            p.appendChild(inp);
        });
        var b = document.createElement('button');
        b.className = 'reset';
        b.textContent = 'RESTABLECER';
        b.onclick = function () {
            I.cfg = Object.assign({}, DEF);
            guardarCfg();
            p.querySelectorAll('input[type=range]').forEach(function (inp, i) {
                inp.value = I.cfg[CAMPOS[i].k];
            });
        };
        p.appendChild(b);

        var btn = document.createElement('button');
        btn.id = 'dwImpactosBtn';
        btn.textContent = '✦';
        btn.title = 'Ajustes de impactos (tecla I)';
        btn.onclick = function () { p.classList.toggle('visible'); };

        document.body.appendChild(p);
        document.body.appendChild(btn);
        I.panel = p;

        root.addEventListener('keydown', function (ev) {
            if (ev.key === 'i' || ev.key === 'I') p.classList.toggle('visible');
        });
    }

    root.Impactos = {
        crear: crear,
        golpe: golpe,
        activo: function () { return I.ok; },
        params: function (cambios) {
            if (cambios) {
                Object.keys(cambios).forEach(function (k) {
                    if (k in I.cfg) I.cfg[k] = Number(cambios[k]);
                });
                guardarCfg();
            }
            return Object.assign({}, I.cfg);
        },
        limpiar: function () { I.golpes.length = 0; },
        panel: function (v) { if (I.panel) I.panel.classList.toggle('visible', v !== false); },
        _estado: function () {
            return { ok: I.ok, golpes: I.golpes.length, corriendo: I.corriendo, cfg: Object.assign({}, I.cfg) };
        }
    };
})(window);
