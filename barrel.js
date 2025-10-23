// Sistema de barril como indicador de combo
class BarrelIndicator {
    constructor() {
        this.barrelImage = null;
        this.barrelShader = null;
        this.barrelBuffer = null;
        this.fillLevel = 0;
        this.targetFillLevel = 0;
        // Posición dinámica - se calculará en setup
        this.position = { x: 0, y: 0 };
        this.size = { w: 120, h: 100 }; // Tamaño del barril
    }
    
    loadAssets() {
        this.barrelImage = loadImage('img/barril.png');
        this.barrelShader = loadShader('barrel.vert', 'barrel.frag');
    }
    
    setup() {
        // Crear buffer para el barril
        this.barrelBuffer = createGraphics(this.size.w, this.size.h, WEBGL);
        
        // Calcular posición a la derecha, debajo del combo
        // El combo está en la esquina superior derecha
        this.position.x = width - 180; // A la derecha
        this.position.y = 150; // Debajo del texto de combo
    }
    
    update(comboLevel) {
        // comboLevel va de 0 a 1 (basado en combo / 20)
        this.targetFillLevel = comboLevel;
        
        // Smooth lerp hacia el target
        this.fillLevel = lerp(this.fillLevel, this.targetFillLevel, 0.1);
    }
    
    display(ctx = window) {
        if (!this.barrelImage || !this.barrelShader || !this.barrelBuffer) return;
        
        // Renderizar barril con shader
        this.barrelBuffer.shader(this.barrelShader);
        this.barrelShader.setUniform('u_barrelTexture', this.barrelImage);
        this.barrelShader.setUniform('u_fillLevel', this.fillLevel);
        this.barrelShader.setUniform('u_time', millis() / 1000.0);
        this.barrelShader.setUniform('u_resolution', [this.size.w, this.size.h]);
        
        this.barrelBuffer.rect(0, 0, this.size.w, this.size.h);
        
        // Dibujar el buffer en pantalla
        ctx.push();
        ctx.imageMode(CORNER);
        ctx.image(this.barrelBuffer, this.position.x, this.position.y, this.size.w, this.size.h);
        
        // Texto de combo encima del barril
        if (scoreSystem && scoreSystem.currentCombo > 0) {
            ctx.fill(255, 220, 100);
            ctx.stroke(100, 50, 0);
            ctx.strokeWeight(3);
            ctx.textAlign(CENTER, CENTER);
            ctx.textSize(24);
            ctx.textFont('Arial Black');
            ctx.text(`x${scoreSystem.currentCombo}`, 
                     this.position.x + this.size.w / 2, 
                     this.position.y - 20);
        }
        
        ctx.pop();
    }
}
