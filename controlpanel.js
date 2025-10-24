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
        try {
            const response = await fetch('panel-config.json');
            this.configData = await response.json();
            this.applyConfiguration();
            console.log('Configuración cargada exitosamente');
        } catch (error) {
            console.warn('No se pudo cargar la configuración JSON, usando valores por defecto:', error);
            this.createDefaultConfiguration();
        }
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

    saveConfiguration() {
        if (!this.configData) return;
        
        // Actualizar valores actuales en la configuración
        this.configData.gameSettings.fallSpeed.current = parseFloat(this.fallSpeedSlider.value);
        this.configData.gameSettings.lives.current = parseInt(this.livesSlider.value);
        this.configData.gameSettings.objectSize.current = parseInt(this.objectSizeSlider.value);
        this.configData.gameSettings.spawnRate.current = parseInt(this.spawnRateSlider.value);
        if (this.winComboSlider) this.configData.gameSettings.winComboThreshold.current = parseInt(this.winComboSlider.value);
        if (this.hoverTimeSlider) this.configData.gameSettings.hoverTime.current = parseInt(this.hoverTimeSlider.value);
        
        // Halos
        if (this.goodHaloSizeSlider) this.configData.gameSettings.goodHaloSize.current = parseFloat(this.goodHaloSizeSlider.value);
        if (this.goodHaloStrengthSlider) this.configData.gameSettings.goodHaloStrength.current = parseFloat(this.goodHaloStrengthSlider.value);
        if (this.goodHaloColorInput) this.configData.gameSettings.goodHaloColor.current = this.goodHaloColorInput.value;
        if (this.badHaloSizeSlider) this.configData.gameSettings.badHaloSize.current = parseFloat(this.badHaloSizeSlider.value);
        if (this.badHaloStrengthSlider) this.configData.gameSettings.badHaloStrength.current = parseFloat(this.badHaloStrengthSlider.value);
        if (this.badHaloColorInput) this.configData.gameSettings.badHaloColor.current = this.badHaloColorInput.value;
        
        // Actualizar metadatos
        this.configData.metadata = this.configData.metadata || {};
        this.configData.metadata.lastModified = new Date().toISOString().split('T')[0];
        
        // Guardar en localStorage (ya que no podemos escribir archivos directamente)
        localStorage.setItem('rgbMadnessConfig', JSON.stringify(this.configData, null, 2));
        console.log('Configuración guardada en localStorage');
        
        // Mostrar notificación visual
        this.showSaveNotification();
    }
    
    showSaveNotification(message = '✅ Configuración guardada') {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.textContent = message;
        
        // Determinar color según el tipo de mensaje
        const isError = message.includes('❌');
        const bgColor = isError ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 255, 0, 0.8)';
        
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
        `;
        
        document.body.appendChild(notification);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 3000);
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
        this.setupGalleryNavigation();
        this.setupSaveChanges();
        this.setupAssetUploadModal();
        this.loadCurrentAssets();
        this.loadAssetsFromLocalStorage(); // Cargar assets guardados
        this.updateValues();
        this.startMetricsUpdate();
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
                this.saveConfiguration(); // Auto-guardar
            });
        }
        
        if (this.livesSlider) {
            this.livesSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value);
                this.livesValue.textContent = value;
                this.updateGameLives(value);
                this.saveConfiguration(); // Auto-guardar
            });
        }
        
        if (this.objectSizeSlider) {
            this.objectSizeSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value);
                this.objectSizeValue.textContent = value + 'px';
                this.updateObjectSize(value);
                this.saveConfiguration(); // Auto-guardar
            });
        }
        
        if (this.spawnRateSlider) {
            this.spawnRateSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value);
                this.spawnRateValue.textContent = (value / 1000).toFixed(1) + 's';
                this.updateSpawnRate(value);
                this.saveConfiguration(); // Auto-guardar
            });
        }

        // Control del umbral de combo para ganar
        if (this.winComboSlider) {
            this.winComboSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value);
                this.winComboValue.textContent = value;
                this.updateWinComboThreshold(value);
                this.saveConfiguration(); // Auto-guardar
            });
        }

        // Nuevo: control del tiempo de agarre
        if (this.hoverTimeSlider) {
            this.hoverTimeSlider.addEventListener('input', (event) => {
                const value = parseInt(event.target.value);
                this.hoverTimeValue.textContent = value + ' ms';
                this.updateHoverTime(value);
                this.saveConfiguration();
            });
        }
        
        // Eventos de halos
        if (this.goodHaloSizeSlider) {
            this.goodHaloSizeSlider.addEventListener('input', () => { this.updateHaloSettings(); this.saveConfiguration(); });
        }
        if (this.goodHaloStrengthSlider) {
            this.goodHaloStrengthSlider.addEventListener('input', () => { this.updateHaloSettings(); this.saveConfiguration(); });
        }
        if (this.goodHaloColorInput) {
            this.goodHaloColorInput.addEventListener('input', () => { this.updateHaloSettings(); this.saveConfiguration(); });
        }
        if (this.badHaloSizeSlider) {
            this.badHaloSizeSlider.addEventListener('input', () => { this.updateHaloSettings(); this.saveConfiguration(); });
        }
        if (this.badHaloStrengthSlider) {
            this.badHaloStrengthSlider.addEventListener('input', () => { this.updateHaloSettings(); this.saveConfiguration(); });
        }
        if (this.badHaloColorInput) {
            this.badHaloColorInput.addEventListener('input', () => { this.updateHaloSettings(); this.saveConfiguration(); });
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
        
        console.log('Velocidad de caída actualizada:', speed);
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
        
        console.log('Velocidad de aparición actualizada:', rate + 'ms');
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
        // Inicialización mínima para evitar errores si no hay lógica de assets todavía
        this.currentAssets = this.currentAssets || { objects: [], badItems: [], backgrounds: [] };
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
        if (openBtn && modal) {
            openBtn.addEventListener('click', () => { modal.style.display = 'block'; });
        }
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
        }
        if (typeButtons && hiddenInput) {
            typeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Por ahora solo cerramos el modal; la carga se implementará luego
                    modal.style.display = 'none';
                });
            });
        }
    }

    loadCurrentAssets() {
        // No-op por ahora: evitamos errores de llamada
        // Se puede implementar renderizado de grillas si es necesario
    }

    loadAssetsFromLocalStorage() {
        // No-op por ahora: futura implementación para restaurar assets
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