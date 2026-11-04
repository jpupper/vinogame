/**
 * LidarGameAdapter - Módulo para integrar juegos HTML con el sistema RPLidar
 * 
 * Conecta al servidor Lidar via WebSocket y convierte las detecciones de blob
 * en eventos de entrada para el juego. Soporta multi-blob para múltiples jugadores.
 * 
 * @example
 * const lidar = new LidarGameAdapter({
 *     canvas: document.getElementById('gameCanvas'),
 *     mode: 'multi-blob'
 * });
 * 
 * lidar.onBlobMove = (blobId, x, y, blob) => {
 *     handleGameInput(x, y, blobId);
 * };
 */
class LidarGameAdapter {
    /**
     * @param {Object} options - Configuración del adapter
     * @param {string} options.wsUrl - URL del WebSocket (default: uses current page host)
     * @param {number} options.oscPort - Puerto OSC alternativo (default: 3334)
     * @param {HTMLCanvasElement} options.canvas - Canvas del juego
     * @param {string} options.mode - 'single' o 'multi-blob' (default: 'multi-blob')
     * @param {boolean} options.useOSC - Usar OSC en lugar de WebSocket (default: false)
     * @param {boolean} options.autoReconnect - Reconectar automáticamente (default: true)
     * @param {number} options.reconnectDelay - Delay de reconexión en ms (default: 3000)
     */
    constructor(options = {}) {
        // Use current page host by default (supports any port)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.wsUrl = options.wsUrl || `${protocol}//${window.location.host}`;
        this.oscPort = options.oscPort || 3334;
        this.canvas = options.canvas || document.querySelector('canvas');
        this.mode = options.mode || 'multi-blob';
        this.useOSC = options.useOSC || false;
        this.autoReconnect = options.autoReconnect !== false;
        this.reconnectDelay = options.reconnectDelay || 3000;

        // Coordinate bounds for normalization
        // Server sends coords in selection area space, we map to 0-1
        // User should calibrate these by checking corner positions
        this.bounds = options.bounds || {
            minX: -0.5,  // Left edge of play area
            maxX: 0.5,   // Right edge of play area
            minY: 0,     // Top edge of play area (Y increases downward in Lidar)
            maxY: 1.0    // Bottom edge of play area
        };

        // Active blobs tracking
        this.blobs = new Map();
        this.connected = false;
        this.ws = null;
        this.oscPortInstance = null;

        // Callbacks - override these as needed
        this.onBlobMove = options.onBlobMove || null;
        this.onBlobEnter = options.onBlobEnter || null;
        this.onBlobExit = options.onBlobExit || null;
        this.onConnect = options.onConnect || null;
        this.onDisconnect = options.onDisconnect || null;
        this.onError = options.onError || null;

        // Synthetic events settings
        this.dispatchMouseEvents = options.dispatchMouseEvents !== false;
        this.dispatchTouchEvents = options.dispatchTouchEvents || false;

        // Initialize connection
        if (this.useOSC) {
            this._initOSC();
        } else {
            this._initWebSocket();
        }

        console.log(`[LidarAdapter] Initialized in ${this.mode} mode`);
    }

