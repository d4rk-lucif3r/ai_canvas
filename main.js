document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('drawingCanvas');
    const ctx = canvas.getContext('2d');
    const clearButton = document.getElementById('clearCanvas');
    const brushSize = document.getElementById('brushSize');
    const smoothingSlider = document.getElementById('smoothingFactor');
    const statusText = document.getElementById('statusText');
    const debugMode = document.getElementById('debugMode');
    const mirrorMode = document.getElementById('mirrorMode');
    
    // Help Modal Elements
    const helpButton = document.getElementById('helpButton');
    const helpModal = document.getElementById('helpModal');
    const closeModal = document.getElementById('closeModal');
    
    // Show Help Modal
    helpButton.addEventListener('click', () => {
        helpModal.style.display = 'block';
    });
    
    // Close Help Modal
    closeModal.addEventListener('click', () => {
        helpModal.style.display = 'none';
    });
    
    // Close Modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === helpModal) {
            helpModal.style.display = 'none';
        }
    });
    
    // Close Modal with Escape key
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && helpModal.style.display === 'block') {
            helpModal.style.display = 'none';
        }
    });
    
    // Color palette
    const colors = [
        '#000000', // Black
        '#FFFFFF', // White
        '#FF0000', // Red
        '#00FF00', // Green
        '#0000FF', // Blue
        '#FFFF00', // Yellow
        '#FF00FF', // Magenta
        '#00FFFF', // Cyan
        '#FFA500', // Orange
        '#800080'  // Purple
    ];
    let currentColor = colors[0]; // Default to black
    const colorPaletteSize = 30; // Size of each color square
    const colorPaletteMargin = 10; // Margin between color squares
    const colorPaletteTop = 10; // Top position of the color palette
    
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
        // Set canvas resolution to match display size for crisp rendering
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        // Set the canvas dimensions to match its CSS size * device pixel ratio
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        // Scale the context to ensure correct drawing
        ctx.scale(dpr, dpr);
        
        // Set canvas CSS size
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = brushSize.value;
        
        // Setup debug canvas with the same dimensions
        debugCanvas.width = canvas.width;
        debugCanvas.height = canvas.height;
        debugCtx.scale(dpr, dpr);
        debugCanvas.style.width = `${rect.width}px`;
        debugCanvas.style.height = `${rect.height}px`;
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
    
    // Draw the color palette on the canvas
    function drawColorPalette() {
        // Draw each color square
        for (let i = 0; i < colors.length; i++) {
            const x = colorPaletteMargin + i * (colorPaletteSize + colorPaletteMargin);
            const y = colorPaletteTop;
            
            // Draw color square
            ctx.fillStyle = colors[i];
            ctx.fillRect(x, y, colorPaletteSize, colorPaletteSize);
            
            // Draw border (highlight current color)
            ctx.strokeStyle = colors[i] === currentColor ? '#FFFFFF' : '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, colorPaletteSize, colorPaletteSize);
        }
    }
    
    // Check if a point is inside a color square
    function isPointInColorPalette(x, y) {
        if (y < colorPaletteTop || y > colorPaletteTop + colorPaletteSize) {
            return -1; // Not in the color palette row
        }
        
        for (let i = 0; i < colors.length; i++) {
            const squareX = colorPaletteMargin + i * (colorPaletteSize + colorPaletteMargin);
            if (x >= squareX && x <= squareX + colorPaletteSize) {
                return i; // Return the index of the color
            }
        }
        
        return -1; // Not on any color square
    }
    
    // Process hand detection results
    function onResults(results) {
        // Clear debug canvas if debug mode is on
        if (debugMode.checked) {
            debugCanvas.style.display = 'block';
            debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
        } else {
            debugCanvas.style.display = 'none';
        }
        
        // Draw the color palette
        drawColorPalette();
        
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
            
            // Get the canvas rect and device pixel ratio for accurate coordinate mapping
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            
            // Map hand coordinates to the canvas display size (not the internal resolution)
            // Always invert the x-coordinate because MediaPipe's coordinates are mirrored
            const thumbX = (1 - thumbTip.x) * rect.width;
            const thumbY = thumbTip.y * rect.height;
            const indexX = (1 - indexTip.x) * rect.width;
            const indexY = indexTip.y * rect.height;
            
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
            
            // Define a threshold for fingers being far apart
            const fingersApartThreshold = 0.3; // Larger threshold for fingers being far apart
            
            // Check if thumb and index finger are far apart (for eraser mode)
            const isFingersApart = distance2D > fingersApartThreshold;
            
            // Handle palm detection for eraser mode - require both palm detection AND fingers being far apart
            if (isPalmDetected && isFingersApart) {
                if (!palmDetectedTime) {
                    // Start the timer when palm is first detected with fingers apart
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
                // Reset palm detection timer if palm is not detected or fingers are not apart
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
            
            // Check if the index finger is hovering over a color in the palette
            if (!isErasing) {
                const colorIndex = isPointInColorPalette(indexX, indexY);
                if (colorIndex !== -1) {
                    // Highlight the color being hovered
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 3;
                    const x = colorPaletteMargin + colorIndex * (colorPaletteSize + colorPaletteMargin);
                    ctx.strokeRect(x, colorPaletteTop, colorPaletteSize, colorPaletteSize);
                    
                    // Select the color on hover (no pinch required)
                    currentColor = colors[colorIndex];
                    ctx.strokeStyle = currentColor;
                    
                    // Show color selection feedback
                    statusText.textContent = `Selected color: ${colors[colorIndex]}`;
                    
                    // Redraw the color palette to show the selected color
                    drawColorPalette();
                }
            }
            
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
                
                // Redraw the color palette after erasing
                drawColorPalette();
                
            } else if (isPinching) {
                statusText.textContent = 'Pinch detected! Drawing mode active.';
                
                // Clear unpinch timer if it exists
                if (unpinchTimer) {
                    clearTimeout(unpinchTimer);
                    unpinchTimer = null;
                }
                
                // Check if we're hovering over the color palette
                const colorIndex = isPointInColorPalette(midX, midY);
                if (colorIndex !== -1) {
                    // Select the color
                    currentColor = colors[colorIndex];
                    ctx.strokeStyle = currentColor;
                    // Redraw the color palette to show the selected color
                    drawColorPalette();
                } else {
                    // Only draw if not selecting a color
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
            
            // Still draw the color palette
            drawColorPalette();
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
        
        // Get the canvas rect for accurate coordinate mapping
        const rect = debugCanvas.getBoundingClientRect();
        
        // Draw connections
        debugCtx.strokeStyle = 'white';
        debugCtx.lineWidth = 2;
        
        for (const [i, j] of connections) {
            const start = landmarks[i];
            const end = landmarks[j];
            
            // Always invert the x-coordinate for consistent mapping
            // Map to CSS pixels (not canvas internal resolution)
            const startX = (1 - start.x) * rect.width;
            const startY = start.y * rect.height;
            const endX = (1 - end.x) * rect.width;
            const endY = end.y * rect.height;
            
            debugCtx.beginPath();
            debugCtx.moveTo(startX, startY);
            debugCtx.lineTo(endX, endY);
            debugCtx.stroke();
        }
        
        // Draw landmarks
        debugCtx.fillStyle = 'blue';
        
        for (const landmark of landmarks) {
            // Always invert the x-coordinate for consistent mapping
            // Map to CSS pixels (not canvas internal resolution)
            const x = (1 - landmark.x) * rect.width;
            const y = landmark.y * rect.height;
            
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
        ctx.save();
        ctx.strokeStyle = currentColor;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }
    
    // Clear canvas
    clearButton.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Reset drawing state
        isDrawing = false;
        strokeStarted = false;
        pointsBuffer.length = 0;
        
        // Redraw the color palette
        drawColorPalette();
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
