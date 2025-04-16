document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    const clearButton = document.getElementById('clearCanvas');
    const colorPicker = document.getElementById('colorPicker');
    const brushSize = document.getElementById('brushSize');
    const smoothingSlider = document.getElementById('smoothingFactor');
    const statusText = document.getElementById('statusText');
    const debugMode = document.getElementById('debugMode');
    const mirrorMode = document.getElementById('mirrorMode');
    
    // Debug canvas for hand landmarks
    const debugCanvas = document.createElement('canvas');
    debugCanvas.style.position = 'absolute';
    debugCanvas.style.top = '0';
    debugCanvas.style.left = '0';
    debugCanvas.style.width = '100%';
    debugCanvas.style.height = '100%';
    debugCanvas.style.zIndex = '15';
    debugCanvas.style.pointerEvents = 'none';
    debugCanvas.style.display = 'none';
    document.querySelector('.canvas-container').appendChild(debugCanvas);
    const debugCtx = debugCanvas.getContext('2d');
    
    // Canvas setup
    function setupCanvas() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = colorPicker.value;
        ctx.lineWidth = brushSize.value;
        
        // Setup debug canvas
        debugCanvas.width = canvas.width;
        debugCanvas.height = canvas.height;
    }
    
    // Initialize canvas
    setupCanvas();
    
    // Handle window resize
    window.addEventListener('resize', setupCanvas);
    
    // Drawing state
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    let strokeStarted = false;
    let unpinchTimer = null;
    
    // Eraser state
    let isErasing = false;
    let palmDetectedTime = null;
    let eraserActivationTime = null;
    const palmDetectionDelay = 5000; // 5 seconds delay before activating eraser
    const eraserActiveTime = 5000; // 5 seconds of active eraser before requiring re-detection
    const eraserRadius = 20; // Smaller eraser radius
    
    // Points buffer for smoothing
    const pointsBuffer = [];
    const bufferSize = 8; // Number of points to average
    
    // MediaPipe Hands setup
    let hands;
    let camera;
    
    async function initializeHandDetection() {
        try {
            statusText.textContent = 'Loading hand detection model...';
            
            hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });
            
            hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1, // 0, 1, or 2; higher means better quality but slower
                minDetectionConfidence: 0.7, // Increased from 0.5 for more reliable detection
                minTrackingConfidence: 0.7  // Increased from 0.5 for more stable tracking
            });
            
            hands.onResults(onResults);
            
            await hands.initialize();
            
            statusText.textContent = 'Model loaded. Requesting camera access...';
            
            // Camera setup with higher resolution
            camera = new Camera(video, {
                onFrame: async () => {
                    try {
                        await hands.send({image: video});
                    } catch (error) {
                        console.error('Error in hand detection:', error);
                    }
                },
                width: 1920,  // Increased from 1280 to 1920 (Full HD)
                height: 1080  // Increased from 720 to 1080 (Full HD)
            });
            
            // Start camera
            await camera.start();
            statusText.textContent = 'Hand detection active. Pinch your thumb and index finger to draw!';
            
        } catch (error) {
            statusText.textContent = `Error initializing: ${error.message}`;
            console.error('Error initializing hand detection:', error);
        }
    }
    
    // Initialize hand detection
    initializeHandDetection();
    
    // Process hand detection results
    function onResults(results) {
        // Clear debug canvas if debug mode is on
        if (debugMode.checked) {
            debugCanvas.style.display = 'block';
            debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
        } else {
            debugCanvas.style.display = 'none';
        }
        
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const hand = results.multiHandLandmarks[0];
            
            // Get key hand landmarks
            const thumbTip = hand[4];  // Thumb tip
            const indexTip = hand[8];  // Index finger tip
            const middleTip = hand[12]; // Middle finger tip
            const ringTip = hand[16];  // Ring finger tip
            const pinkyTip = hand[20]; // Pinky tip
            const wrist = hand[0];     // Wrist
            
            // Calculate distance between thumb and index finger (2D - just x,y)
            const distance2D = calculateDistance(thumbTip, indexTip);
            
            // Calculate distance in 3D space
            const distance3D = calculateDistance3D(thumbTip, indexTip);
            
            // Detect open palm by checking if all fingers are extended
            // Calculate distances from palm center to fingertips
            const palmCenter = {
                x: (wrist.x + hand[9].x) / 2, // Average of wrist and middle finger MCP
                y: (wrist.y + hand[9].y) / 2,
                z: (wrist.z + hand[9].z) / 2
            };
            
            // Check if fingers are extended by comparing distances
            const thumbExtended = calculateDistance3D(thumbTip, wrist) > 0.15;
            const indexExtended = calculateDistance3D(indexTip, wrist) > 0.15;
            const middleExtended = calculateDistance3D(middleTip, wrist) > 0.15;
            const ringExtended = calculateDistance3D(ringTip, wrist) > 0.15;
            const pinkyExtended = calculateDistance3D(pinkyTip, wrist) > 0.15;
            
            // Palm is detected when all fingers are extended and spread out
            const isPalmDetected = thumbExtended && indexExtended && middleExtended && 
                                  ringExtended && pinkyExtended;
            
            // Always invert the x-coordinate because MediaPipe's coordinates are mirrored
            // compared to what we see on the canvas
            const thumbX = (1 - thumbTip.x) * canvas.width;
            const thumbY = thumbTip.y * canvas.height;
            const indexX = (1 - indexTip.x) * canvas.width;
            const indexY = indexTip.y * canvas.height;
            
            // Calculate hand size for reference
            const middleMCP = hand[9];
            const handSize = calculateDistance(wrist, middleMCP);
            
            // Use a much more lenient fixed threshold
            // This is a fixed value that works well for most hand sizes
            const pinchThreshold = 0.1;  // Fixed threshold
            
            // Check if thumb and index are close in z-axis too
            const zDifference = Math.abs(thumbTip.z - indexTip.z);
            
            // Improved pinch detection with multiple conditions
            // Using 2D distance for more reliable pinch detection
            const isPinching = distance2D < pinchThreshold;
            
            // Handle palm detection for eraser mode
            if (isPalmDetected) {
                if (!palmDetectedTime) {
                    // Start the timer when palm is first detected
                    palmDetectedTime = Date.now();
                } else if (Date.now() - palmDetectedTime >= palmDetectionDelay) {
                    // Activate eraser mode after delay
                    isErasing = true;
                    isDrawing = false; // Stop drawing when erasing
                    
                    // Set the time when eraser was activated
                    if (!eraserActivationTime) {
                        eraserActivationTime = Date.now();
                    }
                }
            } else {
                // Reset palm detection timer if palm is not detected
                palmDetectedTime = null;
            }
            
            // Switch back to drawing mode immediately when pinching
            if (isPinching) {
                isErasing = false;
            }
            
            // Draw hand landmarks in debug mode
            if (debugMode.checked) {
                drawHandLandmarks(hand);
                
                // Draw pinch points
                debugCtx.fillStyle = isPinching ? 'green' : 'red';
                debugCtx.beginPath();
                debugCtx.arc(thumbX, thumbY, 8, 0, Math.PI * 2);
                debugCtx.fill();
                
                debugCtx.beginPath();
                debugCtx.arc(indexX, indexY, 8, 0, Math.PI * 2);
                debugCtx.fill();
                
                // Draw line between thumb and index
                debugCtx.strokeStyle = isPinching ? 'green' : 'red';
                debugCtx.lineWidth = 2;
                debugCtx.beginPath();
                debugCtx.moveTo(thumbX, thumbY);
                debugCtx.lineTo(indexX, indexY);
                debugCtx.stroke();
                
                // Show detailed debug information
                debugCtx.fillStyle = 'white';
                debugCtx.font = '14px Arial';
                debugCtx.fillText(`2D Distance: ${distance2D.toFixed(3)}`, 10, 20);
                debugCtx.fillText(`3D Distance: ${distance3D.toFixed(3)}`, 10, 40);
                debugCtx.fillText(`Z Difference: ${zDifference.toFixed(3)}`, 10, 60);
                debugCtx.fillText(`Threshold: ${pinchThreshold.toFixed(3)}`, 10, 80);
                debugCtx.fillText(`Hand Size: ${handSize.toFixed(3)}`, 10, 100);
                debugCtx.fillText(`Pinch: ${isPinching ? 'YES' : 'NO'}`, 10, 120);
                
                // Draw midpoint where drawing will occur
                if (isPinching) {
                    const midX = (thumbX + indexX) / 2;
                    const midY = (thumbY + indexY) / 2;
                    
                    debugCtx.fillStyle = 'yellow';
                    debugCtx.beginPath();
                    debugCtx.arc(midX, midY, 10, 0, Math.PI * 2);
                    debugCtx.fill();
                }
                
                // Draw eraser circle when in eraser mode
                if (isErasing) {
                    const midX = (thumbX + indexX) / 2;
                    const midY = (thumbY + indexY) / 2;
                    
                    debugCtx.strokeStyle = 'red';
                    debugCtx.lineWidth = 2;
                    debugCtx.beginPath();
                    debugCtx.arc(midX, midY, eraserRadius, 0, Math.PI * 2);
                    debugCtx.stroke();
                    
                    // Fill the eraser circle with semi-transparent red
                    debugCtx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                    debugCtx.beginPath();
                    debugCtx.arc(midX, midY, eraserRadius, 0, Math.PI * 2);
                    debugCtx.fill();
                    
                    // Show eraser mode text
                    debugCtx.fillStyle = 'red';
                    debugCtx.font = 'bold 16px Arial';
                    debugCtx.fillText('ERASER MODE', 10, 160);
                    
                    // Show palm detection status
                    debugCtx.fillText(`Palm Detected: ${isPalmDetected ? 'YES' : 'NO'}`, 10, 180);
                }
            }
            
            // Get midpoint between thumb and index finger
            const midX = (thumbX + indexX) / 2;
            const midY = (thumbY + indexY) / 2;
            
            // Check if eraser has been active for too long and needs to be reset
            if (isErasing && eraserActivationTime && (Date.now() - eraserActivationTime >= eraserActiveTime)) {
                // Reset eraser mode after the active time
                isErasing = false;
                eraserActivationTime = null;
                palmDetectedTime = null; // Reset palm detection timer to require re-detection
            }
            
            // Update status text with mode information
            if (isErasing) {
                // Calculate remaining time for eraser mode
                const timeRemaining = Math.max(0, eraserActiveTime - (Date.now() - eraserActivationTime));
                statusText.textContent = `Eraser mode active for ${Math.ceil(timeRemaining/1000)} more second(s)! Move between thumb and index finger over lines to erase.`;
                
                // ERASER MODE - Use destination-out to erase
                ctx.save();
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillStyle = 'rgba(255, 255, 255, 1)'; // Solid white for erasing
                ctx.beginPath();
                ctx.arc(midX, midY, eraserRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                
                // Only draw eraser indicator in debug mode
                if (debugMode.checked) {
                    // The eraser indicator is already drawn in the debug canvas
                    // No need to draw it on the main canvas
                }
                
            } else if (isPinching) {
                statusText.textContent = 'Pinch detected! Drawing mode active.';
                
                // Clear unpinch timer if it exists
                if (unpinchTimer) {
                    clearTimeout(unpinchTimer);
                    unpinchTimer = null;
                }
                
                // Add point to buffer
                pointsBuffer.push({ x: midX, y: midY });
                
                // Keep buffer at fixed size
                if (pointsBuffer.length > bufferSize) {
                    pointsBuffer.shift();
                }
                
                // Calculate smoothed point
                const smoothedPoint = smoothPoints(pointsBuffer);
                
                if (!isDrawing) {
                    // Start a new line
                    isDrawing = true;
                    
                    // If this is a new stroke (after unpinching), start a new path
                    if (!strokeStarted) {
                        strokeStarted = true;
                        
                        // Just set the starting point without drawing
                        lastX = smoothedPoint.x;
                        lastY = smoothedPoint.y;
                    } else {
                        // Continue the line with the new point
                        drawLine(lastX, lastY, smoothedPoint.x, smoothedPoint.y);
                        lastX = smoothedPoint.x;
                        lastY = smoothedPoint.y;
                    }
                } else {
                    // Continue the line with the new point
                    drawLine(lastX, lastY, smoothedPoint.x, smoothedPoint.y);
                    lastX = smoothedPoint.x;
                    lastY = smoothedPoint.y;
                }
            } else {
                // No pinch - stop drawing after a short delay to avoid accidental breaks
                if (isDrawing) {
                    // Set a timer to stop drawing after a short delay
                    // This prevents the line from breaking during brief unpinch moments
                    if (!unpinchTimer) {
                        unpinchTimer = setTimeout(() => {
                            isDrawing = false;
                            strokeStarted = false; // Mark that a new stroke will start next time
                            pointsBuffer.length = 0; // Clear the buffer for the next stroke
                            unpinchTimer = null;
                        }, 100); // 100ms delay
                    }
                }
                
                if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                    if (isPalmDetected) {
                        const timeRemaining = Math.max(0, palmDetectionDelay - (Date.now() - palmDetectedTime));
                        if (timeRemaining > 0) {
                            statusText.textContent = `Palm detected! Hold for ${Math.ceil(timeRemaining/1000)} more second(s) to activate eraser.`;
                        }
                    } else {
                        statusText.textContent = 'Hand detected. Pinch your thumb and index finger to draw!';
                    }
                }
            }
        } else {
            // No hand detected
            isDrawing = false;
        }
    }
    
    // Draw hand landmarks for debugging
    function drawHandLandmarks(landmarks) {
        const connections = [
            // Thumb
            [0, 1], [1, 2], [2, 3], [3, 4],
            // Index finger
            [0, 5], [5, 6], [6, 7], [7, 8],
            // Middle finger
            [0, 9], [9, 10], [10, 11], [11, 12],
            // Ring finger
            [0, 13], [13, 14], [14, 15], [15, 16],
            // Pinky
            [0, 17], [17, 18], [18, 19], [19, 20],
            // Palm
            [0, 5], [5, 9], [9, 13], [13, 17]
        ];
        
        // Draw connections
        debugCtx.strokeStyle = 'white';
        debugCtx.lineWidth = 2;
        
        for (const [i, j] of connections) {
            const start = landmarks[i];
            const end = landmarks[j];
            
            // Always invert the x-coordinate for consistent mapping
            const startX = (1 - start.x) * debugCanvas.width;
            const startY = start.y * debugCanvas.height;
            const endX = (1 - end.x) * debugCanvas.width;
            const endY = end.y * debugCanvas.height;
            
            debugCtx.beginPath();
            debugCtx.moveTo(startX, startY);
            debugCtx.lineTo(endX, endY);
            debugCtx.stroke();
        }
        
        // Draw landmarks
        debugCtx.fillStyle = 'blue';
        
        for (const landmark of landmarks) {
            // Always invert the x-coordinate for consistent mapping
            const x = (1 - landmark.x) * debugCanvas.width;
            const y = landmark.y * debugCanvas.height;
            
            debugCtx.beginPath();
            debugCtx.arc(x, y, 4, 0, Math.PI * 2);
            debugCtx.fill();
        }
    }
    
    // Calculate Euclidean distance between two points (2D - x,y only)
    function calculateDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point1.x - point2.x, 2) + 
            Math.pow(point1.y - point2.y, 2)
        );
    }
    
    // Calculate Euclidean distance between two points in 3D space
    function calculateDistance3D(point1, point2) {
        return Math.sqrt(
            Math.pow(point1.x - point2.x, 2) + 
            Math.pow(point1.y - point2.y, 2) +
            Math.pow(point1.z - point2.z, 2)
        );
    }
    
    // Calculate average of points in buffer for smoothing
    function smoothPoints(points) {
        if (points.length === 0) return { x: 0, y: 0 };
        
        // Simple moving average
        let sumX = 0;
        let sumY = 0;
        
        for (const point of points) {
            sumX += point.x;
            sumY += point.y;
        }
        
        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }
    
    // Draw a line on the canvas
    function drawLine(x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    
    // Clear canvas
    clearButton.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Reset drawing state
        isDrawing = false;
        strokeStarted = false;
        pointsBuffer.length = 0;
    });
    
    // Update stroke color
    colorPicker.addEventListener('input', () => {
        ctx.strokeStyle = colorPicker.value;
    });
    
    // Update brush size
    brushSize.addEventListener('input', () => {
        ctx.lineWidth = brushSize.value;
    });
    
    // Update smoothing factor (no action needed as it's read directly from the slider)
    smoothingSlider.addEventListener('input', () => {
        // The smoothing factor is read directly from the slider in the drawSmoothLine function
        // This event listener is just for clarity
    });
    
    // Toggle debug mode
    debugMode.addEventListener('change', () => {
        if (debugMode.checked) {
            video.style.opacity = '0.7'; // Make video more visible in debug mode
        } else {
            video.style.opacity = '0.3'; // Return to normal opacity
        }
    });
    
    // Toggle mirror mode - only affects the video display, not the coordinates
    mirrorMode.addEventListener('change', () => {
        if (mirrorMode.checked) {
            video.style.transform = 'scaleX(-1)'; // Mirror the video display
        } else {
            video.style.transform = 'scaleX(1)'; // Don't mirror the video display
        }
    });
});
