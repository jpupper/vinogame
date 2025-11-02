class DynamicBackground {
    constructor() {
        this.waves = [];
        this.numWaves = CONFIG.background.waves.count;
        this.ripples = [];
        this.maxRipples = CONFIG.background.ripples.max;
        
        // Sistema de texturas dinámicas
        this.currentTextureIndex = 0;
        this.nextTextureIndex = 1;
        this.transitionProgress = 0;
        this.transitionSpeed = 0.003; // Velocidad de transición
        this.textureScale = 1.0;
        this.textureRotation = 0;
        this.textureRotationSpeed = 0.0005;
        
        // Crear ondas base
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
        // Añadir una nueva onda expansiva con parámetros de configuración
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
        
        // Limitar la cantidad de ondas
        if (this.ripples.length > this.maxRipples) {
            this.ripples.shift();
        }
    }
    
    update() {
        // Actualizar ondas base
        for (let wave of this.waves) {
            wave.phase += wave.speed;
        }
        
        // Actualizar ondas expansivas con desvanecimiento más suave
        const currentTime = millis();
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const ripple = this.ripples[i];
            
            // Calcular progreso de vida
            const lifeProgress = (currentTime - ripple.birthTime) / ripple.lifespan;
            
            // Actualizar radio con velocidad que disminuye con el tiempo
            const speedFactor = map(lifeProgress, 0, 1, 1, 0.5);
            ripple.radius += ripple.speed * speedFactor;
            
            // Calcular alpha basado en el tiempo de vida y no solo en el radio
            ripple.alpha = map(lifeProgress, 0, 1, 255, 0);
            
            // Eliminar ondas que han completado su ciclo de vida
            if (lifeProgress >= 1) {
                this.ripples.splice(i, 1);
            }
        }
        
        // Actualizar transición de texturas con protección de arrays vacíos
        if (backgroundTextures && backgroundTextures.length > 1) {
            this.transitionProgress += this.transitionSpeed;
            if (this.transitionProgress >= 1) {
                this.transitionProgress = 0;
                this.currentTextureIndex = this.nextTextureIndex;
                this.nextTextureIndex = (this.nextTextureIndex + 1) % backgroundTextures.length;
            }
        } else {
            // Sin texturas o con una sola, fijar índices y progreso
            this.transitionProgress = 0;
            this.currentTextureIndex = 0;
            this.nextTextureIndex = 0;
        }
        
        // Actualizar rotación de textura (solo si hay texturas)
        if (backgroundTextures && backgroundTextures.length > 0) {
            this.textureRotation += this.textureRotationSpeed;
        } else {
            this.textureRotation = 0;
        }
    }
    
    
    display() {
        // Dibujar fondo base con textura dinámica
        this.drawWineCellarBackground();
        
        // Dibujar ondas expansivas con efecto más suave
        for (let ripple of this.ripples) {
            // Dibujar múltiples anillos con diferentes opacidades para un efecto más suave
            for (let i = 0; i < 3; i++) {
                const ringAlpha = ripple.alpha * (0.5 - i * 0.15);
                const ringOffset = i * 5;
                
                // Usar rellenos en lugar de strokes para evitar contornos
                noStroke();
                fill(CONFIG.background.ripples.color[0], 
                     CONFIG.background.ripples.color[1], 
                     CONFIG.background.ripples.color[2], 
                     ringAlpha);
                ellipse(ripple.pos.x, ripple.pos.y, (ripple.radius - ringOffset) * 2);
            }
            
            // Añadir un brillo central que permanece más tiempo
            const centerAlpha = map(ripple.radius, 0, ripple.maxRadius * 0.2, 100, 0);
            if (centerAlpha > 0) {
                noStroke();
                fill(150, 200, 255, centerAlpha);
                ellipse(ripple.pos.x, ripple.pos.y, 10, 10);
            }
        }
    }
    
    drawWineCellarBackground() {
        // Fondo negro si no hay texturas
        if (!backgroundTexturesLoaded || backgroundTextures.length === 0) {
            noStroke();
            fill(0);
            rect(0, 0, width, height);
            return;
        }
        
        // Fondo base oscuro
        background(5, 5, 10);
        
        // Dibujar textura dinámica con transición suave
        if (backgroundTexturesLoaded && backgroundTextures.length > 0) {
            push();
            imageMode(CENTER);
            translate(width / 2, height / 2);
            rotate(this.textureRotation);
            
            // Textura actual
            tint(255, 255, 255, 70 * (1 - this.transitionProgress));
            const currentScaled = window.getScaledBackgroundImage && window.getScaledBackgroundImage(this.currentTextureIndex);
            if (currentScaled) {
                image(currentScaled, 0, 0);
            } else {
                const img = backgroundTextures[this.currentTextureIndex];
                if (img && img.width && img.height) {
                    push();
                    const sx = (width * 1.2) / img.width;
                    const sy = (height * 1.2) / img.height;
                    scale(sx, sy);
                    image(img, 0, 0);
                    pop();
                }
            }
            
            // Textura siguiente (fade in)
            tint(255, 255, 255, 70 * this.transitionProgress);
            const nextScaled = window.getScaledBackgroundImage && window.getScaledBackgroundImage(this.nextTextureIndex);
            if (nextScaled) {
                image(nextScaled, 0, 0);
            } else {
                const img2 = backgroundTextures[this.nextTextureIndex];
                if (img2 && img2.width && img2.height) {
                    push();
                    const sx2 = (width * 1.2) / img2.width;
                    const sy2 = (height * 1.2) / img2.height;
                    scale(sx2, sy2);
                    image(img2, 0, 0);
                    pop();
                }
            }
            
            pop();
        }
    }
    
    resize() {
        // Ya no necesitamos actualizar la grilla
    }
}

