# AI Canvas - Hand Gesture Drawing

AI Canvas is a web application that allows you to draw on a digital canvas using hand gestures. It uses computer vision to detect your hand and recognize a pinch gesture (thumb and index finger touching) to enable drawing.

## Features

- **Hand Gesture Drawing**: Draw by pinching your thumb and index finger together
- **Color Selection**: Choose any color for your drawing
- **Brush Size Control**: Adjust the thickness of your drawing lines
- **Debug Mode**: Visualize hand landmarks and pinch detection
- **Responsive Design**: Works on various screen sizes

## How to Use

1. **Open the Application**:
   - Open `index.html` in a modern web browser (Chrome, Firefox, Edge recommended)
   - Allow camera access when prompted

2. **Drawing**:
   - Position your hand in front of the camera
   - Pinch your thumb and index finger together to start drawing
   - Move your hand while maintaining the pinch to draw lines
   - Release the pinch to stop drawing

3. **Controls**:
   - **Color**: Click the color picker to change the drawing color
   - **Brush Size**: Adjust the slider to change line thickness
   - **Clear Canvas**: Click the button to erase everything and start over
   - **Debug Mode**: Toggle the checkbox to see hand landmarks and pinch detection visualization

## Debug Mode

When debug mode is enabled, you'll see:
- Blue dots showing all hand landmarks
- White lines connecting the landmarks
- Red/green circles on your thumb and index finger (green when pinching)
- A yellow circle showing the drawing point when pinching
- Real-time information about distance, threshold, and pinch state

## Tips for Best Results

1. **Lighting**: Ensure good, even lighting on your hand
2. **Hand Position**: Keep your hand clearly visible to the camera
3. **Distance**: Position your hand at a comfortable distance from the camera
4. **Background**: A plain background works best for hand detection
5. **Pinch Gesture**: Make a clear pinch with your thumb and index finger

## Technical Details

This application uses:
- **MediaPipe Hands**: For hand landmark detection
- **HTML5 Canvas**: For drawing functionality
- **Adaptive Pinch Detection**: Threshold adjusts based on hand size

## Troubleshooting

- **Camera Access**: Make sure you've allowed camera access in your browser
- **Hand Detection Issues**: Enable debug mode to see if your hand is being detected properly
- **Pinch Not Registering**: Try adjusting the distance between your thumb and index finger
- **Performance Issues**: Close other applications or tabs that might be using your camera
