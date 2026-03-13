const potSlider = document.getElementById('potentiometer');
const potPercentDisplay = document.getElementById('pot-percent');
const pulseWidthDisplay = document.getElementById('pulse-width');
const servoAngleDisplay = document.getElementById('servo-angle');
const doorStatusDisplay = document.getElementById('door-status');
const doorStatusDesc = document.getElementById('door-status');

// Elementos visuales
const chickenHeadNeck = document.querySelector('.chicken-head-neck');
const servoArm = document.getElementById('servo-arm');
const gate = document.getElementById('gate');
const linkage = document.getElementById('linkage');
const fallingFoodContainer = document.getElementById('falling-food-container');
const foodPile = document.getElementById('food-pile');
const hopperFood = document.getElementById('hopper-food');
const ledOut = document.getElementById('led-out');
const r2ValueDisplay = document.getElementById('r2-value');
const reloadBtn = document.getElementById('reload-btn');

// Elementos IoT
const iotScreen = document.getElementById('iot-screen');
const iotStatusTitle = document.getElementById('iot-status-title');
const iotStatusMsg = document.getElementById('iot-status-msg');
const iotHopperLevel = document.getElementById('iot-hopper-level');

// Canvas Osciloscopio
const canvas = document.getElementById('pwm-canvas');
const ctx = canvas.getContext('2d');

// Variables de estado
let sliderValue = 0; // 0 a 100
let pulseWidth = 1.0; // 1ms a 2ms
let servoAngle = 0; // 0 a 180 grados
let isDroppingFood = false;
let foodLevel = 0; // Para el comedero
let hopperLevel = 100; // Porcentaje de tolva

// Periodo base para 50Hz es 20ms
const periodMs = 20.0; 

// Resize Canvas
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    drawOscilloscope();
}
window.addEventListener('resize', resizeCanvas);


// Función Update General
function updateSimulation() {
    sliderValue = parseInt(potSlider.value);
    
    // Mapeo: 0% -> 1ms, 100% -> 2ms
    pulseWidth = 1.0 + (sliderValue / 100.0);
    
    // Mapeo Angulo: 1ms -> 0°, 1.5ms -> 90°, 2.0ms -> 180°
    // (pulseWidth - 1) * 180
    servoAngle = Math.round((pulseWidth - 1.0) * 180);

    // Actualizar UI Text
    potPercentDisplay.textContent = sliderValue + '%';
    pulseWidthDisplay.textContent = pulseWidth.toFixed(2) + ' ms';
    servoAngleDisplay.textContent = servoAngle + '°';

    // Determinar estado de compuerta y lógica IoT
    let iotState = 'rest';

    if (servoAngle <= 10) {
        doorStatusDisplay.textContent = "Compuerta Cerrada";
        doorStatusDisplay.style.color = "var(--text-secondary)";
        isDroppingFood = false;
        gate.style.transform = `rotate(0deg)`;
        iotState = 'rest';
    } else if (servoAngle < 170) {
        doorStatusDisplay.textContent = "Compuerta Parcialmente Abierta";
        doorStatusDisplay.style.color = "var(--warning-color)";
        isDroppingFood = true;
        // Compuerta se abre hacia abajo (rotación negativa)
        gate.style.transform = `rotate(-${servoAngle/3}deg)`;
        iotState = 'active';
    } else {
        doorStatusDisplay.textContent = "Compuerta Totalmente Abierta";
        doorStatusDisplay.style.color = "var(--success-color)";
        isDroppingFood = true;
        gate.style.transform = `rotate(-60deg)`;
        iotState = 'active';
    }

    // Actualizar Panel Matemático
    // R1 = 4.7k, R2 = 0 a 100k
    const r2Ohms = (sliderValue / 100) * 100;
    r2ValueDisplay.textContent = `${r2Ohms.toFixed(1)} kΩ`;

    // Actualizar Dashboard IoT
    iotHopperLevel.textContent = `${hopperLevel.toFixed(0)}%`;
    if (hopperLevel <= 0) {
        iotScreen.className = 'mockup-screen alert';
        iotStatusTitle.textContent = "Alerta: Tolva Vacía";
        iotStatusMsg.textContent = "Recargar alimento de inmediato.";
    } else if (iotState === 'active') {
        iotScreen.className = 'mockup-screen active';
        iotStatusTitle.textContent = "Alimentando...";
        iotStatusMsg.textContent = "Compuerta abierta, dispensando.";
    } else {
        iotScreen.className = 'mockup-screen rest';
        iotStatusTitle.textContent = "Modo Reposo";
        iotStatusMsg.textContent = "Esperando la oscilación del LM555.";
    }

    // Rotar Brazo del Servo
    // Rotación visual para coincidir con la UI
    // Queremos que 0 esté apuntando a la izquierda o arriba, hagamos que rote fluido
    servoArm.style.transform = `rotate(${servoAngle - 180}deg)`;

    // Dibujar Onda PWM
    drawOscilloscope();
}

