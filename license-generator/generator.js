#!/usr/bin/env node

/**
 * Codificador y Generador de Licencias - Kcomunitywhats
 * Permite crear licencias vitalicias o con límite de tiempo, universales o atadas al ID de equipo del cliente.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Misma clave secreta que el cliente de la aplicación
const SECRET_KEY = 'K0vaz_Wh@ts@pp_C0mmun1ty_S3cur3_K3y_2026';
const LOG_FILE = path.join(__dirname, 'licencias_generadas.log');

function padZero(n) {
  return n < 10 ? '0' + n : '' + n;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = padZero(date.getMonth() + 1);
  const d = padZero(date.getDate());
  return `${y}${m}${d}`;
}

/**
 * Genera una clave de licencia válida
 * @param {string} type - 'LIFE' | '1YEAR' | '6MON' | '1MON' | 'CUSTOM'
 * @param {string} hwid - 'UNIV' o el ID de hardware del cliente (ej. KHWID-A1B2-C3D4-E5F6)
 * @param {number|null} days - Días de validez si no es LIFE
 * @param {string} clientName - Nombre o nota del cliente
 */
function generateKey(type, hwid = 'UNIV', days = null, clientName = 'Cliente') {
  let typeCode = 'PRO';
  let expDateStr = '00000000';
  let expReadable = 'Permanente (Vitalicia)';

  const cleanHwid = (hwid || '').trim().toUpperCase();
  let hwidCode = 'UNIV';

  if (cleanHwid && cleanHwid !== 'UNIV' && cleanHwid !== 'UNIVERSAL') {
    // Tomar los últimos 4 caracteres alfanuméricos del HWID
    const alphanumeric = cleanHwid.replace(/[^A-Z0-9]/g, '');
    if (alphanumeric.length >= 4) {
      hwidCode = alphanumeric.slice(-4);
    }
  }

  if (type === 'LIFE') {
    typeCode = 'LIFE';
    expDateStr = '00000000';
  } else {
    let addDays = 365;
    if (type === '1YEAR') {
      typeCode = '1YR';
      addDays = 365;
    } else if (type === '6MON') {
      typeCode = '6MO';
      addDays = 180;
    } else if (type === '1MON') {
      typeCode = '1MO';
      addDays = 30;
    } else if (type === 'CUSTOM' && days) {
      typeCode = 'CUS';
      addDays = parseInt(days, 10) || 30;
    }

    const expDate = new Date();
    expDate.setDate(expDate.getDate() + addDays);
    expDateStr = formatDate(expDate);
    expReadable = expDate.toLocaleDateString();
  }

  const payload = `KCOM-${typeCode}-${hwidCode}-${expDateStr}`;
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex').slice(0, 8).toUpperCase();

  const fullKey = `${payload}-${signature}`;

  // Registrar en el log de licencias
  const logEntry = `[${new Date().toISOString()}] Cliente: "${clientName}" | Tipo: ${typeCode} | HWID: ${hwid} | Vence: ${expReadable} | Clave: ${fullKey}\n`;
  try {
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
  } catch (e) {
    console.error('No se pudo escribir en el log:', e.message);
  }

  return {
    key: fullKey,
    type: typeCode,
    expiration: expReadable,
    hwidBound: hwidCode !== 'UNIV',
    clientName
  };
}

// Modo interactivo en terminal
function runInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('=====================================================');
  console.log('       GENERADOR DE LICENCIAS - KCOMUNITYWHATS       ');
  console.log('=====================================================\n');

  rl.question('Nombre o nota del cliente: ', (clientName) => {
    console.log('\nSeleccione el tipo de licencia:');
    console.log('  1) Vitalicia (Permanente)');
    console.log('  2) 1 Año (365 días)');
    console.log('  3) 6 Meses (180 días)');
    console.log('  4) 1 Mes (30 días)');
    console.log('  5) Días personalizados');
    rl.question('Opción [1-5] (Por defecto 1): ', (opt) => {
      let type = 'LIFE';
      let customDays = null;

      if (opt === '2') type = '1YEAR';
      else if (opt === '3') type = '6MON';
      else if (opt === '4') type = '1MON';
      else if (opt === '5') {
        type = 'CUSTOM';
      }

      const askDays = (callback) => {
        if (type === 'CUSTOM') {
          rl.question('Ingrese cantidad de días: ', (d) => {
            customDays = parseInt(d, 10) || 30;
            callback();
          });
        } else {
          callback();
        }
      };

      askDays(() => {
        console.log('\n¿Desea atar la licencia a un ID de Equipo (Hardware ID)?');
        console.log('  - Presione ENTER para licencia UNIVERSAL (cualquier PC)');
        console.log('  - O pegue el ID del equipo (ej. KHWID-A1B2-C3D4-E5F6):');
        rl.question('Hardware ID: ', (hwid) => {
          const result = generateKey(type, hwid || 'UNIV', customDays, clientName || 'Cliente');

          console.log('\n=====================================================');
          console.log('           ¡LICENCIA GENERADA CON ÉXITO!             ');
          console.log('=====================================================');
          console.log(`Clave de Activación:  \x1b[32m\x1b[1m${result.key}\x1b[0m`);
          console.log(`Cliente:              ${result.clientName}`);
          console.log(`Vigencia:             ${result.expiration}`);
          console.log(`Equipo Vinculado:     ${result.hwidBound ? hwid : 'Universal (cualquier PC)'}`);
          console.log('=====================================================');
          console.log(`(Guardada en ${path.basename(LOG_FILE)})\n`);

          rl.close();
        });
      });
    });
  });
}

// Ejecución directa
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    // Modo argumentos: node generator.js --type=LIFE --hwid=UNIV --client="Juan"
    let type = 'LIFE';
    let hwid = 'UNIV';
    let days = null;
    let client = 'Cliente CLI';

    args.forEach(arg => {
      if (arg.startsWith('--type=')) type = arg.split('=')[1].toUpperCase();
      if (arg.startsWith('--hwid=')) hwid = arg.split('=')[1];
      if (arg.startsWith('--days=')) days = parseInt(arg.split('=')[1], 10);
      if (arg.startsWith('--client=')) client = arg.split('=')[1];
    });

    const res = generateKey(type, hwid, days, client);
    console.log(res.key);
  } else {
    runInteractive();
  }
}

module.exports = {
  generateKey
};
