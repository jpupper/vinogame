// ============================================================================
//  VINOGAME · DYNAMIC BACKGROUND & MULTIBUFFER WATER SHADER PIPELINE
//  ----------------------------------------------------------------------------
//  Motor multibuffer WebGL con ping-pong en punto flotante (OES_texture_float)
//  para simular el campo de agua de:
//   · https://fullscreencode.com/jpshadereditor/shader.html?shader=agua-nikos
//   · https://fullscreencode.com/jpshadereditor/shader.html?shader=mapeopuntosmaster
//  refractando la secuencia de imágenes de fondo y reaccionando en tiempo real
//  a la caída de objetos (copas, botellas, uvas, bichos), punteros LIDAR/touch/mouse,
//  ondas expansivas y celebraciones de fin de partida.
// ============================================================================

class DynamicBackground {
    constructor() {
        this.waves = [];
        this.numWaves = CONFIG.background.waves.count;
        this.ripples = [];
        this.maxRipples = CONFIG.background.ripples.max;

        // Sistema de texturas dinámicas que entran al shader multibuffer
        this.currentTextureIndex = 0;
        this.nextTextureIndex = 1;
        this.transitionProgress = 0;
        this.transitionSpeed = 0.0028; // Transición fluida entre fondos
        this.textureScale = 1.0;
        this.textureRotation = 0;
        this.textureRotationSpeed = 0.0005;

        for (let i = 0; i < this.numWaves; i++) {
            this.waves.push({
                amplitude: random(CONFIG.background.waves.amplitude.min, CONFIG.background.waves.amplitude.max),
                period: random(CONFIG.background.waves.period.min, CONFIG.background.waves.period.max),
                phase: random(TWO_PI),
                speed: random(CONFIG.background.waves.speed.min, CONFIG.background.waves.speed.max)
            });
        }
    }

    addRipple(x, y) {
        this.ripples.push({
            pos: createVector(x, y),
            radius: 0,
            maxRadius: random(CONFIG.background.ripples.radius.min, CONFIG.background.ripples.radius.max),
            speed: random(CONFIG.background.ripples.speed.min, CONFIG.background.ripples.speed.max),
            alpha: 255,
            thickness: random(CONFIG.background.ripples.thickness.min, CONFIG.background.ripples.thickness.max),
            birthTime: millis(),
            lifespan: random(CONFIG.background.ripples.lifespan.min, CONFIG.background.ripples.lifespan.max)
        });

        if (this.ripples.length > this.maxRipples) {
            this.ripples.shift();
        }
    }

    getValidBackgrounds() {
        const list = (typeof window !== 'undefined' && Array.isArray(window.backgroundTextures) && window.backgroundTextures.length > 0)
            ? window.backgroundTextures
            : ((typeof backgroundTextures !== 'undefined' && Array.isArray(backgroundTextures)) ? backgroundTextures : []);
        return list.filter(img => img && typeof img.width === 'number' && img.width > 0);
    }

    update() {
        for (let wave of this.waves) {
            wave.phase += wave.speed;
        }

        const currentTime = millis();
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const ripple = this.ripples[i];
            const lifeProgress = (currentTime - ripple.birthTime) / ripple.lifespan;
            const speedFactor = map(lifeProgress, 0, 1, 1, 0.5);
            ripple.radius += ripple.speed * speedFactor;
            ripple.alpha = map(lifeProgress, 0, 1, 255, 0);
            if (lifeProgress >= 1) {
                this.ripples.splice(i, 1);
            }
        }

        const validBgs = this.getValidBackgrounds();
        if (validBgs.length > 1) {
            this.transitionProgress += this.transitionSpeed;
            if (this.transitionProgress >= 1) {
                this.transitionProgress = 0;
                this.currentTextureIndex = this.nextTextureIndex % validBgs.length;
                this.nextTextureIndex = (this.currentTextureIndex + 1) % validBgs.length;
            }
        } else {
            this.transitionProgress = 0;
            this.currentTextureIndex = 0;
            this.nextTextureIndex = 0;
        }

        if (validBgs.length > 0) {
            this.textureRotation += this.textureRotationSpeed;
        } else {
            this.textureRotation = 0;
        }
    }

    display() {
        this.drawWineCellarBackground();
    }

    drawWineCellarBackground() {
        const validBgs = this.getValidBackgrounds();
        if (!backgroundTexturesLoaded || validBgs.length === 0) {
            noStroke();
            fill(0);
            rect(0, 0, width, height);
            return;
        }
        background(5, 5, 10);
    }

    resize() {}
}

