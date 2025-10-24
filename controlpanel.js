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
        this.fallingObjectsCount = null;
        this.objectSize = null;
        
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
                spawnRate: { current: 2000, default: 2000 }
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
    }
    
    saveConfiguration() {
        if (!this.configData) return;
        
        // Actualizar valores actuales en la configuración
        this.configData.gameSettings.fallSpeed.current = parseFloat(this.fallSpeedSlider.value);
        this.configData.gameSettings.lives.current = parseInt(this.livesSlider.value);
        this.configData.gameSettings.objectSize.current = parseInt(this.objectSizeSlider.value);
        this.configData.gameSettings.spawnRate.current = parseInt(this.spawnRateSlider.value);
        
        // Actualizar metadatos
        this.configData.metadata.lastModified = new Date().toISOString().split('T')[0];
        
        // Guardar en localStorage (ya que no podemos escribir archivos directamente)
        localStorage.setItem('rgbMadnessConfig', JSON.stringify(this.configData, null, 2));
        console.log('Configuración guardada en localStorage');
        
        // Mostrar notificación visual
        this.showSaveNotification();
    }
    
    showSaveNotification() {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.textContent = '✅ Configuración guardada';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 255, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
        `;
        
        document.body.appendChild(notification);
        
        // Remover después de 2 segundos
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
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
        
        // Elementos de métricas
        this.fallingObjectsCount = document.getElementById('fallingObjectsCount');
        this.objectSize = document.getElementById('objectSize');
        
        // Elementos de pestañas
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // Elementos de assets
        this.backgroundUpload = document.getElementById('backgroundUpload');
        this.objectUpload = document.getElementById('objectUpload');
        this.badItemUpload = document.getElementById('badItemUpload');
        
        // Elementos de galería
        this.galleryNavButtons = document.querySelectorAll('.gallery-nav-btn');
        this.gallerySections = document.querySelectorAll('.gallery-section');
        
        // Elementos de guardar cambios
        this.saveChangesBtn = document.getElementById('saveChangesBtn');
        this.saveStatus = document.getElementById('saveStatus');
        
        if (!this.panel) {
            console.error('Panel de control no encontrado');
            return;
        }
        
        this.setupEventListeners();
        this.setupTabNavigation();
        this.setupAssetManagement();
        this.setupGalleryNavigation();
        this.setupSaveChanges();
        this.loadCurrentAssets();
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
    
    // Métodos para obtener valores actuales
    getCurrentFallSpeed() {
        return this.fallSpeedSlider ? parseFloat(this.fallSpeedSlider.value) : this.defaultFallSpeed;
    }
    
    getCurrentLives() {
        return this.livesSlider ? parseInt(this.livesSlider.value) : this.defaultLives;
    }
    
    // Métodos para actualizar métricas en tiempo real
    startMetricsUpdate() {
        // Actualizar métricas cada 100ms para una respuesta fluida
        setInterval(() => {
            this.updateMetrics();
        }, 100);
    }
    
    updateMetrics() {
        // Actualizar contador de objetos que caen
        if (this.fallingObjectsCount && typeof wineGlassSystem !== 'undefined' && wineGlassSystem) {
            const totalObjects = wineGlassSystem.glasses.length + wineGlassSystem.badItems.length;
            this.fallingObjectsCount.textContent = totalObjects;
        }
        
        // Actualizar tamaño de objetos
        if (this.objectSize && typeof CONFIG !== 'undefined' && CONFIG.wineGlasses) {
            const size = CONFIG.wineGlasses.itemSize;
            this.objectSize.textContent = size + 'px';
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
        // Actualizar botones
        this.tabButtons.forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('data-tab') === tabName) {
                button.classList.add('active');
            }
        });
        
        // Actualizar contenido
        this.tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === `${tabName}-tab`) {
                content.classList.add('active');
            }
        });
        
        this.currentTab = tabName;
    }
    
    // Configuración de gestión de assets
    setupAssetManagement() {
        if (this.backgroundUpload) {
            this.backgroundUpload.addEventListener('change', (e) => {
                this.handleFileUpload(e, 'backgrounds', { width: 1920, height: 1080 });
            });
        }
        
        if (this.objectUpload) {
            this.objectUpload.addEventListener('change', (e) => {
                this.handleFileUpload(e, 'objects', { width: 512, height: 512 });
            });
        }
        
        if (this.badItemUpload) {
            this.badItemUpload.addEventListener('change', (e) => {
                this.handleFileUpload(e, 'badItems', { width: 512, height: 512 });
            });
        }
        
        // Botones de acción
        const resetButton = document.getElementById('resetAssets');
        const exportButton = document.getElementById('exportAssets');
        
        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetAssets());
        }
        
        if (exportButton) {
            exportButton.addEventListener('click', () => this.exportAssets());
        }
    }
    
    // Manejo de carga de archivos
    async handleFileUpload(event, assetType, requiredDimensions) {
        const files = Array.from(event.target.files);
        const previewContainer = document.getElementById(`${assetType === 'objects' ? 'object' : assetType === 'badItems' ? 'badItem' : 'background'}Preview`);
        
        for (const file of files) {
            try {
                const isValid = await this.validateImageDimensions(file, requiredDimensions);
                
                if (isValid) {
                    const assetData = await this.processAsset(file, assetType);
                    this.customAssets[assetType].push(assetData);
                    this.addPreviewItem(previewContainer, assetData, assetType);
                    this.showValidationMessage(previewContainer, `✅ ${file.name} cargado correctamente`, 'success');
                } else {
                    this.showValidationMessage(previewContainer, 
                        `❌ ${file.name}: Dimensiones incorrectas. Requerido: ${requiredDimensions.width}x${requiredDimensions.height}px`, 
                        'error');
                }
            } catch (error) {
                this.showValidationMessage(previewContainer, `❌ Error al procesar ${file.name}: ${error.message}`, 'error');
            }
        }
        
        // Limpiar input
        event.target.value = '';
    }
    
    // Validación de dimensiones de imagen
    validateImageDimensions(file, requiredDimensions) {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                const isValid = img.width === requiredDimensions.width && img.height === requiredDimensions.height;
                resolve(isValid);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(false);
            };
            
            img.src = url;
        });
    }
    
    // Procesamiento de asset
    async processAsset(file, assetType) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const assetData = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    type: assetType,
                    dataUrl: e.target.result,
                    size: file.size,
                    uploadDate: new Date().toISOString()
                };
                resolve(assetData);
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    // Agregar item de vista previa
    addPreviewItem(container, assetData, assetType) {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        previewItem.innerHTML = `
            <img src="${assetData.dataUrl}" alt="${assetData.name}" title="${assetData.name}">
            <button class="remove-btn" onclick="controlPanel.removeAsset('${assetData.id}', '${assetType}')">×</button>
        `;
        
        container.appendChild(previewItem);
    }
    
    // Mostrar mensaje de validación
    showValidationMessage(container, message, type) {
        // Remover mensajes anteriores
        const existingMessages = container.querySelectorAll('.validation-message');
        existingMessages.forEach(msg => msg.remove());
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `validation-message ${type}`;
        messageDiv.textContent = message;
        
        container.appendChild(messageDiv);
        
        // Auto-remover después de 3 segundos
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }
    
    // Remover asset
    removeAsset(assetId, assetType) {
        this.customAssets[assetType] = this.customAssets[assetType].filter(asset => asset.id !== assetId);
        
        // Actualizar vista previa
        const previewContainer = document.getElementById(`${assetType === 'objects' ? 'object' : assetType === 'badItems' ? 'badItem' : 'background'}Preview`);
        const previewItems = previewContainer.querySelectorAll('.preview-item');
        
        previewItems.forEach(item => {
            const removeBtn = item.querySelector('.remove-btn');
            if (removeBtn && removeBtn.getAttribute('onclick').includes(assetId)) {
                item.remove();
            }
        });
    }
    
    // Resetear assets a originales
    resetAssets() {
        if (confirm('¿Estás seguro de que quieres restaurar todos los assets originales? Se perderán los assets personalizados.')) {
            this.customAssets = {
                backgrounds: [],
                objects: [],
                badItems: []
            };
            
            // Limpiar vistas previas
            ['backgroundPreview', 'objectPreview', 'badItemPreview'].forEach(id => {
                const container = document.getElementById(id);
                if (container) {
                    container.innerHTML = '';
                }
            });
            
            console.log('Assets restaurados a originales');
        }
    }
    
    // Exportar assets personalizados
    exportAssets() {
        const exportData = {
            exportDate: new Date().toISOString(),
            customAssets: this.customAssets,
            totalAssets: Object.values(this.customAssets).reduce((total, arr) => total + arr.length, 0)
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `custom-assets-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        console.log('Assets exportados exitosamente');
    }
    
    // Configuración de navegación de galería
    setupGalleryNavigation() {
        if (!this.galleryNavButtons) return;
        
        this.galleryNavButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const category = e.target.getAttribute('data-category');
                this.switchGalleryCategory(category);
            });
        });
    }
    
    switchGalleryCategory(category) {
        // Actualizar botones
        this.galleryNavButtons.forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('data-category') === category) {
                button.classList.add('active');
            }
        });
        
        // Mostrar/ocultar secciones
        this.gallerySections.forEach(section => {
            if (category === 'all') {
                section.classList.remove('hidden');
            } else {
                const sectionId = section.id.replace('-gallery', '');
                if (sectionId === category) {
                    section.classList.remove('hidden');
                } else {
                    section.classList.add('hidden');
                }
            }
        });
        
        this.currentGalleryCategory = category;
    }
    
    // Cargar assets actuales del juego
    loadCurrentAssets() {
        // Definir los assets actuales del juego basados en la carpeta img/
        this.currentAssets = {
            objects: [
                { name: 'copa.png', path: 'img/objetos/copa.png', type: 'object' },
            { name: 'copa2.png', path: 'img/objetos/copa2.png', type: 'object' },
            { name: 'copa4.png', path: 'img/objetos/copa4.png', type: 'object' },
            { name: 'copaoro.png', path: 'img/objetos/copaoro.png', type: 'object' },
            { name: 'botella.png', path: 'img/objetos/botella.png', type: 'object' },
            { name: 'uva.png', path: 'img/objetos/uva.png', type: 'object' },
            { name: 'uva2.png', path: 'img/objetos/uva2.png', type: 'object' },
            { name: 'uva_roja.png', path: 'img/objetos/uva_roja.png', type: 'object' },
            { name: 'uva_roja2.png', path: 'img/objetos/uva_roja2.png', type: 'object' },
            { name: 'uva_verde.png', path: 'img/objetos/uva_verde.png', type: 'object' },
            { name: 'destapador.png', path: 'img/objetos/destapador.png', type: 'object' },
            { name: 'destapador2.png', path: 'img/objetos/destapador2.png', type: 'object' },
            { name: 'corcho.png', path: 'img/objetos/corcho.png', type: 'object' },
            { name: 'gota.png', path: 'img/objetos/gota.png', type: 'object' },
            { name: 'hoja.png', path: 'img/objetos/hoja.png', type: 'object' }
            ],
            badItems: [
                { name: 'bicho1.png', path: 'img/malos/bicho1.png', type: 'badItem' },
                { name: 'bicho2.png', path: 'img/malos/bicho2.png', type: 'badItem' },
                { name: 'bicho3.png', path: 'img/malos/bicho3.png', type: 'badItem' },
                { name: 'bicho4.png', path: 'img/malos/bicho4.png', type: 'badItem' },
                { name: 'bicho5.png', path: 'img/malos/bicho5.png', type: 'badItem' },
                { name: 'bicho6.png', path: 'img/malos/bicho6.png', type: 'badItem' },
                { name: 'bicho7.png', path: 'img/malos/bicho7.png', type: 'badItem' },
                { name: 'bicho8.png', path: 'img/malos/bicho8.png', type: 'badItem' }
            ],
            backgrounds: [
                { name: 'fondo1.jpg', path: 'img/background/fondo1.jpg', type: 'background' },
                { name: 'fondo2.jpg', path: 'img/background/fondo2.jpg', type: 'background' },
                { name: 'fondo3.jpg', path: 'img/background/fondo3.jpg', type: 'background' },
                { name: 'fondo4.jpg', path: 'img/background/fondo4.jpg', type: 'background' },
                { name: 'fondo5.jpg', path: 'img/background/fondo5.jpg', type: 'background' },
                { name: '1.jpg', path: 'img/1.jpg', type: 'background' },
                { name: '2.jpg', path: 'img/2.jpg', type: 'background' },
                { name: '3.jpg', path: 'img/3.jpg', type: 'background' },
                { name: '4.jpg', path: 'img/4.jpg', type: 'background' },
                { name: '5.jpg', path: 'img/5.jpg', type: 'background' },
                { name: '6.png', path: 'img/6.png', type: 'background' },
                { name: '7.png', path: 'img/7.png', type: 'background' },
                { name: '8.jpg', path: 'img/8.jpg', type: 'background' },
                { name: '9.jpg', path: 'img/9.jpg', type: 'background' },
                { name: '10.jpg', path: 'img/10.jpg', type: 'background' },
                { name: '11.jpg', path: 'img/11.jpg', type: 'background' },
                { name: '12.jpg', path: 'img/12.jpg', type: 'background' },
                { name: '13.jpg', path: 'img/13.jpg', type: 'background' }
            ]
        };
        
        // Renderizar los assets en la galería
        this.renderCurrentAssets();
    }
    
    // Renderizar assets actuales en la galería
    renderCurrentAssets() {
        // Renderizar objetos
        const objectsGrid = document.getElementById('currentObjectsGrid');
        if (objectsGrid) {
            objectsGrid.innerHTML = '';
            this.currentAssets.objects.forEach(asset => {
                this.addCurrentAssetItem(objectsGrid, asset);
            });
        }
        
        // Renderizar personajes malos
        const badItemsGrid = document.getElementById('currentBadItemsGrid');
        if (badItemsGrid) {
            badItemsGrid.innerHTML = '';
            this.currentAssets.badItems.forEach(asset => {
                this.addCurrentAssetItem(badItemsGrid, asset);
            });
        }
        
        // Renderizar fondos
        const backgroundsGrid = document.getElementById('currentBackgroundsGrid');
        if (backgroundsGrid) {
            backgroundsGrid.innerHTML = '';
            this.currentAssets.backgrounds.forEach(asset => {
                this.addCurrentAssetItem(backgroundsGrid, asset);
            });
        }
    }
    
    // Agregar item de asset actual a la galería
    addCurrentAssetItem(container, asset) {
        const assetItem = document.createElement('div');
        assetItem.className = 'current-asset-item';
        assetItem.innerHTML = `
            <img src="${asset.path}" alt="${asset.name}" onerror="this.style.display='none'">
            <div class="asset-name">${asset.name}</div>
            <div class="asset-actions">
                <button class="asset-action-btn replace-btn" onclick="controlPanel.replaceAsset('${asset.name}', '${asset.type}')">
                    🔄 Reemplazar
                </button>
                <button class="asset-action-btn delete-btn" onclick="controlPanel.deleteCurrentAsset('${asset.name}', '${asset.type}')">
                    🗑️ Eliminar
                </button>
            </div>
        `;
        
        container.appendChild(assetItem);
    }
    
    // Reemplazar asset actual
    replaceAsset(assetName, assetType) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        // Definir dimensiones requeridas según el tipo
        let requiredDimensions;
        if (assetType === 'background') {
            requiredDimensions = { width: 1920, height: 1080 };
        } else {
            requiredDimensions = { width: 512, height: 512 };
        }
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const isValid = await this.validateImageDimensions(file, requiredDimensions);
                    
                    if (isValid) {
                        // Procesar el nuevo asset
                        const newAssetData = await this.processAsset(file, assetType);
                        
                        // Agregar a assets personalizados
                        this.customAssets[assetType + 's'].push({
                            ...newAssetData,
                            replacesOriginal: assetName
                        });
                        
                        console.log(`Asset ${assetName} reemplazado exitosamente`);
                        alert(`✅ ${assetName} ha sido reemplazado exitosamente`);
                    } else {
                        alert(`❌ Error: La imagen debe tener dimensiones ${requiredDimensions.width}x${requiredDimensions.height} píxeles`);
                    }
                } catch (error) {
                    alert(`❌ Error al procesar la imagen: ${error.message}`);
                }
            }
        };
        
        input.click();
    }
    
    // Eliminar asset actual
    deleteCurrentAsset(assetName, assetType) {
        if (confirm(`¿Estás seguro de que quieres eliminar ${assetName}? Esta acción no se puede deshacer.`)) {
            // Encontrar y remover el asset de la lista actual
            const assetList = this.currentAssets[assetType + 's'] || this.currentAssets[assetType];
            if (assetList) {
                const index = assetList.findIndex(asset => asset.name === assetName);
                if (index !== -1) {
                    assetList.splice(index, 1);
                    this.renderCurrentAssets();
                    console.log(`Asset ${assetName} eliminado`);
                    alert(`✅ ${assetName} ha sido eliminado`);
                }
            }
         }
     }
     
     // Configuración del botón de guardar cambios
     setupSaveChanges() {
         if (!this.saveChangesBtn) return;
         
         this.saveChangesBtn.addEventListener('click', () => {
             this.saveConfiguration();
         });
     }
     
     // Guardar configuración actual
     async saveConfiguration() {
         if (!this.saveChangesBtn || !this.saveStatus) return;
         
         // Deshabilitar botón durante el guardado
         this.saveChangesBtn.disabled = true;
         this.saveChangesBtn.textContent = '💾 Guardando...';
         
         try {
             // Recopilar configuración actual
             const currentConfig = {
                 fallSpeed: parseFloat(this.fallSpeedSlider.value),
                 lives: parseInt(this.livesSlider.value),
                 objectSize: parseInt(this.objectSizeSlider.value),
                 spawnRate: parseInt(this.spawnRateSlider.value),
                 customAssets: this.customAssets,
                 lastSaved: new Date().toISOString()
             };
             
             // Guardar en localStorage
             localStorage.setItem('panel-config', JSON.stringify(currentConfig));
             
             // Actualizar configData
             this.configData = currentConfig;
             
             // Mostrar mensaje de éxito
             this.showSaveStatus('✅ Cambios guardados exitosamente', 'success');
             
             console.log('Configuración guardada:', currentConfig);
             
         } catch (error) {
             console.error('Error al guardar configuración:', error);
             this.showSaveStatus('❌ Error al guardar cambios', 'error');
         } finally {
             // Rehabilitar botón
             setTimeout(() => {
                 this.saveChangesBtn.disabled = false;
                 this.saveChangesBtn.textContent = '💾 Guardar Cambios';
             }, 1000);
         }
     }
     
     // Mostrar estado del guardado
     showSaveStatus(message, type) {
         if (!this.saveStatus) return;
         
         this.saveStatus.textContent = message;
         this.saveStatus.className = `save-status show ${type}`;
         
         // Ocultar mensaje después de 3 segundos
         setTimeout(() => {
             this.saveStatus.classList.remove('show');
         }, 3000);
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