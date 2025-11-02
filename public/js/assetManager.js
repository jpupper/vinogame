// AssetManager: centraliza carga, preescalado y acceso a imágenes/shaders
// Mantiene compatibilidad exponiendo funciones en window cuando existen.

(function() {
  class AssetManager {
    constructor() {
      this.goodItemImages = [];
      this.badItemImages = [];
      this.backgroundTextures = [];
      this.goodItemImagePaths = [];
      this.badItemImagePaths = [];
      this.backgroundImagePaths = [];

      this.scaledGoodItemImages = {};
      this.scaledBadItemImages = {};
      this.scaledBackgroundImages = {};

      // Almacenes genéricos para imágenes y shaders por nombre
      this.images = {};
      this.shaders = {};

      this.assetsReady = false;
    }

    registerAssets({
      goodItemImages,
      badItemImages,
      backgroundTextures,
      goodItemImagePaths,
      badItemImagePaths,
      backgroundImagePaths
    }) {
      if (Array.isArray(goodItemImages)) this.goodItemImages = goodItemImages;
      if (Array.isArray(badItemImages)) this.badItemImages = badItemImages;
      if (Array.isArray(backgroundTextures)) this.backgroundTextures = backgroundTextures;
      if (Array.isArray(goodItemImagePaths)) this.goodItemImagePaths = goodItemImagePaths;
      if (Array.isArray(badItemImagePaths)) this.badItemImagePaths = badItemImagePaths;
      if (Array.isArray(backgroundImagePaths)) this.backgroundImagePaths = backgroundImagePaths;

      // Exponer para panel de control/otros módulos
      if (typeof window !== 'undefined') {
        window.goodItemImages = this.goodItemImages;
        window.badItemImages = this.badItemImages;
        window.backgroundTextures = this.backgroundTextures;
        window.goodItemImagePaths = this.goodItemImagePaths;
        window.badItemImagePaths = this.badItemImagePaths;
        window.backgroundImagePaths = this.backgroundImagePaths;
      }
    }

    // Carga inicial centralizada de imágenes (incluye medidor y trofeo)
    // Se puede invocar desde preload() para mantener la semántica de p5.
    initialLoad() {
      // Buenas
      const goodPaths = [
        'img/objetos/uva_roja.png',
        'img/objetos/uva_roja2.png',
        'img/objetos/uva_verde.png',
        'img/objetos/uva.png',
        'img/objetos/hoja.png',
        'img/objetos/copa.png',
        'img/objetos/copa2.png',
        'img/objetos/botella.png',
        'img/objetos/destapador.png',
        'img/objetos/destapador2.png'
      ];
      this.goodItemImagePaths = goodPaths.slice();
      this.goodItemImages = goodPaths.map(p => loadImage(p));

      // Malas
      const badPaths = [
        'img/malos/bicho1.png',
        'img/malos/bicho2.png',
        'img/malos/bicho3.png',
        'img/malos/bicho4.png',
        'img/malos/bicho5.png',
        'img/malos/bicho6.png',
        'img/malos/bicho7.png'
      ];
      this.badItemImagePaths = badPaths.slice();
      this.badItemImages = badPaths.map(p => loadImage(p));

      // Fondos
      const bgPaths = [
        'img/background/fondo1.jpg',
        'img/background/fondo2.jpg',
        'img/background/fondo3.jpg',
        'img/background/fondo4.jpg',
        'img/background/fondo5.jpg'
      ];
      this.backgroundImagePaths = bgPaths.slice();
      this.backgroundTextures = bgPaths.map(p => loadImage(p));

      // Medidor (copa y máscara) y su shader
      this.images.medidorGlass = loadImage('img/medidor/copa-vacia.png');
      this.images.medidorMask = loadImage('img/medidor/copa-vacia-mask.png');
      this.shaders.medidor = loadShader('sh/medidor.vert', 'sh/medidor.frag');

      // Trofeo
      this.images.trophy = loadImage('img/copa/copa.png');

      // Exponer globales para compatibilidad inmediata
      if (typeof window !== 'undefined') {
        window.goodItemImages = this.goodItemImages;
        window.badItemImages = this.badItemImages;
        window.backgroundTextures = this.backgroundTextures;
        window.goodItemImagePaths = this.goodItemImagePaths;
        window.badItemImagePaths = this.badItemImagePaths;
        window.backgroundImagePaths = this.backgroundImagePaths;
        window.trophyImage = this.images.trophy;
      }
    }

    // Getters genéricos
    getImage(name) { return this.images[name] || null; }
    getShader(name) { return this.shaders[name] || null; }

    markReady() {
      this.assetsReady = true;
      if (typeof window !== 'undefined') {
        window.assetsReady = true;
      }
    }

    // Preescalar imágenes para tamaños comunes y fondos para el tamaño actual de pantalla
    preScaleImages(commonSizes = [50, 75, 100, 125, 150]) {
      // Usar variables globales de p5: width/height
      const W = typeof width !== 'undefined' ? width : (window.innerWidth || 1920);
      const H = typeof height !== 'undefined' ? height : (window.innerHeight || 1080);

      // Buenas
      this.scaledGoodItemImages = {};
      for (let i = 0; i < this.goodItemImages.length; i++) {
        const img = this.goodItemImages[i];
        if (img) {
          this.scaledGoodItemImages[i] = {};
          for (let size of commonSizes) {
            const g = createGraphics(size, size);
            g.image(img, 0, 0, size, size);
            this.scaledGoodItemImages[i][size] = g;
          }
        }
      }

      // Malas
      this.scaledBadItemImages = {};
      for (let i = 0; i < this.badItemImages.length; i++) {
        const img = this.badItemImages[i];
        if (img) {
          this.scaledBadItemImages[i] = {};
          for (let size of commonSizes) {
            const g = createGraphics(size, size);
            g.image(img, 0, 0, size, size);
            this.scaledBadItemImages[i][size] = g;
          }
        }
      }

      // Fondos
      this.scaledBackgroundImages = {};
      for (let i = 0; i < this.backgroundTextures.length; i++) {
        const img = this.backgroundTextures[i];
        if (img) {
          const bgWidth = W * 1.2;
          const bgHeight = H * 1.2;
          const g = createGraphics(bgWidth, bgHeight);
          g.image(img, 0, 0, bgWidth, bgHeight);
          this.scaledBackgroundImages[i] = { current: g };
        }
      }

      // Exponer helpers globales para compatibilidad
      if (typeof window !== 'undefined') {
        window.getScaledImage = (imageArray, index, targetSize, isBad = false) => this.getScaledImage(imageArray, index, targetSize, isBad);
        window.getScaledBackgroundImage = (index) => this.getScaledBackgroundImage(index);
        window.preScaleImages = () => this.preScaleImages(commonSizes);
        // Exponer helpers de acceso a imágenes/shaders
        window.getAssetImage = (name) => this.getImage(name);
        window.getAssetShader = (name) => this.getShader(name);
      }

      // eslint-disable-next-line no-console
      console.log('AssetManager: imágenes pre-escaladas');
    }

    getScaledImage(imageArray, index, targetSize, isBad = false) {
      // Ignoramos imageArray y usamos nuestro mapa escalado
      const scaledArray = isBad ? this.scaledBadItemImages : this.scaledGoodItemImages;
      if (!scaledArray || !scaledArray[index]) return null;
      const commonSizes = [50, 75, 100, 125, 150];
      let closestSize = commonSizes.reduce((prev, curr) => Math.abs(curr - targetSize) < Math.abs(prev - targetSize) ? curr : prev);
      return scaledArray[index][closestSize] || null;
    }

    getScaledBackgroundImage(index) {
      const entry = this.scaledBackgroundImages[index];
      if (!entry) return null;
      return entry.current || null;
    }

    ensureAssetsReady(timeoutMs = 10000) {
      return new Promise((resolve) => {
        if (this.assetsReady) { resolve(true); return; }
        const arrays = [this.goodItemImages, this.badItemImages, this.backgroundTextures];
        const isLoaded = () => {
          for (const arr of arrays) {
            for (let i = 0; i < arr.length; i++) {
              const img = arr[i];
              if (!img) return false;
              const ready = (img.__loaded === true) || (typeof img.width === 'number' && img.width > 0);
              if (!ready) return false;
            }
          }
          return true;
        };

        const start = (typeof millis === 'function') ? millis() : Date.now();
        const tick = () => {
          if (isLoaded()) {
            this.markReady();
            this.preScaleImages();
            resolve(true);
            return;
          }
          const now = (typeof millis === 'function') ? millis() : Date.now();
          if (now - start > timeoutMs) {
            this.markReady();
            this.preScaleImages();
            resolve(true);
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }
  }

  // Instancia única y exposición global
  const instance = new AssetManager();
  if (typeof window !== 'undefined') {
    window.AssetManager = instance;
    // Compatibilidad: función ensureAssetsReady global
    window.ensureAssetsReady = () => instance.ensureAssetsReady();
    // Compatibilidad: función initialLoad global
    window.initialAssetLoad = () => instance.initialLoad();
  }
})();