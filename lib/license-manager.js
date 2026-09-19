const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');

const SECRET_KEY = 'K0vaz_Wh@ts@pp_C0mmun1ty_S3cur3_K3y_2026';
const KNOWN_SECRETS = [
  'KoVaz_KeySender_Pro_2026_SecKey_#9981!',
  'K0vaz_Wh@ts@pp_C0mmun1ty_S3cur3_K3y_2026',
  'KoVaz_CloudBilling_2026_SecKey_#5544!',
  'KoVaz_POS_KeyPlus_2026_SecKey_#7712$',
  'KoVaz_Control_Horario_2026_SecKey_#4431*',
  'KoVaz_Factoria_IA_2026_SecKey_#8820@'
];
const TRIAL_DAYS = 7;

function compareHwid(hwidA, hwidB) {
  if (!hwidA || !hwidB) return false;
  const upperA = String(hwidA).toUpperCase().trim();
  const upperB = String(hwidB).toUpperCase().trim();
  if (upperA === 'UNIVERSAL' || upperA === 'UNIV' || upperA === '*' || upperA === 'AUTO_BIND') return true;
  if (upperB === 'UNIVERSAL' || upperB === 'UNIV' || upperB === '*' || upperB === 'AUTO_BIND') return true;

  const cleanA = upperA.replace(/[^A-Z0-9]/g, '');
  const cleanB = upperB.replace(/[^A-Z0-9]/g, '');

  if (cleanA === cleanB) return true;
  if (cleanA.length >= 8 && cleanB.length >= 8) {
    return cleanA.endsWith(cleanB) || cleanB.endsWith(cleanA);
  }
  if (cleanA.length >= 4 && cleanB.length >= 4) {
    return cleanA.slice(-4) === cleanB.slice(-4);
  }
  return false;
}

class LicenseManager {
  constructor(userDataPath) {
    this.userDataPath = userDataPath || path.join(os.homedir(), '.kcomunitywhats');
    this._cachedHwid = null;
    if (!fs.existsSync(this.userDataPath)) {
      try {
        fs.mkdirSync(this.userDataPath, { recursive: true });
      } catch (e) {
        console.error('Error creating userData directory:', e);
      }
    }
    this.dataFile = path.join(this.userDataPath, 'license_info.enc');
  }

  // Obtener Machine/Hardware ID único y constante (Formato estándar KoVaz: KVZ-HWID-XXXX-XXXX-XXXX)
  getMachineId() {
    if (this._cachedHwid) return this._cachedHwid;

    const parts = [os.arch(), os.platform()];
    const cpus = os.cpus();
    if (cpus && cpus.length > 0) {
      parts.push(cpus[0].model.trim());
      parts.push(cpus.length.toString());
    }
    parts.push(os.hostname());

    try {
      if (os.platform() === 'win32') {
        try {
          const wmicOut = execSync('wmic csproduct get uuid', {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore'],
            timeout: 2000
          });
          const lines = wmicOut.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length > 1 && lines[1] && !lines[1].toLowerCase().includes('uuid')) {
            parts.push(lines[1]);
          }
        } catch (e1) {
          try {
            const psOut = execSync('powershell -NoProfile -Command "(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID"', {
              encoding: 'utf-8',
              stdio: ['pipe', 'pipe', 'ignore'],
              timeout: 2500
            });
            const uuid = psOut.trim();
            if (uuid && uuid.length > 8) parts.push(uuid);
          } catch (e2) {}
        }
      }
    } catch (e) {}

    try {
      const netInterfaces = os.networkInterfaces();
      for (const name of Object.keys(netInterfaces)) {
        const list = netInterfaces[name];
        if (list) {
          for (const item of list) {
            if (!item.internal && item.mac && item.mac !== '00:00:00:00:00:00') {
              parts.push(item.mac.toLowerCase());
              break;
            }
          }
        }
      }
    } catch (err) {}

