precision mediump float;

uniform sampler2D u_glassTexture; // copa-vacia base
uniform sampler2D u_glassMask;    // máscara de la copa
uniform float u_fillLevel;        // nivel de combo (0-1)
uniform float u_time;             // tiempo para animación
uniform vec2 u_resolution;        // tamaño del buffer

varying vec2 vTexCoord;
float mapr(float _value,float _low2,float _high2) {
	float val = _low2 + (_high2 - _low2) * (_value - 0.) / (1.0 - 0.);
    //float val = 0.1;
	return val;
}
void main() {
    // p5.js invierte Y en vTexCoord, corregimos
    vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);

    // Textura base de la copa
    vec4 glassColor = texture2D(u_glassTexture, uv);
    // Máscara: usar canal alpha si existe; si no, usar rojo
    vec4 maskSample = texture2D(u_glassMask, uv);
    float maskA = max(maskSample.a, maskSample.r);

    // Superficie/altura de la onda basada en fill level
    // uv.y va de 0 (top) a 1 (bottom); queremos llenar desde abajo
    float baseFill = clamp(u_fillLevel, 0.0, 1.0);
    float surface = 1.0 - baseFill; // más alto cuando fill es bajo

    // Onda violeta (sinusoidales, similar al barril)
    float waveX1 = sin(uv.x * 22.0 + u_time * 2.1) * 0.02;
    float waveX2 = sin(uv.x * 35.0 - u_time * 1.4) * 0.015;
    float waveY  = sin(uv.y * 14.0 + u_time * 1.8) * 0.01;
    float waveOffset = waveX1 + waveX2 + waveY;

    float liquidSurface = surface + waveOffset;
    float insideLiquid = step(uv.y, liquidSurface);

    // Color violeta brillante
    vec3 violet = vec3(0.75, 0.25, 0.95)*.8;
    // Variación de brillo con ondas ascendentes
    float rising = sin(uv.y * 28.0 - u_time * 2.6) * 0.5 + 0.5;
    vec3 violetAnimated = violet * (0.65 + rising * 0.35);

    // Reflejos suaves cerca de la superficie
    float surfaceGlow = smoothstep(0.02, 0.0, abs(uv.y - liquidSurface));
    violetAnimated += vec3(0.3, 0.1, 0.45) * surfaceGlow * 0.6;

    // Aplicar máscara: solo se ve dentro de la copa
    vec3 violetMasked = violetAnimated * maskA * insideLiquid;

    // Sumar dibujo violeta a la copa
    vec3 finalRGB = glassColor.rgb + violetMasked;


    float auxFillLevel = u_fillLevel;

    auxFillLevel = mapr(auxFillLevel, 0.5, 1.0);
    finalRGB = mix(violetMasked, glassColor.rgb, step(auxFillLevel, 1.-uv.y));
    float finalA = max(glassColor.a, maskA * insideLiquid);

    gl_FragColor = vec4(finalRGB, glassColor.a);
}