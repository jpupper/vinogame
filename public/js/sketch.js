let Pserver;
let PNT;
let wineGlassSystem;
let particleSystem;
let dynamicBackground;
let scoreSystem;
let medidorIndicator; // antes: barrelIndicator
let medidorIndicatorLeft;
let medidorIndicatorRight;

// Estados y modos de juego
let gameState = 'standby'; // 'standby' | 'tutorial' | 'playing'
let gameMode = null; // 'cooperative' | 'competitive'
// Pantallas: 0 Standby, 1 Colaborativa, 2 Competitiva, 3 GameOver, 4 Tutorial
let pantallaActiva = 0;
let selectionScreen;
let tutorialScreen;
let rankingSystem;
let rankingSaved = false;
let scoreSystemLeft = null;
let scoreSystemRight = null;
// Celebraciones por lado en competitivo
let leftCelebration = null;
let rightCelebration = null;
// Retorno automático a inicio al terminar la partida
let gameEndTime = null;
// Duración visible de FIN/GANASTE en base a configuración
let gameEndDelay = (typeof CONFIG !== 'undefined' && CONFIG.win && CONFIG.win.duration)
  ? CONFIG.win.duration
  : 5000;

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
// Mostrar/Ocultar puntos del LIDAR (solo visual)
let showLidarPoints = true;

// Imágenes pre-escaladas para optimización
let scaledGoodItemImages = {};
let scaledBadItemImages = {};
let scaledBackgroundImages = {};

// Sistema de Ondas Expansivas
let waves = [];
const MAX_WAVES = 5;

// Sistema de Zoom Punch
let zoomPunch = 1.0;
let targetZoom = 1.0;

// Seguimiento de punteros en standby para generar ondas en el fondo
let lastPointerPositions = {};

// Función para exponer variables globalmente
function exposeGlobalVariables() {
  if (typeof window !== 'undefined') {
      window.goodItemImages = goodItemImages;
      window.badItemImages = badItemImages;
      window.backgroundTextures = backgroundTextures;
      window.goodItemImagePaths = goodItemImagePaths;
      window.badItemImagePaths = badItemImagePaths;
      window.backgroundImagePaths = backgroundImagePaths;
      window.assetsReady = assetsReady;
      window.showLidarPoints = showLidarPoints;
      // Exponer ondas para el shader
      window.waves = waves;
      // Inicializar sistema de ondas de eventos para shaders
      if (!window.eventRipple) {
        window.eventRipple = { active: false, x: 0.5, y: 0.5, startTime: 0, color: [1,1,1], strength: 0 };
      }
      // Asegurar que window.assetsReady esté sincronizado con la variable local
      window.assetsReady = assetsReady;
  }
}

// Fuente para texto WEBGL
let gameFont;

// Buffers
let fondoBuffer;
let juegoBuffer;
let particulasBuffer;
let feedbackBuffer;

// Shaders
let feedbackShader;      // Shader multibuffer de agua (agua-nikos + mapeopuntosmaster)
let compositeShader;     // Shader de composición final (refracción de agua + fondos + halos + puntos)
let celebrationShader;   // Shader para círculos explosivos de victoria/derrota
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

