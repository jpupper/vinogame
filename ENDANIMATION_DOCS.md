# Sistema Unificado de Pantallas de Finalización

## Descripción General

Se ha implementado un sistema unificado de animaciones de finalización de juego que funciona tanto en **modo colaborativo** como en **modo competitivo**, usando una sola clase `EndAnimation` con parámetros configurables.

## Características Principales

### 1. Animación de Letras con Glow Pulsante
- Las letras aparecen una por una con un efecto de entrada suave (easeOutBack)
- Cada letra tiene un **glow (halo) pulsante** que se prende y apaga continuamente
- El glow es **dorado** para victoria y **rojo** para derrota
- Efecto de múltiples capas para crear un glow difuso y brillante

### 2. Ondas Expansivas
- Se generan **ondas circulares** que se expanden desde el centro del texto
- Las ondas son **doradas** para victoria y **rojas** para derrota
- Se spawnean cada 800ms y se desvanecen gradualmente
- Tienen un efecto de glow adicional para mayor impacto visual

### 3. Modos de Uso

#### Modo Colaborativo (Pantalla Completa)
```javascript
// Victoria
new EndAnimation({ type: 'win' })

// Derrota
new EndAnimation({ type: 'lose' })
```

- Se dibuja sobre toda la pantalla
- Incluye fondo semitransparente
- En victoria, muestra trofeo, puntuación final y combo más alto

#### Modo Competitivo (Pantalla Dividida)
```javascript
// Victoria lado izquierdo
new EndAnimation({ 
  type: 'win', 
  side: 'left', 
  x: 0, 
  y: 0, 
  areaWidth: width / 2, 
  areaHeight: height 
})

// Derrota lado derecho
new EndAnimation({ 
  type: 'lose', 
  side: 'right', 
  x: width / 2, 
  y: 0, 
  areaWidth: width / 2, 
  areaHeight: height 
})
```

- Se dibuja en el área específica (mitad izquierda o derecha)
- No incluye fondo semitransparente (para no ocultar el otro lado)
- Texto y ondas se ajustan al área asignada

## Parámetros del Constructor

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `type` | string | `'win'` | Tipo de pantalla: `'win'` o `'lose'` |
| `side` | string | `null` | Para competitivo: `'left'` o `'right'`. `null` para colaborativo |
| `x` | number | `0` | Posición X del área de renderizado |
| `y` | number | `0` | Posición Y del área de renderizado |
| `areaWidth` | number | `null` | Ancho del área (null = pantalla completa) |
| `areaHeight` | number | `null` | Alto del área (null = pantalla completa) |

## Colores

### Victoria (Win)
- **Texto y Glow**: Dorado `[255, 215, 0]`
- **Ondas**: Dorado `[255, 215, 0]`

### Derrota (Lose)
- **Texto y Glow**: Rojo `[255, 60, 60]`
- **Ondas**: Rojo puro `[255, 0, 0]`

## Métodos Públicos

### `update()`
Actualiza el estado de la animación (letras y ondas). Debe llamarse en cada frame.

### `display(ctx)`
Renderiza la animación en el contexto proporcionado.

### `isFinished()`
Retorna `true` cuando la animación ha completado su duración.

## Integración

### En scoreeffect.js (Modo Colaborativo)
```javascript
// Victoria por combo
this.winAnimation = new EndAnimation({ type: 'win' });

// Derrota por perder todas las vidas
this.gameOverAnimation = new EndAnimation({ type: 'lose' });
```

### En sketch.js (Modo Competitivo)
```javascript
function drawSideCelebrationOverlay(ctx, side, celebration) {
  if (!celebration._endAnimation) {
    const leftBound = side === 'left' ? 0 : width / 2;
    celebration._endAnimation = new EndAnimation({
      type: celebration.type,
      side: side,
      x: leftBound,
      y: 0,
      areaWidth: width / 2,
      areaHeight: height
    });
  }
  celebration._endAnimation.update();
  celebration._endAnimation.display(ctx);
}
```

## Configuración

La duración de la animación se obtiene de `CONFIG`:
- `CONFIG.win.duration` para victoria (default: 5000ms)
- `CONFIG.gameOver.duration` para derrota (default: 5000ms)

## Efectos de Easing

- **easeOutBack**: Para la entrada de las letras (efecto de rebote)
- **easeOutElastic**: Para el trofeo en modo colaborativo (efecto elástico)

## Notas Técnicas

- Las ondas se generan cada 800ms después de un delay inicial de 500ms
- Cada letra aparece 100ms después de la anterior
- El glow pulsa con una velocidad de 0.003 radianes por milisegundo
- Las ondas tienen un grosor de 8px con un glow adicional de 16px
