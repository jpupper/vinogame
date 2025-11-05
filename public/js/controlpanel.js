// Panel de Control - Funcionalidad
class ControlPanel {
    constructor() {
        this.isVisible = false;
        this.panel = null;
        this.hint = null;
        this.fallSpeedSlider = null;
        this.livesSlider = null;
        this.fallSpeedValue = null;
        this.livesValue = null;
        this.particleLifespanSlider = null;
        this.particleLifespanValue = null;
        this.configData = null;
        // Visualización de puntos LIDAR
        this.showLidarPointsCheckbox = null;
        // Mostrar/Ocultar fondo
        this.hideBackgroundCheckbox = null;
        // Mostrar/Ocultar botones de modo de juego
        this.showCooperativeButton = null;
        this.showCompetitiveButton = null;
        // Controles del tab winlose
        this.winLoseTextSizeSlider = null;
        this.winLoseTextSizeValue = null;
        this.winTextInput = null;
        this.loseTextInput = null;
        this.winComboSliderWinLose = null;
        this.winComboValueWinLose = null;
        this.livesSliderWinLose = null;
        this.livesValueWinLose = null;
        this.scoreTextSizeSlider = null;
        this.scoreTextSizeValue = null;
        this.comboTextSizeSlider = null;
        this.comboTextSizeValue = null;
        
        // Elementos de métricas
        this.frameCount = 0;
        this.fps = 60;
        // STATS tab metrics
        this.statsFpsCounter = null;
        this.statsFallingObjectsCount = null;
        this.statsPointsCount = null;
        
        // Elementos de pestañas
        this.tabButtons = null;
        this.tabContents = null;
        this.currentTab = 'controls';
        
        // Elementos de assets
        this.backgroundUpload = null;
        this.objectUpload = null;
        this.badItemUpload = null;
        this.customAssets = {
            backgrounds: [],
            objects: [],
            badItems: []
        };
        
        // Tracking de assets custom en los arrays del juego
        this.customAssetTracking = {
            objects: [],      // [{name, p5ImageRef, arrayIndex}]
            badItems: [],     // [{name, p5ImageRef, arrayIndex}]
            backgrounds: []   // [{name, p5ImageRef, arrayIndex}]
        };
        
        // Elementos de galería
        this.galleryNavButtons = null;
        this.gallerySections = null;
        this.currentGalleryCategory = 'all';
        this.currentAssets = {
            objects: [],
            badItems: [],
            backgrounds: []
        };
        
        // Elementos de guardar cambios
        this.saveChangesBtn = null;
        this.saveStatus = null;
        
        // Valores por defecto
        this.defaultFallSpeed = 2.25;
        this.defaultLives = 3;
        
        this.init();
        this.loadConfiguration();
    }
    
    // Funciones para manejar configuración JSON
    async loadConfiguration() {
        this.configData = await this.loadConfigFromFile();
        this.applyConfiguration();
        // Asegurar valor inicial del modo de aparición de copas
        try {
            const modeFromConfig = (this.configData && this.configData.wineGlasses && this.configData.wineGlasses.spawnMode)
                ? this.configData.wineGlasses.spawnMode
                : (typeof CONFIG !== 'undefined' && CONFIG.wineGlasses && CONFIG.wineGlasses.spawnMode
                    ? CONFIG.wineGlasses.spawnMode
                    : 'top');
            const normalizedMode = (modeFromConfig === 'random') ? 'random' : 'top';
            if (this.spawnModeSelect) {
                this.spawnModeSelect.value = normalizedMode;
            }
            if (typeof CONFIG !== 'undefined' && CONFIG.wineGlasses) {
                CONFIG.wineGlasses.spawnMode = normalizedMode;
            }
            if (typeof wineGlassSystem !== 'undefined' && wineGlassSystem) {
                wineGlassSystem.spawnMode = normalizedMode;
            }
        } catch (e) {
            console.warn('No se pudo inicializar el modo de aparición:', e);
        }
        await this.loadAssetsFromConfig();
        this.loadHaloSettingsFromConfig();
        this.loadShaderSettingsFromConfig();
        // Esperar a que AssetManager marque assets listos y volver a renderizar
        if (typeof window !== 'undefined' && typeof window.ensureAssetsReady === 'function') {
            try { await window.ensureAssetsReady(); } catch (e) {}
        }
        this.loadCurrentAssets(); // Renderizar assets en el panel
        console.log('Configuración cargada exitosamente desde panel-config.json');
    }
    
    createDefaultConfiguration() {
        // Devuelve un objeto de configuración por defecto en vez de depender de efectos secundarios
        const defaults = {
            gameSettings: {
                fallSpeed: { current: 2.25, default: 2.25 },
                lives: { current: 3, default: 3 },
                objectSize: { current: 100, default: 100 },
                spawnRate: { current: 2000, default: 2000 },
                // Nuevo: máximos de objetos simultáneos en pantalla
                maxGoodItems: { current: 10, default: 10 },
                maxBadItems: { current: 5, default: 5 },
                winComboThreshold: { current: 20, default: 20 },
                hoverTime: { current: 1000, default: 1000 },
                collisionArea: { enabled: false, x: 0, y: 0, width: 0, height: 0, showOverlay: false },
                // Nuevo: mostrar/ocultar puntos del LIDAR
                showLidarPoints: false,
                // Nuevo: ocultar fondo (no renderizar shader)
                hideBackground: false,
                // Controles de shader de fondo
                backgroundBrightness: { current: 1.0, default: 1.0 },
                // Controles de ondas expansivas
                waveSpeed: { current: 0.5, default: 0.5 },
                waveForce: { current: 0.09, default: 0.09 },
                waveDuration: { current: 2.0, default: 2.0 },
                // Halos del cursor (mouse/touch/LIDAR)
                cursorHaloSize: { current: 0.08, default: 0.08 },
                cursorHaloStrength: { current: 1.0, default: 1.0 },
                // Vida de los objetos que caen
                particleLifespan: { current: 6000, default: 6000 },
                // Mostrar/ocultar botones de modo de juego
                showCooperativeButton: true,
                showCompetitiveButton: true
            },
            winLoseSettings: {
                textSize: { current: 0.15, default: 0.15 },
                winText: { current: 'GANASTE', default: 'GANASTE' },
                loseText: { current: 'PERDISTE', default: 'PERDISTE' },
                scoreTextSize: { current: 40, default: 40 },
                comboTextSize: { current: 30, default: 30 }
            }
        };
        this.configData = defaults;
        return defaults;
    }
    
