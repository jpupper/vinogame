precision highp float;

// ============================================================================
//  VINOGAME · OUTPUT (Agua Nikos + MapeoPuntosMaster + Fondos + Halos)
//  ----------------------------------------------------------------------------
//  Basado en:
//   · https://fullscreencode.com/jpshadereditor/shader.html?shader=agua-nikos
//   · https://fullscreencode.com/jpshadereditor/shader.html?shader=mapeopuntosmaster
//
//  Lee el campo de agua simulado en Buffer A (u_feedbackTexture):
//   · .x = altura actual de la superficie (0.5 = reposo)
//   · .y = altura del frame anterior (velocidad implícita)
//   · .z = energía acumulada (espuma)
//
//  Aplica:
//   1. Gradiente espacial de 4 vecinos -> Normal 3D de la superficie del agua
//   2. Refracción óptica del agua sobre el blend de imágenes de fondo
//      (u_backgroundTexture1 y u_backgroundTexture2) con aberración cromática sutil
//   3. Cáusticas dinámicas, espuma de cresta e iluminación especular + Fresnel
//   4. Halos dorados (objetos buenos) y rojos (objetos malos) refractados por el agua
//   5. Visualización de punteros estilo mapeopuntosmaster (núcleo + halo + estela sdSegment)
//   6. Línea divisoria distorsionada por el agua para modo competitivo
// ============================================================================

uniform sampler2D u_backgroundTexture1;
uniform sampler2D u_backgroundTexture2;
uniform float u_backgroundBlend;
uniform float u_backgroundRotation;
uniform sampler2D u_feedbackTexture;   // Buffer A: campo de agua (.x altura, .y ant, .z energía)
uniform vec2  u_resolution;
uniform float u_time;
uniform float u_comboLevel;

// Parámetros ópticos del agua (agua-nikos)
uniform float u_refraccion;            // 0..1 cuánto desvía la superficie (default 0.38)
uniform float u_relieve;               // 0..1 pendiente de la normal (default 0.52)
uniform float u_profundidad;           // 0..1 componente z de la normal (default 0.50)
uniform float u_especular;             // 0..1 dureza del brillo especular (default 0.62)
uniform float u_brillo;                // 0..1 intensidad especular/Fresnel (default 0.68)
uniform float u_causticas;             // 0..1 intensidad de cáusticas (default 0.42)
uniform float u_espuma;                // 0..1 espuma donde hubo empuje (default 0.55)
uniform vec2  u_foco;                  // posición de la luz (default 0.5, 0.72)
uniform vec3  u_agua;                  // tinte del agua (default 0.96, 0.95, 1.0)

// Ondas expansivas
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
uniform vec3  u_eventColor;
uniform float u_eventStrength;

// Objetos buenos (copas, botellas, uvas)
uniform vec2  u_grapePositions[10];
uniform float u_grapeProgress[10];
uniform float u_grapeActive[10];

// Objetos malos (bichos)
uniform vec2  u_badPositions[10];
uniform float u_badActive[10];

// Punteros mapeopuntosmaster
uniform vec2  u_pointerPositions[16];
uniform vec2  u_pointerPrevPositions[16];
uniform float u_pointerActive[16];
uniform vec2  u_mouse;
uniform vec2  u_mousePrev;
uniform float u_mouseActive;
uniform float u_cursorHaloSize;
uniform float u_cursorHaloStrength;

// Halos configurables desde el panel de control
uniform float u_goodHaloSize;
uniform float u_goodHaloStrength;
uniform vec3  u_goodHaloColor;
uniform float u_badHaloSize;
uniform float u_badHaloStrength;
uniform vec3  u_badHaloColor;

// Línea divisoria (modo competitivo)
uniform float u_splitLineEnabled;
uniform vec3  u_splitLineColor;
uniform float u_splitLineThickness;
uniform float u_splitLineSoftness;

// Brillo global y viñeta de vidas
uniform float u_backgroundBrightness;
uniform float u_vignetteIntensity;

