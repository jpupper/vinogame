class ScoreSystem {
    constructor() {
        this.score = 0;
        this.displayScore = 0;
        this.scoreAnimations = [];
        this.comboCount = 0;
        this.comboTimer = 0;
        this.highestCombo = 0;
        this.lives = CONFIG.lives.initial;
        this.gameOver = false;
        this.gameOverAnimation = null;
        this.win = false;
        this.winAnimation = null;
        this.scoreParticles = [];
        this.scorePosition = createVector(
            width - CONFIG.score.position.x,
            CONFIG.score.position.y
        );
        this.scoreEffect = {
            active: false,
            startTime: 0,
            duration: CONFIG.score.effectDuration,
            isPositive: true,
            intensity: 0
        };
    }

    addScore(points, x, y) {
        if (this.gameOver || this.win) return;

        let totalPoints = points;

        if (points > 0) {
            this.comboCount++;
            if (this.comboCount > this.highestCombo) {
                this.highestCombo = this.comboCount;
            }

            const threshold = (CONFIG && CONFIG.score && CONFIG.score.winComboThreshold) ? CONFIG.score.winComboThreshold : 20;
            if (this.comboCount >= threshold && !this.win) {
                this.win = true;
                this.winAnimation = new EndAnimation({ type: 'win' });
            }

            const comboMultiplier = 1 + (this.comboCount - 1) * CONFIG.score.comboMultiplier;
            totalPoints = Math.floor(points * comboMultiplier);
        } else {
            totalPoints = points;
        }

        this.score = Math.max(0, this.score + totalPoints);

        this.scoreEffect = {
            active: true,
            startTime: millis(),
            duration: CONFIG.score.effectDuration,
            isPositive: points > 0,
            intensity: abs(totalPoints) / 10
        };

        const anim = {
            points: totalPoints,
            x: x,
            y: y,
            alpha: 255,
            scale: 1,
            velocity: createVector(random(-1, 1), -3),
            age: 0,
            maxAge: 60,
            comboCount: this.comboCount,
            isPositive: points > 0,
            phase: 'rising',
            phaseStartTime: millis(),
            phaseDuration: {
                rising: CONFIG.particles.lifespan.rising,
                falling: CONFIG.particles.lifespan.falling,
                attracting: CONFIG.particles.lifespan.attracting
            },
            gravity: CONFIG.particles.speed.gravity,
            particles: [],
            trailParticles: []
        };

        this.scoreAnimations.push(anim);
    }

    resetCombo() {
        this.comboCount = 0;
    }

    reset() {
        this.score = 0;
        this.displayScore = 0;
        this.scoreAnimations = [];
        this.comboCount = 0;
        this.comboTimer = 0;
        this.highestCombo = 0;
        this.lives = CONFIG.lives.initial;
        this.gameOver = false;
        this.gameOverAnimation = null;
        this.win = false;
        this.winAnimation = null;
        this.scoreParticles = [];
        this.scoreEffect = {
            active: false,
            startTime: 0,
            duration: CONFIG.score.effectDuration,
            isPositive: true,
            intensity: 0
        };
    }

    loseLife() {
        if (this.gameOver) return;
        this.lives--;
        if (this.lives <= 0) {
            this.gameOver = true;
            this.gameOverAnimation = new EndAnimation({ type: 'lose' });
        }
    }

    update() {
        this.displayScore = lerp(this.displayScore, this.score, 0.1);

        if (this.scoreEffect.active) {
            const elapsed = millis() - this.scoreEffect.startTime;
            if (elapsed > this.scoreEffect.duration) {
                this.scoreEffect.active = false;
            }
        }

        for (let i = this.scoreAnimations.length - 1; i >= 0; i--) {
            const anim = this.scoreAnimations[i];
            const currentTime = millis();

            if (anim.phase === 'rising') {
                if (currentTime - anim.phaseStartTime > anim.phaseDuration.rising) {
                    anim.phase = 'falling';
                    anim.phaseStartTime = currentTime;
                }
            }

            if (anim.phase === 'rising') {
                anim.age++;
                anim.y += anim.velocity.y;
                anim.x += anim.velocity.x;
                anim.velocity.y *= 0.95;
            } else if (anim.phase === 'falling') {
                const progress = (currentTime - anim.phaseStartTime) / anim.phaseDuration.falling;
                anim.velocity.y += anim.gravity;
                anim.x += anim.velocity.x;
                anim.y += anim.velocity.y;
                anim.alpha = map(progress, 0, 1, 255, 0);
                anim.scale = map(progress, 0, 1, 1, 0.5);
            }

            if (anim.phase === 'falling' &&
                currentTime - anim.phaseStartTime > anim.phaseDuration.falling) {
                this.scoreAnimations.splice(i, 1);
            }
        }

        if (this.gameOverAnimation) {
            this.gameOverAnimation.update();
        }

        if (this.winAnimation) {
            this.winAnimation.update();
        }
    }

    display(ctx = window, opts = {}) {
        const isCompetitive = (typeof gameMode !== 'undefined' && gameMode === 'competitive');
        const showHUD = (typeof opts.hud === 'boolean') ? opts.hud : !isCompetitive;
        const showAnimations = (typeof opts.animations === 'boolean') ? opts.animations : true;

        let scoreSize = CONFIG.score.size;
        let scoreOffset = 0;
        let scoreColor = color(255, 232, 165);

        if (this.scoreEffect.active) {
            const progress = (millis() - this.scoreEffect.startTime) / this.scoreEffect.duration;
            const effectIntensity = sin(progress * PI) * this.scoreEffect.intensity;
            scoreSize = 40 + effectIntensity * 3;
            scoreOffset = sin(progress * PI * 2) * effectIntensity * 0.5;

            if (this.scoreEffect.isPositive) {
                scoreColor = color(255, 220, 95);
            } else {
                scoreColor = color(255, 80, 90);
            }
        }

        this.scorePosition = createVector(
            width - CONFIG.score.position.x,
            CONFIG.score.position.y + scoreOffset
        );

        if (showHUD) {
            ctx.push();
            ctx.rectMode(CORNER);

            // Tarjeta derecha (Puntuación y Combo)
            const cardW = 290;
            const cardH = 122;
            const cardX = width - cardW - 28;
            const cardY = 24;
            ctx.fill(18, 5, 14, 185);
            ctx.stroke(255, 215, 106, 110);
            ctx.strokeWeight(1.8);
            ctx.rect(cardX, cardY, cardW, cardH, 16);
            ctx.noStroke();

            ctx.textAlign(RIGHT, TOP);
            ctx.textFont('Cinzel, Georgia, serif');
            ctx.textStyle(BOLD);
            ctx.textSize(scoreSize * 0.85);
            ctx.fill(0, 0, 0, 180);
            ctx.text(`PUNTOS: ${Math.floor(this.displayScore)}`, width - 44, 42 + scoreOffset);
            ctx.fill(red(scoreColor), green(scoreColor), blue(scoreColor));
            ctx.text(`PUNTOS: ${Math.floor(this.displayScore)}`, width - 46, 40 + scoreOffset);

            const comboY = 92;
            ctx.textFont('Montserrat, sans-serif');
            ctx.textStyle(BOLD);
            ctx.textSize(22);
            ctx.fill(0, 0, 0, 170);
            ctx.text(`COMBO x${this.comboCount}`, width - 44, comboY + 2);
            ctx.fill(255, 215, 106);
            ctx.text(`COMBO x${this.comboCount}`, width - 46, comboY);

            // Tarjeta izquierda (Vidas)
            const lifeSize = CONFIG.lives.size;
            const lifeY = CONFIG.lives.position.y;
            const lifeSpacing = CONFIG.lives.spacing;

            ctx.fill(18, 5, 14, 185);
            ctx.stroke(255, 215, 106, 110);
            ctx.strokeWeight(1.8);
            ctx.rect(24, 24, 320, 76, 16);
            ctx.noStroke();

            ctx.textAlign(LEFT, TOP);
            ctx.textFont('Cinzel, Georgia, serif');
            ctx.textStyle(BOLD);
            ctx.textSize(26);
            ctx.fill(0, 0, 0, 180);
            ctx.text('VIDAS:', 42, lifeY + 6);
            ctx.fill(255, 223, 128);
            ctx.text('VIDAS:', 40, lifeY + 4);

            for (let i = 0; i < this.lives; i++) {
                this.drawHeart(CONFIG.lives.position.x + 15 + i * lifeSpacing, lifeY + lifeSize / 2, lifeSize * 0.85, ctx);
            }
            ctx.pop();
        }

        // Mostrar textos flotantes "+puntos" / "-puntos" con tipografía unificada
        for (let anim of this.scoreAnimations) {
            if (anim.phase !== 'attracting') {
                const fontSize = map(Math.abs(anim.points), 1, 20, 22, 42) * anim.scale * 1.85;
                let pointColor;
                let prefix = anim.points >= 0 ? '+' : '';

                if (!anim.isPositive) {
                    pointColor = color(255, 65, 80);
                } else {
                    pointColor = color(255, 220, 90);
                }

                ctx.push();
                ctx.textFont('Cinzel, Georgia, serif');
                ctx.textStyle(BOLD);
                ctx.textAlign(CENTER, CENTER);
                ctx.textSize(fontSize);

                ctx.fill(0, 0, 0, anim.alpha * 0.8);
                ctx.text(`${prefix}${anim.points}`, anim.x + 3, anim.y + 3);

                ctx.stroke(25, 4, 12, anim.alpha * 0.85);
                ctx.strokeWeight(Math.max(2, fontSize * 0.06));
                ctx.fill(red(pointColor), green(pointColor), blue(pointColor), anim.alpha);
                ctx.text(`${prefix}${anim.points}`, anim.x, anim.y);

                if (anim.comboCount > 1 && anim.isPositive) {
                    const comboFontSize = fontSize * 0.58;
                    ctx.noStroke();
                    ctx.textFont('Montserrat, sans-serif');
                    ctx.fill(255, 250, 235, anim.alpha * 0.92);
                    ctx.textSize(comboFontSize);
                    ctx.text(`COMBO x${anim.comboCount}`, anim.x, anim.y + fontSize * 0.78);
                }
                ctx.pop();
            }
        }

        if (showAnimations && this.gameOver && this.gameOverAnimation) {
            this.gameOverAnimation.display(ctx);
        }

        if (showAnimations && this.win && this.winAnimation) {
            this.winAnimation.display(ctx);
        }
    }

    drawHeart(x, y, size, ctx = window) {
        const ancho = size * 1.5;
        const alto = size;

        const pulseScale = sin(frameCount * 0.05 + x * 0.1) * 0.1 + 1;
        const currentAncho = ancho * pulseScale;
        const currentAlto = alto * pulseScale;

        ctx.push();
        ctx.translate(x, y);

        for (let i = 3; i > 0; i--) {
            ctx.fill(255, 50, 100, 30 / i);
            ctx.noStroke();
            ctx.beginShape();
            ctx.vertex(0, -currentAlto / 4);
            ctx.bezierVertex(
                currentAncho / 4 * (1 + i * 0.1), -currentAlto / 2 * (1 + i * 0.1),
                currentAncho / 2 * (1 + i * 0.1), -currentAlto / 4 * (1 + i * 0.1),
                0, currentAlto / 2 * (1 + i * 0.1)
            );
            ctx.bezierVertex(
                -currentAncho / 2 * (1 + i * 0.1), -currentAlto / 4 * (1 + i * 0.1),
                -currentAncho / 4 * (1 + i * 0.1), -currentAlto / 2 * (1 + i * 0.1),
                0, -currentAlto / 4
            );
            ctx.endShape(CLOSE);
        }

        ctx.fill(0, 0, 0, 120);
        ctx.noStroke();
        ctx.beginShape();
        ctx.vertex(2, -currentAlto / 4 + 2);
        ctx.bezierVertex(currentAncho / 4 + 2, -currentAlto / 2 + 2, currentAncho / 2 + 2, -currentAlto / 4 + 2, 2, currentAlto / 2 + 2);
        ctx.bezierVertex(-currentAncho / 2 + 2, -currentAlto / 4 + 2, -currentAncho / 4 + 2, -currentAlto / 2 + 2, 2, -currentAlto / 4 + 2);
        ctx.endShape(CLOSE);

        ctx.fill(185, 22, 68);
        ctx.noStroke();
        ctx.beginShape();
        ctx.vertex(0, -currentAlto / 4);
        ctx.bezierVertex(currentAncho / 4, -currentAlto / 2, currentAncho / 2, -currentAlto / 4, 0, currentAlto / 2);
        ctx.bezierVertex(-currentAncho / 2, -currentAlto / 4, -currentAncho / 4, -currentAlto / 2, 0, -currentAlto / 4);
        ctx.endShape(CLOSE);

        ctx.fill(245, 55, 105);
        ctx.beginShape();
        ctx.vertex(0, -currentAlto / 4);
        ctx.bezierVertex(currentAncho / 4, -currentAlto / 2, currentAncho / 2, -currentAlto / 4, 0, currentAlto / 2 * 0.7);
        ctx.bezierVertex(-currentAncho / 2, -currentAlto / 4, -currentAncho / 4, -currentAlto / 2, 0, -currentAlto / 4);
        ctx.endShape(CLOSE);

        ctx.fill(255, 215, 165, 160);
        ctx.ellipse(-currentAncho / 5, -currentAlto / 4, currentAncho / 3, currentAlto / 3);

        ctx.fill(255, 255, 255, 210);
        ctx.ellipse(-currentAncho / 4, -currentAlto / 3.5, currentAncho / 5, currentAlto / 5);

        ctx.pop();
    }
}
