/**
 * Gestor de Ajustes y Apariencia
 * Control de temas (claro/oscuro), fuentes, audio y notificaciones
 */

const SettingsManager = {
  settings: {
    theme: 'dark',
    fontSize: 'normal',
    notifications: true,
    audioEnabled: true,
    layoutMode: 'tabs'
  },

  async init() {
    if (window.electronAPI && window.electronAPI.getSettings) {
      try {
        const saved = await window.electronAPI.getSettings();
        if (saved) {
          this.settings = { ...this.settings, ...saved };
        }
      } catch (e) {
        console.error('Error cargando ajustes:', e);
      }
    }
    this.applySettings();
  },

  applySettings() {
    // Aplicar Tema
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${this.settings.theme}`);

    // Aplicar Tamaño de Fuente
    document.body.classList.remove('font-small', 'font-normal', 'font-large');
    document.body.classList.add(`font-${this.settings.fontSize}`);

    // Aplicar Audio a los WebViews existentes
    this.updateAudioState();
  },

  updateAudioState() {
    const webviews = document.querySelectorAll('webview');
    webviews.forEach(wv => {
      try {
        if (typeof wv.setAudioMuted === 'function') {
          wv.setAudioMuted(!this.settings.audioEnabled);
        }
      } catch (e) {
        // Puede que aún esté cargando
      }
    });
  },

  async save(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.applySettings();
    if (window.electronAPI && window.electronAPI.saveSettings) {
      await window.electronAPI.saveSettings(this.settings);
    }
  }
};

window.SettingsManager = SettingsManager;
