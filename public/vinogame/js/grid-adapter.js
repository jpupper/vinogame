/* ============================================================
   DELI & WINE · Adaptador para el Grid Sequencer (LIDAR)
   ------------------------------------------------------------
   Deja el juego indexado como el resto de las apps del sistema:
     · publica su esquema de parámetros (los mismos del panel de la tecla P)
     · escucha `game_param_change` / `game_param_batch` del inspector
     · avisa los cambios hechos en el panel propio (eco al inspector)
     · carga/guarda en Games/<juego>/config.json
   No dibuja UI propia: usa el panel que ya tiene el juego.
   ============================================================ */
(function () {
    'use strict';

    var GAME_ID = 'vinogame';
    var GAME_PATH = './vinogame/';
    var GAME_NAME = 'Deli & Wine · Remastered';

    // Cada parámetro: selector del control en el panel + método del ControlPanel
    // que lo aplica (los mismos que se disparan al mover el slider a mano).
    var WIRING = {
        fallSpeed: { sel: '#fallSpeedSlider', cp: 'updateGameFallSpeed', type: 'number' },
        lives: { sel: '#livesSlider', cp: 'updateGameLives', type: 'int' },
        objectSize: { sel: '#objectSizeSlider', cp: 'updateObjectSize', type: 'int' },
        spawnRate: { sel: '#spawnRateSlider', cp: 'updateSpawnRate', type: 'int' },
        hoverTime: { sel: '#hoverTimeSlider', cp: 'updateHoverTime', type: 'int' },
        winComboThreshold: { sel: '#winComboSlider', cp: 'updateWinComboThreshold', type: 'int' },
        maxGoodItems: { sel: '#maxGoodItemsInput', cp: 'updateMaxGoodItems', type: 'int' },
        maxBadItems: { sel: '#maxBadItemsInput', cp: 'updateMaxBadItems', type: 'int' },
        particleLifespan: { sel: '#particleLifespanSlider', cp: 'updateParticleLifespan', type: 'int' },
        spawnMode: { sel: '#spawnModeSelect', cp: 'updateSpawnMode', type: 'select' },
        goodHaloSize: { sel: '#goodHaloSizeSlider', cp: 'updateHaloSettings', type: 'float' },
        goodHaloStrength: { sel: '#goodHaloStrengthSlider', cp: 'updateHaloSettings', type: 'float' },
        goodHaloColor: { sel: '#goodHaloColorInput', cp: 'updateHaloSettings', type: 'color' },
        badHaloSize: { sel: '#badHaloSizeSlider', cp: 'updateHaloSettings', type: 'float' },
        badHaloStrength: { sel: '#badHaloStrengthSlider', cp: 'updateHaloSettings', type: 'float' },
        badHaloColor: { sel: '#badHaloColorInput', cp: 'updateHaloSettings', type: 'color' },
        cursorHaloSize: { sel: '#cursorHaloSizeSlider', cp: 'updateCursorHaloSize', type: 'float' },
        cursorHaloStrength: { sel: '#cursorHaloStrengthSlider', cp: 'updateCursorHaloStrength', type: 'float' },
        backgroundBrightness: { sel: '#backgroundBrightnessSlider', cp: 'updateBackgroundBrightness', type: 'float' },
        waveSpeed: { sel: '#waveSpeedSlider', cp: 'updateWaveSpeed', type: 'float' },
        waveForce: { sel: '#waveForceSlider', cp: 'updateWaveForce', type: 'float' },
        waveDuration: { sel: '#waveDurationSlider', cp: 'updateWaveDuration', type: 'float' },
        winLoseTextSize: { sel: '#winLoseTextSizeSlider', cp: 'updateWinLoseTextSize', type: 'float' },
        scoreTextSize: { sel: '#scoreTextSizeSlider', cp: 'updateScoreTextSize', type: 'int' },
        comboTextSize: { sel: '#comboTextSizeSlider', cp: 'updateComboTextSize', type: 'int' },
        // --- agua / shader (los maneja window.setWaterParam) ---
        oleaje: { sel: '#waterOleajeSlider', water: 'oleaje', type: 'float' },
        fuerza: { sel: '#waterPointerForceSlider', water: 'fuerza', type: 'float' },
        amortiguar: { sel: '#waterAmortiguarSlider', water: 'amortiguar', type: 'float' },
        paso: { sel: '#waterPasoSlider', water: 'paso', type: 'float' },
        refraccion: { sel: '#waterRefraccionSlider', water: 'refraccion', type: 'float' },
        relieve: { sel: '#waterRelieveSlider', water: 'relieve', type: 'float' },
        profundidad: { sel: '#waterProfundidadSlider', water: 'profundidad', type: 'float' },
        espuma: { sel: '#waterEspumaSlider', water: 'espuma', type: 'float' },
        brillo: { sel: '#waterBrilloSlider', water: 'brillo', type: 'float' },
        especular: { sel: '#waterEspecularSlider', water: 'especular', type: 'float' },
        radio: { sel: '#waterPointerRadiusSlider', water: 'radio', type: 'float' },
        aguaColorHex: { sel: '#waterColorInput', water: 'aguaColorHex', type: 'color' },
        especularColorHex: { sel: '#waterSpecularColorInput', water: 'especularColorHex', type: 'color' },

        showLidarPoints: { sel: '#showLidarPointsCheckbox', type: 'bool' },
        hideBackground: { sel: '#hideBackgroundCheckbox', type: 'bool' },
        showCooperativeButton: { sel: '#showCooperativeButton', cp: 'updateButtonVisibility', type: 'bool' },
        showCompetitiveButton: { sel: '#showCompetitiveButton', cp: 'updateButtonVisibility', type: 'bool' }
    };

    var SCHEMA = [
        {
            id: 'tab_juego', title: 'Juego', icon: '⚙️', controls: [
                { type: 'slider', key: 'fallSpeed', label: 'Velocidad de caída', min: 0.5, max: 12, step: 0.1, default: 2.25, unit: 'x' },
                { type: 'slider', key: 'lives', label: 'Vidas', min: 1, max: 10, step: 1, default: 3 },
                { type: 'slider', key: 'objectSize', label: 'Tamaño de objetos', min: 50, max: 260, step: 5, default: 100, unit: 'px' },
                { type: 'slider', key: 'spawnRate', label: 'Frecuencia de aparición', min: 400, max: 5000, step: 100, default: 2000, unit: 'ms' },
                { type: 'slider', key: 'hoverTime', label: 'Tiempo de agarre', min: 50, max: 3000, step: 50, default: 1000, unit: 'ms' },
                { type: 'slider', key: 'particleLifespan', label: 'Vida de los objetos', min: 1000, max: 30000, step: 500, default: 6000, unit: 'ms' },
                { type: 'slider', key: 'winComboThreshold', label: 'Combo para ganar', min: 5, max: 50, step: 1, default: 20 },
                { type: 'slider', key: 'maxGoodItems', label: 'Máx. objetos buenos', min: 1, max: 30, step: 1, default: 10 },
                { type: 'slider', key: 'maxBadItems', label: 'Máx. objetos malos', min: 1, max: 30, step: 1, default: 5 },
                {
                    type: 'select', key: 'spawnMode', label: 'Aparición de copas', default: 'top', options: [
                        { value: 'top', label: 'Desde arriba' },
                        { value: 'random', label: 'Aleatoria' }
                    ]
                }
            ]
        },
        {
            id: 'tab_halos', title: 'Halos', icon: '✨', controls: [
                { type: 'section', title: 'Objetos buenos' },
                { type: 'slider', key: 'goodHaloSize', label: 'Tamaño', min: 0.02, max: 0.4, step: 0.01, default: 0.12 },
                { type: 'slider', key: 'goodHaloStrength', label: 'Fuerza', min: 0, max: 1, step: 0.01, default: 0.35 },
                { type: 'color', key: 'goodHaloColor', label: 'Color', default: '#ffd700' },
                { type: 'section', title: 'Objetos malos' },
                { type: 'slider', key: 'badHaloSize', label: 'Tamaño', min: 0.02, max: 0.4, step: 0.01, default: 0.14 },
                { type: 'slider', key: 'badHaloStrength', label: 'Fuerza', min: 0, max: 1, step: 0.01, default: 0.27 },
                { type: 'color', key: 'badHaloColor', label: 'Color', default: '#ff0000' },
                { type: 'section', title: 'Cursor / LIDAR' },
                { type: 'slider', key: 'cursorHaloSize', label: 'Tamaño del cursor', min: 0.02, max: 0.4, step: 0.01, default: 0.08 },
                { type: 'slider', key: 'cursorHaloStrength', label: 'Fuerza del cursor', min: 0, max: 2, step: 0.05, default: 1 }
            ]
        },
        {
            id: 'tab_fondo', title: 'Fondo / Agua', icon: '🌊', controls: [
                { type: 'slider', key: 'backgroundBrightness', label: 'Brillo del fondo', min: 0, max: 2, step: 0.1, default: 1 },
                { type: 'slider', key: 'waveSpeed', label: 'Velocidad de las ondas', min: 0.1, max: 2, step: 0.1, default: 0.5 },
                { type: 'slider', key: 'waveForce', label: 'Fuerza de distorsión', min: 0, max: 1, step: 0.01, default: 0.09 },
                { type: 'slider', key: 'waveDuration', label: 'Duración de la onda', min: 0.5, max: 8, step: 0.5, default: 2, unit: 's' },
                { type: 'toggle', key: 'hideBackground', label: 'Ocultar fondo (shader)', default: false }
            ]
        },
        {
            id: 'tab_agua', title: 'Agua (shader)', icon: '💧', controls: [
                { type: 'slider', key: 'oleaje', label: 'Oleaje', min: 0, max: 1.5, step: 0.01, default: 0.42 },
                { type: 'slider', key: 'fuerza', label: 'Fuerza del puntero', min: 0, max: 2, step: 0.01, default: 0.95 },
                { type: 'slider', key: 'radio', label: 'Radio del puntero', min: 0.05, max: 1.5, step: 0.01, default: 0.52 },
                { type: 'slider', key: 'amortiguar', label: 'Amortiguación', min: 0, max: 1, step: 0.01, default: 0.64 },
                { type: 'slider', key: 'paso', label: 'Paso de simulación', min: 0.05, max: 1, step: 0.01, default: 0.38 },
                { type: 'slider', key: 'refraccion', label: 'Refracción', min: 0, max: 1, step: 0.01, default: 0.48 },
                { type: 'slider', key: 'relieve', label: 'Relieve', min: 0, max: 1, step: 0.01, default: 0.58 },
                { type: 'slider', key: 'profundidad', label: 'Profundidad', min: 0, max: 1, step: 0.01, default: 0.48 },
                { type: 'slider', key: 'espuma', label: 'Espuma', min: 0, max: 1, step: 0.01, default: 0.45 },
                { type: 'slider', key: 'brillo', label: 'Brillo', min: 0, max: 2, step: 0.01, default: 0.62 },
                { type: 'slider', key: 'especular', label: 'Especular', min: 0, max: 2, step: 0.01, default: 0.58 },
                { type: 'color', key: 'aguaColorHex', label: 'Color del agua', default: '#f5f2ff' },
                { type: 'color', key: 'especularColorHex', label: 'Color de la luz especular', default: '#fffaf0' }
            ]
        },
        {
            id: 'tab_winlose', title: 'Win / Lose', icon: '🏆', controls: [
                { type: 'slider', key: 'winLoseTextSize', label: 'Tamaño del cartel', min: 0.01, max: 0.3, step: 0.005, default: 0.15 },
                { type: 'slider', key: 'scoreTextSize', label: 'Tamaño del puntaje', min: 10, max: 80, step: 1, default: 40 },
                { type: 'slider', key: 'comboTextSize', label: 'Tamaño del combo', min: 10, max: 80, step: 1, default: 30 }
            ]
        },
        {
            id: 'tab_lidar', title: 'LIDAR', icon: '📡', controls: [
                { type: 'toggle', key: 'showLidarPoints', label: 'Mostrar puntos del LIDAR', default: false },
                { type: 'toggle', key: 'showCooperativeButton', label: 'Botón Cooperativo', default: true },
                { type: 'toggle', key: 'showCompetitiveButton', label: 'Botón Competir', default: true }
            ]
        }
    ];

    var remote = false;      // true mientras aplicamos un valor venido del grid
    var listenersReady = false;

    // Estos parámetros viven en `window.*` y el panel los carga ahí sin tocar el
    // slider (loadShaderSettingsFromConfig / loadHaloSettingsFromConfig). Para no
    // publicar el default del HTML en vez del valor real, se leen del global.
    var LIVE = {
        goodHaloSize: 'goodHaloSize', goodHaloStrength: 'goodHaloStrength', goodHaloColor: 'goodHaloColor',
        badHaloSize: 'badHaloSize', badHaloStrength: 'badHaloStrength', badHaloColor: 'badHaloColor',
        cursorHaloSize: 'cursorHaloSize', cursorHaloStrength: 'cursorHaloStrength',
        backgroundBrightness: 'backgroundBrightness', waveSpeed: 'waveSpeed',
        waveForce: 'waveForce', waveDuration: 'waveDuration',
        showLidarPoints: 'showLidarPoints', hideBackground: 'hideBackground',
        showCooperativeButton: 'showCooperativeButton', showCompetitiveButton: 'showCompetitiveButton'
    };

    function el(key) {
        var w = WIRING[key];
        return w && w.sel ? document.querySelector(w.sel) : null;
    }

    function readValue(key) {
        var w = WIRING[key];
        var node = el(key);
        if (!w) return null;

        // parámetros del agua: la fuente de verdad es window.waterShaderParams
        if (w.water && window.waterShaderParams) {
            var wv = window.waterShaderParams[w.water];
            if (w.type === 'color') {
                if (typeof wv === 'string' && wv.charAt(0) === '#') return wv;
            } else if (typeof wv === 'number' && isFinite(wv)) {
                return wv;
            }
        }

        var live = LIVE[key] ? window[LIVE[key]] : undefined;
        if (live !== undefined && live !== null) {
            if (w.type === 'bool') return !!live;
            if (w.type === 'color') {
                if (typeof live === 'string' && live.charAt(0) === '#') return live;
            } else if (typeof live === 'number' && isFinite(live)) {
                return live;
            }
        }

        if (!node) return null;
        if (w.type === 'bool') return !!node.checked;
        if (w.type === 'color' || w.type === 'select') return node.value;
        var n = parseFloat(node.value);
        return isNaN(n) ? null : n;
    }

    function applyValue(key, value) {
        var real = key;
        var w = WIRING[real];
        var node = el(real);
        if (!w || !node) return;

        if (w.type === 'bool') node.checked = !!value;
        else {
            // El panel tiene máximos viejos (p.ej. fallSpeed 5 con 9.2 guardado):
            // si el valor del sistema lo supera, estiramos el rango para no perderlo.
            if (node.type === 'range') {
                var num = parseFloat(value);
                if (!isNaN(num) && num > parseFloat(node.max)) node.max = num;
            }
            node.value = value;
        }

        // agua: se aplica por la API del shader y se refleja en el slider del panel
        if (w.water && typeof window.setWaterParam === 'function') {
            var wval = (w.type === 'color') ? String(value) : parseFloat(value);
            try { window.setWaterParam(w.water, wval); } catch (e) { }
        }

        // El panel escucha 'input' (sliders) y 'change' (checkbox/select): al
        // despachar el evento se actualizan las etiquetas y se aplica al juego.
        remote = true;
        try {
            node.dispatchEvent(new Event('input', { bubbles: true }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) { }
        remote = false;

        // Respaldo: el panel de este juego escucha TODOS estos controles (verificado),
        // así que alcanza con el evento. Solo setea el global si el panel no lo hace.
        if (real === 'showLidarPoints') window.showLidarPoints = !!value;
        if (real === 'hideBackground') window.hideBackground = !!value;
        if (LIVE[real]) {
            try { window[LIVE[real]] = (w.type === 'bool') ? !!value : value; } catch (e) { }
        }
    }

    function getValues() {
        var out = {};
        for (var key in WIRING) {
            if (!Object.prototype.hasOwnProperty.call(WIRING, key)) continue;
            var v = readValue(key);
            if (v !== null) out[key] = v;
        }
        return out;
    }

    function hookLocalChanges() {
        if (listenersReady) return;
        listenersReady = true;
        for (var key in WIRING) {
            if (!Object.prototype.hasOwnProperty.call(WIRING, key)) continue;
            (function (k) {
                var node = el(k);
                if (!node) return;
                var evt = (WIRING[k].type === 'bool' || WIRING[k].type === 'select') ? 'change' : 'input';
                node.addEventListener(evt, function () {
                    if (remote) return;           // lo aplicó el grid: no re-emitir (evita el loop)
                    var v = readValue(k);
                    if (v !== null) bridge.emit(k, v);
                });
            })(key);
        }
    }

    var bridge = window.GameGridBridge.create({
        gameId: GAME_ID,
        gamePath: GAME_PATH,
        gameName: GAME_NAME,
        schema: SCHEMA,
        getValues: getValues,
        setValue: applyValue
    });

    // El panel carga panel-config.json de forma asíncrona: esperamos a que tenga
    // su configuración y recién ahí aplicamos config.json (que manda).
    var tries = 0;
    var timer = setInterval(function () {
        tries++;
        var cp = window.controlPanel;
        if (cp && cp.configData) {
            clearInterval(timer);
            hookLocalChanges();
            setTimeout(function () { bridge.load(); }, 250);
        } else if (tries > 150) {
            clearInterval(timer);
            hookLocalChanges();
            bridge.load();
        }
    }, 100);

    // Botón Guardar del panel (💾) → config.json del sistema además del panel-config
    window.addEventListener('load', function () {
        var btn = document.getElementById('saveChangesBtn');
        if (btn) {
            btn.addEventListener('click', function () {
                setTimeout(function () {
                    bridge.save().catch(function () { });
                }, 400);
            });
        }
    });

    // API de consola para depurar
    window.DeliGrid = bridge;
})();
