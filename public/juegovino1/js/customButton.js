// ============================================
// CONFIGURACIÓN DEL BOTÓN PERSONALIZADO
// ============================================

// Posición del botón en la pantalla
const BUTTON_X = 50;           // Posición X en píxeles desde la izquierda
const BUTTON_Y = 50;           // Posición Y en píxeles desde arriba

// Texto del botón
const BUTTON_TEXT = 'IR A PANEL'; // Texto que se muestra en el botón

// Dimensiones del botón
const BUTTON_WIDTH = 180;      // Ancho del botón en píxeles
const BUTTON_HEIGHT = 60;      // Alto del botón en píxeles

// Visibilidad del botón
const BUTTON_VISIBLE = false;   // true = visible, false = oculto

// URL de destino
const BUTTON_URL = 'http://localhost:3222';

// ============================================
// CÓDIGO DEL BOTÓN (NO MODIFICAR)
// ============================================

(function() {
    'use strict';
    
    // Solo crear el botón si está configurado como visible
    if (!BUTTON_VISIBLE) {
        console.log('Botón personalizado: oculto por configuración');
        return;
    }
    
    // Esperar a que el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createButton);
    } else {
        createButton();
    }
    
    function createButton() {
        // Crear el elemento del botón
        const button = document.createElement('button');
        button.id = 'customRedirectButton';
        button.textContent = BUTTON_TEXT;
        
        // Aplicar estilos al botón
        button.style.cssText = `
            position: fixed;
            left: ${BUTTON_X}px;
            top: ${BUTTON_Y}px;
            width: ${BUTTON_WIDTH}px;
            height: ${BUTTON_HEIGHT}px;
            
            /* Diseño violeta uva */
            background: linear-gradient(135deg, #6B46C1 0%, #553C9A 100%);
            border: 3px solid #8B5CF6;
            border-radius: 12px;
            
            /* Texto */
            color: white;
            font-family: 'Arial Black', sans-serif;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
            
            /* Interacción */
            cursor: pointer;
            z-index: 9999;
            
            /* Sombra y efectos */
            box-shadow: 
                0 4px 15px rgba(107, 70, 193, 0.4),
                0 0 20px rgba(139, 92, 246, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.2);
            
            /* Transiciones suaves */
            transition: all 0.3s ease;
            
            /* Evitar selección de texto */
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
        `;
        
        // Efectos hover
        button.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.05) translateY(-2px)';
            this.style.boxShadow = `
                0 6px 20px rgba(107, 70, 193, 0.6),
                0 0 30px rgba(139, 92, 246, 0.5),
                inset 0 1px 0 rgba(255, 255, 255, 0.3)
            `;
            this.style.background = 'linear-gradient(135deg, #7C3AED 0%, #6B46C1 100%)';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1) translateY(0)';
            this.style.boxShadow = `
                0 4px 15px rgba(107, 70, 193, 0.4),
                0 0 20px rgba(139, 92, 246, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.2)
            `;
            this.style.background = 'linear-gradient(135deg, #6B46C1 0%, #553C9A 100%)';
        });
        
        // Efecto al hacer clic
        button.addEventListener('mousedown', function() {
            this.style.transform = 'scale(0.95) translateY(0)';
            this.style.boxShadow = `
                0 2px 8px rgba(107, 70, 193, 0.4),
                0 0 15px rgba(139, 92, 246, 0.3),
                inset 0 1px 0 rgba(255, 255, 255, 0.1)
            `;
        });
        
        button.addEventListener('mouseup', function() {
            this.style.transform = 'scale(1.05) translateY(-2px)';
        });
        
        // Acción del botón: redirigir a la URL configurada
        button.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Redirigiendo a:', BUTTON_URL);
            window.location.href = BUTTON_URL;
        });
        
        // Agregar el botón al body
        document.body.appendChild(button);
        
        console.log('Botón personalizado creado:', {
            posición: `(${BUTTON_X}, ${BUTTON_Y})`,
            tamaño: `${BUTTON_WIDTH}x${BUTTON_HEIGHT}`,
            texto: BUTTON_TEXT,
            url: BUTTON_URL
        });
    }
})();
