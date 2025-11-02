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

// Onda de evento (GANASTE/PERDISTE)
uniform float u_eventActive;
uniform vec2  u_eventCenter;
uniform float u_eventStartTime;
uniform vec3  u_eventColor;
uniform float u_eventStrength;

// UVAS (para distorsión gravitacional)
uniform vec2 u_grapePositions[10];      // Posiciones de hasta 10 uvas
uniform float u_grapeProgress[10];      // Progreso de captura (0-1)
uniform float u_grapeActive[10];        // Si la uva está activa

// ITEMS MALOS (para halos rojos)
uniform vec2 u_badPositions[10];
uniform float u_badActive[10];

// HALOS CONFIGURABLES
uniform float u_goodHaloSize;           // tamaño del halo de buenos (radio externo)
uniform float u_goodHaloStrength;       // fuerza del halo de buenos
uniform vec3  u_goodHaloColor;          // color del halo de buenos
uniform float u_badHaloSize;            // tamaño del halo de malos (radio externo)
uniform float u_badHaloStrength;        // fuerza del halo de malos
uniform vec3  u_badHaloColor;           // color del halo de malos

// LÍNEA DIVISORIA (modo competitivo)
uniform float u_splitLineEnabled;       // 1.0 para mostrar la línea, 0.0 para ocultar
uniform vec3  u_splitLineColor;         // color RGB de la línea
uniform float u_splitLineThickness;     // grosor en UV (0-1)
uniform float u_splitLineSoftness;      // suavizado de borde (0-1)

varying vec2 vTexCoord;

