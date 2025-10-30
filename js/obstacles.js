class ObstacleSystem {
    constructor() {
        this.obstacles = [];
        this.failAnimations = [];
        this.lastStaticObstacleTime = 0;
        this.lastMovingObstacleTime = 0;
        this.staticObstacleInterval = CONFIG.obstacles.spawnRate.static;
        this.movingObstacleInterval = CONFIG.obstacles.spawnRate.moving;
        this.maxStaticObstacles = CONFIG.obstacles.maxCount.static;
        this.maxMovingObstacles = CONFIG.obstacles.maxCount.moving;
    }

    update() {
        // Generar nuevos obstáculos
        if (millis() - this.lastStaticObstacleTime > this.staticObstacleInterval && this.obstacles.filter(obstacle => obstacle instanceof StaticObstacle).length < this.maxStaticObstacles) {
            this.spawnStaticObstacle();
            this.lastStaticObstacleTime = millis();
        }

        if (millis() - this.lastMovingObstacleTime > this.movingObstacleInterval && this.obstacles.filter(obstacle => obstacle instanceof MovingObstacle).length < this.maxMovingObstacles) {
            this.spawnMovingObstacle();
            this.lastMovingObstacleTime = millis();
        }

        // Actualizar obstáculos existentes
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            this.obstacles[i].update();

            // Eliminar obstáculos que salen de la pantalla
            if (this.obstacles[i].isOffScreen()) {
                this.obstacles.splice(i, 1);
            }
        }

        // Actualizar animaciones de fallo
        for (let i = this.failAnimations.length - 1; i >= 0; i--) {
            this.failAnimations[i].update();
            if (this.failAnimations[i].isDead()) {
                this.failAnimations.splice(i, 1);
            }
        }
    }

    display() {
        // Mostrar obstáculos
        for (let obstacle of this.obstacles) {
            obstacle.display();
        }

        // Mostrar animaciones de fallo
        for (let anim of this.failAnimations) {
            anim.display();
        }
    }

    spawnStaticObstacle() {
        // Crear un obstáculo estático en una posición aleatoria
        let x = random(width * 0.1, width * 0.9);
        let y = random(height * 0.1, height * 0.9);

        this.obstacles.push(new StaticObstacle(x, y));
    }

    spawnMovingObstacle() {
        // Determinar tipo de obstáculo
        const obstacleType = random(1) < 0.7 ? 'moving' : 'static';

        if (obstacleType === 'moving') {
            // Crear un obstáculo móvil que atraviesa la pantalla
            const side = floor(random(4)); // 0: arriba, 1: derecha, 2: abajo, 3: izquierda
            let x, y, vx = 0, vy = 0;

            switch (side) {
                case 0: // arriba
                    x = random(width);
                    y = -30;
                    vy = CONFIG.obstacles.moving.speed;
                    break;
                case 1: // derecha
                    x = width + 30;
                    y = random(height);
                    vx = -CONFIG.obstacles.moving.speed;
                    break;
                case 2: // abajo
                    x = random(width);
                    y = height + 30;
                    vy = -CONFIG.obstacles.moving.speed;
                    break;
                case 3: // izquierda
                    x = -30;
                    y = random(height);
                    vx = CONFIG.obstacles.moving.speed;
                    break;
            }

            this.obstacles.push(new MovingObstacle(x, y, vx, vy));
        }
    }

    checkCollisions(points) {
        // Verificar colisiones entre puntos del jugador y obstáculos
        let collision = false;
        let collisionPoint = null;

        // Comprobar colisiones con cada obstáculo
        for (let obstacle of this.obstacles) {
            for (let point of points) {
                const d = dist(obstacle.pos.x, obstacle.pos.y, point.x, point.y);
                if (d < obstacle.size / 2) {
                    collision = true;
                    collisionPoint = createVector(point.x, point.y);

                    // Crear animación de fallo
                    this.createFailAnimation(point.x, point.y);

                    // Solo registramos la primera colisión
                    break;
                }
            }
            if (collision) break;
        }

        return {
            collision,
            collisionPoint,
            penalty: CONFIG.obstacles.penalty // Devolver la penalización configurada
        };
    }

    createFailAnimation(x, y) {
        this.failAnimations.push(new FailAnimation(x, y));
    }
}

