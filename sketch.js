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
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  frameRate(CONFIG.general.frameRate);
  grapeTexturesLoaded = true;
  backgroundTexturesLoaded = true;
  
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
  // Dibujar fondo dinámico primero
  dynamicBackground.update();
  dynamicBackground.display();
  
  // Mostrar FPS
  displayFPS();

  // Actualizar y mostrar rastros
  trailSystem.update();
  trailSystem.display();
  
  // Actualizar y mostrar copas de vino
  wineGlassSystem.update();
  wineGlassSystem.display();

  // Actualizar y mostrar el servidor de puntos
  Pserver.display();
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
  
  // Actualizar y mostrar efectos de partículas
  particleSystem.update();
  particleSystem.display();
  
  // Actualizar y mostrar sistema de puntuación
  scoreSystem.update();
  scoreSystem.display();
  
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

