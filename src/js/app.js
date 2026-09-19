/**
 * Controlador Principal de Pantallas de WhatsApp
 * Aislamiento de sesiones mediante particiones persistentes
 */

const AppManager = {
  screens: [],
  activeScreenId: null,
  currentViewMode: 'tabs', // 'tabs' | 'grid'
  currentSection: 'multi', // 'multi' | 'bulk'
  screenZooms: {},
  unreadCounts: {}, // screenId -> unread message count

  async init() {
    this.bindGlobalEvents();

    // Inicializar subsistemas
    await window.SettingsManager.init();
    await window.LicenseUI.init();
    window.ModalsManager.init();
    if (window.BulkSender) {
      window.BulkSender.init();
    }

    // Cargar modo de vista guardado
    this.currentViewMode = window.SettingsManager.settings.layoutMode || 'tabs';
    this.updateViewModeUI();

    // Cargar pantallas guardadas
    await this.loadScreens();

    // Escuchar avisos de actualización automática desde el servidor
    if (window.electronAPI && window.electronAPI.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable((updateData) => {
        window.ModalsManager.open('update-available', updateData);
      });
    }
  },

  bindGlobalEvents() {
    // Conmutador de Secciones Principales
    document.getElementById('nav-btn-multi')?.addEventListener('click', () => {
      this.switchSection('multi');
    });

    document.getElementById('nav-btn-bulk')?.addEventListener('click', () => {
      this.switchSection('bulk');
    });

    // Botón agregar pantalla / línea
    const btnAdd = document.getElementById('btn-add-screen');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        window.ModalsManager.open('add-screen');
      });
    }

    // Botones de cambio de vista (Pestañas vs Cuadrícula)
    const btnTabs = document.getElementById('btn-view-tabs');
    const btnGrid = document.getElementById('btn-view-grid');

    if (btnTabs) {
      btnTabs.addEventListener('click', () => {
        this.setViewMode('tabs');
      });
    }

    if (btnGrid) {
      btnGrid.addEventListener('click', () => {
        this.setViewMode('grid');
      });
    }
  },

  switchSection(section) {
    this.currentSection = section;

    const btnMulti = document.getElementById('nav-btn-multi');
    const btnBulk = document.getElementById('nav-btn-bulk');
    const viewMulti = document.getElementById('view-multi-whatsapp');
    const viewBulk = document.getElementById('view-bulk-sender');
    const viewControls = document.getElementById('multi-view-controls');

    if (section === 'multi') {
      btnMulti?.classList.add('active');
      btnBulk?.classList.remove('active');
      viewMulti?.classList.add('active');
      viewBulk?.classList.remove('active');
      if (viewControls) viewControls.style.display = 'flex';
    } else {
      btnBulk?.classList.add('active');
      btnMulti?.classList.remove('active');
      viewBulk?.classList.add('active');
      viewMulti?.classList.remove('active');
      if (viewControls) viewControls.style.display = 'none';

      // Renderizar y sincronizar las tarjetas de línea y el panel de trabajo
      if (window.BulkSender) {
        window.BulkSender.renderLineCards();
        if (window.BulkSender.selectedLineId) {
          window.BulkSender.renderWorkspace();
        }
      }
    }
  },

  setViewMode(mode) {
    this.currentViewMode = mode;
    window.SettingsManager.save({ layoutMode: mode });
    this.updateViewModeUI();
  },

  setScreenZoom(screenId, zoom) {
    const wv = document.getElementById(`wv-${screenId}`);
    const clamped = Math.max(0.5, Math.min(1.3, Math.round(zoom * 100) / 100));
    this.screenZooms[screenId] = clamped;
    if (wv && typeof wv.setZoomFactor === 'function') {
      try {
        wv.setZoomFactor(clamped);
      } catch (e) {}
    }
    const wrapper = document.getElementById(`wrapper-${screenId}`);
    const zoomText = wrapper?.querySelector('.zoom-level-text');
    if (zoomText) {
      zoomText.textContent = `${Math.round(clamped * 100)}%`;
    }
  },

  injectResponsiveWhatsAppCSS(wv) {
    if (!wv) return;
    const customCSS = `
      /* Ocultar únicamente el banner de descarga que empuja y corta el código QR */
      a[href*="whatsapp.com/download"],
      [data-testid="download-desktop-app-banner"] {
        display: none !important;
      }
    `;

    try {
      if (typeof wv.insertCSS === 'function') {
        wv.insertCSS(customCSS);
      }
    } catch (e) {
      console.warn('No se pudo inyectar CSS en webview:', e);
    }
  },

  parseUnreadCountFromTitle(title) {
    if (!title || typeof title !== 'string') return 0;
    // Extrae números entre paréntesis al inicio del título, e.g. "(1) WhatsApp", "(12) WhatsApp"
    const numMatch = title.match(/^\s*[\(\[]\s*(\d+)\+?\s*[\)\]]/);
    if (numMatch) {
      return parseInt(numMatch[1], 10);
    }
    // Indicador con viñeta o punto no leído, e.g. "(•) WhatsApp", "● WhatsApp"
    if (/^\s*[\(\[]?\s*[•·●*]\s*[\)\]]?/.test(title)) {
      return 1;
    }
    return 0;
  },

  setScreenUnread(screenId, count) {
    this.unreadCounts[screenId] = count;

    const tab = document.getElementById(`tab-${screenId}`);
    const wrapper = document.getElementById(`wrapper-${screenId}`);

    if (count > 0) {
      // 1. Notificación visual en la Pestaña
      if (tab) {
        if (screenId !== this.activeScreenId || this.currentViewMode === 'grid') {
          tab.classList.add('has-unread');
        }
        let badge = tab.querySelector('.tab-unread-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'tab-unread-badge';
          const titleEl = tab.querySelector('.tab-title');
          if (titleEl) {
            titleEl.after(badge);
          } else {
            tab.appendChild(badge);
          }
        }
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'inline-flex';
      }

      // 2. Notificación visual en Modo Cuadrícula
      if (wrapper) {
        wrapper.classList.add('has-unread');
        let miniBadge = wrapper.querySelector('.screen-unread-badge');
        if (!miniBadge) {
          miniBadge = document.createElement('span');
          miniBadge.className = 'screen-unread-badge';
          const titleBox = wrapper.querySelector('.screen-header-title-box');
          if (titleBox) {
            const renameBtn = titleBox.querySelector('.btn-rename-mini');
            if (renameBtn) {
              titleBox.insertBefore(miniBadge, renameBtn);
            } else {
              titleBox.appendChild(miniBadge);
            }
          }
        }
        if (miniBadge) {
          miniBadge.textContent = count > 99 ? '99+' : count;
          miniBadge.style.display = 'inline-flex';
        }
      }
    } else {
      // Limpiar estado cuando se leen los mensajes
      if (tab) {
        tab.classList.remove('has-unread');
        const badge = tab.querySelector('.tab-unread-badge');
        if (badge) badge.remove();
      }
      if (wrapper) {
        wrapper.classList.remove('has-unread');
        const miniBadge = wrapper.querySelector('.screen-unread-badge');
        if (miniBadge) miniBadge.remove();
      }
    }
  },

  updateViewModeUI() {
    const btnTabs = document.getElementById('btn-view-tabs');
    const btnGrid = document.getElementById('btn-view-grid');
    const container = document.getElementById('screens-container');
    const nav = document.getElementById('screens-nav');

    // Quitar clases previas de grid
    container?.classList.remove('grid-1', 'grid-2', 'grid-3', 'grid-4', 'grid-more');

    // Remover estado maximizado si venía de grid
    container?.querySelectorAll('.screen-wrapper.maximized-grid').forEach(w => {
      w.classList.remove('maximized-grid');
      const btn = w.querySelector('.btn-maximize-grid');
      if (btn) {
        btn.innerHTML = '⛶';
        btn.title = 'Maximizar pantalla';
      }
    });

    const count = this.screens.length;
    if (this.currentViewMode === 'tabs') {
      btnTabs?.classList.add('active');
      btnGrid?.classList.remove('active');
      container?.classList.remove('mode-grid');
      container?.classList.add('mode-tabs');
      if (nav) nav.style.display = 'flex';

      // En pestañas restablecer zoom a 100%
      this.screens.forEach(s => {
        this.setScreenZoom(s.id, 1.0);
      });
    } else {
      btnGrid?.classList.add('active');
      btnTabs?.classList.remove('active');
      container?.classList.remove('mode-tabs');
      container?.classList.add('mode-grid');
      if (nav) nav.style.display = 'none';

      // Asignar clase de distribución simétrica según el número de pantallas
      if (count === 1) container?.classList.add('grid-1');
      else if (count === 2) container?.classList.add('grid-2');
      else if (count === 3) container?.classList.add('grid-3');
      else if (count === 4) container?.classList.add('grid-4');
      else container?.classList.add('grid-more');

      // En modo cuadrícula mantener zoom al 100% por defecto (o el que el usuario haya seleccionado)
      this.screens.forEach(s => {
        const targetZoom = this.screenZooms[s.id] || 1.0;
        this.setScreenZoom(s.id, targetZoom);
      });
    }

    // Refrescar visibilidad
    this.updateScreensVisibility();
  },

  async loadScreens() {
    if (window.electronAPI && window.electronAPI.getScreens) {
      try {
        const list = await window.electronAPI.getScreens();
        if (Array.isArray(list) && list.length > 0) {
          this.screens = list;
        } else {
          this.screens = [{ id: 'screen_1', name: 'Cuenta Principal', createdAt: Date.now() }];
        }
      } catch (e) {
        console.error('Error cargando pantallas:', e);
        this.screens = [{ id: 'screen_1', name: 'Cuenta Principal', createdAt: Date.now() }];
      }
    } else {
      this.screens = [{ id: 'screen_1', name: 'Cuenta Principal', createdAt: Date.now() }];
    }

    this.activeScreenId = this.screens[0]?.id || null;
    this.renderAll();
  },

  async saveScreens() {
    if (window.electronAPI && window.electronAPI.saveScreens) {
      await window.electronAPI.saveScreens(this.screens);
    }
  },

  renderAll() {
    this.renderTabs();
    this.renderWebviews();
    this.updateScreensVisibility();
    if (window.BulkSender) {
      window.BulkSender.renderLineCards();
      if (window.BulkSender.selectedLineId) {
        window.BulkSender.renderWorkspace();
      }
    }
  },

  renderTabs() {
    const nav = document.getElementById('screens-nav');
    if (!nav) return;
    nav.innerHTML = '';

    this.screens.forEach(screen => {
      const tab = document.createElement('div');
      const unread = this.unreadCounts[screen.id] || 0;
      const isUnread = unread > 0 && screen.id !== this.activeScreenId;
      tab.className = `tab-item ${screen.id === this.activeScreenId ? 'active' : ''} ${isUnread ? 'has-unread' : ''}`.trim();
      tab.id = `tab-${screen.id}`;
      tab.innerHTML = `
        <span class="tab-title" title="${screen.name}">${screen.name}</span>
        ${isUnread ? `<span class="tab-unread-badge">${unread > 99 ? '99+' : unread}</span>` : ''}
        <button class="tab-edit" title="Renombrar pantalla">✏️</button>
        <button class="tab-close" title="Cerrar pantalla">✕</button>
      `;

      // Doble clic sobre la pestaña para renombrar rápidamente
      tab.addEventListener('dblclick', (e) => {
        if (!e.target.closest('.tab-close')) {
          window.ModalsManager.open('rename-screen', screen);
        }
      });

      tab.addEventListener('click', (e) => {
        if (e.target.closest('.tab-close')) {
          e.stopPropagation();
          window.ModalsManager.open('delete-screen', screen);
        } else if (e.target.closest('.tab-edit')) {
          e.stopPropagation();
          window.ModalsManager.open('rename-screen', screen);
        } else {
          this.selectScreen(screen.id);
        }
      });

      nav.appendChild(tab);
    });
  },

  renderWebviews() {
    const container = document.getElementById('screens-container');
    if (!container) return;

    // Conservar webviews ya cargados para no perder la sesión ni reiniciar WhatsApp
    const existingWvs = new Map();
    container.querySelectorAll('.screen-wrapper').forEach(wrap => {
      const id = wrap.dataset.screenId;
      existingWvs.set(id, wrap);
    });

    // Añadir o mantener
    this.screens.forEach(screen => {
      if (existingWvs.has(screen.id)) {
        // Ya existe, actualizar el header si cambió de nombre
        const existingWrap = existingWvs.get(screen.id);
        const nameSpan = existingWrap.querySelector('.screen-name-text');
        if (nameSpan) nameSpan.textContent = screen.name;
        existingWvs.delete(screen.id);
      } else {
        // Crear nuevo contenedor y webview
        const currentZoom = this.screenZooms[screen.id] || 1.0;
        this.screenZooms[screen.id] = currentZoom;

        const wrapper = document.createElement('div');
        wrapper.className = `screen-wrapper ${screen.id === this.activeScreenId ? 'active' : ''}`;
        wrapper.dataset.screenId = screen.id;
        wrapper.id = `wrapper-${screen.id}`;

        wrapper.innerHTML = `
          <div class="screen-header-mini">
            <div class="screen-header-title-box" title="Clic para renombrar pantalla">
              <span class="screen-icon">📱</span>
              <span class="screen-name-text">${screen.name}</span>
              <button class="header-action-btn btn-rename-mini" title="Renombrar pantalla">✏️</button>
            </div>
            <div class="screen-header-actions">
              <div class="screen-zoom-controls">
                <button class="zoom-btn btn-zoom-out" title="Reducir zoom">-</button>
                <span class="zoom-level-text">${Math.round(currentZoom * 100)}%</span>
                <button class="zoom-btn btn-zoom-in" title="Aumentar zoom">+</button>
              </div>
              <button class="header-action-btn btn-maximize-grid" title="Maximizar / Enfocar pantalla">⛶</button>
              <button class="header-action-btn btn-del btn-del-grid" title="Eliminar pantalla">✕</button>
            </div>
          </div>
          <webview
            id="wv-${screen.id}"
            class="screen-webview"
            src="https://web.whatsapp.com"
            partition="persist:whatsapp_${screen.id}"
            useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            webpreferences="contextIsolation=no, nodeIntegration=no, backgroundThrottling=false, spellcheck=yes"
            allowpopups>
          </webview>
        `;

        // Evento renombrar desde la barra mini
        wrapper.querySelector('.screen-header-title-box')?.addEventListener('click', (e) => {
          e.stopPropagation();
          window.ModalsManager.open('rename-screen', screen);
        });

        // Botones de Zoom
        wrapper.querySelector('.btn-zoom-out')?.addEventListener('click', (e) => {
          e.stopPropagation();
          const cur = this.screenZooms[screen.id] || 1.0;
          this.setScreenZoom(screen.id, cur - 0.05);
        });

        wrapper.querySelector('.btn-zoom-in')?.addEventListener('click', (e) => {
          e.stopPropagation();
          const cur = this.screenZooms[screen.id] || 1.0;
          this.setScreenZoom(screen.id, cur + 0.05);
        });

        // Maximizar / Restaurar en modo cuadrícula
        wrapper.querySelector('.btn-maximize-grid')?.addEventListener('click', (e) => {
          e.stopPropagation();
          const btn = wrapper.querySelector('.btn-maximize-grid');
          const isMax = wrapper.classList.toggle('maximized-grid');
          if (isMax) {
            btn.innerHTML = '🗗';
            btn.title = 'Restaurar cuadrícula';
            this.setScreenZoom(screen.id, 1.0);
          } else {
            btn.innerHTML = '⛶';
            btn.title = 'Maximizar pantalla';
            this.setScreenZoom(screen.id, this.screenZooms[screen.id] || 1.0);
          }
        });

        // Evento botón eliminar en vista cuadrícula
        wrapper.querySelector('.btn-del-grid')?.addEventListener('click', (e) => {
          e.stopPropagation();
          window.ModalsManager.open('delete-screen', screen);
        });

        // Configurar audio, anti-suspensión y CSS adaptable cuando el webview esté listo
        const wv = wrapper.querySelector('webview');
        const injectAntiThrottling = () => {
          try {
            const antiThrottleJS = `
              try {
                Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
                Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
                Object.defineProperty(document, 'webkitHidden', { get: () => false, configurable: true });
                Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
                window.addEventListener('visibilitychange', (e) => {
                  if (document.hidden) e.stopImmediatePropagation();
                }, true);
              } catch (e) {}
            `;
            wv.executeJavaScript(antiThrottleJS).catch(() => {});
          } catch (e) {}
        };

        wv.addEventListener('dom-ready', () => {
          try {
            if (typeof wv.setAudioMuted === 'function') {
              wv.setAudioMuted(!window.SettingsManager.settings.audioEnabled);
            }
            // Inyectar script anti-suspensión para mantener WebSocket activo siempre
            injectAntiThrottling();

            // Inyectar CSS adaptativo para que WhatsApp Web responda a pantallas divididas
            this.injectResponsiveWhatsAppCSS(wv);

            // Aplicar factor de zoom inicial
            const initialZoom = this.screenZooms[screen.id] || 1.0;
            this.setScreenZoom(screen.id, initialZoom);
          } catch (e) {
            console.error('Error en dom-ready:', e);
          }
        });

        // Escuchar cambios de título de WhatsApp para notificar mensajes entrantes
        wv.addEventListener('page-title-updated', (event) => {
          const title = (event && event.title) || '';
          const count = this.parseUnreadCountFromTitle(title);
          this.setScreenUnread(screen.id, count);
        });

        wv.addEventListener('did-navigate', injectAntiThrottling);
        wv.addEventListener('did-navigate-in-page', injectAntiThrottling);

        container.appendChild(wrapper);
      }
    });

    // Eliminar los que ya no estén en la lista
    existingWvs.forEach((wrap) => {
      wrap.remove();
    });
  },

  selectScreen(screenId) {
    const prevId = this.activeScreenId;
    this.activeScreenId = screenId;

    // Actualizar tabs visuales
    document.querySelectorAll('.tab-item').forEach(tab => {
      tab.classList.toggle('active', tab.id === `tab-${screenId}`);
    });

    // Limpiar indicador de no leído al enfocar la pestaña
    this.setScreenUnread(screenId, 0);

    this.updateScreensVisibility();

    // Optimización suave de memoria en la pestaña que pasa a segundo plano
    if (prevId && prevId !== screenId) {
      try {
        const prevWv = document.getElementById(`wv-${prevId}`);
        if (prevWv && typeof prevWv.executeJavaScript === 'function') {
          prevWv.executeJavaScript('if (window.gc) { window.gc(); }').catch(() => {});
        }
      } catch (e) {}
    }
  },

  updateScreensVisibility() {
    const container = document.getElementById('screens-container');
    if (!container) return;

    if (this.currentViewMode === 'tabs') {
      container.querySelectorAll('.screen-wrapper').forEach(wrap => {
        wrap.classList.toggle('active', wrap.dataset.screenId === this.activeScreenId);
      });
    }
  },

  async renameScreen(screenId, newName) {
    if (!newName || !newName.trim()) return;
    const screen = this.screens.find(s => s.id === screenId);
    if (!screen) return;
    screen.name = newName.trim();
    await this.saveScreens();

    // Actualizar pestaña
    const tab = document.getElementById(`tab-${screenId}`);
    if (tab) {
      const titleSpan = tab.querySelector('.tab-title');
      if (titleSpan) {
        titleSpan.textContent = screen.name;
        titleSpan.title = screen.name;
      }
    }

    // Actualizar cabecera en cuadrícula
    const wrapper = document.getElementById(`wrapper-${screenId}`);
    if (wrapper) {
      const nameSpan = wrapper.querySelector('.screen-name-text');
      if (nameSpan) nameSpan.textContent = screen.name;
    }

    // Sincronizar con módulo de envíos masivos
    if (window.BulkSender) {
      window.BulkSender.renderLineCards();
    }
  },

  async addNewScreen(name) {
    const newId = `screen_${Date.now()}`;
    const newScreen = {
      id: newId,
      name: name || `Cuenta ${this.screens.length + 1}`,
      createdAt: Date.now()
    };

    this.screens.push(newScreen);
    this.activeScreenId = newId;

    await this.saveScreens();
    this.renderTabs();
    this.renderWebviews();
    this.updateViewModeUI();

    if (window.BulkSender) {
      window.BulkSender.renderLineCards();
    }
  },

  async deleteScreen(screenId, clearStorage = true) {
    if (this.screens.length <= 1) {
      alert('Debes mantener al menos una pantalla activa.');
      return;
    }

    const index = this.screens.findIndex(s => s.id === screenId);
    if (index === -1) return;

    this.screens.splice(index, 1);

    if (this.activeScreenId === screenId) {
      this.activeScreenId = this.screens[0]?.id || null;
    }

    if (clearStorage && window.electronAPI && window.electronAPI.deleteScreenSession) {
      await window.electronAPI.deleteScreenSession(screenId);
    }

    await this.saveScreens();
    this.renderTabs();
    this.renderWebviews();
    this.updateViewModeUI();

    if (window.BulkSender) {
      window.BulkSender.renderLineCards();
    }
  }
};

window.AppManager = AppManager;

// Inicializar al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  window.AppManager.init();
});
