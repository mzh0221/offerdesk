const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('localOcr', {
  recognize: (id, bytes) => ipcRenderer.invoke('ocr:recognize', id, bytes),
  cancel: id => ipcRenderer.invoke('ocr:cancel', id),
  onProgress: callback => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('ocr:progress', listener);
    return () => ipcRenderer.removeListener('ocr:progress', listener);
  },
});
