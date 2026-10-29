const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('load'),
  save: (data) => ipcRenderer.invoke('save', data),
  backup: () => ipcRenderer.invoke('backup'),
  backupInfo: () => ipcRenderer.invoke('backupInfo'),
  chooseBackupDir: () => ipcRenderer.invoke('chooseBackupDir'),
  openBackupDir: () => ipcRenderer.invoke('openBackupDir'),
  restore: () => ipcRenderer.invoke('restore'),
  getTheme: () => ipcRenderer.invoke('getTheme'),
  setTheme: (t) => ipcRenderer.invoke('setTheme', t),
})
