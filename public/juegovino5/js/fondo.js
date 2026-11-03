/* ============================================================
   FONDO DE AGUA CON IMAGEN (motor propio, sin el include del editor)
   ------------------------------------------------------------
   Dos pases en WebGL, igual que el shader `agua-vino` del JP Shader Editor:

     · PASE SIM (buffer, feedback)  → el campo de altura del agua.
       Se lee a sí mismo: .x estado nuevo · .y anterior · .z energía.
       Inyección por los PUNTOS DEL VINO (las gotas que caen) y por cinco
       puntos simulados que orbitan solos, así el agua nunca queda quieta.

     · PASE OUT (pantalla) → refracta la IMAGEN del viñedo con la altura
       del campo, le suma especular, espuma y una viñeta. Sin piso, sin
       grilla, sin cáusticas: solo el agua sobre la foto.

   Se implementa acá (y no con el include del jpshadereditor) porque el
   include NO soporta imágenes propias: no lee `imageUrls` ni carga texturas
   de usuario. Con el motor propio la imagen entra del mismo origen (sin
   CORS) y se puede rotar entre varios fondos con un crossfade.
   ============================================================ */
(function () {
  'use strict';

  const MAXPT = 12;
  const MAXSIM = 8;

  const VERT = `
    attribute vec2 a_pos;
    void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  // ---------------- PASE SIM ----------------
  const FRAG_SIM = `
    precision highp float;
    uniform vec2  u_res;
    uniform float u_time;
    uniform float u_frame;
    uniform int   u_ptCount;
    uniform vec4  u_pt[${MAXPT}];      // xy actual, zw anterior (px, y = 0 abajo)
    uniform int   u_simCount;
    uniform vec4  u_sim[${MAXSIM}];    // xy actual, zw anterior
    uniform float u_fuerza;            // empuje del vino
    uniform float u_simFuerza;         // empuje de los puntos simulados
    uniform float u_radio;
    uniform float u_paso;
    uniform float u_oleaje;
    uniform float u_amortiguar;
    uniform sampler2D u_prev;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float sdSeg(vec2 p, vec2 a, vec2 b) {
      vec2 pa = p - a;
      vec2 ba = b - a;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
      return length(pa - ba * h);
    }
    float sCampo(vec2 uv) {
      return texture2D(u_prev, clamp(uv, vec2(0.0), vec2(1.0))).x;
    }

    void main() {
      vec2 frag = gl_FragCoord.xy;
      vec2 p = frag / u_res;

      vec4 c = texture2D(u_prev, p);
      if (!(c.x == c.x)) c.x = 0.5;
      if (!(c.y == c.y)) c.y = 0.5;
      if (!(c.z == c.z)) c.z = 0.0;

      float paso = 0.7 + u_paso * 2.3;
      vec2  e = vec2(paso) / u_res;
      float s1 = sCampo(p - vec2(0.0, e.y));
      float s2 = sCampo(p - vec2(e.x, 0.0));
      float s3 = sCampo(p + vec2(e.x, 0.0));
      float s4 = sCampo(p + vec2(0.0, e.y));

      float k = 0.90 + u_amortiguar * 0.0995;
      float perd = 1.0 - k;
      float rPx = 1.5 + u_radio * 12.0;
      float iny = 0.0;
      float energia = 0.0;

      // el vino que cae
      for (int i = 0; i < ${MAXPT}; i++) {
        if (i >= u_ptCount) break;
        vec2 pa = u_pt[i].xy;
        vec2 pb = u_pt[i].zw;
        float wA = smoothstep(rPx, rPx * 0.15, length(frag - pa));
        float wS = smoothstep(rPx * 1.7, 0.0, sdSeg(frag, pb, pa)) * 0.55;
        iny += u_fuerza * 0.40 * perd * (wA + wS);
        energia = max(energia, max(wA, wS) * u_fuerza);
      }

      // puntos simulados (orbitan solos): el agua respira aunque no tires vino
      for (int i = 0; i < ${MAXSIM}; i++) {
        if (i >= u_simCount) break;
        vec2 pa = u_sim[i].xy;
        vec2 pb = u_sim[i].zw;
        float wA = smoothstep(rPx * 1.15, rPx * 0.15, length(frag - pa));
        float wS = smoothstep(rPx * 2.0, 0.0, sdSeg(frag, pb, pa)) * 0.5;
        iny += u_simFuerza * 0.34 * perd * (wA + wS);
        energia = max(energia, max(wA, wS) * u_simFuerza);
      }

      float a1  = c.x - 0.5;
      float a0  = c.y - 0.5;
      float lap = (s1 + s2 + s3 + s4) - 4.0 * c.x;
      float c2  = 0.05 + u_oleaje * 0.45;
      float a   = (2.0 * a1 - a0 + c2 * lap) * k;
      a += iny;
      a *= smoothstep(0.9, 1.0, float(u_frame >= 60.0));   // limpia el buffer al arrancar
      if (!(a == a)) a = 0.0;
      a = clamp(a, -0.5, 0.5);

      float en = clamp(max(c.z * 0.965, energia), 0.0, 1.5);
      gl_FragColor = vec4(a + 0.5, c.x, en, 1.0);
    }
  `;

  // ---------------- PASE OUT ----------------
  const FRAG_OUT = `
    precision highp float;
    uniform vec2  u_res;
    uniform float u_time;
    uniform sampler2D u_prev;      // el campo del agua
    uniform sampler2D u_imgA;      // imagen actual
    uniform sampler2D u_imgB;      // imagen anterior (crossfade)
    uniform float u_mezcla;        // 0 = A, 1 = B
    uniform float u_arImg;         // relación de aspecto de la imagen
    uniform float u_refraccion;
    uniform float u_relieve;
    uniform float u_profundidad;
    uniform float u_especular;
    uniform float u_brillo;
    uniform float u_espuma;
    uniform vec2  u_foco;
    uniform vec3  u_agua;
    uniform vec3  u_fondo;
    uniform float u_tinte;         // cuánto tiñe el agua la foto (0..1)

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float ruido(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
                 mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    // cover: la foto mantiene su proporción aunque la ventana sea más ancha o
    // más alta (si no, el viñedo sale estirado)
    vec2 coverUV(vec2 uv) {
      float arPant = u_res.x / u_res.y;
      vec2 o = uv;
      if (arPant > u_arImg) o.y = (uv.y - 0.5) * (u_arImg / arPant) + 0.5;
      else                  o.x = (uv.x - 0.5) * (arPant / u_arImg) + 0.5;
      return clamp(o, vec2(0.0), vec2(1.0));
    }

    vec3 foto(vec2 uv) {
      vec2 c = coverUV(uv);
      vec3 a = texture2D(u_imgA, c).rgb;
      vec3 b = texture2D(u_imgB, c).rgb;
      return mix(a, b, clamp(u_mezcla, 0.0, 1.0));
    }

    void main() {
      vec2 frag = gl_FragCoord.xy;
      vec2 uv = frag / u_res;
      vec2 texel = 1.0 / u_res;
      float aspecto = u_res.x / u_res.y;

      vec4 campo = texture2D(u_prev, uv);
      float h = campo.x - 0.5;
      float vel = campo.x - campo.y;
      float energia = clamp(campo.z, 0.0, 1.5);
      if (!(h == h)) h = 0.0;
      if (!(vel == vel)) vel = 0.0;
      if (!(energia == energia)) energia = 0.0;

      vec2 tx = vec2(texel.x, 0.0);
      vec2 ty = vec2(0.0, texel.y);
      vec4 mL = texture2D(u_prev, clamp(uv - tx, vec2(0.0), vec2(1.0)));
      vec4 mR = texture2D(u_prev, clamp(uv + tx, vec2(0.0), vec2(1.0)));
      vec4 mD = texture2D(u_prev, clamp(uv - ty, vec2(0.0), vec2(1.0)));
      vec4 mU = texture2D(u_prev, clamp(uv + ty, vec2(0.0), vec2(1.0)));
      vec2 grad = vec2(mR.x - mL.x, mU.x - mD.x) * 0.5;
      vec2 pend = grad * vec2(aspecto, 1.0) * (30.0 + u_relieve * 170.0);
      vec3 n = normalize(vec3(-pend, 0.25 + u_profundidad * 1.75));

      // refracción: la foto se corre con la altura del agua
      vec2 off = (campo.xy - vec2(0.5)) * (0.15 + u_refraccion * 1.5);
      vec2 quv = uv + off;

      vec3 fondo = foto(quv);
      // tinte del agua SOBRE la foto (poco: la imagen tiene que leerse)
      vec3 col = mix(fondo, fondo * u_agua, u_tinte);
      // un poco del color del vino en las sombras, para que no sea una foto seca
      col = mix(col, col * (u_fondo * 3.4 + 0.35), 0.18);

      // cuerpo: la normal sombrea la superficie (da volumen al oleaje)
      float dif = clamp(dot(n, normalize(vec3(-0.45, -0.75, 0.55))), 0.0, 1.0);
      col *= 0.92 + 0.30 * dif;
      col += clamp(h * 2.2, 0.0, 1.0) * mix(u_agua, vec3(0.92, 0.30, 0.34), 0.45) * 0.05;

      // espuma: solo donde de verdad hubo empuje
      float espN = ruido(vec2(uv.x * aspecto, uv.y) * 90.0 + vec2(u_time * 0.35, -u_time * 0.3) + vel * 30.0);
      float esp = smoothstep(0.45, 1.05, energia)
                * smoothstep(0.45, 0.95, espN * 0.55 + energia * 0.7);
      col += esp * u_espuma * vec3(0.93, 0.98, 1.0) * 0.55;

      // especular
      vec3 L = normalize(vec3((u_foco - uv) * vec2(aspecto, 1.0), 0.55));
      vec3 Hv = normalize(L + vec3(0.0, 0.0, 1.0));
      float nh = max(dot(n, Hv), 0.0);
      float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);
      col += (pow(nh, 10.0 + u_especular * 380.0) * u_brillo * 1.6
            + pow(nh, 8.0) * u_brillo * 0.08) * vec3(1.0, 0.99, 0.96);
      col += fres * u_brillo * 0.30 * mix(u_agua, vec3(0.85, 0.97, 1.0), 0.5);

      // cierre: viñeta suave + tonemap + grano (mata el banding)
      col *= 1.0 - 0.22 * length(uv - 0.5);
      col = 1.0 - exp(-col * 1.34);
      col += (hash12(frag + fract(u_time) * 137.0) - 0.5) * 0.010;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `;

  // ---------------- PARÁMETROS (los mismos del shader agua-vino) ----------------
  const P = {
    fuerza: 0.95, simFuerza: 0.22,
    radio: 0.42, paso: 0.35, oleaje: 0.42, amortiguar: 0.84,
    refraccion: 0.22, relieve: 0.42, profundidad: 0.5,
    especular: 0.66, brillo: 0.58, espuma: 0.12,
    foco: [0.66, 0.72],
    agua: [1.0, 0.94, 0.92],
    fondo: [0.24, 0.045, 0.085],
    tinte: 0.34
  };

  const F = {
    canvas: null, gl: null,
    progSim: null, progOut: null,
    buf: null,
    res: { w: 0, h: 0 },
    fbo: [],       // [0] y [1] ping-pong
    actual: 0,
    frame: 0,
    imagenes: [],  // {img, ar, ok}
    idx: 0,
    mezcla: 0,
    tUltimoCambio: 0,
    intervalo: 16000,  // ms entre fondos
    listo: false,
    sim: [],
    ptBuf: new Float32Array(MAXPT * 4),
    simBuf: new Float32Array(MAXSIM * 4)
  };

  function compilar(gl, tipo, src) {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('fondo shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function programa(gl, fragSrc) {
    const vs = compilar(gl, gl.VERTEX_SHADER, VERT);
    const fs = compilar(gl, gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('fondo link:', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function crearFBO(gl, w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    // se arranca en reposo (0.5 de altura): si no, el primer frame es basura
    gl.clearColor(0.5, 0.5, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb, tex, w, h };
  }

  function texturaDeImagen(gl, img) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    // las imágenes HTML traen la fila 0 ARRIBA y WebGL espera v=0 ABAJO:
    // sin este flip la foto se ve cabeza abajo
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function iniciar(contenedor, ancho, alto) {
    if (F.canvas) { redimensionar(ancho, alto); return true; }
    const c = document.createElement('canvas');
    c.id = 'fondoAguaCanvas';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    contenedor.appendChild(c);

    const gl = c.getContext('webgl', {
      alpha: false, antialias: false, depth: false,
      powerPreference: 'high-performance', preserveDrawingBuffer: false
    });
    if (!gl) { console.warn('fondo: sin WebGL'); return false; }

    F.canvas = c;
    F.gl = gl;
    F.progSim = programa(gl, FRAG_SIM);
    F.progOut = programa(gl, FRAG_OUT);
    if (!F.progSim || !F.progOut) return false;

    F.buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, F.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    // cinco puntos simulados, como el módulo del editor
    F.sim = [];
    for (let i = 0; i < 5; i++) {
      F.sim.push({
        ang: (Math.PI * 2 / 5) * i,
        vel: 0.35 + i * 0.05,
        radio: 0.16 + 0.10 * ((i % 3) / 2),
        x: 0.5, y: 0.5, px: 0.5, py: 0.5
      });
    }

    F.listo = true;
    redimensionar(ancho, alto);
    return true;
  }

  function redimensionar(ancho, alto) {
    if (!F.listo) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // el campo es suave: media resolución alcanza y cuesta la cuarta parte
    const escala = ancho < 700 ? 0.55 : 0.7;
    const w = Math.max(160, Math.round(ancho * escala));
    const h = Math.max(160, Math.round(alto * escala));
    if (F.res.w === w && F.res.h === h) return;

    const gl = F.gl;
    F.res = { w, h };
    F.canvas.width = w;
    F.canvas.height = h;
    F.canvas.style.width = ancho + 'px';
    F.canvas.style.height = alto + 'px';

    F.fbo.forEach((f) => { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); });
    F.fbo = [crearFBO(gl, w, h), crearFBO(gl, w, h)];
    F.frame = 0;
  }

  function cargar(urls) {
    if (!F.gl) return;
    const gl = F.gl;
    F.imagenes = [];
    urls.forEach((u, i) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        F.imagenes[i] = {
          tex: texturaDeImagen(gl, img),
          ar: img.naturalWidth / Math.max(1, img.naturalHeight),
          ok: true
        };
      };
      img.onerror = () => console.warn('fondo: no se pudo cargar', u);
      img.src = u;
    });
  }

  function texturaFallback() {
    // si todavía no hay imagen, un 1x1 borgoña (nunca negro)
    if (!F._fallback) {
      const gl = F.gl;
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([46, 12, 24, 255]));
      F._fallback = t;
    }
    return F._fallback;
  }

  // ---------------- DIBUJO ----------------
  const ahora = () => performance.now() / 1000;

  function dibujar(pointers) {
    if (!F.listo) return;
    const gl = F.gl;
    const { w, h } = F.res;
    const t = ahora();

    // ---- puntos simulados: órbita por aspecto, para que no se estiren ----
    const aspecto = w / Math.max(1, h);
    F.sim.forEach((s, i) => {
      s.px = s.x; s.py = s.y;
      const a = t * s.vel + s.ang;
      const pulso = 0.5 + 0.5 * Math.sin(t * 0.7 + i * 1.7);
      const r = s.radio * (0.75 + 0.35 * pulso);
      s.x = 0.5 + Math.cos(a) * r / aspecto;
      s.y = 0.5 + Math.sin(a) * r;
      F.simBuf[i * 4] = s.x * w;
      F.simBuf[i * 4 + 1] = s.y * h;
      F.simBuf[i * 4 + 2] = s.px * w;
      F.simBuf[i * 4 + 3] = s.py * h;
    });

    // ---- puntos del vino ----
    let n = 0;
    if (pointers) {
      const tope = Math.min(MAXPT, pointers.length);
      for (let i = 0; i < tope; i++) {
        const p = pointers[i];
        F.ptBuf[n * 4] = p.x; F.ptBuf[n * 4 + 1] = p.y;
        F.ptBuf[n * 4 + 2] = p.px; F.ptBuf[n * 4 + 3] = p.py;
        n++;
      }
    }

    // ---- PASE SIM → FBO ----
    const origen = F.fbo[F.actual];
    const destino = F.fbo[1 - F.actual];
    gl.bindFramebuffer(gl.FRAMEBUFFER, destino.fb);
    gl.viewport(0, 0, w, h);
    gl.useProgram(F.progSim);
    gl.bindBuffer(gl.ARRAY_BUFFER, F.buf);
    const aSim = gl.getAttribLocation(F.progSim, 'a_pos');
    gl.enableVertexAttribArray(aSim);
    gl.vertexAttribPointer(aSim, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, origen.tex);
    gl.uniform1i(gl.getUniformLocation(F.progSim, 'u_prev'), 0);
    gl.uniform2f(gl.getUniformLocation(F.progSim, 'u_res'), w, h);
    gl.uniform1f(gl.getUniformLocation(F.progSim, 'u_time'), t);
    gl.uniform1f(gl.getUniformLocation(F.progSim, 'u_frame'), F.frame);
    gl.uniform1i(gl.getUniformLocation(F.progSim, 'u_ptCount'), n);
    gl.uniform4fv(gl.getUniformLocation(F.progSim, 'u_pt'), F.ptBuf);
    gl.uniform1i(gl.getUniformLocation(F.progSim, 'u_simCount'), F.sim.length);
    gl.uniform4fv(gl.getUniformLocation(F.progSim, 'u_sim'), F.simBuf);
    gl.uniform1f(gl.getUniformLocation(F.progSim, 'u_fuerza'), P.fuerza);
    gl.uniform1f(gl.getUniformLocation(F.progSim, 'u_simFuerza'), P.simFuerza);
    gl.uniform1f(gl.getUniformLocation(F.progSim, 'u_radio'), P.radio);
    gl.uniform1f(gl.getUniformLocation(F.progSim, 'u_paso'), P.paso);
    gl.uniform1f(gl.getUniformLocation(F.progSim, 'u_oleaje'), P.oleaje);
    gl.uniform1f(gl.getUniformLocation(F.progSim, 'u_amortiguar'), P.amortiguar);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    F.actual = 1 - F.actual;
    F.frame++;

    // ---- crossfade de fondos ----
    if (F.imagenes.filter((i) => i && i.ok).length > 1) {
      const dt = t - (F.tUltimoCambio || t);
      // avanza la mezcla en el último 25 % del intervalo
      const desde = F.intervalo / 1000 * 0.75;
      const dur = F.intervalo / 1000 * 0.25;
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

    // ---- PASE OUT → pantalla ----
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(F.progOut);
    gl.bindBuffer(gl.ARRAY_BUFFER, F.buf);
    const aOut = gl.getAttribLocation(F.progOut, 'a_pos');
    gl.enableVertexAttribArray(aOut);
    gl.vertexAttribPointer(aOut, 2, gl.FLOAT, false, 0, 0);

    const campo = F.fbo[1 - F.actual];
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, campo.tex);
    gl.uniform1i(gl.getUniformLocation(F.progOut, 'u_prev'), 0);

    const imgA = (F.imagenes[F.idx] && F.imagenes[F.idx].ok) ? F.imagenes[F.idx] : null;
    const imgB = (F.imagenes[(F.idx + 1) % Math.max(1, F.imagenes.length)] || {});
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, imgA ? imgA.tex : texturaFallback());
    gl.uniform1i(gl.getUniformLocation(F.progOut, 'u_imgA'), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, (imgB && imgB.ok) ? imgB.tex : (imgA ? imgA.tex : texturaFallback()));
    gl.uniform1i(gl.getUniformLocation(F.progOut, 'u_imgB'), 2);
    gl.uniform1f(gl.getUniformLocation(F.progOut, 'u_mezcla'), F.mezcla);
    gl.uniform1f(gl.getUniformLocation(F.progOut, 'u_arImg'), (imgA && imgA.ar) || 1.8333);

    gl.uniform2f(gl.getUniformLocation(F.progOut, 'u_res'), w, h);
    gl.uniform1f(gl.getUniformLocation(F.progOut, 'u_time'), t);
    gl.uniform1f(gl.getUniformLocation(F.progOut, 'u_refraccion'), P.refraccion);
    gl.uniform1f(gl.getUniformLocation(F.progOut, 'u_relieve'), P.relieve);
    gl.uniform1f(gl.getUniformLocation(F.progOut, 'u_profundidad'), P.profundidad);
    gl.uniform1f(gl.getUniformLocation(F.progOut, 'u_especular'), P.especular);
    gl.uniform1f(gl.getUniformLocation(F.progOut, 'u_brillo'), P.brillo);
    gl.uniform1f(gl.getUniformLocation(F.progOut, 'u_espuma'), P.espuma);
    gl.uniform2fv(gl.getUniformLocation(F.progOut, 'u_foco'), new Float32Array(P.foco));
    gl.uniform3fv(gl.getUniformLocation(F.progOut, 'u_agua'), new Float32Array(P.agua));
    gl.uniform3fv(gl.getUniformLocation(F.progOut, 'u_fondo'), new Float32Array(P.fondo));
    gl.uniform1f(gl.getUniformLocation(F.progOut, 'u_tinte'), P.tinte);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  window.FondoAgua = {
    iniciar,
    redimensionar,
    cargar,
    dibujar,
    params: P,
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
