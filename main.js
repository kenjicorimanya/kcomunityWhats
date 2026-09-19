const { app, BrowserWindow, ipcMain, shell, session, clipboard, nativeImage, webContents, Menu, MenuItem } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { execFile } = require('child_process');

// Garantizar persistencia consistente en la carpeta oficial kcomunitywhats
app.name = 'kcomunitywhats';
const customUserData = path.join(app.getPath('appData'), 'kcomunitywhats');
app.setPath('userData', customUserData);

// Prevenir que Chromium congele WebSockets o temporizadores en webviews en segundo plano
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// ============================================================================
// OPTIMIZACIONES DE RENDIMIENTO Y REDUCCIÓN DE CONSUMO DE MEMORIA RAM
// ============================================================================
// 1. Limitar el Heap de V8 a 192MB por proceso y forzar optimización por tamaño
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=192 --optimize-for-size --expose-gc');

// 2. Modo bajo consumo de memoria de Chromium y alivio de presión de RAM
app.commandLine.appendSwitch('enable-low-end-device-mode');
app.commandLine.appendSwitch('force-memory-pressure-relief');
app.commandLine.appendSwitch('disable-site-isolation-trials');
app.commandLine.appendSwitch('enable-aggressive-domstorage-flushing');

// 3. Límites estrictos de caché en disco y medios para evitar que acumule cientos de MBs
app.commandLine.appendSwitch('disk-cache-size', '33554432');   // 32 MB máx de caché en disco
app.commandLine.appendSwitch('media-cache-size', '16777216');  // 16 MB máx de caché de medios

// 4. Reducir consumo de memoria del proceso GPU y búferes de vídeo
app.commandLine.appendSwitch('disable-gpu-memory-buffer-video-frames');
app.commandLine.appendSwitch('disable-zero-copy');

// 5. Desactivar subsistemas pesados y telemetría innecesaria de Chromium
app.commandLine.appendSwitch('disable-breakpad');
app.commandLine.appendSwitch('disable-domain-reliability');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-speech-api');
app.commandLine.appendSwitch('renderer-process-limit', '6');

// Prevenir múltiples instancias concurrentes que bloqueen la caché o bases de datos de particiones
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

const { LicenseManager } = require('./lib/license-manager');

let mainWindow = null;
let licenseManager = null;

// User Agent estándar para WhatsApp Web
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// Archivos de configuración persistente
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'app_settings.json');
}

function getScreensPath() {
  return path.join(app.getPath('userData'), 'user_screens.json');
}

function loadSettings() {
  const p = getSettingsPath();
  const defaultSettings = {
    theme: 'dark',           // 'dark' | 'light'
    fontSize: 'normal',       // 'small' | 'normal' | 'large'
    notifications: true,     // boolean
    audioEnabled: true,      // boolean
    layoutMode: 'tabs'       // 'tabs' | 'grid'
  };

  if (fs.existsSync(p)) {
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      return { ...defaultSettings, ...data };
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  }
  return defaultSettings;
}

