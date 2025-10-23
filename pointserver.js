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
	display() {
		// Dibujar partículas de uvas primero (detrás)
		this.displayCursorGrapes();
		
		// Dibujamos todos los puntos (LIDAR + input)
		const allPoints = [...this.points, ...this.inputPoints];

		textAlign(LEFT)
		fill(255);
		textSize(30);
		text(`Puntos: ${allPoints.length}`, 40, 40);
	  
		// Dibujar conexiones entre puntos cercanos
		stroke(
			CONFIG.points.connectionColor[0],
			CONFIG.points.connectionColor[1],
			CONFIG.points.connectionColor[2],
			CONFIG.points.connectionColor[3]
		);
		strokeWeight(CONFIG.points.connectionThickness);
		for (let i = 0; i < allPoints.length; i++) {
			for (let j = i + 1; j < allPoints.length; j++) {
				const d = dist(allPoints[i].x, allPoints[i].y, allPoints[j].x, allPoints[j].y);
				if (d < CONFIG.points.connectionDistance) { // Distancia máxima para conectar
					const alpha = map(d, 0, CONFIG.points.connectionDistance, CONFIG.points.connectionColor[3], 0);
					stroke(
						CONFIG.points.connectionColor[0],
						CONFIG.points.connectionColor[1],
						CONFIG.points.connectionColor[2],
						alpha
					);
					line(allPoints[i].x, allPoints[i].y, allPoints[j].x, allPoints[j].y);
				}
			}
		}
		
		// Dibujar los puntos
		for (let i = 0; i < allPoints.length; i++) {
			fill(
				CONFIG.points.color[0],
				CONFIG.points.color[1],
				CONFIG.points.color[2]
			);
			noStroke();
			ellipse(allPoints[i].x, allPoints[i].y, CONFIG.points.size, CONFIG.points.size);
			fill(255);
			ellipse(allPoints[i].x, allPoints[i].y, 15,15);
			textSize(20);
			fill(255,255,0)
			text(str(allPoints[i].id), allPoints[i].x+30, allPoints[i].y-30)
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
	
	displayCursorGrapes() {
		for (let grape of this.cursorGrapes) {
			push();
			translate(grape.pos.x, grape.pos.y);
			
			// Efecto de brillo pulsante
			const glowIntensity = sin(grape.glowPhase) * 0.3 + 0.7;
			const currentSize = grape.size * glowIntensity;
			
			noStroke();
			
			// Halo
			fill(red(grape.color), green(grape.color), blue(grape.color), grape.alpha * 0.3);
			ellipse(0, 0, currentSize * 2, currentSize * 2);
			
			// Uva principal
			fill(red(grape.color), green(grape.color), blue(grape.color), grape.alpha);
			ellipse(0, 0, currentSize, currentSize * 1.1);
			
			// Brillo
			fill(255, 255, 255, grape.alpha * 0.6);
			ellipse(-currentSize * 0.2, -currentSize * 0.2, currentSize * 0.3, currentSize * 0.3);
			
			pop();
		}
	}

	processJSONtouch(_json){
		// Verificar si el JSON es válido
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

		// Actualizar puntos existentes o crear nuevos
		_json.points.forEach(point => {
			const index = currentPointsMap[point.id];
			
			if (index !== undefined) {
				// Actualizar punto existente
				this.points[index].x = map(point.x,1,0,0,width) ;
				this.points[index].y = map(point.y,1,0,0,height) ;
			} else {
				// Crear nuevo punto
				this.points.push(new LidarPoint(point.x * width, point.y * height, point.id));
			}
		});

		console.log(`Procesados ${_json.total_points} puntos. Puntos actuales: ${this.points.length}`);
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