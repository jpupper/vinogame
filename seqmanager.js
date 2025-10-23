class SeqManager {
    constructor() {
        console.log('SeqManager v2 - Con método reiniciarTodasLasSecuencias');
        this.seqs = [];
        this.addSeq();
        this.lt = millis();
        this.dur = 10000; // Reducido de 15000 a 10000 para acelerar el spawn de secuencias
        // Eliminamos la puntuación interna ya que ahora usamos el sistema de puntuación
    }

    display() {
        // Ya no necesitamos mostrar la puntuación aquí, lo hace el sistema de puntuación
        for (let i = this.seqs.length - 1; i >= 0; i--) {
            this.seqs[i].display();
        }
    }

    update() {
        for (let i = this.seqs.length - 1; i >= 0; i--) {
            this.seqs[i].update();
            if (this.seqs[i].todosTouch()) {
                // Sumar puntos al completar secuencia usando el sistema de puntuación
                const points = 10; // Cada secuencia completa vale 10 puntos base
                
                // Create explosion effect at the center of the last point
                const lastPoint = this.seqs[i].pnts[this.seqs[i].pnts.length - 1];
                const centerX = lastPoint.pos.x;
                const centerY = lastPoint.pos.y;
                
                // Añadir puntuación con animación en la posición del último punto
                scoreSystem.addScore(points, centerX, centerY);
                
                // Create explosions at each point in the sequence
                for (let j = 0; j < this.seqs[i].pnts.length; j++) {
                    const point = this.seqs[i].pnts[j];
                    particleSystem.createExplosion(point.pos.x, point.pos.y, point.c);
                    
                    // Añadir ondas en el fondo para cada punto
                    dynamicBackground.addRipple(point.pos.x, point.pos.y);
                }
                
                this.seqs.splice(i, 1);
            }
        }
        if (millis() - this.lt > this.dur) {
            this.lt = millis();
            this.addSeq();
        }
    }

    addSeq() {
        this.seqs.push(new Seq());
    }
    
    // Método para reiniciar todas las secuencias activas cuando se golpea un obstáculo
    reiniciarTodasLasSecuencias() {
        console.log('Reiniciando todas las secuencias: ' + this.seqs.length);
        for (let i = 0; i < this.seqs.length; i++) {
            if (this.seqs[i] && typeof this.seqs[i].reiniciarActivos === 'function') {
                this.seqs[i].reiniciarActivos();
            } else {
                console.error('Error: No se puede reiniciar la secuencia ' + i);
            }
        }
    }
}

class Seq {
    constructor() {
        this.pnts = [];
        this.idxactive = 0; //hasta que punto esta activo
        const cnt = 5;
        const cf = color(random(100, 255), random(100, 255), random(100, 255));
        this.pointeridx = -1; //OSEA CUAL ES EL POINTER AL QUE ESTA RELACIONADO.
        this.animOffset = 0; // Para las animaciones
        this.animOffset = 0; // Para las animaciones
        for (let i = 0; i < cnt; i++) {
            this.pnts.push(new Pnt(
                random(width * 1/8, width * 7/8),
                random(height * 1/8, height * 7/8),
                i,
                cf
            ));
        }
    }

    display() {
        this.animOffset = (this.animOffset + 0.2) % 60; // Velocidad de animación más lenta
        
        // Dibujar líneas entre puntos con diferentes estilos
        for (let i = this.pnts.length - 1; i >= 0; i--) {
            if (i < this.pnts.length - 1) {
                const x1 = this.pnts[i].pos.x;
                const y1 = this.pnts[i].pos.y;
                const x2 = this.pnts[i + 1].pos.x;
                const y2 = this.pnts[i + 1].pos.y;
                
                if (i < this.idxactive - 1) {
                    // Línea completada - animación pulsante
                    const pulseIntensity = map(sin(frameCount * 0.1), -1, 1, 100, 255);
                    stroke(0, pulseIntensity, 0, 200);
                    strokeWeight(8);
                    line(x1, y1, x2, y2);
                } else if (i === this.idxactive - 1) {
                    // Línea actual - animación direccional
                    stroke(255, 255, 0);
                    strokeWeight(8);
                    this.drawAnimatedLine(x1, y1, x2, y2);
                } else {
                    // Línea futura - interlineada
                    this.drawDashedLine(x1, y1, x2, y2);
                }
            }
        }

        // Actualizar estados y dibujar puntos
        for (let i = 0; i < this.pnts.length; i++) {
            const p = this.pnts[i];
            if (i < this.idxactive) {
                p.setState('active');
            } else if (i === this.idxactive) {
                p.setState('selectable');
            } else {
                p.setState('inactive');
            }
            p.display();
        }

        // Dibujar puntos del servidor
        const allPlayerPoints = Pserver.getAllPoints();
        for(let k = 0; k < allPlayerPoints.length; k++) {
            const pp = allPlayerPoints[k];
            fill(255, 0, 0, 150);
            ellipse(pp.x, pp.y, 40, 40);
        }
    }

