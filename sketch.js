let Pserver;
let PNT;
let wineGlassSystem;
let particleSystem;
let trailSystem;
let dynamicBackground;
let scoreSystem;

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

// Shader
let feedbackShader;
let shaderLoaded = false;

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
  // Cargar texturas de uvas (imágenes 1, 3, 6, 7, 8)
  grapeTextures.push(loadImage('img/1.jpg'));  // Uvas verdes translúcidas
  grapeTextures.push(loadImage('img/3.jpg'));  // Uvas moradas oscuras
  grapeTextures.push(loadImage('img/6.png'));  // Gota azul
  grapeTextures.push(loadImage('img/7.png'));  // Forma orgánica morada
  grapeTextures.push(loadImage('img/8.jpg'));  // Células azules/moradas
  
  // Cargar texturas de fondo
  backgroundTextures.push(loadImage('img/9.jpg'));  // Explosión de colores
  backgroundTextures.push(loadImage('img/10.jpg')); // Líquido naranja
  backgroundTextures.push(loadImage('img/2.jpg'));  // Patrón radial
  
  // Cargar shader
  feedbackShader = loadShader('feedback.vert', 'feedback.frag');
}

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  frameRate(CONFIG.general.frameRate);
  grapeTexturesLoaded = true;
  backgroundTexturesLoaded = true;
  shaderLoaded = true;
  
  // Crear buffers
  fondoBuffer = createGraphics(width, height, WEBGL);
  juegoBuffer = createGraphics(width, height);
  particulasBuffer = createGraphics(width, height);
  feedbackBuffer = createGraphics(width, height, WEBGL);
  
  // Inicializar sistemas
  Pserver = new PointServer();
  // PNT = new PlayerPntsManager();
  wineGlassSystem = new WineGlassSystem();
  particleSystem = new ParticleSystem();
  trailSystem = new TrailSystem();
  dynamicBackground = new DynamicBackground();
  scoreSystem = new ScoreSystem();
}

function draw() {
  // Actualizar sistemas
  dynamicBackground.update();
  
  // Actualizar intensidad de efectos (smooth lerp)
  effectIntensity = lerp(effectIntensity, targetEffectIntensity, 0.1);
  targetEffectIntensity *= 0.95; // Decay automático
  
  // Calcular combo level (0-1) basado en el combo actual
  let comboLevel = min(1.0, scoreSystem.currentCombo / 20.0); // Máximo en combo x20
  
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
  
  // ===== BUFFER DE FONDO =====
  fondoBuffer.push();
  fondoBuffer.background(5, 5, 10);
  
  // Dibujar texturas rotantes en el buffer de fondo (escaladas x1.6 para más zoom)
  if (backgroundTexturesLoaded && backgroundTextures.length > 0) {
    fondoBuffer.imageMode(CENTER);
    fondoBuffer.translate(0, 0);
    fondoBuffer.rotate(dynamicBackground.textureRotation);
    
    // Textura actual
    fondoBuffer.tint(255, 255, 255, 70 * (1 - dynamicBackground.transitionProgress));
    fondoBuffer.image(backgroundTextures[dynamicBackground.currentTextureIndex], 0, 0, width * 1.6, height * 1.6);
    
    // Textura siguiente (fade in)
    fondoBuffer.tint(255, 255, 255, 70 * dynamicBackground.transitionProgress);
    fondoBuffer.image(backgroundTextures[dynamicBackground.nextTextureIndex], 0, 0, width * 1.6, height * 1.6);
  }
  fondoBuffer.pop();
  
  // ===== BUFFER DE PARTÍCULAS =====
  particulasBuffer.clear();
  particleSystem.update();
  particleSystem.display(particulasBuffer);
  
  // Aplicar shader con feedback al fondo
  feedbackBuffer.shader(feedbackShader);
  feedbackShader.setUniform('u_texture', fondoBuffer);
  feedbackShader.setUniform('u_feedbackTexture', feedbackBuffer);
  feedbackShader.setUniform('u_particlesTexture', particulasBuffer);
  feedbackShader.setUniform('u_gameTexture', juegoBuffer);
  feedbackShader.setUniform('u_resolution', [width, height]);
  feedbackShader.setUniform('u_mouse', [mouseX, mouseY]);
  feedbackShader.setUniform('u_time', millis() / 1000.0);
  feedbackShader.setUniform('u_effectIntensity', effectIntensity);
  feedbackShader.setUniform('u_comboLevel', comboLevel);
  feedbackShader.setUniform('u_vignetteIntensity', vignetteIntensity);
  feedbackBuffer.rect(0, 0, width, height);
  
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

