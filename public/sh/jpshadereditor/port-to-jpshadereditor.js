/**
 * Port de todos los shaders de VinoGame a JP Shader Editor (https://fullscreencode.com/jpshadereditor)
 * Shaders incluidos:
 *  1. vinogame-agua         (Multibuffer: Buffer A Campo de Agua + MapeoPuntosMaster + Objetos Cayendo -> Output Refracción + Cáusticas + Halos)
 *  2. vinogame-celebracion  (Círculos explosivos, ondas de choque cromáticas, rayos y chispas para Felicitaciones / Seguí participando)
 *  3. vinogame-clasico      (Multibuffer original de VinoGame: Feedback de cursores/ondas -> Composite gravitacional + halos)
 *  4. vinogame-medidor      (Medidor de combo dentro de copa de vino con ondas violetas y reflejos de superficie)
 */

const fs = require('fs');
const path = require('path');

const VPS_API = 'https://vps-4455523-x.dattaweb.com/jpshadereditor/api/shaders';
const PLAN_API = 'https://vps-4455523-x.dattaweb.com/jpshadereditor/api/include/plan?shader=';

// ============================================================================
// 1. vinogame-agua (Multibuffer: Buffer A + Output)
// ============================================================================
const vinogameAguaBuffer0 = `// ============================================================================
//  VINOGAME · AGUA · CAMPO (Buffer A)
//  ---------------------------------------------------------------------------
//  Fusión de:
//   · "agua-nikos" (Nikos Papadopoulos / Carlos Kernel)
//   · "mapeopuntosmaster" (pointers + lidarPointers + mouse + simulatedPointers)
//   · Objetos cayendo de VinoGame (copas, botellas, uvas y bichos) que empujan
//     la superficie del agua al caer y generan ondas concéntricas.
// ============================================================================

uniform vec4  pointers[12];
uniform int   pointersCount;
uniform vec4  lidarPointers[30];
uniform int   lidarPointersCount;
uniform vec4  simulatedPointers[64];
uniform int   simulatedPointersCount;

uniform float u_fuerza;        // 0..1 empuje del mouse
uniform float u_empuje;        // 0..1 empuje de punteros / dedos
uniform float u_lidar_fuerza;  // 0..1 empuje del LIDAR
uniform float u_objetos_fuerza;// 0..1 empuje de los objetos cayendo
uniform float u_radio;         // 0..1 radio de inyección
uniform float u_paso;          // 0..1 separación de vecinos (STEP)
uniform float u_oleaje;        // 0..1 velocidad de onda c^2
uniform float u_amortiguar;    // 0..1 amortiguación k (MODIFIER)
uniform float u_speed;         // 0..1 velocidad de caída / barrido
uniform bool  u_sim_objetos;   // simular caída de objetos de vino en el editor
uniform bool  u_lidar_sim;     // barrido autónomo cuando no hay sensor

float sdSeg(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
    return length(pa - ba * h);
}

float sCampo(vec2 uv) {
    vec4 s = texture2D(iChannel0, clamp(uv, vec2(0.0), vec2(1.0)));
    if (!(s.x == s.x)) return 0.5;
    return s.x;
}

vec2 puntoFantasma(float t, float i, float aspecto) {
    float a = t * 1.55 + i * 2.399963;
    float r = 0.17 + 0.13 * (0.5 + 0.5 * sin(t * 0.7 + i * 1.7));
    return vec2(0.5 + r * cos(a) / max(aspecto, 0.001), 0.5 + r * sin(a));
}

// Posición determinista de objetos cayendo (sincronizada con el pase Output)
vec2 posObjetoCayendo(float idx, float t, float speed, float aspecto) {
    float seed = fract(sin(idx * 127.1 + 311.7) * 43758.5453);
    float fallRate = (0.12 + 0.08 * seed) * (0.4 + speed * 1.2);
    float y = 1.12 - mod(t * fallRate + seed * 1.25, 1.24); // va de 1.12 (arriba) a -0.12 (abajo)
    float xBase = 0.10 + 0.80 * fract(sin(idx * 269.5 + 183.3) * 43758.5453);
    float sway = sin(t * (1.2 + seed) + idx * 2.1) * 0.035;
    return vec2(xBase + sway, y);
}

void main() {
    vec2  frag    = gl_FragCoord.xy;
    vec2  res     = max(resolution, vec2(1.0));
    vec2  p       = frag / res;
    float aspecto = res.x / res.y;

    vec4 c = texture2D(iChannel0, p);
    if (!(c.x == c.x)) c.x = 0.5;
    if (!(c.y == c.y)) c.y = 0.5;
    if (!(c.z == c.z)) c.z = 0.0;

    float paso = 0.7 + u_paso * 2.3;
    vec2  e    = vec2(paso) / res;
    float s1 = sCampo(p - vec2(0.0, e.y));
    float s2 = sCampo(p - vec2(e.x, 0.0));
    float s3 = sCampo(p + vec2(e.x, 0.0));
    float s4 = sCampo(p + vec2(0.0, e.y));

    float k    = 0.90 + u_amortiguar * 0.0995;
    float perd = 1.0 - k;
    float rPx  = 2.0 + u_radio * 14.0;
    float iny  = 0.0;
    float energia = 0.0;

    // 1. MOUSE
    float sinPunteros = 1.0 - step(0.5, float(pointersCount));
    if (mouse.z > 0.0001 && sinPunteros > 0.5) {
        float w = smoothstep(rPx, rPx * 0.15, length(frag - mouse.xy));
        iny += u_fuerza * 0.42 * perd * w;
        energia = max(energia, w * u_fuerza);
    }

    // 2. DEDOS / PUNTEROS MULTIUSUARIO (mapeopuntosmaster)
    for (int i = 0; i < 12; i++) {
        if (i >= pointersCount) break;
        vec2 pa = pointers[i].xy;
        vec2 pb = pointers[i].zw;
        float wA = smoothstep(rPx, rPx * 0.15, length(frag - pa));
        float wS = smoothstep(rPx * 1.7, 0.0, sdSeg(frag, pb, pa)) * 0.58;
        iny += u_empuje * 0.42 * perd * (wA + wS);
        energia = max(energia, max(wA, wS) * u_empuje);
    }

    // 3. PUNTOS SIMULADOS JS (simulatedPointers de mapeopuntosmaster)
    for (int i = 0; i < 64; i++) {
        if (i >= simulatedPointersCount) break;
        vec2 pa = vec2(simulatedPointers[i].x, res.y - simulatedPointers[i].y);
        vec2 pb = vec2(simulatedPointers[i].z, res.y - simulatedPointers[i].w);
        float wA = smoothstep(rPx, rPx * 0.15, length(frag - pa));
        float wS = smoothstep(rPx * 1.6, 0.0, sdSeg(frag, pb, pa)) * 0.55;
        iny += u_empuje * 0.36 * perd * (wA + wS);
        energia = max(energia, max(wA, wS) * u_empuje * 0.8);
    }

    // 4. LIDAR (mapeopuntosmaster + agua-nikos)
    if (lidarPointersCount > 0) {
        for (int i = 0; i < 30; i++) {
            if (i >= lidarPointersCount) break;
            vec2 pa = vec2(lidarPointers[i].x, res.y - lidarPointers[i].y);
            vec2 pb = vec2(lidarPointers[i].z, res.y - lidarPointers[i].w);
            float wA = smoothstep(rPx, rPx * 0.15, length(frag - pa));
            float wS = smoothstep(rPx * 1.8, 0.0, sdSeg(frag, pb, pa)) * 0.65;
            iny += u_lidar_fuerza * 0.45 * perd * (wA + wS);
            energia = max(energia, max(wA, wS) * u_lidar_fuerza);
        }
    } else if (u_lidar_sim) {
        float t = time * (0.25 + u_speed * 0.9);
        for (int i = 0; i < 15; i++) {
            float fi   = float(i);
            float jet  = mod(fi, 3.0);
            float cola = floor(fi / 3.0);
            vec2  pf   = puntoFantasma(t - cola * 0.055, jet, aspecto) * res;
            float fade = 1.0 - cola / 5.0;
            float w    = smoothstep(rPx * 0.95, rPx * 0.15, length(frag - pf)) * fade;
            iny += u_lidar_fuerza * 0.35 * perd * w;
            energia = max(energia, w * u_lidar_fuerza * 0.7);
        }
    }

    // 5. OBJETOS CAYENDO DE VINOGAME (8 buenos + 4 malos empujando el agua)
    if (u_sim_objetos) {
        float rObj = min(res.x, res.y) * 0.035;
        for (int i = 0; i < 12; i++) {
            float fi = float(i);
            vec2 uvAct = posObjetoCayendo(fi, time, u_speed, aspecto);
            vec2 uvAnt = posObjetoCayendo(fi, time - 0.035, u_speed, aspecto);
            vec2 pa = uvAct * res;
            vec2 pb = uvAnt * res;
            float dAct = length(frag - pa);
            float dSeg = sdSeg(frag, pb, pa);
            float wA = smoothstep(rObj, rObj * 0.15, dAct);
            float wS = smoothstep(rObj * 1.35, 0.0, dSeg) * 0.55;
            float osc = 0.65 + 0.35 * sin(time * 7.5 + fi * 1.9);
            float signPush = (i < 8) ? 1.0 : -0.85;
            iny += signPush * u_objetos_fuerza * 0.42 * perd * (wA * osc + wS);
            energia = max(energia, max(wA, wS) * u_objetos_fuerza * 0.85);
        }
    }

    // Ecuación de onda discreta (agua-nikos)
    float a1  = c.x - 0.5;
    float a0  = c.y - 0.5;
    float lap = (s1 + s2 + s3 + s4) - 4.0 * c.x;
    float c2  = 0.05 + u_oleaje * 0.45;
    float a   = (2.0 * a1 - a0 + c2 * lap) * k;
    a += iny;
    a *= smoothstep(0.9, 1.0, float(iFrame >= 10));
    if (!(a == a)) a = 0.0;
    a  = clamp(a, -0.5, 0.5);

    float en = clamp(max(c.z * 0.965, energia), 0.0, 1.5);
    gl_FragColor = vec4(a + 0.5, c.x, en, 1.0);
}
`;

