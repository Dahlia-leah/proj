const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const app = express();
const port = 5000;

// Variables to store the latest weight and unit data
let weight = null;
let unit = null;

// Function to detect and open the correct serial port
async function findAndConnectToScale() {
  try {
    const ports = await SerialPort.list(); // List all available ports

    if (ports.length === 0) {
      console.error('No serial ports found. Make sure the scale is connected.');
      return null;
    }

    // Find the scale's port
    const scalePortInfo = ports.find((p) => p.path.includes('tty') || p.path.includes('COM') || p.path.includes('cu'));

    if (!scalePortInfo) {
      console.error('No compatible scale port found.');
      return null;
    }

    const portPath = scalePortInfo.path;
    console.log(`Using port: ${portPath}`);

    // Open the serial port
    const scalePort = new SerialPort({
      path: portPath,
      baudRate: 9600, // Ensure this is the correct baud rate for your scale
    });

    // Use ReadlineParser to process data
    const parser = scalePort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    // Handle incoming data from the scale
    parser.on('data', (data) => {
      try {
        console.log(`Raw data received from scale: "${data}"`); // Debugging raw data

        // Clean the data to remove unwanted characters and excessive spaces
        const cleanedData = data.replace(/[^0-9.,a-zA-Z\s]/g, '').trim(); // Remove non-numeric, non-alphabetic, and non-space characters
        console.log(`Cleaned data: "${cleanedData}"`); // Debugging cleaned data

        // Remove unwanted prefixes (e.g., "enter." or "nter.")
        const noPrefixData = cleanedData.replace(/^(enter\.|nter\.)\s*/i, '').trim();
        console.log(`Data after removing prefix: "${noPrefixData}"`);

        // Remove extra spaces between the weight and unit
        const normalizedData = noPrefixData.replace(/\s+/g, ' '); // Replace multiple spaces with a single space
        console.log(`Normalized data: "${normalizedData}"`);

        // Example expected format: "2717.5 g"
        const match = normalizedData.match(/^([\d.]+)\s*([a-zA-Z]+)$/);

        if (match) {
          // Update the state variables each time new valid data is received
          weight = parseFloat(match[1]);
          unit = match[2].toLowerCase(); // Normalize unit to lowercase
          console.log(`Parsed weight: ${weight} ${unit}`);
        } else {
          console.error('Data format not recognized after cleaning:', normalizedData);
        }
      } catch (err) {
        console.error('Error parsing scale data:', err);
      }
    });

    scalePort.on('open', () => {
      console.log('Connected to scale.');
    });

    scalePort.on('error', (err) => {
      console.error('Serial port error:', err);
    });

    return scalePort;
  } catch (err) {
    console.error('Error detecting or connecting to serial port:', err);
    return null;
  }
}

// API endpoint to retrieve the current weight
app.get('/scale', async (req, res) => {
  if (weight === null || unit === null) {
    return res.status(500).json({ error: 'No valid data received from the scale yet.' });
  }
  res.json({ weight, unit });
});

// Start the server and initialize the serial connection
app.listen(port, async () => {
  console.log(`Scale API running on http://localhost:${port}`);
  const scalePort = await findAndConnectToScale();
  if (!scalePort) {
    console.error('Failed to connect to the scale. Ensure it is properly connected.');
  }
});
