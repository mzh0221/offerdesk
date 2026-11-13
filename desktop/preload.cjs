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

contextBridge.exposeInMainWorld('externalImports', {
  configs: () => ipcRenderer.invoke('external-import:configs'),
  copyText: text => ipcRenderer.invoke('external-import:copy', text),
  prepareAuto: (id, variant) => ipcRenderer.invoke('external-import:auto-prepare', id, variant),
  applyAuto: token => ipcRenderer.invoke('external-import:auto-apply', token),
  checkService: () => ipcRenderer.invoke('external-import:service-check'),
  listen: callback => {
    const listener = (_event, id, body) => callback(id, body);
    ipcRenderer.on('external-import:request', listener);
    ipcRenderer.send('external-import:ready');
    return () => ipcRenderer.removeListener('external-import:request', listener);
  },
  respond: (id, response) => ipcRenderer.send('external-import:result', id, response),
});
