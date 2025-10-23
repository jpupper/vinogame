precision mediump float;

// Uniforms
uniform sampler2D u_backgroundTexture1;    // Textura de fondo 1
uniform sampler2D u_backgroundTexture2;    // Textura de fondo 2
uniform float u_backgroundBlend;           // Blend entre texturas (0-1)
uniform float u_backgroundRotation;        // Rotación de texturas
uniform sampler2D u_feedbackTexture;       // Feedback del otro shader
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_comboLevel;                // Nivel de combo (0-1)

varying vec2 vTexCoord;

void main() {
    // Coordenadas UV
    vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
    
    // ===== DIBUJAR TEXTURAS DE FONDO ROTADAS =====
    vec2 centeredUV = uv - 0.5;
    
    // Aplicar rotación
    float cosR = cos(u_backgroundRotation);
    float sinR = sin(u_backgroundRotation);
    vec2 rotatedUV = vec2(
        centeredUV.x * cosR - centeredUV.y * sinR,
        centeredUV.x * sinR + centeredUV.y * cosR
    );
    
    // Escalar para zoom (1.6x)
    rotatedUV = rotatedUV / 1.6 + 0.5;
    
    // Samplear ambas texturas
    vec4 bgTexture1 = texture2D(u_backgroundTexture1, rotatedUV);
    vec4 bgTexture2 = texture2D(u_backgroundTexture2, rotatedUV);
    
    // Mezclar texturas según blend
    vec4 backgroundColor = mix(bgTexture1, bgTexture2, u_backgroundBlend);
    
    // ===== PATRÓN DE ONDAS SINUSOIDALES =====
    // Normalizar TODAS las ondas de -1,1 a 0,1 inmediatamente
    float wave1 = sin(uv.x * 25.0 + u_time * 0.2) * 0.5 + 0.5;
    float wave2 = sin(uv.y * 20.0 - u_time * 0.8) * 0.5 + 0.5;
    float wave3 = sin((uv.x + uv.y) * 5.0 + u_time * 0.5) * 0.5 + 0.5;
    float wave4 = sin((uv.x - uv.y) * 10.0 - u_time * 0.7) * 0.5 + 0.5;
    
    // Combinar ondas (ahora todas están en rango 0 a 1)
    float wavePattern = (wave1 + wave2 + wave3 + wave4) / 4.0;
    
    // Intensidad EXTREMADAMENTE SUTIL
    float comboBoost = clamp(u_comboLevel, 0.0, 1.0) * 0.03; // Máximo 3% extra
    float waveIntensity = 0.001 + comboBoost; // 1% base + hasta 3% con combo
    
    // Recentrar las ondas alrededor de 0 para que oscilen ±
    float centeredWave = (wavePattern - 0.5) * 2.0; // De 0,1 a -1,1
    
    // SUMAR ondas a la imagen (APENAS PERCEPTIBLE)
    vec3 finalColor = backgroundColor.rgb *.2 + (centeredWave * waveIntensity)*5.2;
    finalColor = backgroundColor.rgb *.02+backgroundColor.rgb*vec3(wavePattern)*.29;
    // ===== APLICAR FEEDBACK COMO EFECTO =====
    vec4 feedbackColor = texture2D(u_feedbackTexture, uv);
    
    // Usar el feedback para distorsionar/iluminar (MUCHO MÁS SUTIL)
    finalColor += feedbackColor.rgb * feedbackColor.a * 0.2; // Reducido de 0.5 a 0.2
    
    // Brillo adicional con combo (MUCHO MÁS SUTIL)
    float safeComboLevel = clamp(u_comboLevel, 0.0, 1.0);
   // finalColor += vec3(safeComboLevel * 0.03); // Reducido de 0.08 a 0.03
    
    // Asegurar que el color final nunca sea negativo
    ///finalColor = max(finalColor, vec3(0.0));
    
    gl_FragColor = vec4(finalColor, 1.0);
}
