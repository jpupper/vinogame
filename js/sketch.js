let Pserver;
let PNT;
let wineGlassSystem;
let particleSystem;
let trailSystem;
let dynamicBackground;
let scoreSystem;
let medidorIndicator; // antes: barrelIndicator
let medidorIndicatorLeft;
let medidorIndicatorRight;

// Estados y modos de juego
let gameState = 'standby'; // 'standby' | 'playing'
let gameMode = null; // 'cooperative' | 'competitive'
let selectionScreen;
let rankingSystem;
let rankingSaved = false;
let scoreSystemLeft = null;
let scoreSystemRight = null;
// Celebraciones por lado en competitivo
let leftCelebration = null;
let rightCelebration = null;
// Retorno automático a inicio al terminar la partida
let gameEndTime = null;
let gameEndDelay = 3500; // ms visibles de GANASTE/PERDISTE antes de volver al inicio

// Modo debug
let isDebug = false;

// Texturas de uvas
let grapeTextures = [];
let grapeTexturesLoaded = false;

// Texturas de fondo
let backgroundTextures = [];
let backgroundTexturesLoaded = false;

// Imágenes y rutas de items buenos y malos (desde wineglasses.js)
// Estos arrays son dinámicos y pueden ser modificados por el panel de control
let goodItemImages = [];
let badItemImages = [];
let goodItemImagePaths = [];
let badItemImagePaths = [];
let backgroundImagePaths = [];
// Estado de carga de assets
let assetsReady = false;

// Imágenes pre-escaladas para optimización
let scaledGoodItemImages = {};
let scaledBadItemImages = {};
let scaledBackgroundImages = {};

// Hacer los arrays accesibles globalmente para el panel de control
if (typeof window !== 'undefined') {
    window.goodItemImages = goodItemImages;
    window.badItemImages = badItemImages;
    window.backgroundTextures = backgroundTextures;
    window.goodItemImagePaths = goodItemImagePaths;
    window.badItemImagePaths = badItemImagePaths;
    window.backgroundImagePaths = backgroundImagePaths;
    window.assetsReady = assetsReady;
}

// Fuente para texto WEBGL
let gameFont;

// Buffers
let fondoBuffer;
let juegoBuffer;
let particulasBuffer;
let feedbackBuffer;

// Shaders
let feedbackShader;      // Shader para efectos de feedback/cursor
let compositeShader;     // Shader para composición final (texturas + feedback + ondas)
let shadersLoaded = false;

// Sistema de efectos especiales
let effectIntensity = 0;
let targetEffectIntensity = 0;

// Screen Shake
let shakeAmount = 0;
let shakeDecay = 0.9;

// Slow Motion
let timeScale = 1.0;
let targetTimeScale = 1.0;
let slowMotionDuration = 0;

// Vignette
let vignetteIntensity = 0;

// Motion Blur
let motionBlurAmount = 0;

// Sistema de Ondas Expansivas
let waves = [];
const MAX_WAVES = 5;

// Sistema de Zoom Punch
let zoomPunch = 1.0;
let targetZoom = 1.0;

// Seguimiento de punteros en standby para generar ondas en el fondo
let lastPointerPositions = {};

