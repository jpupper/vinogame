precision highp float;

// ============================================================================
//  VINOGAME · BUFFER A (Campo de Agua + MapeoPuntosMaster + Objetos Cayendo)
//  ----------------------------------------------------------------------------
//  Basado en:
//   · https://fullscreencode.com/jpshadereditor/shader.html?shader=agua-nikos
//   · https://fullscreencode.com/jpshadereditor/shader.html?shader=mapeopuntosmaster
//
//  Simula la ecuación de onda 2D discreta con laplaciano estable (condición CFL):
//    .x = altura actual (0.5 = reposo)
//    .y = altura anterior (t - 1)
//    .z = energía / espuma (decae sola y sube donde hay empuje)
//    .w = 1.0 (flag de buffer inicializado)
//
//  Fuentes que empujan y modifican el campo de agua en tiempo real:
//   1. Punteros (LIDAR / Touch / Mouse) con estela por segmento sdSegment
//      (sistema mapeopuntosmaster)
//   2. Objetos buenos cayendo (copas, botellas, uvas) + pulso de captura
//   3. Objetos malos cayendo (bichos) + perturbación en el agua
//   4. Ondas expansivas de captura/interacción (u_wavePositions)
//   5. Onda de evento de celebración (Felicitaciones / Seguí participando)
//   6. Corrientes autónomas suaves (puntoSim / puntoFantasma) cuando está en reposo
// ============================================================================

uniform sampler2D u_feedbackTexture;   // Estado previo del campo de agua (Buffer A)
uniform vec2  u_resolution;
uniform vec2  u_mouse;                 // Posición actual del mouse en px (y=0 arriba)
uniform vec2  u_mousePrev;             // Posición previa del mouse en px (y=0 arriba)
uniform float u_mouseActive;           // 1.0 si el mouse está presionado/activo
uniform float u_time;
uniform int   u_frame;

// Parámetros de agua (agua-nikos)
uniform float u_paso;                  // 0..1 separación de vecinos (default 0.35)
uniform float u_oleaje;                // 0..1 c^2 velocidad de onda (default 0.38)
uniform float u_amortiguar;            // 0..1 amortiguación k (default 0.82)
uniform float u_fuerza;                // 0..1 empuje de mouse (default 0.75)
uniform float u_empuje;                // 0..1 empuje de punteros/LIDAR (default 0.85)
uniform float u_radio;                 // 0..1 radio base de inyección (default 0.42)

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

// Ondas expansivas (normalizadas 0..1, y=0 arriba)
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

// Distancia de un punto p al segmento ab (estela continua de mapeopuntosmaster y agua-nikos)
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

// Barrido simulado (agua-nikos / mapeopuntosmaster) para mantener viva el agua en reposo
vec2 puntoFantasma(float t, float i, float aspecto) {
    float a = t * 1.45 + i * 2.399963;
    float r = 0.18 + 0.14 * (0.5 + 0.5 * sin(t * 0.65 + i * 1.7));
    return vec2(0.5 + r * cos(a) / max(aspecto, 0.001), 0.5 + r * sin(a));
}

// Convierte coordenada normalizada de pantalla (y=0 arriba) a píxeles GL (y=0 abajo)
vec2 screenNormToGLPx(vec2 normPos, vec2 res) {
    return vec2(normPos.x * res.x, (1.0 - normPos.y) * res.y);
}