function preload() {
  // Carga inicial centralizada de imágenes y shaders
  if (typeof window !== 'undefined' && window.AssetManager && typeof window.AssetManager.initialLoad === 'function') {
    window.AssetManager.initialLoad();
    // Sincronizar referencias locales por compatibilidad
    goodItemImages = window.goodItemImages;
    badItemImages = window.badItemImages;
    backgroundTextures = window.backgroundTextures;
    goodItemImagePaths = window.goodItemImagePaths;
    badItemImagePaths = window.badItemImagePaths;
    backgroundImagePaths = window.backgroundImagePaths;
  }
  
  // Cargar shaders
  feedbackShader = loadShader('sh/feedback.vert', 'sh/feedback.frag');
  compositeShader = loadShader('sh/composite.vert', 'sh/composite.frag');
  celebrationShader = (typeof window !== 'undefined' && window.celebrationShader)
    ? window.celebrationShader
    : loadShader('sh/celebration.vert', 'sh/celebration.frag');
  if (typeof window !== 'undefined') {
    window.celebrationShader = celebrationShader;
  }
  
  // Registrar assets cargados en AssetManager para centralizar acceso
  if (typeof window !== 'undefined' && window.AssetManager) {
    window.AssetManager.registerAssets({
      goodItemImages,
      badItemImages,
      backgroundTextures,
      goodItemImagePaths,
      badItemImagePaths,
      backgroundImagePaths
    });
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  frameRate(CONFIG.general.frameRate);
  grapeTexturesLoaded = true;
  backgroundTexturesLoaded = true;
  shadersLoaded = true;
  
  // Crear buffers (2D con willReadFrequently automático vía shim en assetManager.js)
  fondoBuffer = createGraphics(width, height);
  juegoBuffer = createGraphics(width, height);
  particulasBuffer = createGraphics(width, height);
  feedbackBuffer = createGraphics(width, height); // Composición final desde WaterMultiBuffer.canvas
  
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

  wineGlassSystem = new WineGlassSystem();
  particleSystem = new ParticleSystem();
  dynamicBackground = new DynamicBackground();
  scoreSystem = new ScoreSystem();
  // Crear e inicializar medidores (usar assets centralizados)
  medidorIndicator = new MedidorIndicator(); // cooperativo
  // Configurar medidores competitivos
  medidorIndicatorLeft = new MedidorIndicator({ position: { x: 40, y: 245 } });
  medidorIndicatorRight = new MedidorIndicator({ position: { x: width - 140 - 40, y: 245 } });

  // Pantalla de selección y ranking
  selectionScreen = new ModeSelectionScreen();
  selectionScreen.setup();
  tutorialScreen = new TutorialScreen();
  rankingSystem = new RankingSystem();

  // Marcar assets listos para el arranque inicial (preload ya los cargó)
  assetsReady = true;
  
  // Exponer variables globalmente después de que todo esté inicializado
  exposeGlobalVariables();
  
  // Pre-escalar imágenes para optimización
  if (typeof preScaleImages === 'function') {
    preScaleImages();
  }
}

// Variables para optimización de rendimiento
let lastShaderUpdateTime = 0;
let cachedShaderUniforms = {};

function draw() {
  // Actualizar intensidad de efectos (smooth lerp)
  effectIntensity = lerp(effectIntensity, targetEffectIntensity, 0.1);
  targetEffectIntensity *= 0.95; // Decay automático

  // Actualizar time scale (slow motion)
  timeScale = lerp(timeScale, targetTimeScale, 0.1);
  if (slowMotionDuration > 0) {
    slowMotionDuration--;
    if (slowMotionDuration <= 0) {
      targetTimeScale = 1.0;
    }
  }
  
  // Actualizar ondas expansivas (limpiar ondas viejas)
  let currentTime = millis() / 1000.0;
  if (frameCount % 5 === 0) {
    waves = waves.filter(wave => {
      let waveAge = currentTime - wave.startTime;
      return waveAge < 2.5;
    });
  }

  // Pipeline de shaders centralizado (Multibuffer de Agua + Composición)
  if (typeof window !== 'undefined' && typeof window.processShaders === 'function') {
    window.processShaders();
  }
  if (typeof window !== 'undefined' && typeof window.renderShaders === 'function') {
    window.renderShaders();
  }
  
  // ===== CONTROL DE OVERLAY HTML =====
  const overlay = document.getElementById('modeSelectionOverlay');
  if (overlay) {
    if (gameState === 'standby') {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }
  
  // ===== BUFFER DE JUEGO =====
  juegoBuffer.clear();
  // Determinar pantalla activa
  if (gameState === 'standby') {
    pantallaActiva = 0;
  } else if (gameState === 'tutorial') {
    pantallaActiva = 4;
  } else if (gameState === 'playing') {
    if (gameMode === 'competitive') {
      const ended = (scoreSystemLeft && (scoreSystemLeft.gameOver || scoreSystemLeft.win)) ||
                    (scoreSystemRight && (scoreSystemRight.gameOver || scoreSystemRight.win));
      pantallaActiva = ended ? 3 : 2;
    } else {
      const ended = (scoreSystem && (scoreSystem.gameOver || scoreSystem.win));
      pantallaActiva = ended ? 3 : 1;
    }
  } else {
    pantallaActiva = 0; // loading -> standby overlay
  }

  // Dibujar la pantalla específica
  switch (pantallaActiva) {
    case 0:
      dibujarPantallaStandBy(juegoBuffer);
      break;
    case 1:
      dibujarPantallaColaborativa(juegoBuffer);
      break;
    case 2:
      dibujarPantallaCompetitiva(juegoBuffer);
      break;
    case 3:
      dibujarPantallaGameover(juegoBuffer);
      break;
    case 4:
      dibujarPantallaTutorial(juegoBuffer);
      break;
    default:
      dibujarPantallaStandBy(juegoBuffer);
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
  
  // Dibujar fondo con shader multibuffer de agua (si está habilitado)
  if (!(typeof window !== 'undefined' && window.hideBackground)) {
    image(feedbackBuffer, 0, 0);
  } else {
    noStroke();
    fill(0);
    rect(0, 0, width, height);
  }
  
  // Dibujar juego encima
  image(juegoBuffer, 0, 0);
  
  // Dibujar assets SIN feedback (después del shader, cuando estamos jugando)
  if (
    (pantallaActiva === 1 || pantallaActiva === 2) &&
    typeof wineGlassSystem !== 'undefined' &&
    wineGlassSystem
  ) {
    wineGlassSystem.displayAssetsOnly();
  }
  
  // Overlay visual del área de colisión (opcional)
  if (typeof window !== 'undefined' && window.collisionArea && window.collisionArea.enabled && window.collisionArea.showOverlay) {
    const ca = window.collisionArea;
    push();
    fill(0, 255, 0, 60);
    stroke(0, 255, 0, 200);
    strokeWeight(2);
    rect(ca.x, ca.y, ca.width, ca.height);
    pop();
  }
  if ((typeof window !== 'undefined' && window.showLidarPoints) || (typeof window === 'undefined' && showLidarPoints)) {
    Pserver.displayCirclesOnly();
  }

  pop();

  // Agregar ondas suaves para cada punto activo
  if (frameCount % 3 === 0) {
    const allPoints = Pserver.getAllPoints();
    for (let i = 0; i < allPoints.length; i++) {
      const p = allPoints[i];
      if (frameCount % 30 === 0) {
        dynamicBackground.addRipple(p.x, p.y);
      }
    }
  }
}

// ====== Pantallas específicas ======
function dibujarPantallaStandBy(ctx) {
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
        if (d > 6 && frameCount % 8 === 0) {
          dynamicBackground.addRipple(p.x, p.y);
        }
      }
    }
    lastPointerPositions = currentMap;
    if ((typeof window !== 'undefined' && window.showLidarPoints) || (typeof window === 'undefined' && showLidarPoints)) {
      Pserver.display(ctx);
    }

    const selectedByHover = selectionScreen.updateHoverFromPoints(pts);
    if (selectedByHover) {
      const startPlaying = () => {
        gameMode = selectedByHover;
        rankingSaved = false;
        
        // Si es modo competitivo, mostrar tutorial primero
        if (gameMode === 'competitive') {
          gameState = 'tutorial';
          tutorialScreen.start();
        } else {
          // Modo cooperativo inicia directamente
          gameState = 'playing';
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
  selectionScreen.display(ctx);
}

function dibujarPantallaTutorial(ctx) {
  if (Pserver) {
    Pserver.update();
  }
  // Mostrar el tutorial
  tutorialScreen.display(ctx);
  
  // Verificar si el tutorial ha terminado
  if (tutorialScreen.isFinished()) {
    // Iniciar el juego competitivo
    gameState = 'playing';
    scoreSystemLeft = new ScoreSystem();
    scoreSystemRight = new ScoreSystem();
    tutorialScreen.reset();
  }
}

function dibujarPantallaColaborativa(ctx) {
  wineGlassSystem.update();
  wineGlassSystem.displayHalosOnly(ctx);
  Pserver.update();
  if (frameCount % 2 === 0) {
    const allPoints = Pserver.getAllPoints();
    const collisions = wineGlassSystem.checkCollisions(allPoints);
    if (!scoreSystem.gameOver && !scoreSystem.win) {
      for (let collected of collisions.glasses) {
        scoreSystem.addScore(collected.points, collected.x, collected.y);
        dynamicBackground.addRipple(collected.x, collected.y);
        createWave(collected.x, collected.y);
        targetEffectIntensity = min(1.0, targetEffectIntensity + 0.3);
      }
      for (let bad of collisions.badItems) {
        scoreSystem.addScore(-bad.penalty, bad.x, bad.y);
        scoreSystem.loseLife();
        dynamicBackground.addRipple(bad.x, bad.y);
        createWave(bad.x, bad.y);
        scoreSystem.resetCombo();
        targetEffectIntensity = min(1.0, targetEffectIntensity + 0.5);
        shakeAmount = 15;
      }
    }
  }
  particleSystem.update();
  particleSystem.display(ctx);
  scoreSystem.update();
  scoreSystem.display(ctx);
  medidorIndicator.update(scoreSystem.comboCount, CONFIG.score.winComboThreshold);
  medidorIndicator.display(ctx);
  if (!rankingSaved && (scoreSystem.gameOver || scoreSystem.win)) {
    rankingSystem.saveCooperative(Math.floor(scoreSystem.score));
    rankingSaved = true;
    if (!gameEndTime) { gameEndTime = millis(); }
  }
  if ((typeof window !== 'undefined' && window.showLidarPoints) || (typeof window === 'undefined' && showLidarPoints)) {
    Pserver.display(ctx);
  }
  if (isDebug) {
    const fps = frameRate();
    const pointsCount = Pserver.getAllPoints().length;
    ctx.push();
    ctx.textAlign(LEFT, TOP);
    ctx.textSize(20);
    ctx.fill(100, 255, 100);
    ctx.text(`FPS: ${fps.toFixed(1)}`, 40, 110);
    ctx.fill(255, 180, 70);
    ctx.text(`Puntos (count): ${pointsCount}`, 40, 135);
    ctx.pop();
  }
}

function dibujarPantallaCompetitiva(ctx) {
  if (!scoreSystemLeft) scoreSystemLeft = new ScoreSystem();
  if (!scoreSystemRight) scoreSystemRight = new ScoreSystem();
  wineGlassSystem.update();
  wineGlassSystem.displayHalosOnly(ctx);
  Pserver.update();
  if (frameCount % 2 === 0) {
    const allPoints = Pserver.getAllPoints();
    const collisions = wineGlassSystem.checkCollisions(allPoints);
    for (let collected of collisions.glasses) {
      const target = collected.x < width / 2 ? scoreSystemLeft : scoreSystemRight;
      if (!target.gameOver && !target.win) { target.addScore(collected.points, collected.x, collected.y); }
      dynamicBackground.addRipple(collected.x, collected.y);
      createWave(collected.x, collected.y);
      targetEffectIntensity = min(1.0, targetEffectIntensity + 0.3);
    }
    for (let bad of collisions.badItems) {
      const target = bad.x < width / 2 ? scoreSystemLeft : scoreSystemRight;
      if (!target.gameOver && !target.win) { target.addScore(-bad.penalty, bad.x, bad.y); target.loseLife(); target.resetCombo(); }
      dynamicBackground.addRipple(bad.x, bad.y);
      createWave(bad.x, bad.y);
      targetEffectIntensity = min(1.0, targetEffectIntensity + 0.5);
      shakeAmount = 15;
    }
  }
  particleSystem.update();
  particleSystem.display(ctx);
  scoreSystemLeft.update();
  scoreSystemRight.update();
  // Mostrar solo efectos de puntuación (sin HUD ni animaciones centradas)
  scoreSystemLeft.display(ctx, { hud: false, animations: false });
  scoreSystemRight.display(ctx, { hud: false, animations: false });
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
  if (!gameEndTime && (leftWinsCond || leftLosesCond || rightWinsCond || rightLosesCond)) {
    gameEndTime = millis();
  }
  applyCelebrationEffects('left', leftCelebration);
  applyCelebrationEffects('right', rightCelebration);
  // Overlays por lado (GANASTE/PERDISTE) en competitivo
  drawSideCelebrationOverlay(ctx, 'left', leftCelebration);
  drawSideCelebrationOverlay(ctx, 'right', rightCelebration);
  // HUD con diseño unificado
  displayCompetitiveHUD(ctx);
  medidorIndicatorLeft.update(scoreSystemLeft.comboCount, CONFIG.score.winComboThreshold);
  medidorIndicatorLeft.display(ctx);
  medidorIndicatorRight.update(scoreSystemRight.comboCount, CONFIG.score.winComboThreshold);
  medidorIndicatorRight.display(ctx);
  if (!rankingSaved && ((scoreSystemLeft.gameOver || scoreSystemLeft.win) || (scoreSystemRight.gameOver || scoreSystemRight.win))) {
    const leftScoreFinal = Math.floor(scoreSystemLeft.score);
    const rightScoreFinal = Math.floor(scoreSystemRight.score);
    let winnerSide = null;
    if (scoreSystemLeft.win || scoreSystemRight.gameOver) { winnerSide = 'izquierda'; }
    else if (scoreSystemRight.win || scoreSystemLeft.gameOver) { winnerSide = 'derecha'; }
    rankingSystem.saveCompetitive(leftScoreFinal, rightScoreFinal, winnerSide);
    rankingSaved = true;
  }
  if ((typeof window !== 'undefined' && window.showLidarPoints) || (typeof window === 'undefined' && showLidarPoints)) {
    Pserver.display(ctx);
  }
}

function dibujarPantallaGameover(ctx) {
  if (Pserver) {
    Pserver.update();
  }
  // Mostrar HUD/animaciones existentes
  if (gameMode === 'competitive') {
    if (scoreSystemLeft) { scoreSystemLeft.update(); }
    if (scoreSystemRight) { scoreSystemRight.update(); }
    applyCelebrationEffects('left', leftCelebration);
    applyCelebrationEffects('right', rightCelebration);
    drawSideCelebrationOverlay(ctx, 'left', leftCelebration);
    drawSideCelebrationOverlay(ctx, 'right', rightCelebration);
    displayCompetitiveHUD(ctx);
  } else if (scoreSystem) {
    scoreSystem.update();
    scoreSystem.display(ctx);
  }
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
  if (scoreSystem && (scoreSystem.gameOver || scoreSystem.win)) {
    resetGame();
  }
  return false;
}

function touchMoved() {
  return false;
}

function touchEnded() {
  return false;
}

function mousePressed() {
  if (gameState === 'standby') {
    if (!selectionScreen) {
      selectionScreen = new ModeSelectionScreen();
      selectionScreen.setup();
    }
    const selected = selectionScreen.handleClick(mouseX, mouseY);
    if (selected) {
      const startPlaying = () => {
        gameMode = selected;
        rankingSaved = false;
        
        if (gameMode === 'competitive') {
          gameState = 'tutorial';
          tutorialScreen.start();
        } else {
          gameState = 'playing';
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
  Pserver = new PointServer();
  if (typeof window !== 'undefined') {
    window.Pserver = Pserver;
  }
  wineGlassSystem = new WineGlassSystem();
  particleSystem = new ParticleSystem();
  
  if (scoreSystem) {
    scoreSystem.reset();
  } else {
    scoreSystem = new ScoreSystem();
  }

  if (scoreSystemLeft) scoreSystemLeft.reset();
  if (scoreSystemRight) scoreSystemRight.reset();
  
  if (!dynamicBackground) {
    dynamicBackground = new DynamicBackground();
  }
  
  if (!medidorIndicator) {
    medidorIndicator = new MedidorIndicator();
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
  if (typeof window !== 'undefined') window.waves = waves;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (juegoBuffer) juegoBuffer.resizeCanvas(windowWidth, windowHeight);
  if (particulasBuffer) particulasBuffer.resizeCanvas(windowWidth, windowHeight);
  if (fondoBuffer) fondoBuffer.resizeCanvas(windowWidth, windowHeight);
  if (feedbackBuffer) feedbackBuffer.resizeCanvas(windowWidth, windowHeight);
  if (selectionScreen && typeof selectionScreen.updateButtonLayout === 'function') {
    selectionScreen.updateButtonLayout();
  }
  if (medidorIndicatorRight) {
    medidorIndicatorRight.position.x = width - 140 - 40;
  }
}

function preScaleImages() {
  if (typeof window !== 'undefined' && window.AssetManager) {
    window.AssetManager.preScaleImages();
  }
}

function getScaledImage(imageArray, index, targetSize, isBad = false) {
  if (typeof window !== 'undefined' && window.AssetManager) {
    return window.AssetManager.getScaledImage(imageArray, index, targetSize, isBad);
  }
  return null;
}

function getScaledBackgroundImage(index) {
  if (typeof window !== 'undefined' && window.AssetManager) {
    return window.AssetManager.getScaledBackgroundImage(index);
  }
  return null;
}

// HUD para competitivo (dos equipos) con estilo tipográfico unificado Deli & Wine
function displayCompetitiveHUD(ctx = window) {
  ctx.push();
  ctx.noStroke();
  ctx.rectMode(CORNER);

  const cardW = Math.min(340, width * 0.24);
  const cardH = 195;
  const padX = 28;
  const padY = 24;

  // --- TARJETA EQUIPO IZQUIERDA ---
  ctx.fill(18, 5, 14, 185);
  ctx.stroke(255, 215, 106, 110);
  ctx.strokeWeight(1.8);
  ctx.rect(padX, padY, cardW, cardH, 16);

  ctx.stroke(255, 215, 106, 180);
  ctx.strokeWeight(2.5);
  ctx.line(padX + 18, padY + 62, padX + cardW - 18, padY + 62);
  ctx.noStroke();

  ctx.textAlign(LEFT, TOP);
  ctx.textFont('Cinzel, Georgia, serif');
  ctx.textStyle(BOLD);
  ctx.textSize(22);
  ctx.fill(0, 0, 0, 180);
  ctx.text('EQUIPO IZQUIERDA', padX + 20, padY + 20);
  ctx.fill(255, 223, 128);
  ctx.text('EQUIPO IZQUIERDA', padX + 18, padY + 18);

  const leftScoreVal = scoreSystemLeft ? Math.floor(scoreSystemLeft.displayScore || scoreSystemLeft.score) : 0;
  const leftLivesVal = scoreSystemLeft ? scoreSystemLeft.lives : 0;

  ctx.textFont('Montserrat, sans-serif');
  ctx.textStyle(BOLD);
  ctx.textSize(14);
  ctx.fill(220, 195, 175, 210);
  ctx.text('PUNTOS', padX + 18, padY + 74);

  ctx.textFont('Cinzel, Georgia, serif');
  ctx.textSize(36);
  ctx.fill(0, 0, 0, 180);
  ctx.text(`${leftScoreVal}`, padX + 20, padY + 92);
  ctx.fill(255, 250, 240);
  ctx.text(`${leftScoreVal}`, padX + 18, padY + 90);

  // Corazones (izquierda)
  const lifeSize = Math.min(28, CONFIG.lives.size * 0.85);
  const lifeSpacing = lifeSize * 1.65;
  const leftHeartStartX = padX + 34;
  const heartsY = padY + 158;
  if (scoreSystemLeft) {
    for (let i = 0; i < leftLivesVal; i++) {
      scoreSystemLeft.drawHeart(leftHeartStartX + i * lifeSpacing, heartsY, lifeSize, ctx);
    }
  }

  // --- TARJETA EQUIPO DERECHA ---
  const rightCardX = width - padX - cardW;
  ctx.fill(18, 5, 14, 185);
  ctx.stroke(255, 215, 106, 110);
  ctx.strokeWeight(1.8);
  ctx.rect(rightCardX, padY, cardW, cardH, 16);

  ctx.stroke(255, 215, 106, 180);
  ctx.strokeWeight(2.5);
  ctx.line(rightCardX + 18, padY + 62, rightCardX + cardW - 18, padY + 62);
  ctx.noStroke();

  ctx.textAlign(RIGHT, TOP);
  ctx.textFont('Cinzel, Georgia, serif');
  ctx.textStyle(BOLD);
  ctx.textSize(22);
  ctx.fill(0, 0, 0, 180);
  ctx.text('EQUIPO DERECHA', width - padX - 16, padY + 20);
  ctx.fill(255, 223, 128);
  ctx.text('EQUIPO DERECHA', width - padX - 18, padY + 18);

  const rightScoreVal = scoreSystemRight ? Math.floor(scoreSystemRight.displayScore || scoreSystemRight.score) : 0;
  const rightLivesVal = scoreSystemRight ? scoreSystemRight.lives : 0;

  ctx.textFont('Montserrat, sans-serif');
  ctx.textStyle(BOLD);
  ctx.textSize(14);
  ctx.fill(220, 195, 175, 210);
  ctx.text('PUNTOS', width - padX - 18, padY + 74);

  ctx.textFont('Cinzel, Georgia, serif');
  ctx.textSize(36);
  ctx.fill(0, 0, 0, 180);
  ctx.text(`${rightScoreVal}`, width - padX - 16, padY + 92);
  ctx.fill(255, 250, 240);
  ctx.text(`${rightScoreVal}`, width - padX - 18, padY + 90);

  // Corazones (derecha)
  const rightHeartStartX = width - padX - 34;
  if (scoreSystemRight) {
    for (let i = 0; i < rightLivesVal; i++) {
      const x = rightHeartStartX - i * lifeSpacing;
      scoreSystemRight.drawHeart(x, heartsY, lifeSize, ctx);
    }
  }

  ctx.pop();
}

// Efectos de celebración: distorsiones del shader de agua (ondas) + pulso de evento
function applyCelebrationEffects(side, celebration) {
  if (!celebration) return;
  const now = millis();
  const elapsed = now - celebration.start;
  if (elapsed > celebration.duration) return;

  targetEffectIntensity = min(1.0, targetEffectIntensity + (celebration.type === 'win' ? 0.03 : 0.02));

  let cx = 0.5, cy = 0.5;
  if (typeof gameMode !== 'undefined' && gameMode === 'competitive') {
    cx = side === 'left' ? 0.25 : 0.75;
    cy = 0.5;
  }
  if (!celebration._rippleTriggered) {
    const isWin = celebration.type === 'win';
    const color = isWin ? [1.0, 0.85, 0.2] : [1.0, 0.25, 0.25];
    const strength = isWin ? 1.0 : 0.9;
    if (typeof window !== 'undefined' && window.eventRipple) {
      window.eventRipple.active = true;
      window.eventRipple.x = cx;
      window.eventRipple.y = cy;
      window.eventRipple.startTime = millis() / 1000.0;
      window.eventRipple.color = color;
      window.eventRipple.strength = strength;
    }
    createWave(cx * width, cy * height);
    celebration._rippleTriggered = true;
  } else if (frameCount % 22 === 0) {
    createWave(cx * width + random(-80, 80), cy * height + random(-60, 60));
  }
}

// Overlay visual p5.js por lado usando EndAnimation unificada
function drawSideCelebrationOverlay(ctx, side, celebration) {
  if (!celebration) return;
  
  if (!celebration._endAnimation) {
    const leftBound = side === 'left' ? 0 : width / 2;
    celebration._endAnimation = new EndAnimation({
      type: celebration.type,
      side: side,
      x: leftBound,
      y: 0,
      areaWidth: width / 2,
      areaHeight: height
    });
  }
  
  celebration._endAnimation.update();
  celebration._endAnimation.display(ctx);
}

// Volver a la pantalla de inicio cuando terminó la animación de fin de juego
function returnToStandbyIfDone() {
  if (!gameEndTime) return;
  const elapsed = millis() - gameEndTime;
  if (elapsed < gameEndDelay) return;

  leftCelebration = null;
  rightCelebration = null;
  gameEndTime = null;

  if (typeof window !== 'undefined' && window.eventRipple) {
    window.eventRipple.active = false;
  }

  resetGame();
  gameState = 'standby';
  gameMode = null;
  rankingSaved = false;
  if (!selectionScreen) selectionScreen = new ModeSelectionScreen();
  selectionScreen.setup();
  if (tutorialScreen) tutorialScreen.reset();
}
