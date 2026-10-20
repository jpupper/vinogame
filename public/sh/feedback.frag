precision highp float;

// ============================================================================
//  VINOGAME · BUFFER A (Simulación de Agua Sutil + Punteros + Objetos Cayendo)
//  ----------------------------------------------------------------------------
//  Basado en:
//   · https://fullscreencode.com/jpshadereditor/shader.html?shader=solo-agua
//   · https://fullscreencode.com/jpshadereditor/shader.html?shader=mapeopuntosmaster
//
//  Ecuación de onda 2D discreta con laplaciano estable (condición CFL):
//    .x = altura actual (0.5 = reposo)
//    .y = altura anterior (t - 1)
//    .z = energía / espuma (decae rápido para no saturar)
//    .w = 1.0 (flag de buffer inicializado)
//
//  Características de esta versión:
//   · SIN simulación de puntos moviéndose automáticamente (puntoFantasma eliminado).
//   · Propagación de fluido contenida y sutil (amortiguación calibrada).
//   · Los objetos que caen generan una ondulación muy delicada y localizada
//     alrededor de su centro sin inundar la pantalla de fluido.
// ============================================================================

uniform sampler2D u_feedbackTexture;   // Estado previo del campo de agua (Buffer A)
uniform vec2  u_resolution;
uniform vec2  u_mouse;                 // Posición actual del mouse en px (y=0 arriba)
uniform vec2  u_mousePrev;             // Posición previa del mouse en px (y=0 arriba)
uniform float u_mouseActive;           // 1.0 si el mouse se está moviendo o presionando
uniform float u_time;
uniform int   u_frame;

