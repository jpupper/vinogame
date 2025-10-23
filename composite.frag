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
    float chromaticAberration = 0.0; // Para separación RGB
    
    // FUERZA DE DISTORSIÓN (ajustable)
    const float WAVE_DISTORTION_STRENGTH = 0.05;  // 5% de distorsión máxima
    const float SINE_DISTORTION_STRENGTH = 0.002; // 0.2% de distorsión sutil
    const float CHROMATIC_STRENGTH = 0.008;       // Separación RGB
    
    // Corregir aspect ratio para las ondas
    vec2 aspectUV = uv;
    aspectUV.x *= u_resolution.x / u_resolution.y;
    
    // 1. DISTORSIÓN POR ONDAS EXPANSIVAS (más fuerte + chromatic aberration)
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
            
            // CHROMATIC ABERRATION: Acumular separación RGB
            chromaticAberration += distortionStrength * waveIntensity;
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
    
    // ===== CHROMATIC ABERRATION: Samplear RGB por separado =====
    vec4 bgTexture1, bgTexture2;
    
    if (chromaticAberration > 0.01) {
        // Separar canales RGB con chromatic aberration
        float aberration = chromaticAberration * CHROMATIC_STRENGTH;
        
        // Textura 1
        float r1 = texture2D(u_backgroundTexture1, rotatedUV + vec2(aberration, 0.0)).r;
        float g1 = texture2D(u_backgroundTexture1, rotatedUV).g;
        float b1 = texture2D(u_backgroundTexture1, rotatedUV - vec2(aberration, 0.0)).b;
        bgTexture1 = vec4(r1, g1, b1, 1.0);
        
        // Textura 2
        float r2 = texture2D(u_backgroundTexture2, rotatedUV + vec2(aberration, 0.0)).r;
        float g2 = texture2D(u_backgroundTexture2, rotatedUV).g;
        float b2 = texture2D(u_backgroundTexture2, rotatedUV - vec2(aberration, 0.0)).b;
        bgTexture2 = vec4(r2, g2, b2, 1.0);
    } else {
        // Sin chromatic aberration
        bgTexture1 = texture2D(u_backgroundTexture1, rotatedUV);
        bgTexture2 = texture2D(u_backgroundTexture2, rotatedUV);
    }
    
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
    vec3 finalColor = backgroundColor.rgb * 0.02 + backgroundColor.rgb * vec3(wavePattern) * 0.29;
    
    // ===== COLOR GRADING DINÁMICO (basado en combo) =====
    float safeComboLevel = clamp(u_comboLevel, 0.0, 1.0);
    
    if (safeComboLevel > 0.05) {
        // Combo bajo (0.05 - 0.4): Tinte morado/magenta
        vec3 lowComboTint = vec3(1.1, 0.9, 1.2); // Morado sutil
        
        // Combo medio (0.4 - 0.7): Tinte naranja
        vec3 midComboTint = vec3(1.2, 1.0, 0.8); // Naranja
        
        // Combo alto (0.7 - 1.0): Tinte dorado
        vec3 highComboTint = vec3(1.3, 1.1, 0.7); // Dorado
        
        // Interpolar entre tintes según el nivel de combo
        vec3 colorTint;
        if (safeComboLevel < 0.4) {
            // Bajo a medio
            float t = (safeComboLevel - 0.05) / 0.35;
            colorTint = mix(vec3(1.0), lowComboTint, t);
        } else if (safeComboLevel < 0.7) {
            // Medio a alto
            float t = (safeComboLevel - 0.4) / 0.3;
            colorTint = mix(lowComboTint, midComboTint, t);
        } else {
            // Alto a máximo
            float t = (safeComboLevel - 0.7) / 0.3;
            colorTint = mix(midComboTint, highComboTint, t);
        }
        
        // Aplicar color grading
        finalColor *= colorTint;
        
        // Aumentar saturación con combo alto
        if (safeComboLevel > 0.5) {
            float saturationBoost = (safeComboLevel - 0.5) * 0.6; // Hasta 30% más saturación
            float luminance = dot(finalColor, vec3(0.299, 0.587, 0.114));
            finalColor = mix(vec3(luminance), finalColor, 1.0 + saturationBoost);
        }
    }
    
    // ===== APLICAR FEEDBACK COMO EFECTO =====
    vec4 feedbackColor = texture2D(u_feedbackTexture, uv);
    finalColor += feedbackColor.rgb * feedbackColor.a * 0.2;
    
    // Brillo adicional con combo
    finalColor += vec3(safeComboLevel * 0.03);
    
    // Asegurar que el color final nunca sea negativo
    finalColor = max(finalColor, vec3(0.0));
    
    gl_FragColor = vec4(finalColor, 1.0);
}
