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
        this.barrelImage = loadImage('img/objetos/barril.png');
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
        
        // Renderizar en el buffer WEBGL con shader
        this.barrelBuffer.clear();
        this.barrelBuffer.shader(this.barrelShader);
        
        // Pasar uniforms
        this.barrelShader.setUniform('u_barrelTexture', this.barrelImage);
        this.barrelShader.setUniform('u_fillLevel', this.fillLevel);
        this.barrelShader.setUniform('u_time', millis() / 1000.0);
        this.barrelShader.setUniform('u_resolution', [this.size.w, this.size.h]);
        
        // Dibujar quad que cubre todo el buffer
        this.barrelBuffer.noStroke();
        this.barrelBuffer.rect(0, 0, this.size.w, this.size.h);
        
        // Dibujar el buffer en pantalla
        ctx.imageMode(CORNER);
        ctx.image(this.barrelBuffer, this.position.x, this.position.y, this.size.w, this.size.h);
    }
}

// Indicador de combo: Medidor con copa vacía y onda violeta
class MedidorIndicator {
    constructor() {
        this.glassImage = null;      // img/medidor/copa-vacia.png
        this.glassMask = null;       // img/medidor/copa-vacia-mask.png
        this.medidorShader = null;   // medidor.vert/medidor.frag
        this.medidorBuffer = null;   // Buffer WEBGL para renderizar el medidor
        this.fillLevel = 0;
        this.targetFillLevel = 0;
        this.position = { x: 0, y: 0 };
        this.size = { w: 140, h: 140 }; // Tamaño del medidor (ajustado a copa)
    }

    loadAssets() {
        this.glassImage = loadImage('img/medidor/copa-vacia.png');
        this.glassMask = loadImage('img/medidor/copa-vacia-mask.png');
        this.medidorShader = loadShader('medidor.vert', 'medidor.frag');
    }

    setup() {
        // Crear buffer WEBGL para el medidor
        this.medidorBuffer = createGraphics(this.size.w, this.size.h, WEBGL);

        // Posicionar a la derecha, debajo del combo
        this.position.x = width - 180;
        this.position.y = 150;
    }

    update(comboLevel) {
        this.targetFillLevel = comboLevel; // comboLevel va de 0 a 1
        this.fillLevel = lerp(this.fillLevel, this.targetFillLevel, 0.12);
    }

    display(ctx = window) {
        if (!this.glassImage || !this.glassMask || !this.medidorShader || !this.medidorBuffer) return;

        // Renderizar en buffer con shader
        this.medidorBuffer.clear();
        this.medidorBuffer.shader(this.medidorShader);

        // Uniforms
        this.medidorShader.setUniform('u_glassTexture', this.glassImage);
        this.medidorShader.setUniform('u_glassMask', this.glassMask);
        this.medidorShader.setUniform('u_fillLevel', this.fillLevel);
        this.medidorShader.setUniform('u_time', millis() / 1000.0);
        this.medidorShader.setUniform('u_resolution', [this.size.w, this.size.h]);

        // Dibujar quad
        this.medidorBuffer.noStroke();
        this.medidorBuffer.rect(0, 0, this.size.w, this.size.h);

        // Pintar en pantalla
        ctx.imageMode(CORNER);
        ctx.image(this.medidorBuffer, this.position.x, this.position.y, this.size.w, this.size.h);
    }
}