function preload() {
  // Arrays de paths para cargar imágenes
  const grapePaths = [
    'img/objetos/uva_verde.png',   // Uvas verdes
    'img/objetos/uva_roja.png',    // Uvas rojas
    'img/objetos/uva_roja2.png',   // Uvas rojas 2
    'img/objetos/uva.png',         // Uva genérica
    'img/objetos/gota.png'         // Gota
  ];
  
  const bgPaths = [
    'img/background/fondo1.jpg',
    'img/background/fondo2.jpg',
    'img/background/fondo3.jpg',
    'img/background/fondo4.jpg',
    'img/background/fondo5.jpg'
  ];
  
  // Cargar texturas de uvas desde array
  for (let path of grapePaths) {
    grapeTextures.push(loadImage(path));
  }
  
  // Cargar texturas de fondo desde array y exportar rutas
  backgroundImagePaths.length = 0;
  for (let path of bgPaths) {
    backgroundImagePaths.push(path);
    backgroundTextures.push(loadImage(path));
  }
  
  // Cargar imágenes de objetos buenos y exportar rutas
  const goodPaths = [
    'img/objetos/uva_roja.png',
    'img/objetos/uva_roja2.png',
    'img/objetos/uva_verde.png',
    'img/objetos/uva.png',
    'img/objetos/hoja.png',
    'img/objetos/copa.png',
    'img/objetos/copa2.png',
    'img/objetos/botella.png',
    'img/objetos/destapador.png',
    'img/objetos/destapador2.png'
  ];
  goodItemImagePaths.length = 0;
  goodItemImages.length = 0;
  for (let path of goodPaths) {
    goodItemImagePaths.push(path);
    goodItemImages.push(loadImage(path));
  }
  
  // Cargar imágenes de objetos malos y exportar rutas
  const badPaths = [
    'img/malos/bicho1.png',
    'img/malos/bicho2.png',
    'img/malos/bicho3.png',
    'img/malos/bicho4.png',
    'img/malos/bicho5.png',
    'img/malos/bicho6.png',
    'img/malos/bicho7.png'
  ];
  badItemImagePaths.length = 0;
  badItemImages.length = 0;
  for (let path of badPaths) {
    badItemImagePaths.push(path);
    badItemImages.push(loadImage(path));
  }
  
  // Cargar shaders
  feedbackShader = loadShader('sh/feedback.vert', 'sh/feedback.frag');
  compositeShader = loadShader('sh/composite.vert', 'sh/composite.frag');
  
  // Crear e inicializar medidores
  medidorIndicator = new MedidorIndicator(); // cooperativo
  medidorIndicator.loadAssets();
  medidorIndicatorLeft = new MedidorIndicator();
  medidorIndicatorLeft.loadAssets();
  medidorIndicatorRight = new MedidorIndicator();
  medidorIndicatorRight.loadAssets();
  // Trofeo: cargar imagen de copa y exponer global
  if (typeof window !== 'undefined') {
    window.trophyImage = loadImage('img/copa/copa.png');
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  frameRate(CONFIG.general.frameRate);
  grapeTexturesLoaded = true;
  backgroundTexturesLoaded = true;
  shaderLoaded = true;
  
  // NO configurar fuente en WEBGL - causa errores
  // La fuente se configura en los buffers 2D individuales
  
  // Crear buffers
  fondoBuffer = createGraphics(width, height, WEBGL);  // Para feedback simple
  fondoBuffer.canvas.getContext('webgl', { willReadFrequently: true });
  
  juegoBuffer = createGraphics(width, height);
  juegoBuffer.canvas.getContext('2d', { willReadFrequently: true });
  
  particulasBuffer = createGraphics(width, height);
  particulasBuffer.canvas.getContext('2d', { willReadFrequently: true });
  
  feedbackBuffer = createGraphics(width, height, WEBGL); // Composición final
  feedbackBuffer.canvas.getContext('webgl', { willReadFrequently: true });
  
  // Optimizar canvas 2D para lecturas frecuentes
  if (juegoBuffer.canvas) {
    juegoBuffer.canvas.willReadFrequently = true;
  }
  if (particulasBuffer.canvas) {
    particulasBuffer.canvas.willReadFrequently = true;
  }
  
  // Inicializar sistemas
  Pserver = new PointServer();
  // Exponer instancia para integración externa y vaciar cola de LM si existe
  if (typeof window !== 'undefined') {
    window.Pserver = Pserver;
    if (window.LM && Array.isArray(window.LM._queue) && window.LM._queue.length) {
      for (let i = 0; i < window.LM._queue.length; i++) {
        try {
          Pserver.processJSONtouch(window.LM._queue[i]);
        } catch (e) {
          console.error('Error procesando item de LM._queue:', e);
        }
      }
      window.LM._queue.length = 0;
    }
  }
  // PNT = new PlayerPntsManager();
  wineGlassSystem = new WineGlassSystem();
  particleSystem = new ParticleSystem();
  trailSystem = new TrailSystem();
  dynamicBackground = new DynamicBackground();
  scoreSystem = new ScoreSystem();
  medidorIndicator.setup();
  // Configurar medidores competitivos
  medidorIndicatorLeft.setup();
  medidorIndicatorLeft.position.x = 40;
  medidorIndicatorLeft.position.y = 200; // más espacio
  medidorIndicatorRight.setup();
  medidorIndicatorRight.position.x = width - medidorIndicatorRight.size.w - 40;
  medidorIndicatorRight.position.y = 200; // más espacio

  // Pantalla de selección y ranking
  selectionScreen = new ModeSelectionScreen();
  selectionScreen.setup();
  rankingSystem = new RankingSystem();

  // Marcar assets listos para el arranque inicial (preload ya los cargó)
  assetsReady = true;
  if (typeof window !== 'undefined') {
    window.assetsReady = true;
  }
  // Pre-escalar imágenes para optimización
  if (typeof preScaleImages === 'function') {
    preScaleImages();
  }
}

// Variables para optimización de rendimiento
let lastShaderUpdateTime = 0;
let cachedShaderUniforms = {};

function draw() {
  // Actualizar sistemas
  dynamicBackground.update();
  
  // Actualizar intensidad de efectos (smooth lerp)
  effectIntensity = lerp(effectIntensity, targetEffectIntensity, 0.1);
  targetEffectIntensity *= 0.95; // Decay automático
  
  // Calcular combo level (0-1)
  // En standby, usar un pulso suave para que el fondo se sienta vivo
  let comboLevel;
  if (gameState === 'standby') {
    comboLevel = 0.12 + 0.08 * sin(millis() / 1000.0 * 1.6);
  } else {
    comboLevel = min(1.0, scoreSystem.comboCount / CONFIG.score.winComboThreshold); // Escala según umbral configurable
  }
  
  // Calcular vignette basado en vidas restantes
  vignetteIntensity = map(scoreSystem.lives, 3, 0, 0, 1, true);
  
  // Actualizar time scale (slow motion)
  timeScale = lerp(timeScale, targetTimeScale, 0.1);
  if (slowMotionDuration > 0) {
    slowMotionDuration--;
    if (slowMotionDuration <= 0) {
      targetTimeScale = 1.0;
    }
  }
  
  // Actualizar ondas expansivas (limpiar ondas viejas) - optimizado para ejecutar menos frecuentemente
  let currentTime = millis() / 1000.0;
  if (frameCount % 5 === 0) { // Solo cada 5 frames
    waves = waves.filter(wave => {
      let waveAge = currentTime - wave.startTime;
      return waveAge < 2.0; // Eliminar ondas que tienen más de 2 segundos
    });
  }

  // Animación sutil en standby: agregar ondas suaves ocasionales
  if (gameState === 'standby' && frameCount % 60 === 0) {
    const wx = random(width * 0.25, width * 0.75);
    const wy = random(height * 0.3, height * 0.7);
    createWave(wx, wy);
    dynamicBackground.addRipple(wx, wy);
  }
  
  // Zoom punch desactivado
  // zoomPunch = lerp(zoomPunch, targetZoom, 0.15);
  // targetZoom = lerp(targetZoom, 1.0, 0.08);
  
  // ===== PASO 1: SHADER DE FEEDBACK (solo efectos de cursor) =====
  // El feedback necesita las texturas de fondo como entrada
  fondoBuffer.push();
  fondoBuffer.shader(feedbackShader);
  
  // Pasar las texturas de fondo al feedback shader
  if (backgroundTexturesLoaded && backgroundTextures.length > 0) {
    const safeIndex = dynamicBackground.currentTextureIndex < backgroundTextures.length ? dynamicBackground.currentTextureIndex : 0;
    feedbackShader.setUniform('u_texture', backgroundTextures[safeIndex]);
  }
  
  feedbackShader.setUniform('u_feedbackTexture', fondoBuffer);
  feedbackShader.setUniform('u_particlesTexture', particulasBuffer);
  feedbackShader.setUniform('u_gameTexture', juegoBuffer);
  feedbackShader.setUniform('u_resolution', [width, height]);
  feedbackShader.setUniform('u_mouse', [mouseX, mouseY]);
  feedbackShader.setUniform('u_time', millis() / 1000.0);
  feedbackShader.setUniform('u_effectIntensity', effectIntensity);
  feedbackShader.setUniform('u_comboLevel', comboLevel);
  feedbackShader.setUniform('u_vignetteIntensity', vignetteIntensity);

  // Pasar punteros (mouse/touch/LIDAR) como arreglo al shader de feedback
  const MAX_POINTERS = 16;
  let pointerPositions = [];
  let pointerActive = [];
  if (Pserver) {
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
    for (let i = 0; i < MAX_POINTERS; i++) {
      pointerPositions.push(0, 0);
      pointerActive.push(0.0);
    }
  }
  feedbackShader.setUniform('u_pointerPositions', pointerPositions);
  feedbackShader.setUniform('u_pointerActive', pointerActive);
  
  // Pasar ondas expansivas al shader - optimizado con caché
  let wavePositions = [];
  let waveTimes = [];
  let waveActive = [];
  
  for (let i = 0; i < MAX_WAVES; i++) {
    if (i < waves.length && waves[i].active) {
      wavePositions.push(waves[i].x, waves[i].y);
      waveTimes.push(waves[i].startTime);
      waveActive.push(1.0);
    } else {
      wavePositions.push(0, 0);
      waveTimes.push(0);
      waveActive.push(0.0);
    }
  }
  
  // Solo actualizar uniforms si los datos han cambiado - optimizado sin JSON.stringify
  let waveDataChanged = !cachedShaderUniforms.wavePositions || 
                       wavePositions.length !== cachedShaderUniforms.wavePositions.length;
  
  if (!waveDataChanged) {
    for (let i = 0; i < wavePositions.length; i++) {
      if (wavePositions[i] !== cachedShaderUniforms.wavePositions[i]) {
        waveDataChanged = true;
        break;
      }
    }
  }
  
  if (waveDataChanged) {
    feedbackShader.setUniform('u_wavePositions', wavePositions);
    feedbackShader.setUniform('u_waveTimes', waveTimes);
    feedbackShader.setUniform('u_waveActive', waveActive);
    cachedShaderUniforms.wavePositions = wavePositions.slice();
    cachedShaderUniforms.waveTimes = waveTimes.slice();
    cachedShaderUniforms.waveActive = waveActive.slice();
  }
  
  fondoBuffer.rect(0, 0, width, height);
  fondoBuffer.pop();
  
  // ===== BUFFER DE PARTÍCULAS =====
  particulasBuffer.clear();
  particleSystem.update();
  particleSystem.display(particulasBuffer);
  
  // ===== PASO 2: SHADER DE COMPOSICIÓN (texturas + feedback + ondas) =====
  if (backgroundTexturesLoaded) {
    const len = backgroundTextures.length;
    const isImgReady = (img) => !!(img && typeof img.width === 'number' && img.width > 0);
    if (len > 0 && assetsReady) {
      feedbackBuffer.shader(compositeShader);
      // Selección segura de texturas según índices actuales
      const idx1 = (dynamicBackground.currentTextureIndex < len) ? dynamicBackground.currentTextureIndex : 0;
      const idx2 = (dynamicBackground.nextTextureIndex < len) ? dynamicBackground.nextTextureIndex : idx1;
      const tex1 = backgroundTextures[idx1] || null;
      const tex2 = backgroundTextures[idx2] || tex1;
      if (!isImgReady(tex1) || !isImgReady(tex2)) {
        // Si las texturas no están listas, dibujar fondo negro y saltar uniforms
        feedbackBuffer.clear();
        feedbackBuffer.push();
        feedbackBuffer.noStroke();
        feedbackBuffer.fill(0);
        feedbackBuffer.rect(0, 0, width, height);
        feedbackBuffer.pop();
      } else {
        const blend = (len > 1) ? (dynamicBackground.transitionProgress || 0.0) : 0.0;
        compositeShader.setUniform('u_backgroundTexture1', tex1);
        compositeShader.setUniform('u_backgroundTexture2', tex2);
        compositeShader.setUniform('u_backgroundBlend', blend);
        compositeShader.setUniform('u_backgroundRotation', dynamicBackground.textureRotation);
        compositeShader.setUniform('u_feedbackTexture', fondoBuffer);
        compositeShader.setUniform('u_resolution', [width, height]);
        compositeShader.setUniform('u_time', millis() / 1000.0);
        compositeShader.setUniform('u_comboLevel', comboLevel);

        // Pasar ondas expansivas al composite shader (para distorsión de UVs)
        compositeShader.setUniform('u_wavePositions', wavePositions);
        compositeShader.setUniform('u_waveTimes', waveTimes);
        compositeShader.setUniform('u_waveActive', waveActive);

        // Pasar posiciones de uvas al composite shader (para distorsión gravitacional)
        let grapePositions = [];
        let grapeProgress = [];
        let grapeActive = [];

        const MAX_GRAPES = 10;
        const grapes = wineGlassSystem.glasses; // Obtener todas las uvas/copas

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

        // Pasar posiciones de items malos para halos rojos
        let badPositions = [];
        let badActive = [];
        const MAX_BAD = 10;
        const bads = wineGlassSystem.badItems;
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

        // Uniforms de halos configurables desde el panel
        const goodHalo = (typeof window !== 'undefined' && window.getGoodHaloSettings) ? window.getGoodHaloSettings() : { size: 0.12, strength: 0.35, color: [1.0, 0.85, 0.2] };
        const badHalo = (typeof window !== 'undefined' && window.getBadHaloSettings) ? window.getBadHaloSettings() : { size: 0.14, strength: 0.27, color: [1.0, 0.2, 0.2] };
        compositeShader.setUniform('u_goodHaloSize', goodHalo.size);
        compositeShader.setUniform('u_goodHaloStrength', goodHalo.strength);
        compositeShader.setUniform('u_goodHaloColor', goodHalo.color);
        compositeShader.setUniform('u_badHaloSize', badHalo.size);
        compositeShader.setUniform('u_badHaloStrength', badHalo.strength);
        compositeShader.setUniform('u_badHaloColor', badHalo.color);

        // Línea divisoria en modo competitivo (distorsionada por el shader)
        const splitEnabled = gameMode === 'competitive' ? 1.0 : 0.0;
        compositeShader.setUniform('u_splitLineEnabled', splitEnabled);
        // Blanco suave; se tiñe con el fondo
        compositeShader.setUniform('u_splitLineColor', [1.0, 1.0, 1.0]);
        // Grosor y suavizado en coordenadas UV
        compositeShader.setUniform('u_splitLineThickness', 0.003);
        compositeShader.setUniform('u_splitLineSoftness', 0.008);
        
        feedbackBuffer.rect(0, 0, width, height);
      }
    } else {
      // Sin texturas: dibujar fondo negro sólido en feedbackBuffer
      feedbackBuffer.clear();
      feedbackBuffer.push();
      feedbackBuffer.noStroke();
      feedbackBuffer.fill(0);
      feedbackBuffer.rect(0, 0, width, height);
      feedbackBuffer.pop();
    }
  }
  
  // ===== BUFFER DE JUEGO =====
  juegoBuffer.clear();
  if (gameState === 'playing') {
    // Actualizar y mostrar rastros (en juegoBuffer)
    trailSystem.update();
    trailSystem.display(juegoBuffer);

    // Actualizar y mostrar copas de vino (en juegoBuffer)
    wineGlassSystem.update();
    wineGlassSystem.display(juegoBuffer);

    // Mostrar el servidor de puntos solo en modo debug (elipses)
    if (isDebug) {
      Pserver.display(juegoBuffer);
    }
    Pserver.update();

    // Comprobar colisiones con copas de vino y items malos - optimizado
    if (frameCount % 2 === 0) { // Solo cada 2 frames
      const allPoints = Pserver.getAllPoints();
      const collisions = wineGlassSystem.checkCollisions(allPoints);

      if (gameMode === 'competitive') {
        // Puntuación por lado (izquierda/derecha)
        for (let collected of collisions.glasses) {
          const target = collected.x < width / 2 ? scoreSystemLeft : scoreSystemRight;
          if (!target.gameOver && !target.win) {
            target.addScore(collected.points, collected.x, collected.y);
          }
          particleSystem.createExplosion(collected.x, collected.y, collected.glass.wineColor);
          dynamicBackground.addRipple(collected.x, collected.y);
          createWave(collected.x, collected.y);
          targetEffectIntensity = min(1.0, targetEffectIntensity + 0.3);
        }

        for (let bad of collisions.badItems) {
          const target = bad.x < width / 2 ? scoreSystemLeft : scoreSystemRight;
          if (!target.gameOver && !target.win) {
            target.addScore(-bad.penalty, bad.x, bad.y);
            target.loseLife();
            target.resetCombo();
          }
          particleSystem.createExplosion(bad.x, bad.y, color(255, 0, 0));
          dynamicBackground.addRipple(bad.x, bad.y);
          targetEffectIntensity = min(1.0, targetEffectIntensity + 0.5);
          shakeAmount = 15;
        }
      } else {
        // Modo cooperativo (original)
        if (!scoreSystem.gameOver && !scoreSystem.win) {
          // Procesar copas de vino recolectadas
          for (let collected of collisions.glasses) {
            scoreSystem.addScore(collected.points, collected.x, collected.y);
            particleSystem.createExplosion(collected.x, collected.y, collected.glass.wineColor);
            dynamicBackground.addRipple(collected.x, collected.y);
            createWave(collected.x, collected.y);
            targetEffectIntensity = min(1.0, targetEffectIntensity + 0.3);
          }
          // Procesar items malos recolectados
          for (let bad of collisions.badItems) {
            scoreSystem.addScore(-bad.penalty, bad.x, bad.y);
            scoreSystem.loseLife();
            particleSystem.createExplosion(bad.x, bad.y, color(255, 0, 0));
            dynamicBackground.addRipple(bad.x, bad.y);
            scoreSystem.resetCombo();
            targetEffectIntensity = min(1.0, targetEffectIntensity + 0.5);
            shakeAmount = 15;
          }
        }
      }
    }

    // Actualizar y mostrar efectos de partículas (en juegoBuffer)
    particleSystem.update();
    particleSystem.display(juegoBuffer);

    // Sistema de puntuación y medidor
    if (gameMode === 'competitive') {
      if (!scoreSystemLeft) scoreSystemLeft = new ScoreSystem();
      if (!scoreSystemRight) scoreSystemRight = new ScoreSystem();
      scoreSystemLeft.update();
      scoreSystemRight.update();
      // Detectar celebraciones por lado (win/lose)
      const leftWinsCond = (scoreSystemLeft.win || scoreSystemRight.gameOver);
      const leftLosesCond = (scoreSystemLeft.gameOver || scoreSystemRight.win);
      const rightWinsCond = (scoreSystemRight.win || scoreSystemLeft.gameOver);
      const rightLosesCond = (scoreSystemRight.gameOver || scoreSystemLeft.win);
      if (!leftCelebration && (leftWinsCond || leftLosesCond)) {
        leftCelebration = { type: leftWinsCond ? 'win' : 'lose', start: millis(), duration: 3500 };
      }
      if (!rightCelebration && (rightWinsCond || rightLosesCond)) {
        rightCelebration = { type: rightWinsCond ? 'win' : 'lose', start: millis(), duration: 3500 };
      }
      // Marcar fin de juego para retorno automático
      if (!gameEndTime && (leftWinsCond || leftLosesCond || rightWinsCond || rightLosesCond)) {
        gameEndTime = millis();
      }

      // Aplicar efectos al shader y partículas durante celebración
      applyCelebrationEffects('left', leftCelebration);
      applyCelebrationEffects('right', rightCelebration);

      displayCompetitiveHUD(juegoBuffer);

      // Medidores por equipo
      medidorIndicatorLeft.update(scoreSystemLeft.comboCount, CONFIG.score.winComboThreshold);
      medidorIndicatorLeft.display(juegoBuffer);
      medidorIndicatorRight.update(scoreSystemRight.comboCount, CONFIG.score.winComboThreshold);
      medidorIndicatorRight.display(juegoBuffer);

      // Guardar ranking cuando termina una partida (cualquiera de los equipos)
      if (!rankingSaved && ((scoreSystemLeft.gameOver || scoreSystemLeft.win) || (scoreSystemRight.gameOver || scoreSystemRight.win))) {
        const leftScoreFinal = Math.floor(scoreSystemLeft.score);
        const rightScoreFinal = Math.floor(scoreSystemRight.score);
        let winnerSide = null;
        if (scoreSystemLeft.win || scoreSystemRight.gameOver) {
          winnerSide = 'izquierda';
        } else if (scoreSystemRight.win || scoreSystemLeft.gameOver) {
          winnerSide = 'derecha';
        }
        rankingSystem.saveCompetitive(leftScoreFinal, rightScoreFinal, winnerSide);
        rankingSaved = true;
      }
    } else {
      scoreSystem.update();
      scoreSystem.display(juegoBuffer);
      medidorIndicator.update(scoreSystem.comboCount, CONFIG.score.winComboThreshold);
      medidorIndicator.display(juegoBuffer);

      if (!rankingSaved && (scoreSystem.gameOver || scoreSystem.win)) {
        rankingSystem.saveCooperative(Math.floor(scoreSystem.score));
        rankingSaved = true;
        if (!gameEndTime) {
          gameEndTime = millis();
        }
      }
    }

    // Indicadores de debug (FPS, cantidad de puntos)
    if (isDebug) {
      const fps = frameRate();
      const pointsCount = Pserver.getAllPoints().length;
      juegoBuffer.push();
      juegoBuffer.textAlign(LEFT, TOP);
      juegoBuffer.textSize(20);
      juegoBuffer.fill(100, 255, 100);
      juegoBuffer.text(`FPS: ${fps.toFixed(1)}`, 40, 100);
      juegoBuffer.fill(255, 180, 70);
      juegoBuffer.text(`Puntos (count): ${pointsCount}`, 40, 125);
      juegoBuffer.pop();
    }
  } else if (gameState === 'loading') {
    // Overlay simple de carga de assets
    juegoBuffer.push();
    juegoBuffer.textAlign(CENTER, CENTER);
    juegoBuffer.fill(255);
    juegoBuffer.textSize(24);
    juegoBuffer.text('Cargando assets...', width / 2, height / 2);
    juegoBuffer.pop();
  } else {
    // STANDBY: actualizar punteros y generar ondas por movimiento
    if (Pserver) {
      Pserver.update();
      const pts = Pserver.getAllPoints();
      const currentMap = {};
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        currentMap[p.id] = { x: p.x, y: p.y };
        const prev = lastPointerPositions[p.id];
        if (prev) {
          const d = dist(prev.x, prev.y, p.x, p.y);
          if (d > 6 && frameCount % 4 === 0) {
            createWave(p.x, p.y);
            dynamicBackground.addRipple(p.x, p.y);
          }
        } else {
          // Primera aparición: pequeña onda de bienvenida
          if (frameCount % 8 === 0) {
            createWave(p.x, p.y);
            dynamicBackground.addRipple(p.x, p.y);
          }
        }
      }
      // Actualizar mapa para el próximo frame
      lastPointerPositions = currentMap;
      // Mostrar puntos en standby para ver entrada de LIDAR/input
      Pserver.display(juegoBuffer);

      // Hover sobre botones con punteros: activar modo tras 500ms
      const selectedByHover = selectionScreen.updateHoverFromPoints(pts);
      if (selectedByHover) {
        const startPlaying = () => {
          gameMode = selectedByHover;
          gameState = 'playing';
          rankingSaved = false;
          if (gameMode === 'competitive') {
            scoreSystemLeft = new ScoreSystem();
            scoreSystemRight = new ScoreSystem();
          } else {
            scoreSystem = new ScoreSystem();
          }
        };
        if (typeof window !== 'undefined' && !window.assetsReady && typeof window.ensureAssetsReady === 'function') {
          gameState = 'loading';
          window.ensureAssetsReady().then(() => {
            window.assetsReady = true;
            startPlaying();
          });
        } else {
          startPlaying();
        }
      }
    }
    // Dibujar UI de selección de modo encima del fondo con shaders
    selectionScreen.display(juegoBuffer);
  }
  
  // ===== COMPOSICIÓN FINAL =====
  push();
  
  // SCREEN SHAKE
  if (shakeAmount > 0) {
    translate(
      random(-shakeAmount, shakeAmount) - width/2,
      random(-shakeAmount, shakeAmount) - height/2
    );
    shakeAmount *= shakeDecay;
    if (shakeAmount < 0.1) shakeAmount = 0;
  } else {
    translate(-width/2, -height/2);
  }
  
  imageMode(CORNER);
  
  // Dibujar fondo con shader
  image(feedbackBuffer, 0, 0);
  
  // Dibujar juego encima
  image(juegoBuffer, 0, 0);
  
  pop();

  // Agregar rastros para cada punto del servidor - optimizado
  if (frameCount % 3 === 0) { // Solo cada 3 frames
    const allPoints = Pserver.getAllPoints();
    for (let i = 0; i < allPoints.length; i++) {
      const p = allPoints[i];
      trailSystem.addTrail(p.x, p.y, p.id, color(200, 100, 150));
      
      // Añadir ondas al fondo cuando hay movimiento significativo
      if (frameCount % 30 === 0) {
        dynamicBackground.addRipple(p.x, p.y);
      }
    }
  }

  // Volver automáticamente a la pantalla de inicio cuando termina la celebración
  returnToStandbyIfDone();
}

