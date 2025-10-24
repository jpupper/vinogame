class WinAnimation {
    constructor() {
        this.startTime = millis();
        this.duration = (CONFIG.win && CONFIG.win.duration) ? CONFIG.win.duration : 5000;
        this.particles = [];
        this.letters = [];

        const baseColor = (CONFIG.win && CONFIG.win.text && CONFIG.win.text.color)
            ? CONFIG.win.text.color
            : [255, 215, 0]; // Dorado por defecto

        // Crear partículas celebratorias (destellos dorados)
        const pCount = (CONFIG.win && CONFIG.win.particles && CONFIG.win.particles.count) ? CONFIG.win.particles.count : 120;
        const pSpeedMin = (CONFIG.win && CONFIG.win.particles && CONFIG.win.particles.speed && CONFIG.win.particles.speed.min) ? CONFIG.win.particles.speed.min : 2;
        const pSpeedMax = (CONFIG.win && CONFIG.win.particles && CONFIG.win.particles.speed && CONFIG.win.particles.speed.max) ? CONFIG.win.particles.speed.max : 8;
        const pSizeMin = (CONFIG.win && CONFIG.win.particles && CONFIG.win.particles.size && CONFIG.win.particles.size.min) ? CONFIG.win.particles.size.min : 4;
        const pSizeMax = (CONFIG.win && CONFIG.win.particles && CONFIG.win.particles.size && CONFIG.win.particles.size.max) ? CONFIG.win.particles.size.max : 14;

        for (let i = 0; i < pCount; i++) {
            this.particles.push({
                pos: createVector(width/2, height/2),
                vel: p5.Vector.random2D().mult(random(pSpeedMin, pSpeedMax)),
                size: random(pSizeMin, pSizeMax),
                color: color(baseColor[0], baseColor[1], baseColor[2], 255),
                life: 255
            });
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

    update() {
        const elapsed = millis() - this.startTime;
        const progress = constrain(elapsed / this.duration, 0, 1);

        // Actualizar partículas
        for (let p of this.particles) {
            p.pos.add(p.vel);
            p.vel.mult(0.98); // desaceleración suave
            p.life -= 1.2;
        }
        this.particles = this.particles.filter(p => p.life > 0);

        // Generar más destellos al inicio
        if (progress < 0.6 && frameCount % 6 === 0) {
            for (let i = 0; i < 3; i++) {
                this.particles.push({
                    pos: createVector(width/2 + random(-width/3, width/3), height/2 + random(-height/3, height/3)),
                    vel: p5.Vector.random2D().mult(random(1, 4)),
                    size: random(3, 10),
                    color: color(255, 215, 120, 255),
                    life: 255
                });
            }
        }

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
        ctx.fill(0, 0, 0, 140);
        ctx.rect(0, 0, width, height);

        // Partículas doradas
        for (let p of this.particles) {
            ctx.noStroke();
            ctx.fill(red(p.color), green(p.color), blue(p.color), p.life);
            ctx.ellipse(p.pos.x, p.pos.y, p.size);
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