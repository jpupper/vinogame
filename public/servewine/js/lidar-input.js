/* ============================================================
   SERVE WINE · Entrada LIDAR (una botella por jugador)
   ------------------------------------------------------------
   El juego sólo entiende punteros (mouse/touch). Este módulo escucha
   los blobs que reparte el server del LIDAR y los convierte en un
   `pointerdown` + `pointermove` por jugador sobre el canvas: cada
   blob abre su propia botella y la mueve con el cuerpo.

   Al aparecer el primer jugador arranca la partida (click en JUGAR),
   y en la pantalla final se puede "pisar" el botón para volver a jugar.

   Sin sensor también sirve para probar: `LidarInput.simulate(1, .5, .8)`
   o los blobs simulados de POINTVIZ.
   ============================================================ */
(function () {
    'use strict';

    function arrancar() {
        if (!window.LidarPointer || typeof window.LidarPointer.start !== 'function') {
            console.warn('[ServeWine] Falta la librería compartida lidar-pointer.js');
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

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
    else arrancar();
})();