    drawAnimatedLine(x1, y1, x2, y2) {
        // Dibujar línea base más tenue
        stroke(255, 255, 0, 30);
        strokeWeight(6);
        line(x1, y1, x2, y2);
        
        // Dibujar puntos animados que se mueven
        const steps = 20 // Menos puntos para que se vea más claro
        stroke(255, 255, 0);
        for (let i = 0; i < steps; i++) {
            const pos = (this.animOffset + i * (60/steps)) % 60;
            const t = pos / 60;
            const px = lerp(x1, x2, t);
            const py = lerp(y1, y2, t);
            strokeWeight(15);
            point(px, py);
        }
    }
    
    drawDashedLine(x1, y1, x2, y2) {
        const segments = 12;
        const dx = (x2 - x1) / segments;
        const dy = (y2 - y1) / segments;
        
        stroke(100, 100, 100, 80);
        strokeWeight(3);
        
        for (let i = 0; i < segments; i += 2) {
            const startX = x1 + dx * i;
            const startY = y1 + dy * i;
            const endX = x1 + dx * (i + 1);
            const endY = y1 + dy * (i + 1);
            line(startX, startY, endX, endY);
        }
    }

    update() {
        for (let i = this.pnts.length - 1; i >= 0; i--) {
            this.pnts[i].update();
        }
        
        //CHECKEO SI EL PÜNTERO TIENE UN ID QUE ESTE ASIGNADO A LA SEQUENCIA Y SI EL ID DEJO DE EXISTIR REINICIE LA SECUENCIA : 
        //console.log("pointeridx: ",this.pointeridx);
        if(this.pointeridx != -1){
            let found = false;
            for(let i = 0; i < Pserver.getAllPoints().length; i++) {
                const pp = Pserver.getAllPoints()[i];
                if(pp.id == this.pointeridx){
                    found = true;
                    break;
                }
            }
            if(!found){
                this.reiniciarActivos();
            }
        }

        /*if(Pserver.getAllPoints().length == 0){
            this.reiniciarActivos();
        }*/
        //Comparo las posiciones. 
        for(let i = 0; i < this.pnts.length; i++) {
            const p = this.pnts[i];
            const Pserverpoints = Pserver.getAllPoints();
            
            // Check for hover effects - add minimal particles when hovering
            if (i === this.idxactive) { // Only for the currently active point
                for(let k = 0; k < Pserverpoints.length; k++) {
                    const pp = Pserverpoints[k];
                    const distance = dist(p.pos.x, p.pos.y, pp.x, pp.y);
                    
                    // If close but not touching yet, create hover particles
                    if (distance < 80 && distance > 40) {
                        // Create hover particles with a moderate frequency
                        if (frameCount % 3 === 0) { // Reducido de 5 a 3 frames para generar más partículas
                            particleSystem.createHoverEffect(p.pos.x, p.pos.y, p.c);
                            
                            // Añadir ondas sutiles en el fondo
                            if (frameCount % 15 === 0) {
                                dynamicBackground.addRipple(p.pos.x, p.pos.y);
                            }
                        }
                    }
                }
            }
            
            // Check for activation
            for(let k = 0; k < Pserverpoints.length; k++) {
                const pp = Pserverpoints[k];
                if (dist(p.pos.x, p.pos.y, pp.x, pp.y) < 40 
                     && this.idxactive == i
                     && (this.pointeridx == pp.id || this.pointeridx == -1)
                    ) {

                    if(this.pointeridx == -1){
                        this.pointeridx = pp.id;
                    }
                    p.active = true;
                    this.idxactive++;
                    
                    // Create a larger burst of particles when a point is activated
                    for (let burst = 0; burst < 5; burst++) {
                        particleSystem.createHoverEffect(p.pos.x, p.pos.y, p.c);
                    }
                    break;
                }
            }
        }
    }
    reiniciarActivos(){
        this.idxactive = 0;
        this.pointeridx = -1;
        for(let i = 0; i < this.pnts.length; i++) {
            this.pnts[i].active = false;
        }
        // Restar punto cuando se reinicia una secuencia
        if (scoreSystem) scoreSystem.addScore(-5, width/2, height/2); // Penalización por reiniciar
    }
    
