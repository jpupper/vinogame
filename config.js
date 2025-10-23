// VINO RURAL - Archivo de configuración global
// Este archivo contiene todas las variables configurables del juego

const CONFIG = {
    // GENERAL
    general: {
        frameRate: 60,                // Velocidad de fotogramas por segundo
    },
    
    // PUNTOS Y SERVIDOR DE PUNTOS
    points: {
        size: 8,                      // Tamaño base de los puntos
        maxPoints: 200,               // Número máximo de puntos permitidos
        color: [255, 0, 0],           // Color RGB de los puntos
        connectionDistance: 150,      // Distancia máxima para conectar puntos
        connectionColor: [255, 255, 255, 100], // Color RGBA de las conexiones
        connectionThickness: 2,       // Grosor de las líneas de conexión
    },
    
    // EFECTOS DE PARTÍCULAS
    particles: {
        count: {                      // Cantidad de partículas para diferentes eventos
            scoreSmall: 10,           // Puntuación pequeña (<10)
            scoreMedium: 20,          // Puntuación media (10-30)
            scoreLarge: 30,           // Puntuación grande (>30)
            explosion: 50,            // Explosiones
            completion: 15            // Completar secuencia
        },
        size: {
            min: 5,                   // Tamaño mínimo de partícula (aumentado)
            max: 12,                  // Tamaño máximo de partícula (aumentado)
        },
        speed: {
            initial: {
                min: -2,              // Velocidad inicial mínima
                max: 2                // Velocidad inicial máxima
            },
            gravity: 0.15,            // Fuerza de gravedad para partículas
            attraction: 0.15          // Fuerza de atracción hacia objetivos
        },
        colors: {
            positive: [100, 255, 150],  // Color base para efectos positivos (verde lima)
            negative: [255, 80, 150],   // Color base para efectos negativos (rosa/magenta)
            neutral: [100, 200, 255],   // Color base para efectos neutrales (azul eléctrico)
            variation: 50               // Variación aleatoria en los colores
        },
        lifespan: {
            rising: 1200,             // Duración de fase de subida (ms) - aumentado
            falling: 1500,            // Duración de fase de caída (ms) - aumentado
            attracting: 1800          // Duración de fase de atracción (ms) - aumentado
        }
    },
    
    // EFECTOS DE RASTRO
    trail: {
        maxLength: 20,                // Longitud máxima del rastro
        thickness: 8,                 // Grosor del rastro
        opacity: 180,                 // Opacidad máxima (0-255) - más visible
        fadeSpeed: 5,                 // Velocidad de desvanecimiento
        colorMode: 'gradient',        // 'rainbow', 'fixed', 'gradient'
        color: [100, 200, 255],       // Color fijo si colorMode es 'fixed'
        gradient: {                   // Colores para modo gradiente (azul a morado)
            start: [100, 200, 255],   // Azul eléctrico
            end: [200, 100, 255]      // Morado vibrante
        }
    },
    
    // FONDO DINÁMICO
    background: {
        color: [5, 5, 15],            // Color RGB del fondo (negro azulado profundo)
        grid: {
            size: 30,                 // Tamaño de la cuadrícula
            pointSizeRange: {         // Rango de tamaño de los puntos
                min: 2,
                max: 10
            },
            colors: {                 // Colores de los puntos (modo HSB)
                hueRange: [180, 280], // Rango de tonalidad (azules a morados vibrantes)
                satRange: [60, 90],   // Rango de saturación (más saturado)
                briRange: [30, 70]    // Rango de brillo (más brillante)
            },
            inertia: 0.2              // Factor de inercia para movimiento suave
        },
        waves: {
            count: 1,                 // Número de ondas base
            amplitude: {              // Amplitud de las ondas
                min: 5,
                max: 15
            },
            period: {                 // Período de las ondas
                min: 3000,
                max: 5000
            },
            speed: {                  // Velocidad de las ondas
                min: 0.001,
                max: 0.005
            }
        },
        ripples: {
            max: 10,                  // Máximo número de ondas expansivas
            radius: {                 // Radio de las ondas
                min: 150,
                max: 400
            },
            speed: {                  // Velocidad de expansión
                min: 2.5,
                max: 6
            },
            thickness: {              // Grosor de las ondas
                min: 20,
                max: 50
            },
            lifespan: {               // Duración de las ondas (ms)
                min: 1000,
                max: 3000
            },
            color: [100, 150, 255]    // Color base de las ondas (azul eléctrico)
        }
    },
    
    // SISTEMA DE PUNTUACIÓN
    score: {
        position: {                   // Posición del contador de puntuación
            x: 120,                   // Distancia desde el borde derecho
            y: 40                     // Distancia desde el borde superior
        },
        size: 40,                     // Tamaño de fuente base
        comboMultiplier: 0.2,         // Multiplicador por nivel de combo (20%)
        effectDuration: 800,          // Duración del efecto visual (ms)
        colors: {
            normal: [255, 255, 255],  // Color normal del score
            positive: [255, 255, 255], // Base para efectos positivos
            negative: [255, 100, 100]  // Base para efectos negativos
        }
    },
    
    // OBSTÁCULOS
    obstacles: {
        static: {
            size: {                   // Tamaño de obstáculos estáticos
                min: 50,
                max: 80
            },
            color: [200, 0, 0],       // Color base
            lifespan: {               // Tiempo de vida (ms)
                min: 5000,
                max: 10000
            },
            spikes: 8,                // Número de picos en la forma de estrella
            rotationSpeed: 0.02       // Velocidad de rotación
        },
        moving: {
            size: {                   // Tamaño de obstáculos móviles
                min: 50,
                max: 80
            },
            color: [255, 50, 0],      // Color base
            speed: {                  // Velocidad de movimiento
                min: 1,
                max: 3
            },
            spikes: 6,                // Número de picos en la forma de estrella
            rotationSpeed: {          // Velocidad de rotación
                min: 0.01,
                max: 0.03
            }
        },
        spawnRate: {                  // Frecuencia de aparición (ms)
            static: 5000,
            moving: 8000
        },
        maxCount: {                   // Número máximo de obstáculos
            static: 0,                // Desactivados
            moving: 3
        },
        penalty: 10                   // Penalización por colisión
    },
    
    // SISTEMA DE VIDAS
    lives: {
        initial: 3,                   // Número inicial de vidas
        position: {                   // Posición de los corazones
            x: 150,
            y: 150
        },
        size: 30,                     // Tamaño de los corazones
        spacing: 40,                  // Espacio entre corazones
        color: [255, 0, 0]            // Color de los corazones
    },
    
    // ANIMACIÓN DE GAME OVER
    gameOver: {
        duration: 5000,               // Duración total de la animación (ms)
        particles: {
            count: 100,               // Número de partículas
            size: {                   // Tamaño de las partículas
                min: 5,
                max: 20
            },
            speed: {                  // Velocidad de las partículas
                min: 2,
                max: 10
            },
            color: [255, 0, 0]        // Color base (rojo)
        },
        text: {
            size: 0.15,               // Tamaño relativo a la altura de la pantalla
            color: [255, 0, 0],       // Color del texto (rojo)
            spacing: 0.07             // Espaciado relativo al ancho de la pantalla
        }
    },
    
    // SISTEMA DE COPAS DE VINO
    wineGlasses: {
        spawnInterval: 2000,          // Intervalo de aparición (ms)
        speed: {
            min: 1.5,
            max: 3
        },
        globalSize: 1.0,              // Escala global de todas las copas (1.0 = 100%)
        glassSize: 80,                // Tamaño base de las copas
        bottleSize: 100,              // Tamaño base de las botellas
        badItemSize: 80,              // Tamaño base de items malos
        hoverTime: 1000,              // Tiempo requerido de hover en ms (1 segundo)
        points: {                     // Puntos por tipo de vino
            white: 5,
            red: 10,
            rose: 7
        },
        bottlePoints: 20,             // Puntos por botella
        badItemPenalty: 15            // Penalización por item malo
    }
};