function saveSettings(newSettings) {
  const p = getSettingsPath();
  try {
    fs.writeFileSync(p, JSON.stringify(newSettings, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving settings:', e);
    return false;
  }
}

function loadScreens() {
  const p = getScreensPath();
  if (fs.existsSync(p)) {
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    } catch (e) {
      console.error('Error loading screens:', e);
    }
  }

  // Si no hay pantallas configuradas, crear la primera por defecto
  const defaultScreens = [
    { id: 'screen_1', name: 'Cuenta Principal', createdAt: Date.now() }
  ];
  saveScreens(defaultScreens);
  return defaultScreens;
}

function saveScreens(screens) {
  const p = getScreensPath();
  try {
    fs.writeFileSync(p, JSON.stringify(screens, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Error saving screens:', e);
    return false;
  }
}

function createWindow() {
  licenseManager = new LicenseManager(app.getPath('userData'));

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'Kcomunitywhats - Control Multi-WhatsApp',
    backgroundColor: '#111b21',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      spellcheck: true,
      backgroundThrottling: false
    }
  });

  // Ocultar menú de ventana nativo de Electron para diseño limpio estilo app
  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER] ${message} (${path.basename(sourceId || '')}:${line})`);
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Manejador de permisos para notificaciones, micrófono, cámara
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['notifications', 'media', 'audioCapture', 'mediaKeySystem'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(true);
    }
  });

  // Verificar estado de prueba y licencia al iniciar
  const status = licenseManager.getStatus();
  if (status.isLocked && status.state === 'TRIAL_EXPIRED') {
    // Abrir automáticamente la página oficial kovaz.fyi
    shell.openExternal('https://kovaz.fyi').catch(() => {});
  }

  // Intervalo de comprobación periódica de la licencia (cada 30 minutos)
  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const currentStatus = licenseManager.getStatus();
    mainWindow.webContents.send('license:changed', currentStatus);
    if (currentStatus.isLocked && currentStatus.state === 'TRIAL_EXPIRED') {
      shell.openExternal('https://kovaz.fyi').catch(() => {});
    }
  }, 30 * 60 * 1000);

  // Comprobación de actualizaciones remotas a los 12 segundos del inicio
  setTimeout(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      const updateCheck = await checkAppUpdates();
      if (updateCheck.success && updateCheck.hasUpdate) {
        mainWindow.webContents.send('app:update-available', updateCheck);
      }
    } catch (e) {}
  }, 12 * 1000);
}

// ============================================================================
// MENÚ CONTEXTUAL Y CORRECTOR ORTOGRÁFICO CON SUGERENCIAS EN ESPAÑOL
// ============================================================================
function ensureSpanishDictionary() {
  try {
    const dictDir = path.join(app.getPath('userData'), 'Dictionaries');
    if (!fs.existsSync(dictDir)) {
      fs.mkdirSync(dictDir, { recursive: true });
    }
    const targetFile = path.join(dictDir, 'es-ES-3-0.bdic');
    const sourceFile = path.join(__dirname, 'assets', 'dictionaries', 'es-ES-3-0.bdic');

    if (fs.existsSync(sourceFile)) {
      const sourceStat = fs.statSync(sourceFile);
      const targetExists = fs.existsSync(targetFile);
      const targetStat = targetExists ? fs.statSync(targetFile) : null;

      // Si no existe o el tamaño difiere, copiar el diccionario oficial en español
      if (!targetExists || (targetStat && targetStat.size !== sourceStat.size)) {
        fs.copyFileSync(sourceFile, targetFile);
        console.log('[SPELLCHECK] Diccionario español es-ES-3-0.bdic instalado con éxito.');
      }
    }
  } catch (err) {
    console.error('[SPELLCHECK] Error asegurando diccionario español:', err);
  }
}

function attachContextMenu(contents) {
  // Asegurar que la sesión del webview / ventana tenga configurado el corrector en español exclusivamente
  try {
    if (contents.session && typeof contents.session.setSpellCheckerLanguages === 'function') {
      contents.session.setSpellCheckerLanguages(['es-ES']);
    }
  } catch (e) {}

  contents.on('context-menu', (event, params) => {
    const menu = new Menu();

    // 1. Sugerencias del corrector ortográfico si hay una palabra mal escrita
    if (params.misspelledWord) {
      if (params.dictionarySuggestions && params.dictionarySuggestions.length > 0) {
        for (const suggestion of params.dictionarySuggestions) {
          menu.append(new MenuItem({
            label: suggestion,
            click: () => contents.replaceMisspelling(suggestion)
          }));
        }
      } else {
        menu.append(new MenuItem({
          label: 'Sin sugerencias',
          enabled: false
        }));
      }

      menu.append(new MenuItem({ type: 'separator' }));

      // Añadir al diccionario personal del usuario
      menu.append(new MenuItem({
        label: `Añadir "${params.misspelledWord}" al diccionario`,
        click: () => {
          try {
            contents.session.addWordToSpellCheckerDictionary(params.misspelledWord);
          } catch (err) {}
        }
      }));

      menu.append(new MenuItem({ type: 'separator' }));
    }

    // 2. Acciones estándar de edición y portapapeles
    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'undo', label: 'Deshacer' }));
      menu.append(new MenuItem({ role: 'redo', label: 'Rehacer' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ role: 'cut', label: 'Cortar' }));
      menu.append(new MenuItem({ role: 'copy', label: 'Copiar' }));
      menu.append(new MenuItem({ role: 'paste', label: 'Pegar' }));
      menu.append(new MenuItem({ role: 'selectAll', label: 'Seleccionar todo' }));
    } else if (params.selectionText && params.selectionText.trim().length > 0) {
      menu.append(new MenuItem({ role: 'copy', label: 'Copiar' }));
      menu.append(new MenuItem({ role: 'selectAll', label: 'Seleccionar todo' }));
    }

    // Mostrar menú contextual si contiene elementos
    if (menu.items.length > 0) {
      menu.popup();
    }
  });
}

// Configurar User-Agent, corrector ortográfico y deshabilitar throttling en todas las sesiones webview
app.on('web-contents-created', (event, contents) => {
  attachContextMenu(contents);

  if (contents.getType() === 'webview') {
    contents.setUserAgent(CHROME_USER_AGENT);

    // Evitar suspensión de temporizadores y WebSockets cuando el webview está en segundo plano
    if (typeof contents.setBackgroundThrottling === 'function') {
      contents.setBackgroundThrottling(false);
    }

    // Impedir que los enlaces externos abran ventanas huérfanas dentro del webview
    contents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }
});

// IPC: Licencias
ipcMain.handle('license:get-status', () => {
  return licenseManager.getStatus();
});

ipcMain.handle('license:activate', (event, key) => {
  const result = licenseManager.activateKey(key);
  const updatedStatus = licenseManager.getStatus();
  if (mainWindow) {
    mainWindow.webContents.send('license:changed', updatedStatus);
  }
  return { ...result, status: updatedStatus };
});

ipcMain.handle('license:open-store', () => {
  shell.openExternal('https://kovaz.fyi');
  return true;
});

// IPC: Ajustes
ipcMain.handle('settings:get', () => {
  return loadSettings();
});

ipcMain.handle('settings:save', (event, newSettings) => {
  return saveSettings(newSettings);
});

// IPC: Pantallas
ipcMain.handle('screens:get', () => {
  return loadScreens();
});

ipcMain.handle('screens:save', (event, screens) => {
  return saveScreens(screens);
});

ipcMain.handle('screens:delete-session', async (event, screenId) => {
  try {
    const ses = session.fromPartition(`persist:whatsapp_${screenId}`);
    await ses.clearStorageData();
    await ses.clearCache();
    return true;
  } catch (e) {
    console.error('Error clearing session:', e);
    return false;
  }
});

// IPC: Abrir URLs externas
ipcMain.handle('app:open-external', (event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

// IPC: Portapapeles para inyección nativa de imágenes
ipcMain.handle('clipboard:write-image', async (_event, dataUrl) => {
  try {
    if (!dataUrl) return false;
    const img = nativeImage.createFromDataURL(dataUrl);
    if (img.isEmpty()) {
      console.error('clipboard:write-image: imagen vacía o no válida');
      return false;
    }
    clipboard.writeImage(img);
    return true;
  } catch (err) {
    console.error('Error escribiendo imagen a portapapeles:', err);
    return false;
  }
});

// IPC: Portapapeles para inyección nativa de texto fiel (emojis y saltos de línea)
ipcMain.handle('clipboard:write-text', async (_event, text) => {
  try {
    clipboard.writeText(text || '');
    return true;
  } catch (err) {
    console.error('Error escribiendo texto a portapapeles:', err);
    return false;
  }
});

// ============================================================================
// GESTIÓN DE VERSIONES Y ACTUALIZACIONES REMOTAS (GITHUB & WEB)
// ============================================================================
const GITHUB_OWNER = 'kenjicorimanya';
const GITHUB_REPO = 'kcomunityWhats';
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/version.json`;
const FALLBACK_URL = 'https://kovaz.fyi/updates/kcomunitywhats.json';

