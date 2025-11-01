class PointServer {
	constructor() {
		this.points = [];
		this.inputPoints = []; 
		this.maxPoints = CONFIG.points.maxPoints;
		
		// Partículas pequeñas tipo uvas desde el cursor
		this.cursorGrapes = [];
		
		// Inicializar con algunos puntos de ejemplo
		//this.points.push(new LidarPoint(width/2, height*1/4, 0));
		//this.points.push(new LidarPoint(width/2, height/2, 1));
		//this.points.push(new LidarPoint(width/2, height*3/4, 2));
	}
	display(ctx = window) {
		// Dibujar partículas de uvas primero (detrás)
		this.displayCursorGrapes(ctx);
		
		// Dibujamos todos los puntos (LIDAR + input)
		const allPoints = [...this.points, ...this.inputPoints];

		ctx.textAlign(LEFT);
		ctx.fill(255);
		ctx.textSize(30);
		ctx.text(`Puntos: ${allPoints.length}`, 40, 40);
	  
		// Dibujar conexiones entre puntos cercanos
		ctx.noStroke();
		/*for (let i = 0; i < allPoints.length; i++) {
			for (let j = i + 1; j < allPoints.length; j++) {
				const d = dist(allPoints[i].x, allPoints[i].y, allPoints[j].x, allPoints[j].y);
				if (d < CONFIG.points.connectionDistance) {
					const alpha = map(d, 0, CONFIG.points.connectionDistance, CONFIG.points.connectionColor[3], 0);
					const x1 = allPoints[i].x;
					const y1 = allPoints[i].y;
					const x2 = allPoints[j].x;
					const y2 = allPoints[j].y;
					const angle = atan2(y2 - y1, x2 - x1);
					const midX = (x1 + x2) / 2;
					const midY = (y1 + y2) / 2;
					const thickness = CONFIG.points.connectionThickness;
					ctx.push();
					ctx.translate(midX, midY);
					ctx.rotate(angle);
					ctx.fill(
						CONFIG.points.connectionColor[0],
						CONFIG.points.connectionColor[1],
						CONFIG.points.connectionColor[2],
						alpha
					);
					ctx.rectMode(CENTER);
					ctx.rect(0, 0, d, thickness);
					ctx.pop();
				}
			}
		}*/
		
		// Dibujar los puntos
		for (let i = 0; i < allPoints.length; i++) {
			ctx.fill(
				CONFIG.points.color[0],
				CONFIG.points.color[1],
				CONFIG.points.color[2]
			);
			ctx.noStroke();
			ctx.ellipse(allPoints[i].x, allPoints[i].y, CONFIG.points.size, CONFIG.points.size);
			ctx.fill(255);
			ctx.ellipse(allPoints[i].x, allPoints[i].y, 15,15);
			ctx.textSize(20);
			ctx.fill(255,255,0);
			ctx.text(str(allPoints[i].id), allPoints[i].x+30, allPoints[i].y-30);
		}
	}
	getAllPoints(){
		return [...this.points, ...this.inputPoints];
	}
	update() {
		this.inputPoints = []; // Reset input points

		// Mouse tracking
		if (mouseIsPressed) {
			this.inputPoints.push(new LidarPoint(mouseX, mouseY, 0));
			// Crear partículas de uvas pequeñas
			if (frameCount % 3 === 0) {
				this.createCursorGrape(mouseX, mouseY);
			}
		}

		// Touch tracking
		for (let i = 0; i < touches.length; i++) {
			this.inputPoints.push(new LidarPoint(touches[i].x, touches[i].y,i));
			// Crear partículas de uvas pequeñas
			if (frameCount % 3 === 0) {
				this.createCursorGrape(touches[i].x, touches[i].y);
			}
		}
		
		// Actualizar partículas de uvas
		this.updateCursorGrapes();
	}
	
	createCursorGrape(x, y) {
		const angle = random(TWO_PI);
		const distance = random(5, 15);
		this.cursorGrapes.push({
			pos: createVector(x + cos(angle) * distance, y + sin(angle) * distance),
			vel: createVector(random(-0.5, 0.5), random(-1, -0.3)),
			size: random(3, 8),
			alpha: 255,
			color: color(random(100, 255), random(50, 200), random(100, 255)),
			glowPhase: random(TWO_PI)
		});
	}
	
	updateCursorGrapes() {
		for (let i = this.cursorGrapes.length - 1; i >= 0; i--) {
			const grape = this.cursorGrapes[i];
			
			// Movimiento flotante
			grape.pos.add(grape.vel);
			grape.vel.y -= 0.02; // Flotar hacia arriba
			
			// Desvanecer
			grape.alpha -= 3;
			grape.size *= 0.99;
			
			// Actualizar fase de brillo
			grape.glowPhase += 0.1;
			
			// Eliminar si está muerta
			if (grape.alpha <= 0 || grape.size < 1) {
				this.cursorGrapes.splice(i, 1);
			}
		}
		
		// Limitar cantidad
		if (this.cursorGrapes.length > 150) {
			this.cursorGrapes.splice(0, this.cursorGrapes.length - 150);
		}
	}
	
	displayCursorGrapes(ctx = window) {
		for (let grape of this.cursorGrapes) {
			ctx.push();
			ctx.translate(grape.pos.x, grape.pos.y);
			
			// Efecto de brillo pulsante
			const glowIntensity = sin(grape.glowPhase) * 0.3 + 0.7;
			const currentSize = grape.size * glowIntensity;
			
			ctx.noStroke();
			
			// Halo
			ctx.fill(red(grape.color), green(grape.color), blue(grape.color), grape.alpha * 0.3);
			ctx.ellipse(0, 0, currentSize * 2, currentSize * 2);
			
			// Uva principal
			ctx.fill(red(grape.color), green(grape.color), blue(grape.color), grape.alpha);
			ctx.ellipse(0, 0, currentSize, currentSize * 1.1);
			
			// Brillo
			ctx.fill(255, 255, 255, grape.alpha * 0.6);
			ctx.ellipse(-currentSize * 0.2, -currentSize * 0.2, currentSize * 0.3, currentSize * 0.3);
			
			ctx.pop();
		}
	}

    processJSONtouch(_json){
        // Permitir recibir string JSON o objeto
        try {
            if (typeof _json === 'string') {
                _json = JSON.parse(_json);
            }
        } catch (e) {
            console.error('JSON de TouchDesigner inválido (parse falló):', e);
            return;
        }

        // Verificar estructura esperada
        if (!_json || !_json.points || !Array.isArray(_json.points)) {
            console.error('JSON inválido o no contiene puntos');
            return;
        }

        // Crear un mapa de los puntos actuales por ID para búsqueda rápida
        const currentPointsMap = {};
        for (let i = 0; i < this.points.length; i++) {
            currentPointsMap[this.points[i].id] = i;
        }

        // Crear un conjunto de IDs del nuevo JSON para verificar qué puntos eliminar
        const newPointIds = new Set();
        _json.points.forEach(point => {
            newPointIds.add(point.id);
        });

        // Eliminar puntos que ya no existen en el nuevo JSON
        for (let i = this.points.length - 1; i >= 0; i--) {
            if (!newPointIds.has(this.points[i].id)) {
                this.points.splice(i, 1);
            }
        }

        // Actualizar puntos existentes o crear nuevos (mapeo consistente 0..1 -> pantalla)
        _json.points.forEach(point => {
            const index = currentPointsMap[point.id];
            const nx = map(point.x, 1, 0, 0, width);
            const ny = map(point.y, 1, 0, 0, height);
            
            if (index !== undefined) {
                // Actualizar punto existente
                this.points[index].x = nx;
                this.points[index].y = ny;
            } else {
                // Crear nuevo punto
                this.points.push(new LidarPoint(nx, ny, point.id));
            }
        });

        // Log removido para evitar penalización de rendimiento
    }

}

