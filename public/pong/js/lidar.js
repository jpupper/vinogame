/* ============================================================
   PONG VENDIMIA · Puente con el sistema LIDAR  (v1.0)
   ------------------------------------------------------------
   Igual que en Bodega Buster: fuera de /Games/ no hace nada, y
   dentro del sistema engancha la entrada por puntos (blobs) y los
   parámetros del inspector del Grid Sequencer.
   ============================================================ */
(function () {
    'use strict';

    if (!/\/Games\//i.test(window.location.pathname)) return;

    var GAME_ID = 'pongdw';
    var GAME_PATH = './pongdw/';
    var GAME_NAME = 'Deli & Wine · Pong Vendimia';

    var SCHEMA = [
        {
            id: 'tab_juego', title: 'Juego', icon: '🏓', controls: [
                { type: 'slider', key: 'velocidad', label: 'Velocidad del corcho', min: 0.5, max: 2, step: 0.05, default: 1, unit: 'x' },
                { type: 'slider', key: 'paleta', label: 'Largo de la botella', min: 0.6, max: 1.8, step: 0.05, default: 1, unit: 'x' },
                { type: 'slider', key: 'vidas', label: 'Vidas (cooperativo)', min: 1, max: 5, step: 1, default: 3 }
            ]
        },
        {
            id: 'tab_modo', title: 'Modo', icon: '👥', controls: [
                {
                    type: 'select', key: 'modo', label: 'Formato', default: 'coop', options: [
                        { value: 'coop', label: 'Cooperativo (sostener el rally)' },
                        { value: 'duelo', label: 'Duelo (1 vs 1)' }
                    ]
                },
                { type: 'slider', key: 'objetivo', label: 'Puntos para ganar el duelo', min: 3, max: 15, step: 1, default: 7 }
            ]
        },
        {
            id: 'tab_impactos', title: 'Impactos', icon: '✦', controls: [
                { type: 'slider', key: 'brillo', label: 'Brillo del golpe', min: 0, max: 2, step: 0.05, default: 0.55 },
                { type: 'slider', key: 'apertura', label: 'Apertura de la onda', min: 0.2, max: 1.6, step: 0.02, default: 0.6 },
                { type: 'slider', key: 'rayos', label: 'Rayos', min: 0, max: 2, step: 0.05, default: 0.55 },
                { type: 'slider', key: 'duracion', label: 'Duración', min: 0.3, max: 2, step: 0.05, default: 0.85, unit: 's' },
                { type: 'slider', key: 'fuerza', label: 'Fuerza / tamaño', min: 0.2, max: 2, step: 0.05, default: 1 }
            ]
        }
    ];

    function cargar(src, cb) {
        var s = document.createElement('script');
        s.src = src;
        s.async = false;
        s.onload = function () { if (cb) cb(); };
        s.onerror = function () { console.warn('[PongVendimia] No se pudo cargar ' + src); };
        document.head.appendChild(s);
    }

    function entrada() {
        if (!window.LidarPointer || typeof window.LidarPointer.start !== 'function') {
            console.warn('[PongVendimia] Falta lidar-pointer.js: el juego queda sólo con mouse.');
            return;
        }
        window.LidarInput = window.LidarPointer.start({
            mode: 'pointer',
            targetSelector: '#escena',
            startSelector: '#btnJugar',
            startScreenSelector: '#pantallaInicio',
            autoStart: true
        });
    }

    var CLAVES_IMPACTO = ['brillo', 'apertura', 'rayos', 'duracion', 'fuerza'];

    function getValues() {
        var v = window.PongDW.valores();
        if (window.Impactos) {
            var imp = window.Impactos.params();
            for (var i = 0; i < CLAVES_IMPACTO.length; i++) {
                v[CLAVES_IMPACTO[i]] = imp[CLAVES_IMPACTO[i]];
            }
        }
        return v;
    }

    function setValue(key, value) {
        if (CLAVES_IMPACTO.indexOf(key) >= 0) {
            if (window.Impactos) {
                var o = {};
                o[key] = value;
                window.Impactos.params(o);
            }
        } else {
            window.PongDW.aplicar(key, value);
        }
    }

    function puente() {
        if (!window.GameGridBridge || !window.PongDW) return false;
        var bridge = window.GameGridBridge.create({
            gameId: GAME_ID,
            gamePath: GAME_PATH,
            gameName: GAME_NAME,
            schema: SCHEMA,
            getValues: getValues,
            setValue: setValue
        });
        window.PongGrid = bridge;
        bridge.load();
        return true;
    }

    function arrancar() {
        entrada();
        var intentos = 0;
        var t = setInterval(function () {
            intentos++;
            if (puente() || intentos > 150) clearInterval(t);
        }, 100);
    }

    cargar('../lidar-pointer.js', function () {
        cargar('../game-grid-bridge.js', arrancar);
        cargar('../back-button.js');   // casita 🏠 cuando se abre con ?back=true
    });
})();