class Obstacle {
    constructor(x, y) {
        this.pos = createVector(x, y);
        this.size = random(
            CONFIG.obstacles.static.size.min, 
            CONFIG.obstacles.static.size.max
        );
        this.color = color(
            CONFIG.obstacles.static.color[0],
            CONFIG.obstacles.static.color[1],
            CONFIG.obstacles.static.color[2]
        );
        this.pulsePhase = random(TWO_PI);
    }
    
    update() {
        // Actualizar fase de pulso para animación
        this.pulsePhase += 0.05;
        if (this.pulsePhase > TWO_PI) this.pulsePhase -= TWO_PI;
    }
    
    display() {
        // Dibujar obstáculo con efecto pulsante
        const pulseFactor = 1 + 0.1 * sin(this.pulsePhase);
        
        // Aura exterior
        noStroke();
        for (let i = 5; i > 0; i--) {
            fill(255, 0, 0, 10);
            ellipse(this.pos.x, this.pos.y, this.size * (1.2 + i*0.1) * pulseFactor, this.size * (1.2 + i*0.1) * pulseFactor);
        }
        
        // Cuerpo principal
        fill(255, 0, 0, 200);
        stroke(255, 100, 100);
        strokeWeight(2);
        ellipse(this.pos.x, this.pos.y, this.size * pulseFactor, this.size * pulseFactor);
        
        // Patrón interior
        noStroke();
        fill(255, 150, 150);
        const innerSize = this.size * 0.6 * pulseFactor;
        
        // Dibujar X
        stroke(255);
        strokeWeight(3);
        line(this.pos.x - innerSize/2, this.pos.y - innerSize/2, this.pos.x + innerSize/2, this.pos.y + innerSize/2);
        line(this.pos.x + innerSize/2, this.pos.y - innerSize/2, this.pos.x - innerSize/2, this.pos.y + innerSize/2);
    }
    
    checkCollision(x, y) {
        // Verificar si un punto está colisionando con este obstáculo
        return dist(x, y, this.pos.x, this.pos.y) < this.size/2;
    }
    
    isOffScreen() {
        // Verificar si el obstáculo está fuera de la pantalla
        return (this.pos.x < -50 || this.pos.x > width + 50 || 
                this.pos.y < -50 || this.pos.y > height + 50);
    }
}

class MovingObstacle extends Obstacle {
    constructor(x, y, vx, vy) {
        super(x, y);
        this.velocity = createVector(vx, vy);
        this.color = color(
            CONFIG.obstacles.moving.color[0],
            CONFIG.obstacles.moving.color[1],
            CONFIG.obstacles.moving.color[2]
        );
        this.rotationAngle = 0;
        this.rotationSpeed = random(
            CONFIG.obstacles.moving.rotationSpeed.min, 
            CONFIG.obstacles.moving.rotationSpeed.max
        ) * (random() > 0.5 ? 1 : -1); // Velocidad de rotación aleatoria
        
        // Ajustar tamaño según configuración
        this.size = random(
            CONFIG.obstacles.moving.size.min, 
            CONFIG.obstacles.moving.size.max
        );
    }
    
    update() {
        super.update();
        // Actualizar posición
        this.pos.add(this.velocity);
        // Actualizar rotación
        this.rotationAngle += this.rotationSpeed;
    }
    
