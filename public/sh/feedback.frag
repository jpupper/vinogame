precision highp float;

// ============================================================================
//  VINOGAME · BUFFER A (Simulación de Agua + Punteros + Objetos Cayendo)
//  ----------------------------------------------------------------------------
//  Basado en:
//   · https://fullscreencode.com/jpshadereditor/shader.html?shader=solo-agua
//   · https://fullscreencode.com/jpshadereditor/shader.html?shader=mapeopuntosmaster
//
//  Ecuación de onda 2D discreta con laplaciano estable (condición CFL):
//    .x = altura actual (0.5 = reposo)
//    .y = altura anterior (t - 1)
//    .z = energía / espuma
//    .w = 1.0 (flag de buffer inicializado)
//
//  Características:
//   · SIN simulación de puntos moviéndose automáticamente (puntoFantasma eliminado).
//   · Fluido expresivo y configurable desde http://localhost:4353/ tanto para
//     el puntero (mouse/touch/LIDAR) como para los objetos que caen.
// ============================================================================

uniform sampler2D u_feedbackTexture;   // Estado previo del campo de agua (Buffer A)
uniform vec2  u_resolution;
uniform vec2  u_mouse;                 // Posición actual del mouse en px (y=0 arriba)
uniform vec2  u_mousePrev;             // Posición previa del mouse en px (y=0 arriba)
uniform float u_mouseActive;           // 1.0 si el mouse se está moviendo o presionando
uniform float u_time;
uniform int   u_frame;

// Parámetros físicos del agua (controlables desde el panel en localhost:4353)
uniform float u_paso;                  // 0..1 separación de vecinos
uniform float u_oleaje;                // 0..1 velocidad de onda (c^2)
uniform float u_amortiguar;            // 0..1 persistencia / propagación del fluido (k)
uniform float u_fuerza;                // 0..2.5 fuerza de fluido del mouse
uniform float u_empuje;                // 0..2.5 fuerza de fluido de punteros LIDAR/touch
uniform float u_radio;                 // 0..1.5 radio de fluido del puntero
uniform float u_objWakeSize;           // 0..1.5 radio de estela de los objetos que caen
uniform float u_objWakeStrength;       // 0..2.5 fuerza de fluido de los objetos que caen

// Halo / tamaño de cursor desde panel
uniform float u_cursorHaloSize;
uniform float u_cursorHaloStrength;

// Punteros múltiples (mouse/touch/LIDAR) normalizados 0..1 (y=0 arriba)
uniform vec2  u_pointerPositions[16];
uniform vec2  u_pointerPrevPositions[16];
uniform float u_pointerActive[16];

// Objetos buenos cayendo (copas/uvas/botellas) normalizados 0..1 (y=0 arriba)
uniform vec2  u_grapePositions[10];
uniform vec2  u_grapePrevPositions[10];
uniform float u_grapeProgress[10];
uniform float u_grapeActive[10];

// Objetos malos cayendo (bichos) normalizados 0..1 (y=0 arriba)
uniform vec2  u_badPositions[10];
uniform vec2  u_badPrevPositions[10];
uniform float u_badActive[10];

// Ondas expansivas (al capturar un objeto)
uniform vec2  u_wavePositions[5];
uniform float u_waveTimes[5];
uniform float u_waveActive[5];
uniform float u_waveSpeed;
uniform float u_waveForce;
uniform float u_waveDuration;

// Onda de evento (GANASTE / PERDISTE)
uniform float u_eventActive;
uniform vec2  u_eventCenter;
uniform float u_eventStartTime;
uniform float u_eventStrength;

varying vec2 vTexCoord;

// Distancia de un punto p al segmento ab (estela continua)
float sdSeg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
    return length(pa - ba * h);
}

// Lee la altura (.x) del campo en una UV; si aún no fue inicializada devuelve 0.5 (reposo)
float sCampo(vec2 uv) {
    vec4 s = texture2D(u_feedbackTexture, clamp(uv, vec2(0.0), vec2(1.0)));
    if (s.a < 0.5 || !(s.x == s.x)) return 0.5;
    return s.x;
}

// Convierte coordenada normalizada de pantalla (y=0 arriba) a píxeles GL (y=0 abajo)
vec2 screenNormToGLPx(vec2 normPos, vec2 res) {
    return vec2(normPos.x * res.x, (1.0 - normPos.y) * res.y);
}

