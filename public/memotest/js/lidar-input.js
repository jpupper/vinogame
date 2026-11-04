/* ============================================================
   MEMOTEST DE BODEGA · Entrada LIDAR (pisar para dar vuelta)
   ------------------------------------------------------------
   El juego sólo entiende `click` sobre las cartas. Este módulo escucha
   los blobs del LIDAR y, cuando un jugador se queda quieto sobre una
   carta (o un botón de las pantallas) ~320 ms, le despacha el click.

   Al aparecer el primer jugador arranca la partida (click en JUGAR,
   que hasta que cargan las botellas está deshabilitado: se reintenta).

   Sin sensor también sirve para probar: `LidarInput.simulate(1, .5, .6)`
   o los blobs simulados de POINTVIZ.
   ============================================================ */
(function () {
    'use strict';

    function arrancar() {
        if (!window.LidarPointer || typeof window.LidarPointer.start !== 'function') {
            console.warn('[Memotest] Falta la librería compartida lidar-pointer.js');
            return;
        }
        window.LidarInput = window.LidarPointer.start({
            mode: 'dwell',
            dwellMs: 950,          // tiempo apuntando una carta = dar vuelta
            grabRadius: 150,        // si el punto cae en el hueco, agarra la carta mas cercana
            buttonDwellMs: 1400,    // los botones piden un poco más (evita clicks al pasar)
            clickSelector: '.carta, .pantalla.visible button, [data-lidar-click]',
            startSelector: '#btnJugar',
            startScreenSelector: '#pantallaInicio',
            autoStart: true,
            showPoints: true
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
    else arrancar();
})();