varying vec2 vTexCoord;

// ── Helpers de agua-nikos y mapeopuntosmaster ──────────────────────────────
float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float ruido(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
    return length(pa - ba * h);
}

// Cáusticas de agua-nikos: células de luz concentradas por la superficie
float causticas(vec2 q, float t) {
    float v = 0.0;
    float a = 1.0;
    vec2  w = q;
    for (int i = 0; i < 3; i++) {
        v += a * (1.0 - abs(ruido(w * (1.7 + float(i))) * 2.0 - 1.0));
        a *= 0.55;
        w = w * 2.03 + vec2(t * 0.05, -t * 0.04);
    }
    return pow(clamp(v, 0.0, 1.0), 5.0);
}

// Acumulador de punto estilo mapeopuntosmaster (núcleo + halo exponencial + estela sdSegment)
void sumarPunto(inout vec3 acc, vec2 frag, vec2 act, vec2 ant, float radio, vec3 colPunto, float glowAmt) {
    float dAct   = length(frag - act);
    float nucleo = exp(-pow(dAct / max(radio, 0.5), 2.0) * 2.4);
    float halo   = exp(-dAct / max(radio * 1.85, 1.0)) * 0.26 * glowAmt;
    float dSeg   = sdSegment(frag, act, ant);
    float estela = exp(-pow(dSeg / max(radio * 1.45, 1.0), 2.0)) * 0.72;
    acc += colPunto * (nucleo + halo + estela);
}

