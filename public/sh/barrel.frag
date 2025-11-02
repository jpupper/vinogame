precision mediump float;

uniform sampler2D u_barrelTexture; // textura base del barril
uniform float u_fillLevel;         // nivel de llenado normalizado (0-1)
uniform float u_time;              // tiempo para animación
uniform vec2 u_resolution;         // tamaño del buffer

varying vec2 vTexCoord;

void main() {
    // p5.js invierte Y en vTexCoord, corregimos
    vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);

    // Textura base del barril
    vec4 barrelColor = texture2D(u_barrelTexture, uv);
    
    // Definir área de llenado del barril (parte central)
    float minY = 0.8;  // parte inferior del barril
    float maxY = 0.2;  // parte superior del barril
    
    // Mapear el fillLevel para que use el rango del barril
    float baseFill = mix(minY, maxY, u_fillLevel);
    float surface = baseFill;
    
    // Ondas para el líquido (vino)
    float waveX1 = sin(uv.x * 18.0 + u_time * 1.8) * 0.015;
    float waveX2 = sin(uv.x * 28.0 - u_time * 1.2) * 0.01;
    float waveY  = sin(uv.y * 12.0 + u_time * 1.5) * 0.008;
    float waveOffset = waveX1 + waveX2 + waveY;
    
    float liquidSurface = surface + waveOffset;
    float insideLiquid = step(uv.y, liquidSurface);
    
    // Color del vino (rojo oscuro)
    vec3 wineColor = vec3(0.6, 0.1, 0.15);
    
    // Variación de brillo con ondas
    float rising = sin(uv.y * 20.0 - u_time * 2.0) * 0.5 + 0.5;
    vec3 wineAnimated = wineColor * (0.7 + rising * 0.3);
    
    // Reflejos cerca de la superficie
    float surfaceGlow = smoothstep(0.03, 0.0, abs(uv.y - liquidSurface));
    wineAnimated += vec3(0.4, 0.2, 0.1) * surfaceGlow * 0.5;
    
    // Máscara para que el líquido solo aparezca en el área central del barril
    float barrelMask = 1.0;
    if (uv.x < 0.15 || uv.x > 0.85) barrelMask = 0.0; // lados del barril
    if (uv.y < 0.15 || uv.y > 0.85) barrelMask = 0.0; // arriba y abajo del barril
    
    // Aplicar el líquido solo donde corresponde
    vec3 wineMasked = wineAnimated * barrelMask * insideLiquid;
    
    // Mezclar con la textura del barril
    vec3 finalRGB = mix(barrelColor.rgb, wineMasked, insideLiquid * barrelMask * 0.8);
    
    gl_FragColor = vec4(finalRGB, barrelColor.a);
}