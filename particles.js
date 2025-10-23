class ParticleSystem {
    constructor() {
        this.explosionParticles = [];
        this.hoverParticles = [];
        this.energyParticles = []; // Nuevas partículas para efectos de energía
    }

    // Create explosion particles when a sequence is completed
    createExplosion(x, y, color) {
        // Create a burst of particles
        for (let i = 0; i < 150; i++) { // Aumentado de 100 a 150 partículas
            this.explosionParticles.push(new ExplosionParticle(x, y, color));
        }
    }

    // Create hover particles when hovering over a point
    createHoverEffect(x, y, color) {
        // Create a small number of hover particles
        for (let i = 0; i < 5; i++) { // Aumentado de 3 a 5 partículas
            this.hoverParticles.push(new HoverParticle(x, y, color));
        }
    }

    // Añadir una partícula individual (para efectos de energía)
    addParticle(x, y, particleColor, size, velocity) {
        this.energyParticles.push(new EnergyParticle(x, y, particleColor, size, velocity));
    }
    
    update() {
        // Update and remove explosion particles
        for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
            this.explosionParticles[i].update();
            if (this.explosionParticles[i].isDead()) {
                this.explosionParticles.splice(i, 1);
            }
        }

        // Update and remove hover particles
        for (let i = this.hoverParticles.length - 1; i >= 0; i--) {
            this.hoverParticles[i].update();
            if (this.hoverParticles[i].isDead()) {
                this.hoverParticles.splice(i, 1);
            }
        }
        
        // Update and remove energy particles
        for (let i = this.energyParticles.length - 1; i >= 0; i--) {
            this.energyParticles[i].update();
            if (this.energyParticles[i].isDead()) {
                this.energyParticles.splice(i, 1);
            }
        }
    }

    display() {
        // Display explosion particles
        for (let i = 0; i < this.explosionParticles.length; i++) {
            this.explosionParticles[i].display();
        }

        // Display hover particles
        for (let i = 0; i < this.hoverParticles.length; i++) {
            this.hoverParticles[i].display();
        }
        
        // Display energy particles
        for (let i = 0; i < this.energyParticles.length; i++) {
            this.energyParticles[i].display();
        }
    }
}

class ExplosionParticle {
    constructor(x, y, baseColor) {
        this.position = createVector(x, y);
        this.velocity = p5.Vector.random2D();
        this.velocity.mult(random(2, 10));
        this.acceleration = createVector(0, 0.1);
        this.lifespan = 400;
        
        // Generate a random color based on the base color with some variation
        if (baseColor) {
            this.color = color(
                red(baseColor) + random(-50, 50),
                green(baseColor) + random(-50, 50),
                blue(baseColor) + random(-50, 50)
            );
        } else {
            this.color = color(random(100, 255), random(100, 255), random(100, 255));
        }
        
        this.size = random(5, 15);
        
        // Efecto de brillo pulsante
        this.glowPhase = random(TWO_PI);
        this.glowSpeed = random(0.05, 0.15);
    }

    update() {
        this.velocity.add(this.acceleration);
        this.position.add(this.velocity);
        this.lifespan -= 3;
        
        // Add some random movement
        this.velocity.x += random(-0.5, 0.5);
        this.velocity.y += random(-0.5, 0.5);
        
        // Actualizar fase de brillo
        this.glowPhase += this.glowSpeed;
    }

    display() {
        push();
        translate(this.position.x, this.position.y);
        
        // Calcular opacidad basada en lifespan
        let alpha = map(this.lifespan, 0, 400, 0, 255);
        
        // Efecto de brillo pulsante
        let glowIntensity = sin(this.glowPhase) * 0.3 + 0.7;
        let currentSize = this.size * glowIntensity;
        
        noStroke();
        
        // Halo exterior
        fill(red(this.color), green(this.color), blue(this.color), alpha * 0.3);
        ellipse(0, 0, currentSize * 2, currentSize * 2);
        
        // Uva principal
        fill(red(this.color), green(this.color), blue(this.color), alpha);
        ellipse(0, 0, currentSize, currentSize * 1.1);
        
        // Brillo de uva
        fill(255, 255, 255, alpha * 0.6);
        ellipse(-currentSize * 0.2, -currentSize * 0.2, currentSize * 0.3, currentSize * 0.3);
        
        pop();
    }

    isDead() {
        return this.lifespan <= 0;
    }
}

class HoverParticle {
    constructor(x, y, baseColor) {
        this.position = createVector(
            x + random(-30, 30), 
            y + random(-30, 30)
        );
        this.velocity = createVector(random(-1, 1), random(-1, 1));
        this.lifespan = 200;
        
        // Use the base color with some transparency
        if (baseColor) {
            this.color = color(
                red(baseColor),
                green(baseColor),
                blue(baseColor),
                200
            );
        } else {
            // Default to bright cyan/blue if no base color provided
            this.color = color(100, 200, 255, 200);
        }
        
        this.size = random(8, 18);
        
        // Propiedades orgánicas
        this.pulsePhase = random(TWO_PI);
        this.pulseSpeed = random(0.08, 0.2);
        this.floatPhase = random(TWO_PI);
        this.floatSpeed = random(0.02, 0.06);
    }

