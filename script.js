const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const gestureOverlay = document.getElementById('gesture-overlay');
const startBtn = document.getElementById('startBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const statusText = document.getElementById('status-overlay');

// Funcionalidad de Pantalla Completa
fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error al intentar modo pantalla completa: ${err.message}`);
        });
        fullscreenBtn.innerText = "Salir de Pantalla Completa";
    } else {
        document.exitFullscreen();
        fullscreenBtn.innerText = "Pantalla Completa";
    }
});

// Elementos románticos
const audioMusica = document.getElementById('audioMusica');
const heartMessage = document.getElementById('heart-message');
const photoDisplay = document.getElementById('photo-display');

// Fotos precargadas (Cambiar luego por tus propias fotos 'foto1.jpg', etc.)
const photos = ['foto1.jpeg', 'foto2.jpeg', 'foto3.jpeg'];
let currentPhotoIndex = 0;
let swipeTimeout = false; // prevenir pases de foto demasiado rápidos

let isRunning = false;

// Configuración MediaPipe Hands
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0, // REDUCIDO a 0: CRÍTICO para que no se trabe en celulares
    minDetectionConfidence: 0.5, // Bajado un poco para que sea más rápido
    minTrackingConfidence: 0.5
});

hands.onResults(onResults);

// Función de distancia para mejorar la detección en cualquier ángulo
function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// Lógica mejorada para contar dedos sin importar rotación
function analizarMano(landmarks) {
    const dedos = [0, 0, 0, 0, 0];
    const base = landmarks[0]; // Referencia principal: base de la mano (muñeca)
    
    // Un dedo está abierto si su punta (TIP) está más lejos de la muñeca que el nudillo principal correspondiente.
    // Usamos el punto base (0) para los dedos de la mano, excepto para el pulgar que usamos su base real (1).
    if (getDistance(landmarks[4], landmarks[1]) > getDistance(landmarks[3], landmarks[1])) dedos[0] = 1; // Pulgar
    if (getDistance(landmarks[8], base) > getDistance(landmarks[5], base)) dedos[1] = 1; // Índice
    if (getDistance(landmarks[12], base) > getDistance(landmarks[9], base)) dedos[2] = 1; // Medio
    if (getDistance(landmarks[16], base) > getDistance(landmarks[13], base)) dedos[3] = 1; // Anular
    if (getDistance(landmarks[20], base) > getDistance(landmarks[17], base)) dedos[4] = 1; // Meñique

    // Reconocer Corazón Coreano: Pulgar e Índice muy juntos, y otros dedos cerrados
    const distPulgarIndice = getDistance(landmarks[4], landmarks[8]);
    let esCorazonCoreano = (distPulgarIndice < 0.06) && (dedos[2] === 0 && dedos[3] === 0 && dedos[4] === 0);

    return {
        dedosAbiertos: dedos,
        totalDedos: dedos.reduce((a, b) => a + b, 0),
        esCorazonCoreano: esCorazonCoreano
    };
}

let lastHandCenter = null;

function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    // Espejamos el canvas horizontalmente para que se sienta como un espejo natural
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
    
    // Dibujar video original
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    let gestureText = "Esperando... 👀";

    // Reiniciar opacidades (Escondemos por defecto si no hay gesto o mano)
    heartMessage.classList.remove('visible');
    photoDisplay.classList.remove('visible');

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // Dibujar la malla de la mano (esqueleto) para asegurar el tracking
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 3 });
        drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });

        const analisis = analizarMano(landmarks);
        const ded = analisis.dedosAbiertos;

        // --- LÓGICA DE GESTOS ROMÁNTICOS ---

        // 1. GESTO: Corazón Coreano 🫰 -> Mensaje sorpresa
        if (analisis.esCorazonCoreano) {
            gestureText = "Corazón Coreano 🫰";
            heartMessage.classList.add('visible');
        }

        // 2. GESTO: Lenguaje de Señas "Te Amo" 🤟 (Pulgar, Índice y Meñique)
        else if (ded[0] === 1 && ded[1] === 1 && ded[2] === 0 && ded[3] === 0 && ded[4] === 1) {
            gestureText = "Te Quiero 🤟 (Música On)";
            if (audioMusica.paused) {
                audioMusica.currentTime = 0; // Reiniciar o quitar esto para resumir
                audioMusica.play().catch(e => console.log(e));
            }
        }

        // 3. GESTO: Mano Abierta (5 dedos) -> Álbum Mágico
        else if (analisis.totalDedos === 5) {
            gestureText = "Mano Abierta ✋ (Álbum Mágico)";
            
            if (photoDisplay.getAttribute('src') !== photos[currentPhotoIndex]) {
                photoDisplay.src = photos[currentPhotoIndex];
            }
            photoDisplay.classList.add('visible');

            // --- Lógica de Swipe Simple ---
            // Usamos la posición X del nudillo central (punto 9) para ver si mueve la mano a los lados
            let currentCenterX = landmarks[9].x * canvasElement.width;
            
            if (lastHandCenter !== null && !swipeTimeout) {
                let dx = currentCenterX - lastHandCenter; 
                // Aumentamos sensibilidad de 40 a 30 para que sea más fácil deslizar
                if (Math.abs(dx) > 30) { 
                    currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
                    photoDisplay.src = photos[currentPhotoIndex];
                    
                    // Bloquear swipe por 1 segundo para no cambiar tantas fotos rápido
                    swipeTimeout = true;
                    setTimeout(() => swipeTimeout = false, 1000);
                }
            }
            lastHandCenter = currentCenterX;
        }

        // 4. GESTO: Puño Cerrado (0 dedos) ✊ -> Detener Todo
        else if (analisis.totalDedos === 0 && !analisis.esCorazonCoreano) {
            gestureText = "Puño ✊ (Detener Todo)";
            lastHandCenter = null;
            if (!audioMusica.paused) {
                audioMusica.pause();
                // OPCIONAL: Reducir volumen en fade-out en vez de cortar de golpe
            }
        } else {
            lastHandCenter = null; // Resetear swipe si cambia de gesto
        }
    } else {
        lastHandCenter = null;
    }

    // Volvemos a modo normal antes de actualizar el texto para que no se vea al revés
    canvasCtx.restore();

    // Actualizar Panel
    gestureOverlay.innerText = gestureText;
}

// Bucle manual súper optimizado para móviles (evita que se traben los frames)
let isProcessingFrame = false;
async function processVideo() {
    if (!isRunning) return;
    
    // Solo enviamos a la IA si terminó de procesar el frame anterior, así no "explotamos" la RAM de iPhone
    if (videoElement.readyState >= 2 && !isProcessingFrame) {
        isProcessingFrame = true;
        await hands.send({ image: videoElement });
        isProcessingFrame = false;
    }
    // Repetir el bucle
    requestAnimationFrame(processVideo);
}

startBtn.addEventListener('click', async () => {
    if (!isRunning) {
        statusText.innerText = "Iniciando cámara nativa... 🎥";
        try {
            // Reemplazamos la librería "Camera" por el código nativo universal del navegador (soluciona Android de raíz)
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 320 }, // Resolución ultrabaja para máxima velocidad
                    height: { ideal: 240 } // (El Canvas de la pantalla la estira sin problema)
                },
                audio: false
            });
            
            videoElement.srcObject = stream;
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                isRunning = true;
                statusText.innerText = "¡Listo! Muéstrale tus manos a la cámara.";
                startBtn.innerText = "Apagar Sorpresa";
                
                // Iniciar el procesamiento constante a la mayor velocidad que aguante el celular
                requestAnimationFrame(processVideo);
            };
        } catch (e) {
            statusText.innerText = "No se pudo acceder a la cámara.";
            alert("Error: " + e.message + "\n\nAsegúrate de estar en Safari o Google Chrome y darle a 'Permitir'.");
        }
    } else {
        location.reload(); // Forma sencilla de apagar
    }
});