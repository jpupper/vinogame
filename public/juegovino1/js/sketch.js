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
  
  // Medidor/trofeo: se cargan desde AssetManager.initialLoad(); instancias se crean en setup()

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
  
  // NO configurar fuente en WEBGL - causa errores
  // La fuente se configura en los buffers 2D individuales
  
  // Crear buffers
  fondoBuffer = createGraphics(width, height, WEBGL);  // Para feedback simple
  fondoBuffer.canvas.getContext('webgl', { willReadFrequently: true });
  
  juegoBuffer = createGraphics(width, height);
  juegoBuffer.canvas.getContext('webgl', { willReadFrequently: true });
  
  particulasBuffer = createGraphics(width, height);
  particulasBuffer.canvas.getContext('webgl', { willReadFrequently: true });
  
  feedbackBuffer = createGraphics(width, height, WEBGL); // Composición final
  feedbackBuffer.canvas.getContext('webgl', { willReadFrequently: true });
  

  
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
  dynamicBackground = new DynamicBackground();
  scoreSystem = new ScoreSystem();
  // Crear e inicializar medidores (usar assets centralizados)
  medidorIndicator = new MedidorIndicator(); // cooperativo
  // Configurar medidores competitivos
  // Bajar medidores para mejorar la legibilidad del HUD competitivo
  medidorIndicatorLeft = new MedidorIndicator({ position: { x: 40, y: 260 } });
  medidorIndicatorRight = new MedidorIndicator({ position: { x: width - 140 - 40, y: 260 } });

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
  
  // Actualizar ondas expansivas (limpiar ondas viejas) - optimizado para ejecutar menos frecuentemente
  let currentTime = millis() / 1000.0;
  if (frameCount % 5 === 0) { // Solo cada 5 frames
    waves = waves.filter(wave => {
      let waveAge = currentTime - wave.startTime;
      return waveAge < 2.0; // Eliminar ondas que tienen más de 2 segundos
    });
  }
  // Animación sutil en standby (ondas suaves): mover a dibujarPantallaStandBy

  // Pipeline de shaders centralizado
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
  
  // Dibujar fondo con shader (si está habilitado). Si está oculto, dibujamos un plano negro
  if (!(typeof window !== 'undefined' && window.hideBackground)) {
    image(feedbackBuffer, 0, 0);
  } else {
    noStroke();
    fill(0);
    rect(0, 0, width, height);
  }
  
  // Dibujar juego encima
  image(juegoBuffer, 0, 0);
  
  // Dibujar assets SIN feedback (después del shader)
  if (typeof wineGlassSystem !== 'undefined' && wineGlassSystem) {
    wineGlassSystem.displayAssetsOnly();
  }
  
  // Overlay visual del área de colisión (opcional)
  if (typeof window !== 'undefined' && window.collisionArea && window.collisionArea.enabled && window.collisionArea.showOverlay) {
    const ca = window.collisionArea;
    push();
    // Rectángulo VERDE semitransparente
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

  // Agregar rastros para cada punto del servidor - optimizado
  if (frameCount % 3 === 0) { // Solo cada 3 frames
    const allPoints = Pserver.getAllPoints();
    for (let i = 0; i < allPoints.length; i++) {
      const p = allPoints[i];
     
      
      // Añadir ondas al fondo cuando hay movimiento significativo
      if (frameCount % 30 === 0) {
        dynamicBackground.addRipple(p.x, p.y);
      }
    }
  }

  

}

// ====== Pantallas específicas ======
function dibujarPantallaStandBy(ctx) {
  // Animación sutil en standby: ondas suaves ocasionales
  if (frameCount % 60 === 0) {
    const wx = random(width * 0.25, width * 0.75);
    const wy = random(height * 0.3, height * 0.7);
    createWave(wx, wy);
    dynamicBackground.addRipple(wx, wy);
  }

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
        if (frameCount % 8 === 0) {
          createWave(p.x, p.y);
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
  // NO dibujar assets aquí - solo halos en el shader
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
    ctx.text(`FPS: ${fps.toFixed(1)}`, 40, 100);
    ctx.fill(255, 180, 70);
    ctx.text(`Puntos (count): ${pointsCount}`, 40, 125);
    ctx.pop();
  }
}