// ====== Pipeline de shaders centralizado ======
// Mueve el procesamiento de feedback y la composición a funciones reutilizables
// para ser llamadas desde sketch.js

function processShaders() {
  // Protección: requerimos buffers y shaders
  if (typeof fondoBuffer === 'undefined' || typeof feedbackShader === 'undefined') return;

  // Actualizar animación de fondo
  if (typeof dynamicBackground !== 'undefined' && dynamicBackground) {
    dynamicBackground.update();
  }

  // Calcular comboLevel (standby usa pulso suave)
  let comboLevel;
  if (typeof gameState !== 'undefined' && gameState === 'standby') {
    comboLevel = 0.12 + 0.08 * Math.sin((typeof millis === 'function' ? millis() : Date.now()) / 1000.0 * 1.6);
  } else {
    const sc = (typeof scoreSystem !== 'undefined' && scoreSystem) ? scoreSystem : null;
    const winThresh = (typeof CONFIG !== 'undefined' && CONFIG.score && CONFIG.score.winComboThreshold) ? CONFIG.score.winComboThreshold : 20;
    const cc = sc && sc.comboCount ? sc.comboCount : 0;
    comboLevel = Math.min(1.0, cc / winThresh);
  }

  // Vignette por vidas
  if (typeof scoreSystem !== 'undefined' && scoreSystem) {
    const lives = scoreSystem.lives || 3;
    if (typeof map === 'function') {
      window.vignetteIntensity = map(lives, 3, 0, 0, 1, true);
    } else {
      window.vignetteIntensity = Math.max(0, Math.min(1, (3 - lives) / 3));
    }
  }

  // ===== PASO 1: SHADER DE FEEDBACK =====
  fondoBuffer.push();
  fondoBuffer.shader(feedbackShader);

  // Pasar las texturas de fondo al feedback shader
  if (typeof backgroundTexturesLoaded !== 'undefined' && backgroundTexturesLoaded && Array.isArray(backgroundTextures) && backgroundTextures.length > 0) {
    const safeIndex = (dynamicBackground && dynamicBackground.currentTextureIndex < backgroundTextures.length) ? dynamicBackground.currentTextureIndex : 0;
    feedbackShader.setUniform('u_texture', backgroundTextures[safeIndex]);
  }

  feedbackShader.setUniform('u_feedbackTexture', fondoBuffer);
  if (typeof particulasBuffer !== 'undefined') feedbackShader.setUniform('u_particlesTexture', particulasBuffer);
  if (typeof juegoBuffer !== 'undefined') feedbackShader.setUniform('u_gameTexture', juegoBuffer);
  feedbackShader.setUniform('u_resolution', [width, height]);
  feedbackShader.setUniform('u_mouse', [mouseX, mouseY]);
  feedbackShader.setUniform('u_time', (typeof millis === 'function' ? millis() : Date.now()) / 1000.0);
  feedbackShader.setUniform('u_effectIntensity', (typeof effectIntensity !== 'undefined' ? effectIntensity : 0));
  feedbackShader.setUniform('u_comboLevel', comboLevel);
  feedbackShader.setUniform('u_vignetteIntensity', (typeof vignetteIntensity !== 'undefined' ? vignetteIntensity : 0));

  // Punteros (mouse/touch/LIDAR)
  const MAX_POINTERS = 16;
  let pointerPositions = [];
  let pointerActive = [];
  if (typeof Pserver !== 'undefined' && Pserver && typeof Pserver.getAllPoints === 'function') {
    const pts = Pserver.getAllPoints();
    for (let i = 0; i < MAX_POINTERS; i++) {
      if (i < pts.length) {
        pointerPositions.push(pts[i].x / width, pts[i].y / height);
        pointerActive.push(1.0);
      } else {
        pointerPositions.push(0, 0);
        pointerActive.push(0.0);
      }
    }
  } else {
    for (let i = 0; i < MAX_POINTERS; i++) { pointerPositions.push(0, 0); pointerActive.push(0.0); }
  }
  feedbackShader.setUniform('u_pointerPositions', pointerPositions);
  feedbackShader.setUniform('u_pointerActive', pointerActive);

  // Ondas expansivas
  const MAX_WAVES_LOCAL = (typeof MAX_WAVES !== 'undefined') ? MAX_WAVES : 5;
  let wavePositions = [];
  let waveTimes = [];
  let waveActive = [];
  if (Array.isArray(window.waves)) {
    for (let i = 0; i < MAX_WAVES_LOCAL; i++) {
      if (i < window.waves.length && window.waves[i].active) {
        wavePositions.push(window.waves[i].x, window.waves[i].y);
        waveTimes.push(window.waves[i].startTime);
        waveActive.push(1.0);
      } else {
        wavePositions.push(0, 0);
        waveTimes.push(0);
        waveActive.push(0.0);
      }
    }
  }
  window._wavePositions = wavePositions;
  window._waveTimes = waveTimes;
  window._waveActive = waveActive;
  feedbackShader.setUniform('u_wavePositions', wavePositions);
  feedbackShader.setUniform('u_waveTimes', waveTimes);
  feedbackShader.setUniform('u_waveActive', waveActive);

  fondoBuffer.rect(0, 0, width, height);
  fondoBuffer.pop();

  // ===== BUFFER DE PARTÍCULAS =====
  if (typeof particulasBuffer !== 'undefined' && typeof particleSystem !== 'undefined' && particleSystem) {
    particulasBuffer.clear();
    particleSystem.update();
    particleSystem.display(particulasBuffer);
  }
}