void main() {
    vec2  frag    = gl_FragCoord.xy;
    vec2  res     = max(u_resolution, vec2(1.0));
    vec2  p       = frag / res;
    float aspecto = res.x / res.y;

    vec4 c = texture2D(u_feedbackTexture, p);
    // Guardia anti-NaN y arranque limpio en reposo (0.5)
    if (u_frame < 2 || c.a < 0.5 || !(c.x == c.x) || !(c.y == c.y) || !(c.z == c.z)) {
        c = vec4(0.5, 0.5, 0.0, 1.0);
    }

    // ── Los cuatro vecinos (muestreo agua-nikos) ───────────────────────────
    float paso = 0.7 + clamp(u_paso, 0.0, 1.0) * 2.3;
    vec2  e    = vec2(paso) / res;
    float s1 = sCampo(p - vec2(0.0, e.y));
    float s2 = sCampo(p - vec2(e.x, 0.0));
    float s3 = sCampo(p + vec2(e.x, 0.0));
    float s4 = sCampo(p + vec2(0.0, e.y));

    // ── Parámetros de amortiguación e inyección ────────────────────────────
    float k    = 0.90 + clamp(u_amortiguar, 0.0, 1.0) * 0.092;
    float perd = 1.0 - k;
    float minDim = min(res.x, res.y);
    float rPx  = max(4.0, (2.5 + clamp(u_radio, 0.0, 1.0) * 14.0) * (0.6 + u_cursorHaloSize * 4.5));
    float iny  = 0.0;
    float energia = 0.0;

    int activePointers = 0;

    // ── 1. PUNTEROS (LIDAR / Touch / Mouse desde PointServer - mapeopuntosmaster) ──
    for (int i = 0; i < 16; i++) {
        if (u_pointerActive[i] > 0.5) {
            activePointers++;
            vec2 pa = screenNormToGLPx(u_pointerPositions[i], res);
            vec2 pb = screenNormToGLPx(u_pointerPrevPositions[i], res);
            float wA = smoothstep(rPx, rPx * 0.15, length(frag - pa));
            float wS = smoothstep(rPx * 1.75, 0.0, sdSeg(frag, pb, pa)) * 0.68;
            float emp = clamp(u_empuje, 0.1, 1.5);
            iny += emp * 0.44 * perd * (wA + wS);
            energia = max(energia, max(wA, wS) * emp);
        }
    }

    // ── 2. MOUSE LOCAL DIRECTO (cuando se mueve o presiona) ────────────────
    if (u_mouseActive > 0.5) {
        vec2 ma = vec2(u_mouse.x, res.y - u_mouse.y);
        vec2 mb = vec2(u_mousePrev.x, res.y - u_mousePrev.y);
        float wA = smoothstep(rPx, rPx * 0.15, length(frag - ma));
        float wS = smoothstep(rPx * 1.65, 0.0, sdSeg(frag, mb, ma)) * 0.60;
        iny += u_fuerza * 0.40 * perd * (wA + wS);
        energia = max(energia, max(wA, wS) * u_fuerza);
    }

    // ── 3. OBJETOS BUENOS CAYENDO (Copas, Botellas, Uvas) ──────────────────
    // Cada objeto cayendo deja una estela de agua real y ondas concéntricas
    float rObjGood = max(10.0, minDim * 0.036);
    for (int i = 0; i < 10; i++) {
        if (u_grapeActive[i] > 0.5) {
            vec2 ga = screenNormToGLPx(u_grapePositions[i], res);
            vec2 gb = screenNormToGLPx(u_grapePrevPositions[i], res);
            float prog = clamp(u_grapeProgress[i], 0.0, 1.0);
            float rG = rObjGood * (1.0 + prog * 0.55);

            float dAct = length(frag - ga);
            float dSeg = sdSeg(frag, gb, ga);

            // Empuje del objeto desplazando el agua al caer + ondulación viva
            float wake = smoothstep(rG, rG * 0.18, dAct);
            float trail = smoothstep(rG * 1.35, 0.0, dSeg) * 0.55;
            float rippleOsc = 0.65 + 0.35 * sin(u_time * 7.0 + float(i) * 1.9);
            float capturePulse = 1.0 + prog * 1.6 * sin(u_time * 14.0 - dAct * 0.12);

            float pushG = (wake * rippleOsc + trail) * (0.58 + prog * 0.65) * capturePulse;
            iny += pushG * 0.38 * perd;
            energia = max(energia, (wake * 0.85 + trail * 0.6) * (0.45 + prog * 0.55));
        }
    }

    // ── 4. OBJETOS MALOS CAYENDO (Bichos) ──────────────────────────────────
    float rObjBad = max(10.0, minDim * 0.034);
    for (int i = 0; i < 10; i++) {
        if (u_badActive[i] > 0.5) {
            vec2 ba = screenNormToGLPx(u_badPositions[i], res);
            vec2 bb = screenNormToGLPx(u_badPrevPositions[i], res);
            float dAct = length(frag - ba);
            float dSeg = sdSeg(frag, bb, ba);

            float wakeB = smoothstep(rObjBad, rObjBad * 0.15, dAct);
            float trailB = smoothstep(rObjBad * 1.3, 0.0, dSeg) * 0.5;
            float oscB = 0.6 + 0.4 * cos(u_time * 9.0 + float(i) * 2.3);

            // Empuje negativo/turbulento para diferenciar la firma en el agua
            iny -= (wakeB * oscB + trailB) * 0.32 * perd;
            energia = max(energia, (wakeB * 0.75 + trailB * 0.5) * 0.45);
        }
    }

    // ── 5. ONDAS EXPANSIVAS (al capturar objetos o tocar en standby) ───────
    for (int i = 0; i < 5; i++) {
        if (u_waveActive[i] > 0.5) {
            vec2 wPos = screenNormToGLPx(u_wavePositions[i], res);
            float wTime = u_time - u_waveTimes[i];
            if (wTime >= 0.0 && wTime < u_waveDuration) {
                float wRadPx = wTime * max(u_waveSpeed, 0.2) * minDim * 0.65;
                float wDist = length(frag - wPos);
                float band = max(8.0, minDim * 0.022);
                float ring = smoothstep(band, 0.0, abs(wDist - wRadPx));
                float fade = smoothstep(u_waveDuration, 0.0, wTime);
                float wStrength = ring * fade * (0.45 + u_waveForce * 1.8);
                iny += wStrength * 0.48 * perd * cos((wDist - wRadPx) * 0.15);
                energia = max(energia, wStrength * 0.75);
            }
        }
    }

    // ── 6. ONDA DE EVENTO (Celebración / Fin de partida) ───────────────────
    if (u_eventActive > 0.5) {
        vec2 eCenterPx = screenNormToGLPx(u_eventCenter, res);
        float eTime = max(0.0, u_time - u_eventStartTime);
        float eDist = length(frag - eCenterPx);
        for (int kRing = 0; kRing < 3; kRing++) {
            float delay = float(kRing) * 0.45;
            float rt = max(0.0, eTime - delay);
            float eRadPx = rt * minDim * 0.52;
            float ring = smoothstep(minDim * 0.03, 0.0, abs(eDist - eRadPx));
            float fade = smoothstep(3.5, 0.0, rt);
            iny += ring * fade * u_eventStrength * 0.55 * perd;
            energia = max(energia, ring * fade * 0.85 * u_eventStrength);
        }
    }

    // ── 7. BARRIDO AUTÓNOMO SUAVE (cuando no hay punteros activos) ─────────
    if (activePointers == 0) {
        float t = u_time * 0.55;
        for (int i = 0; i < 12; i++) {
            float fi   = float(i);
            float jet  = mod(fi, 3.0);
            float cola = floor(fi / 3.0);
            vec2  pf   = puntoFantasma(t - cola * 0.06, jet, aspecto) * res;
            float fade = 1.0 - cola / 4.0;
            float w    = smoothstep(rPx * 0.9, rPx * 0.15, length(frag - pf)) * fade;
            iny += 0.24 * perd * w;
            energia = max(energia, w * 0.28);
        }
    }

    // ── Ecuación de onda discreta (agua-nikos: laplaciano + condición CFL) ─
    float a1  = c.x - 0.5;                          // altura (t-1)
    float a0  = c.y - 0.5;                          // altura (t-2)
    float lap = (s1 + s2 + s3 + s4) - 4.0 * c.x;    // laplaciano de 4 vecinos
    float c2  = 0.05 + clamp(u_oleaje, 0.0, 1.0) * 0.43; // c^2 <= 0.48 (CFL estable)
    float a   = (2.0 * a1 - a0 + c2 * lap) * k;
    a += iny;
    if (!(a == a)) a = 0.0;
    a = clamp(a, -0.48, 0.48);

    // Energía (espuma): decae suavemente y sube con las inyecciones
    float en = clamp(max(c.z * 0.962, energia), 0.0, 1.5);

    gl_FragColor = vec4(a + 0.5, c.x, en, 1.0);
}