class LidarPoint{
	constructor(_x,_y,_id){
		this.x = _x;
		this.y = _y;
		this.id = _id;
	}
	
	set(newX, newY) {
		this.x = newX;
		this.y = newY;
	}
}

// Exponer alias global para integración externa (TouchDesigner)
// Permite llamar LM.processJSONtouch(json) incluso antes de que Pserver exista;
// en ese caso se encola y se procesa al inicializar Pserver en sketch.js
if (typeof window !== 'undefined') {
  // Crear/actualizar objeto LM global con throttling por frame
  window.LM = window.LM || {};
  window.LM._queue = window.LM._queue || [];
  window.LM._pending = null;
  window.LM._scheduled = false;

  window.LM._scheduleProcess = function() {
    if (this._scheduled) return;
    this._scheduled = true;
    const run = () => {
      try {
        const data = this._pending;
        this._pending = null;
        this._scheduled = false;
        if (!data) return;
        if (window.Pserver && typeof window.Pserver.processJSONtouch === 'function') {
          window.Pserver.processJSONtouch(data);
        } else {
          this._queue.push(data);
        }
      } catch (e) {
        console.error('Error en LM._scheduleProcess:', e);
      }
    };
    // Preferir requestAnimationFrame; si no existe, usar setTimeout ~16ms
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(run);
    } else {
      setTimeout(run, 16);
    }
  };

  window.LM.processJSONtouch = function(json) {
    try {
      if (typeof json === 'string') json = JSON.parse(json);
    } catch (e) {
      console.error('Error parseando JSON en LM.processJSONtouch:', e);
      return;
    }
    this._pending = json; // guardar el último paquete recibido
    this._scheduleProcess(); // procesar como máximo una vez por frame
  };
}