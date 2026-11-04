/* ============================================================
   BODEGA BUSTER · Puente con el sistema LIDAR  (v1.0)
   ------------------------------------------------------------
   Este archivo se copia tal cual en los dos destinos:

     · fullscreencode.com / vinogame  →  NO hace nada (el juego es
       una página más de la galería).
     · LIDAR (Games/bodegabuster/)    →  engancha el juego al
       sistema: entrada por puntos (blobs) + parámetros en el
       inspector del Grid Sequencer.

   Se detecta por la ruta: dentro del repo LIDAR la página siempre
   vive bajo /Games/, en el sitio no.
   ============================================================ */
(function () {
    'use strict';

    if (!/\/Games\//i.test(window.location.pathname)) return;

    var GAME_ID = 'bodegabuster';
    var GAME_PATH = './bodegabuster/';
    var GAME_NAME = 'Deli & Wine · Bodega Buster';

    var SCHEMA = [
        {
            id: 'tab_juego', title: 'Juego', icon: '🧱', controls: [
                { type: 'slider', key: 'velocidad', label: 'Velocidad de la bola', min: 0.4, max: 2, step: 0.05, default: 1, unit: 'x' },
                { type: 'slider', key: 'paleta', label: 'Tamaño de la barra', min: 0.5, max: 2, step: 0.05, default: 1, unit: 'x' },
                { type: 'slider', key: 'filas', label: 'Filas de cajas', min: 3, max: 9, step: 1, default: 5 },
                { type: 'slider', key: 'vidas', label: 'Vidas', min: 1, max: 5, step: 1, default: 3 }
            ]
        },
        {
            id: 'tab_modo', title: 'Modo', icon: '👥', controls: [
                {
                    type: 'select', key: 'modo', label: 'Jugadores', default: 1, options: [
                        { value: 1, label: '1 jugador' },
                        { value: 2, label: '2 jugadores (canchas divididas)' }
                    ]
                }
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
        s.onerror = function () { console.warn('[BodegaBuster] No se pudo cargar ' + src); };
        document.head.appendChild(s);
    }

    function entrada() {
        if (!window.LidarPointer || typeof window.LidarPointer.start !== 'function') {
            console.warn('[BodegaBuster] Falta lidar-pointer.js: el juego queda sólo con mouse.');
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
        var v = window.Buster.valores();
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
            window.Buster.aplicar(key, value);
        }
    }

    function puente() {
        if (!window.GameGridBridge || !window.Buster) return false;
        var bridge = window.GameGridBridge.create({
            gameId: GAME_ID,
            gamePath: GAME_PATH,
            gameName: GAME_NAME,
            schema: SCHEMA,
            getValues: getValues,
            setValue: setValue
        });
        window.BusterGrid = bridge;
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
