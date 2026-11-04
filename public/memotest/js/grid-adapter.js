/* ============================================================
   MEMOTEST DE BODEGA · Adaptador para el Grid Sequencer (LIDAR)
   ------------------------------------------------------------
   Publica la dificultad y el encuadre del tablero para que el
   inspector del Grid Sequencer los lea, los mueva en vivo y los
   guarde en Games/memotest/config.json.

   El juego expone `window.Memotest.valores()` y `.aplicar(k, v)`;
   los cambios que se hacen en el panel del juego (tecla P) salen
   por `window.DeliGrid.emit(...)`.
   ============================================================ */
(function () {
    'use strict';

    var GAME_ID = 'memotest';
    var GAME_PATH = './memotest/';
    var GAME_NAME = 'Deli & Wine · Memotest';

    var SCHEMA = [
        {
            id: 'tab_juego', title: 'Juego', icon: '⚙️', controls: [
                { type: 'slider', key: 'pares', label: 'Pares (dificultad)', min: 4, max: 10, step: 2, default: 6 },
                { type: 'slider', key: 'tiempoMax', label: 'Tiempo de partida', min: 20, max: 180, step: 5, default: 60, unit: 's' }
            ]
        },
        {
            id: 'tab_tablero', title: 'Tablero', icon: '🃏', controls: [
                { type: 'slider', key: 'escala', label: 'Tamaño de las cartas', min: 0.5, max: 1.6, step: 0.01, default: 1, unit: 'x' },
                { type: 'slider', key: 'offsetX', label: 'Desplazamiento X', min: -300, max: 300, step: 1, default: 0, unit: 'px' },
                { type: 'slider', key: 'offsetY', label: 'Desplazamiento Y', min: -300, max: 300, step: 1, default: 0, unit: 'px' }
            ]
        }
    ];

    function getValues() {
        return (window.Memotest && window.Memotest.valores) ? window.Memotest.valores() : {};
    }

    function applyValue(key, value) {
        if (window.Memotest && window.Memotest.aplicar) window.Memotest.aplicar(key, value);
    }

    var bridge = window.GameGridBridge.create({
        gameId: GAME_ID,
        gamePath: GAME_PATH,
        gameName: GAME_NAME,
        schema: SCHEMA,
        getValues: getValues,
        setValue: applyValue
    });

    // El juego arranca después de cargar las botellas: esperamos su API.
    var tries = 0;
    var timer = setInterval(function () {
        tries++;
        if (window.Memotest && window.Memotest.valores) {
            clearInterval(timer);
            bridge.load();
        } else if (tries > 150) {
            clearInterval(timer);
            bridge.load();
        }
    }, 100);

    window.DeliGrid = bridge;
})();
