// Imágenes de items buenos (se cargan globalmente)
let goodItemImages = [];
let badItemImages = [];

// Cargar imágenes de items buenos
function loadGrapeImage() {
    goodItemImages.push(loadImage('img/uva_roja.png'));
    goodItemImages.push(loadImage('img/uva_roja2.png'));
    goodItemImages.push(loadImage('img/uva_verde.png'));
    goodItemImages.push(loadImage('img/uva.png'));
    goodItemImages.push(loadImage('img/hoja.png'));
    goodItemImages.push(loadImage('img/copa.png'));
    goodItemImages.push(loadImage('img/copa2.png'));
    goodItemImages.push(loadImage('img/botella.png'));
    goodItemImages.push(loadImage('img/destapador.png'));
    goodItemImages.push(loadImage('img/destapador2.png'));
    
    // Cargar imágenes de items malos (bichos)
    badItemImages.push(loadImage('img/bicho1.png'));
    badItemImages.push(loadImage('img/bicho2.png'));
    badItemImages.push(loadImage('img/bicho3.png'));
    badItemImages.push(loadImage('img/bicho4.png'));
    badItemImages.push(loadImage('img/bicho5.png'));
    badItemImages.push(loadImage('img/bicho6.png'));
    badItemImages.push(loadImage('img/bicho7.png'));
}

// Sistema de copas de vino que caen
class WineGlassSystem {
    constructor() {
        this.glasses = [];
        this.badItems = [];
        this.lastSpawnTime = 0;
        this.spawnInterval = CONFIG.wineGlasses.spawnInterval;
    }

    update() {
        // Generar nuevas copas/items
        if (millis() - this.lastSpawnTime > this.spawnInterval) {
            this.spawnItem();
            this.lastSpawnTime = millis();
        }

        // Actualizar copas de vino
        for (let i = this.glasses.length - 1; i >= 0; i--) {
            this.glasses[i].update();
            
            // Verificar si la copa salió de la pantalla
            if (this.glasses[i].isOffScreen()) {
                this.glasses.splice(i, 1);
            }
        }

        // Actualizar items malos
        for (let i = this.badItems.length - 1; i >= 0; i--) {
            this.badItems[i].update();
            
            // Verificar si el item salió de la pantalla
            if (this.badItems[i].isOffScreen()) {
                this.badItems.splice(i, 1);
            }
        }
    }

    display(ctx = window) {
        // Mostrar copas de vino
        for (let glass of this.glasses) {
            glass.display(ctx);
        }

        // Mostrar items malos
        for (let item of this.badItems) {
            item.display(ctx);
        }
    }

    spawnItem() {
        const rand = random(1);
        const x = random(width * 0.1, width * 0.9);
        
        // 30% de probabilidad de item malo
        if (rand < 0.3) {
            this.badItems.push(new Item(x, true)); // isBad = true
        }
        // 70% de probabilidad de item bueno
        else {
            this.glasses.push(new Item(x, false)); // isBad = false
        }
    }

    checkCollisions(points) {
        let collectedGlasses = [];
        let collectedBadItems = [];

        // Verificar colisiones con copas de vino
        for (let i = this.glasses.length - 1; i >= 0; i--) {
            const glass = this.glasses[i];
            
            for (let point of points) {
                const d = dist(glass.x, glass.y, point.x, point.y);
                
                if (d < glass.size / 2) {
                    // Punto está sobre la copa
                    glass.addHoverTime();
                    
                    // Si se completó el hover
                    if (glass.isCompleted()) {
                        collectedGlasses.push({
                            glass: glass,
                            x: glass.x,
                            y: glass.y,
                            points: glass.getPoints()
                        });
                        this.glasses.splice(i, 1);
                        break;
                    }
                }
            }
        }

        // Verificar colisiones con items malos
        for (let i = this.badItems.length - 1; i >= 0; i--) {
            const item = this.badItems[i];
            
            for (let point of points) {
                const d = dist(item.x, item.y, point.x, point.y);
                
                if (d < item.size / 2) {
                    collectedBadItems.push({
                        item: item,
                        x: item.x,
                        y: item.y,
                        penalty: item.penalty
                    });
                    this.badItems.splice(i, 1);
                    break;
                }
            }
        }

        return {
            glasses: collectedGlasses,
            badItems: collectedBadItems
        };
    }
}

