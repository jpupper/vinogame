/* ============================================================
   SERVE WINE · Adaptador para el Grid Sequencer (LIDAR)
   ------------------------------------------------------------
   Publica los MISMOS parámetros que el panel de ajustes del juego
   (tecla P) para que el inspector del Grid Sequencer los lea, los
   mueva en vivo y los guarde en Games/servewine/config.json.

   El panel (`js/panel.js`) expone todo por `window.PanelCfg`:
     campos()  → la lista de sliders con min/max/paso
     valores() → los valores actuales
     aplicar() → aplica una clave
     emitir()  → avisa un cambio local al inspector
   ============================================================ */
(function () {
    'use strict';

    var GAME_ID = 'servewine';
    var GAME_PATH = './servewine/';
    var GAME_NAME = 'Deli & Wine · Serve Wine';

    var ORDEN = ['BOTELLA', 'VINO', 'JUEGO', 'FONDO'];
    var TITULOS = {
        BOTELLA: { title: 'Botella', icon: '🍾' },
        VINO: { title: 'Vino', icon: '🍷' },
        JUEGO: { title: 'Juego', icon: '⚙️' },
        FONDO: { title: 'Fondo', icon: '🌅' }
    };

    function P() { return window.PanelCfg; }

    function buildSchema() {
        var panel = P();
        var campos = panel && panel.campos ? panel.campos() : [];
        var valores = panel && panel.valores ? panel.valores() : {};

        var grupos = {};
        campos.forEach(function (c) {
            var def = (typeof valores[c.k] === 'number') ? valores[c.k] : c.min;
            (grupos[c.sec] = grupos[c.sec] || []).push({
                type: 'slider',
                key: c.k,
                label: c.etq,
                min: c.min,
                max: c.max,
                step: c.paso,
                default: def,
                unit: c.unidad || ''
            });
        });

        // La botella va primera y con el switch de inclinar ADENTRO de la interfaz
        var tabBotella = {
            id: 'tab_botella', title: TITULOS.BOTELLA.title, icon: TITULOS.BOTELLA.icon, controls: [
                {
                    type: 'toggle',
                    key: 'inclinarbotella',
                    label: 'Inclinar botella a 45°',
                    default: (valores.inclinarbotella === undefined) ? true : !!valores.inclinarbotella
                },
                {
                    type: 'toggle',
                    key: 'ySeguirPunto',
                    label: 'Y según el punto (apagado = Y fija + offset)',
                    default: (valores.ySeguirPunto === undefined) ? false : !!valores.ySeguirPunto
                }
            ]
        };

        var tabs = [tabBotella];
        ORDEN.forEach(function (sec) {
            if (sec === 'BOTELLA' || !grupos[sec]) return;
            tabs.push({
                id: 'tab_' + sec.toLowerCase(),
                title: TITULOS[sec].title,
                icon: TITULOS[sec].icon,
                controls: grupos[sec]
            });
        });
        return tabs;
    }

    function getValues() {
        var panel = P();
        if (!panel || !panel.valores) return {};
        var v = panel.valores();
        if (window.VinoGame && window.VinoGame.estado) v.evento = window.VinoGame.estado.evento;
        return v;
    }

    function applyValue(key, value) {
        var panel = P();
        if (!panel || !panel.aplicar) return;
        panel.aplicar(key, value);
    }

    var bridge = window.GameGridBridge.create({
        gameId: GAME_ID,
        gamePath: GAME_PATH,
        gameName: GAME_NAME,
        schema: buildSchema(),
        getValues: getValues,
        setValue: applyValue
    });

    // El juego arranca después (imágenes + física): esperamos a VinoGame/FondoAgua
    // y recién ahí aplicamos config.json, que manda sobre el localStorage.
    var tries = 0;
    var timer = setInterval(function () {
        tries++;
        if (window.VinoGame && window.FondoAgua) {
            clearInterval(timer);
            bridge.load();
        } else if (tries > 150) {
            clearInterval(timer);
            bridge.load();
        }
    }, 100);

    window.DeliGrid = bridge;
})();
