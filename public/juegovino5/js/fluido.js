/* ============================================================
   FLUIDO · vino como METABALLS EN SHADER
   ------------------------------------------------------------
   Cada gota es un campo de densidad; el fragment shader hace el umbral, así las
   gotas cercanas se FUNDEN en una sola masa con brillo y especular.

   Optimizaciones para celular (medidas):
   - GRADIENTE ANALÍTICO: la normal sale del mismo loop del campo. Antes se
     evaluaba el campo 5 veces por píxel (la luz costaba 4 pasadas más) y en un
     teléfono eso bajaba a ~5 fps: el chorro parecía congelado / no se veía.
   - MAX de gotas chico (64) y se muestrean si hay más.
   - Resolución de render 0.45-0.6 según el ancho (se estira por CSS).
   ============================================================ */
(function () {
  'use strict';

  const MAX = 64;

  const VERT = `
    attribute vec2 a_pos;
    void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }
  `;

  const FRAG = `
    precision mediump float;
    uniform vec2  u_res;
    uniform float u_time;
    uniform int   u_count;
    uniform vec4  u_gotas[${MAX}];   // xy = posición (px), z = radio (px)

    void main() {
      vec2 p = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);   // y hacia abajo

      float f = 0.0;
      vec2 grad = vec2(0.0);
      float prof = 0.0;

      for (int i = 0; i < ${MAX}; i++) {
        if (i >= u_count) break;
        vec4 g = u_gotas[i];
        vec2 d = p - g.xy;
        float dd = max(dot(d, d), 1.0);
        float r2 = g.z * g.z;
        float w = r2 / dd;
        float w2 = w * w;
        f += w2;
        prof += w;
        // derivada analítica de w² respecto de p (para la normal)
        grad += (-4.0 * r2 * w / (dd * dd)) * d;
      }

      float masa = smoothstep(0.5, 0.8, f);
      if (masa <= 0.001) discard;

      vec3 n = normalize(vec3(grad.x, grad.y, 0.16));
      vec3 luz = normalize(vec3(-0.42, -0.72, 0.75));
      float dif = clamp(dot(n, luz), 0.0, 1.0);
      float esp = pow(clamp(dot(reflect(-luz, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 24.0);

      // Vino tinto: granate saturado, no un borgoña casi negro. El oscuro queda
      // para el cuerpo de la masa y el vivo para el borde y el brillo.
      vec3 vinoOsc  = vec3(0.19, 0.009, 0.026);
      vec3 vinoMed  = vec3(0.56, 0.030, 0.062);
      vec3 vinoVivo = vec3(0.86, 0.105, 0.145);

      float borde = 1.0 - smoothstep(0.55, 1.4, f);
      vec3 col = mix(vinoOsc, vinoMed, clamp(prof * 0.62, 0.0, 1.0));
      col = mix(col, vinoVivo, borde * 0.62);
      col += dif * 0.30 * vinoVivo;
      col += esp * 1.1;

      gl_FragColor = vec4(col, masa * (0.93 + 0.07 * borde));
    }
  `;

  let gl = null, prog = null, buf = null;
  let uRes = null, uTime = null, uCount = null, uGotas = null;
  let listo = false;
  let escala = 0.55;

  function compilar(canvas) {
    gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true, antialias: false, powerPreference: 'high-performance' });
    if (!gl) return false;

    const sh = (tipo, src) => {
      const s = gl.createShader(tipo);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('fluido shader:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT);
    const fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;

    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('fluido link:', gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);

    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

    uRes = gl.getUniformLocation(prog, 'u_res');
    uTime = gl.getUniformLocation(prog, 'u_time');
    uCount = gl.getUniformLocation(prog, 'u_count');
    uGotas = gl.getUniformLocation(prog, 'u_gotas');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    listo = true;
    return true;
  }

  const datos = new Float32Array(MAX * 4);
  const Fluido = {
    ultimo: { n: 0, aw: 0, ah: 0 },
    iniciar: compilar,
    disponible: () => listo,
    apagar: () => { listo = false; },
    dibujar
  };

  function dibujar(gotas, ancho, alto, tiempo) {
    if (!listo || !gl) return;

    // el campo es suave: con menos resolución alcanza y cuesta muchísimo menos
    escala = ancho < 700 ? 0.45 : 0.55;
    const aw = Math.max(140, Math.round(ancho * escala));
    const ah = Math.max(140, Math.round(alto * escala));
    const c = gl.canvas;
    if (c.width !== aw || c.height !== ah) { c.width = aw; c.height = ah; }
    gl.viewport(0, 0, aw, ah);

    // se muestrean las gotas si hay más que MAX (la vena se mantiene igual)
    const salto = Math.max(1, Math.ceil(gotas.length / MAX));
    let n = 0;
    for (let i = 0; i < gotas.length && n < MAX; i += salto) {
      const g = gotas[i];
      if (g.x < -20 || g.x > ancho + 20 || g.y < -20 || g.y > alto + 20) continue;
      datos[n * 4] = g.x * escala;
      datos[n * 4 + 1] = g.y * escala;
      datos[n * 4 + 2] = Math.max(3, g.r * escala);
      datos[n * 4 + 3] = 1;
      n++;
    }

    Fluido.ultimo = { n: n, aw: aw, ah: ah, largo: gotas.length };

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniform2f(uRes, aw, ah);
    gl.uniform1f(uTime, tiempo || 0);
    gl.uniform1i(uCount, n);
    gl.uniform4fv(uGotas, datos);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  window.Fluido = Fluido;
})();