void main() {
    vec2  frag    = gl_FragCoord.xy;
    vec2  res     = max(u_resolution, vec2(1.0));
    vec2  uv      = frag / res;            // y=0 abajo, y=1 arriba (GL)
    vec2  texel   = 1.0 / res;
    float aspecto = res.x / res.y;

    // Coordenada UV en espacio de pantalla (y=0 arriba, y=1 abajo) para distancias con objetos de p5
    vec2 screenUV = vec2(uv.x, 1.0 - uv.y);
    vec2 aspectScreenUV = vec2(screenUV.x * aspecto, screenUV.y);

    // ── 1. LEER CAMPO DE AGUA DEL BUFFER A (agua-nikos) ────────────────────
    vec4 campo = texture2D(u_feedbackTexture, uv);
    vec2 tc = campo.xy;
    if (campo.a < 0.5 || !(tc.x == tc.x)) tc.x = 0.5;
    if (campo.a < 0.5 || !(tc.y == tc.y)) tc.y = 0.5;
    float energia = (campo.a < 0.5 || !(campo.z == campo.z)) ? 0.0 : clamp(campo.z, 0.0, 1.5);

    float h   = tc.x - 0.5;                // -0.5..0.5 : altura de la superficie (0 = reposo)
    float vel = tc.x - tc.y;               // velocidad vertical implícita

    // ── 2. NORMAL 3D POR GRADIENTE ESPACIAL DE 4 VECINOS ───────────────────
    vec2 tx = vec2(texel.x, 0.0);
    vec2 ty = vec2(0.0, texel.y);
    vec4 mL = texture2D(u_feedbackTexture, clamp(uv - tx, vec2(0.0), vec2(1.0)));
    vec4 mR = texture2D(u_feedbackTexture, clamp(uv + tx, vec2(0.0), vec2(1.0)));
    vec4 mD = texture2D(u_feedbackTexture, clamp(uv - ty, vec2(0.0), vec2(1.0)));
    vec4 mU = texture2D(u_feedbackTexture, clamp(uv + ty, vec2(0.0), vec2(1.0)));
    float hL = (mL.a < 0.5) ? 0.5 : mL.x;
    float hR = (mR.a < 0.5) ? 0.5 : mR.x;
    float hD = (mD.a < 0.5) ? 0.5 : mD.x;
    float hU = (mU.a < 0.5) ? 0.5 : mU.x;

    vec2 grad = vec2(hR - hL, hU - hD) * 0.5;
    vec2 pend = grad * vec2(aspecto, 1.0) * (30.0 + u_relieve * 170.0);
    vec3 n    = normalize(vec3(-pend, 0.25 + u_profundidad * 1.75));

    // ── 3. DESPLAZAMIENTO DE REFRACCIÓN DEL AGUA + OBJETOS/ONDAS ───────────
    // Refracción principal del campo de agua (agua-nikos) + gradiente de lente
    vec2 waterOff = (tc - vec2(0.5)) * (0.14 + u_refraccion * 0.85)
                  + grad * (0.25 + u_refraccion * 1.35);

    // Sumar atracción gravitacional suave de objetos buenos y ondas expansivas
    vec2 extraDisp = vec2(0.0);
    float chromatic = length(grad) * 2.2 + abs(h) * 0.35;

    for (int i = 0; i < 5; i++) {
        if (u_waveActive[i] > 0.5) {
            vec2 wPos = vec2(u_wavePositions[i].x * aspecto, u_wavePositions[i].y);
            float wDist = distance(aspectScreenUV, wPos);
            float wTime = u_time - u_waveTimes[i];
            float wRad = wTime * u_waveSpeed;
            float wInt = smoothstep(u_waveDuration, 0.0, wTime);
            float dStr = smoothstep(0.14, 0.0, abs(wDist - wRad)) * wInt;
            vec2 dir = normalize(aspectScreenUV - wPos + vec2(0.0001));
            extraDisp += vec2(dir.x / aspecto, -dir.y) * dStr * 0.055 * u_waveForce;
            chromatic += dStr * wInt * u_waveForce;
        }
    }

    for (int i = 0; i < 10; i++) {
        if (u_grapeActive[i] > 0.5) {
            vec2 gPos = vec2(u_grapePositions[i].x * aspecto, u_grapePositions[i].y);
            float gDist = distance(aspectScreenUV, gPos);
            float infRad = 0.14 + u_grapeProgress[i] * 0.10;
            float gForce = (1.0 / (1.0 + gDist * gDist * 22.0)) * smoothstep(infRad, 0.0, gDist);
            gForce *= (1.0 + u_grapeProgress[i] * 2.2);
            vec2 dir = normalize(gPos - aspectScreenUV + vec2(0.0001));
            extraDisp += vec2(dir.x / aspecto, -dir.y) * gForce * 0.010;
            chromatic += gForce * u_grapeProgress[i] * 0.6;
        }
    }

    vec2 totalOff = waterOff + extraDisp;
    vec2 quv = clamp(uv + totalOff, vec2(0.001), vec2(0.999));

    // ── 4. MUESTREO DE IMÁGENES DE FONDO CON REFRACCIÓN Y ABERRACIÓN ───────
    vec3 bg1, bg2;
    float aberr = clamp(chromatic, 0.0, 1.5) * 0.0045;
    if (aberr > 0.0004) {
        vec2 abVec = normalize(totalOff + vec2(0.0001)) * aberr;
        bg1.r = texture2D(u_backgroundTexture1, clamp(quv + abVec, 0.001, 0.999)).r;
        bg1.g = texture2D(u_backgroundTexture1, quv).g;
        bg1.b = texture2D(u_backgroundTexture1, clamp(quv - abVec, 0.001, 0.999)).b;

        bg2.r = texture2D(u_backgroundTexture2, clamp(quv + abVec, 0.001, 0.999)).r;
        bg2.g = texture2D(u_backgroundTexture2, quv).g;
        bg2.b = texture2D(u_backgroundTexture2, clamp(quv - abVec, 0.001, 0.999)).b;
    } else {
        bg1 = texture2D(u_backgroundTexture1, quv).rgb;
        bg2 = texture2D(u_backgroundTexture2, quv).rgb;
    }

    vec3 fondo = mix(bg1, bg2, clamp(u_backgroundBlend, 0.0, 1.0));

    // ── 5. ÓPTICA DE AGUA-NIKOS: TINTE + CÁUSTICAS + ESPUMA + ESPECULAR ────
    // Nivel base balanceado para que luzca vibrante con el control de brillo del juego
    vec3 col = fondo * u_agua * 0.58;

    // Cáusticas solares/cristalinas que se concentran según la altura h de las ondas
    float cau = causticas((uv + totalOff * 1.8) * vec2(aspecto, 1.0) * 2.4, u_time * 0.6);
    float waveActivity = clamp(abs(h) * 8.0 + energia * 0.6, 0.0, 1.0);
    col += cau * u_causticas * 1.65 * mix(u_agua, vec3(1.0, 0.92, 0.75), 0.5)
         * (0.28 + 0.72 * waveActivity);

    // Espuma donde hubo empuje de punteros o caída de objetos (energía del Buffer A)
    float espN = ruido(vec2(uv.x * aspecto, uv.y) * 85.0 + vec2(u_time * 0.35, -u_time * 0.3) + vel * 28.0);
    float esp  = smoothstep(0.26, 0.92, energia)
               * smoothstep(0.42, 0.92, espN * 0.55 + energia * 0.72);
    col += esp * u_espuma * vec3(1.0, 0.97, 0.92) * 0.55;

    // Iluminación especular y Fresnel sobre la normal 3D del agua
    vec3  L    = normalize(vec3((u_foco - uv) * vec2(aspecto, 1.0), 0.55));
    vec3  Hv   = normalize(L + vec3(0.0, 0.0, 1.0));
    float nh   = max(dot(n, Hv), 0.0);
    float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);
    col += (pow(nh, 12.0 + u_especular * 340.0) * u_brillo * 1.45
          + pow(nh, 7.0) * u_brillo * 0.08) * vec3(1.0, 0.98, 0.92);
    col += fres * u_brillo * 0.28 * mix(u_agua, vec3(0.95, 0.85, 1.0), 0.5);

    // ── 6. HALOS DE OBJETOS CAYENDO (REFRACTADOS POR EL AGUA) ──────────────
    // Usamos screenUV desplazada por el agua para que las auras doradas y rojas
    // también se ondulen orgánicamente con el agua
    vec2 refractedScreenUV = screenUV + vec2(totalOff.x, -totalOff.y) * 0.45;
    vec2 arUV = vec2(refractedScreenUV.x * aspecto, refractedScreenUV.y);

    // Halos dorados para objetos buenos (copas, botellas, uvas)
    for (int i = 0; i < 10; i++) {
        if (u_grapeActive[i] > 0.5) {
            vec2 pos = vec2(u_grapePositions[i].x * aspecto, u_grapePositions[i].y);
            float d = distance(arUV, pos);
            float prog = clamp(u_grapeProgress[i], 0.0, 1.0);
            float haloSize = u_goodHaloSize * (1.0 + prog * 0.35);
            float halo = smoothstep(haloSize, 0.018, d);
            float ring = smoothstep(0.012, 0.0, abs(d - haloSize * (0.55 + 0.15 * sin(u_time * 5.0 + float(i))))) * 0.35;
            col += u_goodHaloColor * (halo + ring) * u_goodHaloStrength * (1.0 + prog * 0.5);
        }
    }

    // Halos rojos para objetos malos (bichos)
    for (int i = 0; i < 10; i++) {
        if (u_badActive[i] > 0.5) {
            vec2 posB = vec2(u_badPositions[i].x * aspecto, u_badPositions[i].y);
            float dB = distance(arUV, posB);
            float haloB = smoothstep(u_badHaloSize, 0.025, dB);
            float pulseB = 0.85 + 0.15 * sin(u_time * 8.0 + float(i) * 2.0);
            col += u_badHaloColor * haloB * u_badHaloStrength * pulseB;
        }
    }

    // ── 7. MAPEO DE PUNTOS MASTER (núcleo + halo + estela sdSegment) ───────
    vec3 puntosAcc = vec3(0.0);
    float radioPunto = max(3.0, (0.008 + u_cursorHaloSize * 0.14) * min(res.x, res.y));
    float activePtsCount = 0.0;

    for (int i = 0; i < 16; i++) {
        if (u_pointerActive[i] > 0.5) {
            activePtsCount += 1.0;
            vec2 act = vec2(u_pointerPositions[i].x * res.x, (1.0 - u_pointerPositions[i].y) * res.y);
            vec2 ant = vec2(u_pointerPrevPositions[i].x * res.x, (1.0 - u_pointerPrevPositions[i].y) * res.y);
            vec3 ptColor = vec3(
                0.75 + 0.25 * sin(u_time * 1.5 + float(i) * 0.7),
                0.65 + 0.25 * sin(u_time * 1.9 + float(i) * 0.7 + 1.5),
                0.95
            );
            sumarPunto(puntosAcc, frag, act, ant, radioPunto, ptColor, clamp(u_cursorHaloStrength, 0.0, 2.0));
        }
    }

    if (u_mouseActive > 0.5) {
        activePtsCount += 1.0;
        vec2 mAct = vec2(u_mouse.x, res.y - u_mouse.y);
        vec2 mAnt = vec2(u_mousePrev.x, res.y - u_mousePrev.y);
        sumarPunto(puntosAcc, frag, mAct, mAnt, radioPunto * 1.05, vec3(1.0, 0.88, 0.55), clamp(u_cursorHaloStrength, 0.0, 2.0));
    }

    // Normalización por raíz de cantidad (mapeopuntosmaster) para no saturar con muchos puntos
    if (activePtsCount > 0.0) {
        puntosAcc /= 1.0 + sqrt(activePtsCount) * 0.22;
        col += (1.0 - exp(-puntosAcc * 1.35)) * (0.55 * u_cursorHaloStrength);
    }

    // ── 8. LÍNEA DIVISORIA CON DISTORSIÓN DE AGUA (Modo Competitivo) ───────
    if (u_splitLineEnabled > 0.5) {
        float dx = abs(quv.x - 0.5);
        float core = 1.0 - smoothstep(u_splitLineThickness, u_splitLineThickness + u_splitLineSoftness, dx);
        float glow = exp(-dx * 140.0) * 0.45;
        vec3 lineCol = mix(u_splitLineColor, vec3(1.0, 0.85, 0.45), 0.4);
        col = mix(col, lineCol, clamp(core + glow, 0.0, 1.0));
    }

    // ── 9. EVENTO DE CELEBRACIÓN / COMBO / VIÑETA DE VIDAS ─────────────────
    if (u_eventActive > 0.5) {
        vec2 eCenter = vec2(u_eventCenter.x * aspecto, u_eventCenter.y);
        float eDist = distance(aspectScreenUV, eCenter);
        float eTime = max(0.0, u_time - u_eventStartTime);
        float eRad = eTime * 0.65;
        float eRing = smoothstep(0.045, 0.0, abs(eDist - eRad)) * smoothstep(3.2, 0.0, eTime);
        col += u_eventColor * eRing * 0.35 * u_eventStrength;
    }

    // Boost sutil por combo
    float safeCombo = clamp(u_comboLevel, 0.0, 1.0);
    if (safeCombo > 0.05) {
        col += vec3(0.18, 0.12, 0.04) * safeCombo * (0.5 + 0.5 * sin(u_time * 3.0));
    }

    // Viñeta dinámica cuando quedan pocas vidas + viñeta óptica suave de agua-nikos
    float distCenter = length(uv - 0.5);
    col *= 1.0 - 0.38 * distCenter;
    if (u_vignetteIntensity > 0.01) {
        float vig = smoothstep(0.28, 1.15, distCenter);
        col *= 1.0 - (vig * u_vignetteIntensity * 0.55);
        col.r += vig * u_vignetteIntensity * 0.18;
    }

    // Tonemap suave y grano sutil anti-banding (agua-nikos)
    col = max(col, vec3(0.0));
    col = clamp(col * u_backgroundBrightness, 0.0, 1.0);
    col += (hash12(frag + fract(u_time) * 137.0) - 0.5) * 0.008;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
