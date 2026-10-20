/**
 * Port y subida de shaders a JP Shader Editor (https://fullscreencode.com/jpshadereditor)
 * siguiendo el protocolo oficial de https://fullscreencode.com/jpconnect/documentacion/#jpshader
 *
 * Shaders incluidos:
 *  1. solo-agua             (Shader multibuffer SOLO DE AGUA: sin dibujos incrustados, sin piso de baldosas, sin puntos automáticos)
 *  2. vinogame-agua         (Shader multibuffer de agua para VinoGame: sutil, sin dibujos incrustados ni simulación automática)
 *  3. vinogame-celebracion  (Círculos explosivos y ondas de choque para Felicitaciones / Seguí participando)
 *  4. vinogame-medidor      (Medidor de combo dentro de copa de vino con ondas suaves)
 */

const fs = require('fs');
const path = require('path');

const VPS_BASE = 'https://vps-4455523-x.dattaweb.com';
const LOGIN_API = `${VPS_BASE}/jpconnect/api/auth/login`;
const VERIFY_API = `${VPS_BASE}/jpconnect/api/auth/verify`;
const CREATE_SHADER_API = `${VPS_BASE}/jpshadereditor/api/create-shader`;
const SHADERS_API = `${VPS_BASE}/jpshadereditor/api/shaders`;
const PLAN_API = `${VPS_BASE}/jpshadereditor/api/include/plan?shader=`;

// ============================================================================
// SHADER SOLO DE AGUA (Buffer A + Output)
// Sin dibujos incrustados, sin piso de losetas, sin texture0 por defecto,
// sin puntos moviéndose automáticamente (puntoFantasma removido) y con
// propagación de fluido sutil y orgánica.
// ============================================================================
const soloAguaBuffer0 = `// ============================================================================
//  SOLO AGUA · CAMPO (Buffer A)
//  ---------------------------------------------------------------------------
//  Simulación pura de superficie de agua (ecuación de onda 2D discreta + CFL):
//    .x = altura actual (0.5 = reposo)
//    .y = altura anterior (t - 1)
//    .z = energía de espuma (decae suavemente)
//    .w = 1.0
//
//  · Sin puntos automáticos (no hay puntoFantasma ni barrido autónomo).
//  · Propagación sutil y controlada: sólo responde a mouse, pointers y lidarPointers.
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
uniform float u_radio;         // 0..1 radio de inyección
uniform float u_paso;          // 0..1 separación de vecinos (STEP)
uniform float u_oleaje;        // 0..1 velocidad de onda c^2
uniform float u_amortiguar;    // 0..1 amortiguación k (MODIFIER)

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

void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 res  = max(resolution, vec2(1.0));
    vec2 p    = frag / res;

    vec4 c = texture2D(iChannel0, p);
    if (!(c.x == c.x)) c.x = 0.5;
    if (!(c.y == c.y)) c.y = 0.5;
    if (!(c.z == c.z)) c.z = 0.0;

    // Cuatro vecinos para el laplaciano
    float paso = 0.7 + clamp(u_paso, 0.0, 1.0) * 1.8;
    vec2  e    = vec2(paso) / res;
    float s1 = sCampo(p - vec2(0.0, e.y));
    float s2 = sCampo(p - vec2(e.x, 0.0));
    float s3 = sCampo(p + vec2(e.x, 0.0));
    float s4 = sCampo(p + vec2(0.0, e.y));

    // Amortiguación más contenida para que el fluido sea sutil y no sature la pantalla
    float k    = 0.86 + clamp(u_amortiguar, 0.0, 1.0) * 0.11;
    float perd = 1.0 - k;
    float rPx  = 2.0 + clamp(u_radio, 0.0, 1.0) * 10.0;
    float iny  = 0.0;
    float energia = 0.0;

    // 1. MOUSE (sólo cuando se presiona / interactúa)
    float sinPunteros = 1.0 - step(0.5, float(pointersCount));
    if (mouse.z > 0.0001 && sinPunteros > 0.5) {
        float w = smoothstep(rPx, rPx * 0.15, length(frag - mouse.xy));
        iny += u_fuerza * 0.28 * perd * w;
        energia = max(energia, w * u_fuerza * 0.75);
    }

    // 2. DEDOS / PUNTEROS MULTIUSUARIO
    for (int i = 0; i < 12; i++) {
        if (i >= pointersCount) break;
        vec2 pa = pointers[i].xy;
        vec2 pb = pointers[i].zw;
        float wA = smoothstep(rPx, rPx * 0.15, length(frag - pa));
        float wS = smoothstep(rPx * 1.4, 0.0, sdSeg(frag, pb, pa)) * 0.45;
        iny += u_empuje * 0.26 * perd * (wA + wS);
        energia = max(energia, max(wA, wS) * u_empuje * 0.7);
    }

    // 3. PUNTOS SIMULADOS DEL PANEL (sólo si el usuario los activa en el editor)
    for (int i = 0; i < 64; i++) {
        if (i >= simulatedPointersCount) break;
        vec2 pa = vec2(simulatedPointers[i].x, res.y - simulatedPointers[i].y);
        vec2 pb = vec2(simulatedPointers[i].z, res.y - simulatedPointers[i].w);
        float wA = smoothstep(rPx, rPx * 0.15, length(frag - pa));
        float wS = smoothstep(rPx * 1.4, 0.0, sdSeg(frag, pb, pa)) * 0.45;
        iny += u_empuje * 0.24 * perd * (wA + wS);
        energia = max(energia, max(wA, wS) * u_empuje * 0.65);
    }

    // 4. LIDAR (sólo puntos reales del sensor, sin barrido automático)
    for (int i = 0; i < 30; i++) {
        if (i >= lidarPointersCount) break;
        vec2 pa = vec2(lidarPointers[i].x, res.y - lidarPointers[i].y);
        vec2 pb = vec2(lidarPointers[i].z, res.y - lidarPointers[i].w);
        float wA = smoothstep(rPx, rPx * 0.15, length(frag - pa));
        float wS = smoothstep(rPx * 1.5, 0.0, sdSeg(frag, pb, pa)) * 0.48;
        iny += u_lidar_fuerza * 0.28 * perd * (wA + wS);
        energia = max(energia, max(wA, wS) * u_lidar_fuerza * 0.75);
    }

    // Ecuación de onda discreta (laplaciano de 4 vecinos + condición CFL)
    float a1  = c.x - 0.5;
    float a0  = c.y - 0.5;
    float lap = (s1 + s2 + s3 + s4) - 4.0 * c.x;
    float c2  = 0.04 + clamp(u_oleaje, 0.0, 1.0) * 0.26;
    float a   = (2.0 * a1 - a0 + c2 * lap) * k;
    a += iny;
    a *= smoothstep(0.9, 1.0, float(iFrame >= 10));
    if (!(a == a)) a = 0.0;
    a  = clamp(a, -0.45, 0.45);

    float en = clamp(max(c.z * 0.91, energia), 0.0, 1.2);
    gl_FragColor = vec4(a + 0.5, c.x, en, 1.0);
}
`;