function renderShaders() {
  if (typeof feedbackBuffer === 'undefined' || typeof compositeShader === 'undefined') return;
  if (!backgroundTexturesLoaded) return;

  const len = Array.isArray(backgroundTextures) ? backgroundTextures.length : 0;
  const isImgReady = (img) => !!(img && typeof img.width === 'number' && img.width > 0);
  if (len > 0 && (typeof assetsReady === 'undefined' || assetsReady)) {
    feedbackBuffer.shader(compositeShader);
    const idx1 = (dynamicBackground && dynamicBackground.currentTextureIndex < len) ? dynamicBackground.currentTextureIndex : 0;
    const idx2 = (dynamicBackground && dynamicBackground.nextTextureIndex < len) ? dynamicBackground.nextTextureIndex : idx1;
    const tex1 = backgroundTextures[idx1] || null;
    const tex2 = backgroundTextures[idx2] || tex1;
    if (!isImgReady(tex1) || !isImgReady(tex2)) {
      feedbackBuffer.clear();
      feedbackBuffer.push();
      feedbackBuffer.noStroke();
      feedbackBuffer.fill(0);
      feedbackBuffer.rect(0, 0, width, height);
      feedbackBuffer.pop();
    } else {
      const blend = (len > 1 && dynamicBackground) ? (dynamicBackground.transitionProgress || 0.0) : 0.0;
      compositeShader.setUniform('u_backgroundTexture1', tex1);
      compositeShader.setUniform('u_backgroundTexture2', tex2);
      compositeShader.setUniform('u_backgroundBlend', blend);
      compositeShader.setUniform('u_backgroundRotation', dynamicBackground ? dynamicBackground.textureRotation : 0);
      compositeShader.setUniform('u_feedbackTexture', fondoBuffer);
      compositeShader.setUniform('u_resolution', [width, height]);
      compositeShader.setUniform('u_time', (typeof millis === 'function' ? millis() : Date.now()) / 1000.0);
      const sc = (typeof scoreSystem !== 'undefined' && scoreSystem) ? scoreSystem : null;
      const winThresh = (typeof CONFIG !== 'undefined' && CONFIG.score && CONFIG.score.winComboThreshold) ? CONFIG.score.winComboThreshold : 20;
      const cc = sc && sc.comboCount ? sc.comboCount : 0;
      compositeShader.setUniform('u_comboLevel', Math.min(1.0, cc / winThresh));

      // Ondas expansivas
      if (window._wavePositions && window._waveTimes && window._waveActive) {
        compositeShader.setUniform('u_wavePositions', window._wavePositions);
        compositeShader.setUniform('u_waveTimes', window._waveTimes);
        compositeShader.setUniform('u_waveActive', window._waveActive);
      }

      // Posiciones de uvas/copas
      let grapePositions = [];
      let grapeProgress = [];
      let grapeActive = [];
      const MAX_GRAPES = 10;
      const grapes = (typeof wineGlassSystem !== 'undefined' && wineGlassSystem) ? wineGlassSystem.glasses : [];
      for (let i = 0; i < MAX_GRAPES; i++) {
        if (i < grapes.length) {
          grapePositions.push(grapes[i].x / width, grapes[i].y / height);
          grapeProgress.push(grapes[i].hoverTime / grapes[i].requiredHoverTime);
          grapeActive.push(1.0);
        } else {
          grapePositions.push(0, 0);
          grapeProgress.push(0);
          grapeActive.push(0.0);
        }
      }
      compositeShader.setUniform('u_grapePositions', grapePositions);
      compositeShader.setUniform('u_grapeProgress', grapeProgress);
      compositeShader.setUniform('u_grapeActive', grapeActive);

      // Items malos
      let badPositions = [];
      let badActive = [];
      const MAX_BAD = 10;
      const bads = (typeof wineGlassSystem !== 'undefined' && wineGlassSystem) ? wineGlassSystem.badItems : [];
      for (let i = 0; i < MAX_BAD; i++) {
        if (i < bads.length) {
          badPositions.push(bads[i].x / width, bads[i].y / height);
          badActive.push(1.0);
        } else {
          badPositions.push(0, 0);
          badActive.push(0.0);
        }
      }
      compositeShader.setUniform('u_badPositions', badPositions);
      compositeShader.setUniform('u_badActive', badActive);

      // Halos desde panel
      const goodHalo = (typeof window !== 'undefined' && window.getGoodHaloSettings) ? window.getGoodHaloSettings() : { size: 0.12, strength: 0.35, color: [1.0, 0.85, 0.2] };
      const badHalo = (typeof window !== 'undefined' && window.getBadHaloSettings) ? window.getBadHaloSettings() : { size: 0.14, strength: 0.27, color: [1.0, 0.2, 0.2] };
      compositeShader.setUniform('u_goodHaloSize', goodHalo.size);
      compositeShader.setUniform('u_goodHaloStrength', goodHalo.strength);
      compositeShader.setUniform('u_goodHaloColor', goodHalo.color);
      compositeShader.setUniform('u_badHaloSize', badHalo.size);
      compositeShader.setUniform('u_badHaloStrength', badHalo.strength);
      compositeShader.setUniform('u_badHaloColor', badHalo.color);

      const splitEnabled = (typeof gameMode !== 'undefined' && gameMode === 'competitive') ? 1.0 : 0.0;
      compositeShader.setUniform('u_splitLineEnabled', splitEnabled);
      compositeShader.setUniform('u_splitLineColor', [1.0, 1.0, 1.0]);
      compositeShader.setUniform('u_splitLineThickness', 0.001);
      compositeShader.setUniform('u_splitLineSoftness', 0.001);

      feedbackBuffer.rect(0, 0, width, height);
    }
  } else {
    // Sin texturas: fondo negro
    feedbackBuffer.clear();
    feedbackBuffer.push();
    feedbackBuffer.noStroke();
    feedbackBuffer.fill(0);
    feedbackBuffer.rect(0, 0, width, height);
    feedbackBuffer.pop();
  }
}

// Exponer globales
if (typeof window !== 'undefined') {
  window.processShaders = processShaders;
  window.renderShaders = renderShaders;
}
