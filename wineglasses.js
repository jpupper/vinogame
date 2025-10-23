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
        
        // 10% de probabilidad de botella
        if (rand < 0.1) {
            this.glasses.push(new WineBottle(random(width * 0.1, width * 0.9)));
        }
        // 30% de probabilidad de item malo
        else if (rand < 0.4) {
            this.badItems.push(new BadItem(random(width * 0.1, width * 0.9)));
        }
        // 60% de probabilidad de copa de vino normal
        else {
            this.glasses.push(new WineGlass(random(width * 0.1, width * 0.9)));
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

// Clase base para copa de vino
class WineGlass {
    constructor(x) {
        this.x = x;
        this.y = -50;
        this.speed = random(CONFIG.wineGlasses.speed.min, CONFIG.wineGlasses.speed.max);
        this.size = CONFIG.wineGlasses.glassSize * CONFIG.wineGlasses.globalSize;
        
        // Tipo de vino: blanco, tinto, rosado
        const wineTypes = ['white', 'red', 'rose'];
        this.wineType = random(wineTypes);
        
        // Colores según tipo de vino
        this.wineColor = this.getWineColor();
        
        // Sistema de hover
        this.hoverTime = 0;
        this.requiredHoverTime = CONFIG.wineGlasses.hoverTime;
        this.isBeingHovered = false;
        
        // Puntos según tipo
        this.points = CONFIG.wineGlasses.points[this.wineType];
        
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
        this.y += this.speed;
        this.pulsePhase += 0.05;
        
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
        
        // Efecto de pulso si está siendo hovereado
        const pulseFactor = this.isBeingHovered ? 1 + 0.1 * sin(this.pulsePhase * 3) : 1;
        
        // Aura si está siendo hovereado
        if (this.isBeingHovered) {
            ctx.noStroke();
            for (let i = 3; i > 0; i--) {
                ctx.fill(255, 255, 0, 30);
                ctx.ellipse(0, 0, this.size * (1.3 + i * 0.1) * pulseFactor);
            }
        }
        
        // Dibujar copa
        this.drawGlass(pulseFactor, ctx);
        
        // Barra de progreso de hover
        if (this.hoverTime > 0) {
            this.drawProgressBar(ctx);
        }
        
        ctx.pop();
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

// Clase para botella de vino (vale más puntos)
class WineBottle extends WineGlass {
    constructor(x) {
        super(x);
        this.size = CONFIG.wineGlasses.bottleSize * CONFIG.wineGlasses.globalSize;
        this.points = CONFIG.wineGlasses.bottlePoints;
        this.wineType = random(['white', 'red', 'rose']);
        this.wineColor = this.getWineColor();
    }

    drawGlass(pulseFactor, ctx = window) {
        const scale = pulseFactor;
        
        // Calcular nivel de llenado: 0 = vacío, 1 = lleno
        const fillLevel = 1 - (this.hoverTime / this.requiredHoverTime);
        
        // Sombra de la botella
        ctx.push();
        ctx.translate(3 * scale, 3 * scale);
        ctx.noStroke();
        ctx.fill(0, 0, 0, 40);
        ctx.beginShape();
        ctx.vertex(-12 * scale, 32 * scale);
        ctx.vertex(-12 * scale, -12 * scale);
        ctx.vertex(-9 * scale, -15 * scale);
        ctx.vertex(-5 * scale, -18 * scale);
        ctx.vertex(-5 * scale, -35 * scale);
        ctx.vertex(5 * scale, -35 * scale);
        ctx.vertex(5 * scale, -18 * scale);
        ctx.vertex(9 * scale, -15 * scale);
        ctx.vertex(12 * scale, -12 * scale);
        ctx.vertex(12 * scale, 32 * scale);
        ctx.endShape(CLOSE);
        ctx.pop();
        
        // VINO DENTRO DE LA BOTELLA (dibujar primero)
        if (fillLevel > 0.05) {
            ctx.noStroke();
            ctx.fill(this.wineColor);
            
            // Vino en el cuerpo - forma realista de botella
            const wineBottom = 30 * scale;
            const wineTop = lerp(30, -15, fillLevel) * scale;
            
            if (wineBottom - wineTop > 0) {
                ctx.beginShape();
                // Base ancha
                ctx.vertex(-11 * scale, wineBottom);
                ctx.vertex(11 * scale, wineBottom);
                // Hombros de la botella
                ctx.vertex(11 * scale, max(wineTop, -15 * scale));
                if (wineTop < -15 * scale) {
                    ctx.vertex(8 * scale, -15 * scale);
                    ctx.vertex(8 * scale, wineTop);
                    ctx.vertex(-8 * scale, wineTop);
                    ctx.vertex(-8 * scale, -15 * scale);
                }
                ctx.vertex(-11 * scale, max(wineTop, -15 * scale));
                ctx.endShape(CLOSE);
            }
            
            // Reflejo del vino
            ctx.fill(red(this.wineColor) + 30, green(this.wineColor) + 30, blue(this.wineColor) + 30, 100);
            ctx.ellipse(-7 * scale, (wineTop + wineBottom) / 2, 2 * scale, (wineBottom - wineTop) * 0.3);
        }
        
        // VIDRIO DE LA BOTELLA (verde oscuro transparente con gradiente)
        // Cuerpo principal - lado oscuro
        ctx.fill(25, 55, 25, 100);
        ctx.stroke(15, 40, 15);
        ctx.strokeWeight(2.5);
        
        // Forma de botella Bordeaux clásica
        ctx.beginShape();
        ctx.vertex(-12 * scale, 32 * scale);  // Base
        ctx.vertex(-12 * scale, -12 * scale); // Subir recto
        ctx.vertex(-9 * scale, -15 * scale);  // Hombro
        ctx.vertex(-5 * scale, -18 * scale);  // Cuello
        ctx.vertex(-5 * scale, -35 * scale);  // Arriba del cuello
        ctx.vertex(5 * scale, -35 * scale);   // Cruzar
        ctx.vertex(5 * scale, -18 * scale);   // Bajar cuello
        ctx.vertex(9 * scale, -15 * scale);   // Hombro derecho
        ctx.vertex(12 * scale, -12 * scale);  // Bajar
        ctx.vertex(12 * scale, 32 * scale);   // Base derecha
        ctx.endShape(CLOSE);
        
        // Lado iluminado (más claro)
        ctx.fill(40, 75, 40, 120);
        ctx.noStroke();
        ctx.beginShape();
        ctx.vertex(-11 * scale, 31 * scale);
        ctx.vertex(-11 * scale, -11 * scale);
        ctx.vertex(-8.5 * scale, -14 * scale);
        ctx.vertex(-4.5 * scale, -17 * scale);
        ctx.vertex(-4.5 * scale, -34 * scale);
        ctx.vertex(-5.5 * scale, -34 * scale);
        ctx.vertex(-5.5 * scale, -18 * scale);
        ctx.vertex(-9 * scale, -15 * scale);
        ctx.vertex(-12 * scale, -12 * scale);
        ctx.vertex(-12 * scale, 31 * scale);
        ctx.endShape(CLOSE);
        
        // Fondo de la botella (concavidad)
        ctx.fill(15, 35, 15);
        ctx.noStroke();
        ctx.ellipse(0, 32 * scale, 18 * scale, 5 * scale);
        ctx.fill(25, 50, 25, 150);
        ctx.ellipse(0, 31 * scale, 14 * scale, 4 * scale);
        
        // CÁPSULA (papel aluminio sobre el corcho)
        ctx.fill(140, 30, 40);
        ctx.stroke(100, 20, 30);
        ctx.strokeWeight(1.5);
        
        // Parte superior de la cápsula
        ctx.ellipse(0, -35 * scale, 11 * scale, 5 * scale);
        
        // Cuerpo de la cápsula
        ctx.noStroke();
        ctx.beginShape();
        ctx.vertex(-5.5 * scale, -35 * scale);
        ctx.vertex(-5.5 * scale, -30 * scale);
        ctx.vertex(-6 * scale, -28 * scale);
        ctx.vertex(6 * scale, -28 * scale);
        ctx.vertex(5.5 * scale, -30 * scale);
        ctx.vertex(5.5 * scale, -35 * scale);
        ctx.endShape(CLOSE);
        
        // Anillos de la cápsula
        ctx.stroke(100, 20, 30);
        ctx.strokeWeight(0.8);
        ctx.noFill();
        ctx.line(-5.5 * scale, -32 * scale, 5.5 * scale, -32 * scale);
        ctx.line(-5.8 * scale, -29 * scale, 5.8 * scale, -29 * scale);
        
        // ETIQUETA PRINCIPAL
        ctx.noStroke();
        ctx.fill(245, 240, 230);
        ctx.rect(-10 * scale, 2 * scale, 20 * scale, 20 * scale, 1);
        
        // Borde dorado de la etiqueta
        ctx.noFill();
        ctx.stroke(180, 140, 60);
        ctx.strokeWeight(1.2);
        ctx.rect(-9.5 * scale, 2.5 * scale, 19 * scale, 19 * scale, 1);
        
        // Escudo/Logo en la etiqueta
        ctx.noStroke();
        ctx.fill(120, 20, 40);
        
        // Forma de escudo
        ctx.beginShape();
        ctx.vertex(0, 7 * scale);
        ctx.vertex(-4 * scale, 8 * scale);
        ctx.vertex(-4 * scale, 14 * scale);
        ctx.vertex(0, 17 * scale);
        ctx.vertex(4 * scale, 14 * scale);
        ctx.vertex(4 * scale, 8 * scale);
        ctx.endShape(CLOSE);
        
        // Detalles del escudo
        ctx.fill(180, 140, 60);
        ctx.textAlign(CENTER, CENTER);
        ctx.textSize(4 * scale);
        ctx.textStyle(BOLD);
        ctx.text('VR', 0, 12 * scale);
        ctx.textStyle(NORMAL);
        
        // Texto en la etiqueta
        ctx.fill(80, 80, 80);
        ctx.textSize(2.5 * scale);
        ctx.text('RESERVA', 0, 19 * scale);
        
        // ETIQUETA SECUNDARIA (cuello)
        ctx.fill(245, 240, 230);
        ctx.noStroke();
        ctx.rect(-4 * scale, -24 * scale, 8 * scale, 6 * scale, 0.5);
        
        ctx.fill(120, 20, 40);
        ctx.textSize(2 * scale);
        ctx.text('2024', 0, -21 * scale);
        
        // BRILLOS en el vidrio
        ctx.noStroke();
        ctx.fill(255, 255, 255, 80);
        ctx.ellipse(-7 * scale, 0, 3 * scale, 30 * scale);
        ctx.fill(255, 255, 255, 50);
        ctx.ellipse(8 * scale, 8 * scale, 2 * scale, 20 * scale);
    }
}

// Clase para items malos
class BadItem {
    constructor(x) {
        this.x = x;
        this.y = -50;
        this.speed = random(CONFIG.wineGlasses.speed.min, CONFIG.wineGlasses.speed.max);
        this.size = CONFIG.wineGlasses.badItemSize * CONFIG.wineGlasses.globalSize;
        
        // Tipos de items malos
        const badTypes = ['whiskey', 'daiquiri', 'energyDrink', 'soda'];
        this.itemType = random(badTypes);
        
        this.penalty = CONFIG.wineGlasses.badItemPenalty;
        this.pulsePhase = random(TWO_PI);
    }

    update() {
        this.y += this.speed;
        this.pulsePhase += 0.05;
    }

    isOffScreen() {
        return this.y > height + 100;
    }

    display(ctx = window) {
        ctx.push();
        ctx.translate(this.x, this.y);
        
        // Aura roja de peligro
        const pulseFactor = 1 + 0.1 * sin(this.pulsePhase);
        ctx.noStroke();
        for (let i = 3; i > 0; i--) {
            ctx.fill(255, 0, 0, 20);
            ctx.ellipse(0, 0, this.size * (1.2 + i * 0.1) * pulseFactor);
        }
        
        // Dibujar según tipo
        switch(this.itemType) {
            case 'whiskey':
                this.drawWhiskey(ctx);
                break;
            case 'daiquiri':
                this.drawDaiquiri(ctx);
                break;
            case 'energyDrink':
                this.drawEnergyDrink(ctx);
                break;
            case 'soda':
                this.drawSoda(ctx);
                break;
        }
        
        ctx.pop();
    }

    drawWhiskey(ctx = window) {
        // VASO DE WHISKEY - Vaso bajo y ancho
        
        // Whiskey dentro
        ctx.noStroke();
        ctx.fill(200, 130, 50, 220);
        ctx.beginShape();
        ctx.vertex(-16, 22);
        ctx.vertex(-14, 5);
        ctx.vertex(14, 5);
        ctx.vertex(16, 22);
        ctx.endShape(CLOSE);
        
        // Cubos de hielo
        ctx.fill(220, 240, 255, 180);
        ctx.stroke(180, 200, 220, 150);
        ctx.strokeWeight(1);
        ctx.rect(-7, 8, 9, 9, 1);
        ctx.rect(3, 11, 8, 8, 1);
        
        // Contorno del vaso
        ctx.noFill();
        ctx.stroke(220, 230, 240, 200);
        ctx.strokeWeight(2.5);
        ctx.beginShape();
        ctx.vertex(-17, 25);
        ctx.vertex(-14, -15);
        ctx.vertex(14, -15);
        ctx.vertex(17, 25);
        ctx.endShape(CLOSE);
        
        // Base del vaso
        ctx.fill(200, 210, 220, 150);
        ctx.stroke(180, 190, 200);
        ctx.strokeWeight(1.5);
        ctx.rect(-19, 25, 38, 5, 2);
        
        // Brillo
        ctx.noStroke();
        ctx.fill(255, 255, 255, 100);
        ctx.ellipse(-9, 0, 5, 18);
    }

    drawDaiquiri(ctx = window) {
        // COPA DAIQUIRI - Copa ancha tipo margarita
        
        // Base y tallo
        ctx.fill(180, 180, 180);
        ctx.stroke(140, 140, 140);
        ctx.strokeWeight(2);
        ctx.ellipse(0, 35, 18, 5);
        ctx.strokeWeight(3);
        ctx.line(0, 35, 0, 12);
        
        // Bebida tropical
        ctx.noStroke();
        ctx.fill(80, 220, 140, 220);
        ctx.beginShape();
        ctx.vertex(-22, -18);
        ctx.vertex(22, -18);
        ctx.vertex(13, 8);
        ctx.vertex(-13, 8);
        ctx.endShape(CLOSE);
        
        // Contorno de la copa
        ctx.noFill();
        ctx.stroke(220, 230, 240, 200);
        ctx.strokeWeight(2.5);
        ctx.beginShape();
        ctx.vertex(-24, -20);
        ctx.vertex(24, -20);
        ctx.vertex(14, 12);
        ctx.vertex(-14, 12);
        ctx.endShape(CLOSE);
        
        // Sombrilla
        ctx.stroke(255, 80, 100);
        ctx.strokeWeight(2);
        ctx.line(8, -8, 8, -22);
        ctx.fill(255, 80, 100);
        ctx.noStroke();
        ctx.arc(8, -22, 18, 12, PI, TWO_PI);
    }

    drawEnergyDrink(ctx = window) {
        // LATA DE ENERGIZANTE
        
        // Cuerpo de la lata
        ctx.fill(20, 25, 35);
        ctx.stroke(40, 45, 55);
        ctx.strokeWeight(2);
        ctx.rect(-11, -28, 22, 53, 2);
        
        // Tapa superior
        ctx.fill(70, 75, 85);
        ctx.stroke(50, 55, 65);
        ctx.strokeWeight(1.5);
        ctx.ellipse(0, -28, 22, 6);
        
        // Bandas de color
        ctx.noStroke();
        ctx.fill(0, 180, 255);
        ctx.rect(-11, -10, 22, 8);
        ctx.fill(255, 220, 0);
        ctx.rect(-11, -2, 22, 8);
        
        // Logo - Rayo
        ctx.fill(255, 220, 0);
        ctx.beginShape();
        ctx.vertex(2, -20);
        ctx.vertex(-6, -5);
        ctx.vertex(-1, -5);
        ctx.vertex(-4, 10);
        ctx.vertex(6, -5);
        ctx.vertex(1, -5);
        ctx.endShape(CLOSE);
        
        // Brillo metálico
        ctx.noStroke();
        ctx.fill(255, 255, 255, 60);
        ctx.rect(-9, -25, 3, 48, 1);
    }

    drawSoda(ctx = window) {
        // BOTELLA DE GASEOSA
        
        // Líquido dentro
        ctx.noStroke();
        ctx.fill(230, 245, 210, 200);
        ctx.beginShape();
        ctx.vertex(-10, 25);
        ctx.vertex(-10, 0);
        ctx.vertex(-8, -8);
        ctx.vertex(8, -8);
        ctx.vertex(10, 0);
        ctx.vertex(10, 25);
        ctx.endShape(CLOSE);
        
        // Burbujas
        ctx.fill(255, 255, 255, 180);
        ctx.ellipse(-4, 2, 5, 5);
        ctx.ellipse(5, 6, 4, 4);
        ctx.ellipse(-2, 12, 3, 3);
        ctx.ellipse(6, 16, 5, 5);
        
        // Cuerpo de la botella
        ctx.fill(80, 180, 100, 60);
        ctx.stroke(60, 140, 80);
        ctx.strokeWeight(2);
        ctx.beginShape();
        ctx.vertex(-11, 28);
        ctx.vertex(-11, 2);
        ctx.vertex(-10, -10);
        ctx.vertex(-7, -26);
        ctx.vertex(-6, -32);
        ctx.vertex(6, -32);
        ctx.vertex(7, -26);
        ctx.vertex(10, -10);
        ctx.vertex(11, 2);
        ctx.vertex(11, 28);
        ctx.endShape(CLOSE);
        
        // Base
        ctx.fill(60, 140, 80, 100);
        ctx.ellipse(0, 28, 22, 6);
        
        // Tapa rosca (plástico verde)
        fill(80, 180, 100);
        stroke(60, 140, 80);
        strokeWeight(1.5);
        
        // Cuerpo de la tapa
        rect(-7, -36, 14, 5, 1);
        ellipse(0, -36, 14, 5);
        
        // Anillos de la tapa
        noFill();
        stroke(60, 140, 80);
        strokeWeight(1);
        line(-6, -34, 6, -34);
        line(-6, -32, 6, -32);
        
        // Etiqueta blanca
        noStroke();
        fill(255, 255, 255);
        rect(-9, 6, 18, 18, 2);
        
        // Borde de la etiqueta
        noFill();
        stroke(200, 200, 200);
        strokeWeight(1);
        rect(-9, 6, 18, 18, 2);
        
        // Logo - Círculo verde suave
        noStroke();
        fill(100, 200, 120);
        ellipse(0, 15, 12, 12);
        
        // Hoja en el logo
        fill(80, 180, 100);
        beginShape();
        vertex(0, 11);
        bezierVertex(-3, 12, -3, 16, 0, 17);
        bezierVertex(3, 16, 3, 12, 0, 11);
        endShape(CLOSE);
        
        // Texto
        fill(80, 180, 100);
        textAlign(CENTER, CENTER);
        textSize(3);
        textStyle(BOLD);
        text('NATURAL', 0, 21);
        textStyle(NORMAL);
        
        // Brillos en el plástico
        noStroke();
        fill(255, 255, 255, 100);
        ellipse(-6, 2, 4, 25);
        fill(255, 255, 255, 60);
        ellipse(7, 12, 3, 18);
    }
}
