/**
 * Manejador del Menú de Hamburguesa y Ventanas Modales
 */

const ModalsManager = {
  overlay: null,
  titleElem: null,
  bodyElem: null,
  footerElem: null,
  drawerBackdrop: null,

  init() {
    this.overlay = document.getElementById('modal-overlay');
    this.titleElem = document.getElementById('modal-title');
    this.bodyElem = document.getElementById('modal-body');
    this.footerElem = document.getElementById('modal-footer');
    this.drawerBackdrop = document.getElementById('drawer-backdrop');

    this.bindDrawer();
    this.bindModalClose();
  },

  bindDrawer() {
    const btnHamburger = document.getElementById('btn-hamburger');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const linkDrawerKovaz = document.getElementById('link-drawer-kovaz');

    if (btnHamburger) {
      btnHamburger.addEventListener('click', () => this.openDrawer());
    }

    if (btnCloseDrawer) {
      btnCloseDrawer.addEventListener('click', () => this.closeDrawer());
    }

    if (this.drawerBackdrop) {
      this.drawerBackdrop.addEventListener('click', (e) => {
        if (e.target === this.drawerBackdrop) {
          this.closeDrawer();
        }
      });
    }

    if (linkDrawerKovaz) {
      linkDrawerKovaz.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.openExternal) {
          window.electronAPI.openExternal('https://kovaz.fyi');
        }
      });
    }

    // Navegación de Secciones Principales desde el Menú
    document.getElementById('menu-item-multi')?.addEventListener('click', () => {
      this.closeDrawer();
      if (window.AppManager) window.AppManager.switchSection('multi');
    });

    document.getElementById('menu-item-bulk')?.addEventListener('click', () => {
      this.closeDrawer();
      if (window.AppManager) window.AppManager.switchSection('bulk');
    });

    document.getElementById('menu-item-about')?.addEventListener('click', () => {
      this.closeDrawer();
      this.open('about');
    });

    document.getElementById('menu-item-license')?.addEventListener('click', () => {
      this.closeDrawer();
      this.open('license');
    });

    document.getElementById('menu-item-settings')?.addEventListener('click', () => {
      this.closeDrawer();
      this.open('settings');
    });

    document.getElementById('menu-item-version')?.addEventListener('click', () => {
      this.closeDrawer();
      this.open('version');
    });
  },

  openDrawer() {
    if (this.drawerBackdrop) {
      this.drawerBackdrop.classList.add('open');
    }
  },

  closeDrawer() {
    if (this.drawerBackdrop) {
      this.drawerBackdrop.classList.remove('open');
    }
  },

  bindModalClose() {
    const btnClose = document.getElementById('btn-modal-close');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }

    if (this.overlay) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.close();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.close();
        this.closeDrawer();
      }
    });
  },

  close() {
    if (this.overlay) {
      this.overlay.classList.remove('active');
      this.overlay.querySelector('.modal-card')?.classList.remove('modal-large');
    }
  },

  /**
   * Abre un modal por su tipo ('about', 'license', 'settings', 'version', 'add-screen', 'delete-screen')
   */
  open(type, data = null) {
    if (!this.overlay || !this.titleElem || !this.bodyElem || !this.footerElem) return;

    this.footerElem.innerHTML = '';

    switch (type) {
      case 'about':
        this.renderAbout();
        break;
      case 'license':
        this.renderLicense();
        break;
      case 'settings':
        this.renderSettings();
        break;
      case 'version':
        this.renderVersion();
        break;
      case 'update-available':
        this.renderUpdateAvailable(data);
        break;
      case 'add-screen':
        this.renderAddScreen();
        break;
      case 'rename-screen':
        this.renderRenameScreen(data);
        break;
      case 'delete-screen':
        this.renderDeleteScreen(data);
        break;
      default:
        return;
    }

    this.overlay.classList.add('active');
  },

  /* =========================================================================
     MODAL: QUIÉNES SOMOS
     ========================================================================= */
  renderAbout() {
    this.titleElem.innerHTML = '<span>👥</span> Quiénes Somos';
    this.bodyElem.innerHTML = `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 40px; margin-bottom: 10px;">💬⚡</div>
        <h4 style="font-size: 18px; margin-bottom: 6px;">Kcomunitywhats by Kovaz</h4>
        <p style="color: var(--text-secondary); font-size: var(--font-sm);">
          Plataforma avanzada de control y gestión simultánea de múltiples cuentas de WhatsApp en entorno de escritorio.
        </p>
      </div>

      <div style="background-color: var(--bg-primary); padding: 16px; border-radius: 8px; margin-bottom: 16px; border: 1px solid var(--border-color);">
        <h5 style="margin-bottom: 8px; color: var(--accent-color);">Nuestra Misión</h5>
        <p style="font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.6;">
          Ofrecer herramientas profesionales de alto rendimiento para equipos de ventas, atención al cliente y soporte comunitario, garantizando aislamiento total de sesiones y máxima privacidad sin depender de pestañas de navegador.
        </p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: var(--font-sm);">
          <strong>Sitio Web Oficial:</strong>
          <a href="#" id="link-kovaz-site" style="color: var(--accent-color); text-decoration: none; margin-left: 6px;">https://kovaz.fyi</a>
        </div>
        <div style="font-size: var(--font-sm); color: var(--text-secondary);">
          <strong>Soporte Técnico:</strong> soporte@kovaz.fyi
        </div>
      </div>
    `;

    document.getElementById('link-kovaz-site')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.electronAPI?.openExternal('https://kovaz.fyi');
    });

    this.footerElem.innerHTML = `
      <button class="btn btn-secondary" onclick="ModalsManager.close()">Cerrar</button>
    `;
  },

  /* =========================================================================
     MODAL: INFORMACIÓN DEL PROGRAMA Y LICENCIA
     ========================================================================= */
  async renderLicense() {
    this.titleElem.innerHTML = '<span>🔑</span> Información del Programa y Licencia';
    const status = window.LicenseUI ? window.LicenseUI.currentStatus : null;

    const hwid = status?.machineId || 'Obteniendo...';
    let statusBadge = '<span style="color: #f39c12; font-weight: 600;">Período de Prueba</span>';

    if (status?.state === 'ACTIVATED') {
      const expText = status.isLifetime ? 'Vitalicia' : `Vence: ${new Date(status.expiryDate).toLocaleDateString()}`;
      statusBadge = `<span style="color: #00a884; font-weight: 600;">Activa (${expText})</span>`;
    } else if (status?.state === 'TRIAL_ACTIVE') {
      statusBadge = `<span style="color: #f39c12; font-weight: 600;">Período de Prueba (${status.daysRemaining} días restantes)</span>`;
    } else if (status?.isLocked) {
      statusBadge = '<span style="color: #ea4335; font-weight: 600;">Bloqueada / Expirada</span>';
    }

    let clientCardHtml = '';
    if (status?.state === 'ACTIVATED' && (status.clientName || status.clientEmail)) {
      clientCardHtml = `
        <div style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 16px;">
          <div style="font-weight: 600; font-size: 13px; color: var(--accent-color); margin-bottom: 8px;">👤 Datos del Titular (Hub KoVaz)</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: var(--font-xs);">
            <div><span style="color: var(--text-secondary);">Cliente:</span> <strong>${status.clientName || 'N/A'}</strong></div>
            <div><span style="color: var(--text-secondary);">Email:</span> <strong>${status.clientEmail || 'N/A'}</strong></div>
            ${status.phone ? `<div><span style="color: var(--text-secondary);">WhatsApp:</span> <strong>${status.phone}</strong></div>` : ''}
            <div><span style="color: var(--text-secondary);">Plan:</span> <strong>${status.plan || 'PRO'}</strong></div>
            ${status.modules && status.modules.length ? `<div style="grid-column: span 2;"><span style="color: var(--text-secondary);">Módulos:</span> <strong>${status.modules.join(', ')}</strong></div>` : ''}
          </div>
        </div>
      `;
    }

    this.bodyElem.innerHTML = `
      <div style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
          <span style="color: var(--text-secondary);">Software:</span>
          <strong>Kcomunitywhats Desktop</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
          <span style="color: var(--text-secondary);">Versión:</span>
          <strong>v1.0.0</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
          <span style="color: var(--text-secondary);">Estado de Licencia:</span>
          ${statusBadge}
        </div>
      </div>

      ${clientCardHtml}

      <div class="form-group">
        <label class="form-label">ID de Equipo (Hardware ID):</label>
        <div class="hwid-box">
          <span id="modal-hwid-text" class="hwid-value">${hwid}</span>
          <button id="btn-modal-copy-hwid" class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;">Copiar ID</button>
        </div>
        <small style="color: var(--text-muted); font-size: var(--font-xs);">
          Proporciona este ID al administrador para generar una clave vinculada a este equipo.
        </small>
      </div>

      <div class="form-group" style="margin-top: 16px;">
        <label class="form-label" for="modal-input-license">Ingresar Clave de Licencia:</label>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="modal-input-license" class="form-input code-input" placeholder="Pega aquí tu clave: KS-... o KCW-..." value="${status?.licenseKey || ''}">
          <button id="btn-modal-activate" class="btn btn-primary" style="white-space: nowrap;">Activar</button>
        </div>
        <div id="modal-license-msg" class="alert-message"></div>
      </div>
    `;

    document.getElementById('btn-modal-copy-hwid')?.addEventListener('click', () => {
      navigator.clipboard.writeText(hwid);
      const btn = document.getElementById('btn-modal-copy-hwid');
      if (btn) {
        btn.textContent = '¡Copiado!';
        setTimeout(() => { btn.textContent = 'Copiar ID'; }, 2000);
      }
    });

    document.getElementById('btn-modal-activate')?.addEventListener('click', async () => {
      const input = document.getElementById('modal-input-license');
      const msgBox = document.getElementById('modal-license-msg');
      const btn = document.getElementById('btn-modal-activate');
      const key = input.value.trim();

      if (!key) {
        window.LicenseUI.showAlert(msgBox, 'Por favor, ingresa una clave de licencia.', 'error');
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Verificando...';
      }

      try {
        const res = await window.electronAPI.activateLicense(key);
        if (res.success) {
          window.LicenseUI.currentStatus = res.status;
          window.LicenseUI.renderStatus(res.status);
          window.LicenseUI.showAlert(msgBox, '¡Licencia activada y actualizada exitosamente!', 'success');
          setTimeout(() => {
            this.renderLicense();
          }, 500);
        } else {
          window.LicenseUI.showAlert(msgBox, `Error: ${res.reason || 'Clave inválida'}`, 'error');
        }
      } catch (err) {
        window.LicenseUI.showAlert(msgBox, 'Error al validar la clave de licencia.', 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Activar';
        }
      }
    });

    this.footerElem.innerHTML = `
      <button class="btn btn-secondary" onclick="ModalsManager.close()">Cerrar</button>
    `;
  },

  /* =========================================================================
     MODAL: AJUSTES (Configuraciones Básicas)
     ========================================================================= */
  renderSettings() {
    this.titleElem.innerHTML = '<span>⚙️</span> Ajustes del Sistema';
    const s = window.SettingsManager.settings;

    this.bodyElem.innerHTML = `
      <!-- Tema -->
      <div class="form-group">
        <label class="form-label">Tema Visual:</label>
        <div class="options-grid">
          <div class="option-card ${s.theme === 'dark' ? 'selected' : ''}" id="opt-theme-dark">
            🌙 Oscuro
          </div>
          <div class="option-card ${s.theme === 'light' ? 'selected' : ''}" id="opt-theme-light">
            ☀️ Claro
          </div>
        </div>
      </div>

      <!-- Tamaño de Fuentes -->
      <div class="form-group" style="margin-top: 20px;">
        <label class="form-label">Tamaño de Fuente:</label>
        <div class="options-grid">
          <div class="option-card ${s.fontSize === 'small' ? 'selected' : ''}" id="opt-font-small">
            Pequeña (13px)
          </div>
          <div class="option-card ${s.fontSize === 'normal' ? 'selected' : ''}" id="opt-font-normal">
            Normal (15px)
          </div>
          <div class="option-card ${s.fontSize === 'large' ? 'selected' : ''}" id="opt-font-large">
            Grande (17px)
          </div>
        </div>
      </div>

      <!-- Notificaciones -->
      <div class="switch-control" style="margin-top: 16px;">
        <div class="switch-info">
          <span class="switch-title">Notificaciones de Escritorio</span>
          <span class="switch-desc">Recibir alertas de mensajes nuevos de WhatsApp</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="switch-notifs" ${s.notifications ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>

      <!-- Audio -->
      <div class="switch-control">
        <div class="switch-info">
          <span class="switch-title">Audios y Sonidos</span>
          <span class="switch-desc">Reproducir avisos sonoros y audios recibidos</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="switch-audio" ${s.audioEnabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>

      <!-- Rendimiento y Memoria RAM -->
      <div class="form-group" style="margin-top: 20px; border-top: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding-top: 16px;">
        <label class="form-label" style="display: flex; align-items: center; gap: 6px;">
          <span>⚡</span> Rendimiento y Memoria RAM:
        </label>
        <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius: 8px; padding: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
          <div>
            <div id="ram-usage-text" style="font-weight: 600; font-size: 13px; color: var(--text-color, #eee);">
              Calculando consumo de RAM...
            </div>
            <div style="font-size: 11px; color: var(--text-secondary, #888); margin-top: 3px;">
              Optimización automática programada cada 12 min
            </div>
          </div>
          <button id="btn-clean-ram" class="btn" style="background: #25d366; color: #fff; font-size: 12px; font-weight: 600; padding: 8px 14px; border-radius: 6px; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: opacity 0.2s;">
            <span>🧹</span> Liberar Memoria
          </button>
        </div>
      </div>
    `;

    // Handlers para temas
    document.getElementById('opt-theme-dark')?.addEventListener('click', () => {
      window.SettingsManager.save({ theme: 'dark' });
      this.renderSettings();
    });
    document.getElementById('opt-theme-light')?.addEventListener('click', () => {
      window.SettingsManager.save({ theme: 'light' });
      this.renderSettings();
    });

    // Handlers para fuentes
    document.getElementById('opt-font-small')?.addEventListener('click', () => {
      window.SettingsManager.save({ fontSize: 'small' });
      this.renderSettings();
    });
    document.getElementById('opt-font-normal')?.addEventListener('click', () => {
      window.SettingsManager.save({ fontSize: 'normal' });
      this.renderSettings();
    });
    document.getElementById('opt-font-large')?.addEventListener('click', () => {
      window.SettingsManager.save({ fontSize: 'large' });
      this.renderSettings();
    });

    // Switches
    document.getElementById('switch-notifs')?.addEventListener('change', (e) => {
      window.SettingsManager.save({ notifications: e.target.checked });
    });
    document.getElementById('switch-audio')?.addEventListener('change', (e) => {
      window.SettingsManager.save({ audioEnabled: e.target.checked });
    });

    // Monitoreo y Limpieza de RAM
    const updateRamLabel = async () => {
      if (window.electronAPI && window.electronAPI.getMemoryUsage) {
        try {
          const stats = await window.electronAPI.getMemoryUsage();
          const ramLabel = document.getElementById('ram-usage-text');
          if (ramLabel) {
            ramLabel.innerHTML = `Consumo actual: <strong style="color: #25d366;">${stats.totalMB} MB</strong> <span style="font-size: 11px; opacity: 0.8;">(${stats.processCount} procesos activos)</span>`;
          }
        } catch (err) {
          console.error('Error al obtener uso de memoria:', err);
        }
      }
    };
    updateRamLabel();

    const btnCleanRam = document.getElementById('btn-clean-ram');
    if (btnCleanRam) {
      btnCleanRam.addEventListener('click', async () => {
        btnCleanRam.disabled = true;
        btnCleanRam.style.opacity = '0.6';
        btnCleanRam.innerHTML = '<span>⏳</span> Optimizando...';
        try {
          if (window.electronAPI && window.electronAPI.cleanMemory) {
            const result = await window.electronAPI.cleanMemory();
            const ramLabel = document.getElementById('ram-usage-text');
            if (ramLabel) {
              ramLabel.innerHTML = `✅ Liberados <strong style="color: #25d366;">${result.freedMB} MB</strong> (Actual: ${result.afterMB} MB)`;
            }
          }
        } catch (err) {
          console.error('Error al limpiar memoria:', err);
        } finally {
          btnCleanRam.disabled = false;
          btnCleanRam.style.opacity = '1';
          btnCleanRam.innerHTML = '<span>🧹</span> Liberar Memoria';
        }
      });
    }

    this.footerElem.innerHTML = `
      <button class="btn btn-primary" onclick="ModalsManager.close()">Listo</button>
    `;
  },

  /* =========================================================================
     MODAL: VERSIÓN Y GESTIÓN DE ACTUALIZACIONES
     ========================================================================= */
  renderVersion() {
    this.titleElem.innerHTML = '<span>ℹ️</span> Acerca de la Versión y Actualizaciones';
    this.bodyElem.innerHTML = `
      <div style="text-align: center; padding: 10px 0 16px 0;">
        <h4 style="font-size: 20px; font-weight: 700; margin-bottom: 4px;">Kcomunitywhats Desktop</h4>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 12px;">
          <span id="version-current-badge" style="background: rgba(37, 211, 102, 0.15); color: #25d366; font-weight: 700; font-size: 13px; padding: 3px 10px; border-radius: 20px; border: 1px solid rgba(37, 211, 102, 0.3);">
            Versión 1.0.0
          </span>
          <span style="color: var(--text-muted); font-size: 12px;">(Build 2026.09)</span>
        </div>

        <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-color, rgba(255,255,255,0.1)); border-radius: 8px; padding: 12px; margin-bottom: 14px; text-align: left;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
            <div>
              <div id="update-status-title" style="font-weight: 600; font-size: 13px; color: var(--text-color, #eee);">
                Control de Versiones
              </div>
              <div id="update-status-subtitle" style="font-size: 11px; color: var(--text-secondary, #888); margin-top: 2px;">
                Canal oficial: GitHub (kenjicorimanya/kcomunityWhats)
              </div>
            </div>
            <button id="btn-check-updates" class="btn" style="background: #00a884; color: #fff; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap;">
              <span>🔍</span> Buscar Actualizaciones
            </button>
          </div>
          <div id="update-check-result" style="margin-top: 8px; font-size: 12px; display: none;"></div>
        </div>
      </div>

      <div style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; font-size: var(--font-sm); line-height: 1.6; margin-bottom: 16px;">
        <strong>Novedades de la versión instalada:</strong>
        <ul style="margin-left: 20px; margin-top: 8px; color: var(--text-secondary);">
          <li>Optimización radical de memoria RAM (-74% de consumo de recursos).</li>
          <li>Soporte para múltiples pantallas con sesiones 100% aisladas e independientes.</li>
          <li>Módulo de envíos masivos optimizado con imágenes y textos fieles.</li>
          <li>Alternancia instantánea entre pestañas y mosaico de ventanas.</li>
          <li>Sistema de actualización automática conectado a GitHub Releases.</li>
        </ul>
      </div>

      <p style="font-size: var(--font-xs); color: var(--text-muted); text-align: center;">
        Desarrollado con ❤️ para comunidades y empresas por <a href="#" id="link-ver-kovaz" style="color: var(--accent-color); text-decoration: none;">Kovaz (kovaz.fyi)</a>
      </p>
    `;

    // Cargar versión dinámica
    if (window.electronAPI && window.electronAPI.getAppVersion) {
      window.electronAPI.getAppVersion().then(ver => {
        const badge = document.getElementById('version-current-badge');
        if (badge && ver) badge.textContent = `Versión ${ver}`;
      }).catch(() => {});
    }

    // Botón de búsqueda de actualización
    const btnCheck = document.getElementById('btn-check-updates');
    const resultBox = document.getElementById('update-check-result');

    btnCheck?.addEventListener('click', async () => {
      btnCheck.disabled = true;
      btnCheck.textContent = 'Buscando...';
      if (resultBox) {
        resultBox.style.display = 'block';
        resultBox.style.color = 'var(--text-secondary)';
        resultBox.innerHTML = '⏳ Conectando con GitHub Releases para verificar versiones...';
      }

      try {
        if (window.electronAPI && window.electronAPI.checkUpdates) {
          const res = await window.electronAPI.checkUpdates();
          if (res.success) {
            if (res.hasUpdate) {
              resultBox.style.color = '#25d366';
              resultBox.innerHTML = `🚀 <strong>¡Nueva versión ${res.latestVersion} disponible!</strong> <a href="#" id="link-open-update-modal" style="color: #25d366; text-decoration: underline; margin-left: 6px; cursor: pointer;">Ver detalles y descargar</a>`;
              document.getElementById('link-open-update-modal')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.open('update-available', res);
              });
            } else {
              resultBox.style.color = '#25d366';
              resultBox.innerHTML = `✅ <strong>Tienes la última versión instalada (${res.currentVersion}).</strong> Todo está al día.`;
            }
          } else {
            resultBox.style.color = '#e74c3c';
            resultBox.innerHTML = `⚠️ No se pudo verificar: ${res.error || 'Error de conexión'}`;
          }
        }
      } catch (err) {
        if (resultBox) {
          resultBox.style.color = '#e74c3c';
          resultBox.innerHTML = `⚠️ Error al verificar actualización: ${err.message}`;
        }
      } finally {
        btnCheck.disabled = false;
        btnCheck.innerHTML = '<span>🔍</span> Buscar Actualizaciones';
      }
    });

    document.getElementById('link-ver-kovaz')?.addEventListener('click', (e) => {
      e.preventDefault();
      window.electronAPI?.openExternal('https://kovaz.fyi');
    });

    this.footerElem.innerHTML = `
      <button class="btn btn-secondary" onclick="ModalsManager.close()">Cerrar</button>
    `;
  },

  /* =========================================================================
     MODAL: NUEVA ACTUALIZACIÓN DISPONIBLE
     ========================================================================= */
  renderUpdateAvailable(updateData) {
    const info = updateData?.releaseInfo || {};
    const latest = updateData?.latestVersion || info.version || 'Nueva';
    const current = updateData?.currentVersion || '1.0.0';
    const isMandatory = info.mandatory === true;
    const downloadUrl = info.downloadUrl || 'https://kovaz.fyi';
    const changelog = Array.isArray(info.changelog) ? info.changelog : (info.notes ? [info.notes] : ['Mejoras de rendimiento y estabilidad.']);

    this.titleElem.innerHTML = '<span>🚀</span> ¡Actualización Disponible!';
    this.bodyElem.innerHTML = `
      <div style="text-align: center; padding: 10px 0 16px 0;">
        <div style="font-size: 38px; margin-bottom: 8px;">🎉</div>
        <h4 style="font-size: 20px; font-weight: 700; margin-bottom: 6px;">
          ${info.title || `Nueva versión ${latest} lista para descargar`}
        </h4>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; margin-bottom: 12px;">
          <span style="background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 6px; color: var(--text-secondary);">
            Instalada: <strong>v${current}</strong>
          </span>
          <span>➔</span>
          <span style="background: rgba(37, 211, 102, 0.15); color: #25d366; padding: 4px 10px; border-radius: 6px; font-weight: 700; border: 1px solid rgba(37, 211, 102, 0.3);">
            Disponible: <strong>v${latest}</strong>
          </span>
        </div>
        ${isMandatory ? `
          <div style="background: rgba(231, 76, 60, 0.15); border: 1px solid rgba(231, 76, 60, 0.3); color: #ff6b6b; padding: 8px 12px; border-radius: 6px; font-size: 12px; margin-bottom: 12px;">
            ⚠️ <strong>Actualización Obligatoria:</strong> Esta actualización contiene cambios esenciales para garantizar el funcionamiento.
          </div>
        ` : ''}
      </div>

      <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
        <strong style="font-size: 13px; color: var(--text-color);">Novedades y Mejoras:</strong>
        <ul style="margin-left: 20px; margin-top: 8px; color: var(--text-secondary); font-size: 13px; line-height: 1.6;">
          ${changelog.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>

      <p style="font-size: 12px; color: var(--text-muted); text-align: center;">
        Al hacer clic en descargar, se descargará el instalador oficial desde GitHub.
      </p>
    `;

    const btnDownload = document.createElement('button');
    btnDownload.className = 'btn btn-primary';
    btnDownload.style.background = '#25d366';
    btnDownload.style.fontWeight = '700';
    btnDownload.innerHTML = '<span>🚀</span> Descargar Actualización';
    btnDownload.onclick = () => {
      window.electronAPI?.openExternal(downloadUrl);
      if (!isMandatory) {
        ModalsManager.close();
      }
    };

    this.footerElem.innerHTML = '';
    if (!isMandatory) {
      const btnLater = document.createElement('button');
      btnLater.className = 'btn btn-secondary';
      btnLater.textContent = 'Recordar más tarde';
      btnLater.onclick = () => ModalsManager.close();
      this.footerElem.appendChild(btnLater);
    }
    this.footerElem.appendChild(btnDownload);
  },

  /* =========================================================================
     MODAL: AGREGAR PANTALLA
     ========================================================================= */
  renderAddScreen() {
    this.titleElem.innerHTML = '<span>+</span> Agregar Nueva Pantalla de WhatsApp';
    this.bodyElem.innerHTML = `
      <p style="font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: 16px;">
        Se creará un nuevo contenedor de sesión aislado. Podrás vincular una cuenta independiente escaneando su código QR.
      </p>
      <div class="form-group">
        <label class="form-label" for="new-screen-name">Nombre de la Cuenta o Pantalla:</label>
        <input type="text" id="new-screen-name" class="form-input" placeholder="Ej: Ventas, Soporte #2, Personal..." autocomplete="off">
      </div>
    `;

    this.footerElem.innerHTML = `
      <button class="btn btn-secondary" onclick="ModalsManager.close()">Cancelar</button>
      <button class="btn btn-primary" id="btn-confirm-add-screen">Crear Pantalla</button>
    `;

    const inputName = document.getElementById('new-screen-name');
    setTimeout(() => inputName?.focus(), 100);

    const onConfirm = () => {
      const name = inputName.value.trim() || `WhatsApp ${window.AppManager.screens.length + 1}`;
      window.AppManager.addNewScreen(name);
      this.close();
    };

    document.getElementById('btn-confirm-add-screen')?.addEventListener('click', onConfirm);
    inputName?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') onConfirm();
    });
  },

  /* =========================================================================
     MODAL: RENOMBRAR PANTALLA
     ========================================================================= */
  renderRenameScreen(screen) {
    if (!screen) return;
    this.titleElem.innerHTML = '<span>✏️</span> Renombrar Pantalla';
    this.bodyElem.innerHTML = `
      <p style="font-size: var(--font-sm); color: var(--text-secondary); margin-bottom: 16px;">
        Ingresa un nuevo nombre descriptivo para esta cuenta de WhatsApp (ej: Ventas, Soporte, Personal, etc.).
      </p>
      <div class="form-group">
        <label class="form-label" for="rename-screen-input">Nombre de la Pantalla / Cuenta:</label>
        <input type="text" id="rename-screen-input" class="form-input" value="${screen.name || ''}" placeholder="Ej: Ventas, Soporte #2..." autocomplete="off">
      </div>
    `;

    this.footerElem.innerHTML = `
      <button class="btn btn-secondary" onclick="ModalsManager.close()">Cancelar</button>
      <button class="btn btn-primary" id="btn-confirm-rename-screen">Guardar Nombre</button>
    `;

    const inputName = document.getElementById('rename-screen-input');
    setTimeout(() => {
      inputName?.focus();
      inputName?.select();
    }, 100);

    const onConfirm = async () => {
      const newName = inputName.value.trim();
      if (!newName) {
        inputName.focus();
        return;
      }
      if (window.AppManager && window.AppManager.renameScreen) {
        await window.AppManager.renameScreen(screen.id, newName);
      }
      this.close();
    };

    document.getElementById('btn-confirm-rename-screen')?.addEventListener('click', onConfirm);
    inputName?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') onConfirm();
    });
  },

  /* =========================================================================
     MODAL: CONFIRMAR ELIMINACIÓN DE PANTALLA
     ========================================================================= */
  renderDeleteScreen(screen) {
    if (!screen) return;
    this.titleElem.innerHTML = '<span>🗑️</span> Eliminar Pantalla';
    this.bodyElem.innerHTML = `
      <p style="margin-bottom: 14px;">
        ¿Estás seguro de que deseas eliminar la pantalla <strong>"${screen.name}"</strong>?
      </p>

      <div style="background-color: var(--bg-primary); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color); margin-bottom: 16px;">
        <label style="display: flex; align-items: center; gap: 8px; font-size: var(--font-sm); cursor: pointer;">
          <input type="checkbox" id="check-delete-storage" checked>
          <span>Cerrar sesión y borrar datos guardados en disco</span>
        </label>
      </div>
    `;

    this.footerElem.innerHTML = `
      <button class="btn btn-secondary" onclick="ModalsManager.close()">Cancelar</button>
      <button class="btn btn-danger" id="btn-confirm-delete">Eliminar Pantalla</button>
    `;

    document.getElementById('btn-confirm-delete')?.addEventListener('click', () => {
      const clearStorage = document.getElementById('check-delete-storage')?.checked ?? true;
      window.AppManager.deleteScreen(screen.id, clearStorage);
      this.close();
    });
  }
};

window.ModalsManager = ModalsManager;

