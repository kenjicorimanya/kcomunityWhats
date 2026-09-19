const https = require('https');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const OWNER = 'kenjicorimanya';
const REPO = 'kcomunityWhats';
const TOKEN_FILE = path.join(__dirname, '..', '.github_token');

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function getGitHubToken() {
  if (fs.existsSync(TOKEN_FILE)) {
    const token = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    if (token) return token;
  }

  console.log('\n======================================================');
  console.log('       AUTENTICACIÓN CON TU CUENTA DE GITHUB');
  console.log('======================================================');
  console.log('Para subir archivos automáticamente a tu repositorio');
  console.log('necesitamos tu Token Personal de GitHub (se guarda solo en tu PC).');
  console.log('\nPuedes generarlo en 30 segundos en este enlace directo:');
  console.log('👉 https://github.com/settings/tokens/new');
  console.log('\n1. Pon de nombre: Kcomunitywhats');
  console.log('2. Marca la casilla: [x] repo');
  console.log('3. Haz clic en "Generate token" al final.');
  console.log('======================================================\n');

  const token = await askQuestion('Pega aquí tu GitHub Token (empieza por ghp_...): ');
  if (!token) {
    console.error('❌ Token requerido para subir a GitHub.');
    process.exit(1);
  }

  fs.writeFileSync(TOKEN_FILE, token, 'utf8');
  console.log('✅ Token guardado de forma segura en .github_token\n');
  return token;
}

function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, rawData: data });
        }
      });
    });

    req.on('error', err => reject(err));

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function uploadAsset(uploadUrlTemplate, filePath, token) {
  const uploadUrl = uploadUrlTemplate.split('{')[0] + '?name=' + encodeURIComponent(path.basename(filePath));
  const parsed = new URL(uploadUrl);
  const stats = fs.statSync(filePath);
  const totalBytes = stats.size;

  console.log(`\nSubiendo instalador: ${path.basename(filePath)} (${(totalBytes / 1024 / 1024).toFixed(2)} MB)...`);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Kcomunitywhats-Publisher',
        'Content-Type': 'application/octet-stream',
        'Content-Length': totalBytes
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ ok: true });
          }
        } else {
          reject(new Error(`Error al subir archivo a GitHub (HTTP ${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', err => reject(err));

    const readStream = fs.createReadStream(filePath);
    let uploadedBytes = 0;
    let lastPercent = 0;

    readStream.on('data', chunk => {
      uploadedBytes += chunk.length;
      const percent = Math.round((uploadedBytes / totalBytes) * 100);
      if (percent >= lastPercent + 10 || percent === 100) {
        lastPercent = percent;
        process.stdout.write(`Progreso de subida: ${percent}%\r`);
      }
    });

    readStream.pipe(req);
  });
}

async function main() {
  try {
    const token = await getGitHubToken();

    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const version = pkg.version || '1.0.0';
    const tag = `v${version}`;

    let manifest = { title: `Kcomunitywhats ${tag}`, changelog: ['Mejoras de rendimiento y estabilidad.'] };
    const manifestPath = path.join(__dirname, '..', 'version.json');
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch (e) {}
    }

    const title = manifest.title || `Kcomunitywhats ${tag}`;
    const body = Array.isArray(manifest.changelog) 
      ? manifest.changelog.map(c => `• ${c}`).join('\n') 
      : (manifest.notes || 'Actualización de Kcomunitywhats Desktop.');

    console.log(`\n======================================================`);
    console.log(`Publicando Release automática en GitHub: ${OWNER}/${REPO}`);
    console.log(`Versión: ${tag}`);
    console.log(`Título:  ${title}`);
    console.log(`======================================================\n`);

    // 1. Crear el Release en GitHub
    const releasePayload = JSON.stringify({
      tag_name: tag,
      target_commitish: 'main',
      name: title,
      body: body,
      draft: false,
      prerelease: false
    });

    const releaseRes = await httpsRequest({
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/releases`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Kcomunitywhats-Publisher',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(releasePayload)
      }
    }, releasePayload);

    let release = releaseRes.data;
    if (releaseRes.statusCode === 422) {
      console.log(`ℹ️ La versión ${tag} ya existía en GitHub. Obteniendo información...`);
      const getRes = await httpsRequest({
        hostname: 'api.github.com',
        path: `/repos/${OWNER}/${REPO}/releases/tags/${tag}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Kcomunitywhats-Publisher',
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      release = getRes.data;
    } else if (releaseRes.statusCode < 200 || releaseRes.statusCode >= 300) {
      throw new Error(`Error al crear release en GitHub (HTTP ${releaseRes.statusCode}): ${JSON.stringify(release)}`);
    }

    console.log(`✅ Release creada con éxito en GitHub: ${release.html_url}`);

    // 2. Subir el ejecutable Kcomunitywhats_Setup.exe
    const exePath = path.join(__dirname, '..', 'PAQUETE_INSTALACION_CLIENTE', 'Kcomunitywhats_Setup.exe');
    if (!fs.existsSync(exePath)) {
      throw new Error(`No se encontró el instalador en: ${exePath}. Asegúrate de compilar primero.`);
    }

    if (release.upload_url) {
      await uploadAsset(release.upload_url, exePath, token);
      console.log('\n\n🎉 ¡INSTALADOR SUBIDO DIRECTAMENTE A GITHUB CON ÉXITO!');
      console.log(`🔗 Enlace de descarga oficial de GitHub:`);
      console.log(`   https://github.com/${OWNER}/${REPO}/releases/download/${tag}/Kcomunitywhats_Setup.exe`);
      console.log(`\nTodos tus clientes recibirán el aviso de actualización automáticamente.`);
    } else {
      console.log('⚠️ No se obtuvo upload_url de GitHub.');
    }

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    process.exit(1);
  }
}

main();
