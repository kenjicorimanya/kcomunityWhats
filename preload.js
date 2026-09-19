const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Licencias y Prueba
  getLicenseStatus: () => ipcRenderer.invoke('license:get-status'),
  activateLicense: (key) => ipcRenderer.invoke('license:activate', key),
  openStore: () => ipcRenderer.invoke('license:open-store'),

  // Ajustes de la aplicación
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // Gestión de pantallas de WhatsApp
  getScreens: () => ipcRenderer.invoke('screens:get'),
  saveScreens: (screens) => ipcRenderer.invoke('screens:save', screens),
  deleteScreenSession: (screenId) => ipcRenderer.invoke('screens:delete-session', screenId),

  // Navegación externa
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),

  // Portapapeles del sistema operativo
  writeClipboardImage: (dataUrl) => ipcRenderer.invoke('clipboard:write-image', dataUrl),
  writeClipboardText: (text) => ipcRenderer.invoke('clipboard:write-text', text),

  // Monitoreo y optimización de memoria
  getMemoryUsage: () => ipcRenderer.invoke('system:get-memory'),
  cleanMemory: () => ipcRenderer.invoke('system:clean-memory'),

  // Sistema de Versiones y Actualizaciones
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  checkUpdates: () => ipcRenderer.invoke('app:check-updates'),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('app:update-available', (_event, data) => callback(data));
  },

  // Eventos emitidos desde el proceso principal
  onLicenseChanged: (callback) => {
    ipcRenderer.on('license:changed', (_event, value) => callback(value));
  }
});