function dibujarPantallaCompetitiva(ctx) {
  if (!scoreSystemLeft) scoreSystemLeft = new ScoreSystem();
  if (!scoreSystemRight) scoreSystemRight = new ScoreSystem();
  wineGlassSystem.update();
  // NO dibujar assets aquí - solo halos en el shader
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
  // HUD básico (etiquetas, score y corazones)
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
  // Mostrar HUD/animaciones existentes
  if (gameMode === 'competitive') {
    // Asegurar que las animaciones de victoria/derrota y partículas se ACTUALICEN y se dibujen
    // En gameover competitivo: actualizar sistemas pero evitar sus textos centrados
    if (scoreSystemLeft) { scoreSystemLeft.update(); }
    if (scoreSystemRight) { scoreSystemRight.update(); }
    // Mostrar overlays laterales con el resultado por equipo
    drawSideCelebrationOverlay(ctx, 'left', leftCelebration);
    drawSideCelebrationOverlay(ctx, 'right', rightCelebration);
  } else if (scoreSystem) {
    // En estado final, seguir actualizando para que las partículas no se congelen
    scoreSystem.update();
    scoreSystem.display(ctx);
  }
  // Retorno automático al standby si corresponde
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
    // Verificar que selectionScreen esté inicializado
    if (!selectionScreen) {
      selectionScreen = new ModeSelectionScreen();
      selectionScreen.setup();
    }
    const selected = selectionScreen.handleClick(mouseX, mouseY);
    if (selected) {
      const startPlaying = () => {
        gameMode = selected;
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
  // Mantener referencia en window para background.js
  if (typeof window !== 'undefined') window.waves = waves;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// Función para pre-escalar imágenes y optimizar rendimiento
function preScaleImages() {
  if (typeof window !== 'undefined' && window.AssetManager) {
    window.AssetManager.preScaleImages();
  }
}

// Función para obtener imagen escalada más cercana
function getScaledImage(imageArray, index, targetSize, isBad = false) {
  if (typeof window !== 'undefined' && window.AssetManager) {
    return window.AssetManager.getScaledImage(imageArray, index, targetSize, isBad);
  }
  return null;
}

// Función para obtener imagen de fondo escalada
function getScaledBackgroundImage(index) {
  if (typeof window !== 'undefined' && window.AssetManager) {
    return window.AssetManager.getScaledBackgroundImage(index);
  }
  return null;
}

// Nota: la función global window.ensureAssetsReady la expone AssetManager.
// Evitamos redeclararla aquí para no crear envolturas circulares que puedan
// provocar recursión accidental y desbordes de pila.

// HUD para competitivo (dos equipos)
function displayCompetitiveHUD(ctx = window) {
  ctx.push();
  // Solo HUD: etiquetas, scores y corazones. Sin overlays de GANASTE/PERDISTE ni trofeos.
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
  const heartsY = 200; // bajar corazones para que no choquen con medidores
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

  ctx.pop();
}

// Efectos de celebración: distorsiones del shader (ondas) + explosiones de partículas
function applyCelebrationEffects(side, celebration) {
  if (!celebration) return;
  const now = millis();
  const elapsed = now - celebration.start;
  if (elapsed > celebration.duration) return;

  // Ajuste sutil de intensidad de feedback, sin ondas ni explosiones
  targetEffectIntensity = min(1.0, targetEffectIntensity + (celebration.type === 'win' ? 0.03 : 0.02));

  // Disparar una onda de evento en el shader (una sola vez por celebración)
  if (!celebration._rippleTriggered) {
    const isWin = celebration.type === 'win';
    // Centro normalizado según modo/side
    let cx = 0.5, cy = 0.5;
    if (typeof gameMode !== 'undefined' && gameMode === 'competitive') {
      cx = side === 'left' ? 0.25 : 0.75;
      cy = 0.5;
    }
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
    celebration._rippleTriggered = true;
  }
}

// Overlay visual p5.js por lado usando EndAnimation unificada
function drawSideCelebrationOverlay(ctx, side, celebration) {
  if (!celebration) return;
  
  // Crear instancia de EndAnimation si no existe
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
  
  // Actualizar y mostrar la animación
  celebration._endAnimation.update();
  celebration._endAnimation.display(ctx);
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

  // Apagar onda de evento
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