function isNewerVersion(remote, local) {
  if (!remote || !local) return false;
  const clean = (v) => v.toString().replace(/^v/i, '').trim();
  const rParts = clean(remote).split('.').map(n => parseInt(n, 10) || 0);
  const lParts = clean(local).split('.').map(n => parseInt(n, 10) || 0);
  const maxLen = Math.max(rParts.length, lParts.length);
  for (let i = 0; i < maxLen; i++) {
    const r = rParts[i] || 0;
    const l = lParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

function fetchJsonUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'User-Agent': 'Kcomunitywhats-Desktop-Updater',
          'Accept': 'application/vnd.github.v3+json, application/json'
        },
        timeout: 6000
      };

      const req = https.get(options, (res) => {
        // Manejar redirecciones 301 / 302
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          return fetchJsonUrl(res.headers.location).then(resolve);
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return resolve({ success: false, statusCode: res.statusCode, error: `HTTP ${res.statusCode}` });
        }

        let rawData = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(rawData);
            resolve({ success: true, statusCode: res.statusCode, data });
          } catch (e) {
            resolve({ success: false, error: 'Formato de respuesta JSON no válido' });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Tiempo de espera agotado' });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
}

function parseGitHubRelease(release) {
  if (!release || !release.tag_name) return null;
  const version = release.tag_name.replace(/^v/i, '').trim();
  const title = release.name || `Kcomunitywhats v${version}`;
  const body = release.body || '';

  // Extraer changelog línea a línea
  const changelog = body
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/^[-*•]\s*/, ''));

  // Buscar el instalador .exe entre los archivos adjuntos
  let downloadUrl = release.html_url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
  if (Array.isArray(release.assets)) {
    const exe = release.assets.find(a => a.name && a.name.toLowerCase().endsWith('.exe'));
    if (exe && exe.browser_download_url) {
      downloadUrl = exe.browser_download_url;
    }
  }

  const mandatory = body.toLowerCase().includes('[mandatory]') || body.toLowerCase().includes('obligatoria');

  return {
    version,
    title,
    releaseDate: release.published_at ? release.published_at.substring(0, 10) : '',
    mandatory,
    changelog: changelog.length > 0 ? changelog : ['Mejoras de rendimiento y correcciones en esta versión.'],
    downloadUrl,
    source: 'github-releases'
  };
}

