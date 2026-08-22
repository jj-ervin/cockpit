// Preload for the constrained install-mode window ONLY -- never used by the
// full Cockpit shell (see preload.cjs's own comment: the shell has no
// renderer-to-Node bridge at all, by design). This one is narrowly scoped to
// window-chrome operations (close this window, hand off to the full shell)
// that are not provider/backend actions and so have no place going through
// window.cockpitHost's HTTP bridge to host-web. It exposes no filesystem,
// process, or provider access.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('installControls', {
  closeWindow: () => ipcRenderer.send('cockpit-install:close'),
  openCockpit: () => ipcRenderer.send('cockpit-install:open-cockpit'),
});
