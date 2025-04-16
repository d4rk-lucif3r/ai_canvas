# AI Canvas - Hand Gesture Drawing

AI Canvas is a web application that allows you to draw on a digital canvas using hand gestures. It uses computer vision to detect your hand and recognize a pinch gesture (thumb and index finger touching) to enable drawing.

**Built with ❤️ by [Ana](https://www.openana.ai)**

## Features

- **Hand Gesture Drawing**: Draw by pinching your thumb and index finger together
- **Color Selection by Hover**: Simply hover your index finger over a color to select it
- **Eraser Mode**: Show an open palm with fingers spread apart for 5 seconds to activate eraser
- **Brush Size Control**: Adjust the thickness of your drawing lines
- **Smoothing Control**: Adjust the smoothness of your drawing lines
- **Help Popup**: Interactive guide with instructions on how to use the app
- **Debug Mode**: Visualize hand landmarks and pinch detection
- **Responsive Design**: Works on various screen sizes
- **Modern UI**: Sleek dark theme with orange accents

## How to Use

1. **Open the Application**:
   - Open `index.html` in a modern web browser (Chrome, Firefox, Edge recommended)
   - Allow camera access when prompted

2. **Drawing**:
   - Position your hand in front of the camera
   - Pinch your thumb and index finger together to start drawing
   - Move your hand while maintaining the pinch to draw lines
   - Release the pinch to stop drawing

3. **Color Selection**:
   - Hover your index finger over the color palette at the top of the canvas
   - The color will be selected automatically (no pinch required)
   - Status text will show which color is selected

4. **Eraser Mode**:
   - Show an open palm with fingers spread apart for 5 seconds
   - Once activated, the eraser will appear between your thumb and index finger
   - Move your hand to erase drawn lines
   - Eraser mode will automatically deactivate after 5 seconds

5. **Controls**:
   - **Brush Size**: Adjust the slider to change line thickness
   - **Smoothing**: Adjust the slider to change line smoothness
   - **Clear Canvas**: Click the button to erase everything and start over
   - **Help**: Click the help button to see detailed usage instructions
   - **Debug Mode**: Toggle the checkbox to see hand landmarks and pinch detection visualization
   - **Mirror Mode**: Toggle the checkbox to mirror or un-mirror the camera feed

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

## Credits

- Developed by [Ana](https://www.openana.ai)
- Powered by MediaPipe Hands technology
- UI design inspired by [openana.ai](https://www.openana.ai)
