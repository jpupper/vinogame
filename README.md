# VinoGame

Juego interactivo con p5.js donde recolectas copas de vino evitando obstáculos, con efectos de halo configurables y un panel de control.

## Cómo jugar

- Mantén presionado o toca para crear puntos que interactúan con los objetos.
- Recolecta copas de vino pasando el puntero sobre ellas el tiempo requerido.
- Evita los ítems malos para no perder vidas.
- El juego termina cuando las vidas llegan a cero.

## Controles

- Tecla `P`: abrir/cerrar el panel de control.
- Tecla `D`: activar/desactivar el modo debug (muestra FPS, puntos y visualiza los puntos del servidor).

## Panel de control

- Ajustes de dificultad: `fallSpeed`, `lives` y otros parámetros.
- Controles de halo:
  - Buen ítem: tamaño, fuerza y color del halo.
  - Mal ítem: tamaño, fuerza y color del halo.
- Los valores del halo se guardan en `localStorage` y se aplican en tiempo real.

## Shaders

- `composite.frag`: compone el fondo, el juego y efectos; recibe uniforms de halo configurables para buenos y malos (`u_goodHaloSize`, `u_goodHaloStrength`, `u_goodHaloColor`, `u_badHaloSize`, `u_badHaloStrength`, `u_badHaloColor`).
- `feedback.frag`: efectos de feedback y ondas.
- `medidor.*`: renderiza el medidor de combo dentro de una copa.

## Modo Debug

- Muestra `FPS` y cantidad de puntos.
- Dibuja el `PointServer` (conexiones y puntos) para calibración.
- El panel ha sido simplificado; el contador de FPS fue removido.

## Tecnologías

- p5.js
- HTML5
- JavaScript

## Instalación

No se requiere instalación: abre `index.html` en un navegador moderno. Para desarrollo, puedes servir la carpeta con un server estático.

## Créditos

Adaptado a p5.js para navegadores; incluye shaders personalizados y sistema de puntuación con efectos visuales.
