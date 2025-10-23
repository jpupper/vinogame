class TrailSystem {
    constructor() {
        this.trails = {};
        this.maxLength = CONFIG.trail.maxLength;
    }

    addTrail(x, y, id, color) {
        // Agregar un nuevo punto de rastro
        if (!this.trails[id]) {
            this.trails[id] = [];
        }
        this.trails[id].push(new TrailPoint(x, y, id, color));
        
        // Limitar la cantidad de puntos de rastro
        if (this.trails[id].length > this.maxLength) {
            this.trails[id].shift(); // Eliminar el más antiguo
        }
    }

    update() {
        // Actualizar cada rastro
        for (let id in this.trails) {
            // Reducir la opacidad de los puntos más antiguos
            for (let i = 0; i < this.trails[id].length; i++) {
                this.trails[id][i].alpha -= CONFIG.trail.fadeSpeed;
            }
            
            // Eliminar puntos que ya no son visibles
            this.trails[id] = this.trails[id].filter(p => p.alpha > 0);
        }
    }

    display() {
        // Dibujar cada rastro
        for (let id in this.trails) {
            const trail = this.trails[id];
            if (trail.length < 2) continue;
            
            noFill();
            strokeWeight(CONFIG.trail.thickness);
            
            // Dibujar segmentos del rastro con degradado
            for (let i = 0; i < trail.length - 1; i++) {
                const p1 = trail[i];
                const p2 = trail[i + 1];
                
                // Calcular color basado en la configuración
                if (CONFIG.trail.colorMode === 'rainbow') {
                    // Modo arcoíris
                    const hue = (frameCount * 2 + i * 10) % 360;
                    colorMode(HSB, 360, 100, 100, 255);
                    const alpha = map(i, 0, trail.length - 1, 0, CONFIG.trail.opacity);
                    stroke(hue, 80, 100, alpha);
                    colorMode(RGB, 255, 255, 255, 255);
                } else if (CONFIG.trail.colorMode === 'gradient') {
                    // Modo gradiente entre dos colores
                    const progress = map(i, 0, trail.length - 1, 0, 1);
                    const r = lerp(CONFIG.trail.gradient.start[0], CONFIG.trail.gradient.end[0], progress);
                    const g = lerp(CONFIG.trail.gradient.start[1], CONFIG.trail.gradient.end[1], progress);
                    const b = lerp(CONFIG.trail.gradient.start[2], CONFIG.trail.gradient.end[2], progress);
                    const alpha = map(i, 0, trail.length - 1, 0, CONFIG.trail.opacity);
                    stroke(r, g, b, alpha);
                } else {
                    // Modo color fijo
                    const alpha = map(i, 0, trail.length - 1, 0, CONFIG.trail.opacity);
                    stroke(CONFIG.trail.color[0], CONFIG.trail.color[1], CONFIG.trail.color[2], alpha);
                }
                
                // Dibujar la línea entre los puntos
                line(p1.x, p1.y, p2.x, p2.y);
            }
        }
    }
}

class TrailPoint {
    constructor(x, y, id, baseColor) {
        this.pos = createVector(x, y);
        this.id = id;
        this.age = 0;
        this.maxAge = 60; // Duración del rastro
        
        // Usar el color base o generar uno aleatorio brillante
        if (baseColor) {
            this.color = color(
                constrain(red(baseColor) + 50, 0, 255),
                constrain(green(baseColor) + 50, 0, 255),
                constrain(blue(baseColor) + 50, 0, 255)
            );
        } else {
            this.color = color(random(150, 255), random(150, 255), random(150, 255));
        }
    }
    
    update() {
        this.age++;
    }
    
    isDead() {
        return this.age >= this.maxAge;
    }
}