    // Funciones de manejo de archivo JSON
    async loadConfigFromFile() {
        try {
            // Fuerza a no usar caché del navegador para que los cambios del JSON recién reemplazado se reflejen.
            const cacheBust = `?_=${Date.now()}`;
            const response = await fetch(`./panel-config.json${cacheBust}`, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const config = await response.json();
            return config;
        } catch (error) {
            console.warn('No se pudo cargar panel-config.json, usando configuración por defecto:', error);
            return this.createDefaultConfiguration();
        }
    }

    async saveConfigToFile(config) {
        // Validar que config sea serializable
        let configToSave;
        try {
            // Crear una copia limpia del config sin referencias circulares
            configToSave = JSON.parse(JSON.stringify(config));
        } catch (err) {
            console.error('Error al serializar config:', err);
            this.showSaveNotification('❌ Error: Configuración no válida');
            return false;
        }
        
        // Intenta guardar en el servidor (Express) si está disponible
        try {
            const res = await fetch('/api/save-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configToSave)
            });
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            this.showSaveNotification('✅ Configuración guardada en el servidor');
            return true;
        } catch (serverErr) {
            console.warn('No se pudo guardar en el servidor, usando descarga local:', serverErr);
            // Fallback: descarga local del archivo actualizado
            try {
                const dataStr = JSON.stringify(configToSave, null, 2);
                const dataBlob = new Blob([dataStr], {type: 'application/json'});
                const url = URL.createObjectURL(dataBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'panel-config.json';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                this.showSaveNotification('✅ Configuración guardada (descarga local)');
                return true;
            } catch (error) {
                console.error('Error al guardar configuración:', error);
                this.showSaveNotification('❌ Error al guardar: ' + error.message);
                return false;
            }
        }
    }

    async loadAssetsFromConfig() {
        if (!this.configData || !this.configData.assets) return;
        
        // Inicializar variables globales si no existen
        window.goodItemImagePaths = window.goodItemImagePaths || [];
        window.badItemImagePaths = window.badItemImagePaths || [];
        window.backgroundImagePaths = window.backgroundImagePaths || [];
        window.goodItemImages = window.goodItemImages || [];
        window.badItemImages = window.badItemImages || [];
        window.backgroundTextures = window.backgroundTextures || [];
        if (typeof window !== 'undefined') {
            window.assetsReady = false;
        }
        
        // Helper para cargar una categoría de imágenes y mantener el orden
        const loadCategory = async (paths, targetArray) => {
            targetArray.length = 0;
            const promises = (paths || []).map((path, idx) => new Promise((resolve) => {
                targetArray[idx] = null;
                if (typeof loadImage === 'function') {
                    loadImage(path,
                        (img) => { img.__loaded = true; targetArray[idx] = img; resolve(true); },
                        () => { targetArray[idx] = null; resolve(false); }
                    );
                } else {
                    resolve(true);
                }
            }));
            await Promise.all(promises);
        };

        // Cargar assets desde la configuración - REEMPLAZAR completamente
        const assets = this.configData.assets;
        
        if (assets.objects && assets.objects.length > 0) {
            // Reemplazar completamente los arrays
            window.goodItemImagePaths.length = 0;
            assets.objects.forEach(path => { window.goodItemImagePaths.push(path); });
            await loadCategory(window.goodItemImagePaths, window.goodItemImages);
        }
        
        if (assets.badItems && assets.badItems.length > 0) {
            // Reemplazar completamente los arrays
            window.badItemImagePaths.length = 0;
            assets.badItems.forEach(path => { window.badItemImagePaths.push(path); });
            await loadCategory(window.badItemImagePaths, window.badItemImages);
        }
        
        if (assets.backgrounds && assets.backgrounds.length > 0) {
            // Reemplazar completamente los arrays
            window.backgroundImagePaths.length = 0;
            assets.backgrounds.forEach(path => { window.backgroundImagePaths.push(path); });
            await loadCategory(window.backgroundImagePaths, window.backgroundTextures);
        }

        // Fallback: si alguna categoría quedó vacía, usar los defaults del AssetManager
        if (typeof window !== 'undefined' && window.AssetManager) {
            if ((!window.goodItemImagePaths || window.goodItemImagePaths.length === 0) && Array.isArray(window.AssetManager.goodItemImagePaths) && window.AssetManager.goodItemImagePaths.length > 0) {
                window.goodItemImagePaths = window.AssetManager.goodItemImagePaths.slice();
                await loadCategory(window.goodItemImagePaths, window.goodItemImages);
            }
            if ((!window.badItemImagePaths || window.badItemImagePaths.length === 0) && Array.isArray(window.AssetManager.badItemImagePaths) && window.AssetManager.badItemImagePaths.length > 0) {
                window.badItemImagePaths = window.AssetManager.badItemImagePaths.slice();
                await loadCategory(window.badItemImagePaths, window.badItemImages);
            }
            if ((!window.backgroundImagePaths || window.backgroundImagePaths.length === 0) && Array.isArray(window.AssetManager.backgroundImagePaths) && window.AssetManager.backgroundImagePaths.length > 0) {
                window.backgroundImagePaths = window.AssetManager.backgroundImagePaths.slice();
                await loadCategory(window.backgroundImagePaths, window.backgroundTextures);
            }
        }
        
        // Actualizar currentAssets con copias
        this.currentAssets = {
            objects: window.goodItemImagePaths.slice(),
            badItems: window.badItemImagePaths.slice(),
            backgrounds: window.backgroundImagePaths.slice()
        };
        
        console.log('Assets REEMPLAZADOS desde configuración JSON:', this.currentAssets);
        
        // Asegurar assets listos y pre-escalados
        if (typeof window.ensureAssetsReady === 'function') {
            await window.ensureAssetsReady();
        } else if (typeof window.preScaleImages === 'function') {
            window.preScaleImages();
        }
        if (typeof window !== 'undefined') {
            window.assetsReady = true;
        }
    }

    loadHaloSettingsFromConfig() {
        if (!this.configData || !this.configData.haloSettings) return;
        
        const haloSettings = this.configData.haloSettings;
        
        // Aplicar configuración de halos
        if (haloSettings.goodHalo) {
            window.goodHaloSize = haloSettings.goodHalo.size;
            window.goodHaloStrength = haloSettings.goodHalo.strength;
            window.goodHaloColor = haloSettings.goodHalo.color;
        }
        
        if (haloSettings.badHalo) {
            window.badHaloSize = haloSettings.badHalo.size;
            window.badHaloStrength = haloSettings.badHalo.strength;
            window.badHaloColor = haloSettings.badHalo.color;
        }
        
        console.log('Configuración de halos cargada desde JSON');
    }
    
    loadShaderSettingsFromConfig() {
        if (!this.configData || !this.configData.shaderSettings) return;
        
        const shaderSettings = this.configData.shaderSettings;
        
        // Aplicar configuración de shader
        if (shaderSettings.backgroundBrightness !== undefined) {
            window.backgroundBrightness = shaderSettings.backgroundBrightness;
        }
        if (shaderSettings.waveSpeed !== undefined) {
            window.waveSpeed = shaderSettings.waveSpeed;
        }
        if (shaderSettings.waveForce !== undefined) {
            window.waveForce = shaderSettings.waveForce;
        }
        if (shaderSettings.waveDuration !== undefined) {
            window.waveDuration = shaderSettings.waveDuration;
        }
        if (shaderSettings.cursorHaloSize !== undefined) {
            window.cursorHaloSize = shaderSettings.cursorHaloSize;
        }
        if (shaderSettings.cursorHaloStrength !== undefined) {
            window.cursorHaloStrength = shaderSettings.cursorHaloStrength;
        }
        
        console.log('Configuración de shader cargada desde JSON');
    }
    
    applyConfiguration() {
        if (!this.configData || !this.configData.gameSettings) return;
        const settings = this.configData.gameSettings;
        // Asegurar que existan los nuevos campos incluso si el JSON antiguo no los trae
        if (!settings.maxGoodItems) {
            const defGood = this.maxGoodItemsInput ? parseInt(this.maxGoodItemsInput.value || '10') : 10;
            settings.maxGoodItems = { current: defGood, default: defGood };
        }
        if (!settings.maxBadItems) {
            const defBad = this.maxBadItemsInput ? parseInt(this.maxBadItemsInput.value || '5') : 5;
            settings.maxBadItems = { current: defBad, default: defBad };
        }
        
        // Aplicar configuraciones a los controles
        if (this.fallSpeedSlider && settings.fallSpeed) {
            this.fallSpeedSlider.value = settings.fallSpeed.current;
            this.fallSpeedValue.textContent = settings.fallSpeed.current + 'x';
            this.updateGameFallSpeed(settings.fallSpeed.current);
        }
        
        if (this.livesSlider && settings.lives) {
            this.livesSlider.value = settings.lives.current;
            this.livesValue.textContent = settings.lives.current;
            this.updateGameLives(settings.lives.current);
        }
        
        if (this.objectSizeSlider && settings.objectSize) {
            this.objectSizeSlider.value = settings.objectSize.current;
            this.objectSizeValue.textContent = settings.objectSize.current + 'px';
            this.updateObjectSize(settings.objectSize.current);
        }
        
        if (this.spawnRateSlider && settings.spawnRate) {
            this.spawnRateSlider.value = settings.spawnRate.current;
            this.spawnRateValue.textContent = (settings.spawnRate.current / 1000).toFixed(1) + 's';
            this.updateSpawnRate(settings.spawnRate.current);
        }

        // Mostrar/Ocultar puntos del LIDAR
        if (typeof settings.showLidarPoints === 'undefined') {
            settings.showLidarPoints = true;
        }
        const lidarVisible = !!settings.showLidarPoints;
        if (this.showLidarPointsCheckbox) {
            this.showLidarPointsCheckbox.checked = lidarVisible;
        }
        if (typeof window !== 'undefined') {
            window.showLidarPoints = lidarVisible;
        }

        // Mostrar/Ocultar fondo
        if (typeof settings.hideBackground === 'undefined') {
            settings.hideBackground = false;
        }
        const hideBg = !!settings.hideBackground;
        if (this.hideBackgroundCheckbox) {
            this.hideBackgroundCheckbox.checked = hideBg;
        }
        if (typeof window !== 'undefined') {
            window.hideBackground = hideBg;
        }

        // Nuevos: máximos de objetos simultáneos
        if (this.maxGoodItemsInput && settings.maxGoodItems) {
            this.maxGoodItemsInput.value = parseInt(settings.maxGoodItems.current);
            this.updateMaxGoodItems(parseInt(settings.maxGoodItems.current));
        }
        if (this.maxBadItemsInput && settings.maxBadItems) {
            this.maxBadItemsInput.value = parseInt(settings.maxBadItems.current);
            this.updateMaxBadItems(parseInt(settings.maxBadItems.current));
        }

        // Umbral de combo para ganar
        if (this.winComboSlider && settings.winComboThreshold) {
            this.winComboSlider.value = settings.winComboThreshold.current;
            this.winComboValue.textContent = settings.winComboThreshold.current;
            this.updateWinComboThreshold(settings.winComboThreshold.current);
        }
        // Nuevo: tiempo de agarre
        if (this.hoverTimeSlider && settings.hoverTime) {
            this.hoverTimeSlider.value = settings.hoverTime.current;
            this.hoverTimeValue.textContent = settings.hoverTime.current + ' ms';
            this.updateHoverTime(settings.hoverTime.current);
        }

        // Halos buenos
        if (this.goodHaloSizeSlider && settings.goodHaloSize) {
            this.goodHaloSizeSlider.value = settings.goodHaloSize.current;
        }
        if (this.goodHaloStrengthSlider && settings.goodHaloStrength) {
            this.goodHaloStrengthSlider.value = settings.goodHaloStrength.current;
        }
        if (this.goodHaloColorInput && settings.goodHaloColor) {
            this.goodHaloColorInput.value = settings.goodHaloColor.current;
        }
        // Halos malos
        if (this.badHaloSizeSlider && settings.badHaloSize) {
            this.badHaloSizeSlider.value = settings.badHaloSize.current;
        }
        if (this.badHaloStrengthSlider && settings.badHaloStrength) {
            this.badHaloStrengthSlider.value = settings.badHaloStrength.current;
        }
        if (this.badHaloColorInput && settings.badHaloColor) {
            this.badHaloColorInput.value = settings.badHaloColor.current;
        }
        
        // Shader de fondo
        if (this.backgroundBrightnessSlider && settings.backgroundBrightness) {
            this.backgroundBrightnessSlider.value = settings.backgroundBrightness.current;
            this.backgroundBrightnessValue.textContent = settings.backgroundBrightness.current;
        }

        // Ondas expansivas
        if (this.waveSpeedSlider && settings.waveSpeed) {
            this.waveSpeedSlider.value = settings.waveSpeed.current;
            this.waveSpeedValue.textContent = settings.waveSpeed.current;
        }
        if (this.waveForceSlider && settings.waveForce) {
            this.waveForceSlider.value = settings.waveForce.current;
            this.waveForceValue.textContent = settings.waveForce.current;
        }
        if (this.waveDurationSlider && settings.waveDuration) {
            this.waveDurationSlider.value = settings.waveDuration.current;
            this.waveDurationValue.textContent = settings.waveDuration.current + 's';
        }

        // Halos del cursor
        if (this.cursorHaloSizeSlider && settings.cursorHaloSize) {
            this.cursorHaloSizeSlider.value = settings.cursorHaloSize.current;
            this.updateCursorHaloSize(settings.cursorHaloSize.current);
        }
        if (this.cursorHaloStrengthSlider && settings.cursorHaloStrength) {
            this.cursorHaloStrengthSlider.value = settings.cursorHaloStrength.current;
            this.updateCursorHaloStrength(settings.cursorHaloStrength.current);
        }

        // Aplicar a juego (valores iniciales)
        this.updateHaloSettings();

        // Aplicar vida de partículas
        if (this.particleLifespanSlider && settings.particleLifespan) {
            this.particleLifespanSlider.value = settings.particleLifespan.current;
            this.particleLifespanValue.textContent = settings.particleLifespan.current + 'ms';
            this.updateParticleLifespan(settings.particleLifespan.current);
        }

        // Aplicar área de colisión (si existe)
        const ca = settings.collisionArea || { enabled: false, x: 0, y: 0, width: 0, height: 0 };
        // Si p5.width/p5.height aún no están inicializados, usa window.innerWidth/innerHeight
        const canvasW = (typeof width !== 'undefined' && width > 0) ? width : (window.innerWidth || 1920);
        const canvasH = (typeof height !== 'undefined' && height > 0) ? height : (window.innerHeight || 1080);
        if (!ca.width || ca.width <= 0) ca.width = canvasW;
        if (!ca.height || ca.height <= 0) ca.height = canvasH;
        // Asegurar que el rectángulo esté dentro del canvas
        const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
        ca.x = clamp(parseInt(ca.x || 0), 0, canvasW);
        ca.y = clamp(parseInt(ca.y || 0), 0, canvasH);
        ca.width = clamp(parseInt(ca.width || canvasW), 1, Math.max(1, canvasW - ca.x));
        ca.height = clamp(parseInt(ca.height || canvasH), 1, Math.max(1, canvasH - ca.y));

        // UI: asignar valores si existen los elementos
        if (this.collisionAreaEnabled) this.collisionAreaEnabled.checked = !!ca.enabled;
        if (this.collisionAreaX) this.collisionAreaX.value = ca.x;
        if (this.collisionAreaY) this.collisionAreaY.value = ca.y;
        if (this.collisionAreaW) this.collisionAreaW.value = ca.width;
        if (this.collisionAreaH) this.collisionAreaH.value = ca.height;
        // Runtime: exponer en window
        window.collisionArea = {
            enabled: !!ca.enabled,
            x: ca.x,
            y: ca.y,
            width: ca.width,
            height: ca.height
        };
        if (this.collisionAreaOverlay) this.collisionAreaOverlay.checked = !!(settings.collisionArea && settings.collisionArea.showOverlay);
        window.collisionArea.showOverlay = !!(settings.collisionArea && settings.collisionArea.showOverlay);
        // Log de diagnóstico para verificar que los valores del JSON se aplicaron correctamente
        console.log('Configuración de área de colisión aplicada desde JSON:', window.collisionArea);

        // Aplicar visibilidad de botones
        if (typeof settings.showCooperativeButton !== 'undefined') {
            if (this.showCooperativeButton) this.showCooperativeButton.checked = !!settings.showCooperativeButton;
            if (typeof window !== 'undefined') window.showCooperativeButton = !!settings.showCooperativeButton;
        }
        if (typeof settings.showCompetitiveButton !== 'undefined') {
            if (this.showCompetitiveButton) this.showCompetitiveButton.checked = !!settings.showCompetitiveButton;
            if (typeof window !== 'undefined') window.showCompetitiveButton = !!settings.showCompetitiveButton;
        }

        // Aplicar configuración de winlose
        if (this.configData.winLoseSettings) {
            const wls = this.configData.winLoseSettings;
            if (this.winLoseTextSizeSlider && wls.textSize) {
                this.winLoseTextSizeSlider.value = wls.textSize.current;
                this.winLoseTextSizeValue.textContent = wls.textSize.current.toFixed(2);
                this.updateWinLoseTextSize(wls.textSize.current);
            }
            if (this.winTextInput && wls.winText) {
                this.winTextInput.value = wls.winText.current;
                this.updateWinText(wls.winText.current);
            }
            if (this.loseTextInput && wls.loseText) {
                this.loseTextInput.value = wls.loseText.current;
                this.updateLoseText(wls.loseText.current);
            }
            // Sincronizar sliders duplicados
            if (this.winComboSliderWinLose && settings.winComboThreshold) {
                this.winComboSliderWinLose.value = settings.winComboThreshold.current;
                this.winComboValueWinLose.textContent = settings.winComboThreshold.current;
            }
            if (this.livesSliderWinLose && settings.lives) {
                this.livesSliderWinLose.value = settings.lives.current;
                this.livesValueWinLose.textContent = settings.lives.current;
            }
            // Tamaños de textos adicionales
            if (this.scoreTextSizeSlider && wls.scoreTextSize) {
                this.scoreTextSizeSlider.value = wls.scoreTextSize.current;
                this.scoreTextSizeValue.textContent = wls.scoreTextSize.current;
                this.updateScoreTextSize(wls.scoreTextSize.current);
            }
            if (this.comboTextSizeSlider && wls.comboTextSize) {
                this.comboTextSizeSlider.value = wls.comboTextSize.current;
                this.comboTextSizeValue.textContent = wls.comboTextSize.current;
                this.updateComboTextSize(wls.comboTextSize.current);
            }
        }
    }

    async saveConfiguration() {
        if (!this.configData) return;
        
        // Actualizar valores actuales en la configuración
        this.configData.gameSettings.fallSpeed.current = parseFloat(this.fallSpeedSlider.value);
        this.configData.gameSettings.lives.current = parseInt(this.livesSlider.value);
        this.configData.gameSettings.objectSize.current = parseInt(this.objectSizeSlider.value);
        this.configData.gameSettings.spawnRate.current = parseInt(this.spawnRateSlider.value);
        // Persistir visualización de puntos del LIDAR
        this.configData.gameSettings.showLidarPoints = this.showLidarPointsCheckbox
            ? !!this.showLidarPointsCheckbox.checked
            : (typeof window !== 'undefined' ? !!window.showLidarPoints : true);
        // Persistir ocultar fondo
        this.configData.gameSettings.hideBackground = this.hideBackgroundCheckbox
            ? !!this.hideBackgroundCheckbox.checked
            : (typeof window !== 'undefined' ? !!window.hideBackground : false);
        if (this.maxGoodItemsInput) {
            this.configData.gameSettings.maxGoodItems = this.configData.gameSettings.maxGoodItems || { current: 10, default: 10 };
            this.configData.gameSettings.maxGoodItems.current = parseInt(this.maxGoodItemsInput.value || '0');
        }
        if (this.maxBadItemsInput) {
            this.configData.gameSettings.maxBadItems = this.configData.gameSettings.maxBadItems || { current: 5, default: 5 };
            this.configData.gameSettings.maxBadItems.current = parseInt(this.maxBadItemsInput.value || '0');
        }
        if (this.winComboSlider) this.configData.gameSettings.winComboThreshold.current = parseInt(this.winComboSlider.value);
        if (this.hoverTimeSlider) this.configData.gameSettings.hoverTime.current = parseInt(this.hoverTimeSlider.value);

        // Guardar área de colisión
        this.configData.gameSettings.collisionArea = this.configData.gameSettings.collisionArea || {};
        const canvasW = (typeof width !== 'undefined' && width > 0) ? width : (window.innerWidth || 1920);
        const canvasH = (typeof height !== 'undefined' && height > 0) ? height : (window.innerHeight || 1080);
        const enabled = this.collisionAreaEnabled ? !!this.collisionAreaEnabled.checked : (window.collisionArea ? !!window.collisionArea.enabled : false);
        const x = this.collisionAreaX ? parseInt(this.collisionAreaX.value || 0) : (window.collisionArea ? window.collisionArea.x : 0);
        const y = this.collisionAreaY ? parseInt(this.collisionAreaY.value || 0) : (window.collisionArea ? window.collisionArea.y : 0);
        const w = this.collisionAreaW ? parseInt(this.collisionAreaW.value || canvasW) : (window.collisionArea ? window.collisionArea.width : canvasW);
        const h = this.collisionAreaH ? parseInt(this.collisionAreaH.value || canvasH) : (window.collisionArea ? window.collisionArea.height : canvasH);
        this.configData.gameSettings.collisionArea.enabled = enabled;
        this.configData.gameSettings.collisionArea.x = x;
        this.configData.gameSettings.collisionArea.y = y;
        this.configData.gameSettings.collisionArea.width = w;
        this.configData.gameSettings.collisionArea.height = h;
        this.configData.gameSettings.collisionArea.showOverlay = this.collisionAreaOverlay ? !!this.collisionAreaOverlay.checked : (window.collisionArea ? !!window.collisionArea.showOverlay : false);
        
        // Actualizar configuración de halos
        if (!this.configData.haloSettings) this.configData.haloSettings = {};
        if (!this.configData.haloSettings.goodHalo) this.configData.haloSettings.goodHalo = {};
        if (!this.configData.haloSettings.badHalo) this.configData.haloSettings.badHalo = {};
        
        if (this.goodHaloSizeSlider) this.configData.haloSettings.goodHalo.size = parseFloat(this.goodHaloSizeSlider.value);
        if (this.goodHaloStrengthSlider) this.configData.haloSettings.goodHalo.strength = parseFloat(this.goodHaloStrengthSlider.value);
        if (this.goodHaloColorInput) this.configData.haloSettings.goodHalo.color = this.goodHaloColorInput.value;
        if (this.badHaloSizeSlider) this.configData.haloSettings.badHalo.size = parseFloat(this.badHaloSizeSlider.value);
        if (this.badHaloStrengthSlider) this.configData.haloSettings.badHalo.strength = parseFloat(this.badHaloStrengthSlider.value);
        if (this.badHaloColorInput) this.configData.haloSettings.badHalo.color = this.badHaloColorInput.value;
        
        // Actualizar configuración de shader de fondo
        if (!this.configData.shaderSettings) this.configData.shaderSettings = {};
        if (this.backgroundBrightnessSlider) this.configData.shaderSettings.backgroundBrightness = parseFloat(this.backgroundBrightnessSlider.value);
        if (this.waveSpeedSlider) this.configData.shaderSettings.waveSpeed = parseFloat(this.waveSpeedSlider.value);
        if (this.waveForceSlider) this.configData.shaderSettings.waveForce = parseFloat(this.waveForceSlider.value);
        if (this.waveDurationSlider) this.configData.shaderSettings.waveDuration = parseFloat(this.waveDurationSlider.value);
        // Guardar halos del cursor
        if (this.cursorHaloSizeSlider) this.configData.shaderSettings.cursorHaloSize = parseFloat(this.cursorHaloSizeSlider.value);
        if (this.cursorHaloStrengthSlider) this.configData.shaderSettings.cursorHaloStrength = parseFloat(this.cursorHaloStrengthSlider.value);
        
        // Guardar vida de objetos
        if (!this.configData.gameSettings) this.configData.gameSettings = {};
        if (!this.configData.gameSettings.particleLifespan) this.configData.gameSettings.particleLifespan = { current: 6000, default: 6000 };
        if (this.particleLifespanSlider) this.configData.gameSettings.particleLifespan.current = parseInt(this.particleLifespanSlider.value);
        
        // Actualizar assets asegurando que sean rutas del servidor (no data URLs)
        if (!this.configData.assets) this.configData.assets = {};
        const sanitized = await this.ensureAssetsAreServerPaths({
            objects: window.goodItemImagePaths || [],
            badItems: window.badItemImagePaths || [],
            backgrounds: window.backgroundImagePaths || []
        });
        window.goodItemImagePaths = sanitized.objects;
        window.badItemImagePaths = sanitized.badItems;
        window.backgroundImagePaths = sanitized.backgrounds;

        // Guardar modo de aparición de copas
        if (!this.configData.wineGlasses) this.configData.wineGlasses = {};
        if (this.spawnModeSelect && this.spawnModeSelect.value) {
            const m = (this.spawnModeSelect.value === 'random') ? 'random' : 'top';
            this.configData.wineGlasses.spawnMode = m;
        } else {
            // Si no existe el elemento por alguna razón, intenta tomarlo de CONFIG
            const m = (typeof CONFIG !== 'undefined' && CONFIG.wineGlasses && CONFIG.wineGlasses.spawnMode === 'random') ? 'random' : 'top';
            this.configData.wineGlasses.spawnMode = m;
        }
        this.currentAssets.objects = window.goodItemImagePaths.slice();
        this.currentAssets.badItems = window.badItemImagePaths.slice();
        this.currentAssets.backgrounds = window.backgroundImagePaths.slice();
        this.configData.assets.objects = window.goodItemImagePaths.slice();
        this.configData.assets.badItems = window.badItemImagePaths.slice();
        this.configData.assets.backgrounds = window.backgroundImagePaths.slice();
        
        // Guardar visibilidad de botones
        this.configData.gameSettings.showCooperativeButton = this.showCooperativeButton ? !!this.showCooperativeButton.checked : true;
        this.configData.gameSettings.showCompetitiveButton = this.showCompetitiveButton ? !!this.showCompetitiveButton.checked : true;

        // Guardar configuración de winlose
        if (!this.configData.winLoseSettings) this.configData.winLoseSettings = {};
        if (!this.configData.winLoseSettings.textSize) this.configData.winLoseSettings.textSize = { current: 0.15, default: 0.15 };
        if (!this.configData.winLoseSettings.winText) this.configData.winLoseSettings.winText = { current: 'GANASTE', default: 'GANASTE' };
        if (!this.configData.winLoseSettings.loseText) this.configData.winLoseSettings.loseText = { current: 'PERDISTE', default: 'PERDISTE' };
        if (!this.configData.winLoseSettings.scoreTextSize) this.configData.winLoseSettings.scoreTextSize = { current: 40, default: 40 };
        if (!this.configData.winLoseSettings.comboTextSize) this.configData.winLoseSettings.comboTextSize = { current: 30, default: 30 };
        
        if (this.winLoseTextSizeSlider) this.configData.winLoseSettings.textSize.current = parseFloat(this.winLoseTextSizeSlider.value);
        if (this.winTextInput) this.configData.winLoseSettings.winText.current = this.winTextInput.value || 'GANASTE';
        if (this.loseTextInput) this.configData.winLoseSettings.loseText.current = this.loseTextInput.value || 'PERDISTE';
        if (this.scoreTextSizeSlider) this.configData.winLoseSettings.scoreTextSize.current = parseInt(this.scoreTextSizeSlider.value);
        if (this.comboTextSizeSlider) this.configData.winLoseSettings.comboTextSize.current = parseInt(this.comboTextSizeSlider.value);
        
        // Actualizar metadatos
        this.configData.metadata = this.configData.metadata || {};
        this.configData.metadata.lastModified = new Date().toISOString().split('T')[0];
        
        // Guardar en archivo JSON (servidor si disponible, fallback a descarga local)
        const ok = await this.saveConfigToFile(this.configData);
        console.log('Configuración completa guardada en panel-config.json (ok=', ok, ')');
        return ok;
    }
    
    showSaveNotification(message = '✅ Configuración guardada') {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.textContent = message;
        
        // Determinar color y duración según el tipo de mensaje
        const isError = message.includes('❌');
        const isImportant = message.includes('Reemplaza el archivo');
        const bgColor = isError ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 255, 0, 0.8)';
        const duration = isImportant ? 6000 : 3000; // 6 segundos para mensajes importantes
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10002;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        document.body.appendChild(notification);
        
        // Remover después del tiempo especificado
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, duration);
    }
    
    loadPreset(presetName) {
        if (!this.configData || !this.configData.presets || !this.configData.presets[presetName]) {
            console.warn('Preset no encontrado:', presetName);
            return;
        }
        
        const preset = this.configData.presets[presetName];
        
        // Aplicar valores del preset
        if (this.fallSpeedSlider) {
            this.fallSpeedSlider.value = preset.fallSpeed;
            this.fallSpeedValue.textContent = preset.fallSpeed + 'x';
            this.updateGameFallSpeed(preset.fallSpeed);
        }
        
        if (this.livesSlider) {
            this.livesSlider.value = preset.lives;
            this.livesValue.textContent = preset.lives;
            this.updateGameLives(preset.lives);
        }
        
        if (this.objectSizeSlider) {
            this.objectSizeSlider.value = preset.objectSize;
            this.objectSizeValue.textContent = preset.objectSize + 'px';
            this.updateObjectSize(preset.objectSize);
        }
        
        if (this.spawnRateSlider) {
            this.spawnRateSlider.value = preset.spawnRate;
            this.spawnRateValue.textContent = (preset.spawnRate / 1000).toFixed(1) + 's';
            this.updateSpawnRate(preset.spawnRate);
        }
        
        console.log('Preset aplicado:', presetName);
    }
    
    init() {
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupElements());
        } else {
            this.setupElements();
        }
    }
    
    setupElements() {
        this.panel = document.getElementById('controlPanel');
        this.hint = document.getElementById('panelHint');
        // Remover hint si existe (se pidió eliminarlo)
        if (this.hint && this.hint.parentNode) {
            try { this.hint.parentNode.removeChild(this.hint); } catch (e) {}
            this.hint = null;
        }
        this.fallSpeedSlider = document.getElementById('fallSpeedSlider');
        this.livesSlider = document.getElementById('livesSlider');
        this.fallSpeedValue = document.getElementById('fallSpeedValue');
        this.livesValue = document.getElementById('livesValue');
        this.objectSizeSlider = document.getElementById('objectSizeSlider');
        this.objectSizeValue = document.getElementById('objectSizeValue');
        this.spawnRateSlider = document.getElementById('spawnRateSlider');
        this.spawnRateValue = document.getElementById('spawnRateValue');
        this.particleLifespanSlider = document.getElementById('particleLifespanSlider');
        this.particleLifespanValue = document.getElementById('particleLifespanValue');
        // Checkbox de visualización de puntos del LIDAR
        this.showLidarPointsCheckbox = document.getElementById('showLidarPointsCheckbox');
        // Checkbox de ocultar fondo
        this.hideBackgroundCheckbox = document.getElementById('hideBackgroundCheckbox');
        // Checkboxes de visibilidad de botones de modo
        this.showCooperativeButton = document.getElementById('showCooperativeButton');
        this.showCompetitiveButton = document.getElementById('showCompetitiveButton');
        // Nuevos: máximos de items simultáneos
        this.maxGoodItemsInput = document.getElementById('maxGoodItemsInput');
        this.maxBadItemsInput = document.getElementById('maxBadItemsInput');
        
        // Nuevo: umbral de combo para ganar
        this.winComboSlider = document.getElementById('winComboSlider');
        this.winComboValue = document.getElementById('winComboValue');
        // Nuevo: slider de tiempo de agarre
        this.hoverTimeSlider = document.getElementById('hoverTimeSlider');
        this.hoverTimeValue = document.getElementById('hoverTimeValue');
        // Nuevo: modo de aparición de copas
        this.spawnModeSelect = document.getElementById('spawnModeSelect');

        // Nueva: elementos de área de colisión
        this.collisionAreaEnabled = document.getElementById('collisionAreaEnabled');
        this.collisionAreaX = document.getElementById('collisionAreaX');
        this.collisionAreaY = document.getElementById('collisionAreaY');
        this.collisionAreaW = document.getElementById('collisionAreaW');
        this.collisionAreaH = document.getElementById('collisionAreaH');
        this.collisionAreaOverlay = document.getElementById('collisionAreaOverlay');
        
        // STATS tab metrics
        this.statsFpsCounter = document.getElementById('statsFpsCounter');
        this.statsFallingObjectsCount = document.getElementById('statsFallingObjectsCount');
        this.statsPointsCount = document.getElementById('statsPointsCount');
        
        // Elementos de pestañas
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // Elementos de assets
        this.backgroundUpload = document.getElementById('backgroundUpload');
        this.objectUpload = document.getElementById('objectUpload');
        this.badItemUpload = document.getElementById('badItemUpload');
        
        // Elementos de halos
        this.goodHaloSizeSlider = document.getElementById('goodHaloSizeSlider');
        this.goodHaloStrengthSlider = document.getElementById('goodHaloStrengthSlider');
        this.goodHaloColorInput = document.getElementById('goodHaloColorInput');
        this.badHaloSizeSlider = document.getElementById('badHaloSizeSlider');
        this.badHaloStrengthSlider = document.getElementById('badHaloStrengthSlider');
        this.badHaloColorInput = document.getElementById('badHaloColorInput');

        // Halos del cursor
        this.cursorHaloSizeSlider = document.getElementById('cursorHaloSizeSlider');
        this.cursorHaloStrengthSlider = document.getElementById('cursorHaloStrengthSlider');
        
        // Elementos de shader de fondo
        this.backgroundBrightnessSlider = document.getElementById('backgroundBrightnessSlider');
        this.backgroundBrightnessValue = document.getElementById('backgroundBrightnessValue');
        
        // Elementos de ondas expansivas
        this.waveSpeedSlider = document.getElementById('waveSpeedSlider');
        this.waveSpeedValue = document.getElementById('waveSpeedValue');
        this.waveForceSlider = document.getElementById('waveForceSlider');
        this.waveForceValue = document.getElementById('waveForceValue');
        this.waveDurationSlider = document.getElementById('waveDurationSlider');
        this.waveDurationValue = document.getElementById('waveDurationValue');
        
        // Elementos del tab winlose
        this.winLoseTextSizeSlider = document.getElementById('winLoseTextSizeSlider');
        this.winLoseTextSizeValue = document.getElementById('winLoseTextSizeValue');
        this.winTextInput = document.getElementById('winTextInput');
        this.loseTextInput = document.getElementById('loseTextInput');
        this.winComboSliderWinLose = document.getElementById('winComboSliderWinLose');
        this.winComboValueWinLose = document.getElementById('winComboValueWinLose');
        this.livesSliderWinLose = document.getElementById('livesSliderWinLose');
        this.livesValueWinLose = document.getElementById('livesValueWinLose');
        this.scoreTextSizeSlider = document.getElementById('scoreTextSizeSlider');
        this.scoreTextSizeValue = document.getElementById('scoreTextSizeValue');
        this.comboTextSizeSlider = document.getElementById('comboTextSizeSlider');
        this.comboTextSizeValue = document.getElementById('comboTextSizeValue');
        
        // Elementos de galería
        this.galleryNavButtons = document.querySelectorAll('.gallery-nav-btn');
        this.gallerySections = document.querySelectorAll('.gallery-section');
        this.currentAssets = { objects: [], badItems: [], backgrounds: [] };
        
        this.setupEventListeners();
        this.setupTabNavigation();
        this.setupAssetManagement();
        this.loadAssetsFromLocalStorage(); // Primero intenta restaurar desde almacenamiento
        this.setupGalleryNavigation();
        this.setupSaveChanges();
        this.setupAssetUploadModal();
        this.loadCurrentAssets();
        this.updateValues();
        this.startMetricsUpdate();
        this.startAssetsAutoRefresh();
        
        // FORZAR ocultamiento de puntos del LIDAR al inicio
        setTimeout(() => {
            if (typeof window !== 'undefined') {
                window.showLidarPoints = false;
            }
        }, 100);
        setTimeout(() => {
            if (typeof window !== 'undefined') {
                window.showLidarPoints = false;
            }
        }, 500);
    }
    
    setupEventListeners() {
        // Listener para la tecla P
        document.addEventListener('keydown', (event) => {
            if (event.key.toLowerCase() === 'p') {
                event.preventDefault();
                this.toggle();
            }
        });

        // Toggle de puntos del LIDAR
        if (this.showLidarPointsCheckbox) {
            this.showLidarPointsCheckbox.addEventListener('change', (event) => {
                const visible = !!event.target.checked;
                if (typeof window !== 'undefined') {
                    window.showLidarPoints = visible;
                }
            });
        }

        // Toggle de ocultar fondo
        if (this.hideBackgroundCheckbox) {
            this.hideBackgroundCheckbox.addEventListener('change', (event) => {
                const hide = !!event.target.checked;
                if (typeof window !== 'undefined') {
                    window.hideBackground = hide;
                }
            });
        }
        
        // Listeners para los sliders
        if (this.fallSpeedSlider) {
            this.fallSpeedSlider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                this.fallSpeedValue.textContent = value + 'x';
                this.updateGameFallSpeed(value);
            });
        }
        
        if (this.livesSlider) {
            this.livesSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value);
                this.livesValue.textContent = value;
                this.updateGameLives(value);
            });
        }
        
        if (this.objectSizeSlider) {
            this.objectSizeSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value);
                this.objectSizeValue.textContent = value + 'px';
                this.updateObjectSize(value);
            });
        }
        
        if (this.spawnRateSlider) {
            this.spawnRateSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value);
                this.spawnRateValue.textContent = (value / 1000).toFixed(1) + 's';
                this.updateSpawnRate(value);
            });
        }
        
        if (this.particleLifespanSlider) {
            this.particleLifespanSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value);
                this.particleLifespanValue.textContent = value + 'ms';
                this.updateParticleLifespan(value);
            });
        }

        // Nuevos: límites máximos de items en pantalla
        if (this.maxGoodItemsInput) {
            this.maxGoodItemsInput.addEventListener('input', (event) => {
                const value = Math.max(0, parseInt(event.target.value || '0'));
                event.target.value = value;
                this.updateMaxGoodItems(value);
            });
        }
        if (this.maxBadItemsInput) {
            this.maxBadItemsInput.addEventListener('input', (event) => {
                const value = Math.max(0, parseInt(event.target.value || '0'));
                event.target.value = value;
                this.updateMaxBadItems(value);
            });
        }

        // Control del umbral de combo para ganar
        if (this.winComboSlider) {
            this.winComboSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value);
                this.winComboValue.textContent = value;
                this.updateWinComboThreshold(value);
            });
        }

        // Nuevo: control del tiempo de agarre
        if (this.hoverTimeSlider) {
            this.hoverTimeSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value);
                this.hoverTimeValue.textContent = value + ' ms';
                this.updateHoverTime(value);
            });
        }
        
        // Eventos de halos
        if (this.goodHaloSizeSlider) {
            this.goodHaloSizeSlider.addEventListener('input', () => { this.updateHaloSettings(); });
        }
        if (this.goodHaloStrengthSlider) {
            this.goodHaloStrengthSlider.addEventListener('input', () => { this.updateHaloSettings(); });
        }
        if (this.goodHaloColorInput) {
            this.goodHaloColorInput.addEventListener('input', () => { this.updateHaloSettings(); });
        }
        if (this.badHaloSizeSlider) {
            this.badHaloSizeSlider.addEventListener('input', () => { this.updateHaloSettings(); });
        }
        if (this.badHaloStrengthSlider) {
            this.badHaloStrengthSlider.addEventListener('input', () => { this.updateHaloSettings(); });
        }
        if (this.badHaloColorInput) {
            this.badHaloColorInput.addEventListener('input', () => { this.updateHaloSettings(); });
        }

        // Eventos de halos del cursor
        if (this.cursorHaloSizeSlider) {
            this.cursorHaloSizeSlider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                this.updateCursorHaloSize(value);
            });
        }
        if (this.cursorHaloStrengthSlider) {
            this.cursorHaloStrengthSlider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                this.updateCursorHaloStrength(value);
            });
        }
        
        // Eventos de shader de fondo
        if (this.backgroundBrightnessSlider) {
            this.backgroundBrightnessSlider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                this.backgroundBrightnessValue.textContent = value;
                this.updateBackgroundBrightness(value);
            });
        }
        
        // Eventos de ondas expansivas
        if (this.waveSpeedSlider) {
            this.waveSpeedSlider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                this.waveSpeedValue.textContent = value;
                this.updateWaveSpeed(value);
            });
        }
        if (this.waveForceSlider) {
            this.waveForceSlider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                this.waveForceValue.textContent = value;
                this.updateWaveForce(value);
            });
        }
        if (this.waveDurationSlider) {
            this.waveDurationSlider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                this.waveDurationValue.textContent = value + 's';
                this.updateWaveDuration(value);
            });
        }

        // Eventos de área de colisión
        if (this.collisionAreaEnabled) {
            this.collisionAreaEnabled.addEventListener('change', (e) => {
                this.updateCollisionAreaEnabled(e.target.checked);
            });
        }
        if (this.collisionAreaOverlay) {
            this.collisionAreaOverlay.addEventListener('change', (e) => {
                this.updateCollisionAreaOverlay(!!e.target.checked);
            });
        }
        // Permitir cualquier número en el módulo de colisión (sin clamps)
        if (this.collisionAreaX) {
            this.collisionAreaX.addEventListener('input', (e) => {
                const v = parseInt(e.target.value || 0);
                this.updateCollisionAreaValue('x', v);
            });
        }
        if (this.collisionAreaY) {
            this.collisionAreaY.addEventListener('input', (e) => {
                const v = parseInt(e.target.value || 0);
                this.updateCollisionAreaValue('y', v);
            });
        }
        if (this.collisionAreaW) {
            this.collisionAreaW.addEventListener('input', (e) => {
                const v = parseInt(e.target.value || 1);
                this.updateCollisionAreaValue('width', v);
            });
        }
        if (this.collisionAreaH) {
            this.collisionAreaH.addEventListener('input', (e) => {
                const v = parseInt(e.target.value || 1);
                this.updateCollisionAreaValue('height', v);
            });
        }
        // Modo de aparición de copas
        if (this.spawnModeSelect) {
            this.spawnModeSelect.addEventListener('change', (e) => {
                this.updateSpawnMode(e.target.value);
            });
        }

        // Checkboxes de visibilidad de botones
        if (this.showCooperativeButton) {
            this.showCooperativeButton.addEventListener('change', (e) => {
                this.updateButtonVisibility();
            });
        }
        if (this.showCompetitiveButton) {
            this.showCompetitiveButton.addEventListener('change', (e) => {
                this.updateButtonVisibility();
            });
        }

        // Controles del tab winlose
        if (this.winLoseTextSizeSlider) {
            this.winLoseTextSizeSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.winLoseTextSizeValue.textContent = value.toFixed(2);
                this.updateWinLoseTextSize(value);
            });
        }
        if (this.winTextInput) {
            this.winTextInput.addEventListener('input', (e) => {
                this.updateWinText(e.target.value);
            });
        }
        if (this.loseTextInput) {
            this.loseTextInput.addEventListener('input', (e) => {
                this.updateLoseText(e.target.value);
            });
        }
        if (this.winComboSliderWinLose) {
            this.winComboSliderWinLose.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.winComboValueWinLose.textContent = value;
                this.updateWinComboThreshold(value);
                // Sincronizar con el slider del tab de controles si existe
                if (this.winComboSlider) {
                    this.winComboSlider.value = value;
                    this.winComboValue.textContent = value;
                }
            });
        }
        if (this.livesSliderWinLose) {
            this.livesSliderWinLose.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.livesValueWinLose.textContent = value;
                this.updateGameLives(value);
                // Sincronizar con el slider del tab de partículas si existe
                if (this.livesSlider) {
                    this.livesSlider.value = value;
                    this.livesValue.textContent = value;
                }
            });
        }
        if (this.scoreTextSizeSlider) {
            this.scoreTextSizeSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.scoreTextSizeValue.textContent = value;
                this.updateScoreTextSize(value);
            });
        }
        if (this.comboTextSizeSlider) {
            this.comboTextSizeSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.comboTextSizeValue.textContent = value;
                this.updateComboTextSize(value);
            });
        }
    }
    
    toggle() {
        this.isVisible = !this.isVisible;
        
        if (this.isVisible) {
            this.show();
        } else {
            this.hide();
        }
    }
    
    show() {
        if (this.panel) {
            this.panel.classList.add('visible');
        }
        if (this.hint) {
            this.hint.classList.add('hidden');
        }
        this.isVisible = true;
    }
    
    hide() {
        if (this.panel) {
            this.panel.classList.remove('visible');
        }
        if (this.hint) {
            this.hint.classList.remove('hidden');
        }
        this.isVisible = false;
    }
    
    updateValues() {
        // Actualizar valores mostrados
        if (this.fallSpeedValue && this.fallSpeedSlider) {
            this.fallSpeedValue.textContent = this.fallSpeedSlider.value;
        }
        if (this.livesValue && this.livesSlider) {
            this.livesValue.textContent = this.livesSlider.value;
        }
    }
    
    updateGameFallSpeed(speed) {
        // Actualizar la velocidad de caída en el juego
        if (typeof CONFIG !== 'undefined' && CONFIG.wineGlasses) {
            CONFIG.wineGlasses.speed.min = speed * 0.67; // 67% del valor
            CONFIG.wineGlasses.speed.max = speed;
        }
        
        // Debounce del log para evitar spam
        clearTimeout(this._fallSpeedLogTimeout);
        this._fallSpeedLogTimeout = setTimeout(() => {
            console.log('Velocidad de caída actualizada:', speed);
        }, 100);
    }
    
    updateGameLives(lives) {
        // Actualizar las vidas en el juego
        if (typeof CONFIG !== 'undefined' && CONFIG.lives) {
            CONFIG.lives.initial = lives;
        }
        
        // Actualizar las vidas actuales si el juego ya está corriendo
        if (typeof scoreSystem !== 'undefined' && scoreSystem) {
            scoreSystem.lives = lives;
        }
        
        console.log('Vidas actualizadas:', lives);
    }
    
    updateObjectSize(size) {
        // Actualizar el tamaño de objetos en el juego
        if (typeof CONFIG !== 'undefined' && CONFIG.wineGlasses) {
            CONFIG.wineGlasses.itemSize = size;
        }
        
        console.log('Tamaño de objetos actualizado:', size);
    }
    
    updateSpawnRate(rate) {
        // Actualizar la velocidad de aparición de objetos
        if (typeof CONFIG !== 'undefined' && CONFIG.wineGlasses) {
            CONFIG.wineGlasses.spawnInterval = rate;
        }
        
        // También actualizar el sistema de objetos si existe
        if (typeof wineGlassSystem !== 'undefined' && wineGlassSystem) {
            wineGlassSystem.spawnInterval = rate;
        }
        
        // Debounce del log para evitar spam
        clearTimeout(this._spawnRateLogTimeout);
        this._spawnRateLogTimeout = setTimeout(() => {
            console.log('Velocidad de aparición actualizada:', rate + 'ms');
        }, 100);
    }

    // Nuevo: actualizar el modo de aparición de las copas (arriba/random)
    updateSpawnMode(mode) {
        const normalized = (mode === 'random') ? 'random' : 'top';
        // Actualizar configuración
        if (typeof CONFIG !== 'undefined' && CONFIG.wineGlasses) {
            CONFIG.wineGlasses.spawnMode = normalized;
        }
        // Actualizar sistema en runtime
        if (typeof wineGlassSystem !== 'undefined' && wineGlassSystem) {
            wineGlassSystem.spawnMode = normalized;
        }
        // Reflejar en UI
        if (this.spawnModeSelect) {
            this.spawnModeSelect.value = normalized;
        }
        console.log('Modo de aparición actualizado:', normalized);
    }

    // Nuevos: actualizar límites máximos de objetos en pantalla
    updateMaxGoodItems(value) {
        const v = Math.max(0, parseInt(value));
        if (typeof CONFIG !== 'undefined' && CONFIG.wineGlasses) {
            CONFIG.wineGlasses.maxGoodItems = v;
        }
        if (typeof wineGlassSystem !== 'undefined' && wineGlassSystem) {
            wineGlassSystem.maxGoodItems = v;
        }
        console.log('Máximo de items buenos:', v);
    }
    updateMaxBadItems(value) {
        const v = Math.max(0, parseInt(value));
        if (typeof CONFIG !== 'undefined' && CONFIG.wineGlasses) {
            CONFIG.wineGlasses.maxBadItems = v;
        }
        if (typeof wineGlassSystem !== 'undefined' && wineGlassSystem) {
            wineGlassSystem.maxBadItems = v;
        }
        console.log('Máximo de items malos:', v);
    }

    // Nuevo: actualizar umbral de combo para ganar en tiempo real
    updateWinComboThreshold(value) {
        const v = parseInt(value);
        if (isNaN(v)) return;
        if (typeof CONFIG !== 'undefined' && CONFIG.score) {
            CONFIG.score.winComboThreshold = v;
        }
        // Si el juego ya está corriendo, el cálculo de comboLevel usa CONFIG.score.winComboThreshold
        // y se actualizará automáticamente en draw().
        // Además, si el combo actual ya supera el nuevo umbral, dispara victoria inmediatamente.
        if (typeof scoreSystem !== 'undefined' && scoreSystem && !scoreSystem.win) {
            if (scoreSystem.comboCount >= v) {
                scoreSystem.win = true;
                // Usar animación unificada
                scoreSystem.winAnimation = new EndAnimation({ type: 'win' });
            }
        }
        console.log('Umbral de combo para ganar actualizado:', v);
    }

    // Nuevo: actualizar tiempo de agarre en juego y items actuales
    updateHoverTime(value) {
        const v = parseInt(value);
        if (isNaN(v)) return;
        if (typeof CONFIG !== 'undefined' && CONFIG.wineGlasses) {
            CONFIG.wineGlasses.hoverTime = v;
        }
        if (typeof wineGlassSystem !== 'undefined' && wineGlassSystem && wineGlassSystem.glasses) {
            for (let i = 0; i < wineGlassSystem.glasses.length; i++) {
                const item = wineGlassSystem.glasses[i];
                if (item && !item.isBad) {
                    item.requiredHoverTime = v;
                }
            }
        }
        console.log('Tiempo de agarre actualizado:', v + 'ms');
    }

    // Actualizar vida de los objetos que caen (wineglasses)
    updateParticleLifespan(value) {
        const v = parseInt(value);
        if (isNaN(v)) return;
        
        // Actualizar la vida de los objetos que caen (copas de vino y items malos)
        window.objectLifeMs = v;
        
        // También actualizar el fade time (20% de la vida total)
        window.objectFadeMs = Math.max(200, v * 0.2);
        
        console.log('Vida de objetos actualizada:', v + 'ms', 'Fade:', window.objectFadeMs + 'ms');
    }

    // === Área de colisión: exponer valores al juego ===
    updateCollisionAreaEnabled(enabled) {
        window.collisionArea = window.collisionArea || { enabled: false, x: 0, y: 0, width: 0, height: 0 };
        window.collisionArea.enabled = !!enabled;
        console.log('Área de colisión habilitada:', !!enabled);
    }
    updateCollisionAreaValue(key, value) {
        window.collisionArea = window.collisionArea || { enabled: false, x: 0, y: 0, width: 0, height: 0 };
        window.collisionArea[key] = value;
        // Persistir tal cual en configData (sin restricciones)
        if (this.configData && this.configData.gameSettings) {
            this.configData.gameSettings.collisionArea = this.configData.gameSettings.collisionArea || {};
            this.configData.gameSettings.collisionArea[key] = window.collisionArea[key];
        }
        console.log('Área de colisión actualizada (sin clamps):', window.collisionArea);
    }

    updateCollisionAreaOverlay(show) {
        window.collisionArea = window.collisionArea || { enabled: false, x: 0, y: 0, width: 0, height: 0 };
        window.collisionArea.showOverlay = !!show;
        if (this.configData && this.configData.gameSettings) {
            this.configData.gameSettings.collisionArea = this.configData.gameSettings.collisionArea || {};
            this.configData.gameSettings.collisionArea.showOverlay = !!show;
        }
        console.log('Overlay de área de colisión:', !!show);
    }

    // Getters auxiliares
    getCurrentFallSpeed() {
        return this.fallSpeedSlider ? parseFloat(this.fallSpeedSlider.value) : 2.25;
    }

    getCurrentLives() {
        return this.livesSlider ? parseInt(this.livesSlider.value) : 3;
    }

    startMetricsUpdate() {
        // Actualizar métricas cada 100ms para una respuesta fluida
        setInterval(() => {
            this.updateMetrics();
        }, 100);
    }
    
    updateMetrics() {

        // FPS solo en STATS: prioriza p5.frameRate(), fallback por frameCount
        if (typeof frameRate === 'function') {
            const fpsVal = Math.round(frameRate());
            if (this.statsFpsCounter) this.statsFpsCounter.textContent = fpsVal;
        } else {
            const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            if (typeof frameCount !== 'undefined') {
                const prevFrames = this._prevFrameCount || frameCount;
                const prevTime = this._prevFpsTime || now;
                const framesElapsed = frameCount - prevFrames;
                const timeElapsed = now - prevTime;
                if (timeElapsed > 0) {
                    const fpsCalc = Math.round((framesElapsed / timeElapsed) * 1000);
                    if (this.statsFpsCounter) this.statsFpsCounter.textContent = fpsCalc;
                }
                this._prevFrameCount = frameCount;
                this._prevFpsTime = now;
            }
        }
        // STATS: Objetos cayendo
        if (this.statsFallingObjectsCount && typeof wineGlassSystem !== 'undefined' && wineGlassSystem) {
            const totalStatsObjects = wineGlassSystem.glasses.length + wineGlassSystem.badItems.length;
            this.statsFallingObjectsCount.textContent = totalStatsObjects;
        }
        // STATS: Cantidad de puntos del PointServer
        if (this.statsPointsCount && typeof Pserver !== 'undefined' && Pserver && typeof Pserver.getAllPoints === 'function') {
            this.statsPointsCount.textContent = Pserver.getAllPoints().length;
        }
    }

    // === Halos: exponer valores al juego ===
    hexToVec3(hex) {
        if (!hex) return [1.0, 1.0, 1.0];
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0, 2), 16) / 255.0;
        const g = parseInt(h.substring(2, 4), 16) / 255.0;
        const b = parseInt(h.substring(4, 6), 16) / 255.0;
        return [r, g, b];
    }

    updateHaloSettings() {
        const goodSize = this.goodHaloSizeSlider ? parseFloat(this.goodHaloSizeSlider.value) : 0.12;
        const goodStrength = this.goodHaloStrengthSlider ? parseFloat(this.goodHaloStrengthSlider.value) : 0.35;
        const goodColorHex = this.goodHaloColorInput ? this.goodHaloColorInput.value : '#FFD966';
        const badSize = this.badHaloSizeSlider ? parseFloat(this.badHaloSizeSlider.value) : 0.14;
        const badStrength = this.badHaloStrengthSlider ? parseFloat(this.badHaloStrengthSlider.value) : 0.27;
        const badColorHex = this.badHaloColorInput ? this.badHaloColorInput.value : '#FF3333';

        window.goodHaloSettings = { size: goodSize, strength: goodStrength, color: this.hexToVec3(goodColorHex) };
        window.badHaloSettings = { size: badSize, strength: badStrength, color: this.hexToVec3(badColorHex) };
    }
    
    // === Shader Controls ===
    updateBackgroundBrightness(value) {
        if (typeof window !== 'undefined') {
            window.backgroundBrightness = value;
        }
    }
    
    updateWaveSpeed(value) {
        if (typeof window !== 'undefined') {
            window.waveSpeed = value;
        }
    }
    
    updateWaveForce(value) {
        if (typeof window !== 'undefined') {
            window.waveForce = value;
        }
    }
    
    updateWaveDuration(value) {
        if (typeof window !== 'undefined') {
            window.waveDuration = value;
        }
    }

    // === Cursor Halo Controls ===
    updateCursorHaloSize(value) {
        if (typeof window !== 'undefined') {
            window.cursorHaloSize = value;
        }
    }
    updateCursorHaloStrength(value) {
        if (typeof window !== 'undefined') {
            window.cursorHaloStrength = value;
        }
    }

    // === Button Visibility Controls ===
    updateButtonVisibility() {
        const showCoop = this.showCooperativeButton ? this.showCooperativeButton.checked : true;
        const showComp = this.showCompetitiveButton ? this.showCompetitiveButton.checked : true;
        
        if (typeof window !== 'undefined') {
            window.showCooperativeButton = showCoop;
            window.showCompetitiveButton = showComp;
        }
        
        // Actualizar la pantalla de selección si existe
        if (typeof selectionScreen !== 'undefined' && selectionScreen) {
            selectionScreen.updateButtonVisibility(showCoop, showComp);
        }
        
        console.log('Visibilidad de botones actualizada - Cooperativo:', showCoop, 'Competitivo:', showComp);
    }

    // === Win/Lose Text Controls ===
    updateWinLoseTextSize(value) {
        if (typeof CONFIG !== 'undefined') {
            if (CONFIG.win && CONFIG.win.text) {
                CONFIG.win.text.size = value;
            }
            if (CONFIG.gameOver && CONFIG.gameOver.text) {
                CONFIG.gameOver.text.size = value;
            }
        }
        if (typeof window !== 'undefined') {
            window.winLoseTextSize = value;
        }
        console.log('Tamaño de texto win/lose actualizado:', value);
    }

    updateWinText(text) {
        if (typeof window !== 'undefined') {
            window.winText = text || 'GANASTE';
        }
        console.log('Texto de victoria actualizado:', text);
    }

    updateLoseText(text) {
        if (typeof window !== 'undefined') {
            window.loseText = text || 'PERDISTE';
        }
        console.log('Texto de derrota actualizado:', text);
    }

    updateScoreTextSize(value) {
        if (typeof window !== 'undefined') {
            window.scoreTextSize = value;
        }
        console.log('Tamaño de texto de puntuación actualizado:', value);
    }

    updateComboTextSize(value) {
        if (typeof window !== 'undefined') {
            window.comboTextSize = value;
        }
        console.log('Tamaño de texto de combo actualizado:', value);
    }

    // === Stubs de Assets para evitar errores y desbloquear métricas ===
    setupAssetManagement() {
        // Inicialización de referencias y listas
        this.objectsGrid = document.getElementById('currentObjectsGrid');
        this.badItemsGrid = document.getElementById('currentBadItemsGrid');
        this.backgroundsGrid = document.getElementById('currentBackgroundsGrid');
        // Usar copias para detectar cambios posteriores (preload llena luego)
        const g = Array.isArray(window.goodItemImagePaths) ? window.goodItemImagePaths.slice() : [];
        const b = Array.isArray(window.badItemImagePaths) ? window.badItemImagePaths.slice() : [];
        const bg = Array.isArray(window.backgroundImagePaths) ? window.backgroundImagePaths.slice() : [];
        this.currentAssets = { objects: g, badItems: b, backgrounds: bg };
    }

    // Esta función ahora es redundante ya que loadAssetsFromConfig() maneja la carga
    loadAssetsFromLocalStorage() {
        // Los assets ahora se cargan desde panel-config.json en loadAssetsFromConfig()
        console.log('Assets se cargan desde panel-config.json, no desde localStorage');
    }

    loadCurrentAssets() {
        const renderGrid = (gridElem, list, category) => {
            if (!gridElem) return;
            gridElem.innerHTML = '';
            list.forEach((path, idx) => {
                const item = document.createElement('div');
                item.className = 'preview-item';
                const img = document.createElement('img');
                img.src = path;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                const del = document.createElement('button');
                del.textContent = '×';
                del.className = 'remove-btn';
                del.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await this.removeAsset(category, idx);
                });
                item.appendChild(img);
                item.appendChild(del);
                gridElem.appendChild(item);
            });
        };
        renderGrid(this.objectsGrid, this.currentAssets.objects, 'objects');
        renderGrid(this.badItemsGrid, this.currentAssets.badItems, 'badItems');
        renderGrid(this.backgroundsGrid, this.currentAssets.backgrounds, 'backgrounds');
    }
    
