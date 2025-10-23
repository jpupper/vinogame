precision mediump float;

uniform sampler2D u_barrelTexture;  // Textura del barril
uniform float u_fillLevel;          // Nivel de llenado (0-1)
uniform float u_time;                // Tiempo para animación
uniform vec2 u_resolution;

varying vec2 vTexCoord;

void main() {
    vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
    
    // Samplear textura del barril
    vec4 barrelColor = texture2D(u_barrelTexture, uv);
    
    // Calcular si este píxel está en la zona de llenado
    // El barril se llena de abajo hacia arriba
    float fillHeight = u_fillLevel;
    
    // ANIMACIÓN DE ONDAS QUE SUBEN (siempre visible)
    // Ondas verticales que suben constantemente
    float risingWaves = sin(uv.y * 25.0 - u_time * 2.5) * 0.5 + 0.5;
    risingWaves *= sin(uv.y * 15.0 - u_time * 1.8) * 0.5 + 0.5;
    
    // Ondas horizontales en la superficie
    float wave1 = sin(uv.x * 20.0 + u_time * 2.0) * 0.02;
    float wave2 = sin(uv.x * 15.0 - u_time * 1.5) * 0.015;
    float waveOffset = wave1 + wave2;
    
    // Línea de superficie del líquido
    float liquidSurface = fillHeight + waveOffset;
    
    // Determinar si estamos en la zona del líquido
    float isLiquid = step(uv.y, liquidSurface);
    
    // Color del líquido (vino tinto brillante)
    vec3 liquidColor = vec3(0.6, 0.1, 0.2); // Rojo vino
    
    // Aplicar ondas que suben al color (ANIMACIÓN VISIBLE)
    liquidColor *= (0.7 + risingWaves * 0.3); // Variación de brillo con las ondas
    
    // Agregar brillo al líquido
    float brightness = 1.0 + sin(u_time * 3.0) * 0.1;
    liquidColor *= brightness;
    
    // Agregar reflejos en la superficie
    float surfaceGlow = smoothstep(0.02, 0.0, abs(uv.y - liquidSurface));
    liquidColor += vec3(0.8, 0.3, 0.4) * surfaceGlow * 0.5;
    
    // Burbujas aleatorias
    float bubble1 = sin(uv.x * 50.0 + u_time * 5.0) * sin(uv.y * 30.0 - u_time * 3.0);
    float bubble2 = sin(uv.x * 40.0 - u_time * 4.0) * sin(uv.y * 35.0 + u_time * 2.5);
    float bubbles = smoothstep(0.9, 1.0, (bubble1 + bubble2) * 0.5);
    liquidColor += vec3(0.3, 0.1, 0.15) * bubbles * isLiquid;
    
    // Mezclar barril con líquido
    vec3 finalColor = mix(barrelColor.rgb, liquidColor, isLiquid * 0.7);
    
    // Mantener el alpha del barril
    float finalAlpha = barrelColor.a;
    
    gl_FragColor = vec4(finalColor, finalAlpha);
}