    /**
     * Initialize WebSocket connection to Lidar server
     * @private
     */
    _initWebSocket() {
        try {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                this.connected = true;
                console.log('[LidarAdapter] Connected to Lidar server via WebSocket');
                if (this.onConnect) this.onConnect();
            };

            this.ws.onclose = (event) => {
                this.connected = false;
                console.log('[LidarAdapter] Disconnected from Lidar server');
                if (this.onDisconnect) this.onDisconnect();

                // Clear all blobs on disconnect
                this._clearAllBlobs();

                // Auto-reconnect
                if (this.autoReconnect) {
                    console.log(`[LidarAdapter] Reconnecting in ${this.reconnectDelay}ms...`);
                    setTimeout(() => this._initWebSocket(), this.reconnectDelay);
                }
            };

            this.ws.onerror = (err) => {
                console.error('[LidarAdapter] WebSocket error:', err);
                if (this.onError) this.onError(err);
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // Debug: log all message types received
                    if (data.type) {
                        if (!this._msgTypes) this._msgTypes = new Set();
                        if (!this._msgTypes.has(data.type)) {
                            this._msgTypes.add(data.type);
                            console.log(`[LidarAdapter] New message type: ${data.type}`, data.type === 'blobs' ? `(${data.count} blobs)` : '');
                        }
                        // Log blobs periodically
                        if (data.type === 'blobs' && data.count > 0) {
                            if (!this._blobLogCount) this._blobLogCount = 0;
                            this._blobLogCount++;
                            if (this._blobLogCount % 30 === 1) {
                                console.log(`[LidarAdapter] Received ${data.count} blobs:`, data.blobs.map(b => `id=${b.id} pos=(${b.x?.toFixed(2)}, ${b.y?.toFixed(2)})`).join(', '));
                            }
                        }
                    }
                    this._handleMessage(data);
                } catch (e) {
                    // Ignore non-JSON messages (like raw lidar data)
                }
            };
        } catch (err) {
            console.error('[LidarAdapter] Failed to create WebSocket:', err);
            if (this.onError) this.onError(err);
        }
    }

    /**
     * Initialize OSC connection (requires osc.js library)
     * @private
     */
    _initOSC() {
        if (typeof osc === 'undefined') {
            console.error('[LidarAdapter] OSC mode requires osc.js library. Include it via:');
            console.error('  <script src="https://cdn.jsdelivr.net/npm/osc/dist/osc-browser.min.js"></script>');
            console.error('Falling back to WebSocket mode.');
            this._initWebSocket();
            return;
        }

        try {
            this.oscPortInstance = new osc.WebSocketPort({
                url: `ws://localhost:${this.oscPort}`,
                metadata: true
            });

            this.oscPortInstance.on('open', () => {
                this.connected = true;
                console.log('[LidarAdapter] Connected to Lidar server via OSC');
                if (this.onConnect) this.onConnect();
            });

            this.oscPortInstance.on('close', () => {
                this.connected = false;
                console.log('[LidarAdapter] OSC connection closed');
                if (this.onDisconnect) this.onDisconnect();
                this._clearAllBlobs();
            });

            this.oscPortInstance.on('message', (msg) => {
                this._handleOSCMessage(msg);
            });

            this.oscPortInstance.open();
        } catch (err) {
            console.error('[LidarAdapter] Failed to initialize OSC:', err);
            if (this.onError) this.onError(err);
        }
    }

    /**
     * Handle OSC messages
     * @private
     */
    _handleOSCMessage(msg) {
        if (msg.address === '/lidar/blob') {
            const args = msg.args.map(a => a.value);
            const [id, x, y, vx, vy, w, h, area, orientation] = args;

            this._handleBlob({
                id: id,
                x: x,
                y: y,
                velocityX: vx || 0,
                velocityY: vy || 0,
                width: w || 0.1,
                height: h || 0.1,
                area: area || 0.01,
                orientation: orientation || 0
            });
        } else if (msg.address === '/lidar/blob/exit') {
            const blobId = msg.args[0]?.value;
            if (blobId !== undefined && this.blobs.has(blobId)) {
                this.blobs.delete(blobId);
                if (this.onBlobExit) this.onBlobExit(blobId);
            }
        }
    }

    /**
     * Handle incoming WebSocket message
     * @private
     */
    _handleMessage(data) {
        // Server sends: {type: 'blobs', blobs: [...], count: N}
        if (data.type === 'blobs' && Array.isArray(data.blobs)) {
            const currentIds = new Set();

            // Process all blobs
            data.blobs.forEach(blob => {
                currentIds.add(blob.id);
                this._handleBlob(blob);
            });

            // Check for exited blobs (present before but not now)
            for (const [id] of this.blobs) {
                if (!currentIds.has(id)) {
                    this.blobs.delete(id);
                    if (this.onBlobExit) this.onBlobExit(id);
                }
            }
        }
    }

    /**
     * Process a single blob update
     * @private
     */
    _handleBlob(blob) {
        if (!this.canvas) return;

        const rect = this.canvas.getBoundingClientRect();

        // Use pre-normalized nx/ny from server if available (post-calibration coords)
        // Falls back to raw coords + local bounds if server doesn't provide normalized
        let normX, normY;

        if (blob.nx !== undefined && blob.ny !== undefined) {
            // Server provides pre-normalized coordinates (calibrated!)
            normX = blob.nx;
            normY = 1 - blob.ny;  // Invert Y for canvas (0=top)
        } else {
            // Fallback: Use raw coords with local bounds
            let blobX = blob.smoothed_x !== undefined ? blob.smoothed_x : blob.x;
            let blobY = blob.smoothed_y !== undefined ? blob.smoothed_y : blob.y;

            const rangeX = this.bounds.maxX - this.bounds.minX;
            const rangeY = this.bounds.maxY - this.bounds.minY;
            normX = (blobX - this.bounds.minX) / rangeX;
            normY = (blobY - this.bounds.minY) / rangeY;
        }

        // Clamp to 0-1 range
        normX = Math.max(0, Math.min(1, normX));
        normY = Math.max(0, Math.min(1, normY));

        // Debug: log first blob every 60 frames
        if (!this._debugCount) this._debugCount = 0;
        this._debugCount++;
        if (this._debugCount % 60 === 1 && blob.id !== undefined) {
            const mode = (blob.nx !== undefined) ? 'calibrated' : 'raw';
            console.log(`[LidarAdapter] Blob ${blob.id}: ${mode} coords -> normalized (${normX.toFixed(3)}, ${normY.toFixed(3)})`);
        }

        // Convert normalized coords to canvas pixels
        const canvasX = normX * rect.width;
        const canvasY = normY * rect.height;

        const isNew = !this.blobs.has(blob.id);

        // Store blob with canvas coordinates
        const blobData = {
            ...blob,
            canvasX: canvasX,
            canvasY: canvasY
        };
        this.blobs.set(blob.id, blobData);

        // Fire enter callback for new blobs
        if (isNew && this.onBlobEnter) {
            this.onBlobEnter(blob.id, canvasX, canvasY, blobData);
        }

        // Fire move callback
        if (this.onBlobMove) {
            if (this.mode === 'single') {
                // In single mode, only report the first/primary blob
                const firstBlob = this.blobs.values().next().value;
                if (firstBlob && firstBlob.id === blob.id) {
                    this.onBlobMove(blob.id, canvasX, canvasY, blobData);
                }
            } else {
                // Multi-blob mode: report all blobs
                this.onBlobMove(blob.id, canvasX, canvasY, blobData);
            }
        }

        // Dispatch synthetic events for compatibility with existing handlers
        if (this.dispatchMouseEvents) {
            this._dispatchMouseEvent(canvasX, canvasY, isNew ? 'mousedown' : 'mousemove');
        }

        if (this.dispatchTouchEvents) {
            this._dispatchTouchEvent(canvasX, canvasY, isNew ? 'touchstart' : 'touchmove', blob.id);
        }
    }

    /**
     * Clear all tracked blobs (on disconnect)
     * @private
     */
    _clearAllBlobs() {
        for (const [id] of this.blobs) {
            if (this.onBlobExit) this.onBlobExit(id);
        }
        this.blobs.clear();
    }

    /**
     * Dispatch synthetic mouse event
     * @private
     */
    _dispatchMouseEvent(x, y, type) {
        const event = new MouseEvent(type, {
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
            view: window
        });
        this.canvas.dispatchEvent(event);
    }

    /**
     * Dispatch synthetic touch event
     * @private
     */
    _dispatchTouchEvent(x, y, type, identifier = 0) {
        const touch = new Touch({
            identifier: identifier,
            target: this.canvas,
            clientX: x,
            clientY: y,
            pageX: x,
            pageY: y
        });

        const event = new TouchEvent(type, {
            touches: type === 'touchend' ? [] : [touch],
            targetTouches: type === 'touchend' ? [] : [touch],
            changedTouches: [touch],
            bubbles: true,
            cancelable: true
        });

        this.canvas.dispatchEvent(event);
    }

    // ==================== PUBLIC API ====================

    /**
     * Get all currently active blobs
     * @returns {Array} Array of blob objects with canvas coordinates
     */
    getBlobs() {
        return Array.from(this.blobs.values());
    }

    /**
     * Get a specific blob by ID
     * @param {number} id - Blob ID
     * @returns {Object|undefined} Blob object or undefined
     */
    getBlob(id) {
        return this.blobs.get(id);
    }

    /**
     * Get the number of active blobs
     * @returns {number}
     */
    getBlobCount() {
        return this.blobs.size;
    }

    /**
     * Check if Lidar is connected
     * @returns {boolean}
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Manually reconnect to Lidar server
     */
    reconnect() {
        this.disconnect();
        if (this.useOSC) {
            this._initOSC();
        } else {
            this._initWebSocket();
        }
    }

    /**
     * Disconnect from Lidar server
     */
    disconnect() {
        this.autoReconnect = false;

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        if (this.oscPortInstance) {
            this.oscPortInstance.close();
            this.oscPortInstance = null;
        }

        this.connected = false;
        this._clearAllBlobs();
    }

    /**
     * Get blob for a specific player based on X position
     * Useful for 2-player split-screen games
     * @param {number} playerNum - 1 for left side, 2 for right side
     * @returns {Object|null} First blob on that side or null
     */
    getPlayerBlob(playerNum) {
        const midX = this.canvas.getBoundingClientRect().width / 2;

        for (const blob of this.blobs.values()) {
            if (playerNum === 1 && blob.canvasX < midX) {
                return blob;
            } else if (playerNum === 2 && blob.canvasX >= midX) {
                return blob;
            }
        }

        return null;
    }

    /**
     * Get all blobs for a specific player
     * @param {number} playerNum - 1 for left side, 2 for right side
     * @returns {Array} Array of blobs on that side
     */
    getPlayerBlobs(playerNum) {
        const midX = this.canvas.getBoundingClientRect().width / 2;

        return Array.from(this.blobs.values()).filter(blob => {
            if (playerNum === 1) return blob.canvasX < midX;
            return blob.canvasX >= midX;
        });
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LidarGameAdapter;
}

if (typeof window !== 'undefined') {
    window.LidarGameAdapter = LidarGameAdapter;
}
