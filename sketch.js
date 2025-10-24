let Pserver;
let PNT;
let wineGlassSystem;
let particleSystem;
let trailSystem;
let dynamicBackground;
let scoreSystem;
let barrelIndicator;

// Texturas de uvas
let grapeTextures = [];
let grapeTexturesLoaded = false;

// Texturas de fondo
let backgroundTextures = [];
let backgroundTexturesLoaded = false;

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

function preload() {
  // Arrays de paths para cargar imágenes
  const backgroundImages = [
    'img/1.jpg',   // Uvas verdes translúcidas
    'img/3.jpg',   // Uvas moradas oscuras
    'img/6.png',   // Gota azul
    'img/7.png',   // Forma orgánica morada
    'img/8.jpg'    // Células azules/moradas
];

const backgroundImagesPaths = [
    'img/background/fondo1.jpg',
    'img/background/fondo2.jpg',
    'img/background/fondo3.jpg',
    'img/background/fondo4.jpg',
    'img/background/fondo5.jpg'
  ];
  
  // Cargar texturas de uvas desde array
  for (let path of backgroundImages) {
    grapeTextures.push(loadImage(path));
  }
  
  // Cargar texturas de fondo desde array
  for (let path of backgroundImagesPaths) {
    backgroundTextures.push(loadImage(path));
  }
  
  // Cargar shaders
  feedbackShader = loadShader('feedback.vert', 'feedback.frag');
  compositeShader = loadShader('composite.vert', 'composite.frag');
  
  // Cargar imagen de uva
  loadGrapeImage();
  
  // Crear e inicializar barril
  barrelIndicator = new BarrelIndicator();
  barrelIndicator.loadAssets();
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  frameRate(CONFIG.general.frameRate);
  grapeTexturesLoaded = true;
  backgroundTexturesLoaded = true;
  shaderLoaded = true;
  
  // Crear buffers
  fondoBuffer = createGraphics(width, height, WEBGL);  // Para feedback simple
  juegoBuffer = createGraphics(width, height);
  particulasBuffer = createGraphics(width, height);
  feedbackBuffer = createGraphics(width, height, WEBGL); // Composición final
  
  // Inicializar sistemas
  Pserver = new PointServer();
  // PNT = new PlayerPntsManager();
  wineGlassSystem = new WineGlassSystem();
  particleSystem = new ParticleSystem();
  trailSystem = new TrailSystem();
  dynamicBackground = new DynamicBackground();
  scoreSystem = new ScoreSystem();
  barrelIndicator.setup();
}