    update() {
        // Movimiento flotante suave (como partículas en agua)
        this.velocity.x += sin(this.floatPhase) * 0.15;
        this.velocity.y += cos(this.floatPhase * 1.2) * 0.15 - 0.08; // Flotar hacia arriba
        
        this.position.add(this.velocity);
        this.lifespan -= 2;
        
        // Limit velocity for smoother movement
        this.velocity.limit(1.5);
        
        // Actualizar fases
        this.pulsePhase += this.pulseSpeed;
        this.floatPhase += this.floatSpeed;
    }

    display() {
        push();
        translate(this.position.x, this.position.y);
        
        // Efecto de pulsación
        let pulseScale = sin(this.pulsePhase) * 0.2 + 1;
        let currentSize = this.size * pulseScale;
        
        noStroke();
        
        // Halo exterior suave
        fill(red(this.color), green(this.color), blue(this.color), this.lifespan * 0.2);
        ellipse(0, 0, currentSize * 2.5, currentSize * 2.5);
        
        fill(red(this.color), green(this.color), blue(this.color), this.lifespan * 0.4);
        ellipse(0, 0, currentSize * 1.8, currentSize * 1.8);
        
        // Cuerpo principal
        fill(red(this.color), green(this.color), blue(this.color), this.lifespan);
        ellipse(0, 0, currentSize, currentSize);
        
        // Brillo interno
        fill(255, 255, 255, this.lifespan * 0.7);
        ellipse(-currentSize * 0.2, -currentSize * 0.2, currentSize * 0.4, currentSize * 0.4);
        
        pop();
    }

    isDead() {
        return this.lifespan <= 0;
    }
}

// Nueva clase para partículas de energía que emanan del score
class EnergyParticle {
    constructor(x, y, particleColor, size, velocity) {
        this.position = createVector(x, y);
        this.velocity = velocity || createVector(random(-2, 2), random(-2, 2));
        this.acceleration = createVector(0, 0);
        this.lifespan = 255;
        this.color = particleColor || color(255, 255, 255, 200);
        this.size = size || random(5, 12);
        this.initialSize = this.size;
        this.rotationAngle = random(TWO_PI);
        this.rotationSpeed = random(-0.1, 0.1);
        
        // Propiedades para efecto orgánico
        this.pulsePhase = random(TWO_PI);
        this.pulseSpeed = random(0.05, 0.15);
        this.wobblePhase = random(TWO_PI);
        this.wobbleSpeed = random(0.03, 0.08);
    }

    update() {
        // Movimiento flotante orgánico (como burbujas en líquido)
        this.acceleration = createVector(
            sin(this.wobblePhase) * 0.2,
            cos(this.wobblePhase * 1.3) * 0.2 - 0.1  // Tendencia a flotar hacia arriba
        );
        this.velocity.add(this.acceleration);
        this.position.add(this.velocity);
        
        // Limitar velocidad
        this.velocity.limit(2.5);
        
        // Reducir vida y tamaño gradualmente
        this.lifespan -= 5;
        this.size = map(this.lifespan, 255, 0, this.initialSize, 0);
        
        // Actualizar fases de animación
        this.rotationAngle += this.rotationSpeed;
        this.pulsePhase += this.pulseSpeed;
        this.wobblePhase += this.wobbleSpeed;
    }

    display() {
        push();
        translate(this.position.x, this.position.y);
        
        // Efecto de pulsación
        let pulseScale = sin(this.pulsePhase) * 0.15 + 1;
        let currentSize = this.size * pulseScale;
        
        // Deformación orgánica (como una burbuja)
        let wobbleX = sin(this.wobblePhase) * 0.1 + 1;
        let wobbleY = cos(this.wobblePhase * 1.5) * 0.1 + 1;
        
        noStroke();
        
        // Halo exterior difuso (múltiples capas para efecto translúcido)
        for (let i = 3; i > 0; i--) {
            fill(red(this.color), green(this.color), blue(this.color), this.lifespan * 0.15 * i / 3);
            ellipse(0, 0, currentSize * (2 + i * 0.5) * wobbleX, currentSize * (2 + i * 0.5) * wobbleY);
        }
        
        // Cuerpo principal translúcido
        fill(red(this.color), green(this.color), blue(this.color), this.lifespan * 0.7);
        ellipse(0, 0, currentSize * wobbleX, currentSize * wobbleY);
        
        // Brillo interno (múltiples puntos para efecto más orgánico)
        fill(255, 255, 255, this.lifespan * 0.6);
        ellipse(-currentSize * 0.15, -currentSize * 0.15, currentSize * 0.35, currentSize * 0.35);
        
        // Brillo secundario
        fill(255, 255, 255, this.lifespan * 0.3);
        ellipse(currentSize * 0.1, currentSize * 0.1, currentSize * 0.2, currentSize * 0.2);
        
        pop();
    }

    isDead() {
        return this.lifespan <= 0;
    }
}
