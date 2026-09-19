/**
 * Kcomunitywhats - Webview Preload & View Once Unlocker
 * Inyectado dentro de cada Webview de WhatsApp Web.
 * 
 * Funciones:
 * 1. Anti-Throttling: Mantiene WhatsApp Web activo en segundo plano sin pausar sockets.
 * 2. View Once Unlocker: Intercepta y desbloquea imágenes y videos de 'Ver una sola vez'.
 * 3. Descargador Directo: Añade botón para guardar las fotos y videos de 1 vez a la computadora.
 */

(function() {
  // 1. Anti-Throttling y Visibilidad Activa
  try {
    Object.defineProperty(document, 'hidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    Object.defineProperty(document, 'webkitHidden', { get: () => false, configurable: true });
    Object.defineProperty(document, 'webkitVisibilityState', { get: () => 'visible', configurable: true });
    window.addEventListener('visibilitychange', (e) => {
      if (document.hidden) e.stopImmediatePropagation();
    }, true);
  } catch (e) {}

  // 2. Desbloqueo de Fotos y Videos de 'Ver una sola vez' (View Once)
  const viewOnceProps = ['isViewOnce', 'viewOnce', 'isViewOnceV2', 'viewOnceV2'];

  viewOnceProps.forEach((prop) => {
    try {
      Object.defineProperty(Object.prototype, prop, {
        get() {
          return false;
        },
        set(val) {
          // Ignorar cuando WhatsApp intenta marcarlo como true
        },
        configurable: true
      });
    } catch (e) {}
  });

  // Interceptar Object.defineProperty en objetos individuales para evitar que WhatsApp fuerce isViewOnce: true
  const originalDefineProperty = Object.defineProperty;
  Object.defineProperty = function(obj, prop, descriptor) {
    if (viewOnceProps.includes(prop) && descriptor) {
      if ('value' in descriptor) {
        descriptor.value = false;
      }
      if ('get' in descriptor) {
        descriptor.get = () => false;
      }
    }
    return originalDefineProperty.call(this, obj, prop, descriptor);
  };

  // Desempaquetar Protobufs cuando vienen encapsulados en viewOnceMessage
  try {
    Object.defineProperty(Object.prototype, 'viewOnceMessage', {
      get() {
        return this._k_viewOnceMessage;
      },
      set(v) {
        this._k_viewOnceMessage = v;
        if (v && v.message && typeof v.message === 'object') {
          Object.assign(this, v.message);
        }
      },
      configurable: true
    });

    Object.defineProperty(Object.prototype, 'viewOnceMessageV2', {
      get() {
        return this._k_viewOnceMessageV2;
      },
      set(v) {
        this._k_viewOnceMessageV2 = v;
        if (v && v.message && typeof v.message === 'object') {
          Object.assign(this, v.message);
        }
      },
      configurable: true
    });
  } catch (e) {}

  // 3. Caché de Blobs descifrados por WhatsApp Web
  const blobMediaCache = new Map();
  const originalCreateObjectURL = URL.createObjectURL;

  URL.createObjectURL = function(blob) {
    const url = originalCreateObjectURL.call(this, blob);
    try {
      if (blob && blob.type && (blob.type.startsWith('image/') || blob.type.startsWith('video/'))) {
        blobMediaCache.set(url, blob);
      }
    } catch (err) {}
    return url;
  };

  // Función para disparar la descarga de un blob a disco
  function downloadBlobFile(blob, defaultName) {
    try {
      const isVideo = blob.type && blob.type.includes('video');
      const ext = isVideo ? '.mp4' : '.jpg';
      const filename = defaultName || ('WhatsApp_1Vez_' + new Date().toISOString().replace(/[:.]/g, '-') + ext);

      const a = document.createElement('a');
      const tempUrl = originalCreateObjectURL.call(URL, blob);
      a.href = tempUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(tempUrl);
      }, 1500);

      showToastNotification('✅ Imagen descargada con éxito: ' + filename);
    } catch (e) {
      console.error('[Kcomunitywhats] Error descargando blob:', e);
    }
  }

  // Notificación flotante de confirmación dentro del webview
  function showToastNotification(text) {
    let toast = document.getElementById('k-view-once-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'k-view-once-toast';
      toast.style.cssText = 'position: fixed; bottom: 24px; right: 24px; background: #00a884; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; font-weight: 600; padding: 10px 18px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.4); z-index: 9999999; transition: opacity 0.3s ease; pointer-events: none;';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.opacity = '1';
    setTimeout(() => {
      if (toast) toast.style.opacity = '0';
    }, 3000);
  }

  // 4. Inyector de Botón de Descarga en el Visor Multimedia de WhatsApp
  function injectViewerDownloadButton() {
    const viewer = document.querySelector('div[data-animate-media-viewer="true"]') ||
                   document.querySelector('[data-testid="media-viewer-modal"]') ||
                   document.querySelector('div[role="dialog"]');

    if (!viewer) return;

    if (viewer.querySelector('#k-btn-download-media')) return;

    const mediaEl = viewer.querySelector('img[src^="blob:"]') || viewer.querySelector('video[src^="blob:"]');
    if (!mediaEl || !mediaEl.src) return;

    const btn = document.createElement('button');
    btn.id = 'k-btn-download-media';
    btn.innerHTML = '⬇️ Guardar Imagen (1 vez)';
    btn.title = 'Descargar y conservar esta foto de visualización única';
    btn.style.cssText = 'position: absolute; top: 18px; left: 50%; transform: translateX(-50%); background: #25D366; color: #111b21; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; font-weight: 700; padding: 8px 18px; border: none; border-radius: 20px; cursor: pointer; z-index: 9999999; box-shadow: 0 4px 14px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 6px; transition: background 0.2s ease, transform 0.1s ease;';

    btn.onmouseover = () => { btn.style.background = '#1da851'; };
    btn.onmouseout = () => { btn.style.background = '#25D366'; };
    btn.onmousedown = () => { btn.style.transform = 'translateX(-50%) scale(0.96)'; };
    btn.onmouseup = () => { btn.style.transform = 'translateX(-50%) scale(1)'; };

    btn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const blob = blobMediaCache.get(mediaEl.src);
      if (blob) {
        downloadBlobFile(blob);
      } else {
        fetch(mediaEl.src)
          .then(res => res.blob())
          .then(fetchedBlob => downloadBlobFile(fetchedBlob))
          .catch(err => {
            console.error('[Kcomunitywhats] Error al obtener blob del visor:', err);
          });
      }
    };

    viewer.appendChild(btn);
  }

  const domObserver = new MutationObserver(() => {
    injectViewerDownloadButton();
  });

  function startObserver() {
    if (document.body) {
      domObserver.observe(document.body, { childList: true, subtree: true });
      setInterval(injectViewerDownloadButton, 1200);
    } else {
      setTimeout(startObserver, 200);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  console.log('[Kcomunitywhats] View-Once Unlocker y Anti-Throttle listos.');
})();