const vinogameAguaMain = `// ============================================================================
//  VINOGAME · AGUA · SALIDA (Output)
//  ---------------------------------------------------------------------------
//  Fusión de:
//   · "agua-nikos" (Refracción + Normal 4 vecinos + Cáusticas + Espuma + Especular)
//   · "mapeopuntosmaster" (Visualización de puntos con núcleo, halo y estela)
//   · "VinoGame" (Blend de imágenes de viñedos/bodega + Halos dorados/rojos de
//     objetos cayendo refractados por el agua + Línea divisoria competitiva)
//
//  iChannel0 = Buffer A (Campo de Agua)
//  iChannel1 = Imagen de fondo 1 (opcional)
//  iChannel2 = Imagen de fondo 2 (opcional, para transición suave)
// ============================================================================

uniform vec4  pointers[256];
uniform int   pointersCount;
uniform vec4  lidarPointers[30];
uniform int   lidarPointersCount;
uniform vec4  simulatedPointers[64];
uniform int   simulatedPointersCount;

uniform bool  u_fondo_img;       // usar imagen de iChannel1/iChannel2 o viñedo procedural
uniform bool  u_sim_objetos;     // mostrar halos de objetos cayendo
uniform bool  u_mostrar_puntos;  // mostrar puntos estilo mapeopuntosmaster
uniform bool  u_split_line;      // mostrar línea divisoria de modo competitivo

uniform float u_blend_fondo;     // 0..1 transición entre iChannel1 e iChannel2
uniform float u_refraccion;      // 0..1 fuerza de refracción del agua
uniform float u_relieve;         // 0..1 pendiente de la normal 3D
uniform float u_profundidad;     // 0..1 componente z de la normal
uniform float u_especular;       // 0..1 dureza del brillo especular
uniform float u_brillo;          // 0..1 intensidad especular
uniform float u_causticas;       // 0..1 luz de cáusticas
uniform float u_espuma;          // 0..1 espuma en zonas de empuje
uniform float u_good_halo;       // 0..1 tamaño/fuerza de halos dorados
uniform float u_bad_halo;        // 0..1 tamaño/fuerza de halos rojos
uniform float u_radio;           // 0..1 radio de los puntos mapeopuntosmaster
uniform float u_speed;           // 0..1 velocidad de objetos
uniform vec2  u_foco;            // posición del foco de luz
uniform vec3  u_agua;            // tinte del agua
uniform vec3  u_good_color;      // color halo objetos buenos (oro)
uniform vec3  u_bad_color;       // color halo objetos malos (carmesí)

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

// Fondo procedural de bodega/viñedo al atardecer cuando no hay textura en iChannel1
vec3 pisoVinedo(vec2 q, float aspecto) {
    vec2 g = vec2(q.x * aspecto, q.y) * 7.0;
    vec2 celda = floor(g);
    float h = hash12(celda * 1.37);
    vec3 colVino = mix(vec3(0.22, 0.05, 0.14), vec3(0.45, 0.14, 0.24), q.y);
    vec3 colSol  = mix(vec3(0.55, 0.28, 0.12), vec3(0.85, 0.58, 0.22), smoothstep(0.2, 0.95, q.y));
    vec3 base = mix(colVino, colSol, 0.45 + 0.35 * sin(q.x * 3.14159));
    vec3 col = mix(base, base * 1.35 + 0.03, h * 0.5);
    vec2 dd = abs(fract(g) - 0.5);
    float junta = smoothstep(0.42, 0.5, max(dd.x, dd.y));
    col = mix(col, vec3(0.10, 0.02, 0.06), junta * 0.65);
    col *= 0.88 + 0.24 * ruido(g * 5.0);
    return col;
}

float causticas(vec2 q, float t) {
    float v = 0.0;
    float a = 1.0;
    vec2  w = q;
    for (int i = 0; i < 3; i++) {
        v += a * (1.0 - abs(ruido(w * (1.7 + float(i))) * 2.0 - 1.0));
        a *= 0.55;
        w = w * 2.03 + vec2(t * 0.05, -t * 0.04);
    }\n    return pow(clamp(v, 0.0, 1.0), 5.0);
}

vec2 posObjetoCayendo(float idx, float t, float speed, float aspecto) {
    float seed = fract(sin(idx * 127.1 + 311.7) * 43758.5453);
    float fallRate = (0.12 + 0.08 * seed) * (0.4 + speed * 1.2);
    float y = 1.12 - mod(t * fallRate + seed * 1.25, 1.24);
    float xBase = 0.10 + 0.80 * fract(sin(idx * 269.5 + 183.3) * 43758.5453);
    float sway = sin(t * (1.2 + seed) + idx * 2.1) * 0.035;
    return vec2(xBase + sway, y);
}

void sumarPunto(inout vec3 acc, vec2 frag, vec2 act, vec2 ant, float radio, vec3 c) {
    float dAct   = length(frag - act);
    float nucleo = exp(-pow(dAct / max(radio, 0.25), 2.0) * 2.4);
    float halo   = exp(-dAct / max(radio * 1.7, 1.0)) * 0.24;
    float dSeg   = sdSegment(frag, act, ant);
    float estela = exp(-pow(dSeg / max(radio * 1.5, 1.0), 2.0)) * 0.75;
    acc += c * (nucleo + halo + estela);
}

void main() {
    vec2  frag    = gl_FragCoord.xy;
    vec2  res     = max(resolution, vec2(1.0));
    vec2  uv      = frag / res;
    vec2  texel   = 1.0 / res;
    float aspecto = res.x / res.y;

    // 1. Campo del Buffer A
    vec4 campo = texture2D(iChannel0, uv);
    vec2 tc = campo.xy;
    if (!(tc.x == tc.x)) tc.x = 0.5;
    if (!(tc.y == tc.y)) tc.y = 0.5;
    float energia = clamp(campo.z, 0.0, 1.5);
    if (!(energia == energia)) energia = 0.0;

    float h   = tc.x - 0.5;
    float vel = tc.x - tc.y;

    // 2. Normal 3D por gradiente espacial
    vec2 tx = vec2(texel.x, 0.0);
    vec2 ty = vec2(0.0, texel.y);
    vec4 mL = texture2D(iChannel0, clamp(uv - tx, vec2(0.0), vec2(1.0)));
    vec4 mR = texture2D(iChannel0, clamp(uv + tx, vec2(0.0), vec2(1.0)));
    vec4 mD = texture2D(iChannel0, clamp(uv - ty, vec2(0.0), vec2(1.0)));
    vec4 mU = texture2D(iChannel0, clamp(uv + ty, vec2(0.0), vec2(1.0)));
    vec2 grad = vec2(mR.x - mL.x, mU.x - mD.x) * 0.5;
    vec2 pend = grad * vec2(aspecto, 1.0) * (30.0 + u_relieve * 170.0);
    vec3 n    = normalize(vec3(-pend, 0.25 + u_profundidad * 1.75));

    // 3. Refracción
    vec2 off = (tc - vec2(0.5)) * (0.15 + u_refraccion * 1.35) + grad * (0.2 + u_refraccion);
    vec2 quv = clamp(uv + off, vec2(0.001), vec2(0.999));

    // 4. Fondo (iChannel1 / iChannel2 o piso de viñedo procedural)
    vec3 fondo;
    if (u_fondo_img) {
        vec3 tex1 = texture2D(iChannel1, quv).rgb;
        vec3 tex2 = texture2D(iChannel2, quv).rgb;
        fondo = mix(tex1, tex2, clamp(u_blend_fondo, 0.0, 1.0));
        if (dot(fondo, vec3(1.0)) < 0.01) {
            fondo = pisoVinedo(quv, aspecto);
        }
    } else {
        fondo = pisoVinedo(quv, aspecto);
    }

    vec3 col = fondo * u_agua;

    // 5. Cáusticas + Espuma + Especular (agua-nikos)
    float cau = causticas((uv + off * 1.8) * vec2(aspecto, 1.0) * 2.4, time * 0.6);
    col += cau * u_causticas * 2.1 * mix(u_agua, vec3(1.0, 0.92, 0.76), 0.55)
         * (0.45 + 0.55 * clamp(abs(h) * 6.0, 0.0, 1.0));

    float espN = ruido(vec2(uv.x * aspecto, uv.y) * 90.0 + vec2(time * 0.35, -time * 0.3) + vel * 30.0);
    float esp  = smoothstep(0.28, 0.95, energia)
               * smoothstep(0.45, 0.95, espN * 0.55 + energia * 0.7);
    col += esp * u_espuma * vec3(1.0, 0.97, 0.92) * 0.65;

    vec3  L    = normalize(vec3((u_foco - uv) * vec2(aspecto, 1.0), 0.55));
    vec3  Hv   = normalize(L + vec3(0.0, 0.0, 1.0));
    float nh   = max(dot(n, Hv), 0.0);
    float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);
    col += (pow(nh, 10.0 + u_especular * 360.0) * u_brillo * 1.65
          + pow(nh, 8.0) * u_brillo * 0.10) * vec3(1.0, 0.98, 0.94);
    col += fres * u_brillo * 0.32 * mix(u_agua, vec3(0.96, 0.88, 1.0), 0.5);

    // 6. Halos de objetos cayendo refractados por el agua
    if (u_sim_objetos) {
        vec2 arUV = vec2(quv.x * aspecto, quv.y);
        for (int i = 0; i < 12; i++) {
            float fi = float(i);
            vec2 pos = posObjetoCayendo(fi, time, u_speed, aspecto);
            pos.x *= aspecto;
            float d = distance(arUV, pos);
            if (i < 8) {
                float rH = 0.06 + u_good_halo * 0.10;
                float halo = smoothstep(rH, 0.012, d);
                col += u_good_color * halo * (0.25 + u_good_halo * 0.45);
            } else {
                float rB = 0.06 + u_bad_halo * 0.10;
                float haloB = smoothstep(rB, 0.015, d);
                col += u_bad_color * haloB * (0.25 + u_bad_halo * 0.45);
            }
        }
    }

    // 7. Puntos mapeopuntosmaster
    if (u_mostrar_puntos) {
        vec3 acc = vec3(0.0);
        float radio = 3.0 + clamp(u_radio, 0.0, 1.0) * 20.0;
        for (int i = 0; i < 256; i++) {
            if (i >= pointersCount) break;
            sumarPunto(acc, frag, pointers[i].xy, pointers[i].zw, radio, vec3(1.0, 0.85, 0.4));
        }
        for (int i = 0; i < 30; i++) {
            if (i >= lidarPointersCount) break;
            vec2 act = vec2(lidarPointers[i].x, res.y - lidarPointers[i].y);
            vec2 ant = vec2(lidarPointers[i].z, res.y - lidarPointers[i].w);
            sumarPunto(acc, frag, act, ant, radio, vec3(0.35, 0.95, 1.0));
        }
        for (int i = 0; i < 64; i++) {
            if (i >= simulatedPointersCount) break;
            vec2 act = vec2(simulatedPointers[i].x, res.y - simulatedPointers[i].y);
            vec2 ant = vec2(simulatedPointers[i].z, res.y - simulatedPointers[i].w);
            sumarPunto(acc, frag, act, ant, radio * 0.85, vec3(1.0, 0.78, 0.35));
        }
        float nPts = float(pointersCount) + float(lidarPointersCount) + float(simulatedPointersCount) + 1.0;
        acc /= 1.0 + sqrt(nPts) * 0.18;
        col += 1.0 - exp(-acc * 1.4);
    }

    // 8. Línea divisoria competitiva
    if (u_split_line) {
        float dx = abs(quv.x - 0.5);
        float lineMask = exp(-dx * 180.0);
        col = mix(col, vec3(1.0, 0.88, 0.55), clamp(lineMask, 0.0, 1.0));
    }

    col *= 1.0 - 0.48 * length(uv - 0.5);
    col  = 1.0 - exp(-col * 1.18);
    col += (hash12(frag + fract(time) * 137.0) - 0.5) * 0.010;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// ============================================================================
// 2. vinogame-celebracion (Círculos y ondas de choque para Felicitaciones / Seguí participando)
// ============================================================================
const vinogameCelebracionCode = `// ============================================================================
//  VINOGAME · CELEBRACIÓN (Felicitaciones / Seguí Participando)
//  ---------------------------------------------------------------------------
//  Shader de anillos explosivos, ondas de choque cromáticas, rayos solares
//  y partículas orbitales para las pantallas de fin de juego de VinoGame.
//   · u_victoria = true  -> Modo ¡FELICITACIONES! (Oro Champagne & Ámbar)
//   · u_victoria = false -> Modo ¡SEGUÍ PARTICIPANDO! (Carmesí & Rubí)
// ============================================================================