    todosTouch() {
        return this.pnts.every(p => p.active);
    }
}

class Pnt {
    constructor(_x, _y, _idx, _c) {
        this.pos = createVector(_x, _y);
        
        if(width < height){
            this.r = height*0.08;
        }else{
            this.r = width*0.05;
        }
        this.idx = _idx;
        this.c = _c;
        this.active = false;
        this.state = 'inactive'; // 'active', 'selectable', 'inactive'
    }
    
    display() {
        this.drawPoint();
        this.drawNumber();
    }

    drawPoint() {
        switch(this.state) {
            case 'active':
                // Punto seleccionado - Verde brillante con efectos avanzados
                // Aura exterior pulsante
                const pulseActive = map(sin(frameCount * 0.1), -1, 1, 0.9, 1.6);
                const glowIntensity = map(sin(frameCount * 0.05), -1, 1, 30, 80);
                
                // Capa de brillo exterior
                for (let i = 5; i > 0; i--) {
                    noStroke();
                    fill(0, 255, 0, glowIntensity / (i * 2));
                    ellipse(this.pos.x, this.pos.y, this.r * (1.5 + i*0.15) * pulseActive, this.r * (1.5 + i*0.15) * pulseActive);
                }
                
                // Anillo principal
                stroke(0, 255, 100);
                strokeWeight(3);
                fill(0, 200, 0, 220);
                ellipse(this.pos.x, this.pos.y, this.r * 1.2, this.r * 1.2);
                
                // Centro brillante
                noStroke();
                fill(100, 255, 100);
                ellipse(this.pos.x, this.pos.y, this.r * 0.8, this.r * 0.8);
                
                // Destello central
                fill(255, 255, 255, 150 + 100 * sin(frameCount * 0.2));
                ellipse(this.pos.x, this.pos.y, this.r * 0.3, this.r * 0.3);
                break;

            case 'selectable':
                // Punto seleccionable - Amarillo con efectos pulsantes
                const pulseSelectable = map(sin(frameCount * 0.15), -1, 1, 1, 1.4);
                
                // Aura exterior
                for (let i = 4; i > 0; i--) {
                    noStroke();
                    fill(255, 255, 0, 15);
                    ellipse(this.pos.x, this.pos.y, this.r * (1.4 + i*0.1) * pulseSelectable, this.r * (1.4 + i*0.1) * pulseSelectable);
                }
                
                // Anillo de atención pulsante
                strokeWeight(3 + sin(frameCount * 0.2));
                stroke(255, 255, 0, 150 + 100 * sin(frameCount * 0.1));
                fill(200, 200, 0, 180);
                ellipse(this.pos.x, this.pos.y, this.r * pulseSelectable, this.r * pulseSelectable);
                
                // Centro brillante
                noStroke();
                fill(255, 255, 0);
                ellipse(this.pos.x, this.pos.y, this.r * 0.6, this.r * 0.6);
                
                // Destello de atención - usando un círculo brillante en lugar de estrella
                if (frameCount % 90 < 10) {
                    fill(255, 255, 255, 200);
                    const pulseSize = this.r * 0.4 * (1 + 0.2 * sin(frameCount * 0.5));
                    ellipse(this.pos.x, this.pos.y, pulseSize, pulseSize);
                }
                break;

            default:
                // Punto inactivo - Con efecto sutil
                const pulseInactive = map(sin(frameCount * 0.05), -1, 1, 0.95, 1.05);
                
                // Sombra
                noStroke();
                fill(50, 50, 50, 100);
                ellipse(this.pos.x + 2, this.pos.y + 2, this.r, this.r);
                
                // Círculo principal
                stroke(150, 150, 150);
                strokeWeight(1);
                fill(100, 100, 100);
                ellipse(this.pos.x, this.pos.y, this.r * pulseInactive, this.r * pulseInactive);
                
                // Reflejo sutil
                noStroke();
                fill(150, 150, 150, 100);
                arc(this.pos.x, this.pos.y, this.r * 0.8, this.r * 0.8, PI, TWO_PI);
        }
    }
    
    // Ya no necesitamos la función star

    drawNumber() {
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(40);
        text(this.idx.toString(), this.pos.x, this.pos.y + 5);
    }

    setState(state) {
        this.state = state;
        this.active = state === 'active';
    }
    
    update() {
        
    }
}
