/**
 * Manejador de la Interfaz de Licencias y Bloqueo
 */

const LicenseUI = {
  currentStatus: null,

  async init() {
    this.bindEvents();
    await this.refresh();

    if (window.electronAPI && window.electronAPI.onLicenseChanged) {
      window.electronAPI.onLicenseChanged((status) => {
        this.renderStatus(status);
      });
    }
  },

  bindEvents() {
    // Botón de activar en el banner de prueba
    const btnBannerActivate = document.getElementById('btn-banner-activate');
    if (btnBannerActivate) {
      btnBannerActivate.addEventListener('click', () => {
        if (window.ModalsManager) {
          window.ModalsManager.open('license');
        }
      });
    }

    // Clic en la insignia PRO / Prueba para ver información de licencia
    const appBadge = document.getElementById('app-badge');
    if (appBadge) {
      appBadge.style.cursor = 'pointer';
      appBadge.title = 'Clic para ver información de la licencia';
      appBadge.addEventListener('click', () => {
        if (window.ModalsManager) {
          window.ModalsManager.open('license');
        }
      });
    }

    // Atajos de teclado: ESC para cerrar preview, Ctrl+L o F10 para alternar preview
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const lockOverlay = document.getElementById('lock-screen-overlay');
        if (lockOverlay && lockOverlay.classList.contains('preview-mode')) {
          this.closeLockPreview();
        }
      }
      if ((e.ctrlKey && (e.key === 'l' || e.key === 'L')) || e.key === 'F10') {
        e.preventDefault();
        const lockOverlay = document.getElementById('lock-screen-overlay');
        if (lockOverlay && lockOverlay.classList.contains('active')) {
          this.closeLockPreview();
        } else {
          this.openLockPreview();
        }
      }
    });

    // Botón cerrar vista previa de bloqueo
    const btnClosePreview = document.getElementById('btn-lock-close-preview');
    if (btnClosePreview) {
      btnClosePreview.addEventListener('click', () => {
        this.closeLockPreview();
      });
    }

    // Enlace de soporte técnico en pantalla de bloqueo
    const linkLockSupport = document.getElementById('link-lock-support');
    if (linkLockSupport) {
      linkLockSupport.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.electronAPI && window.electronAPI.openExternal) {
          window.electronAPI.openExternal('mailto:soporte@kovaz.fyi');
        }
      });
    }

    // Botón comprar en pantalla de bloqueo
    const btnLockBuy = document.getElementById('btn-lock-buy');
    if (btnLockBuy) {
      btnLockBuy.addEventListener('click', () => {
        if (window.electronAPI && window.electronAPI.openStore) {
          window.electronAPI.openStore();
        }
      });
    }

    // Botón copiar Hardware ID en bloqueo
    const btnLockCopyHwid = document.getElementById('btn-lock-copy-hwid');
    if (btnLockCopyHwid) {
      btnLockCopyHwid.addEventListener('click', () => {
        if (this.currentStatus && this.currentStatus.machineId) {
          navigator.clipboard.writeText(this.currentStatus.machineId);
          btnLockCopyHwid.textContent = '¡Copiado!';
          setTimeout(() => { btnLockCopyHwid.textContent = 'Copiar ID'; }, 2000);
        }
      });
    }

    // Botón desbloquear en pantalla de bloqueo
    const btnLockUnlock = document.getElementById('btn-lock-unlock');
    const inputLockKey = document.getElementById('lock-input-key');
    const lockAlert = document.getElementById('lock-alert-msg');

    if (btnLockUnlock && inputLockKey) {
      btnLockUnlock.addEventListener('click', async () => {
        const key = inputLockKey.value.trim();
        if (!key) {
          this.showAlert(lockAlert, 'Por favor, introduce tu clave de activación.', 'error');
          return;
        }

        btnLockUnlock.disabled = true;
        btnLockUnlock.textContent = 'Verificando...';

        try {
          const res = await window.electronAPI.activateLicense(key);
          if (res.success) {
            this.showAlert(lockAlert, '¡Licencia activada con éxito! Desbloqueando...', 'success');
            setTimeout(() => {
              this.closeLockPreview();
              this.renderStatus(res.status);
            }, 1200);
          } else {
            this.showAlert(lockAlert, `Error: ${res.reason || 'Clave inválida'}`, 'error');
          }
        } catch (err) {
          this.showAlert(lockAlert, 'Error comunicando con el sistema de activación.', 'error');
        } finally {
          btnLockUnlock.disabled = false;
          btnLockUnlock.textContent = '🔓 Validar y Desbloquear Aplicación';
        }
      });

      // Enter key trigger
      inputLockKey.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          btnLockUnlock.click();
        }
      });
    }
  },

  openLockPreview() {
    const lockOverlay = document.getElementById('lock-screen-overlay');
    if (lockOverlay) {
      lockOverlay.classList.add('active', 'preview-mode');
      const lockHwid = document.getElementById('lock-hwid-text');
      if (lockHwid && this.currentStatus && this.currentStatus.machineId) {
        lockHwid.textContent = this.currentStatus.machineId;
      }
    }
  },

  closeLockPreview() {
    const lockOverlay = document.getElementById('lock-screen-overlay');
    if (lockOverlay) {
      if (!this.currentStatus || !this.currentStatus.isLocked) {
        lockOverlay.classList.remove('active');
      }
      lockOverlay.classList.remove('preview-mode');
    }
  },

  showAlert(elem, msg, type) {
    if (!elem) return;
    elem.textContent = msg;
    elem.className = `alert-message ${type}`;
  },

  async refresh() {
    if (window.electronAPI && window.electronAPI.getLicenseStatus) {
      try {
        const status = await window.electronAPI.getLicenseStatus();
        this.renderStatus(status);
      } catch (e) {
        console.error('Error obteniendo estado de licencia:', e);
      }
    }
  },

  renderStatus(status) {
    this.currentStatus = status;

    const banner = document.getElementById('trial-banner');
    const daysCount = document.getElementById('trial-days-count');
    const badge = document.getElementById('app-badge');
    const lockOverlay = document.getElementById('lock-screen-overlay');
    const lockHwid = document.getElementById('lock-hwid-text');

    if (lockHwid && status.machineId) {
      lockHwid.textContent = status.machineId;
    }

    if (status.isLocked) {
      // Bloquear aplicación real
      if (lockOverlay) {
        lockOverlay.classList.remove('preview-mode');
        lockOverlay.classList.add('active');
      }
      if (banner) banner.classList.add('hidden');
      if (badge) {
        badge.textContent = 'Bloqueado';
        badge.className = 'app-brand-badge';
        badge.style.backgroundColor = 'rgba(234, 67, 53, 0.2)';
        badge.style.color = '#ea4335';
      }
      return;
    }

    // Si no está bloqueado y no estamos en modo preview, ocultar bloqueo
    if (lockOverlay && !lockOverlay.classList.contains('preview-mode')) {
      lockOverlay.classList.remove('active');
    }

    if (status.state === 'ACTIVATED') {
      if (lockOverlay) {
        lockOverlay.classList.remove('active', 'preview-mode');
      }
      if (banner) banner.classList.add('hidden');
      if (badge) {
        badge.textContent = status.isLifetime ? 'PRO (Vitalicia)' : 'PRO';
        badge.className = 'app-brand-badge badge-pro';
        badge.style.backgroundColor = '';
        badge.style.color = '';
      }
    } else if (status.state === 'TRIAL_ACTIVE') {
      if (banner) banner.classList.remove('hidden');
      if (daysCount) daysCount.textContent = status.daysRemaining;
      if (badge) {
        badge.textContent = `Prueba (${status.daysRemaining}d)`;
        badge.className = 'app-brand-badge badge-trial';
        badge.style.backgroundColor = '';
        badge.style.color = '';
      }
    }
  }
};

window.LicenseUI = LicenseUI;