const soloAguaMain = `// ============================================================================
//  SOLO AGUA · SALIDA (Output)
//  ---------------------------------------------------------------------------
//  Superficie líquida 100% pura:
//   · SIN dibujo incrustado (sin baldosas/losetas, sin grillas, sin objetos).
//   · SIN puntos automáticos girando.
//   · Sólo la física óptica del agua: normal 3D por gradiente espacial del
//     Buffer A (iChannel0), rizado capilar suave, cáusticas orgánicas,
//     iluminación especular Blinn-Phong + Fresnel y espuma sutil en las ondas.
//   · Si se conecta una textura opcional en iChannel1 y se activa u_fondo_img,
//     refracta esa textura limpiamente con el agua.
// ============================================================================

uniform bool  u_fondo_img;     // false = sólo agua pura · true = refractar iChannel1
uniform float u_refraccion;    // 0..1 fuerza de refracción
uniform float u_relieve;       // 0..1 pendiente de la normal 3D
uniform float u_profundidad;   // 0..1 componente z de la normal
uniform float u_especular;     // 0..1 dureza del brillo especular
uniform float u_brillo;        // 0..1 intensidad especular / Fresnel
uniform float u_causticas;     // 0..1 intensidad de cáusticas del agua
uniform float u_espuma;        // 0..1 espuma sutil donde hubo empuje
uniform vec2  u_foco;          // posición de la fuente de luz
uniform vec3  u_agua;          // color de la superficie del agua
uniform vec3  u_profundo;      // color del agua profunda

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

float causticas(vec2 q, float t) {
    float v = 0.0;
    float a = 1.0;
    vec2  w = q;
    for (int i = 0; i < 3; i++) {
        v += a * (1.0 - abs(ruido(w * (1.7 + float(i))) * 2.0 - 1.0));
        a *= 0.55;
        w = w * 2.03 + vec2(t * 0.04, -t * 0.03);
    }
    return pow(clamp(v, 0.0, 1.0), 5.0);
}

void main() {
    vec2  frag    = gl_FragCoord.xy;
    vec2  res     = max(resolution, vec2(1.0));
    vec2  uv      = frag / res;
    vec2  texel   = 1.0 / res;
    float aspecto = res.x / res.y;

    // 1. Leer el campo de alturas del Buffer A (iChannel0)
    vec4 campo = texture2D(iChannel0, uv);
    vec2 tc = campo.xy;
    if (!(tc.x == tc.x)) tc.x = 0.5;
    if (!(tc.y == tc.y)) tc.y = 0.5;
    float energia = clamp(campo.z, 0.0, 1.2);
    if (!(energia == energia)) energia = 0.0;

    float h   = tc.x - 0.5;
    float vel = tc.x - tc.y;
    if (!(h == h)) h = 0.0;
    if (!(vel == vel)) vel = 0.0;

    // 2. Normal 3D por gradiente espacial de los 4 vecinos + rizado capilar suave
    vec2 tx = vec2(texel.x, 0.0);
    vec2 ty = vec2(0.0, texel.y);
    vec4 mL = texture2D(iChannel0, clamp(uv - tx, vec2(0.0), vec2(1.0)));
    vec4 mR = texture2D(iChannel0, clamp(uv + tx, vec2(0.0), vec2(1.0)));
    vec4 mD = texture2D(iChannel0, clamp(uv - ty, vec2(0.0), vec2(1.0)));
    vec4 mU = texture2D(iChannel0, clamp(uv + ty, vec2(0.0), vec2(1.0)));
    vec2 grad = vec2(mR.x - mL.x, mU.x - mD.x) * 0.5;

    // Rizado capilar orgánico muy sutil (sin dibujos ni grillas)
    vec2 rp = vec2(uv.x * aspecto, uv.y) * 14.0;
    vec2 rizo = vec2(
        ruido(rp + vec2(time * 0.18, -time * 0.14)) - 0.5,
        ruido(rp + vec2(-time * 0.15, time * 0.16) + 7.3) - 0.5
    ) * 0.012;

    vec2 pend = (grad * vec2(aspecto, 1.0) * (24.0 + u_relieve * 120.0)) + rizo;
    vec3 n    = normalize(vec3(-pend, 0.35 + u_profundidad * 1.65));

    // 3. Desplazamiento de refracción sutil
    vec2 off = (tc - vec2(0.5)) * (0.08 + u_refraccion * 0.55) + grad * (0.12 + u_refraccion * 0.45);
    vec2 quv = clamp(uv + off, vec2(0.001), vec2(0.999));

    // 4. Cuerpo de agua pura (o refracción de iChannel1 si el usuario activa u_fondo_img)
    vec3 col;
    if (u_fondo_img) {
        vec3 tex = texture2D(iChannel1, quv).rgb;
        col = tex * u_agua;
    } else {
        float prof = clamp(0.5 + h * 1.6 + (quv.y - 0.5) * 0.25, 0.0, 1.0);
        col = mix(u_profundo, u_agua, prof);
    }

    // 5. Cáusticas suaves deformadas por la superficie
    float cau = causticas((uv + off * 1.4) * vec2(aspecto, 1.0) * 2.1, time * 0.45);
    col += cau * u_causticas * 0.85 * mix(u_agua, vec3(0.82, 0.96, 1.0), 0.55)
         * (0.25 + 0.75 * clamp(abs(h) * 5.0 + energia * 0.4, 0.0, 1.0));

    // 6. Espuma sutil donde hubo perturbación
    float espN = ruido(vec2(uv.x * aspecto, uv.y) * 75.0 + vec2(time * 0.25, -time * 0.22) + vel * 20.0);
    float esp  = smoothstep(0.35, 0.95, energia)
               * smoothstep(0.48, 0.95, espN * 0.5 + energia * 0.65);
    col += esp * u_espuma * vec3(0.94, 0.98, 1.0) * 0.45;

    // 7. Especular Blinn-Phong + Fresnel
    vec3  L    = normalize(vec3((u_foco - uv) * vec2(aspecto, 1.0), 0.6));
    vec3  Hv   = normalize(L + vec3(0.0, 0.0, 1.0));
    float nh   = max(dot(n, Hv), 0.0);
    float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);
    col += (pow(nh, 16.0 + u_especular * 320.0) * u_brillo * 1.35
          + pow(nh, 8.0) * u_brillo * 0.08) * vec3(1.0, 0.99, 0.96);
    col += fres * u_brillo * 0.28 * mix(u_agua, vec3(0.86, 0.97, 1.0), 0.5);

    // 8. Cierre suave sin viñeta agresiva
    col *= 1.0 - 0.28 * length(uv - 0.5);
    col  = 1.0 - exp(-col * 1.15);
    col += (hash12(frag + fract(time) * 137.0) - 0.5) * 0.008;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const soloAguaShaderDef = {
    nombre: 'solo-agua',
    autor: 'jpupper',
    contenido: soloAguaMain,
    passCounter: 1,
    passesData: {
        main: {
            name: 'Output',
            code: soloAguaMain,
            connections: ['buffer0', 'none', 'none', 'none']
        },
        buffer0: {
            name: 'Campo',
            code: soloAguaBuffer0,
            connections: ['self', 'none', 'none', 'none']
        }
    },
    uniforms: {
        u_fondo_img: 0,
        u_refraccion: 0.28,
        u_relieve: 0.42,
        u_profundidad: 0.55,
        u_especular: 0.62,
        u_brillo: 0.55,
        u_causticas: 0.32,
        u_espuma: 0.35,
        u_radio: 0.32,
        u_fuerza: 0.55,
        u_empuje: 0.60,
        u_lidar_fuerza: 0.60,
        u_paso: 0.30,
        u_oleaje: 0.28,
        u_amortiguar: 0.55,
        u_foco: [0.58, 0.72],
        u_agua: [0.22, 0.58, 0.78],
        u_profundo: [0.04, 0.18, 0.30]
    },
    uniformFormats: {
        u_fondo_img: 'switch',
        u_foco: 'pad',
        u_agua: 'color',
        u_profundo: 'color'
    },
    imageUrls: {}
};

const vinogameAguaShaderDef = {
    ...soloAguaShaderDef,
    nombre: 'vinogame-agua'
};

async function run() {
    const email = process.env.JP_USER || 'jpupper';
    const password = process.env.JP_PASS;
    if (!password) {
        throw new Error('Definir JP_PASS en el entorno para autenticar contra /jpconnect/api/auth/login');
    }

    // Paso 1: Login en JPCONNECT según https://fullscreencode.com/jpconnect/documentacion/#jpshader
    const loginRes = await fetch(LOGIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (!loginRes.ok) {
        throw new Error(`Login falló con HTTP ${loginRes.status}`);
    }
    const { token, user } = await loginRes.json();
    console.log(`Login OK -> usuario: ${user.username}`);

    // Paso 2: Verificar token
    const verifyRes = await fetch(VERIFY_API, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const verifyData = await verifyRes.json();
    console.log(`Verify OK -> loggedIn: ${verifyData.loggedIn}`);

    const outDir = __dirname;
    for (const sh of [soloAguaShaderDef, vinogameAguaShaderDef]) {
        const filePath = path.join(outDir, `${sh.nombre}.json`);
        fs.writeFileSync(filePath, JSON.stringify(sh, null, 2), 'utf8');
        console.log(`Guardado local: ${filePath}`);

        // Paso 3: Publicar shader con Bearer token
        const res = await fetch(SHADERS_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                ...sh,
                autor: user.username
            })
        });
        const data = await res.json();
        console.log(`POST ${sh.nombre} -> status ${res.status}:`, data);

        // Paso 4: Confirmar con /include/plan
        const planRes = await fetch(PLAN_API + encodeURIComponent(sh.nombre));
        const planData = await planRes.json();
        console.log(`PLAN ${sh.nombre} -> ok: ${planData.ok}, autor: ${planData.autor}, passes: ${(planData.passes || []).map(p => p.id).join(', ')}`);
        console.log(`URL: https://fullscreencode.com/jpshadereditor/shader.html?shader=${sh.nombre}\n`);
    }
}

if (require.main === module) {
    run().catch(err => {
        console.error(err);
        process.exit(1);
    });
}
