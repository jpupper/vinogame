/**
 * Lidar Integration for VinoGame
 * Conecta LidarGameAdapter con el sistema PointServer existente
 * 
 * Este script recibe datos del LIDAR vía WebSocket y los convierte
 * al formato que espera processJSONtouch():
 * { points: [{id, x, y}, ...] } donde x,y están en rango 0-1
 */

// Variables globales para el seguimiento
let lidarIntegration = {
    adapter: null,
    activeBlobs: new Map(),
    isInitialized: false,
    debug: true
};

/**
 * Inicializa la integración LIDAR
 * Se conecta al WebSocket y redirige datos al PointServer
 */
function initLidarIntegration() {
    if (lidarIntegration.isInitialized) {
        console.log('[LidarIntegration] Already initialized');
        return;
    }

    console.log('[LidarIntegration] Initializing...');

    // Crear adapter conectado al WebSocket local
    lidarIntegration.adapter = new LidarGameAdapter({
        mode: 'multi-blob',
        dispatchMouseEvents: false,
        dispatchTouchEvents: false
    });

    let moveCount = 0;

    // Cuando un blob entra
    lidarIntegration.adapter.onBlobEnter = (blobId, canvasX, canvasY, blobData) => {
        if (lidarIntegration.debug) {
            console.log(`[LidarIntegration] Blob ${blobId} entered at (${canvasX.toFixed(1)}, ${canvasY.toFixed(1)})`);
        }
        lidarIntegration.activeBlobs.set(blobId, {
            x: canvasX,
            y: canvasY,
            lastUpdate: Date.now()
        });
        updatePointServer();
    };

    // Cuando un blob se mueve
    lidarIntegration.adapter.onBlobMove = (blobId, canvasX, canvasY, blobData) => {
        moveCount++;
        if (moveCount <= 10 || moveCount % 60 === 0) {
            console.log(`[LidarIntegration] Blob ${blobId} move #${moveCount} at (${canvasX.toFixed(1)}, ${canvasY.toFixed(1)}) raw:(${blobData.x?.toFixed(2)}, ${blobData.y?.toFixed(2)}) nx:${blobData.nx?.toFixed(2)} ny:${blobData.ny?.toFixed(2)}`);
        }
        lidarIntegration.activeBlobs.set(blobId, {
            x: canvasX,
            y: canvasY,
            lastUpdate: Date.now()
        });
        updatePointServer();
    };

    // Cuando un blob sale
    lidarIntegration.adapter.onBlobExit = (blobId) => {
        if (lidarIntegration.debug) {
            console.log(`[LidarIntegration] Blob ${blobId} exited`);
        }
        lidarIntegration.activeBlobs.delete(blobId);
        updatePointServer();
    };

    // Conexión establecida
    lidarIntegration.adapter.onConnect = () => {
        console.log('[LidarIntegration] Connected to Lidar server');
        console.log('[LidarIntegration] WebSocket URL:', lidarIntegration.adapter.wsUrl);
    };

    // Desconexión
    lidarIntegration.adapter.onDisconnect = () => {
        console.log('[LidarIntegration] Disconnected from Lidar server');
        lidarIntegration.activeBlobs.clear();
        updatePointServer();
    };

    // Error
    lidarIntegration.adapter.onError = (err) => {
        console.error('[LidarIntegration] Error:', err);
    };

    lidarIntegration.isInitialized = true;
    console.log('[LidarIntegration] Initialization complete - waiting for blobs...');
}

/**
 * Actualiza el PointServer con los blobs activos
 * Convierte las coordenadas del canvas al formato 0-1 que espera processJSONtouch
 */
function updatePointServer() {
    // Verificar si existe Pserver o LM
    if (!window.Pserver && !window.LM) {
        console.warn('[LidarIntegration] PointServer not available yet');
        return;
    }

    const canvas = document.querySelector('canvas');
    if (!canvas) {
        console.warn('[LidarIntegration] Canvas not found');
        return;
    }

    const width = canvas.width || window.innerWidth;
    const height = canvas.height || window.innerHeight;

    // Convertir blobs a formato 0-1 (invertido para match con processJSONtouch)
    // processJSONtouch usa: map(point.x, 1, 0, 0, width) - invierte X
    // y: map(point.y, 1, 0, 0, height) - invierte Y
    const points = [];
    lidarIntegration.activeBlobs.forEach((blob, id) => {
        // Convertir coordenadas canvas (0-width, 0-height) a 0-1 con inversión
        // Si canvasX = normX * width, entonces normX = canvasX / width
        // Pero processJSONtouch invierte: x = map(nx, 1, 0, 0, width)
        // Entonces enviamos 1 - nx para que al invertir quede correcto
        const normX = blob.x / width;
        const normY = blob.y / height;
        
        points.push({
            id: id,
            x: 1 - normX,  // Invertido para processJSONtouch
            y: 1 - normY   // Invertido para processJSONtouch
        });
    });

    const jsonData = { points: points };

    // Enviar a LM.processJSONtouch (que redirige a Pserver)
    if (window.LM && typeof window.LM.processJSONtouch === 'function') {
        window.LM.processJSONtouch(jsonData);
    } else if (window.Pserver && typeof window.Pserver.processJSONtouch === 'function') {
        window.Pserver.processJSONtouch(jsonData);
    }
}

/**
 * Activa/desactiva modo debug
 */
function setLidarDebug(enabled) {
    lidarIntegration.debug = enabled;
    console.log('[LidarIntegration] Debug mode:', enabled ? 'ON' : 'OFF');
}

/**
 * Retorna información del estado del LIDAR
 */
function getLidarStatus() {
    return {
        connected: lidarIntegration.adapter?.isConnected() || false,
        blobCount: lidarIntegration.activeBlobs.size,
        blobs: Array.from(lidarIntegration.activeBlobs.entries()).map(([id, blob]) => ({
            id,
            x: blob.x.toFixed(1),
            y: blob.y.toFixed(1)
        }))
    };
}

// Auto-inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Esperar un momento para que p5.js inicialice
    setTimeout(initLidarIntegration, 1000);
});

// También exponer función global para inicialización manual
window.initLidarIntegration = initLidarIntegration;
window.setLidarDebug = setLidarDebug;
window.getLidarStatus = getLidarStatus;

console.log('[LidarIntegration] Script loaded - waiting for DOMContentLoaded...');