    const raw = parts.join('::');
    const hash = crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
    this._cachedHwid = `KVZ-HWID-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
    return this._cachedHwid;
  }

  // Cifrado simple para persistir estado local (anti-edición directa)
  encryptData(obj) {
    const json = JSON.stringify(obj);
    const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(SECRET_KEY, 'salt', 32), Buffer.alloc(16, 0));
    let encrypted = cipher.update(json, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  decryptData(encryptedHex) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-cbc', crypto.scryptSync(SECRET_KEY, 'salt', 32), Buffer.alloc(16, 0));
      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (e) {
      return null;
    }
  }

  loadLocalData() {
    if (fs.existsSync(this.dataFile)) {
      try {
        const content = fs.readFileSync(this.dataFile, 'utf8').trim();
        const data = this.decryptData(content);
        if (data) return data;
      } catch (e) {
        console.error('Error reading license file:', e);
      }
    }

    // Inicializar primera ejecución
    const initialData = {
      installedAt: Date.now(),
      lastSeenAt: Date.now(),
      licenseKey: null,
      machineId: this.getMachineId()
    };
    this.saveLocalData(initialData);
    return initialData;
  }

  saveLocalData(data) {
    try {
      const enc = this.encryptData(data);
      fs.writeFileSync(this.dataFile, enc, 'utf8');
    } catch (e) {
      console.error('Error saving license data:', e);
    }
  }

  /**
   * Validar una clave de licencia.
   * Soporta:
   * 1. Nuevo Estándar KoVaz License Hub: KCW-<payload_b64url>.<firma_hmac> (con correo, nombre, plan, módulos, etc.)
   * 2. Formato Heredado: KCOM-TYPE-HWID-EXPDATE-SIGNATURE
   */
  validateLicenseKey(key) {
    if (!key || typeof key !== 'string') return { valid: false, reason: 'Clave vacía o no válida' };
    const cleanKey = key.trim();

    // 1. Verificación formato KoVaz License Hub (con separador de punto '.')
    if (cleanKey.includes('.')) {
      return this.validateHubLicenseKey(cleanKey);
    }

    // 2. Verificación formato heredado (KCOM-TYPE-HWID-EXPDATE-SIG)
    return this.validateLegacyLicenseKey(cleanKey);
  }

  validateHubLicenseKey(key) {
    try {
      const lastDot = key.lastIndexOf('.');
      if (lastDot === -1) {
        return { valid: false, reason: 'Formato de clave inválido (falta firma)' };
      }
      const keyBody = key.substring(0, lastDot);
      const providedSig = key.substring(lastDot + 1).toUpperCase();

      const dashIndex = keyBody.indexOf('-');
      if (dashIndex === -1) {
        return { valid: false, reason: 'Prefijo de programa no encontrado en la clave' };
      }

      const prefix = keyBody.substring(0, dashIndex + 1);
      const payloadB64 = keyBody.substring(dashIndex + 1);

      // Decodificar payload
      let payload;
      try {
        const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8');
        payload = JSON.parse(payloadJson);
      } catch (e) {
        return { valid: false, reason: 'Formato de payload no válido' };
      }

      // Verificar firma HMAC-SHA256 con los secretos conocidos
      let isSigValid = false;
      for (const secret of KNOWN_SECRETS) {
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(keyBody);
        const expectedSigFull = hmac.digest('hex').toUpperCase();

        const hmacAlt = crypto.createHmac('sha256', secret);
        hmacAlt.update(payloadB64);
        const expectedSigAlt = hmacAlt.digest('hex').toUpperCase();

        if (
          providedSig === expectedSigFull.substring(0, 16) ||
          providedSig === expectedSigFull.substring(0, 12) ||
          providedSig === expectedSigAlt.substring(0, 16) ||
          providedSig === expectedSigAlt.substring(0, 12) ||
          expectedSigFull.startsWith(providedSig)
        ) {
          isSigValid = true;
          break;
        }
      }

      if (!isSigValid) {
        return { valid: false, reason: 'Firma de licencia no válida o manipulada' };
      }

      // Verificar programa
      const validPrograms = ['kcomunity_whats', 'kcomunitywhats', 'keysender_pro', 'keysender', 'general', 'whatsapp'];
      if (payload.pid && !validPrograms.includes(payload.pid.toLowerCase())) {
        return { valid: false, reason: `Esta licencia pertenece a otro sistema (${payload.pid})` };
      }

      // Verificar HWID
      const currentHwid = this.getMachineId();
      const targetHwid = payload.h || payload.hwid || 'AUTO_BIND';
      if (!compareHwid(targetHwid, currentHwid)) {
        return {
          valid: false,
          reason: `Esta licencia está asignada a otro equipo (${targetHwid}). Este equipo es: ${currentHwid}`,
          hwidMismatch: true
        };
      }

      // Verificar expiración
      const nowSec = Math.floor(Date.now() / 1000);
      const expSec = payload.e !== undefined ? payload.e : payload.expiresAt;
      const isLifetime = payload.p === 'LIFETIME' || expSec === 0 || expSec === null;

      if (!isLifetime && nowSec > expSec) {
        return {
          valid: false,
          reason: `La licencia expiró el ${new Date(expSec * 1000).toLocaleDateString()}`,
          expired: true
        };
      }

      let daysRemaining = 'Vitalicia';
      if (!isLifetime) {
        daysRemaining = Math.max(0, Math.ceil((expSec - nowSec) / 86400));
      }

      return {
        valid: true,
        source: 'KOVAZ_HUB',
        licenseId: payload.lid || 'LIC-HUB',
        clientName: payload.c || 'Cliente',
        clientEmail: payload.m || '',
        phone: payload.tel || '',
        plan: payload.p || 'PRO',
        modules: payload.mod || [],
        isLifetime,
        daysRemaining,
        expiryDate: expSec ? new Date(expSec * 1000).toISOString() : null,
        machineBound: targetHwid !== 'UNIVERSAL' && targetHwid !== '*' && targetHwid !== 'AUTO_BIND'
      };
    } catch (e) {
      return { valid: false, reason: 'Error procesando la clave: ' + e.message };
    }
  }

  validateLegacyLicenseKey(key) {
    const cleanKey = key.toUpperCase();
    const parts = cleanKey.split('-');
    if (parts.length !== 5 || parts[0] !== 'KCOM') {
      return { valid: false, reason: 'Formato de clave no reconocido' };
    }

    const [prefix, type, hwidPart, expPart, signature] = parts;

    // Verificar firma criptográfica
    const payload = `${prefix}-${type}-${hwidPart}-${expPart}`;
    const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex').slice(0, 8).toUpperCase();

    if (signature !== expectedSig) {
      return { valid: false, reason: 'Firma de licencia no válida o alterada' };
    }

    // Verificar si la clave está atada a hardware
    const currentHwid = this.getMachineId();
    const currentHwidPart = currentHwid.replace(/[^A-Z0-9]/g, '').slice(-4);

    if (hwidPart !== 'UNIV' && hwidPart !== currentHwidPart) {
      return { valid: false, reason: 'Esta licencia pertenece a otro equipo' };
    }

    // Verificar expiración
    let isLifetime = false;
    let expiryDate = null;

    if (expPart === '00000000' || type === 'LIFE') {
      isLifetime = true;
    } else {
      const year = parseInt(expPart.slice(0, 4), 10);
      const month = parseInt(expPart.slice(4, 6), 10) - 1;
      const day = parseInt(expPart.slice(6, 8), 10);
      expiryDate = new Date(year, month, day, 23, 59, 59);

      if (isNaN(expiryDate.getTime()) || Date.now() > expiryDate.getTime()) {
        return { valid: false, reason: 'La licencia ha expirado', expired: true };
      }
    }

    return {
      valid: true,
      source: 'LEGACY',
      clientName: 'Cliente KoVaz',
      clientEmail: '',
      type,
      plan: type,
      isLifetime,
      expiryDate: expiryDate ? expiryDate.toISOString() : null,
      machineBound: hwidPart !== 'UNIV'
    };
  }

  // Obtener estado completo del sistema de licencias para la UI
  getStatus() {
    const data = this.loadLocalData();
    const now = Date.now();
    const machineId = this.getMachineId();

    // Verificación de alteración del reloj del sistema (anti-trampas)
    if (now < data.lastSeenAt - 1000 * 60 * 60 * 2) {
      return {
        state: 'BLOCKED_TAMPER',
        isLocked: true,
        message: 'Alteración de fecha del sistema detectada.',
        machineId
      };
    }

    // Actualizar último timestamp
    data.lastSeenAt = now;
    this.saveLocalData(data);

    // Si ya tiene una clave guardada, validarla
    if (data.licenseKey) {
      const validation = this.validateLicenseKey(data.licenseKey);
      if (validation.valid) {
        return {
          state: 'ACTIVATED',
          isLocked: false,
          licenseKey: data.licenseKey,
          isLifetime: validation.isLifetime,
          expiryDate: validation.expiryDate,
          daysRemaining: validation.daysRemaining,
          clientName: validation.clientName || 'Cliente',
          clientEmail: validation.clientEmail || '',
          phone: validation.phone || '',
          plan: validation.plan || 'PRO',
          modules: validation.modules || [],
          type: validation.type || validation.plan,
          source: validation.source,
          machineId
        };
      }
    }

    // Si no tiene licencia válida, calcular los 7 días de prueba
    const elapsedMs = now - data.installedAt;
    const totalTrialMs = TRIAL_DAYS * 24 * 60 * 60 * 1000;
    const remainingMs = totalTrialMs - elapsedMs;

    if (remainingMs <= 0) {
      return {
        state: 'TRIAL_EXPIRED',
        isLocked: true,
        daysRemaining: 0,
        hoursRemaining: 0,
        message: 'Tu período de prueba de 7 días ha finalizado.',
        redirectUrl: 'https://kovaz.fyi',
        machineId
      };
    }

    const daysRemaining = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
    const hoursRemaining = Math.max(1, Math.ceil(remainingMs / (1000 * 60 * 60)));

    return {
      state: 'TRIAL_ACTIVE',
      isLocked: false,
      daysRemaining,
      hoursRemaining,
      trialStartedAt: new Date(data.installedAt).toISOString(),
      machineId
    };
  }

  activateKey(key) {
    const validation = this.validateLicenseKey(key);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    const data = this.loadLocalData();
    data.licenseKey = key.trim();
    if (validation.clientName) data.clientName = validation.clientName;
    if (validation.clientEmail) data.clientEmail = validation.clientEmail;
    if (validation.phone) data.phone = validation.phone;
    if (validation.plan) data.plan = validation.plan;
    if (validation.modules) data.modules = validation.modules;
    if (validation.isLifetime !== undefined) data.isLifetime = validation.isLifetime;
    if (validation.expiryDate) data.expiryDate = validation.expiryDate;
    this.saveLocalData(data);

    return { success: true, validation, status: this.getStatus() };
  }
}

module.exports = {
  LicenseManager,
  SECRET_KEY,
  compareHwid
};