async function checkAppUpdates() {
  const currentVersion = app.getVersion() || '1.0.0';

  // 1. Intentar consultar GitHub Releases API oficial
  try {
    const ghRes = await fetchJsonUrl(GITHUB_API_URL);
    if (ghRes.success && ghRes.data && ghRes.data.tag_name) {
      const releaseInfo = parseGitHubRelease(ghRes.data);
      if (releaseInfo && releaseInfo.version) {
        return {
          success: true,
          hasUpdate: isNewerVersion(releaseInfo.version, currentVersion),
          currentVersion,
          latestVersion: releaseInfo.version,
          releaseInfo
        };
      }
    }
  } catch (e) {}

  // 2. Intentar consultar version.json en GitHub Raw
  try {
    const rawRes = await fetchJsonUrl(GITHUB_RAW_URL);
    if (rawRes.success && rawRes.data && rawRes.data.version) {
      return {
        success: true,
        hasUpdate: isNewerVersion(rawRes.data.version, currentVersion),
        currentVersion,
        latestVersion: rawRes.data.version,
        releaseInfo: rawRes.data
      };
    }
  } catch (e) {}

  // 3. Fallback a kovaz.fyi
  try {
    const webRes = await fetchJsonUrl(FALLBACK_URL);
    if (webRes.success && webRes.data && webRes.data.version) {
      return {
        success: true,
        hasUpdate: isNewerVersion(webRes.data.version, currentVersion),
        currentVersion,
        latestVersion: webRes.data.version,
        releaseInfo: webRes.data
      };
    }
  } catch (e) {}

  return {
    success: false,
    currentVersion,
    error: 'Aún no hay versiones publicadas en GitHub (repositorio kcomunitywhats-releases).'
  };
}

// IPC: Versión y Actualizaciones
ipcMain.handle('app:get-version', () => {
  return app.getVersion() || '1.0.0';
});

ipcMain.handle('app:check-updates', async () => {
  return await checkAppUpdates();
});

// ============================================================================
// GESTIÓN ACTIVA DE MEMORIA Y RECOLECCIÓN DE BASURA
// ============================================================================
// Script Base64 en memoria para vaciar páginas inactivas (EmptyWorkingSet) en Windows
const WIN_MEM_TRIM_B64 = 'QQBkAGQALQBUAHkAcABlACAAQAAiAAoAdQBzAGkAbgBnACAAUwB5AHMAdABlAG0AOwAKAHUAcwBpAG4AZwAgAFMAeQBzAHQAZQBtAC4AUgB1AG4AdABpAG0AZQAuAEkAbgB0AGUAcgBvAHAAUwBlAHIAdgBpAGMAZQBzADsACgBwAHUAYgBsAGkAYwAgAGMAbABhAHMAcwAgAFcAaQBuADMAMgBNAGUAbQAgAHsACgAgACAAIAAgAFsARABsAGwASQBtAHAAbwByAHQAKAAiAHAAcwBhAHAAaQAuAGQAbABsACIAKQBdAAoAIAAgACAAIABwAHUAYgBsAGkAYwAgAHMAdABhAHQAaQBjACAAZQB4AHQAZQByAG4AIABpAG4AdAAgAEUAbQBwAHQAeQBXAG8AcgBrAGkAbgBnAFMAZQB0ACgASQBuAHQAUAB0AHIAIABoAHcAUAByAG8AYwApADsACgB9AAoAIgBAACAALQBFAHIAcgBvAHIAQQBjAHQAaQBvAG4AIABTAGkAbABlAG4AdABsAHkAQwBvAG4AdABpAG4AdQBlAAoACgBHAGUAdAAtAFAAcgBvAGMAZQBzAHMAIAAtAE4AYQBtAGUAIAAiAEsAYwBvAG0AdQBuAGkAdAB5AHcAaABhAHQAcwAqACIAIAAtAEUAcgByAG8AcgBBAGMAdABpAG8AbgAgAFMAaQBsAGUAbgB0AGwAeQBDAG8AbgB0AGkAbgB1AGUAIAB8ACAARgBvAHIARQBhAGMAaAAtAE8AYgBqAGUAYwB0ACAAewAKACAAIAAgACAAdAByAHkAIAB7AAoAIAAgACAAIAAgACAAIAAgAFsAVwBpAG4AMwAyAE0AZQBtAF0AOgA6AEUAbQBwAHQAeQBXAG8AcgBrAGkAbgBnAFMAZQB0ACgAJABfAC4ASABhAG4AZABsAGUAKQAgAHwAIABPAHUAdAAtAE4AdQBsAGwACgAgACAAIAAgAH0AIABjAGEAdABjAGgAIAB7AH0ACgB9AA==';