// Toggle de modo debug con tecla D
function keyPressed() {
  if (key && key.toLowerCase() === 'd') {
    isDebug = !isDebug;
  }
}

// Touch event handlers for p5.js
function touchStarted() {
  // Reiniciar el juego si está en estado de Game Over o Victoria
  if (scoreSystem && (scoreSystem.gameOver || scoreSystem.win)) {
    resetGame();
  }
  return false; // Prevent default
}

function touchMoved() {
  return false; // Prevent default
}

function touchEnded() {
  return false; // Prevent default
}

function mousePressed() {
  // Reiniciar el juego si está en estado de Game Over
  if (gameState === 'standby') {
    const selected = selectionScreen.handleClick(mouseX, mouseY);
    if (selected) {
      const startPlaying = () => {
        gameMode = selected;
        gameState = 'playing';
        rankingSaved = false;
        // Preparar sistemas según el modo
        if (gameMode === 'competitive') {
          scoreSystemLeft = new ScoreSystem();
          scoreSystemRight = new ScoreSystem();
        } else {
          scoreSystem = new ScoreSystem();
        }
      };
      if (typeof window !== 'undefined' && !window.assetsReady && typeof window.ensureAssetsReady === 'function') {
        gameState = 'loading';
        window.ensureAssetsReady().then(() => {
          window.assetsReady = true;
          startPlaying();
        });
      } else {
        startPlaying();
      }
      return;
    }
  } else {
    if (scoreSystem && (scoreSystem.gameOver || scoreSystem.win)) {
      resetGame();
    }
  }
}

