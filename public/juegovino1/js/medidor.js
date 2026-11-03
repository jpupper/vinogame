// Indicador de combo: Medidor con copa vacía y onda violeta
// Indicador de combo: Medidor con copa vacía y onda violeta
class MedidorIndicator {
    // Recursos compartidos para evitar múltiples contextos WEBGL
    static shared = {
        buffer: null,
        shader: null,
        glassImage: null,
        glassMask: null,
        size: { w: 140, h: 140 }
    };

    constructor({ glassImage, glassMask, medidorShader, size, position } = {}) {
        // Assets inyectados o tomados del AssetManager
        const mgr = (typeof window !== 'undefined') ? window.AssetManager : null;
        const imgGlass = glassImage || (mgr ? mgr.getImage('medidorGlass') : null);
        const imgMask = glassMask || (mgr ? mgr.getImage('medidorMask') : null);
        const shaderMedidor = medidorShader || (mgr ? mgr.getShader('medidor') : null);

        // Guardar en recursos compartidos si aún no existen
        if (!MedidorIndicator.shared.glassImage) MedidorIndicator.shared.glassImage = imgGlass;
        if (!MedidorIndicator.shared.glassMask) MedidorIndicator.shared.glassMask = imgMask;
        if (!MedidorIndicator.shared.shader) MedidorIndicator.shared.shader = shaderMedidor;

        // Estado
        this.fillLevel = 0;
        this.targetFillLevel = 0;
        this.comboCount = 0;
        this.comboMax = 1;

        // Tamaño/posición (usar tamaño compartido; ambos medidores usan el mismo)
        this.size = size || { w: MedidorIndicator.shared.size.w, h: MedidorIndicator.shared.size.h };
        this.position = position || { x: width - 180, y: 150 };

        // Crear buffer WEBGL compartido una sola vez para ambos medidores
        if (!MedidorIndicator.shared.buffer) {
            MedidorIndicator.shared.buffer = createGraphics(this.size.w, this.size.h, WEBGL);
            MedidorIndicator.shared.buffer.canvas.getContext('webgl', { willReadFrequently: true });
            MedidorIndicator.shared.size = { w: this.size.w, h: this.size.h };
        }
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
        const shared = MedidorIndicator.shared;
        const buffer = shared.buffer;
        const shader = shared.shader;
        const glass = shared.glassImage;
        const mask = shared.glassMask;

        // Si faltan assets/shader, usar fallback 2D simple
        const canUseShader = !!(buffer && shader && glass && mask);
        if (!canUseShader) {
            const w = this.size.w;
            const h = this.size.h;
            const x = this.position.x;
            const y = this.position.y;
            const fill = constrain(this.fillLevel, 0, 1);
            ctx.push();
            ctx.noStroke();
            ctx.fill(30, 30, 30, 160);
            ctx.rect(x, y, w, h, 12);
            ctx.fill(160, 60, 200, 220);
            ctx.rect(x + 6, y + h * (1 - fill) + 6, w - 12, h * fill - 12, 8);
            ctx.noFill();
            ctx.stroke(200, 200, 255, 120);
            ctx.strokeWeight(2);
            ctx.rect(x, y, w, h, 12);
            ctx.noStroke();
            ctx.fill(255);
            ctx.textAlign(CENTER, TOP);
            ctx.textSize(16);
            ctx.text(`Combo x${this.comboCount}`, x + w/2, y - 24);
            ctx.pop();
            return;
        }

        // Renderizar en buffer compartido con shader
        buffer.clear();
        buffer.shader(shader);

        // Uniforms
        shader.setUniform('u_glassTexture', glass);
        shader.setUniform('u_glassMask', mask);
        shader.setUniform('u_fillLevel', this.fillLevel); // 0..1
        shader.setUniform('u_comboCount', this.comboCount);
        shader.setUniform('u_comboMax', this.comboMax);
        shader.setUniform('u_time', millis() / 1000.0);
        shader.setUniform('u_resolution', [shared.size.w, shared.size.h]);

        // Dibujar quad
        buffer.noStroke();
        buffer.rect(0, 0, shared.size.w, shared.size.h);

        // Pintar en pantalla
        ctx.push();
        ctx.imageMode(CORNER);
        ctx.image(buffer, this.position.x, this.position.y);
        ctx.pop();
    }
}
