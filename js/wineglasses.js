// Imágenes de items buenos y malos (se cargan en sketch.js preload())
// Las variables goodItemImages y badItemImages se declaran en sketch.js

// Sistema de copas de vino que caen
class WineGlassSystem {
    constructor() {
        this.glasses = [];
        this.badItems = [];
        this.lastSpawnTime = 0;
        this.spawnInterval = CONFIG.wineGlasses.spawnInterval;
        // Nuevos límites máximos de items simultáneos
        this.maxGoodItems = (CONFIG.wineGlasses && typeof CONFIG.wineGlasses.maxGoodItems !== 'undefined') ? CONFIG.wineGlasses.maxGoodItems : 100;
        this.maxBadItems = (CONFIG.wineGlasses && typeof CONFIG.wineGlasses.maxBadItems !== 'undefined') ? CONFIG.wineGlasses.maxBadItems : 100;
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
        // Evitar crear items si los assets aún no están listos
        if (typeof window !== 'undefined' && window.assetsReady === false) {
            return;
        }
        const rand = random(1);
        const x = random(width * 0.1, width * 0.9);
        
        // Gating por máximos configurados: no crear nuevos si ya alcanzó el límite
        const canSpawnBad = this.badItems.length < this.maxBadItems;
        const canSpawnGood = this.glasses.length < this.maxGoodItems;

        // 30% malo, 70% bueno, pero respetando límites
        if (rand < 0.3) {
            if (canSpawnBad) {
                this.badItems.push(new Item(x, true)); // isBad = true
            } else if (canSpawnGood) {
                // Si no se puede malo, intenta bueno
                this.glasses.push(new Item(x, false));
            }
        } else {
            if (canSpawnGood) {
                this.glasses.push(new Item(x, false)); // isBad = false
            } else if (canSpawnBad) {
                // Si no se puede bueno, intenta malo
                this.badItems.push(new Item(x, true));
            }
        }
    }

    checkCollisions(points) {
        let collectedGlasses = [];
        let collectedBadItems = [];

        // Limitar puntos a un área de colisión configurable (si está habilitada)
        let pointsToCheck = points;
        const area = (typeof window !== 'undefined') ? window.collisionArea : null;
        if (area && area.enabled && typeof area.x === 'number') {
            pointsToCheck = points.filter(p => (
                p && typeof p.x === 'number' && typeof p.y === 'number' &&
                p.x >= area.x && p.x <= area.x + area.width &&
                p.y >= area.y && p.y <= area.y + area.height
            ));
        }

        // Verificar colisiones con copas de vino
        for (let i = this.glasses.length - 1; i >= 0; i--) {
            const glass = this.glasses[i];
            
            for (let point of pointsToCheck) {
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
            
            for (let point of pointsToCheck) {
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
            
            // Dibujar imagen del item malo o círculo si no hay imágenes
            if (badItemImages.length > 0 && badItemImages[this.imageIndex]) {
                ctx.push();
                ctx.scale(pulseFactor);
                ctx.tint(255, 100, 100); // Tinte rojizo
                ctx.imageMode(CENTER);
                
                // Usar imagen pre-escalada si está disponible
                const scaledImg = window.getScaledImage && window.getScaledImage(badItemImages, this.imageIndex, this.size, true);
                if (scaledImg) {
                    ctx.image(scaledImg, 0, 0);
                } else {
                    const img = badItemImages[this.imageIndex];
                    if (img && img.width && img.height) {
                        ctx.push();
                        const s = this.size / Math.max(img.width, img.height);
                        ctx.scale(s);
                        ctx.image(img, 0, 0);
                        ctx.pop();
                    }
                }
                ctx.pop();
            } else {
                // Fallback: círculo rojo
                //ctx.noStroke();
                //ctx.fill(200, 30, 30);
                //ctx.ellipse(0, 0, this.size * pulseFactor);
            }
        } else {
            // ===== ITEM BUENO =====
            const captureProgress = this.hoverTime / this.requiredHoverTime;
            const maxScale = CONFIG.wineGlasses.captureScale;
            const scaleFactor = 1.0 + captureProgress * (maxScale - 1.0);
            const pulseFactor = this.isBeingHovered ? 1 + 0.05 * sin(this.pulsePhase * 4) : 1;
            
            // Dibujar imagen del item bueno o círculo si no hay imágenes
            if (goodItemImages.length > 0 && goodItemImages[this.imageIndex]) {
                ctx.push();
                ctx.scale(scaleFactor * pulseFactor);
                const brightness = 1.0 + captureProgress * 0.4;
                ctx.tint(255 * brightness, 255 * brightness, 255 * brightness);
                ctx.imageMode(CENTER);
                
                // Usar imagen pre-escalada si está disponible
                const scaledImg = window.getScaledImage && window.getScaledImage(goodItemImages, this.imageIndex, this.size, false);
                if (scaledImg) {
                    ctx.image(scaledImg, 0, 0);
                } else {
                    const img = goodItemImages[this.imageIndex];
                    if (img && img.width && img.height) {
                        ctx.push();
                        const s = this.size / Math.max(img.width, img.height);
                        ctx.scale(s);
                        ctx.image(img, 0, 0);
                        ctx.pop();
                    }
                }
                ctx.pop();
            } else {
                // Fallback: círculo dorado
                //ctx.noStroke();
                //ctx.fill(255, 215, 80);
                //ctx.ellipse(0, 0, this.size * pulseFactor * scaleFactor);
            }
            
            // Barra de progreso
            //if (this.hoverTime > 0 && captureProgress < 0.95) {
             //   this.drawProgressBar(ctx);
           // }
        }
        
        ctx.pop();
    }
    
  
 /*drawProgressBar(ctx = window) {
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
    }*/
}