/* startAssetsAutoRefresh (old) removed */
    
    startAssetsAutoRefresh() {
        let tries = 0;
        this._assetsRefreshTimer = setInterval(() => {
            const g = Array.isArray(window.goodItemImagePaths) ? window.goodItemImagePaths : [];
            const b = Array.isArray(window.badItemImagePaths) ? window.badItemImagePaths : [];
            const bg = Array.isArray(window.backgroundImagePaths) ? window.backgroundImagePaths : [];
            const loadedSig = g.join('|') + '|' + b.join('|') + '|' + bg.join('|');
            const currentSig = (this.currentAssets.objects || []).join('|') + '|' +
                               (this.currentAssets.badItems || []).join('|') + '|' +
                               (this.currentAssets.backgrounds || []).join('|');
            if (loadedSig !== currentSig) {
                this.currentAssets.objects = g.slice();
                this.currentAssets.badItems = b.slice();
                this.currentAssets.backgrounds = bg.slice();
                this.loadCurrentAssets();
            }
            tries++;
            if (tries >= 10) {
                clearInterval(this._assetsRefreshTimer);
            }
        }, 800);
    }
    
    async removeAsset(category, index) {
        const lists = this.currentAssets;
        if (!lists[category] || index < 0 || index >= lists[category].length) return;
        lists[category].splice(index, 1);
        // Sincronizar arrays globales de rutas
        if (category === 'objects') {
            window.goodItemImagePaths = lists.objects;
        } else if (category === 'badItems') {
            window.badItemImagePaths = lists.badItems;
        } else if (category === 'backgrounds') {
            window.backgroundImagePaths = lists.backgrounds;
        }
        // Reconstruir imágenes del juego
        this.reloadGameImagesFromPaths();
        // Re-renderizar (sin guardar automáticamente)
        this.loadCurrentAssets();
    }

    async reloadGameImagesFromPaths() {
        if (typeof window !== 'undefined') {
            window.assetsReady = false;
        }
        const loadCategory = async (paths, targetArray) => {
            targetArray.length = 0;
            const promises = (paths || []).map((path, idx) => new Promise((resolve) => {
                targetArray[idx] = null;
                if (typeof loadImage === 'function') {
                    loadImage(path,
                        (img) => { img.__loaded = true; targetArray[idx] = img; resolve(true); },
                        () => { targetArray[idx] = null; resolve(false); }
                    );
                } else {
                    resolve(true);
                }
            }));
            await Promise.all(promises);
        };
        // Reconstruir buenos
        if (window.goodItemImages) {
            await loadCategory(window.goodItemImagePaths || [], window.goodItemImages);
        }
        // Reconstruir malos
        if (window.badItemImages) {
            await loadCategory(window.badItemImagePaths || [], window.badItemImages);
        }
        // Reconstruir fondos
        if (window.backgroundTextures) {
            await loadCategory(window.backgroundImagePaths || [], window.backgroundTextures);
            window.backgroundTexturesLoaded = window.backgroundTextures.length > 0;
        }
        // Ajustar índices del fondo dinámico
        if (typeof dynamicBackground !== 'undefined' && dynamicBackground) {
            dynamicBackground.currentTextureIndex = 0;
            dynamicBackground.nextTextureIndex = (window.backgroundTextures && window.backgroundTextures.length > 1) ? 1 : 0;
        }
        // Marcar assets listos y pre-escalar
        if (typeof window.ensureAssetsReady === 'function') {
            await window.ensureAssetsReady();
        } else if (typeof window.preScaleImages === 'function') {
            window.preScaleImages();
        }
        if (typeof window !== 'undefined') {
            window.assetsReady = true;
        }
    }

    async saveAssetsToConfig() {
        // Actualizar assets en la configuración y guardar archivo JSON
        if (!this.configData.assets) this.configData.assets = {};
        this.configData.assets.objects = window.goodItemImagePaths.slice();
        this.configData.assets.badItems = window.badItemImagePaths.slice();
        this.configData.assets.backgrounds = window.backgroundImagePaths.slice();
        
        // Actualizar metadatos
        this.configData.metadata = this.configData.metadata || {};
        this.configData.metadata.lastModified = new Date().toISOString().split('T')[0];
        
        // Guardar archivo JSON actualizado
        await this.saveConfigToFile(this.configData);
        console.log('Assets guardados en panel-config.json');
    }

    setupGalleryNavigation() {
        if (!this.galleryNavButtons || !this.gallerySections) return;
        this.galleryNavButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.galleryNavButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const category = btn.getAttribute('data-category');
                if (!category) return;
                if (category === 'all') {
                    this.gallerySections.forEach(sec => sec.style.display = 'block');
                } else {
                    this.gallerySections.forEach(sec => {
                        const show = (category === 'objects' && sec.id === 'objects-gallery') ||
                                     (category === 'badItems' && sec.id === 'badItems-gallery') ||
                                     (category === 'backgrounds' && sec.id === 'backgrounds-gallery');
                        sec.style.display = show ? 'block' : 'none';
                    });
                }
            });
        });
        // Estado inicial: mostrar todas las secciones y marcar "All" activo
        const allBtn = document.querySelector('.gallery-nav-btn[data-category="all"]');
        if (allBtn) allBtn.classList.add('active');
        this.gallerySections.forEach(sec => sec.style.display = 'block');
    }

    setupSaveChanges() {
        this.saveChangesBtn = document.getElementById('saveChangesBtn');
        this.saveStatus = document.getElementById('saveStatus');
        if (this.saveChangesBtn) {
            this.saveChangesBtn.addEventListener('click', async (e) => {
                // Evitar cualquier comportamiento por defecto que pudiera provocar recarga
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                try {
                    if (this.saveStatus) { this.saveStatus.textContent = 'Guardando...'; }
                    const ok = await this.saveConfiguration();
                    if (ok) {
                        this.showSaveNotification('✅ Configuración guardada en el servidor');
                        if (this.saveStatus) {
                            this.saveStatus.textContent = 'Guardado';
                            setTimeout(() => { this.saveStatus.textContent = ''; }, 1500);
                        }
                    } else {
                        this.showSaveNotification('❌ Error al guardar configuración', 'error');
                        if (this.saveStatus) { this.saveStatus.textContent = 'Error'; }
                    }
                } catch (e) {
                    this.showSaveNotification('❌ Error al guardar');
                }
            });
        }
    }

    setupAssetUploadModal() {
        const openBtn = document.getElementById('addAssetBtn');
        const modal = document.getElementById('assetUploadModal');
        const closeBtn = document.getElementById('closeModalBtn');
        const typeButtons = document.querySelectorAll('.asset-type-btn');
        const hiddenInput = document.getElementById('hiddenFileInput');
        let selectedType = null;

        if (openBtn && modal) {
            openBtn.addEventListener('click', () => { modal.style.display = 'block'; });
        }
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => { modal.style.display = 'none'; selectedType = null; });
        }
        if (typeButtons && hiddenInput) {
            hiddenInput.accept = 'image/*';
            typeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const t = btn.getAttribute('data-type');
                    if (!t) return;
                    selectedType = t;
                    hiddenInput.value = '';
                    hiddenInput.click();
                });
            });

            hiddenInput.addEventListener('change', async () => {
                const files = Array.from(hiddenInput.files || []);
                if (!files.length || !selectedType) { modal.style.display = 'none'; return; }

                try {
                    const serverPaths = await this.uploadFilesToServer(selectedType, files);
                    if (selectedType === 'objects') {
                        window.goodItemImagePaths = (window.goodItemImagePaths || []).concat(serverPaths);
                        this.currentAssets.objects = window.goodItemImagePaths.slice();
                    } else if (selectedType === 'badItems') {
                        window.badItemImagePaths = (window.badItemImagePaths || []).concat(serverPaths);
                        this.currentAssets.badItems = window.badItemImagePaths.slice();
                    } else if (selectedType === 'backgrounds') {
                        window.backgroundImagePaths = (window.backgroundImagePaths || []).concat(serverPaths);
                        this.currentAssets.backgrounds = window.backgroundImagePaths.slice();
                    }
                    await this.reloadGameImagesFromPaths();
                    this.loadCurrentAssets();
                    this.showSaveNotification('✅ Imágenes subidas y añadidas. Presiona "Guardar cambios" para guardar');
                } catch (e) {
                    console.log('Error al subir archivos:', e);
                    this.showSaveNotification('❌ Error al subir imágenes');
                } finally {
                    modal.style.display = 'none';
                    selectedType = null;
                    hiddenInput.value = '';
                }
            });
        }
    }

    // Configuración de navegación por pestañas
    setupTabNavigation() {
        if (!this.tabButtons || !this.tabContents) return;
        
        this.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetTab = e.target.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });
    }
    
    switchTab(tabName) {
        if (!this.tabContents) return;
        this.tabButtons.forEach(btn => btn.classList.remove('active'));
        this.tabContents.forEach(tab => tab.classList.remove('active'));
        
        const targetBtn = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
        const targetTab = document.getElementById(`${tabName}-tab`);
        if (targetBtn) targetBtn.classList.add('active');
        if (targetTab) targetTab.classList.add('active');
    }

    async uploadFilesToServer(category, files) {
        const fd = new FormData();
        files.forEach(f => fd.append('files', f));
        const res = await fetch(`/api/upload-assets/${category}`, { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const json = await res.json();
        if (!json.ok) throw new Error('Server rejected upload');
        return json.paths || [];
    }

    async ensureAssetsAreServerPaths(assets) {
        const processCategory = async (category, list) => {
            const urls = [];
            const toUploadBlobs = [];
            for (let i = 0; i < (list || []).length; i++) {
                const p = list[i];
                if (typeof p === 'string' && p.startsWith('data:')) {
                    try {
                        const blob = await (await fetch(p)).blob();
                        const ext = (blob.type || 'image/png').split('/')[1] || 'png';
                        const file = new File([blob], `inline-${Date.now()}-${i}.${ext}`, { type: blob.type });
                        toUploadBlobs.push(file);
                    } catch (e) {
                        console.warn('No se pudo convertir data URL a archivo:', e);
                    }
                } else {
                    urls.push(p);
                }
            }
            if (toUploadBlobs.length > 0) {
                try {
                    const newPaths = await this.uploadFilesToServer(category, toUploadBlobs);
                    urls.push(...newPaths);
                } catch (e) {
                    console.error('Falló la subida de data URLs como archivos:', e);
                }
            }
            return urls;
        };

        const objects = await processCategory('objects', assets.objects || []);
        const badItems = await processCategory('badItems', assets.badItems || []);
        const backgrounds = await processCategory('backgrounds', assets.backgrounds || []);
        return { objects, badItems, backgrounds };
    }
}
 
 // Inicializar el panel de control cuando se cargue la página
let controlPanel;

// Función para inicializar el panel
function initControlPanel() {
    if (!controlPanel) {
        controlPanel = new ControlPanel();
        
        // Hacer el panel accesible globalmente
        window.controlPanel = controlPanel;
    }
}

// Inicializar inmediatamente si el DOM ya está listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initControlPanel);
} else {
    initControlPanel();
}

// Funciones auxiliares para que otros scripts puedan acceder a los valores
window.getControlPanelFallSpeed = function() {
    return controlPanel ? controlPanel.getCurrentFallSpeed() : 2.25;
};

window.getControlPanelLives = function() {
    return controlPanel ? controlPanel.getCurrentLives() : 3;
};

// Getters para halos
window.getGoodHaloSettings = function() {
    return window.goodHaloSettings || { size: 0.12, strength: 0.35, color: [1.0, 0.85, 0.2] };
};
window.getBadHaloSettings = function() {
    return window.badHaloSettings || { size: 0.14, strength: 0.27, color: [1.0, 0.2, 0.2] };
};