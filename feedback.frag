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
    
    // Solo efectos de cursor (sin oscurecer la imagen base)
    vec4 finalColor = vec4(0.0, 0.0, 0.0, 0.0); // Empezar con negro transparente
    
    // Solo agregar brillo cerca del cursor (MÁS SUTIL)
    if (influence > 0.0) {
        // Agregar un tinte de color basado en la posición (más suave)
        vec3 tint = vec3(
            0.5 + 0.5 * sin(u_time * 0.5 + dist * 10.0),
            0.5 + 0.5 * sin(u_time * 0.7 + dist * 10.0 + 2.0),
            0.5 + 0.5 * sin(u_time * 0.3 + dist * 10.0 + 4.0)
        );
        
        // BLOOM effect - brillo adicional en el centro (EXTREMADAMENTE SUTIL)
        float centerGlow = smoothstep(0.05, 0.0, dist); // Radio muy pequeño
        finalColor.rgb = tint * centerGlow * (0.08 + u_effectIntensity * 0.12); // Intensidad muy reducida
        finalColor.a = centerGlow * 0.4; // Alpha muy reducido
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