function resetGame() {
  // Reiniciar todos los sistemas sin recargar assets
  Pserver = new PointServer();
  if (typeof window !== 'undefined') {
    window.Pserver = Pserver;
  }
  wineGlassSystem = new WineGlassSystem();
  particleSystem = new ParticleSystem();
  trailSystem = new TrailSystem();
  
  // Reiniciar sistemas existentes en lugar de crear nuevos
  if (scoreSystem) {
    scoreSystem.reset();
  } else {
    scoreSystem = new ScoreSystem();
  }

  // Reiniciar sistemas competitivos
  if (scoreSystemLeft) scoreSystemLeft.reset();
  if (scoreSystemRight) scoreSystemRight.reset();
  
  // Mantener el fondo existente si ya está inicializado
  if (!dynamicBackground) {
    dynamicBackground = new DynamicBackground();
  }
  
  // Solo crear nueva instancia del medidor si es necesario
  if (!medidorIndicator) {
    medidorIndicator = new MedidorIndicator();
    medidorIndicator.setup();
  }
}

function createWave(x, y) {
  const wave = {
    x: x / width,
    y: y / height,
    startTime: millis() / 1000.0,
    active: true
  };
  waves.push(wave);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// Función para pre-escalar imágenes y optimizar rendimiento
function preScaleImages() {
  const commonSizes = [50, 75, 100, 125, 150]; // Tamaños comunes de objetos
  
  // Pre-escalar imágenes de objetos buenos
  for (let i = 0; i < goodItemImages.length; i++) {
    if (goodItemImages[i]) {
      scaledGoodItemImages[i] = {};
      for (let size of commonSizes) {
        let scaledImg = createGraphics(size, size);
        scaledImg.image(goodItemImages[i], 0, 0, size, size);
        scaledGoodItemImages[i][size] = scaledImg;
      }
    }
  }
  
  // Pre-escalar imágenes de objetos malos
  for (let i = 0; i < badItemImages.length; i++) {
    if (badItemImages[i]) {
      scaledBadItemImages[i] = {};
      for (let size of commonSizes) {
        let scaledImg = createGraphics(size, size);
        scaledImg.image(badItemImages[i], 0, 0, size, size);
        scaledBadItemImages[i][size] = scaledImg;
      }
    }
  }
  
  // Pre-escalar imágenes de fondo para tamaño de pantalla
  for (let i = 0; i < backgroundTextures.length; i++) {
    if (backgroundTextures[i]) {
      scaledBackgroundImages[i] = {};
      // Crear versión escalada para el tamaño actual de pantalla
      const bgWidth = width * 1.2;
      const bgHeight = height * 1.2;
      let scaledBg = createGraphics(bgWidth, bgHeight);
      scaledBg.image(backgroundTextures[i], 0, 0, bgWidth, bgHeight);
      scaledBackgroundImages[i]['current'] = scaledBg;
    }
  }
  
  console.log('Imágenes pre-escaladas para optimización de rendimiento');
}

// Función para obtener imagen escalada más cercana
function getScaledImage(imageArray, index, targetSize, isBad = false) {
  const scaledArray = isBad ? scaledBadItemImages : scaledGoodItemImages;
  
  if (!scaledArray[index]) return null;
  
  // Encontrar el tamaño más cercano
  const commonSizes = [50, 75, 100, 125, 150];
  let closestSize = commonSizes.reduce((prev, curr) => 
    Math.abs(curr - targetSize) < Math.abs(prev - targetSize) ? curr : prev
  );
  
  return scaledArray[index][closestSize];
}

// Función para obtener imagen de fondo escalada
function getScaledBackgroundImage(index) {
  if (!scaledBackgroundImages[index] || !scaledBackgroundImages[index]['current']) {
    return null;
  }
  return scaledBackgroundImages[index]['current'];
}

// Esperar a que las imágenes estén cargadas completamente (cuando se cargan fuera de preload)
function ensureAssetsReady() {
  return new Promise((resolve) => {
    // Si ya están listos, resolver de inmediato
    if (assetsReady) {
      resolve(true);
      return;
    }

    const arrays = [goodItemImages, badItemImages, backgroundTextures];
    const isLoaded = () => {
      for (const arr of arrays) {
        for (let i = 0; i < arr.length; i++) {
          const img = arr[i];
          if (!img) return false;
          const ready = (img.__loaded === true) || (typeof img.width === 'number' && img.width > 0);
          if (!ready) return false;
        }
      }
      return true;
    };

    const startTime = millis ? millis() : Date.now();
    const tick = () => {
      if (isLoaded()) {
        assetsReady = true;
        if (typeof window !== 'undefined') window.assetsReady = true;
        if (typeof preScaleImages === 'function') preScaleImages();
        resolve(true);
        return;
      }
      // Timeout de seguridad 10s
      const now = millis ? millis() : Date.now();
      if (now - startTime > 10000) {
        assetsReady = true;
        if (typeof window !== 'undefined') window.assetsReady = true;
        if (typeof preScaleImages === 'function') preScaleImages();
        resolve(true);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

if (typeof window !== 'undefined') {
  window.ensureAssetsReady = ensureAssetsReady;
}

// HUD para competitivo (dos equipos)
function displayCompetitiveHUD(ctx = window) {
  ctx.push();
  // La línea separadora ahora la dibuja el shader composite
  ctx.noStroke();

  // Izquierda
  ctx.textAlign(LEFT, TOP);
  ctx.fill(255);
  ctx.textSize(28);
  ctx.text('Equipo Izquierda', 40, 30);
  const leftScoreVal = scoreSystemLeft ? Math.floor(scoreSystemLeft.displayScore || scoreSystemLeft.score) : 0;
  const leftLivesVal = scoreSystemLeft ? scoreSystemLeft.lives : 0;
  ctx.text(`Score: ${leftScoreVal}`, 40, 80);
  // Corazones (izquierda)
  const lifeSize = CONFIG.lives.size;
  const lifeSpacing = CONFIG.lives.spacing + 6; // más separación
  const leftHeartStartX = 40 + lifeSize + 16; // margen extra
  const heartsY = 150; // bajar corazones
  if (scoreSystemLeft) {
    for (let i = 0; i < leftLivesVal; i++) {
      scoreSystemLeft.drawHeart(leftHeartStartX + i * lifeSpacing, heartsY, lifeSize, ctx);
    }
  }

  // Derecha
  ctx.textAlign(RIGHT, TOP);
  ctx.text('Equipo Derecha', width - 40, 30);
  const rightScoreVal = scoreSystemRight ? Math.floor(scoreSystemRight.displayScore || scoreSystemRight.score) : 0;
  const rightLivesVal = scoreSystemRight ? scoreSystemRight.lives : 0;
  ctx.text(`Score: ${rightScoreVal}`, width - 40, 80);
  // Corazones (derecha)
  const rightHeartStartX = width - 40 - lifeSize - 16; // margen extra
  if (scoreSystemRight) {
    for (let i = 0; i < rightLivesVal; i++) {
      // Dibujar desde la derecha hacia la izquierda
      const x = rightHeartStartX - i * lifeSpacing;
      scoreSystemRight.drawHeart(x, heartsY, lifeSize, ctx);
    }
  }

  // Overlay híbrido de Ganaste/Perdiste por lado
  const leftWins = (scoreSystemLeft && scoreSystemLeft.win) || (scoreSystemRight && scoreSystemRight.gameOver);
  const rightWins = (scoreSystemRight && scoreSystemRight.win) || (scoreSystemLeft && scoreSystemLeft.gameOver);
  const leftLoses = (scoreSystemLeft && scoreSystemLeft.gameOver) || (scoreSystemRight && scoreSystemRight.win);
  const rightLoses = (scoreSystemRight && scoreSystemRight.gameOver) || (scoreSystemLeft && scoreSystemLeft.win);

  const bigSize = Math.min(64, height * 0.08);
  ctx.textSize(bigSize);
  ctx.textAlign(CENTER, CENTER);
  const trophy = (typeof window !== 'undefined' ? window.trophyImage : null);

  // Lado izquierdo
  if (leftWins && !leftLoses) {
    ctx.fill(255, 215, 0);
    ctx.text('GANASTE', width * 0.25, height * 0.25);
    if (trophy) ctx.image(trophy, width * 0.25, height * 0.35, bigSize, bigSize);
    drawSideCelebrationOverlay(ctx, 'left', leftCelebration);
  } else if (leftLoses && !leftWins) {
    ctx.fill(255, 80, 80);
    ctx.text('PERDISTE', width * 0.25, height * 0.25);
    drawSideCelebrationOverlay(ctx, 'left', leftCelebration);
  }

  // Lado derecho
  if (rightWins && !rightLoses) {
    ctx.fill(255, 215, 0);
    ctx.text('GANASTE', width * 0.75, height * 0.25);
    if (trophy) ctx.image(trophy, width * 0.75, height * 0.35, bigSize, bigSize);
    drawSideCelebrationOverlay(ctx, 'right', rightCelebration);
  } else if (rightLoses && !rightWins) {
    ctx.fill(255, 80, 80);
    ctx.text('PERDISTE', width * 0.75, height * 0.25);
    drawSideCelebrationOverlay(ctx, 'right', rightCelebration);
  }
  ctx.pop();
}

// Efectos de celebración: distorsiones del shader (ondas) + explosiones de partículas
function applyCelebrationEffects(side, celebration) {
  if (!celebration) return;
  const now = millis();
  const elapsed = now - celebration.start;
  if (elapsed > celebration.duration) return;

  const xMin = side === 'left' ? 0 : width / 2;
  const xMax = side === 'left' ? width / 2 : width;
  const yMin = height * 0.2;
  const yMax = height * 0.8;

  // Ondas con menor densidad (solo cada 12 frames, 1 onda)
  if (frameCount % 12 === 0) {
    const wx = random(xMin + 30, xMax - 30);
    const wy = random(yMin, yMax);
    createWave(wx, wy);
    dynamicBackground.addRipple(wx, wy);
  }

  const col = celebration.type === 'win' ? color(255, 215, 0) : color(255, 60, 60);
  // Explosiones de partículas con aún menor densidad (cada 20 frames, menos partículas)
  if (frameCount % 20 === 0) {
    const px = random(xMin + 50, xMax - 50);
    const py = random(yMin, yMax);
    particleSystem.createExplosion(px, py, col, 40);
  }

  // Subir la intensidad del shader con incremento más suave
  targetEffectIntensity = min(1.0, targetEffectIntensity + (celebration.type === 'win' ? 0.08 : 0.05));
}

// Overlay visual p5.js por lado (destellos + confetti)
function drawSideCelebrationOverlay(ctx, side, celebration) {
  if (!celebration) return;
  const now = millis();
  const elapsed = now - celebration.start;
  if (elapsed > celebration.duration) return;

  const xCenter = side === 'left' ? width * 0.25 : width * 0.75;
  const baseY = height * 0.3;
  const hue = celebration.type === 'win' ? [255, 215, 0] : [255, 80, 80];

  ctx.push();
  ctx.noFill();
  ctx.stroke(hue[0], hue[1], hue[2], 160);
  ctx.strokeWeight(2);
  const t = now / 500.0;
  for (let i = 0; i < 4; i++) {
    const r = 40 + i * 12 + sin(t + i) * 6;
    ctx.arc(xCenter, baseY, r, r, 0, TWO_PI * 0.6);
  }
  // Confetti
  ctx.noStroke();
  for (let i = 0; i < 8; i++) {
    ctx.fill(hue[0], hue[1], hue[2], 180);
    const cx = xCenter + random(-120, 120);
    const cy = baseY + random(-80, 80);
    const s = random(4, 8);
    ctx.rect(cx, cy, s, s);
  }
  ctx.pop();
}

// Volver a la pantalla de inicio cuando terminó la animación de fin de juego
function returnToStandbyIfDone() {
  if (!gameEndTime) return;
  const elapsed = millis() - gameEndTime;
  if (elapsed < gameEndDelay) return;

  // Limpiar estado de celebración y reiniciar sistemas
  leftCelebration = null;
  rightCelebration = null;
  gameEndTime = null;

  resetGame();
  gameState = 'standby';
  gameMode = null;
  rankingSaved = false;
  if (!selectionScreen) selectionScreen = new ModeSelectionScreen();
  selectionScreen.setup();
}

