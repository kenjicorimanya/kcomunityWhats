/**
 * Módulo de Envío Masivo Anti-Baneo y Gestión Multi-Línea
 * Kcomunitywhats - Con Prefijo Internacional, Importador, Verificador y Conteo Final
 */

const BulkSender = {
  selectedLineId: null,
  campaigns: {},
  checkInterval: null,

  // Lista de prefijos telefónicos internacionales
  countryPrefixes: [
    { code: '51', name: 'PE +51 Perú', default: true },
    { code: '34', name: 'ES +34 España' },
    { code: '52', name: 'MX +52 México' },
    { code: '54', name: 'AR +54 Argentina' },
    { code: '57', name: 'CO +57 Colombia' },
    { code: '56', name: 'CL +56 Chile' },
    { code: '593', name: 'EC +593 Ecuador' },
    { code: '591', name: 'BO +591 Bolivia' },
    { code: '1', name: 'US +1 Estados Unidos' },
    { code: 'NONE', name: 'Otro (Sin prefijo / Ya incluido)' }
  ],

  init() {
    this.startOnlineChecker();
  },

  // Obtener o inicializar campaña para una línea
  getCampaign(screenId) {
    if (!this.campaigns[screenId]) {
      this.campaigns[screenId] = {
        screenId,
        inputMode: 'paste', // 'paste' | 'file'
        selectedPrefix: '51',
        rawNumbers: '',
        contacts: [], // [{ phone: '51906953567', status: 'pending'|'valid'|'invalid'|'sent'|'error' }]
        messageText: '',
        image: null,
        minDelay: 4,
        maxDelay: 8,
        enableBatch: true,
        status: 'idle', // 'idle' | 'verifying' | 'running' | 'paused' | 'done'
        currentIndex: 0,
        stats: {
          total: 0,
          sent: 0,
          invalid: 0,
          errors: 0
        },
        logs: [],
        isOnline: false
      };
    }
    return this.campaigns[screenId];
  },

  // Aplicar prefijo internacional inteligente a un número
  applyPrefix(rawNum, prefixCode) {
    let clean = rawNum.replace(/[^0-9]/g, '');
    if (!clean || clean.length < 6) return '';
    if (!prefixCode || prefixCode === 'NONE') return clean;

    // Si el número ya comienza con el prefijo y tiene longitud completa, no duplicar
    if (clean.startsWith(prefixCode) && clean.length > prefixCode.length + 6) {
      return clean;
    }
    return prefixCode + clean;
  },

  // Procesar texto y convertir a lista estructurada de contactos
  processRawNumbers(rawText, prefixCode) {
    if (!rawText) return [];
    const items = rawText.split(/[\n,;]+/);
    const validList = [];
    const seen = new Set();

    for (let item of items) {
      const formatted = this.applyPrefix(item, prefixCode);
      if (formatted && formatted.length >= 8 && !seen.has(formatted)) {
        seen.add(formatted);
        validList.push({
          phone: formatted,
          status: 'pending'
        });
      }
    }
    return validList;
  },

  // Resolver Spintax: {Hola|Buenos días|Qué tal}
  resolveSpintax(text) {
    if (!text) return '';
    const regex = /\{([^{}]+)\}/g;
    let result = text;
    while (regex.test(result)) {
      result = result.replace(regex, (match, choices) => {
        const parts = choices.split('|');
        return parts[Math.floor(Math.random() * parts.length)].trim();
      });
    }
    return result;
  },

  getRandomDelay(minSec, maxSec) {
    const min = Math.max(2, parseInt(minSec, 10) || 4);
    const max = Math.max(min, parseInt(maxSec, 10) || 8);
    const sec = Math.floor(Math.random() * (max - min + 1)) + min;
    return sec * 1000;
  },

  getWebview(screenId) {
    return document.getElementById(`wv-${screenId}`);
  },

  // Comprobar estado Online de la cuenta
  async checkLineOnline(screenId) {
    const wv = this.getWebview(screenId);
    if (!wv) return false;
    try {
      const isOnline = await wv.executeJavaScript(`
        (function() {
          // Si está en la pantalla de inicio de sesión / QR code, no está online
          const hasQr = Boolean(
            document.querySelector('canvas') ||
            document.querySelector('[data-ref]') ||
            document.querySelector('[data-testid="qrcode"]')
          );
          if (hasQr) return false;

          // Si el panel de chats o la barra de conversación está activa
          return Boolean(
            document.querySelector('#pane-side') ||
            document.querySelector('#main') ||
            document.querySelector('[data-testid="chat-list"]') ||
            document.querySelector('footer div[contenteditable="true"]')
          );
        })()
      `);
      return Boolean(isOnline);
    } catch (e) {
      return false;
    }
  },

  startOnlineChecker() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(async () => {
      const screens = window.AppManager ? window.AppManager.screens : [];
      for (let s of screens) {
        const c = this.getCampaign(s.id);
        const online = await this.checkLineOnline(s.id);
        if (c.isOnline !== online) {
          c.isOnline = online;
          this.updateLineCardStatus(s.id);
        }
      }
    }, 4000);
  },

  updateLineCardStatus(screenId) {
    const card = document.getElementById(`line-card-${screenId}`);
    if (!card) return;
    const camp = this.getCampaign(screenId);
    const pill = card.querySelector('.line-status-pill');
    if (!pill) return;

    if (camp.isOnline) {
      pill.className = 'line-status-pill online';
      pill.innerHTML = '<span class="status-dot online"></span> Online';
    } else {
      pill.className = 'line-status-pill offline';
      pill.innerHTML = '<span class="status-dot offline"></span> Offline';
    }
  },

  updateLineCardCount(screenId) {
    const card = document.getElementById(`line-card-${screenId}`);
    if (!card) return;
    const camp = this.getCampaign(screenId);
    const contactsSpan = card.querySelector('.line-card-contacts');
    if (contactsSpan) {
      contactsSpan.textContent = `${camp.contacts.length} contactos cargados`;
    }
  },

  // =========================================================================
  // RENDERIZAR TARJETAS CON EL NOMBRE REAL DE CADA PANTALLA
  // =========================================================================
  renderLineCards() {
    const row = document.getElementById('bulk-lines-row');
    if (!row) return;

    const screens = window.AppManager ? window.AppManager.screens : [];
    if (screens.length === 0) {
      row.innerHTML = `<div style="color: var(--text-secondary); padding: 8px;">No hay cuentas activas. Agrega una desde "+ Nueva Línea".</div>`;
      return;
    }

    if (!this.selectedLineId || !screens.some(s => s.id === this.selectedLineId)) {
      this.selectedLineId = screens[0].id;
    }

    row.innerHTML = '';

    screens.forEach((screen) => {
      const camp = this.getCampaign(screen.id);
      const isSelected = screen.id === this.selectedLineId;

      const card = document.createElement('div');
      card.className = `line-card ${isSelected ? 'active' : ''}`;
      card.id = `line-card-${screen.id}`;

      // Mostrar el nombre real que el usuario le puso a la pantalla (formateando si es solo un número)
      const rawName = String(screen.name || '').trim();
      const displayName = /^\d+$/.test(rawName) ? `Línea ${rawName}` : (rawName || 'WhatsApp');

      card.innerHTML = `
        <div class="line-card-icon">📱</div>
        <div class="line-card-info">
          <div class="line-card-title" title="${displayName}">${displayName}</div>
          <div class="line-card-contacts">${camp.contacts.length} contactos cargados</div>
        </div>
        <div class="line-status-pill ${camp.isOnline ? 'online' : 'offline'}">
          <span class="status-dot ${camp.isOnline ? 'online' : 'offline'}"></span>
          ${camp.isOnline ? 'Online' : 'Offline'}
        </div>
      `;

      card.addEventListener('click', () => {
        this.selectLine(screen.id);
      });

      row.appendChild(card);
    });

    this.renderWorkspace();
  },

  selectLine(screenId) {
    this.selectedLineId = screenId;
    document.querySelectorAll('.line-card').forEach(c => {
      c.classList.toggle('active', c.id === `line-card-${screenId}`);
    });
    this.renderWorkspace();
  },

  // =========================================================================
  // RENDERIZAR EL ESPACIO DE TRABAJO DE LA LÍNEA SELECCIONADA
  // =========================================================================
  renderWorkspace() {
    const container = document.getElementById('bulk-workspace-content');
    if (!container) return;

    if (!this.selectedLineId) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 40px;">Selecciona una cuenta arriba para comenzar.</div>`;
      return;
    }

    const screens = window.AppManager ? window.AppManager.screens : [];
    const screenObj = screens.find(s => s.id === this.selectedLineId) || { name: 'Cuenta' };
    const rawName = String(screenObj.name || '').trim();
    const lineDisplayName = /^\d+$/.test(rawName) ? `Línea ${rawName}` : (rawName || 'Cuenta');
    const camp = this.getCampaign(this.selectedLineId);

    // Opciones del dropdown de prefijos
    const prefixOptions = this.countryPrefixes.map(p => `
      <option value="${p.code}" ${p.code === camp.selectedPrefix ? 'selected' : ''}>
        ${p.name}
      </option>
    `).join('');

    container.innerHTML = `
      <!-- Alerta Anti-Baneo -->
      <div class="antiban-alert" style="margin-bottom: 16px;">
        🛡️ <strong>Panel de Campaña para: ${lineDisplayName}</strong> | Anti-baneo activo: prefijo automático, verificador de WhatsApp y tiempos humanos.
      </div>

      <div class="bulk-grid-layout">
        <!-- Columna Izquierda: 1. Destinatarios y Contenido (Idéntico a la imagen) -->
        <div class="bulk-card-panel">
          <div class="dest-header">
            <span class="dest-title">1. Destinatarios y Contenido</span>
            <span class="dest-total-badge">Total cargados: <strong class="dest-total-count" id="total-loaded-count">${camp.contacts.length}</strong></span>
          </div>

          <!-- Selector de Modo (Pegar vs Importar) -->
          <div class="input-mode-selector">
            <label class="radio-mode-label ${camp.inputMode === 'paste' ? 'active' : ''}">
              <input type="radio" name="inputMode_${this.selectedLineId}" value="paste" ${camp.inputMode === 'paste' ? 'checked' : ''}>
              <span>123 Pegar Números</span>
            </label>
            <label class="radio-mode-label ${camp.inputMode === 'file' ? 'active' : ''}">
              <input type="radio" name="inputMode_${this.selectedLineId}" value="file" ${camp.inputMode === 'file' ? 'checked' : ''}>
              <span>📁 Importar Excel / CSV</span>
            </label>
          </div>

          <!-- Selector de Prefijo Internacional -->
          <div class="prefix-row">
            <select id="country-prefix-select" class="country-prefix-select">
              ${prefixOptions}
            </select>
            <span class="prefix-hint">Pega números separados por comas o saltos de línea:</span>
          </div>

          <!-- Área de entrada según modo -->
          <div id="mode-paste-container" style="${camp.inputMode === 'paste' ? 'display: block;' : 'display: none;'}">
            <textarea id="line-numbers-input" class="numbers-textarea" style="height: 110px;" placeholder="Ej: 906953567, 935844616, 906382322&#10;O pega directamente una columna de números...">${camp.rawNumbers}</textarea>
          </div>

          <div id="mode-file-container" style="${camp.inputMode === 'file' ? 'display: block;' : 'display: none;'}">
            <input type="file" id="contacts-file-input" accept=".csv, .txt, .tsv" style="display: none;">
            <div id="contacts-file-dropzone" class="image-dropzone" style="height: 110px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <span>📄 Clic o arrastra un archivo CSV o TXT aquí</span>
              <small style="color: var(--text-muted); margin-top: 4px;">Se extraerán los números telefónicos automáticamente</small>
            </div>
          </div>

          <!-- Fila de Acciones: Procesar, Exportar y Limpiar -->
          <div class="numbers-actions-row">
            <div>
              <button id="btn-process-numbers" class="btn-process" title="Formatear con prefijo y quitar duplicados">
                📑 Procesar Números
              </button>
            </div>
            <div style="display: flex; gap: 6px;">
              <button id="btn-export-contacts" class="btn-clear-list" style="color: #25d366; border-color: rgba(37, 211, 102, 0.3);" title="Exportar la lista actual de números a un archivo .TXT">
                📥 Exportar
              </button>
              <button id="btn-clear-contacts" class="btn-clear-list" title="Limpiar lista completa">
                🗑️ Limpiar
              </button>
            </div>
          </div>

          <!-- Contenedor de Números Procesados -->
          <div id="processed-numbers-box" class="processed-numbers-box">
            ${this.renderContactsListHtml(camp.contacts)}
          </div>
        </div>

        <!-- Columna Derecha: Mensaje e Imagen -->
        <div class="bulk-card-panel">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label class="form-label" style="margin: 0;"><strong>2. Mensaje y Multimedia:</strong></label>
            <span style="font-size: var(--font-xs); color: var(--text-muted);">Emojis y saltos intactos</span>
          </div>

          <textarea id="line-message-input" class="message-textarea" style="margin-top: 6px; height: 110px;" placeholder="Escribe el mensaje para los destinatarios...&#10;&#10;Usa saltos de línea y emojis libremente.&#10;Spintax: {Hola|Buenos días|Qué tal}">${camp.messageText}</textarea>

          <div style="margin-top: 6px; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-secondary btn-emoji-line" style="padding: 2px 6px; font-size: 13px;">👋</button>
              <button class="btn btn-secondary btn-emoji-line" style="padding: 2px 6px; font-size: 13px;">✅</button>
              <button class="btn btn-secondary btn-emoji-line" style="padding: 2px 6px; font-size: 13px;">🔥</button>
              <button class="btn btn-secondary btn-emoji-line" style="padding: 2px 6px; font-size: 13px;">📲</button>
              <button class="btn btn-secondary btn-emoji-line" style="padding: 2px 6px; font-size: 13px;">⭐</button>
            </div>
            <button id="btn-line-spintax" class="btn btn-secondary" style="font-size: 10px; padding: 3px 6px;" title="Inserta variación para evitar detección de spam">
              + Spintax
            </button>
          </div>

          <!-- Carga de Imagen -->
          <div style="margin-top: 10px;">
            <label class="form-label" style="margin-bottom: 2px;"><strong>3. Imagen Adjunta (Opcional):</strong></label>
            <input type="file" id="line-file-input" accept="image/*" style="display: none;">

            <div id="line-image-dropzone" class="image-dropzone" style="${camp.image ? 'display: none;' : 'display: block;'}">
              <span>📷 Clic o arrastra una imagen aquí</span>
            </div>

            <div id="line-image-preview-box" class="image-preview-wrapper" style="${camp.image ? 'display: flex;' : 'display: none;'}">
              <img id="line-image-thumb" class="image-preview-thumb" src="${camp.image ? camp.image.dataUrl : ''}" alt="Vista previa">
              <div style="flex: 1; overflow: hidden;">
                <div id="line-image-name" style="font-size: var(--font-sm); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  ${camp.image ? camp.image.name : ''}
                </div>
                <small style="color: var(--accent-color); font-size: 11px;">Imagen lista para enviar</small>
              </div>
              <button id="btn-line-remove-image" class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px; color: var(--danger-color);">✕ Quitar</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Configuración de Tiempos y Anti-Spam -->
      <div class="bulk-card-panel" style="margin-top: 14px; margin-bottom: 14px;">
        <label class="form-label"><strong>4. Tiempos Humanos y Protección de Línea:</strong></label>
        <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center; margin-top: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: var(--font-xs);">Espera mínima:</span>
            <input type="number" id="line-delay-min" class="form-input" style="width: 70px; padding: 4px 8px;" value="${camp.minDelay}" min="2" max="60"> seg
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: var(--font-xs);">Espera máxima:</span>
            <input type="number" id="line-delay-max" class="form-input" style="width: 70px; padding: 4px 8px;" value="${camp.maxDelay}" min="3" max="120"> seg
          </div>
          <label style="display: flex; align-items: center; gap: 6px; font-size: var(--font-xs); cursor: pointer;">
            <input type="checkbox" id="line-batch-check" ${camp.enableBatch ? 'checked' : ''}>
            <span>Pausar 2 minutos cada 15 envíos (Protege de baneo)</span>
          </label>
        </div>
      </div>

      <!-- Conteo Final y Resumen de Estadísticas -->
      <div class="bulk-card-panel" style="margin-bottom: 14px;">
        <label class="form-label"><strong>5. Conteo y Estadísticas de Campaña:</strong></label>
        <div class="metrics-summary-grid">
          <div class="metric-card">
            <div class="metric-val" id="stat-total" style="color: var(--text-primary);">${camp.stats.total || camp.contacts.length}</div>
            <div class="metric-title">Total Cargados</div>
          </div>
          <div class="metric-card">
            <div class="metric-val" id="stat-sent" style="color: #00a884;">${camp.stats.sent}</div>
            <div class="metric-title">Enviados con Éxito</div>
          </div>
          <div class="metric-card">
            <div class="metric-val" id="stat-invalid" style="color: #ea4335;">${camp.stats.invalid}</div>
            <div class="metric-title">Sin WhatsApp / Retirados</div>
          </div>
          <div class="metric-card">
            <div class="metric-val" id="stat-errors" style="color: #e67e22;">${camp.stats.errors}</div>
            <div class="metric-title">Errores</div>
          </div>
        </div>
      </div>

      <!-- Monitor de Progreso y Acciones -->
      <div class="bulk-card-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <strong>Estado: </strong>
            <span id="line-status-label" style="font-size: var(--font-sm); color: var(--accent-color); font-weight: 600;">
              ${camp.status === 'running' ? '🚀 Enviando...' : camp.status === 'verifying' ? '🔍 Verificando...' : camp.status === 'paused' ? '⏸️ Pausado' : camp.status === 'done' ? '🏁 Finalizado' : 'Listo'}
            </span>
          </div>
          <span id="line-progress-text" style="font-size: var(--font-xs); color: var(--text-secondary);">
            ${camp.currentIndex} / ${camp.contacts.length}
          </span>
        </div>

        <div class="progress-container" style="margin-top: 4px; margin-bottom: 12px;">
          <div id="line-progress-bar" class="progress-fill" style="width: ${camp.contacts.length ? Math.round((camp.currentIndex / camp.contacts.length) * 100) : 0}%;"></div>
        </div>

        <div style="display: flex; gap: 10px; align-items: center;">
          <button id="btn-line-start" class="btn btn-primary" style="${camp.status === 'running' || camp.status === 'verifying' ? 'display: none;' : 'display: inline-flex;'}">
            🚀 Iniciar Envío en ${lineDisplayName}
          </button>
          <button id="btn-line-pause" class="btn btn-secondary" style="${camp.status === 'running' ? 'display: inline-flex;' : 'display: none;'}">
            ${camp.status === 'paused' ? '▶️ Reanudar' : '⏸️ Pausar'}
          </button>
          <button id="btn-line-stop" class="btn btn-danger" style="${camp.status === 'running' || camp.status === 'paused' || camp.status === 'verifying' ? 'display: inline-flex;' : 'display: none;'}">
            ⏹️ Detener
          </button>
        </div>

        <div id="line-log-box" class="bulk-log-container" style="margin-top: 14px;">
          ${camp.logs.map(l => `<div class="bulk-log-item"><span>[${l.time}] ${l.msg}</span> <strong>${l.status}</strong></div>`).join('')}
        </div>
      </div>
    `;

    this.wireWorkspaceEvents(this.selectedLineId);
  },

  // Generar HTML de la lista de números procesados
  renderContactsListHtml(contacts) {
    if (!contacts || contacts.length === 0) {
      return `<div class="empty-numbers-msg">No hay números cargados aún.</div>`;
    }

    const itemsHtml = contacts.map((c, idx) => {
      let tagClass = 'tag-pending';
      let tagText = 'Pendiente';

      if (c.status === 'valid') {
        tagClass = 'tag-valid';
        tagText = 'WhatsApp Activo ✅';
      } else if (c.status === 'invalid') {
        tagClass = 'tag-invalid';
        tagText = 'Sin WhatsApp ❌';
      } else if (c.status === 'sent') {
        tagClass = 'tag-sent';
        tagText = 'Enviado ✅';
      } else if (c.status === 'error') {
        tagClass = 'tag-invalid';
        tagText = 'Error ⚠️';
      }

      return `
        <div class="contact-row-item" data-index="${idx}">
          <div class="contact-phone-info">
            <span style="color: var(--text-secondary); width: 24px;">#${idx + 1}</span>
            <span>+${c.phone}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="contact-status-tag ${tagClass}">${tagText}</span>
            <button class="btn-remove-contact" data-index="${idx}" title="Quitar número">✕</button>
          </div>
        </div>
      `;
    }).join('');

    return `<div class="processed-list">${itemsHtml}</div>`;
  },

  // Conectar eventos del panel de trabajo
  wireWorkspaceEvents(screenId) {
    const camp = this.getCampaign(screenId);
    const numsInput = document.getElementById('line-numbers-input');
    const totalCountElem = document.getElementById('total-loaded-count');
    const prefixSelect = document.getElementById('country-prefix-select');
    const btnProcess = document.getElementById('btn-process-numbers');
    const btnClear = document.getElementById('btn-clear-contacts');
    const btnExport = document.getElementById('btn-export-contacts');
    const processedBox = document.getElementById('processed-numbers-box');

    const modePasteContainer = document.getElementById('mode-paste-container');
    const modeFileContainer = document.getElementById('mode-file-container');
    const fileInput = document.getElementById('contacts-file-input');
    const fileDropzone = document.getElementById('contacts-file-dropzone');

    const msgInput = document.getElementById('line-message-input');
    const imgFileInput = document.getElementById('line-file-input');
    const imgDropzone = document.getElementById('line-image-dropzone');
    const imgPreviewBox = document.getElementById('line-image-preview-box');
    const imgPreviewThumb = document.getElementById('line-image-thumb');
    const imgName = document.getElementById('line-image-name');
    const btnRemoveImg = document.getElementById('btn-line-remove-image');

    const delayMin = document.getElementById('line-delay-min');
    const delayMax = document.getElementById('line-delay-max');
    const batchCheck = document.getElementById('line-batch-check');

    const btnStart = document.getElementById('btn-line-start');
    const btnPause = document.getElementById('btn-line-pause');
    const btnStop = document.getElementById('btn-line-stop');

    // Modo Pegar vs Archivo
    document.querySelectorAll(`input[name="inputMode_${screenId}"]`).forEach(radio => {
      radio.addEventListener('change', (e) => {
        camp.inputMode = e.target.value;
        if (camp.inputMode === 'paste') {
          modePasteContainer.style.display = 'block';
          modeFileContainer.style.display = 'none';
        } else {
          modePasteContainer.style.display = 'none';
          modeFileContainer.style.display = 'block';
        }
        document.querySelectorAll('.radio-mode-label').forEach(lbl => {
          lbl.classList.toggle('active', lbl.querySelector('input').checked);
        });
      });
    });

    // Cambio de prefijo
    prefixSelect?.addEventListener('change', (e) => {
      camp.selectedPrefix = e.target.value;
    });

    // Guardar texto plano
    numsInput?.addEventListener('input', () => {
      camp.rawNumbers = numsInput.value;
    });

    // Cargar archivo CSV/TXT
    fileDropzone?.addEventListener('click', () => fileInput.click());

    fileInput?.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        this.readFileContacts(fileInput.files[0], screenId);
      }
    });

    fileDropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileDropzone.style.borderColor = 'var(--accent-color)';
    });

    fileDropzone?.addEventListener('dragleave', () => {
      fileDropzone.style.borderColor = '';
    });

    fileDropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      fileDropzone.style.borderColor = '';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.readFileContacts(e.dataTransfer.files[0], screenId);
      }
    });

    // Botón: Procesar Números (Aplica prefijo, quita duplicados y carga lista)
    btnProcess?.addEventListener('click', () => {
      camp.rawNumbers = numsInput ? numsInput.value : camp.rawNumbers;
      const processed = this.processRawNumbers(camp.rawNumbers, camp.selectedPrefix);
      camp.contacts = processed;
      camp.stats.total = processed.length;

      if (totalCountElem) totalCountElem.textContent = processed.length;
      document.getElementById('stat-total').textContent = processed.length;
      processedBox.innerHTML = this.renderContactsListHtml(processed);
      this.updateLineCardCount(screenId);
      this.bindContactRemoveButtons(screenId);
    });

    // Botón: Limpiar Lista
    btnClear?.addEventListener('click', () => {
      camp.contacts = [];
      camp.rawNumbers = '';
      if (numsInput) numsInput.value = '';
      camp.stats.total = 0;
      camp.stats.sent = 0;
      camp.stats.invalid = 0;
      camp.stats.errors = 0;

      if (totalCountElem) totalCountElem.textContent = '0';
      document.getElementById('stat-total').textContent = '0';
      document.getElementById('stat-sent').textContent = '0';
      document.getElementById('stat-invalid').textContent = '0';
      document.getElementById('stat-errors').textContent = '0';
      processedBox.innerHTML = this.renderContactsListHtml([]);
      this.updateLineCardCount(screenId);
    });

    // Botón: Exportar Lista (Válidos, Descartados o Completo)
    btnExport?.addEventListener('click', () => {
      if (!camp.contacts || camp.contacts.length === 0) {
        alert('No hay números en la lista para exportar.');
        return;
      }

      const valids = camp.contacts.filter(c => c.status !== 'invalid');
      const invalids = camp.contacts.filter(c => c.status === 'invalid');

      let choice = '1';
      if (invalids.length > 0) {
        choice = prompt(
          `¿Qué lista deseas exportar?\n\n1 = Solo números VÁLIDOS / con WhatsApp (${valids.length})\n2 = Solo números DESCARTADOS sin WhatsApp (${invalids.length})\n3 = Reporte completo con estado (${camp.contacts.length})\n\nEscribe 1, 2 o 3:`,
          '1'
        );
      }

      if (!choice) return;

      let content = '';
      let filename = '';
      const dateStr = new Date().toISOString().slice(0, 10);

      if (choice.trim() === '2') {
        if (invalids.length === 0) { alert('No hay números descartados en esta lista.'); return; }
        content = invalids.map(c => '+' + c.phone).join('\r\n');
        filename = `numeros_sin_whatsapp_${dateStr}.txt`;
      } else if (choice.trim() === '3') {
        content = 'Telefono,Estado\r\n' + camp.contacts.map(c => `+${c.phone},${c.status}`).join('\r\n');
        filename = `reporte_completo_whatsapp_${dateStr}.csv`;
      } else {
        content = valids.map(c => '+' + c.phone).join('\r\n');
        filename = `numeros_validos_whatsapp_${dateStr}.txt`;
      }

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    });

    // Quitar contacto individual
    this.bindContactRemoveButtons(screenId);

    // Mensaje
    msgInput?.addEventListener('input', () => {
      camp.messageText = msgInput.value;
    });

    // Emojis rápidos
    document.querySelectorAll('.btn-emoji-line').forEach(btn => {
      btn.addEventListener('click', () => {
        msgInput.value += btn.textContent;
        camp.messageText = msgInput.value;
        msgInput.focus();
      });
    });

    // Spintax
    document.getElementById('btn-line-spintax')?.addEventListener('click', () => {
      const sample = '{Hola|Buenos días|Qué tal} ';
      const start = msgInput.selectionStart;
      const end = msgInput.selectionEnd;
      msgInput.value = msgInput.value.substring(0, start) + sample + msgInput.value.substring(end);
      camp.messageText = msgInput.value;
      msgInput.focus();
    });

    // Imagen
    imgDropzone?.addEventListener('click', () => imgFileInput.click());

    imgFileInput?.addEventListener('change', () => {
      if (imgFileInput.files && imgFileInput.files[0]) {
        processImage(imgFileInput.files[0]);
      }
    });

    const processImage = (file) => {
      if (!file.type.startsWith('image/')) {
        alert('Selecciona un archivo de imagen válido.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        camp.image = {
          name: file.name,
          type: file.type,
          dataUrl: e.target.result
        };
        imgPreviewThumb.src = e.target.result;
        imgName.textContent = file.name;
        imgDropzone.style.display = 'none';
        imgPreviewBox.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    };

    btnRemoveImg?.addEventListener('click', () => {
      camp.image = null;
      imgFileInput.value = '';
      imgPreviewBox.style.display = 'none';
      imgDropzone.style.display = 'block';
    });

    delayMin?.addEventListener('change', (e) => {
      camp.minDelay = parseInt(e.target.value, 10) || 12;
    });

    delayMax?.addEventListener('change', (e) => {
      camp.maxDelay = parseInt(e.target.value, 10) || 25;
    });

    batchCheck?.addEventListener('change', (e) => {
      camp.enableBatch = e.target.checked;
    });

    // Iniciar Envío
    btnStart?.addEventListener('click', () => {
      this.startCampaign(screenId);
    });

    // Pausar
    btnPause?.addEventListener('click', () => {
      if (camp.status === 'running') {
        camp.status = 'paused';
        btnPause.textContent = '▶️ Reanudar';
        btnPause.className = 'btn btn-primary';
        document.getElementById('line-status-label').textContent = '⏸️ Pausado';
      } else if (camp.status === 'paused') {
        camp.status = 'running';
        btnPause.textContent = '⏸️ Pausar';
        btnPause.className = 'btn btn-secondary';
        document.getElementById('line-status-label').textContent = '🚀 Enviando...';
      }
    });

    // Detener
    btnStop?.addEventListener('click', () => {
      if (confirm('¿Deseas detener el proceso en esta línea?')) {
        camp.status = 'idle';
        this.renderWorkspace();
      }
    });
  },

  // Leer archivo CSV/TXT
  readFileContacts(file, screenId) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const camp = this.getCampaign(screenId);
      camp.rawNumbers = text;
      const processed = this.processRawNumbers(text, camp.selectedPrefix);
      camp.contacts = processed;
      camp.stats.total = processed.length;

      const totalCountElem = document.getElementById('total-loaded-count');
      const processedBox = document.getElementById('processed-numbers-box');

      if (totalCountElem) totalCountElem.textContent = processed.length;
      document.getElementById('stat-total').textContent = processed.length;
      if (processedBox) processedBox.innerHTML = this.renderContactsListHtml(processed);
      this.updateLineCardCount(screenId);
      this.bindContactRemoveButtons(screenId);
    };
    reader.readAsText(file);
  },

  // Evento para quitar contacto de la lista
  bindContactRemoveButtons(screenId) {
    const camp = this.getCampaign(screenId);
    document.querySelectorAll('.btn-remove-contact').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        if (!isNaN(idx) && camp.contacts[idx]) {
          camp.contacts.splice(idx, 1);
          camp.stats.total = camp.contacts.length;
          const processedBox = document.getElementById('processed-numbers-box');
          const totalCountElem = document.getElementById('total-loaded-count');
          if (totalCountElem) totalCountElem.textContent = camp.contacts.length;
          document.getElementById('stat-total').textContent = camp.contacts.length;
          if (processedBox) processedBox.innerHTML = this.renderContactsListHtml(camp.contacts);
          this.updateLineCardCount(screenId);
          this.bindContactRemoveButtons(screenId);
        }
      });
    });
  },

  // =========================================================================
  // VERIFICADOR DE WHATSAPP (Identifica y retira números sin cuenta)
  // =========================================================================
  async verifyWhatsAppNumbers(screenId) {
    const camp = this.getCampaign(screenId);
    if (camp.contacts.length === 0) {
      alert('Primero carga y procesa los números que deseas verificar.');
      return;
    }

    const webview = this.getWebview(screenId);
    if (!webview) {
      alert('La ventana de WhatsApp no está disponible.');
      return;
    }

    const isOnline = await this.checkLineOnline(screenId);
    if (!isOnline) {
      alert('La línea debe estar "Online" con la sesión de WhatsApp iniciada para verificar números.');
      return;
    }

    camp.status = 'verifying';
    document.getElementById('line-status-label').textContent = '🔍 Verificando números...';
    document.getElementById('btn-line-start').style.display = 'none';
    document.getElementById('btn-line-stop').style.display = 'inline-flex';

    const logBox = document.getElementById('line-log-box');
    const addLog = (msg, status = '') => {
      const time = new Date().toLocaleTimeString();
      camp.logs.push({ time, msg, status });
      if (logBox && this.selectedLineId === screenId) {
        const item = document.createElement('div');
        item.className = 'bulk-log-item';
        item.innerHTML = `<span>[${time}] ${msg}</span> <strong>${status}</strong>`;
        logBox.appendChild(item);
        logBox.scrollTop = logBox.scrollHeight;
      }
    };

    addLog(`Iniciando verificación de ${camp.contacts.length} contactos...`);

    const toRemoveIndices = [];

    for (let i = 0; i < camp.contacts.length; i++) {
      if (camp.status === 'idle') {
        addLog('Verificación cancelada por el usuario.', '⏹️ CANCELADO');
        break;
      }

      const c = camp.contacts[i];
      addLog(`Comprobando +${c.phone}...`, '⏳ VERIFICANDO');

      const checkScript = `
        (async function() {
          const phone = ${JSON.stringify(c.phone)};
          function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

          const cleanDigits = phone.replace(/[^0-9]/g, '');
          const lastDigits = cleanDigits.slice(-7);

          // Función para detectar popups de error en WhatsApp
          function findErrorPopup() {
            const popups = document.querySelectorAll(
              '[data-testid="popup-contents"], [data-animate-modal-popup="true"], [data-animate-modal-body="true"], div[role="dialog"]'
            );
            for (const p of popups) {
              const txt = (p.innerText || '').toLowerCase();
              if (
                txt.includes('no es válido') || txt.includes('no es valido') ||
                txt.includes('invalid') || txt.includes('incorrecto') ||
                txt.includes("isn't on whatsapp") || txt.includes("is not on whatsapp") ||
                txt.includes('no está en whatsapp') || txt.includes('no esta en whatsapp') ||
                txt.includes('no registrado') || txt.includes('inválido') ||
                txt.includes('url')
              ) {
                return { element: p, text: txt };
              }
            }
            return null;
          }

          // 1. Cerrar cualquier modal residual
          try {
            const oldErr = findErrorPopup();
            if (oldErr) {
              const btn = oldErr.element.querySelector('button, [role="button"]');
              if (btn) btn.click();
              await wait(300);
            }
          } catch(e) {}

          // 2. Si el chat actual YA corresponde a este número, es VÁLIDO de inmediato
          const currentHeader = (document.querySelector('#main header')?.innerText || '').trim();
          const currentHeaderNums = currentHeader.replace(/[^0-9]/g, '');
          if (lastDigits && currentHeaderNums.includes(lastDigits)) {
            const chatInput = document.querySelector('#main footer div[contenteditable="true"]');
            if (chatInput) {
              return { hasWhatsApp: true, note: 'Chat ya estaba abierto' };
            }
          }

          // 3. Navegar mediante click-to-chat limpio
          let link = document.getElementById('__wa_checker_link');
          if (!link) {
            link = document.createElement('a');
            link.id = '__wa_checker_link';
            link.style.display = 'none';
            document.body.appendChild(link);
          }
          link.href = 'https://web.whatsapp.com/send?phone=' + cleanDigits;
          link.click();

          // 4. Ciclo de comprobación RÁPIDO: máximo 4 segundos (16 ciclos x 250ms)
          let cycles = 0;
          const maxCycles = 16;

          while (cycles < maxCycles) {
            await wait(250);
            cycles++;

            // A) Si WhatsApp muestra modal de número no válido:
            const errPopup = findErrorPopup();
            if (errPopup) {
              const btn = errPopup.element.querySelector('button, [role="button"]');
              if (btn) btn.click();
              return { hasWhatsApp: false, reason: 'Número no registrado' };
            }

            // B) Comprobar si el chat cargó
            const headerNow = (document.querySelector('#main header')?.innerText || '').trim();
            const headerNumsNow = headerNow.replace(/[^0-9]/g, '');
            const chatInput = document.querySelector('#main footer div[contenteditable="true"]') ||
                              document.querySelector('div[contenteditable="true"][data-tab="10"]');

            // Si los dígitos coinciden en el header y el input está activo
            if (lastDigits && headerNumsNow.includes(lastDigits) && chatInput) {
              return { hasWhatsApp: true };
            }

            // Si ya pasaron al menos 2.5s (10 ciclos), hay input de chat y NO hubo modal de error
            if (cycles >= 10 && chatInput) {
              const errCheck = findErrorPopup();
              if (errCheck) {
                const btn = errCheck.element.querySelector('button, [role="button"]');
                if (btn) btn.click();
                return { hasWhatsApp: false, reason: 'Número no registrado' };
              }
              return { hasWhatsApp: true };
            }
          }

          // Verificación final rápida de popup
          const finalErr = findErrorPopup();
          if (finalErr) {
            const btn = finalErr.element.querySelector('button, [role="button"]');
            if (btn) btn.click();
            return { hasWhatsApp: false, reason: 'Número no registrado' };
          }

          // Si tras 4s no cargó chat ni dio popup, verificar si el input de chat está listo
          const finalInput = document.querySelector('#main footer div[contenteditable="true"]');
          if (finalInput) {
            return { hasWhatsApp: true };
          }

          return { hasWhatsApp: false, reason: 'No se pudo verificar' };
        })();
      `;

      try {

        const res = await webview.executeJavaScript(checkScript);
        if (res && res.hasWhatsApp) {
          c.status = 'valid';
          addLog(`+${c.phone}: WhatsApp activo`, '✅ VÁLIDO');
        } else {
          c.status = 'invalid';
          camp.stats.invalid++;
          toRemoveIndices.push(i);
          addLog(`+${c.phone}: No tiene WhatsApp`, '❌ SIN WHATSAPP');
        }
      } catch (err) {
        c.status = 'invalid';
        camp.stats.invalid++;
        toRemoveIndices.push(i);
        addLog(`+${c.phone}: Error al comprobar (${err.message})`, '❌ ERROR');
      }

      // Actualizar vista parcial
      const processedBox = document.getElementById('processed-numbers-box');
      if (processedBox && this.selectedLineId === screenId) {
        processedBox.innerHTML = this.renderContactsListHtml(camp.contacts);
      }
      document.getElementById('stat-invalid').textContent = camp.stats.invalid;

      await new Promise(r => setTimeout(r, 1200));
    }

    // Retirar de la lista los números que no tienen WhatsApp
    if (toRemoveIndices.length > 0) {
      addLog(`Retirando ${toRemoveIndices.length} números sin WhatsApp de la lista...`, '🧹 LIMPIEZA');
      camp.contacts = camp.contacts.filter((_, idx) => !toRemoveIndices.includes(idx));
      camp.stats.total = camp.contacts.length;
    }

    camp.status = 'idle';
    addLog(`Verificación completada. Contactos válidos restantes: ${camp.contacts.length}`, '🏁 LISTO');

    if (this.selectedLineId === screenId) {
      this.renderWorkspace();
    }
  },

  // =========================================================================
  // EJECUCIÓN DEL ENVÍO DE LA CAMPAÑA
  // =========================================================================
  async startCampaign(screenId) {
    const camp = this.getCampaign(screenId);
    if (camp.status === 'running' || camp.status === 'verifying') {
      return;
    }

    // Filtrar solo contactos listos para enviar (excluyendo los no válidos)
    const pendingContacts = camp.contacts.filter(c => c.status !== 'invalid');

    if (pendingContacts.length === 0) {
      alert('No hay números válidos para enviar.');
      return;
    }

    if (!camp.messageText.trim() && !camp.image) {
      alert('Debes escribir un mensaje o adjuntar una imagen.');
      return;
    }

    const webview = this.getWebview(screenId);
    if (!webview) {
      alert('La ventana de WhatsApp de esta línea no está abierta.');
      return;
    }

    const isOnline = await this.checkLineOnline(screenId);
    if (!isOnline) {
      if (!confirm('Esta línea aparece "Offline" en WhatsApp. ¿Intentar enviar de todos modos?')) {
        return;
      }
    }

    camp.status = 'running';
    camp.currentIndex = 0;
    camp.stats.sent = 0;
    camp.stats.errors = 0;
    this.renderWorkspace();

    const logBox = document.getElementById('line-log-box');
    const progressBar = document.getElementById('line-progress-bar');
    const progressText = document.getElementById('line-progress-text');

    const addLog = (msg, status = '') => {
      const time = new Date().toLocaleTimeString();
      camp.logs.push({ time, msg, status });
      if (logBox && this.selectedLineId === screenId) {
        const item = document.createElement('div');
        item.className = 'bulk-log-item';
        item.innerHTML = `<span>[${time}] ${msg}</span> <strong>${status}</strong>`;
        logBox.appendChild(item);
        logBox.scrollTop = logBox.scrollHeight;
      }
    };

    addLog(`Iniciando envío a ${pendingContacts.length} contactos...`);

    for (let i = 0; i < pendingContacts.length; i++) {
      if (camp.status === 'idle') {
        addLog('Envío detenido por el usuario.', '⏹️ DETENIDO');
        break;
      }

      while (camp.status === 'paused') {
        await new Promise(r => setTimeout(r, 1000));
      }

      camp.currentIndex = i + 1;
      const contact = pendingContacts[i];

      if (progressText && this.selectedLineId === screenId) {
        progressText.textContent = `${i + 1} / ${pendingContacts.length}`;
        progressBar.style.width = `${Math.round(((i) / pendingContacts.length) * 100)}%`;
      }

      addLog(`Enviando a +${contact.phone}...`, '⏳ ENVIANDO');

      const customText = this.resolveSpintax(camp.messageText);
      const imgData = camp.image ? camp.image.dataUrl : null;

      const res = await this.sendToContactInWebview(webview, contact.phone, customText, imgData);

      if (res.success) {
        camp.stats.sent++;
        contact.status = 'sent';
        addLog(`+${contact.phone}: Mensaje ${res.withImage ? 'con imagen ' : ''}enviado`, '✅ ÉXITO');
      } else if (res.isUnregistered) {
        camp.stats.invalid = (camp.stats.invalid || 0) + 1;
        contact.status = 'invalid';
        addLog(`+${contact.phone}: Descartado (No tiene WhatsApp)`, '❌ SIN WHATSAPP');
      } else {
        camp.stats.errors++;
        contact.status = 'error';
        addLog(`+${contact.phone}: ${res.reason || 'Error'}`, '⚠️ ERROR');
      }

      // Actualizar estadísticas visuales en tiempo real
      const elSent = document.getElementById('stat-sent');
      const elInvalid = document.getElementById('stat-invalid');
      const elErrors = document.getElementById('stat-errors');
      if (elSent) elSent.textContent = camp.stats.sent;
      if (elInvalid) elInvalid.textContent = camp.stats.invalid || 0;
      if (elErrors) elErrors.textContent = camp.stats.errors;

      // Actualizar la lista visual de contactos para reflejar 'Enviado ✅', 'Sin WhatsApp ❌' o 'Error ⚠️'
      const processedBox = document.getElementById('processed-numbers-box');
      if (processedBox && this.selectedLineId === screenId) {
        processedBox.innerHTML = this.renderContactsListHtml(camp.contacts);
        this.bindContactRemoveButtons(screenId);
      }

      if (progressBar && this.selectedLineId === screenId) {
        progressBar.style.width = `${Math.round(((i + 1) / pendingContacts.length) * 100)}%`;
      }

      // Delays inteligentes: Si es número sin WhatsApp, salto rápido (800ms) sin esperar los 4-8s
      if (i < pendingContacts.length - 1 && camp.status === 'running') {
        if (res.isUnregistered) {
          // Descarte ultrarrápido para números sin WhatsApp
          await new Promise(r => setTimeout(r, 800));
        } else if (camp.enableBatch && (camp.stats.sent % 15 === 0) && camp.stats.sent > 0) {
          addLog('🛡️ Pausa de descanso anti-baneo (2 minutos)...', '⏸️ PROTECCIÓN');
          let pauseSecs = 120;
          while (pauseSecs > 0 && camp.status === 'running' && camp.status !== 'paused') {
            await new Promise(r => setTimeout(r, 1000));
            pauseSecs--;
          }
        } else {
          const delayMs = this.getRandomDelay(camp.minDelay, camp.maxDelay);
          addLog(`Espera aleatoria: ${Math.round(delayMs / 1000)}s antes del próximo contacto...`);
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
    }

    camp.status = 'done';
    addLog(`Campaña finalizada. Enviados: ${camp.stats.sent} | Descartados sin WA: ${camp.stats.invalid || 0} | Errores: ${camp.stats.errors}`, '🏁 FINALIZADO');

    if (this.selectedLineId === screenId) {
      this.renderWorkspace();
    }
  },

  // Envío a contacto mediante orquestación nativa en Webview (con inyección de imagen por portapapeles de OS y formato fiel)
  async sendToContactInWebview(webview, phone, messageText, imageDataUrl) {
    // 1. Si hay imagen, inyectarla en el portapapeles del sistema operativo mediante IPC
    if (imageDataUrl && window.electronAPI && window.electronAPI.writeClipboardImage) {
      try {
        await window.electronAPI.writeClipboardImage(imageDataUrl);
      } catch (err) {
        console.warn('Error al escribir imagen en portapapeles:', err);
      }
    }

    // 2. Paso 1: Navegación y preparación del chat en WhatsApp Web
    const prepareScript = `
      (async function() {
        const phone = ${JSON.stringify(phone)};
        function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
        function clickElement(el) {
          if (!el) return;
          try { el.focus(); el.click(); } catch (err) {}
        }

        // Cerrar cualquier modal o menú flotante previo de manera segura
        try {
          // Si quedó el diálogo "¿Quieres descartar la selección?", hacer clic en "Descartar"
          const popups = document.querySelectorAll('div[data-animate-modal-popup="true"], [data-testid="popup-contents"], div[role="dialog"]');
          for (let p of popups) {
            const txt = (p.innerText || '').toLowerCase();
            if (txt.includes('descartar')) {
              const dBtn = Array.from(p.querySelectorAll('button, div[role="button"]')).find(b =>
                (b.innerText || '').toLowerCase().includes('descartar')
              );
              if (dBtn) clickElement(dBtn);
            }
          }

          const strayClose = document.querySelector('[data-testid="btn-close"]') ||
                             document.querySelector('header span[data-icon="x"]')?.closest('[role="button"]') ||
                             document.querySelector('span[data-icon="close"]')?.closest('[role="button"]') ||
                             document.querySelector('div[data-animate-modal-popup="true"] span[data-icon="x"]')?.closest('[role="button"]');
          if (strayClose) clickElement(strayClose);
        } catch (e) {}

        const oldHeaderTitle = (document.querySelector('#main header')?.innerText || '').trim();
        const cleanDigits = phone.replace(/[^0-9]/g, '');
        const phoneLastDigits = cleanDigits.slice(-7);

        // Navegación click-to-chat limpia
        let link = document.getElementById('__wa_sender_link');
        if (!link) {
          link = document.createElement('a');
          link.id = '__wa_sender_link';
          link.style.display = 'none';
          document.body.appendChild(link);
        }
        link.href = 'https://web.whatsapp.com/send?phone=' + cleanDigits;
        link.click();

        let attempts = 0;
        let chatLoaded = false;
        let invalidNumber = false;

        while (attempts < 30) {
          await wait(250);
          attempts++;

          // Comprobar popup de número no válido en WhatsApp
          const popups = document.querySelectorAll(
            'div[role="dialog"], div[data-animate-modal-popup="true"], [data-animate-modal-body="true"], [data-testid="popup-contents"]'
          );
          for (let p of popups) {
            const popupText = (p.innerText || '').toLowerCase();
            if (
              popupText.includes('no es válido') ||
              popupText.includes('no es valido') ||
              popupText.includes('invalid') ||
              popupText.includes('incorrecto') ||
              popupText.includes('no está en whatsapp') ||
              popupText.includes('no esta en whatsapp') ||
              popupText.includes("isn't on whatsapp") ||
              popupText.includes("is not on whatsapp") ||
              popupText.includes('no registrado') ||
              popupText.includes('url')
            ) {
              const okBtn = p.querySelector('button') || p.querySelector('div[role="button"]');
              if (okBtn) clickElement(okBtn);
              invalidNumber = true;
              break;
            }
          }
          if (invalidNumber) break;

          const mainPane = document.querySelector('#main');
          const mainHeader = document.querySelector('#main header');
          const chatInput = document.querySelector('#main footer div[contenteditable="true"]') ||
                            document.querySelector('footer div[contenteditable="true"]') ||
                            document.querySelector('div[contenteditable="true"][data-tab="10"]');

          if (mainPane && mainHeader && chatInput) {
            const currentHeaderTitle = (mainHeader.innerText || '').trim();
            const headerNumbers = currentHeaderTitle.replace(/[^0-9]/g, '');

            const isDifferentChat = oldHeaderTitle && (currentHeaderTitle !== oldHeaderTitle);
            const headerMatchesPhone = phoneLastDigits && headerNumbers.includes(phoneLastDigits);
            const wasInitiallyEmpty = !oldHeaderTitle;

            if (headerMatchesPhone || (isDifferentChat && attempts >= 3) || (wasInitiallyEmpty && attempts >= 2) || (attempts >= 10)) {
              chatLoaded = true;
              chatInput.focus();
              break;
            }
          }
        }

        if (invalidNumber) {
          return { success: false, reason: 'Número no registrado en WhatsApp', isUnregistered: true };
        }
        if (!chatLoaded) {
          return { success: false, reason: 'Tiempo agotado cargando chat' };
        }

        return { success: true };
      })();
    `;

    try {
      const prepRes = await webview.executeJavaScript(prepareScript);
      if (!prepRes || !prepRes.success) {
        return prepRes || { success: false, reason: 'Error preparando chat' };
      }
    } catch (e) {
      return { success: false, reason: 'Error al abrir chat: ' + e.message };
    }

    // 3. Paso 2: Si hay imagen, enviar mediante el visor multimedia
    if (imageDataUrl) {
      // 3.1. Asegurar foco en el input del chat para recibir el pegado
      await webview.executeJavaScript(`
        (function() {
          const ci = document.querySelector('#main footer div[contenteditable="true"]') ||
                     document.querySelector('footer div[contenteditable="true"]');
          if (ci) { ci.focus(); return true; }
          return false;
        })()
      `);

      // 3.2. Pegar la imagen desde el portapapeles del sistema operativo
      webview.focus();
      webview.paste();

      // 3.3. Esperar que el visor multimedia de WhatsApp se abra (máx 6s)
      let viewerOpened = false;
      for (let attempt = 0; attempt < 18; attempt++) {
        await new Promise(r => setTimeout(r, 300));
        viewerOpened = await webview.executeJavaScript(`
          (function() {
            // A) Herramientas de edición en la parte superior (recortar, lápiz, texto, hd, stickers)
            const hasTools = Boolean(document.querySelector(
              'span[data-icon="crop"], span[data-icon="draw"], span[data-icon="pen"], span[data-icon="text"], span[data-icon="stickers"], span[data-icon="hd"]'
            ));
            if (hasTools) return true;

            // B) Campo de texto de pie de foto fuera del footer y del sidebar
            const hasCaption = Array.from(document.querySelectorAll('div[contenteditable="true"]')).some(
              ed => !ed.closest('#side') && !ed.closest('#main footer') && !ed.closest('header') && ed.getBoundingClientRect().top > (window.innerHeight * 0.3)
            );
            if (hasCaption) return true;

            // C) Botón de enviar fuera del footer
            const hasSendBtn = Array.from(document.querySelectorAll('span[data-icon*="send"], [data-testid="send"]')).some(
              el => !el.closest('#main footer') && !el.closest('#side')
            );
            return Boolean(hasSendBtn);
          })()
        `);
        if (viewerOpened) break;

        // Si tarda más de 1.2s, reintentar pegar UNA sola vez
        if (attempt === 4) {
          webview.focus();
          webview.paste();
        }
      }

      if (!viewerOpened) {
        return { success: false, reason: 'No se pudo abrir el visor multimedia de WhatsApp para adjuntar la foto' };
      }

      // 3.4. VISOR ABIERTO:
      // Enfocar el campo de pie de foto dentro del visor multimedia
      await webview.executeJavaScript(`
        (function() {
          const editables = document.querySelectorAll('div[contenteditable="true"]');
          for (let ed of editables) {
            if (ed.closest('#side') || ed.closest('#main footer') || ed.closest('header')) continue;
            const r = ed.getBoundingClientRect();
            if (r.width > 50 && r.height > 10 && r.top > (window.innerHeight * 0.3)) {
              ed.focus();
              ed.click();
              const sel = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(ed);
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
              return true;
            }
          }
          return false;
        })()
      `);

      // 3.5. Si hay texto para el mensaje, pegarlo mediante portapapeles nativo para preservar saltos y emojis
      if (messageText && messageText.trim()) {
        if (window.electronAPI && window.electronAPI.writeClipboardText) {
          await window.electronAPI.writeClipboardText(messageText);
        }
        webview.focus();
        webview.paste();
        await new Promise(r => setTimeout(r, 450));
      }

      // 3.6. Hacer clic en el botón de Enviar dentro del visor multimedia
      const sendRes = await webview.executeJavaScript(`
        (async function() {
          function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
          function clickElement(el) {
            if (!el) return;
            try {
              el.focus();
              el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
              el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
              el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
              el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
              el.click();
            } catch (err) {
              try { el.click(); } catch (e) {}
            }
          }

          function findMediaSendBtn() {
            const icons = document.querySelectorAll(
              'span[data-icon*="send"], span[data-icon="wds-ic-send-filled"], span[data-icon="send"]'
            );
            for (let ic of icons) {
              const btn = ic.closest('button, [role="button"]') || ic;
              if (!btn.closest('#main footer') && !btn.closest('#side')) return btn;
            }

            const testIds = document.querySelectorAll('[data-testid="send"], [data-testid="compose-btn-send"]');
            for (let el of testIds) {
              const btn = el.closest('button, [role="button"]') || el;
              if (!btn.closest('#main footer') && !btn.closest('#side')) return btn;
            }

            const allBtns = document.querySelectorAll('button, div[role="button"]');
            for (let b of allBtns) {
              if (b.closest('#main footer') || b.closest('#side')) continue;
              const aria = (b.getAttribute('aria-label') || '').toLowerCase();
              if (aria.includes('enviar') || aria.includes('send')) return b;
            }

            const candidates = Array.from(document.querySelectorAll('div[role="button"], button')).filter(b => {
              if (b.closest('#main footer') || b.closest('#side')) return false;
              const r = b.getBoundingClientRect();
              return r.width >= 24 && r.height >= 24 &&
                     r.bottom > (window.innerHeight * 0.5) &&
                     r.right > (window.innerWidth * 0.5) &&
                     !b.querySelector('[data-icon*="close"]') &&
                     !b.querySelector('[data-icon*="x"]');
            });

            return candidates.length > 0 ? candidates[candidates.length - 1] : null;
          }

          let mediaSendBtn = null;
          for (let attempt = 0; attempt < 20; attempt++) {
            mediaSendBtn = findMediaSendBtn();
            if (mediaSendBtn) break;
            await wait(150);
          }

          if (mediaSendBtn) {
            clickElement(mediaSendBtn);
          } else {
            // Fallback: pulsar Enter en el pie de foto
            const editables = document.querySelectorAll('div[contenteditable="true"]');
            for (let ed of editables) {
              if (ed.closest('#side') || ed.closest('#main footer')) continue;
              if (ed.getBoundingClientRect().top > (window.innerHeight * 0.3)) {
                ed.focus();
                ed.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                break;
              }
            }
          }

          // Esperar que el visor multimedia se cierre
          let waitClose = 0;
          while (waitClose < 35) {
            await wait(200);
            waitClose++;
            const stillOpen = Array.from(document.querySelectorAll('div[contenteditable="true"]')).some(
              ed => !ed.closest('#side') && !ed.closest('#main footer') && !ed.closest('header') && ed.getBoundingClientRect().top > (window.innerHeight * 0.3)
            );
            if (!stillOpen) break;
            if (waitClose === 12 && mediaSendBtn) {
              clickElement(mediaSendBtn);
            }
          }

          // Disparar eventos de visibilidad y foco para forzar flush inmediato del WebSocket
          try {
            window.dispatchEvent(new Event('focus'));
            window.dispatchEvent(new Event('visibilitychange'));
          } catch (e) {}

          await wait(600);
          return { success: true, withImage: true };
        })()
      `);

      return sendRes;
    }

    // 4. Paso 3: Envío solo texto (sin imagen)
    const textScript = `
      (async function() {
        const text = ${JSON.stringify(messageText)};
        function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
        function clickElement(el) {
          if (!el) return;
          try { el.focus(); el.click(); } catch (err) {}
        }

        function insertFormattedText(targetEl, textToInsert) {
          if (!targetEl || !textToInsert) return;
          targetEl.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('delete', false, null);

          let pastedSuccess = false;
          try {
            const dt = new DataTransfer();
            dt.setData('text/plain', textToInsert);
            const pasteEvt = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
            targetEl.dispatchEvent(pasteEvt);
            if ((targetEl.innerText || targetEl.textContent || '').trim().length > 0) {
              pastedSuccess = true;
            }
          } catch (e) {
            pastedSuccess = false;
          }

          if (!pastedSuccess || !(targetEl.innerText || '').includes('\\n')) {
            const lines = textToInsert.split(/\\r?\\n/);
            if (lines.length > 1) {
              document.execCommand('selectAll', false, null);
              document.execCommand('delete', false, null);
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].length > 0) {
                  document.execCommand('insertText', false, lines[i]);
                }
                if (i < lines.length - 1) {
                  const shiftEnter = new KeyboardEvent('keydown', {
                    key: 'Enter', code: 'Enter', keyCode: 13, which: 13, shiftKey: true, bubbles: true, cancelable: true
                  });
                  targetEl.dispatchEvent(shiftEnter);
                  document.execCommand('insertLineBreak');
                }
              }
            } else {
              document.execCommand('insertText', false, textToInsert);
            }
          }

          targetEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
          targetEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const chatInput = document.querySelector('#main footer div[contenteditable="true"]') ||
                          document.querySelector('footer div[contenteditable="true"]') ||
                          document.querySelector('div[contenteditable="true"][data-tab="10"]');

        if (!chatInput) {
          return { success: false, reason: 'No se encontró campo de texto del chat' };
        }

        insertFormattedText(chatInput, text);
        await wait(250);

        function findTextSendBtn() {
          const footer = document.querySelector('#main footer') || document.querySelector('footer') || document;
          const testIdBtn = footer.querySelector('[data-testid="send"]') ||
                            footer.querySelector('[data-testid="compose-btn-send"]');
          if (testIdBtn) return testIdBtn.closest('button, [role="button"]') || testIdBtn;

          const iconBtn = footer.querySelector('span[data-icon="send"]') ||
                          footer.querySelector('span[data-icon="send-light"]') ||
                          footer.querySelector('span[data-icon="wds-ic-send-filled"]') ||
                          footer.querySelector('span[data-icon="wds-ic-send"]') ||
                          footer.querySelector('[data-icon*="send"]');
          if (iconBtn) return iconBtn.closest('button, [role="button"]') || iconBtn;

          const ariaBtn = footer.querySelector('[aria-label*="enviar" i]') ||
                          footer.querySelector('[aria-label*="send" i]');
          if (ariaBtn) return ariaBtn.closest('button, [role="button"]') || ariaBtn;

          return null;
        }

        let textSendBtn = null;
        let waitTextAttempts = 0;
        while (waitTextAttempts < 20) {
          await wait(200);
          waitTextAttempts++;
          textSendBtn = findTextSendBtn();
          if (textSendBtn) break;
        }

        if (textSendBtn) {
          clickElement(textSendBtn);
        } else {
          chatInput.focus();
          const enterDown = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true });
          chatInput.dispatchEvent(enterDown);
        }

        // Esperar que el texto se procese y el input se vacíe
        let waitSent = 0;
        while (waitSent < 20) {
          await wait(150);
          waitSent++;
          const currentText = (chatInput.innerText || chatInput.textContent || '').trim();
          if (currentText.length === 0) break;
          if (waitSent === 8) {
            if (textSendBtn) clickElement(textSendBtn);
            else {
              chatInput.focus();
              chatInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
            }
          }
        }

        // Disparar eventos de visibilidad y foco para forzar flush inmediato del WebSocket
        try {
          window.dispatchEvent(new Event('focus'));
          window.dispatchEvent(new Event('visibilitychange'));
        } catch (e) {}

        await wait(500);
        return { success: true, withImage: false };
      })();
    `;

    try {
      const result = await webview.executeJavaScript(textScript);
      return result;
    } catch (e) {
      return { success: false, reason: e.message };
    }
  }
};

if (typeof window !== 'undefined') {
  window.BulkSender = BulkSender;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BulkSender;
}