uniform bool  u_victoria;      // true = Felicitaciones (Oro) · false = Seguí participando (Rubí)
uniform bool  u_split;         // true = Pantalla dividida competitiva (Izquierda gana / Derecha pierde)
uniform float u_velocidad;     // 0..1 velocidad de expansión de los círculos
uniform float u_anillos;       // 0..1 intensidad de los círculos concéntricos
uniform float u_rayos;         // 0..1 intensidad de los rayos radiales
uniform float u_chispas;       // 0..1 destellos orbitales
uniform vec3  u_color_win;     // color principal victoria
uniform vec3  u_color_lose;    // color principal derrota

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

vec3 renderCelebrationArea(vec2 localUV, float aspect, float t, bool isWin) {
    vec2 p = (localUV - vec2(0.5)) * vec2(aspect, 1.0);
    float r = length(p);
    float a = atan(p.y, p.x);

    vec3 colPrimary   = isWin ? u_color_win : u_color_lose;
    vec3 colSecondary = isWin ? vec3(1.00, 0.52, 0.10) : vec3(0.62, 0.04, 0.34);
    vec3 colCore      = isWin ? vec3(1.00, 0.97, 0.84) : vec3(1.00, 0.68, 0.74);

    vec3 acc = vec3(0.0);
    float spd = 0.4 + u_velocidad * 1.4;

    // 1. Círculos de choque concéntricos con ondulación armónica y dispersión RGB
    for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float cycle = 2.4;
        float localT = mod(t * spd + fi * (cycle / 7.0), cycle);
        float prog = localT / cycle;

        float rad = (1.0 - pow(1.0 - prog, 2.2)) * 0.92;
        float fade = (1.0 - prog) * smoothstep(0.0, 0.12, prog);

        float petals = isWin ? 12.0 : 8.0;
        float wobble = sin(a * petals + t * 3.5 + fi * 1.3) * 0.008 * prog;
        float distRing = abs(r - (rad + wobble));

        float thickness = mix(0.016, 0.004, prog);
        float sharpRing = smoothstep(thickness, 0.0, distRing);
        float glowRing  = exp(-distRing * (26.0 + fi * 2.0)) * 0.65;

        float ringR = smoothstep(thickness * 1.2, 0.0, abs(r - (rad + wobble + 0.006)));
        float ringB = smoothstep(thickness * 1.2, 0.0, abs(r - (rad + wobble - 0.006)));

        vec3 ringCol = mix(colPrimary, colSecondary, prog);
        ringCol += colCore * sharpRing * 0.85;
        ringCol.r += ringR * 0.35;
        ringCol.b += ringB * 0.25;

        acc += ringCol * (sharpRing * 1.2 + glowRing) * fade * (0.4 + u_anillos * 1.1);
    }

    // 2. Rayos radiales giratorios
    float ray1 = sin(a * 16.0 + t * 1.8) * 0.5 + 0.5;
    float ray2 = sin(a * 24.0 - t * 2.4) * 0.5 + 0.5;
    float rays = pow(ray1 * ray2, 3.0) * exp(-r * 2.3) * smoothstep(0.02, 0.22, r);
    acc += mix(colPrimary, colCore, 0.5) * rays * (0.3 + u_rayos * 1.1);

    // 3. Núcleo pulsante
    float corePulse = 0.14 + 0.02 * sin(t * 6.0);
    float innerHalo = exp(-r * 3.8) * (0.45 + 0.15 * sin(t * 4.5));
    float innerRing = smoothstep(0.012, 0.0, abs(r - corePulse)) * 0.85;
    acc += colPrimary * innerHalo + colCore * innerRing;

    // 4. Chispas orbitales
    for (int j = 0; j < 18; j++) {
        float fj = float(j);
        float seed = hash21(vec2(fj, fj * 1.37));
        float pCycle = 1.8 + seed * 1.2;
        float pt = mod(t * spd + seed * 3.0, pCycle) / pCycle;
        float pAng = fj * 2.399963 + t * (0.3 + seed * 0.4) * ((mod(fj, 2.0) < 0.5) ? 1.0 : -1.0);
        float pRad = pt * (0.55 + seed * 0.35);
        vec2  pPos = vec2(cos(pAng), sin(pAng)) * pRad;
        float dP = length(p - pPos);
        float spark = exp(-dP * 75.0) * (1.0 - pt) * smoothstep(0.0, 0.15, pt);
        acc += mix(colCore, colPrimary, seed) * spark * (0.4 + u_chispas * 1.5);
    }

    // Fondo profundo de bodega oscura
    vec3 bg = mix(vec3(0.06, 0.01, 0.04), colSecondary * 0.15, exp(-r * 1.8));
    return bg + (1.0 - exp(-acc * 1.35));
}

