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
        this.configData = null;
        
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
        await this.loadAssetsFromConfig();
        this.loadHaloSettingsFromConfig();
        this.loadCurrentAssets(); // Renderizar assets en el panel
        console.log('Configuración cargada exitosamente desde panel-config.json');
    }
    
    createDefaultConfiguration() {
        this.configData = {
            gameSettings: {
                fallSpeed: { current: 2.25, default: 2.25 },
                lives: { current: 3, default: 3 },
                objectSize: { current: 100, default: 100 },
                spawnRate: { current: 2000, default: 2000 },
                winComboThreshold: { current: 20, default: 20 },
                hoverTime: { current: 1000, default: 1000 }
            }
        };
    }
    
    // Funciones de manejo de archivo JSON
    async loadConfigFromFile() {
        try {
            const response = await fetch('./panel-config.json');
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
        try {
            // En un entorno web, no podemos escribir directamente archivos
            // Pero podemos descargar el archivo actualizado
            const dataStr = JSON.stringify(config, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            
            // Crear enlace de descarga
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'panel-config.json';
            
            // Simular click para descargar
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Limpiar URL
            URL.revokeObjectURL(url);
            
            this.showSaveNotification('✅ Configuración guardada! Reemplaza el archivo panel-config.json en tu proyecto');
            return true;
        } catch (error) {
            console.error('Error al guardar configuración:', error);
            this.showSaveNotification('❌ Error al guardar configuración', 'error');
            return false;
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
    
    applyConfiguration() {
        if (!this.configData || !this.configData.gameSettings) return;
        const settings = this.configData.gameSettings;
        
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

        // Aplicar a juego (valores iniciales)
        this.updateHaloSettings();
    }

    async saveConfiguration() {
        if (!this.configData) return;
        
        // Actualizar valores actuales en la configuración
        this.configData.gameSettings.fallSpeed.current = parseFloat(this.fallSpeedSlider.value);
        this.configData.gameSettings.lives.current = parseInt(this.livesSlider.value);
        this.configData.gameSettings.objectSize.current = parseInt(this.objectSizeSlider.value);
        this.configData.gameSettings.spawnRate.current = parseInt(this.spawnRateSlider.value);
        if (this.winComboSlider) this.configData.gameSettings.winComboThreshold.current = parseInt(this.winComboSlider.value);
        if (this.hoverTimeSlider) this.configData.gameSettings.hoverTime.current = parseInt(this.hoverTimeSlider.value);
        
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
        
        // Actualizar assets
        if (!this.configData.assets) this.configData.assets = {};
        this.configData.assets.objects = window.goodItemImagePaths.slice();
        this.configData.assets.badItems = window.badItemImagePaths.slice();
        this.configData.assets.backgrounds = window.backgroundImagePaths.slice();
        
        // Actualizar metadatos
        this.configData.metadata = this.configData.metadata || {};
        this.configData.metadata.lastModified = new Date().toISOString().split('T')[0];
        
        // Guardar en archivo JSON
        await this.saveConfigToFile(this.configData);
        console.log('Configuración completa guardada en panel-config.json');
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
        this.fallSpeedSlider = document.getElementById('fallSpeedSlider');
        this.livesSlider = document.getElementById('livesSlider');
        this.fallSpeedValue = document.getElementById('fallSpeedValue');
        this.livesValue = document.getElementById('livesValue');
        this.objectSizeSlider = document.getElementById('objectSizeSlider');
        this.objectSizeValue = document.getElementById('objectSizeValue');
        this.spawnRateSlider = document.getElementById('spawnRateSlider');
        this.spawnRateValue = document.getElementById('spawnRateValue');
        
        // Nuevo: umbral de combo para ganar
        this.winComboSlider = document.getElementById('winComboSlider');
        this.winComboValue = document.getElementById('winComboValue');
        // Nuevo: slider de tiempo de agarre
        this.hoverTimeSlider = document.getElementById('hoverTimeSlider');
        this.hoverTimeValue = document.getElementById('hoverTimeValue');
        
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
    }
    
    setupEventListeners() {
        // Listener para la tecla P
        document.addEventListener('keydown', (event) => {
            if (event.key.toLowerCase() === 'p') {
                event.preventDefault();
                this.toggle();
            }
        });
        
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
                scoreSystem.winAnimation = new WinAnimation();
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
            this.saveChangesBtn.addEventListener('click', () => {
                try {
                    this.saveConfiguration();
                    this.showSaveNotification('✅ Configuración guardada');
                    if (this.saveStatus) {
                        this.saveStatus.textContent = 'Guardado';
                        setTimeout(() => { this.saveStatus.textContent = ''; }, 1500);
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

                const addDataUrl = (dataURL) => {
                    if (selectedType === 'objects') {
                        window.goodItemImagePaths = (window.goodItemImagePaths || []).concat([dataURL]);
                        this.currentAssets.objects = window.goodItemImagePaths.slice();
                    } else if (selectedType === 'badItems') {
                        window.badItemImagePaths = (window.badItemImagePaths || []).concat([dataURL]);
                        this.currentAssets.badItems = window.badItemImagePaths.slice();
                    } else if (selectedType === 'backgrounds') {
                        window.backgroundImagePaths = (window.backgroundImagePaths || []).concat([dataURL]);
                        this.currentAssets.backgrounds = window.backgroundImagePaths.slice();
                    }
                };

                const readers = files.map(file => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = (e) => reject(e);
                    reader.readAsDataURL(file);
                }));

                try {
                    const urls = await Promise.all(readers);
                    urls.forEach(addDataUrl);
                    this.reloadGameImagesFromPaths();
                    this.loadCurrentAssets();
                    this.showSaveNotification('✅ Asset(s) cargado(s) - Presiona "Guardar cambios" para guardar');
                } catch (e) {
                    console.log('Error al leer archivos:', e);
                    this.showSaveNotification('❌ Error al cargar asset(s)');
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