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
        // Si el juego terminó, no sumar más puntos
        if (this.gameOver) return;
        
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
            phase: 'rising', // Fases: rising -> falling -> attracting
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
            } else if (anim.phase === 'falling') {
                if (currentTime - anim.phaseStartTime > anim.phaseDuration.falling) {
                    anim.phase = 'attracting';
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
                anim.alpha = 255;
                anim.scale = map(anim.age, 0, 20, 0.5, 1.5);
                
                // Actualizar partículas en fase de subida
                for (let p of anim.particles) {
                    p.pos.add(p.vel);
                    p.vel.x *= 0.98;
                    p.vel.y *= 0.98;
                }
            } else if (anim.phase === 'falling') {
                // Fase de caída con gravedad
                anim.velocity.y += anim.gravity;
                anim.y += anim.velocity.y;
                anim.x += anim.velocity.x * 0.5;
                
                // Actualizar partículas en fase de caída
                for (let p of anim.particles) {
                    p.vel.y += anim.gravity * 0.8;
                    p.pos.add(p.vel);
                    p.vel.x *= 0.98;
                }
            } else if (anim.phase === 'attracting') {
                // Fase de atracción hacia el score
                const progress = (currentTime - anim.phaseStartTime) / anim.phaseDuration.attracting;
                
                // Mover hacia la posición del score
                const targetX = this.scorePosition.x;
                const targetY = this.scorePosition.y;
                
                // Atracción con aceleración
                const dx = targetX - anim.x;
                const dy = targetY - anim.y;
                const distance = sqrt(dx*dx + dy*dy);
                
                // Velocidad basada en la distancia
                const speed = map(progress, 0, 1, 0.02, 0.2);
                
                anim.x += dx * speed;
                anim.y += dy * speed;
                
                // Reducir tamaño a medida que se acerca
                anim.scale = map(progress, 0, 1, 1, 0.2);
                
                // Actualizar partículas en fase de atracción
                for (let p of anim.particles) {
                    // Calcular punto de destino con ligera variación para crear efecto de "llenado"
                    // Las partículas se distribuyen alrededor del score
                    const scoreWidth = 240; // Ancho aproximado del texto "Score: XXX"
                    const scoreHeight = 40; // Alto aproximado del texto
                    
                    // Destino con variación dentro del área del score
                    const particleTargetX = targetX - random(0, scoreWidth);
                    const particleTargetY = targetY + random(-scoreHeight/2, scoreHeight/2);
                    
                    const dx = particleTargetX - p.pos.x;
                    const dy = particleTargetY - p.pos.y;
                    const distance = sqrt(dx*dx + dy*dy);
                    
                    // Velocidad que aumenta dramáticamente al final para efecto de "absorción"
                    let particleSpeed;
                    if (progress < 0.7) {
                        // Movimiento más lento al principio
                        particleSpeed = map(progress, 0, 0.7, 0.01, 0.05);
                    } else {
                        // Aceleración dramática al final
                        particleSpeed = map(progress, 0.7, 1, 0.05, CONFIG.particles.speed.attraction * 2);
                    }
                    
                    // Añadir componente de movimiento circular/espiral
                    const spiralFactor = map(progress, 0, 1, 0.2, 0.05);
                    const spiralAngle = frameCount * 0.1 + p.initialOffset;
                    p.vel.x = dx * particleSpeed + sin(spiralAngle) * spiralFactor;
                    p.vel.y = dy * particleSpeed + cos(spiralAngle) * spiralFactor;
                    p.pos.add(p.vel);
                    
                    // Efecto de estela para partículas
                    if (frameCount % 2 === 0 && progress > 0.5) {
                        anim.trailParticles.push({
                            pos: p.pos.copy(),
                            alpha: 150,
                            size: p.size * 0.7,
                            color: p.color
                        });
                    }
                    
                    // Reducir tamaño y ajustar opacidad
                    p.size = map(progress, 0, 1, p.size, p.size * 0.5);
                    
                    // Mantener opacidad alta hasta el final para mejor visibilidad
                    if (progress < 0.8) {
                        p.alpha = 255;
                    } else {
                        p.alpha = map(progress, 0.8, 1, 255, 0);
                    }
                }
                
                // Actualizar partículas de estela
                for (let i = anim.trailParticles.length - 1; i >= 0; i--) {
                    const trail = anim.trailParticles[i];
                    trail.alpha -= 15;
                    trail.size *= 0.95;
                    
                    if (trail.alpha <= 0 || trail.size < 0.5) {
                        anim.trailParticles.splice(i, 1);
                    }
                }
                
                // Desvanecer cuando está cerca del objetivo
                if (distance < 50) {
                    anim.alpha = map(distance, 50, 10, 255, 0);
                }
                
                // Efecto de "llenado" en el score cuando las partículas llegan
                if (progress > 0.7) {
                    // Activar un efecto adicional en el score
                    const energyBoost = map(progress, 0.7, 1, 0, anim.isPositive ? 10 : 5);
                    this.scoreEffect.intensity += energyBoost * 0.01;
                    this.scoreEffect.duration = CONFIG.score.effectDuration * 1.5; // Extender duración
                }
            }
            
            // Eliminar animaciones completadas
            if (anim.phase === 'attracting' && 
                currentTime - anim.phaseStartTime > anim.phaseDuration.attracting) {
                this.scoreAnimations.splice(i, 1);
            }
        }
        
        // Actualizar animación de Game Over si existe
        if (this.gameOverAnimation) {
            this.gameOverAnimation.update();
        }
    }
    
    display() {
        // No necesitamos push/pop aquí ya que estamos en el contexto de p5.js
        
        // Mostrar puntuación principal con efecto
        textAlign(RIGHT, TOP);
        
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
        textSize(scoreSize);
        fill(0, 0, 0, 150);
        text(`Score: ${Math.floor(this.displayScore)}`, width - 38, 42 + scoreOffset);
        
        // Texto principal con color dinámico
        fill(red(scoreColor), green(scoreColor), blue(scoreColor));
        text(`Score: ${Math.floor(this.displayScore)}`, width - 40, 40 + scoreOffset);
        
        // Mostrar combo siempre (incluso si es 0)
        const comboY = 90;
        const comboSize = 30;
        
        // Calcular color basado en el tamaño del combo
        colorMode(HSB, 100);
        const hue = map(this.comboCount, 0, 10, 10, 100) % 100;
        const comboColor = this.comboCount > 0 ? color(hue, 80, 100) : color(0, 0, 70);
        colorMode(RGB, 255);
        
        // Sombra del combo
        fill(0, 0, 0, 150);
        textSize(comboSize);
        text(`Combo x${this.comboCount}`, width - 38, comboY + 2);
        
        // Texto del combo
        fill(red(comboColor), green(comboColor), blue(comboColor));
        text(`Combo x${this.comboCount}`, width - 40, comboY);
        
        // Mostrar vidas
        const lifeSize = CONFIG.lives.size;
        const lifeY = CONFIG.lives.position.y;
        const lifeSpacing = CONFIG.lives.spacing;
        
        textAlign(LEFT, TOP);
        
        // Sombra del texto de vidas
        fill(0, 0, 0, 150);
        textSize(lifeSize);
        text(`Vidas: `, 42, lifeY + 2);
        
        // Texto de vidas
        fill(255, 100, 100);
        text(`Vidas: `, 40, lifeY);
        
        // Dibujar corazones para las vidas
        for (let i = 0; i < this.lives; i++) {
            this.drawHeart(CONFIG.lives.position.x + i * lifeSpacing, lifeY + lifeSize/2, lifeSize);
        }
        
        // Mostrar animaciones de puntuación con fases
        for (let anim of this.scoreAnimations) {
            // Dibujar partículas de estela primero (detrás)
            if (anim.trailParticles) {
                for (let tp of anim.trailParticles) {
                    noStroke();
                    fill(red(tp.color), green(tp.color), blue(tp.color), tp.alpha * 0.5);
                    ellipse(tp.pos.x, tp.pos.y, tp.size, tp.size);
                }
            }
            
            // Dibujar partículas principales
            for (let p of anim.particles) {
                // Efecto de brillo
                if (p.size > 5) {
                    noStroke();
                    fill(red(p.color), green(p.color), blue(p.color), p.alpha * 0.3);
                    ellipse(p.pos.x, p.pos.y, p.size * 1.5, p.size * 1.5);
                }
                
                // Partícula principal
                noStroke();
                fill(red(p.color), green(p.color), blue(p.color), p.alpha);
                ellipse(p.pos.x, p.pos.y, p.size, p.size);
                
                // Brillo central
                fill(255, 255, 255, p.alpha * 0.7);
                ellipse(p.pos.x, p.pos.y, p.size * 0.4, p.size * 0.4);
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
                fill(0, 0, 0, anim.alpha * 0.7);
                textAlign(CENTER, CENTER);
                textSize(fontSize);
                text(`${prefix}${anim.points}`, anim.x + 2, anim.y + 2);
                
                // Texto principal
                fill(red(pointColor), green(pointColor), blue(pointColor), anim.alpha);
                text(`${prefix}${anim.points}`, anim.x, anim.y);
                
                // Mostrar combo si es relevante
                if (anim.comboCount > 1 && anim.isPositive) {
                    const comboFontSize = fontSize * 0.5;
                    fill(255, 255, 255, anim.alpha * 0.8);
                    textSize(comboFontSize);
                    text(`x${anim.comboCount}`, anim.x, anim.y + fontSize * 0.7);
                }
            }
            
            // Efectos adicionales según la fase
            if (anim.phase === 'attracting') {
                // Dibujar línea de atracción hacia el score
                const progress = (millis() - anim.phaseStartTime) / anim.phaseDuration.attracting;
                if (progress < 0.7) { // Solo mostrar líneas al principio de la atracción
                    stroke(anim.isPositive ? color(100, 255, 100, 100) : color(255, 100, 100, 100));
                    strokeWeight(1);
                    line(anim.x, anim.y, this.scorePosition.x, this.scorePosition.y);
                }
            }
        }
        
        // Mostrar animación de Game Over si el juego terminó
        if (this.gameOver && this.gameOverAnimation) {
            this.gameOverAnimation.display();
        }
    }
    
    drawHeart(x, y, size) {
        // Usar ancho y alto separados para el corazón
        const ancho = size * 1.2; // Un poco más ancho que alto
        const alto = size;
        
        push();
        translate(x, y);
        
        // Sombra del corazón
        fill(0, 0, 0, 100);
        noStroke();
        beginShape();
        vertex(0, -alto/4);
        bezierVertex(ancho/4, -alto/2, ancho/2, -alto/4, 0, alto/2);
        bezierVertex(-ancho/2, -alto/4, -ancho/4, -alto/2, 0, -alto/4);
        endShape(CLOSE);
        
        // Corazón
        fill(CONFIG.lives.color[0], CONFIG.lives.color[1], CONFIG.lives.color[2]);
        noStroke();
        beginShape();
        vertex(0, -alto/4);
        bezierVertex(ancho/4, -alto/2, ancho/2, -alto/4, 0, alto/2);
        bezierVertex(-ancho/2, -alto/4, -ancho/4, -alto/2, 0, -alto/4);
        endShape(CLOSE);
        
        // Brillo
        fill(255, 255, 255, 100);
        ellipse(-ancho/5, -alto/5, ancho/4, alto/4);
        
        pop();
    }
}
