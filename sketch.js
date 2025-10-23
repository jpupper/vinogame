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
let feedbackBuffer;

// Shader
let feedbackShader;
let shaderLoaded = false;

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
  
  // Aplicar shader con feedback al fondo
  feedbackBuffer.shader(feedbackShader);
  feedbackShader.setUniform('u_texture', fondoBuffer);
  feedbackShader.setUniform('u_feedbackTexture', feedbackBuffer);
  feedbackShader.setUniform('u_resolution', [width, height]);
  feedbackShader.setUniform('u_mouse', [mouseX, mouseY]);
  feedbackShader.setUniform('u_time', millis() / 1000.0);
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
    }
    
    // Procesar items malos recolectados
    for (let bad of collisions.badItems) {
      scoreSystem.addScore(-bad.penalty, bad.x, bad.y);
      scoreSystem.loseLife();
      particleSystem.createExplosion(bad.x, bad.y, color(255, 0, 0));
      dynamicBackground.addRipple(bad.x, bad.y);
      scoreSystem.resetCombo();
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
  translate(-width/2, -height/2);
  imageMode(CORNER);
  
  // Dibujar fondo con shader
  image(feedbackBuffer, 0, 0);
  
  // Dibujar juego encima
  image(juegoBuffer, 0, 0);
  
  // FPS (directo en canvas principal)
  displayFPS();
  
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