// Clase ÚNICA para items (buenos y malos)
class Item {
    constructor(x, isBad = false) {
        this.x = x;
        this.y = -50;
        this.speed = random(CONFIG.wineGlasses.speed.min, CONFIG.wineGlasses.speed.max);
        this.size = CONFIG.wineGlasses.itemSize; // Tamaño único para todos
        this.isBad = isBad; // true = malo, false = bueno
        
        if (isBad) {
            // ITEM MALO
            this.imageIndex = floor(random(badItemImages.length));
            this.penalty = CONFIG.wineGlasses.badItemPenalty;
            this.points = 0;
        } else {
            // ITEM BUENO
            this.imageIndex = floor(random(goodItemImages.length));
            
            // Tipo de vino: blanco, tinto, rosado
            const wineTypes = ['white', 'red', 'rose'];
            this.wineType = random(wineTypes);
            this.wineColor = this.getWineColor();
            this.points = CONFIG.wineGlasses.points[this.wineType];
            this.penalty = 0;
        }
        
        // Sistema de hover (solo para buenos)
        this.hoverTime = 0;
        this.requiredHoverTime = CONFIG.wineGlasses.hoverTime;
        this.isBeingHovered = false;
        
        // Animación
        this.pulsePhase = random(TWO_PI);
    }

    getWineColor() {
        switch(this.wineType) {
            case 'white':
                return color(245, 235, 150, 200); // Amarillo dorado
            case 'red':
                return color(120, 20, 40, 220); // Rojo vino oscuro
            case 'rose':
                return color(230, 120, 140, 200); // Rosa suave
            default:
                return color(120, 20, 40, 220);
        }
    }

    update() {
        // Usar timeScale global si existe, sino usar 1.0
        const ts = (typeof timeScale !== 'undefined') ? timeScale : 1.0;
        this.y += this.speed * ts;
        this.pulsePhase += 0.05 * ts;
        
        // NO resetear hover - mantener el progreso aunque sueltes
        this.isBeingHovered = false;
    }

    addHoverTime() {
        this.isBeingHovered = true;
        this.hoverTime += 16; // ~1 frame a 60fps
    }

    isCompleted() {
        return this.hoverTime >= this.requiredHoverTime;
    }

    getPoints() {
        return this.points;
    }

    isOffScreen() {
        return this.y > height + 100;
    }

    display(ctx = window) {
        ctx.push();
        ctx.translate(this.x, this.y);
        
        if (this.isBad) {
            // ===== ITEM MALO =====
            const pulseFactor = 1 + 0.15 * sin(this.pulsePhase * 2);
            const rotation = this.pulsePhase * 0.5;
            
            // Aura roja de peligro
            ctx.noStroke();
            for (let i = 3; i > 0; i--) {
                ctx.fill(255, 0, 0, 30 + i * 10);
                ctx.ellipse(0, 0, this.size * (1.3 + i * 0.15) * pulseFactor);
            }
            
            // Dibujar imagen de bicho
            if (badItemImages.length > 0 && badItemImages[this.imageIndex]) {
                ctx.push();
                ctx.rotate(rotation);
                ctx.scale(pulseFactor);
                ctx.tint(255, 100, 100); // Tinte rojizo
                ctx.imageMode(CENTER);
                ctx.image(badItemImages[this.imageIndex], 0, 0, this.size, this.size);
                ctx.pop();
            }
        } else {
            // ===== ITEM BUENO =====
            const captureProgress = this.hoverTime / this.requiredHoverTime;
            const maxScale = CONFIG.wineGlasses.captureScale;
            const scaleFactor = 1.0 + captureProgress * (maxScale - 1.0);
            const rotation = captureProgress * PI;
            const pulseFactor = this.isBeingHovered ? 1 + 0.05 * sin(this.pulsePhase * 4) : 1;
            
            // Glow dorado
            if (this.isBeingHovered || captureProgress > 0) {
                ctx.noStroke();
                for (let i = 3; i > 0; i--) {
                    const glowSize = this.size * (1.2 + i * 0.1 + captureProgress * 0.3) * pulseFactor * scaleFactor;
                    const glowAlpha = (15 - i * 3) * (0.3 + captureProgress * 0.4);
                    const r = 255;
                    const g = 255 - captureProgress * 100;
                    const b = 0 + captureProgress * 50;
                    ctx.fill(r, g, b, glowAlpha);
                    ctx.ellipse(0, 0, glowSize);
                }
            }
            
            // Dibujar imagen del item bueno
            if (goodItemImages.length > 0 && goodItemImages[this.imageIndex]) {
                ctx.push();
                ctx.rotate(rotation);
                ctx.scale(scaleFactor * pulseFactor);
                const brightness = 1.0 + captureProgress * 0.4;
                ctx.tint(255 * brightness, 255 * brightness, 255 * brightness);
                ctx.imageMode(CENTER);
                ctx.image(goodItemImages[this.imageIndex], 0, 0, this.size, this.size);
                ctx.pop();
            }
            
            // Barra de progreso
            if (this.hoverTime > 0 && captureProgress < 0.95) {
                this.drawProgressBar(ctx);
            }
        }
        
        ctx.pop();
    }
    
