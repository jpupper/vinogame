precision mediump float;

// Uniforms
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform sampler2D u_feedbackTexture;
uniform sampler2D u_particlesTexture;  // Buffer de partículas
uniform sampler2D u_gameTexture;       // Buffer del juego
uniform float u_effectIntensity;      // Intensidad de efectos especiales (0-1)
uniform float u_comboLevel;            // Nivel de combo (0-1)
uniform float u_vignetteIntensity;     // Intensidad del vignette (0-1)

// ONDAS EXPANSIVAS (hasta 5 ondas simultáneas)
uniform vec2 u_wavePositions[5];       // Posiciones de las ondas
uniform float u_waveTimes[5];          // Tiempo de inicio de cada onda
uniform float u_waveActive[5];         // Si la onda está activa (1.0 = sí, 0.0 = no)

// Onda de evento (GANASTE/PERDISTE)
uniform float u_eventActive;           // 1.0 si hay evento activo
uniform vec2  u_eventCenter;           // Centro de la onda (normalizado)
uniform float u_eventStartTime;        // Inicio del evento
uniform vec3  u_eventColor;            // Color del evento
uniform float u_eventStrength;         // Intensidad del evento

// PUNTEROS MÚLTIPLES (mouse/touch/LIDAR)
uniform vec2 u_pointerPositions[16];   // Posiciones normalizadas (0-1)
uniform float u_pointerActive[16];     // 1.0 si el puntero está activo

varying vec2 vTexCoord;

// Función de ruido 2D
float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Ruido fractal (FBM - Fractional Brownian Motion)
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for(int i = 0; i < 4; i++) {
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return value;
}

