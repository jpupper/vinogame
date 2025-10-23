precision mediump float;

// Uniforms
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform sampler2D u_feedbackTexture;

varying vec2 vTexCoord;

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
    
    // Feedback: mezclar con el frame anterior
    vec4 currentColor = texture2D(u_texture, displacedUV);
    vec4 feedbackColor = texture2D(u_feedbackTexture, uv);
    
    // Mezclar con feedback (persistencia para rastros)
    vec4 finalColor = mix(feedbackColor * 0.98, currentColor, 0.2);
    
    // Cambio de color y brillo cerca del cursor
    if (influence > 0.0) {
        // Agregar un tinte de color basado en la posición
        vec3 tint = vec3(
            0.5 + 0.5 * sin(u_time * 0.5 + dist * 10.0),
            0.5 + 0.5 * sin(u_time * 0.7 + dist * 10.0 + 2.0),
            0.5 + 0.5 * sin(u_time * 0.3 + dist * 10.0 + 4.0)
        );
        
        // Aumentar brillo en el área de influencia
        finalColor.rgb = mix(finalColor.rgb, finalColor.rgb * tint * 1.15, influence * 0.4);
        
        // Agregar un brillo adicional en el centro (más pequeño)
        float centerGlow = smoothstep(0.02, 0.0, dist);
        finalColor.rgb += vec3(centerGlow * 0.1);
    }
    
    gl_FragColor = finalColor;
}
