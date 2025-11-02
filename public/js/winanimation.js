class WinAnimation {
    constructor() {
        this.startTime = millis();
        this.duration = (CONFIG.win && CONFIG.win.duration) ? CONFIG.win.duration : 5000;
        // Partículas de victoria: uvas pequeñas que caen
        this.grapes = [];
        this.particles = []; // mantener compatibilidad interna (no se usa para chispas)
        this.letters = [];
        this.scaledTrophyImage = null;

        const baseColor = (CONFIG.win && CONFIG.win.text && CONFIG.win.text.color)
            ? CONFIG.win.text.color
            : [255, 215, 0]; // Dorado por defecto

        // Parámetros de "uvas chiquitas"
        this.grapeColor = [150, 60, 180]; // morado uva
        this.highlightColor = [255, 220, 255];
        this.spawnDuration = this.duration * 0.7; // 70% del tiempo caen uvas
        this.spawnRate = 20; // uvas por segundo
        this.lastSpawn = this.startTime;
        this.gravity = 0.18;
        this.floorY = height - 30; // piso simbólico para que se junten abajo

        // Pre-spawn inicial para que se vean inmediatamente
        for (let i = 0; i < 40; i++) {
            this.grapes.push(this.createGrape(random(0, width), random(-height * 0.4, -10)));
        }

        // Configurar letras para "GANASTE"
        const text = "GANASTE";
        const spacing = width * ((CONFIG.win && CONFIG.win.text && CONFIG.win.text.spacing) ? CONFIG.win.text.spacing : 0.07);
        const startX = width/2 - (text.length * spacing) / 2 + spacing/2;
        const targetSize = height * ((CONFIG.win && CONFIG.win.text && CONFIG.win.text.size) ? CONFIG.win.text.size : 0.15);

        for (let i = 0; i < text.length; i++) {
            this.letters.push({
                char: text[i],
                targetX: startX + i * spacing,
                targetY: height/2,
                currentX: random(-width, width * 2),
                currentY: random(-height, height * 2),
                rotation: random(TWO_PI),
                targetRotation: 0,
                size: 0,
                targetSize: targetSize,
                intensity: random(200, 255) // brillo dorado
            });
        }

        // Sonido de victoria (si está disponible)
        try {
            if (typeof soundFormats === 'function') {
                this.winSound = loadSound('sounds/win.mp3');
                this.winSound.play();
            }
        } catch (e) {
            console.log('Sound not supported or file not found');
        }
    }

    createGrape(x, y) {
        const size = random(6, 14);
        return {
            pos: createVector(x, y),
            vel: createVector(random(-0.8, 0.8), random(2, 6)),
            rot: random(TWO_PI),
            rotSpeed: random(-0.03, 0.03),
            size: size,
            life: 255,
            alphaDecay: random(0.4, 0.8),
            wobblePhase: random(TWO_PI)
        };
    }

    update() {
        const elapsed = millis() - this.startTime;
        const progress = constrain(elapsed / this.duration, 0, 1);

        // Spawner de uvas durante parte de la animación
        if (elapsed < this.spawnDuration) {
            const targetSpawns = this.spawnRate * (deltaTime / 1000.0);
            // emitir un número fraccional aproximado por frame
            const count = floor(targetSpawns) + (random() < (targetSpawns % 1) ? 1 : 0);
            for (let i = 0; i < count; i++) {
                this.grapes.push(this.createGrape(random(0, width), random(-height * 0.1, -10)));
            }
        }

        // Actualizar uvas: caída con gravedad, leve wobble y acumulación en el piso
        for (let g of this.grapes) {
            g.vel.y += this.gravity;
            g.pos.add(g.vel);
            g.rot += g.rotSpeed;
            // Wobble horizontal suave
            g.wobblePhase += 0.05;
            g.pos.x += sin(g.wobblePhase) * 0.2;

            // Piso
            if (g.pos.y > this.floorY) {
                g.pos.y = this.floorY;
                g.vel.y *= -0.25; // rebote pequeño
                g.vel.x *= 0.7;
                // se va apagando lentamente en el piso
                g.life -= g.alphaDecay;
            }
        }
        this.grapes = this.grapes.filter(g => g.life > 10);

        // Actualizar letras con easing
        for (let i = 0; i < this.letters.length; i++) {
            const letter = this.letters[i];
            const letterProgress = constrain((progress - 0.2 - i * 0.05) * 3, 0, 1);
            const easing = this.easeOutElastic(letterProgress);

            letter.currentX = lerp(letter.currentX, letter.targetX, easing * 0.2);
            letter.currentY = lerp(letter.currentY, letter.targetY, easing * 0.2);
            letter.rotation = lerp(letter.rotation, letter.targetRotation, easing * 0.1);
            letter.size = lerp(letter.size, letter.targetSize, easing * 0.1);
        }
    }

    display(ctx = window) {
        ctx.push();

        // Fondo suave
        ctx.fill(0, 0, 0, 120);
        ctx.rect(0, 0, width, height);

        // Uvas caídas: círculos pequeños con brillo y borde sutil
        for (let g of this.grapes) {
            const alpha = g.life;
            const c = this.grapeColor;
            // Borde oscuro
            ctx.noStroke();
            ctx.fill(c[0]*0.6, c[1]*0.6, c[2]*0.6, alpha);
            ctx.ellipse(g.pos.x, g.pos.y, g.size * 1.05, g.size * 1.05);
            // Cuerpo
            ctx.fill(c[0], c[1], c[2], alpha);
            ctx.ellipse(g.pos.x, g.pos.y, g.size, g.size);
            // Brillo pequeño
            ctx.fill(this.highlightColor[0], this.highlightColor[1], this.highlightColor[2], alpha);
            ctx.ellipse(g.pos.x - g.size*0.2, g.pos.y - g.size*0.25, g.size*0.25, g.size*0.25);
        }

        // Letras "GANASTE"
        const baseColor = (CONFIG.win && CONFIG.win.text && CONFIG.win.text.color)
            ? CONFIG.win.text.color
            : [255, 215, 0];

        for (let letter of this.letters) {
            ctx.push();
            ctx.translate(letter.currentX, letter.currentY);
            ctx.rotate(letter.rotation);

            // Sombra
            ctx.fill(0, 0, 0, 150);
            ctx.textSize(letter.size);
            ctx.textAlign(CENTER, CENTER);
            ctx.text(letter.char, 5, 5);

            // Texto dorado
            ctx.fill(
                letter.intensity * baseColor[0]/255,
                letter.intensity * baseColor[1]/255,
                letter.intensity * baseColor[2]/255
            );
            ctx.textSize(letter.size);
            ctx.textAlign(CENTER, CENTER);
            ctx.text(letter.char, 0, 0);

            ctx.pop();
        }

        // Trofeo: dibujar imagen de copa animada sobre el texto
        if (typeof window !== 'undefined' && window.trophyImage) {
            // Pre-escalar imagen de trofeo si no se ha hecho
            if (!this.scaledTrophyImage) {
                const img = window.trophyImage;
                const aspect = img.height > 0 && img.width > 0 ? (img.height / img.width) : 1;
                const baseSize = min(width, height) * 0.18;
                const w = baseSize;
                const h = w * aspect;
                this.scaledTrophyImage = createGraphics(w, h);
                this.scaledTrophyImage.image(img, 0, 0, w, h);
            }
            
            ctx.push();
            const t = constrain((millis() - this.startTime) / this.duration, 0, 1);
            const intro = this.easeOutElastic(constrain((t - 0.1) * 3, 0, 1));
            ctx.imageMode(CENTER);
            ctx.noStroke();
            // Sombra ligera detrás del trofeo
            ctx.fill(0, 0, 0, 100 * intro);
            ctx.ellipse(width/2 + 5, height * 0.35 + 5, this.scaledTrophyImage.width * intro * 0.9, this.scaledTrophyImage.height * intro * 0.9);
            // Imagen del trofeo pre-escalada
            ctx.push();
            ctx.scale(intro);
            ctx.image(this.scaledTrophyImage, width/2/intro, height * 0.35/intro);
            ctx.pop();
            ctx.pop();
        }

        // Mostrar puntuación final y combo
        if (millis() - this.startTime > this.duration * 0.5) {
            const alpha = constrain(map(millis() - this.startTime, this.duration * 0.5, this.duration * 0.7, 0, 255), 0, 255);
            ctx.textAlign(CENTER, CENTER);
            ctx.textSize(40);

            // Sombra
            ctx.fill(0, 0, 0, alpha * 0.7);
            ctx.text(`Puntuación Final: ${Math.floor(scoreSystem.score)}`, width/2 + 3, height * 0.7 + 3);

            // Texto
            ctx.fill(255, 255, 255, alpha);
            ctx.text(`Puntuación Final: ${Math.floor(scoreSystem.score)}`, width/2, height * 0.7);

            // Combo más alto
            ctx.textSize(30);
            ctx.fill(0, 0, 0, alpha * 0.7);
            ctx.text(`Combo más alto: x${scoreSystem.highestCombo}`, width/2 + 2, height * 0.7 + 50 + 2);

            ctx.fill(255, 215, 0, alpha);
            ctx.text(`Combo más alto: x${scoreSystem.highestCombo}`, width/2, height * 0.7 + 50);

            if (millis() - this.startTime > this.duration * 0.8) {
                const pulseAlpha = 127 + 127 * sin(frameCount * 0.1);
                ctx.textSize(25);
                ctx.fill(255, 255, 255, pulseAlpha);
                ctx.text("Toca la pantalla para reiniciar", width/2, height * 0.85);
            }
        }

        ctx.pop();
    }

    easeOutElastic(x) {
        const c4 = (2 * Math.PI) / 3;
        return x === 0
            ? 0
            : x === 1
            ? 1
            : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
    }

    isFinished() {
        return millis() - this.startTime > this.duration;
    }
}