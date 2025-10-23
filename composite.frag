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

// ONDAS EXPANSIVAS (para distorsión)
uniform vec2 u_wavePositions[5];
uniform float u_waveTimes[5];
uniform float u_waveActive[5];

varying vec2 vTexCoord;

void main() {
    // Coordenadas UV
    vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
    
    // ===== CALCULAR DISTORSIÓN DE UVs =====
    vec2 displacement = vec2(0.0);
    
    // FUERZA DE DISTORSIÓN (ajustable)
    const float WAVE_DISTORTION_STRENGTH = 0.05;  // 5% de distorsión máxima
    const float SINE_DISTORTION_STRENGTH = 0.002; // 0.2% de distorsión sutil
    
    // Corregir aspect ratio para las ondas
    vec2 aspectUV = uv;
    aspectUV.x *= u_resolution.x / u_resolution.y;
    
    // 1. DISTORSIÓN POR ONDAS EXPANSIVAS (más fuerte)
    for (int i = 0; i < 5; i++) {
        if (u_waveActive[i] > 0.5) {
            // Posición de la onda (corregir aspect ratio)
            vec2 wavePos = u_wavePositions[i];
            wavePos.x *= u_resolution.x / u_resolution.y;
            
            // Distancia a la onda
            float waveDist = distance(aspectUV, wavePos);
            
            // Tiempo desde que empezó la onda
            float waveTime = u_time - u_waveTimes[i];
            
            // Radio de la onda (expande con el tiempo)
            float waveRadius = waveTime * 0.5;
            
            // Intensidad de la onda (fade out con el tiempo)
            float waveIntensity = smoothstep(2.0, 0.0, waveTime);
            
            // Distorsión radial desde el centro de la onda (área más amplia)
            float distortionStrength = smoothstep(0.15, 0.0, abs(waveDist - waveRadius)) * waveIntensity;
            
            // Dirección de la distorsión (desde el centro de la onda)
            vec2 direction = normalize(aspectUV - wavePos);
            
            // Aplicar distorsión (empuja hacia afuera) - MÁS FUERTE
            displacement += direction * distortionStrength * WAVE_DISTORTION_STRENGTH;
        }
    }
    
    // Deshacer corrección de aspect ratio
    displacement.x /= u_resolution.x / u_resolution.y;
    
    // 2. DISTORSIÓN POR ONDAS SINUSOIDALES (muy sutil)
    float sineWave1 = sin(uv.x * 25.0 + u_time * 0.2) * SINE_DISTORTION_STRENGTH;
    float sineWave2 = sin(uv.y * 20.0 - u_time * 0.8) * SINE_DISTORTION_STRENGTH;
    displacement += vec2(sineWave2, sineWave1); // Cruzadas para efecto más interesante
    
    // Aplicar distorsión a las UVs
    vec2 distortedUV = uv + displacement;
    
    // ===== DIBUJAR TEXTURAS DE FONDO ROTADAS =====
    vec2 centeredUV = distortedUV - 0.5;
    
    // Aplicar rotación
    float cosR = cos(u_backgroundRotation);
    float sinR = sin(u_backgroundRotation);
    vec2 rotatedUV = vec2(
        centeredUV.x * cosR - centeredUV.y * sinR,
        centeredUV.x * sinR + centeredUV.y * cosR
    );
    
    // Escalar para zoom (1.6x)
    rotatedUV = rotatedUV / 1.6 + 0.5;
    
    // Samplear ambas texturas CON UVs DISTORSIONADAS
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
