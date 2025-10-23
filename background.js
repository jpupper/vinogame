class DynamicBackground {
    constructor() {
        this.waves = [];
        this.numWaves = CONFIG.background.waves.count;
        this.ripples = [];
        this.maxRipples = CONFIG.background.ripples.max;
        this.gridSize = CONFIG.background.grid.size;
        this.cols = Math.ceil(width / this.gridSize) + 1;
        this.rows = Math.ceil(height / this.gridSize) + 1;
        this.gridPoints = []; // Almacenar el estado de los puntos de la grilla
        
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
            // Esto permite que la onda mantenga su visibilidad más tiempo
            ripple.alpha = map(lifeProgress, 0, 1, 255, 0);
            
            // Eliminar ondas que han completado su ciclo de vida
            if (lifeProgress >= 1) {
                this.ripples.splice(i, 1);
            }
        }
        
        // Inicializar o actualizar el estado de los puntos de la grilla
        if (this.gridPoints.length === 0) {
            this.initializeGridPoints();
        }
        
        // Actualizar el estado de los puntos de la grilla con inercia
        this.updateGridPoints();
    }
    
    initializeGridPoints() {
        // Crear una matriz para almacenar el estado de cada punto de la grilla
        for (let x = 0; x < this.cols; x++) {
            this.gridPoints[x] = [];
            for (let y = 0; y < this.rows; y++) {
                this.gridPoints[x][y] = {
                    displacement: 0,
                    targetDisplacement: 0,
                    size: 3,
                    targetSize: 3
                };
            }
        }
    }
    
    updateGridPoints() {
        // Actualizar cada punto de la grilla con inercia para un movimiento más suave
        for (let x = 0; x < this.cols; x++) {
            for (let y = 0; y < this.rows; y++) {
                const point = this.gridPoints[x][y];
                const xPos = x * this.gridSize;
                const yPos = y * this.gridSize;
                
                // Calcular nuevo desplazamiento objetivo basado en ondas
                let newTargetDisplacement = 0;
                
                // Efecto de ondas base
                for (let wave of this.waves) {
                    const distance = dist(width/2, height/2, xPos, yPos) * 0.01;
                    newTargetDisplacement += wave.amplitude * sin(distance * wave.period + wave.phase);
                }
                
                // Efecto de ondas expansivas
                let rippleInfluence = 0;
                for (let ripple of this.ripples) {
                    const d = dist(ripple.pos.x, ripple.pos.y, xPos, yPos);
                    const rippleEdge = ripple.radius;
                    const rippleThickness = ripple.thickness;
                    
                    // Si el punto está dentro del rango de influencia de la onda
                    if (d < rippleEdge + rippleThickness && d > rippleEdge - rippleThickness) {
                        // Calcular qué tan cerca está el punto del centro de la onda
                        const distFromEdge = abs(d - rippleEdge);
                        const normalizedDist = distFromEdge / rippleThickness;
                        
                        // Efecto más fuerte en el centro de la onda
                        const rippleEffect = (1 - normalizedDist) * 25 * (ripple.alpha / 255);
                        newTargetDisplacement += rippleEffect;
                        rippleInfluence += rippleEffect * 0.6;
                    }
                }
                
                // Actualizar desplazamiento con inercia (movimiento suave)
                point.targetDisplacement = newTargetDisplacement;
                point.displacement = lerp(point.displacement, point.targetDisplacement, CONFIG.background.grid.inertia);
                
                // Actualizar tamaño con inercia
                const baseSize = map(point.displacement, -15, 15, 
                                     CONFIG.background.grid.pointSizeRange.min, 
                                     CONFIG.background.grid.pointSizeRange.max);
                const extraSize = rippleInfluence * 0.8;
                point.targetSize = baseSize + extraSize;
                point.size = lerp(point.size, point.targetSize, CONFIG.background.grid.inertia * 1.5);
            }
        }
    }
    
    display() {
        // Dibujar fondo base con gradiente de bodega
        this.drawWineCellarBackground();
        
        // Dibujar la cuadrícula de puntos usando los estados almacenados
        for (let x = 0; x < this.cols; x++) {
            for (let y = 0; y < this.rows; y++) {
                if (!this.gridPoints[x] || !this.gridPoints[x][y]) continue;
                
                const point = this.gridPoints[x][y];
                const xPos = x * this.gridSize;
                const yPos = y * this.gridSize;
                
                // Usar el desplazamiento calculado con inercia
                const displacement = point.displacement;
                
                // Calcular color basado en posición y desplazamiento
                const hue = map(displacement, -15, 15, 
                               CONFIG.background.grid.colors.hueRange[0], 
                               CONFIG.background.grid.colors.hueRange[1]);
                const saturation = map(displacement, -15, 15, 
                                      CONFIG.background.grid.colors.satRange[0], 
                                      CONFIG.background.grid.colors.satRange[1]);
                const brightness = map(displacement, -15, 15, 
                                     CONFIG.background.grid.colors.briRange[0], 
                                     CONFIG.background.grid.colors.briRange[1]);
                
                colorMode(HSB, 360, 100, 100, 255);
                const dotColor = color(hue, saturation, brightness);
                colorMode(RGB, 255, 255, 255, 255);
                
                // Dibujar punto con tamaño suavizado
                noStroke();
                fill(dotColor);
                
                // Usar el tamaño calculado con inercia
                const finalSize = point.size;
                
                // Dibujar círculo con tamaño dinámico
                ellipse(xPos, yPos, finalSize, finalSize);
                
                // Dibujar brillo central para círculos grandes
                if (finalSize > 6) {
                    fill(255, 255, 255, map(finalSize, 6, 15, 30, 100));
                    ellipse(xPos, yPos, finalSize * 0.4, finalSize * 0.4);
                }
            }
        }
        
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
        // Gradiente de bodega de vino
        for (let y = 0; y < height; y++) {
            const inter = map(y, 0, height, 0, 1);
            const c = lerpColor(
                color(25, 15, 35),    // Morado oscuro arriba
                color(15, 8, 25),     // Casi negro abajo
                inter
            );
            stroke(c);
            line(0, y, width, y);
        }
        
        // Viñetas sutiles en las esquinas
        noStroke();
        
        // Esquina superior izquierda
        for (let i = 0; i < 150; i++) {
            fill(0, 0, 0, map(i, 0, 150, 40, 0));
            ellipse(0, 0, (150 - i) * 8, (150 - i) * 8);
        }
        
        // Esquina superior derecha
        for (let i = 0; i < 150; i++) {
            fill(0, 0, 0, map(i, 0, 150, 40, 0));
            ellipse(width, 0, (150 - i) * 8, (150 - i) * 8);
        }
        
        // Destellos sutiles de luz ambiente (como velas)
        fill(180, 120, 80, 8);
        ellipse(width * 0.2, height * 0.3, 300, 400);
        fill(150, 100, 120, 8);
        ellipse(width * 0.8, height * 0.6, 350, 450);
    }
    
    resize() {
        this.cols = Math.ceil(width / this.gridSize) + 1;
        this.rows = Math.ceil(height / this.gridSize) + 1;
    }
}