void main() {
    // Coordenadas UV
    vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
    
    // ===== CALCULAR DISTORSIÓN DE UVs =====
    vec2 displacement = vec2(0.0);
    float chromaticAberration = 0.0; // Para separación RGB
    
    // FUERZA DE DISTORSIÓN (ajustable)
    const float WAVE_DISTORTION_STRENGTH = 0.09;  // 9% de distorsión máxima (más fuerte)
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

    // Distorsión por ONDA DE EVENTO (anillo central fuerte)
    if (u_eventActive > 0.5) {
        vec2 eCenter = u_eventCenter;
        eCenter.x *= u_resolution.x / u_resolution.y;
        float eTime = u_time - u_eventStartTime;
        float eRadius = eTime * 0.7;
        float eDist = distance(aspectUV, eCenter);
        float eIntensity = smoothstep(3.0, 0.0, eTime);
        float eMask = smoothstep(0.08, 0.0, abs(eDist - eRadius));
        vec2 dir = normalize(aspectUV - eCenter);
        displacement += dir * eMask * eIntensity * (WAVE_DISTORTION_STRENGTH * 1.6 * u_eventStrength);
        chromaticAberration += eMask * eIntensity * 1.2 * u_eventStrength;
    }
    
    // Deshacer corrección de aspect ratio
    displacement.x /= u_resolution.x / u_resolution.y;
    
    // 2. DISTORSIÓN GRAVITACIONAL POR UVAS
    const float GRAVITY_STRENGTH = 0.008; // Fuerza de la distorsión gravitacional (más sutil)
    
    for (int i = 0; i < 10; i++) {
        if (u_grapeActive[i] > 0.5) {
            // Posición de la uva (corregir aspect ratio)
            vec2 grapePos = u_grapePositions[i];
            grapePos.x *= u_resolution.x / u_resolution.y;
            
            // Distancia a la uva
            float grapeDist = distance(aspectUV, grapePos);
            
            // Radio de influencia (más grande si está siendo capturada)
            float influenceRadius = 0.15 + u_grapeProgress[i] * 0.1;
            
            // Fuerza gravitacional (inversa al cuadrado de la distancia)
            float gravityForce = 1.0 / (1.0 + grapeDist * grapeDist * 20.0);
            gravityForce *= smoothstep(influenceRadius, 0.0, grapeDist);
            
            // Aumentar fuerza con el progreso de captura
            gravityForce *= (1.0 + u_grapeProgress[i] * 2.0);
            
            // Dirección hacia la uva
            vec2 direction = normalize(grapePos - aspectUV);
            
            // Aplicar distorsión gravitacional (atrae hacia la uva)
            displacement += direction * gravityForce * GRAVITY_STRENGTH;
            
            // Chromatic aberration en la zona de influencia
            chromaticAberration += gravityForce * u_grapeProgress[i];
        }
    }
    
    // Deshacer corrección de aspect ratio para distorsión de uvas
    displacement.x /= u_resolution.x / u_resolution.y;
    
    // 3. DISTORSIÓN POR ONDAS SINUSOIDALES (muy sutil)
    float sineWave1 = sin(uv.x * 25.0 + u_time * 0.2) * SINE_DISTORTION_STRENGTH;
    float sineWave2 = sin(uv.y * 20.0 - u_time * 0.8) * SINE_DISTORTION_STRENGTH;
    displacement += vec2(sineWave2, sineWave1); // Cruzadas para efecto más interesante
    
    // Aplicar distorsión a las UVs
    vec2 distortedUV = uv + displacement;
    
    // ===== DIBUJAR TEXTURAS DE FONDO (SIN ROTACIÓN) =====
    // Usar directamente las UVs distorsionadas sin rotación ni zoom
    vec2 finalUV = distortedUV;
    
    // ===== CHROMATIC ABERRATION: Samplear RGB por separado =====
    vec4 bgTexture1, bgTexture2;
    
    if (chromaticAberration > 0.01) {
        // Separar canales RGB con chromatic aberration
        float aberration = chromaticAberration * CHROMATIC_STRENGTH;
        
        // Textura 1
        float r1 = texture2D(u_backgroundTexture1, finalUV + vec2(aberration, 0.0)).r;
        float g1 = texture2D(u_backgroundTexture1, finalUV).g;
        float b1 = texture2D(u_backgroundTexture1, finalUV - vec2(aberration, 0.0)).b;
        bgTexture1 = vec4(r1, g1, b1, 1.0);
        
        // Textura 2
        float r2 = texture2D(u_backgroundTexture2, finalUV + vec2(aberration, 0.0)).r;
        float g2 = texture2D(u_backgroundTexture2, finalUV).g;
        float b2 = texture2D(u_backgroundTexture2, finalUV - vec2(aberration, 0.0)).b;
        bgTexture2 = vec4(r2, g2, b2, 1.0);
    } else {
        // Sin chromatic aberration
        bgTexture1 = texture2D(u_backgroundTexture1, finalUV);
        bgTexture2 = texture2D(u_backgroundTexture2, finalUV);
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
    vec3 finalColor = backgroundColor.rgb * 0.2 + backgroundColor.rgb * vec3(wavePattern) * 0.29;

    // ===== HALOS EN SHADER =====
    // Aspect ratio corregido para distancia radial
    vec2 arUV = uv;
    arUV.x *= u_resolution.x / u_resolution.y;

    // Halos dorados para positivos (usando u_grapeActive/Positions)
    for (int i = 0; i < 10; i++) {
        if (u_grapeActive[i] > 0.5) {
            vec2 pos = u_grapePositions[i];
            pos.x *= u_resolution.x / u_resolution.y;
            float d = distance(arUV, pos);
            float halo = smoothstep(u_goodHaloSize, 0.02, d);
            finalColor += u_goodHaloColor * halo * u_goodHaloStrength;
        }
    }

    // Halos rojos para negativos
    for (int i = 0; i < 10; i++) {
        if (u_badActive[i] > 0.5) {
            vec2 posB = u_badPositions[i];
            posB.x *= u_resolution.x / u_resolution.y;
            float dB = distance(arUV, posB);
            float haloB = smoothstep(u_badHaloSize, 0.03, dB);
            finalColor += u_badHaloColor * haloB * u_badHaloStrength;
        }
    }
    
    // ===== COLOR GRADING DINÁMICO (basado en combo) =====
    float safeComboLevel = clamp(u_comboLevel, 0.0, 1.0);
    
  
    
    // ===== LÍNEA DIVISORIA CON DISTORSIÓN =====
    // Se calcula usando las UV ya distorsionadas para que se mueva con el shader
    if (u_splitLineEnabled > 0.5) {
        float dx = abs(finalUV.x - 0.5);
        float mask = 1.0 - smoothstep(u_splitLineThickness, u_splitLineThickness + u_splitLineSoftness, dx);
        finalColor = mix(finalColor, u_splitLineColor, clamp(mask, 0.0, 1.0));
    }
    
    // ===== APLICAR FEEDBACK COMO EFECTO =====
    vec4 feedbackColor = texture2D(u_feedbackTexture, uv);
    finalColor += feedbackColor.rgb * feedbackColor.a * 0.25;

    // Tint global suave según evento (veda dorado o rojo)
    if (u_eventActive > 0.5) {
        float t = clamp((u_time - u_eventStartTime) / 1.5, 0.0, 1.0);
        float pulse = 0.5 + 0.5 * sin(u_time * 3.0);
        // Reducir el tinte global del evento para evitar sobreexposición
        finalColor = mix(finalColor, u_eventColor, 0.02 * u_eventStrength * (1.0 - t) * pulse);
    }
    
    // Brillo adicional con combo
    //finalColor += vec3(safeComboLevel * 0.03);
    
    // ===== BLOOM/GLOW EFFECT =====
    // Detectar áreas brillantes
    float brightness = dot(finalColor, vec3(0.299, 0.587, 0.114));
    
    if (brightness > 0.6) {
        // Samplear píxeles vecinos para crear bloom
        vec3 bloom = vec3(0.0);
        float bloomRadius = 0.003 + safeComboLevel * 0.002; // Radio crece con combo
        
        // 8 direcciones
        bloom += texture2D(u_feedbackTexture, uv + vec2(bloomRadius, 0.0)).rgb;
        bloom += texture2D(u_feedbackTexture, uv + vec2(-bloomRadius, 0.0)).rgb;
        bloom += texture2D(u_feedbackTexture, uv + vec2(0.0, bloomRadius)).rgb;
        bloom += texture2D(u_feedbackTexture, uv + vec2(0.0, -bloomRadius)).rgb;
        bloom += texture2D(u_feedbackTexture, uv + vec2(bloomRadius, bloomRadius)).rgb;
        bloom += texture2D(u_feedbackTexture, uv + vec2(-bloomRadius, bloomRadius)).rgb;
        bloom += texture2D(u_feedbackTexture, uv + vec2(bloomRadius, -bloomRadius)).rgb;
        bloom += texture2D(u_feedbackTexture, uv + vec2(-bloomRadius, -bloomRadius)).rgb;
        
        bloom /= 8.0;
        
        // Aplicar bloom solo a áreas brillantes
        float bloomStrength = (brightness - 0.6) * 2.5; // 0 a 1
        bloomStrength *= (0.3 + safeComboLevel * 0.4); // Más fuerte con combo
        
        finalColor += bloom * bloomStrength;
    }
    
    // Asegurar que el color final nunca sea negativo
    finalColor = max(finalColor, vec3(0.0));
    
    gl_FragColor = vec4(finalColor, 1.0);
}
