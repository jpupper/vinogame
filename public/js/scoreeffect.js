class ScoreSystem {
    constructor() {
        this.score = 0;
        this.displayScore = 0;
        this.scoreAnimations = [];
        this.comboCount = 0;
        this.comboTimer = 0;
        // Ya no usaremos comboThreshold porque el combo no expira con el tiempo
        this.highestCombo = 0;
        this.lives = CONFIG.lives.initial; // Sistema de vidas
        this.gameOver = false; // Estado de juego terminado
        this.gameOverAnimation = null; // Animación de Game Over
        // Estado de victoria
        this.win = false;
        this.winAnimation = null;
        // Partículas y efectos
        this.scoreParticles = []; // Partículas que fluyen hacia el score
        this.scorePosition = createVector(
            width - CONFIG.score.position.x, 
            CONFIG.score.position.y
        ); // Posición del score para atracción
        this.scoreEffect = { // Efecto visual en el score
            active: false,
            startTime: 0,
            duration: CONFIG.score.effectDuration,
            isPositive: true,
            intensity: 0
        };
    }
    
    addScore(points, x, y) {
        // Si el juego terminó o ganaste, no sumar más puntos
        if (this.gameOver || this.win) return;
        
        // Calcular puntos con bonificación por combo
        let totalPoints = points;
        
        // Solo actualizar combo para puntos positivos
        if (points > 0) {
            // Incrementar el combo (ya no hay límite de tiempo)
            this.comboCount++;
            
            // Actualizar combo más alto
            if (this.comboCount > this.highestCombo) {
                this.highestCombo = this.comboCount;
            }
            
            // Chequear condición de victoria por combo
            const threshold = (CONFIG && CONFIG.score && CONFIG.score.winComboThreshold) ? CONFIG.score.winComboThreshold : 20;
            if (this.comboCount >= threshold && !this.win) {
                this.win = true;
                this.winAnimation = new WinAnimation();
            }
            
            // Aplicar bonificación por combo (más generosa)
            const comboMultiplier = 1 + (this.comboCount - 1) * CONFIG.score.comboMultiplier;
            totalPoints = Math.floor(points * comboMultiplier);
        } else {
            // Para puntos negativos, no aplicamos multiplicador de combo
            totalPoints = points;
        }
        
        // Incrementar puntuación
        this.score += totalPoints;
        
        // Activar efecto visual en el score
        this.scoreEffect = {
            active: true,
            startTime: millis(),
            duration: CONFIG.score.effectDuration,
            isPositive: points > 0,
            intensity: abs(totalPoints) / 10 // Intensidad basada en la cantidad de puntos
        };
        
        // Añadir animación de puntuación
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
            phase: 'rising', // Fases: rising -> falling
            phaseStartTime: millis(),
            phaseDuration: {
                rising: CONFIG.particles.lifespan.rising,
                falling: CONFIG.particles.lifespan.falling,
                attracting: CONFIG.particles.lifespan.attracting
            },
            gravity: CONFIG.particles.speed.gravity,
            particles: [],
            trailParticles: [] // Para el efecto de estela
        };
        
        // Crear partículas para la animación
        let particleCount;
        if (abs(totalPoints) < 10) {
            particleCount = CONFIG.particles.count.scoreSmall;
        } else if (abs(totalPoints) < 30) {
            particleCount = CONFIG.particles.count.scoreMedium;
        } else {
            particleCount = CONFIG.particles.count.scoreLarge;
        }
        
        for (let i = 0; i < particleCount; i++) {
            const variation = CONFIG.particles.colors.variation;
            const baseColor = points > 0 ? 
                CONFIG.particles.colors.positive : 
                CONFIG.particles.colors.negative;
                
            anim.particles.push({
                pos: createVector(x + random(-20, 20), y + random(-20, 20)),
                vel: createVector(
                    random(CONFIG.particles.speed.initial.min, CONFIG.particles.speed.initial.max),
                    random(CONFIG.particles.speed.initial.min * 2, CONFIG.particles.speed.initial.min)
                ),
                size: random(CONFIG.particles.size.min, CONFIG.particles.size.max),
                alpha: 255,
                initialOffset: random(TWO_PI), // Offset inicial para movimiento en espiral
                color: color(
                    baseColor[0] + random(-variation, variation),
                    baseColor[1] + random(-variation, variation),
                    baseColor[2] + random(-variation, variation)
                )
            });
        }
        
        this.scoreAnimations.push(anim);
    }
    
    resetCombo() {
        // Reiniciar el combo a cero cuando se golpea un obstáculo
        this.comboCount = 0;
    }
    
    reset() {
        // Reiniciar completamente el sistema de puntuación
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
        // Perder una vida cuando se golpea un obstáculo
        if (this.gameOver) return;
        
        this.lives--;
        
        // Si no quedan vidas, activar Game Over
        if (this.lives <= 0) {
            this.gameOver = true;
            this.gameOverAnimation = new GameOverAnimation();
        }
    }
    
    update() {
        // Animar la puntuación mostrada para que se acerque suavemente a la puntuación real
        this.displayScore = lerp(this.displayScore, this.score, 0.1);
        
        // Actualizar efecto visual del score
        if (this.scoreEffect.active) {
            const elapsed = millis() - this.scoreEffect.startTime;
            if (elapsed > this.scoreEffect.duration) {
                this.scoreEffect.active = false;
            }
        }
        
        // Actualizar animaciones de puntuación con fases
        for (let i = this.scoreAnimations.length - 1; i >= 0; i--) {
            const anim = this.scoreAnimations[i];
            const currentTime = millis();
            
            // Actualizar fase de la animación
            if (anim.phase === 'rising') {
                if (currentTime - anim.phaseStartTime > anim.phaseDuration.rising) {
                    anim.phase = 'falling';
                    anim.phaseStartTime = currentTime;
                }
            }
            
            // Comportamiento según la fase
            if (anim.phase === 'rising') {
                // Fase de subida inicial
                anim.age++;
                anim.y += anim.velocity.y;
                anim.x += anim.velocity.x;
                anim.velocity.y *= 0.95; // Desaceleración
                
                // Actualizar partículas
                for (let p of anim.particles) {
                    p.vel.y *= 0.95;
                    p.pos.add(p.vel);
                }
            } else if (anim.phase === 'falling') {
                // Fase de caída
                const progress = (currentTime - anim.phaseStartTime) / anim.phaseDuration.falling;
                
                // Aplicar gravedad
                anim.velocity.y += anim.gravity;
                anim.x += anim.velocity.x;
                anim.y += anim.velocity.y;
                
                // Actualizar partículas
                for (let p of anim.particles) {
                    p.vel.y += anim.gravity;
                    p.pos.add(p.vel);
                    
                    // Reducir tamaño gradualmente
                    p.size *= 0.99;
                }
                
                // Desvanecer
                anim.alpha = map(progress, 0, 1, 255, 0);
                anim.scale = map(progress, 0, 1, 1, 0.5);
            }
            
            // Eliminar animaciones completadas
            if (anim.phase === 'falling' && 
                currentTime - anim.phaseStartTime > anim.phaseDuration.falling) {
                this.scoreAnimations.splice(i, 1);
            }
        }
        
        // Actualizar animación de Game Over si existe
        if (this.gameOverAnimation) {
            this.gameOverAnimation.update();
        }
        
        // Actualizar animación de Victoria si existe
        if (this.winAnimation) {
            this.winAnimation.update();
        }
    }
    
    display(ctx = window) {
        // Mostrar puntuación principal con efecto
        ctx.textAlign(RIGHT, TOP);
        
        // Aplicar efecto visual al score si está activo
        let scoreSize = CONFIG.score.size;
        let scoreOffset = 0;
        let scoreColor = color(
            CONFIG.score.colors.normal[0],
            CONFIG.score.colors.normal[1],
            CONFIG.score.colors.normal[2]
        );
        
        if (this.scoreEffect.active) {
            const progress = (millis() - this.scoreEffect.startTime) / this.scoreEffect.duration;
            const effectIntensity = sin(progress * PI) * this.scoreEffect.intensity;
            
            // Tamaño pulsante más pronunciado
            scoreSize = 40 + effectIntensity * 3;
            
            // Desplazamiento vertical
            scoreOffset = sin(progress * PI * 2) * effectIntensity * 0.5;
            
            // Efecto de partículas de energía alrededor del score
            if (frameCount % 3 === 0 && this.scoreEffect.intensity > 3) {
                const particleCount = floor(this.scoreEffect.intensity / 2);
                for (let i = 0; i < particleCount; i++) {
                    const scoreWidth = 240;
                    const scoreHeight = 40;
                    
                    // Crear partículas que emanan del score
                    particleSystem.addParticle(
                        this.scorePosition.x - random(0, scoreWidth),
                        this.scorePosition.y + random(-scoreHeight/2, scoreHeight/2),
                        this.scoreEffect.isPositive ? 
                            color(50, 255, 50, 150) : 
                            color(255, 50, 50, 150),
                        random(3, 8),
                        createVector(random(-2, 2), random(-2, 2))
                    );
                }
            }
            
            // Color basado en si es positivo o negativo
            if (this.scoreEffect.isPositive) {
                // Verde pulsante para puntos positivos
                const baseColor = CONFIG.score.colors.positive;
                const intensity = 150 + effectIntensity * 5;
                scoreColor = color(baseColor[0], intensity, baseColor[2]);
            } else {
                // Rojo pulsante para puntos negativos
                const baseColor = CONFIG.score.colors.negative;
                const intensity = 150 + effectIntensity * 5;
                scoreColor = color(intensity, baseColor[1], baseColor[2]);
            }
        }
        
        // Actualizar posición del score para las partículas atraidas
        this.scorePosition = createVector(
            width - CONFIG.score.position.x, 
            CONFIG.score.position.y + scoreOffset
        );
        
        // Sombra de texto
        ctx.textSize(scoreSize);
        ctx.fill(0, 0, 0, 150);
        ctx.text(`Score: ${Math.floor(this.displayScore)}`, width - 38, 42 + scoreOffset);
        
        // Texto principal con color dinámico
        ctx.fill(red(scoreColor), green(scoreColor), blue(scoreColor));
        ctx.text(`Score: ${Math.floor(this.displayScore)}`, width - 40, 40 + scoreOffset);
        
        // Mostrar combo siempre (incluso si es 0)
        const comboY = 90;
        const comboSize = 30;
        
        // Calcular color basado en el tamaño del combo
        ctx.colorMode(HSB, 100);
        const hue = map(this.comboCount, 0, 10, 10, 100) % 100;
        const comboColor = this.comboCount > 0 ? color(hue, 80, 100) : color(0, 0, 70);
        ctx.colorMode(RGB, 255);
        
        // Sombra del combo
        ctx.fill(0, 0, 0, 150);
        ctx.textSize(comboSize);
        ctx.text(`Combo x${this.comboCount}`, width - 38, comboY + 2);
        
        // Texto del combo
        ctx.fill(red(comboColor), green(comboColor), blue(comboColor));
        ctx.text(`Combo x${this.comboCount}`, width - 40, comboY);
        
        // Mostrar vidas
        const lifeSize = CONFIG.lives.size;
        const lifeY = CONFIG.lives.position.y;
        const lifeSpacing = CONFIG.lives.spacing;
        
        ctx.textAlign(LEFT, TOP);
        
        // Sombra del texto de vidas
        ctx.fill(0, 0, 0, 150);
        ctx.textSize(lifeSize);
        ctx.text(`Vidas: `, 42, lifeY + 2);
        
        // Texto de vidas
        ctx.fill(255, 100, 100);
        ctx.text(`Vidas: `, 40, lifeY);
        
        // Dibujar corazones para las vidas
        for (let i = 0; i < this.lives; i++) {
            this.drawHeart(CONFIG.lives.position.x + i * lifeSpacing, lifeY + lifeSize/2, lifeSize, ctx);
        }
        
        // Mostrar animaciones de puntuación con fases
        for (let anim of this.scoreAnimations) {
            // Dibujar partículas de estela primero (detrás)
            if (anim.trailParticles) {
                for (let tp of anim.trailParticles) {
                    ctx.noStroke();
                    ctx.fill(red(tp.color), green(tp.color), blue(tp.color), tp.alpha * 0.5);
                    ctx.ellipse(tp.pos.x, tp.pos.y, tp.size, tp.size);
                }
            }
            
            // Dibujar partículas principales
            for (let p of anim.particles) {
                // Efecto de brillo
                if (p.size > 5) {
                    ctx.noStroke();
                    ctx.fill(red(p.color), green(p.color), blue(p.color), p.alpha * 0.3);
                    ctx.ellipse(p.pos.x, p.pos.y, p.size * 1.5, p.size * 1.5);
                }
                
                // Partícula principal
                ctx.noStroke();
                ctx.fill(red(p.color), green(p.color), blue(p.color), p.alpha);
                ctx.ellipse(p.pos.x, p.pos.y, p.size, p.size);
                
                // Brillo central
                ctx.fill(255, 255, 255, p.alpha * 0.7);
                ctx.ellipse(p.pos.x, p.pos.y, p.size * 0.4, p.size * 0.4);
            }
            
            // Solo mostrar el texto si no está en fase de atracción
            if (anim.phase !== 'attracting') {
                const fontSize = map(Math.abs(anim.points), 1, 20, 20, 40) * anim.scale;
                
                // Determinar color basado en si es positivo o negativo
                let pointColor;
                let prefix = anim.points >= 0 ? '+' : '';
                
                if (!anim.isPositive) {
                    // Puntos negativos en rojo
                    pointColor = color(255, 50, 50);
                } else {
                    // Puntos positivos en verde con intensidad basada en el combo
                    const intensity = map(anim.comboCount, 1, 10, 150, 255);
                    pointColor = color(50, intensity, 50);
                }
                
                // Sombra del texto
                ctx.fill(0, 0, 0, anim.alpha * 0.7);
                ctx.textAlign(CENTER, CENTER);
                ctx.textSize(fontSize);
                ctx.text(`${prefix}${anim.points}`, anim.x + 2, anim.y + 2);
                
                // Texto principal
                ctx.fill(red(pointColor), green(pointColor), blue(pointColor), anim.alpha);
                ctx.text(`${prefix}${anim.points}`, anim.x, anim.y);
                
                // Mostrar combo si es relevante
                if (anim.comboCount > 1 && anim.isPositive) {
                    const comboFontSize = fontSize * 0.5;
                    ctx.fill(255, 255, 255, anim.alpha * 0.8);
                    ctx.textSize(comboFontSize);
                    ctx.text(`x${anim.comboCount}`, anim.x, anim.y + fontSize * 0.7);
                }
            }
        }
        
        // Mostrar animación de Game Over si el juego terminó
        if (this.gameOver && this.gameOverAnimation) {
            this.gameOverAnimation.display(ctx);
        }
        
        // Mostrar animación de Victoria si ganaste
        if (this.win && this.winAnimation) {
            this.winAnimation.display(ctx);
        }
    }
    
    drawHeart(x, y, size, ctx = window) {
        // Usar ancho y alto separados para el corazón (más ancho)
        const ancho = size * 1.5;
        const alto = size;
        
        // Efecto de pulsación
        const pulseScale = sin(frameCount * 0.05 + x * 0.1) * 0.1 + 1;
        const currentSize = size * pulseScale;
        const currentAncho = ancho * pulseScale;
        const currentAlto = alto * pulseScale;
        
        ctx.push();
        ctx.translate(x, y);
        
        // Halo exterior brillante
        for (let i = 3; i > 0; i--) {
            ctx.fill(255, 50, 100, 30 / i);
            ctx.noStroke();
            ctx.beginShape();
            ctx.vertex(0, -currentAlto/4);
            ctx.bezierVertex(currentAncho/4 * (1 + i * 0.1), -currentAlto/2 * (1 + i * 0.1), 
                        currentAncho/2 * (1 + i * 0.1), -currentAlto/4 * (1 + i * 0.1), 
                        0, currentAlto/2 * (1 + i * 0.1));
            ctx.bezierVertex(-currentAncho/2 * (1 + i * 0.1), -currentAlto/4 * (1 + i * 0.1), 
                        -currentAncho/4 * (1 + i * 0.1), -currentAlto/2 * (1 + i * 0.1), 
                        0, -currentAlto/4);
            ctx.endShape(CLOSE);
        }
        
        // Sombra del corazón
        ctx.fill(0, 0, 0, 120);
        ctx.noStroke();
        ctx.beginShape();
        ctx.vertex(2, -currentAlto/4 + 2);
        ctx.bezierVertex(currentAncho/4 + 2, -currentAlto/2 + 2, currentAncho/2 + 2, -currentAlto/4 + 2, 2, currentAlto/2 + 2);
        ctx.bezierVertex(-currentAncho/2 + 2, -currentAlto/4 + 2, -currentAncho/4 + 2, -currentAlto/2 + 2, 2, -currentAlto/4 + 2);
        ctx.endShape(CLOSE);
        
        // Corazón principal con gradiente simulado
        // Capa oscura (base)
        ctx.fill(200, 30, 80);
        ctx.noStroke();
        ctx.beginShape();
        ctx.vertex(0, -currentAlto/4);
        ctx.bezierVertex(currentAncho/4, -currentAlto/2, currentAncho/2, -currentAlto/4, 0, currentAlto/2);
        ctx.bezierVertex(-currentAncho/2, -currentAlto/4, -currentAncho/4, -currentAlto/2, 0, -currentAlto/4);
        ctx.endShape(CLOSE);
        
        // Capa brillante (encima)
        ctx.fill(255, 60, 120);
        ctx.beginShape();
        ctx.vertex(0, -currentAlto/4);
        ctx.bezierVertex(currentAncho/4, -currentAlto/2, currentAncho/2, -currentAlto/4, 0, currentAlto/2 * 0.7);
        ctx.bezierVertex(-currentAncho/2, -currentAlto/4, -currentAncho/4, -currentAlto/2, 0, -currentAlto/4);
        ctx.endShape(CLOSE);
        
        // Múltiples brillos para efecto más orgánico
        ctx.fill(255, 200, 220, 150);
        ctx.ellipse(-currentAncho/5, -currentAlto/4, currentAncho/3, currentAlto/3);
        
        ctx.fill(255, 255, 255, 200);
        ctx.ellipse(-currentAncho/4, -currentAlto/3.5, currentAncho/5, currentAlto/5);
        
        // Brillo pulsante adicional
        const glowAlpha = sin(frameCount * 0.1 + x * 0.2) * 50 + 100;
        ctx.fill(255, 150, 180, glowAlpha);
        ctx.ellipse(0, 0, currentAncho/6, currentAlto/6);
        
        ctx.pop();
    }
}
