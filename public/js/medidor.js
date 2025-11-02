// Indicador de combo: Medidor con copa vacía y onda violeta
class MedidorIndicator {
    constructor({ glassImage, glassMask, medidorShader, size, position } = {}) {
        // Assets inyectados o tomados del AssetManager
        const mgr = (typeof window !== 'undefined') ? window.AssetManager : null;
        this.glassImage = glassImage || (mgr ? mgr.getImage('medidorGlass') : null);
        this.glassMask = glassMask || (mgr ? mgr.getImage('medidorMask') : null);
        this.medidorShader = medidorShader || (mgr ? mgr.getShader('medidor') : null);

        // Estado
        this.fillLevel = 0;
        this.targetFillLevel = 0;
        this.comboCount = 0;
        this.comboMax = 1;

        // Tamaño/posición
        this.size = size || { w: 140, h: 140 };
        this.position = position || { x: width - 180, y: 150 };

        // Buffer WEBGL para renderizar el medidor
        this.medidorBuffer = createGraphics(this.size.w, this.size.h, WEBGL);
        this.medidorBuffer.canvas.getContext('webgl', { willReadFrequently: true });
    }

    update(comboCount, comboMax) {
        // Guardar valores crudos
        this.comboCount = Math.max(0, comboCount || 0);
        this.comboMax = Math.max(1, comboMax || 1);
        
        // Mapear a 0..1 para shader
        this.targetFillLevel = constrain(this.comboCount / this.comboMax, 0, 1);
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
        this.medidorShader.setUniform('u_fillLevel', this.fillLevel); // normalizado 0..1
        this.medidorShader.setUniform('u_comboCount', this.comboCount); // crudo 0..N
        this.medidorShader.setUniform('u_comboMax', this.comboMax);     // máximo N
        this.medidorShader.setUniform('u_time', millis() / 1000.0);
        this.medidorShader.setUniform('u_resolution', [this.size.w, this.size.h]);

        // Dibujar quad
        this.medidorBuffer.noStroke();
        this.medidorBuffer.rect(0, 0, this.size.w, this.size.h);

        // Pintar en pantalla sin redimensionamiento (el buffer ya tiene el tamaño correcto)
        ctx.imageMode(CORNER);
        ctx.image(this.medidorBuffer, this.position.x, this.position.y);
    }
}