    display() {
        const pulseFactor = 1 + 0.1 * sin(this.pulsePhase);
        
        // Estela de movimiento
        noStroke();
        for (let i = 0; i < 5; i++) {
            fill(255, 50, 0, 30 - i*5);
            const trailPos = p5.Vector.sub(this.pos, p5.Vector.mult(this.velocity, i*2));
            ellipse(trailPos.x, trailPos.y, this.size * 0.8, this.size * 0.8);
        }
        
        // Aura exterior
        for (let i = 3; i > 0; i--) {
            fill(255, 50, 0, 15);
            ellipse(this.pos.x, this.pos.y, this.size * (1.2 + i*0.1) * pulseFactor, this.size * (1.2 + i*0.1) * pulseFactor);
        }
        
        // Cuerpo principal con forma de estrella similar a los obstáculos estáticos
        push();
        translate(this.pos.x, this.pos.y);
        rotate(this.rotationAngle);
        
        fill(255, 50, 0, 200);
        stroke(255, 150, 100);
        strokeWeight(2);
        
        // Forma de estrella con menos picos que los estáticos
        const spikes = CONFIG.obstacles.moving.spikes;
        const outerRadius = this.size/2 * pulseFactor;
        const innerRadius = this.size/3 * pulseFactor;
        
        beginShape();
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = map(i, 0, spikes * 2, 0, TWO_PI);
            const x = radius * cos(angle);
            const y = radius * sin(angle);
            vertex(x, y);
        }
        endShape(CLOSE);
        
        // Círculo central
        fill(255, 150, 100);
        noStroke();
        ellipse(0, 0, this.size * 0.3, this.size * 0.3);
        
        // Símbolo de dirección (flecha)
        fill(255);
        noStroke();
        const arrowSize = this.size * 0.2;
        triangle(
            arrowSize, 0,
            -arrowSize/2, arrowSize/2,
            -arrowSize/2, -arrowSize/2
        );
        
        pop();
    }
    
    isOffScreen() {
        // Asegurarse de que los obstáculos se eliminen cuando salgan de la pantalla
        return (this.pos.x < -this.size || this.pos.x > width + this.size || 
                this.pos.y < -this.size || this.pos.y > height + this.size);
    }
}

class StaticObstacle extends Obstacle {
    constructor(x, y) {
        super(x, y);
        this.color = color(
            CONFIG.obstacles.static.color[0],
            CONFIG.obstacles.static.color[1],
            CONFIG.obstacles.static.color[2]
        );
        this.rotationAngle = 0;
        this.lifespan = random(
            CONFIG.obstacles.static.lifespan.min, 
            CONFIG.obstacles.static.lifespan.max
        );
        this.birthTime = millis();
    }
    
    update() {
        super.update();
        // Rotación lenta
        this.rotationAngle += CONFIG.obstacles.static.rotationSpeed;
    }
    
    display() {
        // Calcular tiempo de vida restante
        const elapsedTime = millis() - this.birthTime;
        const remainingLifeRatio = 1 - constrain(elapsedTime / this.lifespan, 0, 1);
        const pulseFactor = 1 + 0.1 * sin(this.pulsePhase);
        
        // Aura exterior que cambia con el tiempo de vida
        noStroke();
        for (let i = 3; i > 0; i--) {
            const alphaFactor = map(remainingLifeRatio, 0, 1, 5, 15); // Más transparente cuando queda menos vida
            fill(200, 0, 0, alphaFactor);
            ellipse(this.pos.x, this.pos.y, this.size * (1.2 + i*0.1) * pulseFactor, this.size * (1.2 + i*0.1) * pulseFactor);
        }
        
        // Cuerpo principal
        push();
        translate(this.pos.x, this.pos.y);
        rotate(this.rotationAngle);
        
        // Color que cambia con el tiempo de vida (más claro cuando está por desaparecer)
        const redValue = map(remainingLifeRatio, 0, 1, 255, 200);
        const alphaValue = map(remainingLifeRatio, 0, 1, 100, 200);
        fill(redValue, 0, 0, alphaValue);
        stroke(255, 100, 100, alphaValue);
        strokeWeight(2);
        
        // Forma de estrella
        const spikes = CONFIG.obstacles.static.spikes;
        const outerRadius = this.size/2 * pulseFactor;
        const innerRadius = this.size/4 * pulseFactor;
        
        beginShape();
        for (let i = 0; i < spikes * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = map(i, 0, spikes * 2, 0, TWO_PI);
            const x = radius * cos(angle);
            const y = radius * sin(angle);
            vertex(x, y);
        }
        endShape(CLOSE);
        
        // Círculo central con indicador de tiempo
        const centerSize = this.size * 0.3;
        fill(255, 150, 150, alphaValue);
        noStroke();
        ellipse(0, 0, centerSize, centerSize);
        
        // Indicador de tiempo restante (como un reloj)
        if (remainingLifeRatio < 1) {
            fill(50, 0, 0);
            arc(0, 0, centerSize * 0.8, centerSize * 0.8, 0, TWO_PI * (1 - remainingLifeRatio));
        }
        
        pop();
    }
    