void main() {
    vec2  frag   = gl_FragCoord.xy;
    vec2  res    = max(u_resolution, vec2(1.0));
    vec2  p      = frag / res;
    float minDim = min(res.x, res.y);

    vec4 c = texture2D(u_feedbackTexture, p);
    // Guardia anti-NaN y arranque limpio en reposo (0.5)
    if (u_frame < 2 || c.a < 0.5 || !(c.x == c.x) || !(c.y == c.y) || !(c.z == c.z)) {
        c = vec4(0.5, 0.5, 0.0, 1.0);
    }

    // ── Los cuatro vecinos ─────────────────────────────────────────────────
    float paso = 0.75 + clamp(u_paso, 0.0, 1.5) * 1.85;
    vec2  e    = vec2(paso) / res;
    float s1 = sCampo(p - vec2(0.0, e.y));
    float s2 = sCampo(p - vec2(e.x, 0.0));
    float s3 = sCampo(p + vec2(e.x, 0.0));
    float s4 = sCampo(p + vec2(0.0, e.y));

    // ── Amortiguación y radio del puntero ──────────────────────────────────
    float k    = 0.89 + clamp(u_amortiguar, 0.0, 1.0) * 0.092;
    float perd = 1.0 - k;
    float rPx  = max(8.0, minDim * (0.010 + clamp(u_radio, 0.05, 1.5) * 0.036) * (0.65 + u_cursorHaloSize * 3.2));
    float iny  = 0.0;
    float energia = 0.0;

    // ── 1. PUNTEROS (LIDAR / Touch / Mouse desde PointServer - mapeopuntosmaster) ──
    for (int i = 0; i < 16; i++) {
        if (u_pointerActive[i] > 0.5) {
            vec2 pa = screenNormToGLPx(u_pointerPositions[i], res);
            vec2 pb = screenNormToGLPx(u_pointerPrevPositions[i], res);
            float moveDist = length(pa - pb);
            float moveBoost = clamp(moveDist / 5.0, 0.35, 1.25);

            float dAct = length(frag - pa);
            float dSeg = sdSeg(frag, pb, pa);

            float wA   = smoothstep(rPx, rPx * 0.12, dAct);
            float wRing = smoothstep(rPx * 0.38, 0.0, abs(dAct - rPx * 0.72)) * 0.35;
            float wS   = smoothstep(rPx * 1.40, 0.0, dSeg) * 0.65;

            float emp = clamp(u_empuje, 0.0, 2.5) * moveBoost;
            iny += emp * 0.65 * perd * (wA + wS - wRing);
            energia = max(energia, max(wA, wS) * clamp(emp * 0.85, 0.0, 1.0));
        }
    }

    // ── 2. MOUSE LOCAL DIRECTO (cuando se mueve o presiona) ────────────────
    if (u_mouseActive > 0.5) {
        vec2 ma = vec2(u_mouse.x, res.y - u_mouse.y);
        vec2 mb = vec2(u_mousePrev.x, res.y - u_mousePrev.y);
        float dAct = length(frag - ma);
        float dSeg = sdSeg(frag, mb, ma);

        float wA    = smoothstep(rPx, rPx * 0.12, dAct);
        float wRing = smoothstep(rPx * 0.38, 0.0, abs(dAct - rPx * 0.72)) * 0.35;
        float wS    = smoothstep(rPx * 1.40, 0.0, dSeg) * 0.65;

        float fMouse = clamp(u_fuerza, 0.0, 2.5);
        iny += fMouse * 0.62 * perd * (wA + wS - wRing);
        energia = max(energia, max(wA, wS) * clamp(fMouse * 0.85, 0.0, 1.0));
    }

    // ── 3. OBJETOS BUENOS CAYENDO (Estela dipolar de fluido al caer) ───────
    float objSizeMul = clamp(u_objWakeSize, 0.05, 2.0);
    float objStrMul  = clamp(u_objWakeStrength, 0.0, 2.5);
    float rObjGood   = max(10.0, minDim * (0.012 + objSizeMul * 0.042));

    for (int i = 0; i < 10; i++) {
        if (u_grapeActive[i] > 0.5) {
            vec2 ga = screenNormToGLPx(u_grapePositions[i], res);
            vec2 gb = screenNormToGLPx(u_grapePrevPositions[i], res);
            float prog = clamp(u_grapeProgress[i], 0.0, 1.0);
            float rG = rObjGood * (1.0 + prog * 0.45);

            float dAct = length(frag - ga);
            float dSeg = sdSeg(frag, gb, ga);

            float wake  = smoothstep(rG, rG * 0.12, dAct);
            float ring  = smoothstep(rG * 0.36, 0.0, abs(dAct - rG * 0.68)) * 0.45;
            float trail = smoothstep(rG * 1.15, 0.0, dSeg) * 0.62;

            float pushG = (wake * 0.78 + trail - ring) * objStrMul * (0.45 + prog * 0.38);
            iny += pushG * perd;
            energia = max(energia, (wake * 0.55 + trail * 0.45) * clamp(objStrMul * (0.38 + prog * 0.45), 0.0, 1.0));
        }
    }

    // ── 4. OBJETOS MALOS CAYENDO (Estela inversa al caer) ──────────────────
    float rObjBad = max(9.0, minDim * (0.011 + objSizeMul * 0.038));
    for (int i = 0; i < 10; i++) {
        if (u_badActive[i] > 0.5) {
            vec2 ba = screenNormToGLPx(u_badPositions[i], res);
            vec2 bb = screenNormToGLPx(u_badPrevPositions[i], res);
            float dAct = length(frag - ba);
            float dSeg = sdSeg(frag, bb, ba);

            float wakeB  = smoothstep(rObjBad, rObjBad * 0.12, dAct);
            float ringB  = smoothstep(rObjBad * 0.36, 0.0, abs(dAct - rObjBad * 0.68)) * 0.42;
            float trailB = smoothstep(rObjBad * 1.10, 0.0, dSeg) * 0.56;

            float pushB = (wakeB * 0.72 + trailB - ringB) * objStrMul * 0.40;
            iny -= pushB * perd;
            energia = max(energia, (wakeB * 0.45 + trailB * 0.35) * clamp(objStrMul * 0.32, 0.0, 1.0));
        }
    }

    // ── 5. ONDAS EXPANSIVAS (al capturar objetos) ──────────────────────────
    for (int i = 0; i < 5; i++) {
        if (u_waveActive[i] > 0.5) {
            vec2 wPos = screenNormToGLPx(u_wavePositions[i], res);
            float wTime = u_time - u_waveTimes[i];
            if (wTime >= 0.0 && wTime < u_waveDuration) {
                float wRadPx = wTime * max(u_waveSpeed, 0.2) * minDim * 0.48;
                float wDist = length(frag - wPos);
                float band = max(6.0, minDim * 0.016);
                float ring = smoothstep(band, 0.0, abs(wDist - wRadPx));
                float fade = smoothstep(u_waveDuration, 0.0, wTime);
                float wStrength = ring * fade * (0.25 + u_waveForce * 0.85);
                iny += wStrength * 0.28 * perd * cos((wDist - wRadPx) * 0.18);
                energia = max(energia, wStrength * 0.45);
            }
        }
    }

    // ── 6. ONDA DE EVENTO (Celebración / Fin de partida) ───────────────────
    if (u_eventActive > 0.5) {
        vec2 eCenterPx = screenNormToGLPx(u_eventCenter, res);
        float eTime = max(0.0, u_time - u_eventStartTime);
        float eDist = length(frag - eCenterPx);
        for (int kRing = 0; kRing < 2; kRing++) {
            float delay = float(kRing) * 0.55;
            float rt = max(0.0, eTime - delay);
            float eRadPx = rt * minDim * 0.44;
            float ring = smoothstep(minDim * 0.022, 0.0, abs(eDist - eRadPx));
            float fade = smoothstep(3.0, 0.0, rt);
            iny += ring * fade * u_eventStrength * 0.30 * perd;
            energia = max(energia, ring * fade * 0.50 * u_eventStrength);
        }
    }

    // ── Ecuación de onda discreta (laplaciano + condición CFL) ─────────────
    float a1  = c.x - 0.5;
    float a0  = c.y - 0.5;
    float lap = (s1 + s2 + s3 + s4) - 4.0 * c.x;
    float c2  = 0.04 + clamp(u_oleaje, 0.0, 1.0) * 0.22;
    float a   = (2.0 * a1 - a0 + c2 * lap) * k;
    a += iny;
    if (!(a == a)) a = 0.0;
    a = clamp(a, -0.42, 0.42);

    // Energía (espuma): decaimiento suave
    float en = clamp(max(c.z * 0.91, energia), 0.0, 1.0);

    gl_FragColor = vec4(a + 0.5, c.x, en, 1.0);
}