// Bucle de Animación de Comida
function animateFood() {
    if (isDroppingFood && hopperLevel > 0) {
        // Crear partícula
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        // Random horizontal position within the dropping area
        const left = Math.random() * 80 + 5;
        particle.style.left = left + 'px';
        
        // Randomly adjust drop speed based on how wide the door is open
        const speed = 0.5 + Math.random() * 0.5;
        particle.style.animation = `fall ${speed}s linear forwards`;
        
        fallingFoodContainer.appendChild(particle);
        
        // Remover partícula después de la animación
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
            
            // Lógica de consumo de la tolva (siempre baja si hay partículas cayendo)
            if (hopperLevel > 0) {
                hopperLevel -= (servoAngle / 180) * 0.2; // Aumentamos un poco la velocidad de vaciado
                if (hopperLevel < 0) hopperLevel = 0;
                
                hopperFood.style.height = `${hopperLevel}%`;
                iotHopperLevel.textContent = `${hopperLevel.toFixed(0)}%`;
                
                if (hopperLevel <= 0) {
                    iotScreen.className = 'mockup-screen alert';
                    iotStatusTitle.textContent = "Alerta: Tolva Vacía";
                    iotStatusMsg.textContent = "Recargar alimento de inmediato.";
                }
            }

            // Incrementar montón de comida en el suelo/comedero
            if (foodLevel < 100) {
                foodLevel += (servoAngle / 180) * 0.5; 
                if (foodLevel > 100) foodLevel = 100;
                foodPile.style.height = `${foodLevel}%`;
            }
        }, speed * 1000);

        // Hacer que la gallina picotee
        if (chickenHeadNeck) {
            chickenHeadNeck.classList.add('pecking');
            setTimeout(() => {
                chickenHeadNeck.classList.remove('pecking');
            }, 300);
        }
    }
    
    // Limitar la creación de partículas según qué tan abierto esté
    const timeout = 100 - (servoAngle/180 * 80);
    setTimeout(animateFood, timeout);
}

// Dibujar en el Osciloscopio
function drawOscilloscope() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Parámetros de visualización
    // Digamos que vemos 3 ciclos (60ms total) en la pantalla
    const timeFrameMs = 60.0;
    const pixelsPerMs = width / timeFrameMs;
    
    // Posiciones en Y
    const yHigh = height * 0.2; // 5V aprox
    const yLow = height * 0.8;  // 0V aprox
    
    ctx.beginPath();
    ctx.strokeStyle = '#5eead4';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    
    // Dibujo del tren de pulsos
    let currentX = 0;
    
    // Añadimos offset para que la onda se "mueva"
    const timeOffset = (Date.now() / 20) % periodMs; 
    
    // Parpadeo del LED Pin 3
    if (timeOffset < pulseWidth) {
        ledOut.classList.add('active');
    } else {
        ledOut.classList.remove('active');
    }

    ctx.moveTo(0, yLow);
    
    for (let t = -periodMs * 2; t < timeFrameMs; t += periodMs) {
        // Obtenemos un tiempo relativo ajustado por el offset para dar la ilusión de avance
        let relativeTime = t - timeOffset;
        
        // Ampliamos el zoom visual para pulseWidth para que el usuario note el cambio mejor
        // un pulseWidth de 1ms ocupará 5ms visuales (x5); 2ms ocuparán 10ms visuales. Solo para propósito visual.
        let drawPulseWidth = pulseWidth * 4; 
        
        const startX = relativeTime * pixelsPerMs;
        const riseX = startX;
        const fallX = startX + (drawPulseWidth * pixelsPerMs);
        const endX = startX + (periodMs * pixelsPerMs);
        
        // Evitamos dibujar fuera un poco antes
        if (endX > 0) {
            ctx.lineTo(riseX, yLow);
            ctx.lineTo(riseX, yHigh); // Flanco subida
            ctx.lineTo(fallX, yHigh); // Pulso en alto
            ctx.lineTo(fallX, yLow);  // Flanco bajada
        }
    }
    
    ctx.lineTo(width, yLow);
    
    ctx.stroke();
    
    // Dibujar sombra para efecto glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#5eead4';
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// Event Listeners
potSlider.addEventListener('input', updateSimulation);

reloadBtn.addEventListener('click', () => {
    hopperLevel = 100;
    foodLevel = 0;
    hopperFood.style.height = '100%';
    foodPile.style.height = '0%';
    updateSimulation(); // refreshes IoT and elements
});

// Animación Continua osciloscopio
function renderLoop() {
    drawOscilloscope();
    requestAnimationFrame(renderLoop);
}

// Iniciar
window.addEventListener('load', () => {
    resizeCanvas();
    updateSimulation();
    animateFood();
    renderLoop(); // Start movement
    
    // Inicializar visual de la tolva
    hopperFood.style.height = '100%';
});