    isOffScreen() {
        // Verificar si el obstáculo está fuera de la pantalla o si su vida ha terminado
        return super.isOffScreen() || (millis() - this.birthTime > this.lifespan);
    }
}

class FailAnimation {
    constructor(x, y) {
        this.pos = createVector(x, y);
        this.startTime = millis();
        this.duration = 2000; // 2 segundos de duración
        this.particles = [];
        
        // Crear partículas de explosión
        for (let i = 0; i < 50; i++) {
            this.particles.push({
                pos: createVector(x, y),
                vel: p5.Vector.random2D().mult(random(2, 8)),
                size: random(5, 15),
                color: color(255, random(0, 100), 0, 255),
                life: 255
            });
        }
        
        // Crear ondas expansivas
        this.waves = [];
        for (let i = 0; i < 3; i++) {
            this.waves.push({
                radius: 0,
                maxRadius: 200 + i * 50,
                speed: 5 + i * 2,
                alpha: 255
            });
        }
    }
    
    update() {
        // Actualizar partículas
        for (let p of this.particles) {
            p.pos.add(p.vel);
            p.vel.mult(0.95); // Desaceleración
            p.life -= 5;
        }
        
        // Actualizar ondas
        for (let wave of this.waves) {
            wave.radius += wave.speed;
            wave.alpha = map(wave.radius, 0, wave.maxRadius, 255, 0);
        }
    }
    
    display() {
        // Dibujar texto de fallo
        const elapsed = millis() - this.startTime;
        const alpha = map(elapsed, 0, this.duration, 255, 0);
        
        // Dibujar ondas
        for (let wave of this.waves) {
            noFill();
            stroke(255, 0, 0, wave.alpha * 0.7);
            strokeWeight(3);
            ellipse(this.pos.x, this.pos.y, wave.radius * 2);
        }
        
        // Dibujar partículas
        for (let p of this.particles) {
            if (p.life > 0) {
                noStroke();
                fill(red(p.color), green(p.color), blue(p.color), p.life);
                ellipse(p.pos.x, p.pos.y, p.size);
            }
        }
        
        // Dibujar texto
        if (alpha > 0) {
            push();
            translate(this.pos.x, this.pos.y);
            
            // Efecto de sacudida
            const shake = 5 * (1 - elapsed / this.duration);
            translate(random(-shake, shake), random(-shake, shake));
            
            // Texto principal
            textAlign(CENTER, CENTER);
            textSize(40 + 20 * sin(elapsed * 0.01));
            fill(255, 0, 0, alpha);
            stroke(0, 0, 0, alpha * 0.7);
            strokeWeight(4);
            text("-10", 0, -40);
            
            // Texto secundario
            textSize(30);
            fill(255, 50, 50, alpha);
            stroke(0, 0, 0, alpha * 0.5);
            strokeWeight(3);
            text("¡OBSTÁCULO!", 0, 10);
            
            pop();
        }
    }
    
    isDead() {
        return millis() - this.startTime > this.duration;
    }
}