// Parámetros de agua
uniform float u_paso;                  // 0..1 separación de vecinos
uniform float u_oleaje;                // 0..1 c^2 velocidad de onda
uniform float u_amortiguar;            // 0..1 amortiguación k
uniform float u_fuerza;                // 0..1 empuje de mouse
uniform float u_empuje;                // 0..1 empuje de punteros/LIDAR
uniform float u_radio;                 // 0..1 radio base de inyección

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
    float paso = 0.7 + clamp(u_paso, 0.0, 1.0) * 1.6;
    vec2  e    = vec2(paso) / res;
    float s1 = sCampo(p - vec2(0.0, e.y));
    float s2 = sCampo(p - vec2(e.x, 0.0));
    float s3 = sCampo(p + vec2(e.x, 0.0));
    float s4 = sCampo(p + vec2(0.0, e.y));

    // ── Amortiguación calibrada para que el fluido no se propague en exceso ─
    float k    = 0.84 + clamp(u_amortiguar, 0.0, 1.0) * 0.095;
    float perd = 1.0 - k;
    float rPx  = max(3.5, (2.0 + clamp(u_radio, 0.0, 1.0) * 10.0) * (0.55 + u_cursorHaloSize * 3.0));
    float iny  = 0.0;
    float energia = 0.0;

    // ── 1. PUNTEROS (LIDAR / Touch / Mouse desde PointServer - mapeopuntosmaster) ──
    for (int i = 0; i < 16; i++) {
        if (u_pointerActive[i] > 0.5) {
            vec2 pa = screenNormToGLPx(u_pointerPositions[i], res);
            vec2 pb = screenNormToGLPx(u_pointerPrevPositions[i], res);
            float moveDist = length(pa - pb);
            float moveBoost = clamp(moveDist / 6.0, 0.25, 1.0);
            float wA = smoothstep(rPx, rPx * 0.15, length(frag - pa));
            float wS = smoothstep(rPx * 1.35, 0.0, sdSeg(frag, pb, pa)) * 0.50;
            float emp = clamp(u_empuje, 0.1, 1.2) * moveBoost;
            iny += emp * 0.26 * perd * (wA + wS);
            energia = max(energia, max(wA, wS) * emp * 0.65);
        }
    }

    // ── 2. MOUSE LOCAL DIRECTO (sólo cuando se mueve o presiona) ───────────
    if (u_mouseActive > 0.5) {
        vec2 ma = vec2(u_mouse.x, res.y - u_mouse.y);
        vec2 mb = vec2(u_mousePrev.x, res.y - u_mousePrev.y);
        float wA = smoothstep(rPx, rPx * 0.15, length(frag - ma));
        float wS = smoothstep(rPx * 1.3, 0.0, sdSeg(frag, mb, ma)) * 0.45;
        iny += u_fuerza * 0.24 * perd * (wA + wS);
        energia = max(energia, max(wA, wS) * u_fuerza * 0.6);
    }

    // ── 3. OBJETOS BUENOS CAYENDO (Perturbación MUY sutil y localizada) ────
    float rObjGood = max(4.0, minDim * 0.013);
    for (int i = 0; i < 10; i++) {
        if (u_grapeActive[i] > 0.5) {
            vec2 ga = screenNormToGLPx(u_grapePositions[i], res);
            vec2 gb = screenNormToGLPx(u_grapePrevPositions[i], res);
            float prog = clamp(u_grapeProgress[i], 0.0, 1.0);
            float rG = rObjGood * (1.0 + prog * 0.35);

            float dAct = length(frag - ga);
            float dSeg = sdSeg(frag, gb, ga);

            float wake  = smoothstep(rG, rG * 0.20, dAct);
            float trail = smoothstep(rG * 0.95, 0.0, dSeg) * 0.32;

            // Empuje muy suave al caer; sólo aumenta levemente al ser capturado
            float pushG = (wake * 0.65 + trail) * (0.065 + prog * 0.11);
            iny += pushG * perd;
            energia = max(energia, wake * prog * 0.28);
        }
    }

    // ── 4. OBJETOS MALOS CAYENDO (Perturbación MUY sutil) ──────────────────
    float rObjBad = max(4.0, minDim * 0.012);
    for (int i = 0; i < 10; i++) {
        if (u_badActive[i] > 0.5) {
            vec2 ba = screenNormToGLPx(u_badPositions[i], res);
            vec2 bb = screenNormToGLPx(u_badPrevPositions[i], res);
            float dAct = length(frag - ba);
            float dSeg = sdSeg(frag, bb, ba);

            float wakeB  = smoothstep(rObjBad, rObjBad * 0.20, dAct);
            float trailB = smoothstep(rObjBad * 0.90, 0.0, dSeg) * 0.28;

            iny -= (wakeB * 0.6 + trailB) * 0.055 * perd;
        }
    }

    // ── 5. ONDAS EXPANSIVAS (al capturar objetos) ──────────────────────────
    for (int i = 0; i < 5; i++) {
        if (u_waveActive[i] > 0.5) {
            vec2 wPos = screenNormToGLPx(u_wavePositions[i], res);
            float wTime = u_time - u_waveTimes[i];
            if (wTime >= 0.0 && wTime < u_waveDuration) {
                float wRadPx = wTime * max(u_waveSpeed, 0.2) * minDim * 0.45;
                float wDist = length(frag - wPos);
                float band = max(5.0, minDim * 0.014);
                float ring = smoothstep(band, 0.0, abs(wDist - wRadPx));
                float fade = smoothstep(u_waveDuration, 0.0, wTime);
                float wStrength = ring * fade * (0.20 + u_waveForce * 0.75);
                iny += wStrength * 0.22 * perd * cos((wDist - wRadPx) * 0.18);
                energia = max(energia, wStrength * 0.35);
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
            float eRadPx = rt * minDim * 0.42;
            float ring = smoothstep(minDim * 0.02, 0.0, abs(eDist - eRadPx));
            float fade = smoothstep(3.0, 0.0, rt);
            iny += ring * fade * u_eventStrength * 0.25 * perd;
            energia = max(energia, ring * fade * 0.45 * u_eventStrength);
        }
    }

    // ── Ecuación de onda discreta (laplaciano + condición CFL) ─────────────
    float a1  = c.x - 0.5;
    float a0  = c.y - 0.5;
    float lap = (s1 + s2 + s3 + s4) - 4.0 * c.x;
    float c2  = 0.035 + clamp(u_oleaje, 0.0, 1.0) * 0.18;
    float a   = (2.0 * a1 - a0 + c2 * lap) * k;
    a += iny;
    if (!(a == a)) a = 0.0;
    a = clamp(a, -0.40, 0.40);

    // Energía (espuma): decae rápido para mantener limpia la imagen de fondo
    float en = clamp(max(c.z * 0.88, energia), 0.0, 1.0);

    gl_FragColor = vec4(a + 0.5, c.x, en, 1.0);
}
