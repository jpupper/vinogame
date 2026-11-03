/* ============================================================
   FLUIDO · Metaballs unificadas + Iluminación por capa (WebGL)
   ------------------------------------------------------------
   Arquitectura en 3 etapas reales:
   1) Pase 1 (fboCampo): Acumula únicamente el campo escalar de las
      metaballs (sin iluminación ni núcleos por partícula).
   2) Pase 2 (fboMeta): Aplica el umbral de metaball para generar una
      CAPA UNIFICADA plana (1.0 adentro de la masa unida, 0.0 afuera),
      eliminando por completo la identidad individual de cada partícula
      cuando se unen.
   3) Pase 3 (Pantalla): Calcula las normales, el bisel y la iluminación
      ÚNICAMENTE sobre la capa unificada (fboMeta) con el color #450B02.
   ============================================================ */
(function () {
  'use strict';

  const MAX_PARTICULAS = 2048;

  // ── PASE 1: Splatting aditivo del campo escalar de metaballs ──
  const VERT_SPLAT = `
    attribute vec2 a_pos;
    attribute vec2 a_uv;
    uniform vec2 u_res;
    varying vec2 v_uv;
    void main() {
      v_uv = a_uv;
      vec2 clip = (a_pos / u_res) * 2.0 - 1.0;
      gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
    }
  `;

  const FRAG_SPLAT = `
    precision mediump float;
    varying vec2 v_uv;
    void main() {
      float d2 = dot(v_uv, v_uv);
      if (d2 > 1.0) discard;
      // Caída polinómica suave C2: (1 - r^2)^2
      float t = 1.0 - d2;
      float campo = t * t * 0.78;
      gl_FragColor = vec4(campo, campo, campo, campo);
    }
  `;

  const VERT_QUAD = `
    attribute vec2 a_quad;
    varying vec2 v_tex;
    void main() {
      v_tex = a_quad * 0.5 + 0.5;
      gl_Position = vec4(a_quad, 0.0, 1.0);
    }
  `;

  // ── PASE 2: Umbralización a una CAPA DE METABALLS UNIFICADA (0..1 plano) ──
  const FRAG_META_LAYER = `
    precision mediump float;
    varying vec2 v_tex;
    uniform sampler2D u_campo;
    void main() {
      float f = texture2D(u_campo, v_tex).r;
      // Cuando las partículas se superponen superan el umbral y quedan en 1.0
      // plano y continuo en toda la masa unificada.
      float silueta = smoothstep(0.22, 0.30, f);
      gl_FragColor = vec4(silueta, silueta, silueta, silueta);
    }
  `;

  // ── PASE 3: Iluminación aplicada SOBRE la capa de metaballs unificada ──
  const FRAG_LIGHT_LAYER = `
    precision mediump float;
    varying vec2 v_tex;
    uniform sampler2D u_meta;
    uniform vec2 u_texel;

    float m(vec2 offsetPx) {
      return texture2D(u_meta, v_tex + offsetPx * u_texel).r;
    }

    void main() {
      float alfa = texture2D(u_meta, v_tex).r;
      if (alfa <= 0.01) discard;

      // Muestreo en dos anillos sobre la CAPA UNIFICADA (u_meta).
      // En el interior de la masa unida todos estos valores valen 1.0,
      // por lo que el gradiente interno es exactamente 0 (sin sombras por partícula).
      float r1 = 2.5;
      float r2 = 6.0;

      float gx1 = m(vec2( r1, 0.0)) - m(vec2(-r1, 0.0));
      float gy1 = m(vec2(0.0,  r1)) - m(vec2(0.0, -r1));

      float gx2 = m(vec2( r2, 0.0)) - m(vec2(-r2, 0.0));
      float gy2 = m(vec2(0.0,  r2)) - m(vec2(0.0, -r2));

      // Promedio de vecindad para detectar cercanía al borde exterior de la masa
      float interior = (
        m(vec2( r2,  0.0)) + m(vec2(-r2,  0.0)) +
        m(vec2( 0.0,  r2)) + m(vec2( 0.0, -r2)) +
        m(vec2( r2 * 0.7,  r2 * 0.7)) + m(vec2(-r2 * 0.7,  r2 * 0.7)) +
        m(vec2( r2 * 0.7, -r2 * 0.7)) + m(vec2(-r2 * 0.7, -r2 * 0.7))
      ) * 0.125;

      float gx = gx1 * 0.6 + gx2 * 0.4;
      float gy = gy1 * 0.6 + gy2 * 0.4;
      vec3 normal = normalize(vec3(-gx * 2.2, -gy * 2.2, 1.0));

      // Luz superior-izquierda aplicada únicamente al contorno de la masa unificada
      vec3 dirLuz = normalize(vec3(-0.42, 0.72, 0.55));
      float difusa = clamp(dot(normal, dirLuz), 0.0, 1.0);
      float especular = pow(clamp(dot(reflect(-dirLuz, normal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 18.0);
      float factorBorde = clamp(1.0 - interior, 0.0, 1.0);

      // Color exacto del vino: #450B02 -> rgb(69, 11, 2) = vec3(0.2706, 0.0431, 0.0078)
      vec3 vinoBase  = vec3(0.2706, 0.0431, 0.0078); // #450B02 cuerpo unificado
      vec3 vinoBorde = vec3(0.400, 0.075, 0.018);    // menisco / borde iluminado
      vec3 vinoSombra = vec3(0.180, 0.024, 0.004);   // bisel inferior sutil del contorno

      vec3 col = vinoBase;
      // Sombra e iluminación sólo en el borde de la capa unificada (factorBorde > 0)
      col = mix(col, vinoSombra, factorBorde * (1.0 - difusa) * 0.45);
      col = mix(col, vinoBorde, factorBorde * difusa * 0.65);
      col += factorBorde * especular * 0.28 * vec3(0.92, 0.52, 0.38);

      gl_FragColor = vec4(col, alfa * 0.98);
    }
  `;

  let canvasGL = null;
  let gl = null;
  let progSplat = null;
  let progMeta = null;
  let progLight = null;
  let bufSplat = null;
  let bufQuad = null;
  let fboCampo = null;
  let texCampo = null;
  let fboMeta = null;
  let texMeta = null;
  let fboW = 0;
  let fboH = 0;
  let listo = false;
  let escalaRender = 0.78;

  const verts = new Float32Array(MAX_PARTICULAS * 6 * 4);

  function compilarShader(ctx, tipo, src) {
    const s = ctx.createShader(tipo);
    ctx.shaderSource(s, src);
    ctx.compileShader(s);
    if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) {
      console.error('Fluido shader error:', ctx.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function crearPrograma(ctx, vsSrc, fsSrc) {
    const vs = compilarShader(ctx, ctx.VERTEX_SHADER, vsSrc);
    const fs = compilarShader(ctx, ctx.FRAGMENT_SHADER, fsSrc);
    if (!vs || !fs) return null;
    const p = ctx.createProgram();
    ctx.attachShader(p, vs);
    ctx.attachShader(p, fs);
    ctx.linkProgram(p);
    if (!ctx.getProgramParameter(p, ctx.LINK_STATUS)) {
      console.error('Fluido link error:', ctx.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function crearParFBO(w, h) {
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
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo: fb, tex: tex };
  }

  function asegurarFBOs(w, h) {
    if (fboCampo && fboMeta && fboW === w && fboH === h) return;
    if (fboCampo) gl.deleteFramebuffer(fboCampo);
    if (texCampo) gl.deleteTexture(texCampo);
    if (fboMeta) gl.deleteFramebuffer(fboMeta);
    if (texMeta) gl.deleteTexture(texMeta);

    fboW = w;
    fboH = h;
    const p1 = crearParFBO(w, h);
    fboCampo = p1.fbo;
    texCampo = p1.tex;

    const p2 = crearParFBO(w, h);
    fboMeta = p2.fbo;
    texMeta = p2.tex;
  }

  function iniciar(canvas) {
    canvasGL = canvas;
    gl = canvas.getContext('webgl', {
      premultipliedAlpha: false,
      alpha: true,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    if (!gl) return false;

    progSplat = crearPrograma(gl, VERT_SPLAT, FRAG_SPLAT);
    progMeta = crearPrograma(gl, VERT_QUAD, FRAG_META_LAYER);
    progLight = crearPrograma(gl, VERT_QUAD, FRAG_LIGHT_LAYER);
    if (!progSplat || !progMeta || !progLight) return false;

    bufSplat = gl.createBuffer();
    bufQuad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    listo = true;
    return true;
  }

  function renderizarGrupo(lista, ancho, alto, factorRadio) {
    if (!listo || !gl) return false;

    escalaRender = ancho < 700 ? 0.68 : 0.80;
    const aw = Math.max(160, Math.round(ancho * escalaRender));
    const ah = Math.max(160, Math.round(alto * escalaRender));
    if (canvasGL.width !== aw || canvasGL.height !== ah) {
      canvasGL.width = aw;
      canvasGL.height = ah;
    }
    asegurarFBOs(aw, ah);

    const kR = factorRadio || 2.65;
    let n = 0;
    const tope = Math.min(MAX_PARTICULAS, lista.length);

    for (let i = 0; i < tope; i++) {
      const g = lista[i];
      if (g.x < -40 || g.x > ancho + 40 || g.y < -40 || g.y > alto + 40) continue;
      const cx = g.x * escalaRender;
      const cy = g.y * escalaRender;
      const r = Math.max(4.0, g.r * (g.kR || kR) * escalaRender);

      const x0 = cx - r, x1 = cx + r;
      const y0 = cy - r, y1 = cy + r;
      const idx = n * 24;

      verts[idx]      = x0; verts[idx + 1]  = y0; verts[idx + 2]  = -1; verts[idx + 3]  = -1;
      verts[idx + 4]  = x1; verts[idx + 5]  = y0; verts[idx + 6]  =  1; verts[idx + 7]  = -1;
      verts[idx + 8]  = x0; verts[idx + 9]  = y1; verts[idx + 10] = -1; verts[idx + 11] =  1;
      verts[idx + 12] = x0; verts[idx + 13] = y1; verts[idx + 14] = -1; verts[idx + 15] =  1;
      verts[idx + 16] = x1; verts[idx + 17] = y0; verts[idx + 18] =  1; verts[idx + 19] = -1;
      verts[idx + 20] = x1; verts[idx + 21] = y1; verts[idx + 22] =  1; verts[idx + 23] =  1;
      n++;
    }

    // 1) Pase 1 -> fboCampo (acumulación aditiva del campo escalar)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboCampo);
    gl.viewport(0, 0, aw, ah);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (n > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(progSplat);

      gl.bindBuffer(gl.ARRAY_BUFFER, bufSplat);
      gl.bufferData(gl.ARRAY_BUFFER, verts.subarray(0, n * 24), gl.DYNAMIC_DRAW);

      const locPos = gl.getAttribLocation(progSplat, 'a_pos');
      const locUV = gl.getAttribLocation(progSplat, 'a_uv');
      gl.enableVertexAttribArray(locPos);
      gl.enableVertexAttribArray(locUV);
      gl.vertexAttribPointer(locPos, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(locUV, 2, gl.FLOAT, false, 16, 8);

      gl.uniform2f(gl.getUniformLocation(progSplat, 'u_res'), aw, ah);
      gl.drawArrays(gl.TRIANGLES, 0, n * 6);
    }

    // 2) Pase 2 -> fboMeta (umbralización a capa de metaballs unificada)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboMeta);
    gl.viewport(0, 0, aw, ah);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (n > 0) {
      gl.disable(gl.BLEND);
      gl.useProgram(progMeta);

      gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
      const locQuadM = gl.getAttribLocation(progMeta, 'a_quad');
      gl.enableVertexAttribArray(locQuadM);
      gl.vertexAttribPointer(locQuadM, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texCampo);
      gl.uniform1i(gl.getUniformLocation(progMeta, 'u_campo'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // 3) Pase 3 -> canvasGL (iluminación aplicada sobre la capa fboMeta)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, aw, ah);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (n > 0) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(progLight);

      gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
      const locQuadL = gl.getAttribLocation(progLight, 'a_quad');
      gl.enableVertexAttribArray(locQuadL);
      gl.vertexAttribPointer(locQuadL, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texMeta);
      gl.uniform1i(gl.getUniformLocation(progLight, 'u_meta'), 0);
      gl.uniform2f(gl.getUniformLocation(progLight, 'u_texel'), 1 / aw, 1 / ah);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    Fluido.ultimo = { n: n, aw: aw, ah: ah, largo: lista.length };
    return n > 0;
  }

  const Fluido = {
    ultimo: { n: 0, aw: 0, ah: 0, largo: 0 },
    iniciar: iniciar,
    disponible: () => listo,
    apagar: () => { listo = false; },
    canvas: () => canvasGL,
    renderizarGrupo: renderizarGrupo,
    dibujar: (gotas, ancho, alto) => renderizarGrupo(gotas, ancho, alto, 2.65)
  };

  window.Fluido = Fluido;
})();
