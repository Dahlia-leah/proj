const { app, BrowserWindow, ipcMain } = require('electron');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const path = require('path');

// Create the main window
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true, // Allow Node.js modules in the renderer process
    },
  });

  win.loadFile('index.html'); // Load the HTML file for the frontend
}

// API for handling scale data
let weight = null;
let unit = null;

async function findAndConnectToScale() {
  try {
    const ports = await SerialPort.list();

    if (ports.length === 0) {
      console.error('No serial ports found. Make sure the scale is connected.');
      return null;
    }

    const scalePortInfo = ports.find((p) => p.path.includes('tty') || p.path.includes('COM') || p.path.includes('cu'));

    if (!scalePortInfo) {
      console.error('No compatible scale port found.');
      return null;
    }

    const portPath = scalePortInfo.path;
    console.log(`Using port: ${portPath}`);

    const scalePort = new SerialPort({
      path: portPath,
      baudRate: 9600,
    });

    const parser = scalePort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    parser.on('data', (data) => {
      try {
        const cleanedData = data.replace(/[^0-9.,a-zA-Z\s]/g, '').trim();
        const noPrefixData = cleanedData.replace(/^(enter\.|nter\.)\s*/i, '').trim();
        const normalizedData = noPrefixData.replace(/\s+/g, ' ');

        const match = normalizedData.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
        if (match) {
          weight = parseFloat(match[1]);
          unit = match[2].toLowerCase();
          console.log(`Parsed weight: ${weight} ${unit}`);
          win.webContents.send('update-weight', { weight, unit });
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

app.whenReady().then(() => {
  createWindow();
  findAndConnectToScale();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit the app when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
