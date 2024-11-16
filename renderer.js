const { ipcRenderer } = require('electron');

ipcRenderer.on('update-weight', (event, data) => {
  const weightElement = document.getElementById('weight');
  const unitElement = document.getElementById('unit');

  weightElement.textContent = data.weight;
  unitElement.textContent = data.unit;
});