function draw() {
  // Actualizar sistemas
  dynamicBackground.update();
  
  // Actualizar intensidad de efectos (smooth lerp)
  effectIntensity = lerp(effectIntensity, targetEffectIntensity, 0.1);
  targetEffectIntensity *= 0.95; // Decay automático
  
  // Calcular combo level (0-1) basado en el combo actual
  let comboLevel = min(1.0, scoreSystem.comboCount / 20.0); // Máximo en combo x20
  
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
  
  // Actualizar ondas expansivas (limpiar ondas viejas)
  let currentTime = millis() / 1000.0;
  waves = waves.filter(wave => {
    let waveAge = currentTime - wave.startTime;
    return waveAge < 2.0; // Eliminar ondas que tienen más de 2 segundos
  });
  
  // Zoom punch desactivado
  // zoomPunch = lerp(zoomPunch, targetZoom, 0.15);
  // targetZoom = lerp(targetZoom, 1.0, 0.08);
  
  // ===== PASO 1: SHADER DE FEEDBACK (solo efectos de cursor) =====
  // El feedback necesita las texturas de fondo como entrada
  fondoBuffer.push();
  fondoBuffer.shader(feedbackShader);
  
  // Pasar las texturas de fondo al feedback shader
  if (backgroundTexturesLoaded && backgroundTextures.length > 0) {
    feedbackShader.setUniform('u_texture', backgroundTextures[dynamicBackground.currentTextureIndex]);
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
  
  // Pasar ondas expansivas al shader
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
  feedbackShader.setUniform('u_wavePositions', wavePositions);
  feedbackShader.setUniform('u_waveTimes', waveTimes);
  feedbackShader.setUniform('u_waveActive', waveActive);
  
  fondoBuffer.rect(0, 0, width, height);
  fondoBuffer.pop();
  
  // ===== BUFFER DE PARTÍCULAS =====
  particulasBuffer.clear();
  particleSystem.update();
  particleSystem.display(particulasBuffer);
  
  // ===== PASO 2: SHADER DE COMPOSICIÓN (texturas + feedback + ondas) =====
  if (backgroundTexturesLoaded && backgroundTextures.length > 0) {
    feedbackBuffer.shader(compositeShader);
    compositeShader.setUniform('u_backgroundTexture1', backgroundTextures[dynamicBackground.currentTextureIndex]);
    compositeShader.setUniform('u_backgroundTexture2', backgroundTextures[dynamicBackground.nextTextureIndex]);
    compositeShader.setUniform('u_backgroundBlend', dynamicBackground.transitionProgress);
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
    
    feedbackBuffer.rect(0, 0, width, height);
  }
  
  // ===== BUFFER DE JUEGO =====
  juegoBuffer.clear();

  // Actualizar y mostrar rastros (en juegoBuffer)
  trailSystem.update();
  trailSystem.display(juegoBuffer);
  
  // Actualizar y mostrar copas de vino (en juegoBuffer)
  wineGlassSystem.update();
  wineGlassSystem.display(juegoBuffer);

  // Actualizar y mostrar el servidor de puntos (en juegoBuffer)
  Pserver.display(juegoBuffer);
  Pserver.update();
  
  // Comprobar colisiones con copas de vino y items malos
  if (!scoreSystem.gameOver) {
    const allPoints = Pserver.getAllPoints();
    const collisions = wineGlassSystem.checkCollisions(allPoints);
    
    // Procesar copas de vino recolectadas
    for (let collected of collisions.glasses) {
      scoreSystem.addScore(collected.points, collected.x, collected.y);
      particleSystem.createExplosion(collected.x, collected.y, collected.glass.wineColor);
      dynamicBackground.addRipple(collected.x, collected.y);
      
      // ⭐ CREAR ONDA EXPANSIVA ⭐
      createWave(collected.x, collected.y);
      
      // ACTIVAR EFECTOS ESPECIALES
      targetEffectIntensity = min(1.0, targetEffectIntensity + 0.3);
      
      // PARTICLE BURST ESPECIAL en combos milestone
      if (scoreSystem.currentCombo % 5 === 0 && scoreSystem.currentCombo >= 5) {
        // Explosión masiva de partículas
        for (let i = 0; i < 50; i++) {
          particleSystem.createExplosion(
            collected.x + random(-50, 50), 
            collected.y + random(-50, 50), 
            color(255, 200 + random(-50, 50), 0) // Dorado
          );
        }
      }
      
      // SLOW MOTION en combos altos (x10, x15, x20)
      if (scoreSystem.currentCombo === 10 || scoreSystem.currentCombo === 15 || scoreSystem.currentCombo === 20) {
        targetTimeScale = 0.5; // 50% velocidad
        slowMotionDuration = 120; // 2 segundos a 60fps
      }
    }
    
    // Procesar items malos recolectados
    for (let bad of collisions.badItems) {
      scoreSystem.addScore(-bad.penalty, bad.x, bad.y);
      scoreSystem.loseLife();
      particleSystem.createExplosion(bad.x, bad.y, color(255, 0, 0));
      dynamicBackground.addRipple(bad.x, bad.y);
      scoreSystem.resetCombo();
      
      // ACTIVAR EFECTOS ESPECIALES (más intenso para items malos)
      targetEffectIntensity = min(1.0, targetEffectIntensity + 0.5);
      
      // SCREEN SHAKE al perder vida
      shakeAmount = 15;
    }
  }
  
  // Actualizar y mostrar efectos de partículas (en juegoBuffer)
  particleSystem.update();
  particleSystem.display(juegoBuffer);
  
  // Actualizar y mostrar sistema de puntuación (en juegoBuffer)
  scoreSystem.update();
  scoreSystem.display(juegoBuffer);
  
  // Actualizar barril con nivel de combo
  barrelIndicator.update(comboLevel);
  barrelIndicator.display(juegoBuffer);
  
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
  
  // FPS (directo en canvas principal)
  displayFPS();
  
  // INDICADOR DE SLOW MOTION
  if (timeScale < 0.9) {
    push();
    fill(100, 200, 255, 150 * (1 - timeScale));
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(40);
    textStyle(BOLD);
    text('SLOW MOTION', width/2, 80);
    textStyle(NORMAL);
    pop();
  }
  
  pop();
  
  // Agregar rastros para cada punto del servidor
  const allPoints = Pserver.getAllPoints();
  for (let i = 0; i < allPoints.length; i++) {
    const p = allPoints[i];
    if (frameCount % 3 === 0) { // Añadir un punto cada 3 frames para no saturar
      trailSystem.addTrail(p.x, p.y, p.id, color(200, 100, 150));
    }
    
    // Añadir ondas al fondo cuando hay movimiento significativo
    if (frameCount % 30 === 0) {
      dynamicBackground.addRipple(p.x, p.y);
    }
  }
}

// Touch event handlers for p5.js
function touchStarted() {
  // Reiniciar el juego si está en estado de Game Over
  if (scoreSystem && scoreSystem.gameOver) {
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
  if (scoreSystem && scoreSystem.gameOver) {
    resetGame();
  }
}

function resetGame() {
  // Reiniciar todos los sistemas
  Pserver = new PointServer();
  wineGlassSystem = new WineGlassSystem();
  particleSystem = new ParticleSystem();
  trailSystem = new TrailSystem();
  dynamicBackground = new DynamicBackground();
  scoreSystem = new ScoreSystem();
  waves = []; // Limpiar ondas
}

// Función para crear una onda expansiva
function createWave(x, y) {
  // Limitar a MAX_WAVES ondas simultáneas
  if (waves.length >= MAX_WAVES) {
    waves.shift(); // Eliminar la onda más vieja
  }
  
  // Agregar nueva onda
  waves.push({
    x: x / width,        // Normalizar a 0-1
    y: y / height,       // Normalizar a 0-1
    startTime: millis() / 1000.0,
    active: true
  });
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  dynamicBackground.resize();
}

function displayFPS() {
  const fps = frameRate();
  push();
  textAlign(LEFT, TOP);
  textSize(20);
  
  // Texto principal
  fill(100, 255, 100);
  text(`FPS: ${fps.toFixed(1)}`, 40, 100);
  pop();
}