    // Dibujar partículas orbitando alrededor de la uva
    drawOrbitingParticles(ctx, progress, scale) {
        const particleCount = floor(progress * 8); // Hasta 8 partículas
        const orbitRadius = this.size * 0.8 * scale;
        
        ctx.noStroke();
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * TWO_PI + this.pulsePhase * 2;
            const x = cos(angle) * orbitRadius;
            const y = sin(angle) * orbitRadius;
            
            // Tamaño de partícula
            const particleSize = 4 + progress * 4;
            
            // Color dorado brillante
            ctx.fill(255, 220, 100, 200);
            ctx.ellipse(x, y, particleSize);
            
            // Núcleo más brillante
            ctx.fill(255, 255, 200, 255);
            ctx.ellipse(x, y, particleSize * 0.5);
        }
    }

    drawGlass(pulseFactor, ctx = window) {
        const scale = pulseFactor;
        
        // Calcular nivel de llenado: 0 = vacío, 1 = lleno
        const fillLevel = 1 - (this.hoverTime / this.requiredHoverTime);
        
        // BASE DE LA COPA (abajo)
        ctx.fill(180, 180, 180);
        ctx.stroke(140, 140, 140);
        ctx.strokeWeight(2);
        ctx.ellipse(0, 40 * scale, 20 * scale, 6 * scale);
        
        // TALLO (vertical)
        ctx.strokeWeight(3);
        ctx.stroke(160, 160, 160);
        ctx.line(0, 40 * scale, 0, 15 * scale);
        
        // VINO DENTRO (dibujar primero)
        if (fillLevel > 0.05) {
            ctx.noStroke();
            ctx.fill(this.wineColor);
            
            // El vino va desde el borde superior (y=-25) hasta el fondo (y=10)
            // fillLevel 1 = lleno hasta arriba, fillLevel 0 = vacío
            const wineBottom = 10 * scale; // Fondo de la copa
            const wineTop = lerp(10, -25, fillLevel) * scale; // Superficie del vino
            const wineHeight = wineBottom - wineTop;
            
            if (wineHeight > 0) {
                // Calcular ancho del vino según la altura
                const topWidth = lerp(18, 13, fillLevel);
                
                // Cuerpo del vino
                ctx.beginShape();
                ctx.vertex(-18 * scale, wineBottom);
                ctx.vertex(18 * scale, wineBottom);
                ctx.vertex(topWidth * scale, wineTop);
                ctx.vertex(-topWidth * scale, wineTop);
                ctx.endShape(CLOSE);
                
                // Superficie del vino (elipse)
                ctx.fill(red(this.wineColor) + 20, green(this.wineColor) + 20, blue(this.wineColor) + 20, 180);
                ctx.ellipse(0, wineTop, topWidth * 2 * scale, 5 * scale);
            }
        }
        
        // CONTORNO DE LA COPA (vidrio transparente)
        ctx.noFill();
        ctx.stroke(220, 230, 240, 200);
        ctx.strokeWeight(2.5);
        
        // Lado izquierdo
        ctx.line(-18 * scale, 10 * scale, -13 * scale, -25 * scale);
        // Lado derecho
        ctx.line(18 * scale, 10 * scale, 13 * scale, -25 * scale);
        // Borde superior
        ctx.arc(0, -25 * scale, 26 * scale, 8 * scale, 0, PI);
        
        // Línea del fondo
        ctx.noFill();
        ctx.stroke(200, 210, 220, 150);
        ctx.strokeWeight(1.5);
        ctx.ellipse(0, 10 * scale, 36 * scale, 6 * scale);
        
        // BRILLO en el vidrio
        ctx.noStroke();
        ctx.fill(255, 255, 255, 120);
        ctx.ellipse(-6 * scale, -10 * scale, 4 * scale, 15 * scale);
        ctx.fill(255, 255, 255, 60);
        ctx.ellipse(8 * scale, 0, 3 * scale, 10 * scale);
    }

    drawProgressBar(ctx = window) {
        const barWidth = 40;
        const barHeight = 5;
        const progress = this.hoverTime / this.requiredHoverTime;
        
        // Fondo de la barra
        ctx.noStroke();
        ctx.fill(50, 50, 50, 150);
        ctx.rect(-barWidth/2, -50, barWidth, barHeight, 2);
        
        // Progreso
        ctx.fill(255, 200, 0);
        ctx.rect(-barWidth/2, -50, barWidth * progress, barHeight, 2);
    }
}