void main() {
    // Coordenadas UV (corregidas para p5.js)
    vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
    //uv.y = 1.0-uv.y;
    // Corregir aspect ratio
    vec2 aspectUV = uv;
    aspectUV.x *= u_resolution.x / u_resolution.y;
    
    // Posición del mouse corregida
    vec2 mousePos = vec2(u_mouse.x / u_resolution.x, 1.0 - (u_mouse.y / u_resolution.y));
    mousePos.y = 1.0-mousePos.y;
    mousePos.x *= u_resolution.x / u_resolution.y;
    
    float dist = distance(aspectUV, mousePos);
    
    // Radio de influencia del cursor (más pequeño)
    float radius = 0.08;
    float influence = smoothstep(radius, 0.0, dist);
    
    // Desplazamiento basado en la distancia al cursor
    vec2 displacement = vec2(0.0);
    if (influence > 0.0) {
        vec2 direction = normalize(aspectUV - mousePos);
        displacement = direction * influence * 0.015;
        // Deshacer la corrección de aspect ratio para el desplazamiento
        displacement.x /= u_resolution.x / u_resolution.y;
    }

    // Aportar desplazamiento por punteros adicionales
    for (int i = 0; i < 16; i++) {
        if (u_pointerActive[i] > 0.5) {
            vec2 pPos = vec2(u_pointerPositions[i].x, 1.0 - u_pointerPositions[i].y);
            pPos.y = 1.0 - pPos.y; // mantener coherencia con corrección usada en mouse
            pPos.x *= u_resolution.x / u_resolution.y;
            float dP = distance(aspectUV, pPos);
            float infP = smoothstep(radius, 0.0, dP);
            if (infP > 0.0) {
                vec2 dirP = normalize(aspectUV - pPos);
                vec2 dispP = dirP * infP * 0.015;
                dispP.x /= (u_resolution.x / u_resolution.y);
                displacement += dispP;
            }
        }
    }
    
    // Aplicar desplazamiento
    vec2 displacedUV = uv + displacement;
    
    // ===== FEEDBACK LOOP: Acumular solo efectos (no la imagen base) =====
    vec4 previousFrame = texture2D(u_feedbackTexture, uv);
    vec4 finalColor = previousFrame * 0.92; // Decay del feedback (92% del frame anterior)
    
    // ===== BRILLO DEL CURSOR =====
    if (influence > 0.0) {
        // Tinte de color animado
        vec3 tint = vec3(
            0.5 + 0.5 * sin(u_time * 0.5 + dist * 10.0),
            0.5 + 0.5 * sin(u_time * 0.7 + dist * 10.0 + 2.0),
            0.5 + 0.5 * sin(u_time * 0.3 + dist * 10.0 + 4.0)
        );
        
        // BLOOM effect en el centro
        float centerGlow = smoothstep(0.05, 0.0, dist);
        finalColor.rgb += tint * centerGlow * (0.3 + u_effectIntensity * 0.4);
        finalColor.a = max(finalColor.a, centerGlow * 0.8);
    }

    // ===== BRILLO PARA PUNTEROS ADICIONALES =====
    for (int i = 0; i < 16; i++) {
        if (u_pointerActive[i] > 0.5) {
            vec2 pPos = vec2(u_pointerPositions[i].x, 1.0 - u_pointerPositions[i].y);
            pPos.y = 1.0 - pPos.y;
            pPos.x *= u_resolution.x / u_resolution.y;
            float dP = distance(aspectUV, pPos);
            float infP = smoothstep(radius, 0.0, dP);
            if (infP > 0.0) {
                vec3 ptTint = vec3(
                    0.5 + 0.5 * sin(u_time * 0.5 + dP * 10.0),
                    0.5 + 0.5 * sin(u_time * 0.7 + dP * 10.0 + 2.0),
                    0.5 + 0.5 * sin(u_time * 0.3 + dP * 10.0 + 4.0)
                );
                float centerGlowP = smoothstep(0.05, 0.0, dP);
                finalColor.rgb += ptTint * centerGlowP * (0.25 + u_effectIntensity * 0.35);
                finalColor.a = max(finalColor.a, centerGlowP * 0.75);
            }
        }
    }
    
    // ===== ONDAS EXPANSIVAS =====
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
            float waveRadius = waveTime * 0.5; // Velocidad de expansión
            
            // Grosor de la onda (un poco más visible)
            float waveThickness = 0.04;
            
            // Intensidad de la onda (fade out con el tiempo)
            float waveIntensity = smoothstep(2.0, 0.0, waveTime); // Dura 2 segundos
            
            // Dibujar el anillo de la onda
            float ring = smoothstep(waveThickness, 0.0, abs(waveDist - waveRadius));
            
            // Color de la onda (dorado)
            vec3 waveColor = vec3(1.0, 0.85, 0.3);
            
            // Agregar la onda al buffer (más visible)
            finalColor.rgb += waveColor * ring * waveIntensity * 0.6;
            finalColor.a = max(finalColor.a, ring * waveIntensity * 0.4);
        }
    }

    // ===== ONDA DE EVENTO (GANASTE/PERDISTE) =====
    if (u_eventActive > 0.5) {
        vec2 eCenter = u_eventCenter;
        eCenter.x *= u_resolution.x / u_resolution.y;
        float eDist = distance(aspectUV, eCenter);
        float eTime = u_time - u_eventStartTime;
        float eRadius = eTime * 0.7; // un poco más rápida
        float eThickness = 0.05;
        float eIntensity = smoothstep(3.0, 0.0, eTime); // dura ~3s
        float eRing = smoothstep(eThickness, 0.0, abs(eDist - eRadius));
        
        // Glow interior y exterior
        float innerGlow = smoothstep(0.08, 0.0, eDist);
        float outerFade = smoothstep(0.0, 1.5, eTime);
        
        vec3 eColor = u_eventColor;
        float strength = u_eventStrength;
        
        // Anillo principal
        finalColor.rgb += eColor * eRing * eIntensity * (0.8 * strength);
        finalColor.a = max(finalColor.a, eRing * eIntensity * (0.6 * strength));
        
        // Glow central
        finalColor.rgb += eColor * innerGlow * (0.25 * strength);
    }
    
    // PATRÓN DE RUIDO BRILLANTE BASADO EN COMBO (MÁS SUTIL)
    float safeCombo = clamp(u_comboLevel, 0.0, 1.0);
    if (safeCombo > 0.1) {
        // Crear patrón de ruido animado (más lento)
        vec2 noiseCoord = uv * 2.5 + vec2(u_time * 0.15, u_time * 0.12);
        float noisePattern = fbm(noiseCoord);
        
        // Segundo layer de ruido para más complejidad
        vec2 noiseCoord2 = uv * 4.0 - vec2(u_time * 0.2, u_time * 0.18);
        float noisePattern2 = fbm(noiseCoord2);
        
        // Combinar patrones
        float combinedNoise = (noisePattern + noisePattern2 * 0.5) / 1.5;
        
        // Color del brillo basado en combo (de morado a dorado)
        vec3 glowColor = mix(
            vec3(0.6, 0.3, 1.0),  // Morado
            vec3(1.0, 0.8, 0.2),  // Dorado
            safeCombo
        );
        
        // Aplicar brillo con el patrón de ruido (EXTREMADAMENTE SUTIL)
        float glowIntensity = combinedNoise * safeCombo * 0.08; // Reducido de 0.2 a 0.08
        finalColor.rgb += glowColor * glowIntensity;
        
        // Pulso adicional (EXTREMADAMENTE SUTIL)
        float pulse = 0.5 + 0.5 * sin(u_time * 2.5);
        finalColor.rgb += glowColor * safeCombo * 0.02 * pulse; // Reducido de 0.05 a 0.02
        finalColor.a = max(finalColor.a, safeCombo * 0.15); // Alpha muy reducido
    }
    
    // VIGNETTE DINÁMICO (oscurece los bordes cuando tienes pocas vidas)
    if (u_vignetteIntensity > 0.01) {
        vec2 center = uv - 0.5;
        float vignette = length(center);
        vignette = smoothstep(0.3, 1.2, vignette);
        finalColor.rgb *= 1.0 - (vignette * u_vignetteIntensity * 0.7);
        
        // Tinte rojo en el vignette
        finalColor.r += vignette * u_vignetteIntensity * 0.2;
    }
    
    // Mezclar con partículas (aditivo para efecto glow)
    vec4 particlesColor = texture2D(u_particlesTexture, uv);
    finalColor.rgb += particlesColor.rgb * particlesColor.a * 0.5;
    
    // Mezclar con juego
    vec4 gameColor = texture2D(u_gameTexture, uv);
    finalColor = mix(finalColor, gameColor, gameColor.a);
    
    gl_FragColor = finalColor;
}