// ============================================================================
//  MOTOR WEBGL MULTIBUFFER PING-PONG (FLOAT FBO) PARA AGUA-NIKOS + MAPEOPUNTOS
// ============================================================================
const WaterMultiBuffer = {
    canvas: null,
    gl: null,
    initialized: false,
    failed: false,
    width: 0,
    height: 0,
    frame: 0,
    quadBuffer: null,
    progBufferA: null,
    progMain: null,
    fboA: null,
    fboB: null,
    fallbackTex: null,
    directBgTextures: [],
    // Seguimiento de posiciones previas para estelas continuas (sdSegment)
    prevPointers: {},
    prevGrapes: new WeakMap(),
    prevBads: new WeakMap(),
    prevMouse: { x: 0, y: 0, initialized: false },

    vertSource: `
        attribute vec2 aPosition;
        varying vec2 vTexCoord;
        void main() {
            vTexCoord = aPosition * 0.5 + 0.5;
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
    `,

    init(w, h, fragBufferASrc, fragMainSrc) {
        try {
            const safeW = Math.max(1, Math.floor(w));
            const safeH = Math.max(1, Math.floor(h));
            this.canvas = document.createElement('canvas');
            this.canvas.width = safeW;
            this.canvas.height = safeH;

            const glOpts = {
                alpha: false,
                depth: false,
                stencil: false,
                antialias: false,
                preserveDrawingBuffer: true
            };
            const gl = this.canvas.getContext('webgl', glOpts) || this.canvas.getContext('experimental-webgl', glOpts);
            if (!gl) {
                console.error('❌ No se pudo crear contexto WebGL dedicado para WaterMultiBuffer');
                this.failed = true;
                return false;
            }

            this.gl = gl;
            this.width = safeW;
            this.height = safeH;
            this.frame = 0;

            // Quad pantalla completa (-1..1)
            this.quadBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                -1, -1,  1, -1, -1,  1,
                -1,  1,  1, -1,  1,  1
            ]), gl.STATIC_DRAW);

            this.progBufferA = this.createProgram(gl, this.vertSource, fragBufferASrc, 'BufferA(feedback.frag)');
            this.progMain    = this.createProgram(gl, this.vertSource, fragMainSrc, 'Main(composite.frag)');

            if (!this.progBufferA || !this.progMain) {
                this.failed = true;
                return false;
            }

            this.createPingPongFBOs(gl, safeW, safeH);
            this.createFallbackTexture(gl);
            this.preloadDirectBackgrounds(gl);
            this.initialized = true;
            console.log('✅ WaterMultiBuffer inicializado (' + safeW + 'x' + safeH + ', FBO type: ' + this.fboTypeLabel + ')');
            return true;
        } catch (err) {
            console.error('Error inicializando WaterMultiBuffer:', err);
            this.failed = true;
            return false;
        }
    },

    preloadDirectBackgrounds(gl) {
        const defaultPaths = [
            'img/background/fondo1.jpg',
            'img/background/fondo2.jpg',
            'img/background/fondo3.jpg',
            'img/background/fondo4.jpg',
            'img/background/fondo5.jpg'
        ];
        this.directBgTextures = [];
        defaultPaths.forEach((src, idx) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                if (!this.gl) return;
                const tex = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                gl.bindTexture(gl.TEXTURE_2D, null);
                this.directBgTextures[idx] = tex;
            };
            img.src = src;
        });
    },

    compileShader(gl, type, src, label) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
            console.error('❌ Error compilando ' + label + ':', gl.getShaderInfoLog(sh));
            gl.deleteShader(sh);
            return null;
        }
        return sh;
    },

    createProgram(gl, vsSrc, fsSrc, label) {
        const vs = this.compileShader(gl, gl.VERTEX_SHADER, vsSrc, label + ' VS');
        const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, fsSrc, label + ' FS');
        if (!vs || !fs) return null;
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            console.error('❌ Error linkeando ' + label + ':', gl.getProgramInfoLog(prog));
            return null;
        }
        prog.aPosition = gl.getAttribLocation(prog, 'aPosition');
        prog.uniforms = {};
        const numUniforms = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; i++) {
            const info = gl.getActiveUniform(prog, i);
            if (!info) continue;
            const baseName = info.name.replace(/\[0\]$/, '');
            prog.uniforms[baseName] = gl.getUniformLocation(prog, baseName);
            prog.uniforms[info.name] = gl.getUniformLocation(prog, info.name);
        }
        return prog;
    },

    createSingleFBO(gl, w, h, texType, filter) {
        while (gl.getError() !== gl.NO_ERROR) {} // Limpiar errores previos
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, texType, null);

        const fb = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

        // Verificar que realmente se pueda limpiar/renderizar sin GL error (en reposo: 0.5, 0.5, 0.0, 1.0)
        let renderOk = (status === gl.FRAMEBUFFER_COMPLETE);
        if (renderOk) {
            gl.viewport(0, 0, w, h);
            gl.clearColor(0.5, 0.5, 0.0, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            if (gl.getError() !== gl.NO_ERROR) {
                renderOk = false;
            }
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);

        if (!renderOk) {
            gl.deleteFramebuffer(fb);
            gl.deleteTexture(tex);
            return null;
        }
        return { framebuffer: fb, texture: tex, width: w, height: h };
    },

    createPingPongFBOs(gl, w, h) {
        if (this.fboA) {
            gl.deleteFramebuffer(this.fboA.framebuffer);
            gl.deleteTexture(this.fboA.texture);
        }
        if (this.fboB) {
            gl.deleteFramebuffer(this.fboB.framebuffer);
            gl.deleteTexture(this.fboB.texture);
        }

        // Habilitar extensiones de renderizado a punto flotante en WebGL 1
        const extFloat = gl.getExtension('OES_texture_float');
        const extFloatLinear = gl.getExtension('OES_texture_float_linear');
        gl.getExtension('WEBGL_color_buffer_float');
        gl.getExtension('EXT_color_buffer_float');
        const extHalf = gl.getExtension('OES_texture_half_float');
        const extHalfLinear = gl.getExtension('OES_texture_half_float_linear');
        gl.getExtension('EXT_color_buffer_half_float');

        let fboA = null, fboB = null;
        if (extFloat) {
            const filter = extFloatLinear ? gl.LINEAR : gl.NEAREST;
            fboA = this.createSingleFBO(gl, w, h, gl.FLOAT, filter);
            fboB = this.createSingleFBO(gl, w, h, gl.FLOAT, filter);
            if (fboA && fboB) this.fboTypeLabel = 'FLOAT';
        }
        if ((!fboA || !fboB) && extHalf) {
            const filter = extHalfLinear ? gl.LINEAR : gl.NEAREST;
            fboA = this.createSingleFBO(gl, w, h, extHalf.HALF_FLOAT_OES, filter);
            fboB = this.createSingleFBO(gl, w, h, extHalf.HALF_FLOAT_OES, filter);
            if (fboA && fboB) this.fboTypeLabel = 'HALF_FLOAT';
        }
        if (!fboA || !fboB) {
            fboA = this.createSingleFBO(gl, w, h, gl.UNSIGNED_BYTE, gl.LINEAR);
            fboB = this.createSingleFBO(gl, w, h, gl.UNSIGNED_BYTE, gl.LINEAR);
            this.fboTypeLabel = 'UNSIGNED_BYTE';
        }

        this.fboA = fboA;
        this.fboB = fboB;
        this.frame = 0;
    },

    createFallbackTexture(gl) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // Piso cálido de viñedo por defecto (1x1)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([90, 35, 55, 255]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        this.fallbackTex = tex;
    },

    getOrUploadImageTexture(gl, p5Img) {
        if (!p5Img || !p5Img.width || !p5Img.height) return this.fallbackTex;
        const srcCanvas = p5Img.canvas || p5Img.elt;
        if (!srcCanvas) return this.fallbackTex;

        if (!p5Img._waterGLTex || p5Img._waterGLCtx !== gl || p5Img._waterGLW !== p5Img.width || p5Img._waterGLH !== p5Img.height) {
            if (p5Img._waterGLTex && p5Img._waterGLCtx === gl) {
                try { gl.deleteTexture(p5Img._waterGLTex); } catch (e) {}
            }
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
            gl.bindTexture(gl.TEXTURE_2D, null);

            p5Img._waterGLTex = tex;
            p5Img._waterGLCtx = gl;
            p5Img._waterGLW = p5Img.width;
            p5Img._waterGLH = p5Img.height;
        }
        return p5Img._waterGLTex;
    },

    set1f(gl, prog, name, val) {
        const loc = prog.uniforms[name];
        if (loc !== undefined && loc !== null) gl.uniform1f(loc, val);
    },
    set1i(gl, prog, name, val) {
        const loc = prog.uniforms[name];
        if (loc !== undefined && loc !== null) gl.uniform1i(loc, val);
    },
    set2f(gl, prog, name, x, y) {
        const loc = prog.uniforms[name];
        if (loc !== undefined && loc !== null) gl.uniform2f(loc, x, y);
    },
    set3f(gl, prog, name, x, y, z) {
        const loc = prog.uniforms[name];
        if (loc !== undefined && loc !== null) gl.uniform3f(loc, x, y, z);
    },
    set1fv(gl, prog, name, arr) {
        const loc = prog.uniforms[name];
        if (loc !== undefined && loc !== null) gl.uniform1fv(loc, new Float32Array(arr));
    },
    set2fv(gl, prog, name, arr) {
        const loc = prog.uniforms[name];
        if (loc !== undefined && loc !== null) gl.uniform2fv(loc, new Float32Array(arr));
    },

    ensureSize(gl, w, h) {
        const safeW = Math.max(1, Math.floor(w));
        const safeH = Math.max(1, Math.floor(h));
        if (this.width !== safeW || this.height !== safeH) {
            this.width = safeW;
            this.height = safeH;
            if (this.canvas) {
                this.canvas.width = safeW;
                this.canvas.height = safeH;
            }
            this.createPingPongFBOs(gl, safeW, safeH);
        }
    }
};