void main() {
    vec2 uv = gl_FragCoord.xy / max(resolution, vec2(1.0));
    float aspect = resolution.x / max(resolution.y, 1.0);

    vec3 col;
    if (u_split) {
        if (uv.x < 0.5) {
            col = renderCelebrationArea(vec2(uv.x * 2.0, uv.y), aspect * 0.5, time, true);
        } else {
            col = renderCelebrationArea(vec2((uv.x - 0.5) * 2.0, uv.y), aspect * 0.5, time, false);
        }
        float line = exp(-abs(uv.x - 0.5) * 220.0);
        col = mix(col, vec3(1.0, 0.9, 0.6), line);
    } else {
        col = renderCelebrationArea(uv, aspect, time, u_victoria);
    }

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

// ============================================================================
// 3. vinogame-clasico (El shader original de 2 pases de VinoGame porteado)
// ============================================================================
const vinogameClasicoBuffer0 = `// ============================================================================
//  VINOGAME · CLÁSICO · FEEDBACK (Buffer A)
//  ---------------------------------------------------------------------------
//  Port directo del shader feedback.frag original de VinoGame a JP Shader Editor.
//  Acumula el rastro cromático de cursores/LIDAR, ondas expansivas doradas y
//  ruido fractal (FBM) de combo.
// ============================================================================

uniform vec4  pointers[16];
uniform int   pointersCount;
uniform vec4  lidarPointers[30];
uniform int   lidarPointersCount;

uniform float u_cursorHaloSize;
uniform float u_cursorHaloStrength;
uniform float u_comboLevel;
uniform float u_waveSpeed;
uniform float u_waveForce;

float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vec2 res = max(resolution, vec2(1.0));
    vec2 uv = gl_FragCoord.xy / res;
    float aspect = res.x / res.y;
    vec2 aspectUV = vec2(uv.x * aspect, uv.y);

    vec4 previousFrame = texture2D(iChannel0, uv);
    vec4 finalColor = previousFrame * 0.92;

    float radius = max(0.02, u_cursorHaloSize);

    // Mouse
    vec2 mousePos = vec2((mouse.x / res.x) * aspect, mouse.y / res.y);
    float distM = distance(aspectUV, mousePos);
    float infM = smoothstep(radius, 0.0, distM);
    if (infM > 0.0) {
        vec3 tint = vec3(
            0.5 + 0.5 * sin(time * 0.5 + distM * 10.0),
            0.5 + 0.5 * sin(time * 0.7 + distM * 10.0 + 2.0),
            0.5 + 0.5 * sin(time * 0.3 + distM * 10.0 + 4.0)
        );
        float centerGlow = smoothstep(0.05, 0.0, distM);
        finalColor.rgb += tint * centerGlow * 2.5 * u_cursorHaloStrength;
        finalColor.a = max(finalColor.a, centerGlow);
    }

    // Punteros / LIDAR
    for (int i = 0; i < 30; i++) {
        if (i >= lidarPointersCount) break;
        vec2 pPos = vec2((lidarPointers[i].x / res.x) * aspect, 1.0 - (lidarPointers[i].y / res.y));
        float dP = distance(aspectUV, pPos);
        float centerGlowP = smoothstep(0.05, 0.0, dP);
        if (centerGlowP > 0.0) {
            vec3 ptTint = vec3(
                0.5 + 0.5 * sin(time * 0.5 + dP * 10.0),
                0.5 + 0.5 * sin(time * 0.7 + dP * 10.0 + 2.0),
                0.5 + 0.5 * sin(time * 0.3 + dP * 10.0 + 4.0)
            );
            finalColor.rgb += ptTint * centerGlowP * 2.5 * u_cursorHaloStrength;
            finalColor.a = max(finalColor.a, centerGlowP);
        }
    }

    // Ondas expansivas periódicas
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float wTime = mod(time + fi * 0.85, 2.4);
        vec2 wPos = vec2((0.3 + 0.2 * fi) * aspect, 0.5 + 0.15 * sin(time * 0.5 + fi));
        float wDist = distance(aspectUV, wPos);
        float wRadius = wTime * u_waveSpeed;
        float wInt = smoothstep(2.4, 0.0, wTime);
        float ring = smoothstep(0.04, 0.0, abs(wDist - wRadius));
        vec3 waveColor = vec3(1.0, 0.85, 0.3);
        finalColor.rgb += waveColor * ring * wInt * (0.35 * u_waveForce);
        finalColor.a = max(finalColor.a, ring * wInt * 0.2);
    }

    // Ruido FBM de combo
    float safeCombo = clamp(u_comboLevel, 0.0, 1.0);
    if (safeCombo > 0.05) {
        float n1 = fbm(uv * 2.5 + vec2(time * 0.15, time * 0.12));
        float n2 = fbm(uv * 4.0 - vec2(time * 0.20, time * 0.18));
        float combined = (n1 + n2 * 0.5) / 1.5;
        vec3 glowColor = mix(vec3(0.6, 0.3, 1.0), vec3(1.0, 0.8, 0.2), safeCombo);
        finalColor.rgb += glowColor * combined * safeCombo * 0.08;
        finalColor.a = max(finalColor.a, safeCombo * 0.15);
    }

    gl_FragColor = clamp(finalColor, 0.0, 1.0);
}
`;

const vinogameClasicoMain = `// ============================================================================
//  VINOGAME · CLÁSICO · COMPOSITE (Output)
//  ---------------------------------------------------------------------------
//  Port directo del shader composite.frag original de VinoGame a JP Shader Editor.
//  Combina distorsión por ondas expansivas, atracción gravitacional de uvas,
//  aberración cromática, ondas sinusoidales y halos configurables.
// ============================================================================

uniform float u_waveSpeed;
uniform float u_waveForce;
uniform float u_goodHaloSize;
uniform float u_goodHaloStrength;
uniform vec3  u_goodHaloColor;
uniform float u_badHaloSize;
uniform float u_badHaloStrength;
uniform vec3  u_badHaloColor;
uniform float u_backgroundBrightness;
uniform bool  u_splitLineEnabled;

float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec3 fondoVinoProcedural(vec2 uv) {
    vec3 top = vec3(0.95, 0.62, 0.22);
    vec3 mid = vec3(0.52, 0.16, 0.28);
    vec3 bot = vec3(0.18, 0.28, 0.08);
    vec3 sky = mix(mid, top, smoothstep(0.45, 1.0, uv.y));
    float rows = sin((uv.x - 0.5) / max(0.8 - uv.y * 0.6, 0.15) * 40.0) * 0.5 + 0.5;
    vec3 field = mix(bot, vec3(0.48, 0.58, 0.12), rows * (1.0 - uv.y));
    return mix(field, sky, smoothstep(0.42, 0.55, uv.y));
}

void main() {
    vec2 res = max(resolution, vec2(1.0));
    vec2 uv = gl_FragCoord.xy / res;
    float aspect = res.x / res.y;
    vec2 aspectUV = vec2(uv.x * aspect, uv.y);

    vec2 displacement = vec2(0.0);
    float chromaticAberration = 0.0;

    // 1. Ondas expansivas
    for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float wTime = mod(time + fi * 0.85, 2.4);
        vec2 wavePos = vec2((0.3 + 0.2 * fi) * aspect, 0.5 + 0.15 * sin(time * 0.5 + fi));
        float waveDist = distance(aspectUV, wavePos);
        float waveRadius = wTime * u_waveSpeed;
        float waveIntensity = smoothstep(2.4, 0.0, wTime);
        float distortionStrength = smoothstep(0.15, 0.0, abs(waveDist - waveRadius)) * waveIntensity;
        vec2 direction = normalize(aspectUV - wavePos + vec2(0.0001));
        displacement += direction * distortionStrength * 0.09 * u_waveForce;
        chromaticAberration += distortionStrength * waveIntensity * u_waveForce;
    }

    // 2. Distorsión gravitacional por uvas cayendo
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float y = 1.1 - mod(time * (0.18 + 0.03 * fi) + fi * 0.37, 1.2);
        float x = (0.15 + 0.14 * fi + 0.04 * sin(time + fi)) * aspect;
        vec2 grapePos = vec2(x, y);
        float grapeDist = distance(aspectUV, grapePos);
        float gravityForce = (1.0 / (1.0 + grapeDist * grapeDist * 20.0)) * smoothstep(0.20, 0.0, grapeDist);
        vec2 direction = normalize(grapePos - aspectUV + vec2(0.0001));
        displacement += direction * gravityForce * 0.015;
        chromaticAberration += gravityForce * 0.5;
    }

    displacement.x /= aspect;

    // 3. Ondas sinusoidales
    float sineWave1 = sin(uv.x * 25.0 + time * 0.2) * 0.002;
    float sineWave2 = sin(uv.y * 20.0 - time * 0.8) * 0.002;
    displacement += vec2(sineWave2, sineWave1);

    vec2 finalUV = clamp(uv + displacement, 0.001, 0.999);
    float aberr = chromaticAberration * 0.008;

    vec3 bgCol = texture2D(iChannel1, finalUV).rgb;
    if (dot(bgCol, vec3(1.0)) < 0.01) {
        vec3 rC = fondoVinoProcedural(finalUV + vec2(aberr, 0.0));
        vec3 gC = fondoVinoProcedural(finalUV);
        vec3 bC = fondoVinoProcedural(finalUV - vec2(aberr, 0.0));
        bgCol = vec3(rC.r, gC.g, bC.b);
    }

    float wave1 = sin(uv.x * 25.0 + time * 0.2) * 0.5 + 0.5;
    float wave2 = sin(uv.y * 20.0 - time * 0.8) * 0.5 + 0.5;
    float wave3 = sin((uv.x + uv.y) * 5.0 + time * 0.5) * 0.5 + 0.5;
    float wave4 = sin((uv.x - uv.y) * 10.0 - time * 0.7) * 0.5 + 0.5;
    float wavePattern = (wave1 + wave2 + wave3 + wave4) / 4.0;

    vec3 finalColor = bgCol * 0.35 + bgCol * vec3(wavePattern) * 0.45;

    // Halos dorados y rojos
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float y = 1.1 - mod(time * (0.18 + 0.03 * fi) + fi * 0.37, 1.2);
        float x = (0.15 + 0.14 * fi + 0.04 * sin(time + fi)) * aspect;
        float d = distance(aspectUV, vec2(x, y));
        if (i < 4) {
            float halo = smoothstep(u_goodHaloSize, 0.02, d);
            finalColor += u_goodHaloColor * halo * u_goodHaloStrength;
        } else {
            float haloB = smoothstep(u_badHaloSize, 0.03, d);
            finalColor += u_badHaloColor * haloB * u_badHaloStrength;
        }
    }

    if (u_splitLineEnabled) {
        float dx = abs(finalUV.x - 0.5);
        float mask = 1.0 - smoothstep(0.002, 0.005, dx);
        finalColor = mix(finalColor, vec3(1.0), clamp(mask, 0.0, 1.0));
    }

    vec4 feedbackColor = texture2D(iChannel0, uv);
    finalColor += feedbackColor.rgb * 0.45;

    finalColor = clamp(finalColor * u_backgroundBrightness, 0.0, 1.0);
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

// ============================================================================
// 4. vinogame-medidor (Port del shader medidor.frag de la copa de combo)
// ============================================================================
const vinogameMedidorCode = `// ============================================================================
//  VINOGAME · MEDIDOR DE COMBO (Copa de Vino con Ondas Violetas/Tinto)
//  ---------------------------------------------------------------------------
//  Port del shader medidor.frag de VinoGame a JP Shader Editor.
//  Renderiza una copa de vino cuyo nivel de llenado (u_fillLevel) sube con
//  ondas sinusoidales, burbujas ascendentes y brillo especular en el cristal.
// ============================================================================

uniform float u_fillLevel;     // 0..1 nivel de llenado del combo
uniform bool  u_auto_fill;     // animar llenado automáticamente en el editor
uniform float u_ola_fuerza;    // 0..1 amplitud de las olas del vino
uniform vec3  u_vino_color;    // color del vino dentro de la copa

void main() {
    vec2 res = max(resolution, vec2(1.0));
    vec2 uv = gl_FragCoord.xy / res;
    float aspect = res.x / res.y;

    // Coordenadas centradas para silueta de copa de vino
    vec2 p = (uv - vec2(0.5, 0.5)) * vec2(aspect, 1.0) * 2.2;

    // Silueta procedural de la copa de vino (cáliz + tallo + base)
    float bowlY = clamp((p.y + 0.15) / 0.85, 0.0, 1.0);
    float bowlWidth = sin(bowlY * 2.35 + 0.25) * 0.48 * smoothstep(0.0, 0.12, bowlY);
    float inBowl = smoothstep(0.02, -0.01, abs(p.x) - bowlWidth) * step(-0.15, p.y) * step(p.y, 0.70);

    float stemWidth = 0.032 + 0.015 * pow(clamp((-0.15 - p.y) / 0.55, 0.0, 1.0), 2.0);
    float inStem = smoothstep(0.015, -0.005, abs(p.x) - stemWidth) * step(-0.70, p.y) * step(p.y, -0.14);

    float baseWidth = 0.34 * smoothstep(-0.78, -0.70, p.y);
    float inBase = smoothstep(0.015, -0.005, abs(p.x) - baseWidth) * step(-0.76, p.y) * step(p.y, -0.68);

    float glassSil = clamp(inBowl + inStem + inBase, 0.0, 1.0);
    float rim = smoothstep(0.035, 0.0, abs(abs(p.x) - bowlWidth)) * step(-0.15, p.y) * step(p.y, 0.70);

    // Nivel de llenado dentro del cáliz (-0.12 a 0.62)
    float fill = u_auto_fill ? (0.5 + 0.42 * sin(time * 0.85)) : clamp(u_fillLevel, 0.0, 1.0);
    float surfaceY = mix(-0.10, 0.60, fill);

    // Ondas sinusoidales de medidor.frag
    float waveAmp = (0.015 + u_ola_fuerza * 0.035);
    float waveX1 = sin(uv.x * 22.0 + time * 2.1) * waveAmp;
    float waveX2 = sin(uv.x * 35.0 - time * 1.4) * (waveAmp * 0.75);
    float waveY  = sin(uv.y * 14.0 + time * 1.8) * (waveAmp * 0.5);
    float liquidTop = surfaceY + waveX1 + waveX2 + waveY;

    float insideLiquid = inBowl * smoothstep(liquidTop + 0.015, liquidTop - 0.015, p.y);

    // Variación de brillo con ondas ascendentes (medidor.frag)
    float rising = sin(uv.y * 28.0 - time * 2.6) * 0.5 + 0.5;
    vec3 wineAnimated = u_vino_color * (0.68 + rising * 0.38);

    // Menisco brillante en la superficie del vino
    float surfaceGlow = smoothstep(0.03, 0.0, abs(p.y - liquidTop)) * inBowl;
    wineAnimated += vec3(1.0, 0.75, 0.92) * surfaceGlow * 0.75;

    // Fondo oscuro elegante
    vec3 bg = mix(vec3(0.05, 0.01, 0.04), vec3(0.14, 0.03, 0.10), 1.0 - length(uv - 0.5));

    // Cristal especular + vino
    float highlightLeft = smoothstep(0.04, 0.0, abs(p.x + bowlWidth * 0.72)) * inBowl * 0.55;
    vec3 glassCol = vec3(0.85, 0.90, 1.0) * (glassSil * 0.12 + rim * 0.65 + highlightLeft);

    vec3 col = bg + glassCol;
    col = mix(col, wineAnimated + glassCol * 0.8, insideLiquid);

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const shadersToPort = [
    {
        nombre: 'vinogame-agua',
        autor: 'jpupper',
        contenido: vinogameAguaMain,
        passCounter: 1,
        passesData: {
            main: {
                name: 'Output',
                code: vinogameAguaMain,
                connections: ['buffer0', 'texture0', 'texture1', 'none']
            },
            buffer0: {
                name: 'Campo',
                code: vinogameAguaBuffer0,
                connections: ['self', 'none', 'none', 'none']
            }
        },
        uniforms: {
            u_fondo_img: 0,
            u_sim_objetos: 1,
            u_mostrar_puntos: 1,
            u_split_line: 0,
            u_lidar_sim: 1,
            u_blend_fondo: 0.0,
            u_refraccion: 0.38,
            u_relieve: 0.52,
            u_profundidad: 0.50,
            u_especular: 0.62,
            u_brillo: 0.70,
            u_causticas: 0.52,
            u_espuma: 0.58,
            u_good_halo: 0.45,
            u_bad_halo: 0.40,
            u_radio: 0.42,
            u_speed: 0.55,
            u_fuerza: 0.75,
            u_empuje: 0.85,
            u_lidar_fuerza: 0.80,
            u_objetos_fuerza: 0.80,
            u_paso: 0.35,
            u_oleaje: 0.38,
            u_amortiguar: 0.82,
            u_foco: [0.55, 0.74],
            u_agua: [0.96, 0.95, 1.0],
            u_good_color: [1.0, 0.84, 0.15],
            u_bad_color: [1.0, 0.18, 0.22]
        },
        uniformFormats: {
            u_fondo_img: 'switch',
            u_sim_objetos: 'switch',
            u_mostrar_puntos: 'switch',
            u_split_line: 'switch',
            u_lidar_sim: 'switch',
            u_foco: 'pad',
            u_agua: 'color',
            u_good_color: 'color',
            u_bad_color: 'color'
        },
        imageUrls: {}
    },
    {
        nombre: 'vinogame-celebracion',
        autor: 'jpupper',
        contenido: vinogameCelebracionCode,
        passCounter: 0,
        passesData: {
            main: {
                name: 'Output',
                code: vinogameCelebracionCode,
                connections: ['none', 'none', 'none', 'none']
            }
        },
        uniforms: {
            u_victoria: 1,
            u_split: 0,
            u_velocidad: 0.55,
            u_anillos: 0.75,
            u_rayos: 0.65,
            u_chispas: 0.70,
            u_color_win: [1.0, 0.84, 0.22],
            u_color_lose: [1.0, 0.18, 0.28]
        },
        uniformFormats: {
            u_victoria: 'switch',
            u_split: 'switch',
            u_color_win: 'color',
            u_color_lose: 'color'
        },
        imageUrls: {}
    },
    {
        nombre: 'vinogame-clasico',
        autor: 'jpupper',
        contenido: vinogameClasicoMain,
        passCounter: 1,
        passesData: {
            main: {
                name: 'Output',
                code: vinogameClasicoMain,
                connections: ['buffer0', 'texture0', 'none', 'none']
            },
            buffer0: {
                name: 'Feedback',
                code: vinogameClasicoBuffer0,
                connections: ['self', 'none', 'none', 'none']
            }
        },
        uniforms: {
            u_cursorHaloSize: 0.08,
            u_cursorHaloStrength: 1.0,
            u_comboLevel: 0.45,
            u_waveSpeed: 0.5,
            u_waveForce: 0.45,
            u_goodHaloSize: 0.12,
            u_goodHaloStrength: 0.45,
            u_goodHaloColor: [1.0, 0.84, 0.0],
            u_badHaloSize: 0.14,
            u_badHaloStrength: 0.35,
            u_badHaloColor: [1.0, 0.15, 0.15],
            u_backgroundBrightness: 1.2,
            u_splitLineEnabled: 0
        },
        uniformFormats: {
            u_splitLineEnabled: 'switch',
            u_goodHaloColor: 'color',
            u_badHaloColor: 'color'
        },
        imageUrls: {}
    },
    {
        nombre: 'vinogame-medidor',
        autor: 'jpupper',
        contenido: vinogameMedidorCode,
        passCounter: 0,
        passesData: {
            main: {
                name: 'Output',
                code: vinogameMedidorCode,
                connections: ['none', 'none', 'none', 'none']
            }
        },
        uniforms: {
            u_fillLevel: 0.65,
            u_auto_fill: 1,
            u_ola_fuerza: 0.5,
            u_vino_color: [0.68, 0.16, 0.82]
        },
        uniformFormats: {
            u_auto_fill: 'switch',
            u_vino_color: 'color'
        },
        imageUrls: {}
    }
];

async function run() {
    const outDir = __dirname;
    for (const sh of shadersToPort) {
        // Guardar JSON local de respaldo en el repositorio
        const filePath = path.join(outDir, `${sh.nombre}.json`);
        fs.writeFileSync(filePath, JSON.stringify(sh, null, 2), 'utf8');
        console.log(`Guardado local: ${filePath}`);

        // Subir a jpshadereditor en el VPS
        const res = await fetch(VPS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sh)
        });
        const data = await res.json();
        console.log(`POST ${sh.nombre} -> status ${res.status}:`, data);

        // Verificar que el plan de render resuelve sin errores
        const planRes = await fetch(PLAN_API + encodeURIComponent(sh.nombre));
        const planData = await planRes.json();
        console.log(`PLAN ${sh.nombre} -> ok: ${planData.ok}, passes: ${(planData.passes || []).map(p => p.id).join(', ')}`);
        console.log(`URL: https://fullscreencode.com/jpshadereditor/shader.html?shader=${sh.nombre}\n`);
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
