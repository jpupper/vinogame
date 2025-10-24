let Pserver;
let PNT;
let wineGlassSystem;
let particleSystem;
let trailSystem;
let dynamicBackground;
let scoreSystem;
let medidorIndicator; // antes: barrelIndicator

// Texturas de uvas
let grapeTextures = [];
let grapeTexturesLoaded = false;

// Texturas de fondo
let backgroundTextures = [];
let backgroundTexturesLoaded = false;

// Imágenes de items buenos y malos (desde wineglasses.js)
// Estos arrays son dinámicos y pueden ser modificados por el panel de control
let goodItemImages = [];
let badItemImages = [];

// Hacer los arrays accesibles globalmente para el panel de control
if (typeof window !== 'undefined') {
    window.goodItemImages = goodItemImages;
    window.badItemImages = badItemImages;
    window.backgroundTextures = backgroundTextures;
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

function preload() {
  // Arrays de paths para cargar imágenes
  const backgroundImages = [
    'img/objetos/uva_verde.png',   // Uvas verdes
    'img/objetos/uva_roja.png',    // Uvas rojas
    'img/objetos/uva_roja2.png',   // Uvas rojas 2
    'img/objetos/uva.png',         // Uva genérica
    'img/objetos/gota.png'         // Gota
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
  
  // Cargar imágenes de objetos buenos (desde wineglasses.js)
  goodItemImages.push(loadImage('img/objetos/uva_roja.png'));
  goodItemImages.push(loadImage('img/objetos/uva_roja2.png'));
  goodItemImages.push(loadImage('img/objetos/uva_verde.png'));
  goodItemImages.push(loadImage('img/objetos/uva.png'));
  goodItemImages.push(loadImage('img/objetos/hoja.png'));
  goodItemImages.push(loadImage('img/objetos/copa.png'));
  goodItemImages.push(loadImage('img/objetos/copa2.png'));
  goodItemImages.push(loadImage('img/objetos/botella.png'));
  goodItemImages.push(loadImage('img/objetos/destapador.png'));
  goodItemImages.push(loadImage('img/objetos/destapador2.png'));
  
  // Cargar imágenes de objetos malos (desde wineglasses.js)
  badItemImages.push(loadImage('img/malos/bicho1.png'));
  badItemImages.push(loadImage('img/malos/bicho2.png'));
  badItemImages.push(loadImage('img/malos/bicho3.png'));
  badItemImages.push(loadImage('img/malos/bicho4.png'));
  badItemImages.push(loadImage('img/malos/bicho5.png'));
  badItemImages.push(loadImage('img/malos/bicho6.png'));
  badItemImages.push(loadImage('img/malos/bicho7.png'));
  
  // Cargar shaders
  feedbackShader = loadShader('feedback.vert', 'feedback.frag');
  compositeShader = loadShader('composite.vert', 'composite.frag');
  
  // Crear e inicializar medidor
  medidorIndicator = new MedidorIndicator();
  medidorIndicator.loadAssets();
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
  medidorIndicator.setup();
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
  if (backgroundTexturesLoaded) {
    const len = backgroundTextures.length;
    if (len > 0) {
      feedbackBuffer.shader(compositeShader);
      // Selección segura de texturas
      let tex1, tex2;
      if (len === 1) {
        tex1 = backgroundTextures[0];
        tex2 = backgroundTextures[0];
      } else {
        const idx1 = (dynamicBackground.currentTextureIndex < len) ? dynamicBackground.currentTextureIndex : 0;
        const idx2 = (dynamicBackground.nextTextureIndex < len) ? dynamicBackground.nextTextureIndex : idx1;
        tex1 = backgroundTextures[idx1] || backgroundTextures[0];
        tex2 = backgroundTextures[idx2] || backgroundTextures[0];
      }
      // Robustez: si hay 1 textura, usarla en ambos uniforms; si 0, usar un negro
      if (backgroundTexturesLoaded && backgroundTextures.length > 0) {
        let tex1 = backgroundTextures[dynamicBackground.currentTextureIndex || 0];
        let tex2 = tex1;
        let blend = 0.0;
        if (backgroundTextures.length > 1) {
          tex2 = backgroundTextures[dynamicBackground.nextTextureIndex || 0];
          blend = dynamicBackground.transitionProgress || 0.0;
        }
        compositeShader.setUniform('u_backgroundTexture1', tex1);
        compositeShader.setUniform('u_backgroundTexture2', tex2);
        compositeShader.setUniform('u_backgroundBlend', blend);
      }
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
      
      feedbackBuffer.rect(0, 0, width, height);
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
  
  // Actualizar medidor con nivel de combo
  medidorIndicator.update(comboLevel);
  medidorIndicator.display(juegoBuffer);
  
  // INDICADOR DE SLOW MOTION (en juegoBuffer)
  if (timeScale < 0.9) {
    juegoBuffer.push();
    juegoBuffer.fill(100, 200, 255, 150 * (1 - timeScale));
    juegoBuffer.noStroke();
    juegoBuffer.textAlign(CENTER, CENTER);
    juegoBuffer.textSize(40);
    juegoBuffer.textStyle(BOLD);
    juegoBuffer.text('SLOW MOTION', width/2, 80);
    juegoBuffer.textStyle(NORMAL);
    juegoBuffer.pop();
  }
  
  // FPS (en juegoBuffer)
  const fps = frameRate();
  juegoBuffer.push();
  juegoBuffer.textAlign(LEFT, TOP);
  juegoBuffer.textSize(20);
  juegoBuffer.fill(100, 255, 100);
  juegoBuffer.text(`FPS: ${fps.toFixed(1)}`, 40, 100);
  juegoBuffer.pop();
  
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

// Función displayFPS eliminada - ahora se dibuja en juegoBuffer

