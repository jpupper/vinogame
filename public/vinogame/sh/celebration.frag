precision highp float;

// ============================================================================
//  VINOGAME · CELEBRATION SHADER (Círculos Explosivos + Ondas de Choque + Rayos)
//  ----------------------------------------------------------------------------
//  Dibuja los círculos expansivos y anillos de energía para las pantallas de:
//   · "¡FELICITACIONES!" (u_isWin = 1.0): Oro champagne, ámbar y destellos solares
//   · "¡SEGUÍ PARTICIPANDO!" (u_isWin = 0.0): Carmesí reserva, rubí y pulso neón
// ============================================================================

uniform vec2  u_resolution;
uniform float u_time;          // Tiempo transcurrido desde el inicio de la celebración (segundos)
uniform float u_isWin;         // 1.0 = Victoria (Dorado), 0.0 = Seguí participando (Carmesí/Vino)
uniform vec2  u_center;        // Centro normalizado (0.5, 0.5)

varying vec2 vTexCoord;

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void main() {
    vec2 uv = vec2(vTexCoord.x, 1.0 - vTexCoord.y);
    float aspect = u_resolution.x / max(u_resolution.y, 1.0);

    vec2 p = (uv - u_center) * vec2(aspect, 1.0);
    float r = length(p);
    float a = atan(p.y, p.x);

    float t = u_time;

    // Paleta de colores según resultado
    vec3 colPrimary   = (u_isWin > 0.5) ? vec3(1.00, 0.84, 0.22) : vec3(1.00, 0.18, 0.28);
    vec3 colSecondary = (u_isWin > 0.5) ? vec3(1.00, 0.55, 0.12) : vec3(0.68, 0.06, 0.36);
    vec3 colCore      = (u_isWin > 0.5) ? vec3(1.00, 0.97, 0.82) : vec3(1.00, 0.65, 0.72);

    vec3 acc = vec3(0.0);
    float alphaAcc = 0.0;

    // ── 1. CÍRCULOS DE CHOQUE CONCÉNTRICOS (múltiples trenes de ondas) ─────
    for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float cycle = 2.4;
        float localT = mod(t + fi * (cycle / 7.0), cycle);
        float prog = localT / cycle; // 0..1

        // Expansión con easing (rápido al salir, frena suavemente)
        float rad = (1.0 - pow(1.0 - prog, 2.2)) * 0.95;
        float fade = (1.0 - prog) * smoothstep(0.0, 0.12, prog);

        // Ondulación armónica en el borde del círculo
        floatpetals = (u_isWin > 0.5) ? 12.0 : 8.0;
        float wobble = sin(a * floatpetals + t * 3.5 + fi * 1.3) * 0.008 * prog;
        float distRing = abs(r - (rad + wobble));

        // Núcleo afilado del anillo + halo difuso exponencial
        float thickness = mix(0.016, 0.004, prog);
        float sharpRing = smoothstep(thickness, 0.0, distRing);
        float glowRing  = exp(-distRing * (28.0 + fi * 2.0)) * 0.65;

        // Separación cromática en el borde del círculo
        float ringR = smoothstep(thickness * 1.2, 0.0, abs(r - (rad + wobble + 0.006)));
        float ringB = smoothstep(thickness * 1.2, 0.0, abs(r - (rad + wobble - 0.006)));

        vec3 ringCol = mix(colPrimary, colSecondary, prog);
        ringCol += colCore * sharpRing * 0.85;
        ringCol.r += ringR * 0.35;
        ringCol.b += ringB * 0.25;

        float contrib = (sharpRing * 1.15 + glowRing) * fade;
        acc += ringCol * contrib;
        alphaAcc += contrib * 0.65;
    }

    // ── 2. RAYOS RADIALES / DESTELLOS GIRATORIOS ───────────────────────────
    float ray1 = sin(a * 16.0 + t * 1.8) * 0.5 + 0.5;
    float ray2 = sin(a * 24.0 - t * 2.4) * 0.5 + 0.5;
    float rays = pow(ray1 * ray2, 3.0) * exp(-r * 2.4) * smoothstep(0.02, 0.22, r);
    acc += mix(colPrimary, colCore, 0.5) * rays * 0.75;
    alphaAcc += rays * 0.45;

    // ── 3. ANILLO CENTRAL DE ENERGÍA PULSANTE ──────────────────────────────
    float corePulse = 0.14 + 0.02 * sin(t * 6.0);
    float innerHalo = exp(-r * 3.8) * (0.45 + 0.15 * sin(t * 4.5));
    float innerRing = smoothstep(0.012, 0.0, abs(r - corePulse)) * 0.8;
    acc += colPrimary * innerHalo + colCore * innerRing;
    alphaAcc += innerHalo * 0.5 + innerRing * 0.6;

    // ── 4. PARTÍCULAS / CHISPAS ORBITALES DISPARADAS DESDE EL CENTRO ───────
    for (int j = 0; j < 18; j++) {
        float fj = float(j);
        float seed = hash21(vec2(fj, fj * 1.37));
        float pCycle = 1.8 + seed * 1.2;
        float pt = mod(t + seed * 3.0, pCycle) / pCycle;
        float pAng = fj * 2.399963 + t * (0.3 + seed * 0.4) * ((mod(fj, 2.0) < 0.5) ? 1.0 : -1.0);
        float pRad = pt * (0.55 + seed * 0.35);
        vec2  pPos = vec2(cos(pAng), sin(pAng)) * pRad;
        float dP = length(p - pPos);
        float spark = exp(-dP * 75.0) * (1.0 - pt) * smoothstep(0.0, 0.15, pt);
        acc += mix(colCore, colPrimary, seed) * spark * 1.4;
        alphaAcc += spark * 0.85;
    }

    // Viñeta suave en los bordes del área para fundirse limpio
    float edgeFade = smoothstep(0.98, 0.25, r);
    acc *= edgeFade;
    alphaAcc = clamp(alphaAcc * edgeFade, 0.0, 0.92);

    // Tonemap suave
    vec3 finalCol = 1.0 - exp(-acc * 1.35);

    gl_FragColor = vec4(finalCol, alphaAcc);
}