// Recolecta datos en vivo de punteros, objetos cayendo (o del tutorial) y ondas
function collectSceneDataForWater() {
    const W = Math.max(1, width);
    const H = Math.max(1, height);
    const nowSec = (typeof millis === 'function' ? millis() : Date.now()) / 1000.0;

    // 1. Punteros (LIDAR / Touch / Mouse desde PointServer)
    const MAX_POINTERS = 16;
    const pointerPositions = [];
    const pointerPrevPositions = [];
    const pointerActive = [];
    const nextPrevPointers = {};

    const pts = (typeof Pserver !== 'undefined' && Pserver && typeof Pserver.getAllPoints === 'function')
        ? Pserver.getAllPoints()
        : [];

    for (let i = 0; i < MAX_POINTERS; i++) {
        if (i < pts.length && pts[i]) {
            const p = pts[i];
            const id = (p.id !== undefined && p.id !== null) ? ('id_' + p.id) : ('idx_' + i);
            const nx = p.x / W;
            const ny = p.y / H;
            const prev = WaterMultiBuffer.prevPointers[id] || { x: nx, y: ny };
            nextPrevPointers[id] = { x: nx, y: ny };

            pointerPositions.push(nx, ny);
            pointerPrevPositions.push(prev.x, prev.y);
            pointerActive.push(1.0);
        } else {
            pointerPositions.push(0, 0);
            pointerPrevPositions.push(0, 0);
            pointerActive.push(0.0);
        }
    }
    WaterMultiBuffer.prevPointers = nextPrevPointers;

    // Mouse local
    const mx = (typeof mouseX === 'number') ? mouseX : W * 0.5;
    const my = (typeof mouseY === 'number') ? mouseY : H * 0.5;
    if (!WaterMultiBuffer.prevMouse.initialized) {
        WaterMultiBuffer.prevMouse = { x: mx, y: my, initialized: true };
    }
    const prevMx = WaterMultiBuffer.prevMouse.x;
    const prevMy = WaterMultiBuffer.prevMouse.y;
    const mouseMoved = Math.hypot(mx - prevMx, my - prevMy) > 1.5;
    const mouseActive = ((typeof mouseIsPressed !== 'undefined' && mouseIsPressed) || mouseMoved) ? 1.0 : 0.0;
    WaterMultiBuffer.prevMouse.x = mx;
    WaterMultiBuffer.prevMouse.y = my;

    // 2. Objetos buenos y malos cayendo (o pasando en el tutorial)
    const MAX_GRAPES = 10;
    const grapePositions = [];
    const grapePrevPositions = [];
    const grapeProgress = [];
    const grapeActive = [];

    const MAX_BAD = 10;
    const badPositions = [];
    const badPrevPositions = [];
    const badActive = [];

    let grapesSource = (typeof wineGlassSystem !== 'undefined' && wineGlassSystem && Array.isArray(wineGlassSystem.glasses))
        ? wineGlassSystem.glasses
        : [];
    let badsSource = (typeof wineGlassSystem !== 'undefined' && wineGlassSystem && Array.isArray(wineGlassSystem.badItems))
        ? wineGlassSystem.badItems
        : [];

    // Si estamos en la pantalla de tutorial, los objetos pasando también modifican el agua y proyectan su aura
    if (typeof gameState !== 'undefined' && gameState === 'tutorial' &&
        typeof tutorialScreen !== 'undefined' && tutorialScreen && typeof tutorialScreen.getActiveShowcaseItems === 'function') {
        const tutItems = tutorialScreen.getActiveShowcaseItems();
        if (tutItems.good && tutItems.good.length) grapesSource = tutItems.good;
        if (tutItems.bad && tutItems.bad.length) badsSource = tutItems.bad;
    }

    for (let i = 0; i < MAX_GRAPES; i++) {
        if (i < grapesSource.length && grapesSource[i]) {
            const g = grapesSource[i];
            const gx = g.x / W;
            const gy = g.y / H;
            const prev = WaterMultiBuffer.prevGrapes.get(g) || { x: gx, y: gy };
            WaterMultiBuffer.prevGrapes.set(g, { x: gx, y: gy });
            const prog = (g.requiredHoverTime > 0) ? Math.min(1.0, (g.hoverTime || 0) / g.requiredHoverTime) : (g.captureProgress || 0.0);

            grapePositions.push(gx, gy);
            grapePrevPositions.push(prev.x, prev.y);
            grapeProgress.push(prog);
            grapeActive.push(1.0);
        } else {
            grapePositions.push(0, 0);
            grapePrevPositions.push(0, 0);
            grapeProgress.push(0);
            grapeActive.push(0.0);
        }
    }

    for (let i = 0; i < MAX_BAD; i++) {
        if (i < badsSource.length && badsSource[i]) {
            const b = badsSource[i];
            const bx = b.x / W;
            const by = b.y / H;
            const prev = WaterMultiBuffer.prevBads.get(b) || { x: bx, y: by };
            WaterMultiBuffer.prevBads.set(b, { x: bx, y: by });

            badPositions.push(bx, by);
            badPrevPositions.push(prev.x, prev.y);
            badActive.push(1.0);
        } else {
            badPositions.push(0, 0);
            badPrevPositions.push(0, 0);
            badActive.push(0.0);
        }
    }

    // 3. Ondas expansivas
    const MAX_WAVES_LOCAL = (typeof MAX_WAVES !== 'undefined') ? MAX_WAVES : 5;
    const wavePositions = [];
    const waveTimes = [];
    const waveActive = [];
    if (Array.isArray(window.waves)) {
        for (let i = 0; i < MAX_WAVES_LOCAL; i++) {
            if (i < window.waves.length && window.waves[i] && window.waves[i].active) {
                wavePositions.push(window.waves[i].x, window.waves[i].y);
                waveTimes.push(window.waves[i].startTime);
                waveActive.push(1.0);
            } else {
                wavePositions.push(0, 0);
                waveTimes.push(0);
                waveActive.push(0.0);
            }
        }
    } else {
        for (let i = 0; i < MAX_WAVES_LOCAL; i++) {
            wavePositions.push(0, 0);
            waveTimes.push(0);
            waveActive.push(0.0);
        }
    }

    // 4. Combo y viñeta
    let comboLevel = 0.0;
    if (typeof gameState !== 'undefined' && gameState === 'standby') {
        comboLevel = 0.12 + 0.08 * Math.sin(nowSec * 1.6);
    } else {
        const sc = (typeof scoreSystem !== 'undefined' && scoreSystem) ? scoreSystem : null;
        const winThresh = (typeof CONFIG !== 'undefined' && CONFIG.score && CONFIG.score.winComboThreshold) ? CONFIG.score.winComboThreshold : 20;
        const cc = sc && sc.comboCount ? sc.comboCount : 0;
        comboLevel = Math.min(1.0, cc / winThresh);
    }

    if (typeof scoreSystem !== 'undefined' && scoreSystem) {
        const lives = scoreSystem.lives !== undefined ? scoreSystem.lives : 3;
        window.vignetteIntensity = Math.max(0, Math.min(1, (3 - lives) / 3));
    }

    return {
        W, H, nowSec,
        pointerPositions, pointerPrevPositions, pointerActive,
        mx, my, prevMx, prevMy, mouseActive,
        grapePositions, grapePrevPositions, grapeProgress, grapeActive,
        badPositions, badPrevPositions, badActive,
        wavePositions, waveTimes, waveActive,
        comboLevel
    };
}

