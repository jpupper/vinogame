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

    display() {
        // Mostrar copas de vino
        for (let glass of this.glasses) {
            glass.display();
        }

        // Mostrar items malos
        for (let item of this.badItems) {
            item.display();
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

    display() {
        push();
        translate(this.x, this.y);
        
        // Efecto de pulso si está siendo hovereado
        const pulseFactor = this.isBeingHovered ? 1 + 0.1 * sin(this.pulsePhase * 3) : 1;
        
        // Aura si está siendo hovereado
        if (this.isBeingHovered) {
            noStroke();
            for (let i = 3; i > 0; i--) {
                fill(255, 255, 0, 30);
                ellipse(0, 0, this.size * (1.3 + i * 0.1) * pulseFactor);
            }
        }
        
        // Dibujar copa
        this.drawGlass(pulseFactor);
        
        // Barra de progreso de hover
        if (this.hoverTime > 0) {
            this.drawProgressBar();
        }
        
        pop();
    }

    drawGlass(pulseFactor) {
        const scale = pulseFactor;
        
        // Calcular nivel de llenado: 0 = vacío, 1 = lleno
        const fillLevel = 1 - (this.hoverTime / this.requiredHoverTime);
        
        // BASE DE LA COPA (abajo)
        fill(180, 180, 180);
        stroke(140, 140, 140);
        strokeWeight(2);
        ellipse(0, 40 * scale, 20 * scale, 6 * scale);
        
        // TALLO (vertical)
        strokeWeight(3);
        stroke(160, 160, 160);
        line(0, 40 * scale, 0, 15 * scale);
        
        // VINO DENTRO (dibujar primero)
        if (fillLevel > 0.05) {
            noStroke();
            fill(this.wineColor);
            
            // El vino va desde el borde superior (y=-25) hasta el fondo (y=10)
            // fillLevel 1 = lleno hasta arriba, fillLevel 0 = vacío
            const wineBottom = 10 * scale; // Fondo de la copa
            const wineTop = lerp(10, -25, fillLevel) * scale; // Superficie del vino
            const wineHeight = wineBottom - wineTop;
            
            if (wineHeight > 0) {
                // Calcular ancho del vino según la altura
                const topWidth = lerp(18, 13, fillLevel);
                
                // Cuerpo del vino
                beginShape();
                vertex(-18 * scale, wineBottom);
                vertex(18 * scale, wineBottom);
                vertex(topWidth * scale, wineTop);
                vertex(-topWidth * scale, wineTop);
                endShape(CLOSE);
                
                // Superficie del vino (elipse)
                fill(red(this.wineColor) + 20, green(this.wineColor) + 20, blue(this.wineColor) + 20, 180);
                ellipse(0, wineTop, topWidth * 2 * scale, 5 * scale);
            }
        }
        
        // CONTORNO DE LA COPA (vidrio transparente)
        noFill();
        stroke(220, 230, 240, 200);
        strokeWeight(2.5);
        
        // Lado izquierdo
        line(-18 * scale, 10 * scale, -13 * scale, -25 * scale);
        // Lado derecho
        line(18 * scale, 10 * scale, 13 * scale, -25 * scale);
        // Borde superior
        arc(0, -25 * scale, 26 * scale, 8 * scale, 0, PI);
        
        // Línea del fondo
        noFill();
        stroke(200, 210, 220, 150);
        strokeWeight(1.5);
        ellipse(0, 10 * scale, 36 * scale, 6 * scale);
        
        // BRILLO en el vidrio
        noStroke();
        fill(255, 255, 255, 120);
        ellipse(-6 * scale, -10 * scale, 4 * scale, 15 * scale);
        fill(255, 255, 255, 60);
        ellipse(8 * scale, 0, 3 * scale, 10 * scale);
    }

    drawProgressBar() {
        const barWidth = 40;
        const barHeight = 5;
        const progress = this.hoverTime / this.requiredHoverTime;
        
        // Fondo de la barra
        noStroke();
        fill(50, 50, 50, 150);
        rect(-barWidth/2, -50, barWidth, barHeight, 2);
        
        // Progreso
        fill(255, 200, 0);
        rect(-barWidth/2, -50, barWidth * progress, barHeight, 2);
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

    drawGlass(pulseFactor) {
        const scale = pulseFactor;
        
        // Calcular nivel de llenado: 0 = vacío, 1 = lleno
        const fillLevel = 1 - (this.hoverTime / this.requiredHoverTime);
        
        // VINO DENTRO DE LA BOTELLA (dibujar primero)
        if (fillLevel > 0.05) {
            noStroke();
            fill(this.wineColor);
            
            // Vino en el cuerpo - forma realista de botella
            const wineBottom = 30 * scale;
            const wineTop = lerp(30, -15, fillLevel) * scale;
            
            if (wineBottom - wineTop > 0) {
                beginShape();
                // Base ancha
                vertex(-11 * scale, wineBottom);
                vertex(11 * scale, wineBottom);
                // Hombros de la botella
                vertex(11 * scale, max(wineTop, -15 * scale));
                if (wineTop < -15 * scale) {
                    vertex(8 * scale, -15 * scale);
                    vertex(8 * scale, wineTop);
                    vertex(-8 * scale, wineTop);
                    vertex(-8 * scale, -15 * scale);
                }
                vertex(-11 * scale, max(wineTop, -15 * scale));
                endShape(CLOSE);
            }
        }
        
        // VIDRIO DE LA BOTELLA (verde oscuro transparente)
        // Cuerpo principal
        fill(35, 70, 35, 80);
        stroke(25, 50, 25);
        strokeWeight(2.5);
        
        // Forma de botella Bordeaux clásica
        beginShape();
        vertex(-12 * scale, 32 * scale);  // Base
        vertex(-12 * scale, -12 * scale); // Subir recto
        vertex(-9 * scale, -15 * scale);  // Hombro
        vertex(-5 * scale, -18 * scale);  // Cuello
        vertex(-5 * scale, -35 * scale);  // Arriba del cuello
        vertex(5 * scale, -35 * scale);   // Cruzar
        vertex(5 * scale, -18 * scale);   // Bajar cuello
        vertex(9 * scale, -15 * scale);   // Hombro derecho
        vertex(12 * scale, -12 * scale);  // Bajar
        vertex(12 * scale, 32 * scale);   // Base derecha
        endShape(CLOSE);
        
        // Fondo de la botella (concavidad)
        fill(25, 50, 25);
        noStroke();
        ellipse(0, 32 * scale, 18 * scale, 5 * scale);
        
        // CÁPSULA (papel aluminio sobre el corcho)
        fill(140, 30, 40);
        stroke(100, 20, 30);
        strokeWeight(1.5);
        
        // Parte superior de la cápsula
        ellipse(0, -35 * scale, 11 * scale, 5 * scale);
        
        // Cuerpo de la cápsula
        noStroke();
        beginShape();
        vertex(-5.5 * scale, -35 * scale);
        vertex(-5.5 * scale, -30 * scale);
        vertex(-6 * scale, -28 * scale);
        vertex(6 * scale, -28 * scale);
        vertex(5.5 * scale, -30 * scale);
        vertex(5.5 * scale, -35 * scale);
        endShape(CLOSE);
        
        // Anillos de la cápsula
        stroke(100, 20, 30);
        strokeWeight(0.8);
        noFill();
        line(-5.5 * scale, -32 * scale, 5.5 * scale, -32 * scale);
        line(-5.8 * scale, -29 * scale, 5.8 * scale, -29 * scale);
        
        // ETIQUETA PRINCIPAL
        noStroke();
        fill(245, 240, 230);
        rect(-10 * scale, 2 * scale, 20 * scale, 20 * scale, 1);
        
        // Borde dorado de la etiqueta
        noFill();
        stroke(180, 140, 60);
        strokeWeight(1.2);
        rect(-9.5 * scale, 2.5 * scale, 19 * scale, 19 * scale, 1);
        
        // Escudo/Logo en la etiqueta
        noStroke();
        fill(120, 20, 40);
        
        // Forma de escudo
        beginShape();
        vertex(0, 7 * scale);
        vertex(-4 * scale, 8 * scale);
        vertex(-4 * scale, 14 * scale);
        vertex(0, 17 * scale);
        vertex(4 * scale, 14 * scale);
        vertex(4 * scale, 8 * scale);
        endShape(CLOSE);
        
        // Detalles del escudo
        fill(180, 140, 60);
        textAlign(CENTER, CENTER);
        textSize(4 * scale);
        textStyle(BOLD);
        text('VR', 0, 12 * scale);
        textStyle(NORMAL);
        
        // Texto en la etiqueta
        fill(80, 80, 80);
        textSize(2.5 * scale);
        text('RESERVA', 0, 19 * scale);
        
        // ETIQUETA SECUNDARIA (cuello)
        fill(245, 240, 230);
        noStroke();
        rect(-4 * scale, -24 * scale, 8 * scale, 6 * scale, 0.5);
        
        fill(120, 20, 40);
        textSize(2 * scale);
        text('2024', 0, -21 * scale);
        
        // BRILLOS en el vidrio
        noStroke();
        fill(255, 255, 255, 80);
        ellipse(-7 * scale, 0, 3 * scale, 30 * scale);
        fill(255, 255, 255, 50);
        ellipse(8 * scale, 8 * scale, 2 * scale, 20 * scale);
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

    display() {
        push();
        translate(this.x, this.y);
        
        // Aura roja de peligro
        const pulseFactor = 1 + 0.1 * sin(this.pulsePhase);
        noStroke();
        for (let i = 3; i > 0; i--) {
            fill(255, 0, 0, 20);
            ellipse(0, 0, this.size * (1.2 + i * 0.1) * pulseFactor);
        }
        
        // Dibujar según tipo
        switch(this.itemType) {
            case 'whiskey':
                this.drawWhiskey();
                break;
            case 'daiquiri':
                this.drawDaiquiri();
                break;
            case 'energyDrink':
                this.drawEnergyDrink();
                break;
            case 'soda':
                this.drawSoda();
                break;
        }
        
        // Símbolo de peligro (X)
        stroke(255, 0, 0);
        strokeWeight(3);
        line(-8, -45, 8, -35);
        line(8, -45, -8, -35);
        
        pop();
    }

    drawWhiskey() {
        // VASO DE WHISKEY - Vaso bajo y ancho
        
        // Whiskey dentro (dibujar primero)
        noStroke();
        fill(200, 130, 50, 220);
        beginShape();
        vertex(-16, 22);
        vertex(-14, 5);
        vertex(14, 5);
        vertex(16, 22);
        endShape(CLOSE);
        
        // Cubos de hielo
        fill(220, 240, 255, 180);
        stroke(180, 200, 220, 150);
        strokeWeight(1);
        rect(-7, 8, 9, 9, 1);
        rect(3, 11, 8, 8, 1);
        
        // Reflejos en el hielo
        noStroke();
        fill(255, 255, 255, 120);
        rect(-6, 9, 3, 3);
        rect(4, 12, 3, 3);
        
        // Contorno del vaso
        noFill();
        stroke(220, 230, 240, 200);
        strokeWeight(2.5);
        beginShape();
        vertex(-17, 25);
        vertex(-14, -15);
        vertex(14, -15);
        vertex(17, 25);
        endShape(CLOSE);
        
        // Base gruesa del vaso
        fill(200, 210, 220, 150);
        stroke(180, 190, 200);
        strokeWeight(1.5);
        rect(-19, 25, 38, 5, 2);
        
        // Brillo en el vidrio
        noStroke();
        fill(255, 255, 255, 100);
        ellipse(-9, 0, 5, 18);
        fill(255, 255, 255, 60);
        ellipse(10, 10, 4, 12);
    }

    drawDaiquiri() {
        // COPA DAIQUIRI - Copa ancha tipo margarita
        
        // Base de la copa
        fill(180, 180, 180);
        stroke(140, 140, 140);
        strokeWeight(2);
        ellipse(0, 35, 18, 5);
        
        // Tallo
        strokeWeight(3);
        stroke(160, 160, 160);
        line(0, 35, 0, 12);
        
        // Bebida tropical dentro
        noStroke();
        fill(80, 220, 140, 220);
        beginShape();
        vertex(-22, -18);
        vertex(22, -18);
        vertex(13, 8);
        vertex(-13, 8);
        endShape(CLOSE);
        
        // Superficie de la bebida
        fill(100, 240, 160, 180);
        quad(-22, -18, 22, -18, 18, -20, -18, -20);
        
        // Contorno de la copa
        noFill();
        stroke(220, 230, 240, 200);
        strokeWeight(2.5);
        beginShape();
        vertex(-24, -20);
        vertex(24, -20);
        vertex(14, 12);
        vertex(-14, 12);
        endShape(CLOSE);
        
        // Borde de la copa
        stroke(200, 210, 220, 150);
        strokeWeight(1.5);
        line(-24, -20, 24, -20);
        
        // Sombrilla decorativa
        stroke(255, 80, 100);
        strokeWeight(2);
        line(8, -8, 8, -22);
        
        // Paraguas de la sombrilla
        fill(255, 80, 100);
        noStroke();
        arc(8, -22, 18, 12, PI, TWO_PI);
        
        // Detalles del paraguas
        stroke(200, 60, 80);
        strokeWeight(1);
        for (let i = -1; i <= 1; i++) {
            line(8 + i * 5, -22, 8 + i * 5, -28);
        }
        
        // Brillo en el vidrio
        noStroke();
        fill(255, 255, 255, 100);
        ellipse(-10, -5, 6, 15);
    }

    drawEnergyDrink() {
        // LATA DE ENERGIZANTE
        
        // Cuerpo de la lata (negro/azul oscuro)
        fill(20, 25, 35);
        stroke(40, 45, 55);
        strokeWeight(2);
        rect(-11, -28, 22, 53, 2);
        
        // Tapa superior
        fill(70, 75, 85);
        stroke(50, 55, 65);
        strokeWeight(1.5);
        ellipse(0, -28, 22, 6);
        
        // Anillo de apertura
        fill(90, 95, 105);
        noStroke();
        ellipse(0, -28, 6, 3);
        rect(-1, -28, 2, 4);
        
        // Banda de color
        noStroke();
        fill(0, 180, 255);
        rect(-11, -10, 22, 8);
        fill(255, 220, 0);
        rect(-11, -2, 22, 8);
        
        // Logo - Rayo energético
        fill(255, 220, 0);
        beginShape();
        vertex(2, -20);
        vertex(-6, -5);
        vertex(-1, -5);
        vertex(-4, 10);
        vertex(6, -5);
        vertex(1, -5);
        endShape(CLOSE);
        
        // Sin texto ENERGY
        
        // Brillo metálico
        noStroke();
        fill(255, 255, 255, 60);
        rect(-9, -25, 3, 48, 1);
        fill(255, 255, 255, 30);
        rect(7, -25, 2, 48, 1);
    }

    drawSoda() {
        // BOTELLA DE GASEOSA - Diseño más amigable
        
        // Líquido dentro (gaseosa clara)
        noStroke();
        fill(230, 245, 210, 200);
        
        // Forma del líquido siguiendo la botella
        beginShape();
        vertex(-10, 25);
        vertex(-10, 0);
        vertex(-8, -8);
        vertex(8, -8);
        vertex(10, 0);
        vertex(10, 25);
        endShape(CLOSE);
        
        // Burbujas en el líquido
        fill(255, 255, 255, 180);
        ellipse(-4, 2, 5, 5);
        ellipse(5, 6, 4, 4);
        ellipse(-2, 12, 3, 3);
        ellipse(6, 16, 5, 5);
        ellipse(-5, 20, 4, 4);
        ellipse(3, 22, 3, 3);
        
        // Cuerpo de la botella (plástico transparente con tinte verde)
        fill(80, 180, 100, 60);
        stroke(60, 140, 80);
        strokeWeight(2);
        
        // Forma suave de botella
        beginShape();
        vertex(-11, 28);
        vertex(-11, 2);
        vertex(-10, -10);
        vertex(-7, -26);
        vertex(-6, -32);
        vertex(6, -32);
        vertex(7, -26);
        vertex(10, -10);
        vertex(11, 2);
        vertex(11, 28);
        endShape(CLOSE);
        
        // Base de la botella
        fill(60, 140, 80, 100);
        stroke(50, 120, 70);
        strokeWeight(1.5);
        ellipse(0, 28, 22, 6);
        
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