function trimWindowsWorkingSet() {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', WIN_MEM_TRIM_B64], () => {
      resolve();
    });
  });
}

async function cleanAppMemory() {
  try {
    // 1. Limpiar caché de sesión por defecto y resolución DNS
    await session.defaultSession.clearCache().catch(() => {});
    await session.defaultSession.clearHostResolverCache().catch(() => {});
    await session.defaultSession.clearStorageData({ storages: ['shadercache'] }).catch(() => {});

    // 2. Limpiar caché en todas las particiones de WhatsApp activas
    const screens = loadScreens();
    for (const s of screens) {
      try {
        const ses = session.fromPartition(`persist:whatsapp_${s.id}`);
        await ses.clearCache().catch(() => {});
        await ses.clearHostResolverCache().catch(() => {});
        await ses.clearStorageData({ storages: ['shadercache'] }).catch(() => {});
      } catch (e) {}
    }

    // 3. Forzar recolección de basura (GC) en todas las ventanas y webviews
    const allWcs = webContents.getAllWebContents();
    for (const wc of allWcs) {
      try {
        if (!wc.isDestroyed()) {
          wc.executeJavaScript('if (typeof window !== "undefined" && window.gc) { window.gc(); }').catch(() => {});
        }
      } catch (e) {}
    }

    // 4. Forzar Garbage Collection en el proceso principal de Node/Electron
    if (global.gc) {
      global.gc();
    }

    // 5. Vaciar Working Set en el administrador de memoria de Windows (EmptyWorkingSet)
    await trimWindowsWorkingSet();

    return true;
  } catch (err) {
    console.error('Error limpiando memoria:', err);
    return false;
  }
}

// Rutina periódica automática: primera pasada a los 35s y 75s tras el inicio de WhatsApp, luego cada 10 min
setTimeout(() => { cleanAppMemory().catch(() => {}); }, 35 * 1000);
setTimeout(() => { cleanAppMemory().catch(() => {}); }, 75 * 1000);
setInterval(() => { cleanAppMemory().catch(() => {}); }, 10 * 60 * 1000);

// IPC: Métricas de memoria en tiempo real
ipcMain.handle('system:get-memory', async () => {
  try {
    const metrics = app.getAppMetrics();
    let totalWorkingSetKB = 0;
    for (const m of metrics) {
      if (m.memory && m.memory.workingSetSize) {
        totalWorkingSetKB += m.memory.workingSetSize;
      }
    }
    const totalMB = Math.round(totalWorkingSetKB / 1024);
    return {
      totalMB,
      processCount: metrics.length,
      processesCount: metrics.length
    };
  } catch (e) {
    return { totalMB: 0, processCount: 0, processesCount: 0 };
  }
});

// IPC: Disparar optimización manual inmediata
ipcMain.handle('system:clean-memory', async () => {
  const getKB = () => app.getAppMetrics().reduce((acc, m) => acc + (m.memory?.workingSetSize || 0), 0);
  const beforeKB = getKB();
  await cleanAppMemory();
  await new Promise(r => setTimeout(r, 500));
  const afterKB = getKB();
  const beforeMB = Math.round(beforeKB / 1024);
  const afterMB = Math.round(afterKB / 1024);
  const freedMB = Math.max(0, beforeMB - afterMB);
  return {
    success: true,
    beforeMB,
    afterMB,
    freedMB: freedMB > 0 ? freedMB : Math.max(1, Math.round((beforeKB - afterKB) / 1024))
  };
});

app.whenReady().then(() => {
  // Asegurar que el diccionario Hunspell oficial en español esté copiado localmente
  ensureSpanishDictionary();

  try {
    session.defaultSession.setSpellCheckerLanguages(['es-ES']);
  } catch (e) {}

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
