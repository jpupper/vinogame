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
    
    // Aplicar desplazamiento
    vec2 displacedUV = uv + displacement;
    
    // CHROMATIC ABERRATION (separación RGB)
    float aberrationAmount = influence * 0.01 * u_effectIntensity;
    vec4 currentColor;
    if (u_effectIntensity > 0.1) {
        float r = texture2D(u_texture, displacedUV + vec2(aberrationAmount, 0.0)).r;
        float g = texture2D(u_texture, displacedUV).g;
        float b = texture2D(u_texture, displacedUV - vec2(aberrationAmount, 0.0)).b;
        currentColor = vec4(r, g, b, 1.0);
    } else {
        currentColor = texture2D(u_texture, displacedUV);
    }
    
    // Feedback: mezclar con el frame anterior
    vec4 feedbackColor = texture2D(u_feedbackTexture, uv);
    
    // Mezclar con feedback (persistencia para rastros)
    vec4 finalColor = mix(feedbackColor * 0.98, currentColor, 0.2);
    
    // BRIGHTNESS BOOST en toda la imagen
    finalColor.rgb *= 1.0 + u_effectIntensity * 0.3;
    
    // COLOR GRADING basado en combo
    if (u_comboLevel > 0.05) {
        // Shift hacia colores cálidos (dorado) con combo alto
        vec3 warmTint = vec3(1.1, 1.05, 0.9);
        finalColor.rgb = mix(finalColor.rgb, finalColor.rgb * warmTint, u_comboLevel * 0.3);
        
        // Aumentar saturación con combo
        float luminance = dot(finalColor.rgb, vec3(0.299, 0.587, 0.114));
        finalColor.rgb = mix(vec3(luminance), finalColor.rgb, 1.0 + u_comboLevel * 0.3);
    }
    
    // Cambio de color y brillo cerca del cursor
    if (influence > 0.0) {
        // Agregar un tinte de color basado en la posición
        vec3 tint = vec3(
            0.5 + 0.5 * sin(u_time * 0.5 + dist * 10.0),
            0.5 + 0.5 * sin(u_time * 0.7 + dist * 10.0 + 2.0),
            0.5 + 0.5 * sin(u_time * 0.3 + dist * 10.0 + 4.0)
        );
        
        // Aumentar brillo en el área de influencia
        float brightnessFactor = 1.15 + u_effectIntensity * 0.5;
        finalColor.rgb = mix(finalColor.rgb, finalColor.rgb * tint * brightnessFactor, influence * 0.4);
        
        // BLOOM effect - brillo adicional en el centro
        float centerGlow = smoothstep(0.02, 0.0, dist);
        finalColor.rgb += vec3(centerGlow * (0.1 + u_effectIntensity * 0.4));
    }
    
    // PATRÓN DE RUIDO BRILLANTE BASADO EN COMBO
    if (u_comboLevel > 0.1) {
        // Crear patrón de ruido animado
        vec2 noiseCoord = uv * 3.0 + vec2(u_time * 0.2, u_time * 0.15);
        float noisePattern = fbm(noiseCoord);
        
        // Segundo layer de ruido para más complejidad
        vec2 noiseCoord2 = uv * 5.0 - vec2(u_time * 0.3, u_time * 0.25);
        float noisePattern2 = fbm(noiseCoord2);
        
        // Combinar patrones
        float combinedNoise = (noisePattern + noisePattern2 * 0.5) / 1.5;
        
        // Color del brillo basado en combo (de morado a dorado)
        vec3 glowColor = mix(
            vec3(0.6, 0.3, 1.0),  // Morado
            vec3(1.0, 0.8, 0.2),  // Dorado
            u_comboLevel
        );
        
        // Aplicar brillo con el patrón de ruido
        float glowIntensity = combinedNoise * u_comboLevel * 0.4;
        finalColor.rgb += glowColor * glowIntensity;
        
        // Pulso adicional
        float pulse = 0.5 + 0.5 * sin(u_time * 3.0);
        finalColor.rgb += glowColor * u_comboLevel * 0.1 * pulse;
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