function processShaders() {
    if (typeof feedbackBuffer === 'undefined' || !feedbackBuffer) return;

    // Actualizar animación de fondo y partículas
    if (typeof dynamicBackground !== 'undefined' && dynamicBackground) {
        dynamicBackground.update();
    }
    if (typeof particulasBuffer !== 'undefined' && typeof particleSystem !== 'undefined' && particleSystem) {
        particulasBuffer.clear();
        particleSystem.update();
        particleSystem.display(particulasBuffer);
    }

    if (typeof window !== 'undefined' && window.hideBackground) {
        return;
    }

    // Inicializar WaterMultiBuffer en su propio canvas WebGL aislado con el código de feedback.frag y composite.frag
    if (!WaterMultiBuffer.initialized && !WaterMultiBuffer.failed) {
        const fragA = (typeof feedbackShader !== 'undefined' && feedbackShader && feedbackShader._fragSrc) ? feedbackShader._fragSrc : null;
        const fragMain = (typeof compositeShader !== 'undefined' && compositeShader && compositeShader._fragSrc) ? compositeShader._fragSrc : null;
        if (!fragA || !fragMain) return;
        WaterMultiBuffer.init(feedbackBuffer.width, feedbackBuffer.height, fragA, fragMain);
    }
    if (!WaterMultiBuffer.initialized || WaterMultiBuffer.failed) return;

    const gl = WaterMultiBuffer.gl;
    if (!gl) return;

    WaterMultiBuffer.ensureSize(gl, feedbackBuffer.width, feedbackBuffer.height);

    const scene = collectSceneDataForWater();
    window._waterSceneCache = scene;

    // ===== PASE 1 (BUFFER A): SIMULACIÓN DEL CAMPO DE AGUA =====
    const prog = WaterMultiBuffer.progBufferA;
    const readFBO = WaterMultiBuffer.fboA;
    const writeFBO = WaterMultiBuffer.fboB;

    gl.bindFramebuffer(gl.FRAMEBUFFER, writeFBO.framebuffer);
    gl.viewport(0, 0, writeFBO.width, writeFBO.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    gl.useProgram(prog);

    // Textura del estado anterior del campo (Buffer A -> self)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readFBO.texture);
    WaterMultiBuffer.set1i(gl, prog, 'u_feedbackTexture', 0);

    WaterMultiBuffer.set2f(gl, prog, 'u_resolution', writeFBO.width, writeFBO.height);
    WaterMultiBuffer.set2f(gl, prog, 'u_mouse', scene.mx, scene.my);
    WaterMultiBuffer.set2f(gl, prog, 'u_mousePrev', scene.prevMx, scene.prevMy);
    WaterMultiBuffer.set1f(gl, prog, 'u_mouseActive', scene.mouseActive);
    WaterMultiBuffer.set1f(gl, prog, 'u_time', scene.nowSec);
    WaterMultiBuffer.set1i(gl, prog, 'u_frame', WaterMultiBuffer.frame);

    // Parámetros físicos del agua (expuestos globalmente para control desde localhost:4353 / panel)
    const wp = (typeof window !== 'undefined' && window.getWaterParams)
        ? window.getWaterParams()
        : {
            paso: 0.38,
            oleaje: 0.42,
            amortiguar: 0.64,
            fuerza: 0.95,
            empuje: 0.95,
            radio: 0.52,
            objWakeSize: 0.52,
            objWakeStrength: 0.90
        };

    WaterMultiBuffer.set1f(gl, prog, 'u_paso', wp.paso);
    WaterMultiBuffer.set1f(gl, prog, 'u_oleaje', wp.oleaje);
    WaterMultiBuffer.set1f(gl, prog, 'u_amortiguar', wp.amortiguar);
    WaterMultiBuffer.set1f(gl, prog, 'u_fuerza', wp.fuerza);
    WaterMultiBuffer.set1f(gl, prog, 'u_empuje', wp.empuje);
    WaterMultiBuffer.set1f(gl, prog, 'u_radio', wp.radio);
    WaterMultiBuffer.set1f(gl, prog, 'u_objWakeSize', wp.objWakeSize);
    WaterMultiBuffer.set1f(gl, prog, 'u_objWakeStrength', wp.objWakeStrength);

    WaterMultiBuffer.set1f(gl, prog, 'u_cursorHaloSize', (typeof window !== 'undefined' && window.cursorHaloSize !== undefined) ? window.cursorHaloSize : 0.08);
    WaterMultiBuffer.set1f(gl, prog, 'u_cursorHaloStrength', (typeof window !== 'undefined' && window.cursorHaloStrength !== undefined) ? window.cursorHaloStrength : 1.0);

    // Punteros mapeopuntosmaster
    WaterMultiBuffer.set2fv(gl, prog, 'u_pointerPositions', scene.pointerPositions);
    WaterMultiBuffer.set2fv(gl, prog, 'u_pointerPrevPositions', scene.pointerPrevPositions);
    WaterMultiBuffer.set1fv(gl, prog, 'u_pointerActive', scene.pointerActive);

    // Objetos cayendo (copas/uvas y bichos)
    WaterMultiBuffer.set2fv(gl, prog, 'u_grapePositions', scene.grapePositions);
    WaterMultiBuffer.set2fv(gl, prog, 'u_grapePrevPositions', scene.grapePrevPositions);
    WaterMultiBuffer.set1fv(gl, prog, 'u_grapeProgress', scene.grapeProgress);
    WaterMultiBuffer.set1fv(gl, prog, 'u_grapeActive', scene.grapeActive);

    WaterMultiBuffer.set2fv(gl, prog, 'u_badPositions', scene.badPositions);
    WaterMultiBuffer.set2fv(gl, prog, 'u_badPrevPositions', scene.badPrevPositions);
    WaterMultiBuffer.set1fv(gl, prog, 'u_badActive', scene.badActive);

    // Ondas expansivas
    WaterMultiBuffer.set2fv(gl, prog, 'u_wavePositions', scene.wavePositions);
    WaterMultiBuffer.set1fv(gl, prog, 'u_waveTimes', scene.waveTimes);
    WaterMultiBuffer.set1fv(gl, prog, 'u_waveActive', scene.waveActive);
    WaterMultiBuffer.set1f(gl, prog, 'u_waveSpeed', (typeof window !== 'undefined' && window.waveSpeed !== undefined) ? window.waveSpeed : 0.5);
    WaterMultiBuffer.set1f(gl, prog, 'u_waveForce', (typeof window !== 'undefined' && window.waveForce !== undefined) ? window.waveForce : 0.09);
    WaterMultiBuffer.set1f(gl, prog, 'u_waveDuration', (typeof window !== 'undefined' && window.waveDuration !== undefined) ? window.waveDuration : 2.0);

    // Onda de evento
    const er = (typeof window !== 'undefined' && window.eventRipple) ? window.eventRipple : null;
    if (er && er.active) {
        WaterMultiBuffer.set1f(gl, prog, 'u_eventActive', 1.0);
        WaterMultiBuffer.set2f(gl, prog, 'u_eventCenter', er.x, er.y);
        WaterMultiBuffer.set1f(gl, prog, 'u_eventStartTime', er.startTime);
        WaterMultiBuffer.set1f(gl, prog, 'u_eventStrength', er.strength || 1.0);
    } else {
        WaterMultiBuffer.set1f(gl, prog, 'u_eventActive', 0.0);
        WaterMultiBuffer.set2f(gl, prog, 'u_eventCenter', 0.5, 0.5);
        WaterMultiBuffer.set1f(gl, prog, 'u_eventStartTime', 0.0);
        WaterMultiBuffer.set1f(gl, prog, 'u_eventStrength', 0.0);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, WaterMultiBuffer.quadBuffer);
    gl.enableVertexAttribArray(prog.aPosition);
    gl.vertexAttribPointer(prog.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Swap ping-pong: ahora fboA contiene el nuevo estado del campo de agua
    WaterMultiBuffer.fboA = writeFBO;
    WaterMultiBuffer.fboB = readFBO;
    WaterMultiBuffer.frame++;
}

function renderShaders() {
    if (typeof feedbackBuffer === 'undefined' || !feedbackBuffer) return;

    if (typeof window !== 'undefined' && window.hideBackground) {
        feedbackBuffer.clear();
        feedbackBuffer.background(0);
        return;
    }

    if (!WaterMultiBuffer.initialized || WaterMultiBuffer.failed || !WaterMultiBuffer.gl) return;

    const gl = WaterMultiBuffer.gl;
    const scene = window._waterSceneCache || collectSceneDataForWater();
    const prog = WaterMultiBuffer.progMain;

    // Seleccionar las dos imágenes de fondo actuales (con respaldo directo si p5 aún está cargando)
    const validBgs = (typeof dynamicBackground !== 'undefined' && dynamicBackground)
        ? dynamicBackground.getValidBackgrounds()
        : [];
    const directBgs = (WaterMultiBuffer.directBgTextures || []).filter(Boolean);
    const len = validBgs.length > 0 ? validBgs.length : directBgs.length;
    const idx1 = (len > 0 && dynamicBackground) ? (dynamicBackground.currentTextureIndex % len) : 0;
    const idx2 = (len > 1 && dynamicBackground) ? (dynamicBackground.nextTextureIndex % len) : idx1;
    const blend = (len > 1 && dynamicBackground) ? (dynamicBackground.transitionProgress || 0.0) : 0.0;

    let glTex1 = WaterMultiBuffer.fallbackTex;
    let glTex2 = WaterMultiBuffer.fallbackTex;
    if (validBgs.length > 0) {
        glTex1 = WaterMultiBuffer.getOrUploadImageTexture(gl, validBgs[idx1]);
        glTex2 = WaterMultiBuffer.getOrUploadImageTexture(gl, validBgs[idx2]);
    } else if (directBgs.length > 0) {
        glTex1 = directBgs[idx1] || WaterMultiBuffer.fallbackTex;
        glTex2 = directBgs[idx2] || glTex1;
    }

    // ===== PASE 2 (OUTPUT): REFRACCIÓN DE AGUA + FONDOS + HALOS + PUNTOS =====
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, WaterMultiBuffer.width, WaterMultiBuffer.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    gl.useProgram(prog);

    // Unidad 0: Buffer A (Campo de agua en float)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, WaterMultiBuffer.fboA.texture);
    WaterMultiBuffer.set1i(gl, prog, 'u_feedbackTexture', 0);

    // Unidad 1: Imagen de fondo 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, glTex1);
    WaterMultiBuffer.set1i(gl, prog, 'u_backgroundTexture1', 1);

    // Unidad 2: Imagen de fondo 2
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, glTex2);
    WaterMultiBuffer.set1i(gl, prog, 'u_backgroundTexture2', 2);

    WaterMultiBuffer.set1f(gl, prog, 'u_backgroundBlend', blend);
    WaterMultiBuffer.set1f(gl, prog, 'u_backgroundRotation', dynamicBackground ? dynamicBackground.textureRotation : 0.0);
    WaterMultiBuffer.set2f(gl, prog, 'u_resolution', feedbackBuffer.width, feedbackBuffer.height);
    WaterMultiBuffer.set1f(gl, prog, 'u_time', scene.nowSec);
    WaterMultiBuffer.set1f(gl, prog, 'u_comboLevel', scene.comboLevel);

    // Parámetros ópticos del agua (expuestos globalmente para control desde localhost:4353 / panel)
    const wp = (typeof window !== 'undefined' && window.getWaterParams)
        ? window.getWaterParams()
        : {
            refraccion: 0.48,
            relieve: 0.58,
            profundidad: 0.48,
            especular: 0.58,
            brillo: 0.62,
            causticas: 0.38,
            espuma: 0.45,
            focoX: 0.52,
            focoY: 0.74,
            aguaColor: [0.96, 0.95, 1.0]
        };

    WaterMultiBuffer.set1f(gl, prog, 'u_refraccion', wp.refraccion);
    WaterMultiBuffer.set1f(gl, prog, 'u_relieve', wp.relieve);
    WaterMultiBuffer.set1f(gl, prog, 'u_profundidad', wp.profundidad);
    WaterMultiBuffer.set1f(gl, prog, 'u_especular', wp.especular);
    WaterMultiBuffer.set1f(gl, prog, 'u_brillo', wp.brillo);
    WaterMultiBuffer.set1f(gl, prog, 'u_causticas', wp.causticas);
    WaterMultiBuffer.set1f(gl, prog, 'u_espuma', wp.espuma);
    WaterMultiBuffer.set2f(gl, prog, 'u_foco', wp.focoX, wp.focoY);
    WaterMultiBuffer.set3f(gl, prog, 'u_agua', wp.aguaColor[0], wp.aguaColor[1], wp.aguaColor[2]);

    // Ondas expansivas
    WaterMultiBuffer.set2fv(gl, prog, 'u_wavePositions', scene.wavePositions);
    WaterMultiBuffer.set1fv(gl, prog, 'u_waveTimes', scene.waveTimes);
    WaterMultiBuffer.set1fv(gl, prog, 'u_waveActive', scene.waveActive);
    WaterMultiBuffer.set1f(gl, prog, 'u_waveSpeed', (typeof window !== 'undefined' && window.waveSpeed !== undefined) ? window.waveSpeed : 0.5);
    WaterMultiBuffer.set1f(gl, prog, 'u_waveForce', (typeof window !== 'undefined' && window.waveForce !== undefined) ? window.waveForce : 0.09);
    WaterMultiBuffer.set1f(gl, prog, 'u_waveDuration', (typeof window !== 'undefined' && window.waveDuration !== undefined) ? window.waveDuration : 2.0);

    // Objetos cayendo
    WaterMultiBuffer.set2fv(gl, prog, 'u_grapePositions', scene.grapePositions);
    WaterMultiBuffer.set1fv(gl, prog, 'u_grapeProgress', scene.grapeProgress);
    WaterMultiBuffer.set1fv(gl, prog, 'u_grapeActive', scene.grapeActive);

    WaterMultiBuffer.set2fv(gl, prog, 'u_badPositions', scene.badPositions);
    WaterMultiBuffer.set1fv(gl, prog, 'u_badActive', scene.badActive);

    // Punteros mapeopuntosmaster
    WaterMultiBuffer.set2fv(gl, prog, 'u_pointerPositions', scene.pointerPositions);
    WaterMultiBuffer.set2fv(gl, prog, 'u_pointerPrevPositions', scene.pointerPrevPositions);
    WaterMultiBuffer.set1fv(gl, prog, 'u_pointerActive', scene.pointerActive);
    WaterMultiBuffer.set2f(gl, prog, 'u_mouse', scene.mx, scene.my);
    WaterMultiBuffer.set2f(gl, prog, 'u_mousePrev', scene.prevMx, scene.prevMy);
    WaterMultiBuffer.set1f(gl, prog, 'u_mouseActive', scene.mouseActive);
    WaterMultiBuffer.set1f(gl, prog, 'u_cursorHaloSize', (typeof window !== 'undefined' && window.cursorHaloSize !== undefined) ? window.cursorHaloSize : 0.08);
    WaterMultiBuffer.set1f(gl, prog, 'u_cursorHaloStrength', (typeof window !== 'undefined' && window.cursorHaloStrength !== undefined) ? window.cursorHaloStrength : 1.0);

    // Halos configurables desde el panel
    const goodHalo = (typeof window !== 'undefined' && window.getGoodHaloSettings)
        ? window.getGoodHaloSettings()
        : { size: 0.12, strength: 0.35, color: [1.0, 0.85, 0.2] };
    const badHalo = (typeof window !== 'undefined' && window.getBadHaloSettings)
        ? window.getBadHaloSettings()
        : { size: 0.14, strength: 0.27, color: [1.0, 0.2, 0.2] };

    WaterMultiBuffer.set1f(gl, prog, 'u_goodHaloSize', goodHalo.size);
    WaterMultiBuffer.set1f(gl, prog, 'u_goodHaloStrength', goodHalo.strength);
    WaterMultiBuffer.set3f(gl, prog, 'u_goodHaloColor', goodHalo.color[0], goodHalo.color[1], goodHalo.color[2]);
    WaterMultiBuffer.set1f(gl, prog, 'u_badHaloSize', badHalo.size);
    WaterMultiBuffer.set1f(gl, prog, 'u_badHaloStrength', badHalo.strength);
    WaterMultiBuffer.set3f(gl, prog, 'u_badHaloColor', badHalo.color[0], badHalo.color[1], badHalo.color[2]);

    // Brillo del fondo y viñeta
    WaterMultiBuffer.set1f(gl, prog, 'u_backgroundBrightness', (typeof window !== 'undefined' && window.backgroundBrightness !== undefined) ? window.backgroundBrightness : 1.0);
    WaterMultiBuffer.set1f(gl, prog, 'u_vignetteIntensity', (typeof window !== 'undefined' && window.vignetteIntensity !== undefined) ? window.vignetteIntensity : 0.0);

    // Línea divisoria en modo competitivo
    const splitEnabled = (typeof gameMode !== 'undefined' && gameMode === 'competitive' && typeof gameState !== 'undefined' && gameState === 'playing') ? 1.0 : 0.0;
    WaterMultiBuffer.set1f(gl, prog, 'u_splitLineEnabled', splitEnabled);
    WaterMultiBuffer.set3f(gl, prog, 'u_splitLineColor', 1.0, 0.92, 0.68);
    WaterMultiBuffer.set1f(gl, prog, 'u_splitLineThickness', 0.0015);
    WaterMultiBuffer.set1f(gl, prog, 'u_splitLineSoftness', 0.002);

    // Onda de evento
    const er = (typeof window !== 'undefined' && window.eventRipple) ? window.eventRipple : null;
    if (er && er.active) {
        const ec = er.color || [1.0, 0.85, 0.2];
        WaterMultiBuffer.set1f(gl, prog, 'u_eventActive', 1.0);
        WaterMultiBuffer.set2f(gl, prog, 'u_eventCenter', er.x, er.y);
        WaterMultiBuffer.set1f(gl, prog, 'u_eventStartTime', er.startTime);
        WaterMultiBuffer.set3f(gl, prog, 'u_eventColor', ec[0], ec[1], ec[2]);
        WaterMultiBuffer.set1f(gl, prog, 'u_eventStrength', er.strength || 1.0);
    } else {
        WaterMultiBuffer.set1f(gl, prog, 'u_eventActive', 0.0);
        WaterMultiBuffer.set2f(gl, prog, 'u_eventCenter', 0.5, 0.5);
        WaterMultiBuffer.set1f(gl, prog, 'u_eventStartTime', 0.0);
        WaterMultiBuffer.set3f(gl, prog, 'u_eventColor', 1.0, 0.85, 0.2);
        WaterMultiBuffer.set1f(gl, prog, 'u_eventStrength', 0.0);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, WaterMultiBuffer.quadBuffer);
    gl.enableVertexAttribArray(prog.aPosition);
    gl.vertexAttribPointer(prog.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Copiar el canvas WebGL aislado al feedbackBuffer 2D de p5 para que image(feedbackBuffer, 0, 0) lo dibuje siempre
    const ctx2d = feedbackBuffer.drawingContext;
    if (ctx2d && typeof ctx2d.drawImage === 'function' && WaterMultiBuffer.canvas) {
        ctx2d.drawImage(WaterMultiBuffer.canvas, 0, 0, feedbackBuffer.width, feedbackBuffer.height);
    }
}

if (typeof window !== 'undefined') {
    window.waterShaderParams = window.waterShaderParams || {
        // Física de propagación e inyección (Buffer A)
        paso: 0.38,
        oleaje: 0.42,
        amortiguar: 0.64,
        fuerza: 0.95,
        empuje: 0.95,
        radio: 0.52,
        objWakeSize: 0.52,
        objWakeStrength: 0.90,
        // Óptica y refracción (Output)
        refraccion: 0.48,
        relieve: 0.58,
        profundidad: 0.48,
        especular: 0.58,
        brillo: 0.62,
        causticas: 0.38,
        espuma: 0.45,
        focoX: 0.52,
        focoY: 0.74,
        aguaColorHex: '#f5f2ff',
        aguaColor: [0.96, 0.95, 1.0]
    };

    window.getWaterParams = function () {
        return window.waterShaderParams;
    };

    window.setWaterParam = function (key, value) {
        if (!window.waterShaderParams) return;
        const cleanKey = String(key).replace(/^u_/, '');
        if (cleanKey === 'aguaColorHex' && typeof value === 'string') {
            window.waterShaderParams.aguaColorHex = value;
            const h = value.replace('#', '');
            if (h.length === 6) {
                window.waterShaderParams.aguaColor = [
                    parseInt(h.substring(0, 2), 16) / 255.0,
                    parseInt(h.substring(2, 4), 16) / 255.0,
                    parseInt(h.substring(4, 6), 16) / 255.0
                ];
            }
            return;
        }
        const num = parseFloat(value);
        if (!isNaN(num) && cleanKey in window.waterShaderParams) {
            window.waterShaderParams[cleanKey] = num;
        }
    };

    // Sincronizar uniforms en vivo desde un shader publicado en JPShaderEditor (ej: solo-agua o vinogame-agua)
    window.syncWaterFromJPShaderEditor = async function (shaderName = 'solo-agua') {
        const url = `https://vps-4455523-x.dattaweb.com/jpshadereditor/api/include/plan?shader=${encodeURIComponent(shaderName)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data || !data.ok || !Array.isArray(data.passes)) {
            throw new Error('Plan inválido recibido desde JPShaderEditor');
        }
        data.passes.forEach(pass => {
            if (!Array.isArray(pass.uniforms)) return;
            pass.uniforms.forEach(u => {
                if (!u || !u.name) return;
                const clean = u.name.replace(/^u_/, '');
                if (typeof u.default === 'number' && clean in window.waterShaderParams) {
                    window.waterShaderParams[clean] = u.default;
                }
            });
        });
        if (window.controlPanel && typeof window.controlPanel.syncWaterSlidersFromParams === 'function') {
            window.controlPanel.syncWaterSlidersFromParams();
        }
        return window.waterShaderParams;
    };

    // Escuchar mensajes postMessage (para integración externa o JPShaderEditor)
    window.addEventListener('message', (ev) => {
        if (!ev || !ev.data || typeof ev.data !== 'object') return;
        if (ev.data.type === 'jpshader:uniform' || ev.data.type === 'vinogame:waterParam') {
            window.setWaterParam(ev.data.name || ev.data.key, ev.data.value);
            if (window.controlPanel && typeof window.controlPanel.syncWaterSlidersFromParams === 'function') {
                window.controlPanel.syncWaterSlidersFromParams();
            }
        }
    });

    window.processShaders = processShaders;
    window.renderShaders = renderShaders;
    window.DynamicBackground = DynamicBackground;
    window.WaterMultiBuffer = WaterMultiBuffer;
}
