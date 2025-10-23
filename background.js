class DynamicBackground {
    constructor() {
        this.waves = [];
        this.numWaves = CONFIG.background.waves.count;
        this.ripples = [];
        this.maxRipples = CONFIG.background.ripples.max;
        
        // Sistema de texturas dinámicas
        this.currentTextureIndex = 0;
        this.nextTextureIndex = 1;
        this.transitionProgress = 0;
        this.transitionSpeed = 0.003; // Velocidad de transición
        this.textureScale = 1.0;
        this.textureRotation = 0;
        this.textureRotationSpeed = 0.0005;
        
        // Crear ondas base
        for (let i = 0; i < this.numWaves; i++) {
            this.waves.push({
                amplitude: random(CONFIG.background.waves.amplitude.min, CONFIG.background.waves.amplitude.max),
                period: random(CONFIG.background.waves.period.min, CONFIG.background.waves.period.max),
                phase: random(TWO_PI),
                speed: random(CONFIG.background.waves.speed.min, CONFIG.background.waves.speed.max)
            });
        }
    }
    
    addRipple(x, y) {
        // Añadir una nueva onda expansiva con parámetros de configuración
        this.ripples.push({
            pos: createVector(x, y),
            radius: 0,
            maxRadius: random(CONFIG.background.ripples.radius.min, CONFIG.background.ripples.radius.max),
            speed: random(CONFIG.background.ripples.speed.min, CONFIG.background.ripples.speed.max),
            alpha: 255,
            thickness: random(CONFIG.background.ripples.thickness.min, CONFIG.background.ripples.thickness.max),
            birthTime: millis(),
            lifespan: random(CONFIG.background.ripples.lifespan.min, CONFIG.background.ripples.lifespan.max)
        });
        
        // Limitar la cantidad de ondas
        if (this.ripples.length > this.maxRipples) {
            this.ripples.shift();
        }
    }
    
    update() {
        // Actualizar ondas base
        for (let wave of this.waves) {
            wave.phase += wave.speed;
        }
        
        // Actualizar ondas expansivas con desvanecimiento más suave
        const currentTime = millis();
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const ripple = this.ripples[i];
            
            // Calcular progreso de vida
            const lifeProgress = (currentTime - ripple.birthTime) / ripple.lifespan;
            
            // Actualizar radio con velocidad que disminuye con el tiempo
            const speedFactor = map(lifeProgress, 0, 1, 1, 0.5);
            ripple.radius += ripple.speed * speedFactor;
            
            // Calcular alpha basado en el tiempo de vida y no solo en el radio
            ripple.alpha = map(lifeProgress, 0, 1, 255, 0);
            
            // Eliminar ondas que han completado su ciclo de vida
            if (lifeProgress >= 1) {
                this.ripples.splice(i, 1);
            }
        }
        
        // Actualizar transición de texturas
        this.transitionProgress += this.transitionSpeed;
        if (this.transitionProgress >= 1) {
            this.transitionProgress = 0;
            this.currentTextureIndex = this.nextTextureIndex;
            this.nextTextureIndex = (this.nextTextureIndex + 1) % backgroundTextures.length;
        }
        
        // Actualizar rotación de textura
        this.textureRotation += this.textureRotationSpeed;
    }
    
    
    display() {
        // Dibujar fondo base con textura dinámica
        this.drawWineCellarBackground();
        
        // Dibujar ondas expansivas con efecto más suave
        for (let ripple of this.ripples) {
            // Dibujar múltiples anillos con diferentes opacidades para un efecto más suave
            for (let i = 0; i < 3; i++) {
                const ringAlpha = ripple.alpha * (0.5 - i * 0.15);
                const ringOffset = i * 5;
                
                noFill();
                stroke(CONFIG.background.ripples.color[0], 
                       CONFIG.background.ripples.color[1], 
                       CONFIG.background.ripples.color[2], 
                       ringAlpha);
                strokeWeight(2 - i * 0.5);
                ellipse(ripple.pos.x, ripple.pos.y, (ripple.radius - ringOffset) * 2);
            }
            
            // Añadir un brillo central que permanece más tiempo
            const centerAlpha = map(ripple.radius, 0, ripple.maxRadius * 0.2, 100, 0);
            if (centerAlpha > 0) {
                noStroke();
                fill(150, 200, 255, centerAlpha);
                ellipse(ripple.pos.x, ripple.pos.y, 10, 10);
            }
        }
    }
    
    drawWineCellarBackground() {
        // Fondo negro profundo
        background(5, 5, 10);
        
        // Dibujar textura dinámica con transición suave
        if (backgroundTexturesLoaded && backgroundTextures.length > 0) {
            push();
            imageMode(CENTER);
            translate(width / 2, height / 2);
            rotate(this.textureRotation);
            
            // Textura actual
            tint(255, 255, 255, 70 * (1 - this.transitionProgress));
            image(backgroundTextures[this.currentTextureIndex], 0, 0, width * 1.2, height * 1.2);
            
            // Textura siguiente (fade in)
            tint(255, 255, 255, 70 * this.transitionProgress);
            image(backgroundTextures[this.nextTextureIndex], 0, 0, width * 1.2, height * 1.2);
            
            pop();
        }
    }
    
    resize() {
        // Ya no necesitamos actualizar la grilla
    }
}
