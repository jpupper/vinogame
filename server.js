// Simple Express server to serve the VinoGame app and persist panel-config.json
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = Number(process.env.PORT) || 4353; // Requested port

// Parse JSON bodies (increase limit to tolerate larger configs)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Favicon handler to prevent 404 on /favicon.ico
app.get('/favicon.ico', (req, res) => {
  const favPath = path.join(__dirname, 'public', 'img', 'logo', 'logo.png');
  if (fs.existsSync(favPath)) {
    res.type('image/png');
    return res.sendFile(favPath);
  }
  res.status(204).end();
});

// Serve static assets from /public (maps /, /index.html, /js, /css, /img, /sh, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html from /public
app.get('/', (req, res) => {
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

function resolvePanelConfigPath() {
  const publicCfg = path.join(__dirname, 'public', 'panel-config.json');
  if (fs.existsSync(publicCfg)) return publicCfg;
  return path.join(__dirname, 'panel-config.json');
}

// Cada juego tiene su propio panel-config.json. Sin ?game= es el remasterizado.
// juegovino1 (version antigua) escribe dentro de su propia carpeta para no pisar el tuning del remasterizado.
const GAME_DIRS = {
  juegovino1: path.join(__dirname, 'public', 'juegovino1')
};

function gameDir(game) {
  const key = String(game || '').toLowerCase();
  return GAME_DIRS[key] || null;
}

// Serve panel-config.json (prefers public/panel-config.json, falls back to root)
app.get('/panel-config.json', (req, res) => {
  const filePath = resolvePanelConfigPath();
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.status(404).json({ error: 'panel-config.json not found' });
      return;
    }
    res.sendFile(filePath);
  });
});

// Optional alias for legacy name panel-control.json
app.get('/panel-control.json', (req, res) => {
  const filePath = resolvePanelConfigPath();
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.status(404).json({ error: 'panel-control.json alias not found' });
      return;
    }
    res.sendFile(filePath);
  });
});

// ========= Asset upload (images) =========
const allowedCategories = new Set(['objects', 'badItems', 'backgrounds']);
function ensureDirExists(dirPath) {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (e) {
    // no-op
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.params.category;
    if (!allowedCategories.has(category)) {
      return cb(new Error('Invalid category'));
    }
    const dir = gameDir(req.query.game);
    const dest = dir
      ? path.join(dir, 'img', 'custom', category)
      : path.join(__dirname, 'public', 'img', 'custom', category);
    ensureDirExists(dest);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const stamp = Date.now();
    cb(null, `${stamp}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB per file
  fileFilter: (req, file, cb) => {
    if ((file.mimetype || '').startsWith('image/')) cb(null, true);
    else cb(new Error('Only image uploads are allowed'));
  }
});

app.post('/api/upload-assets/:category', upload.array('files', 24), (req, res) => {
  try {
    const category = req.params.category;
    if (!allowedCategories.has(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    const paths = (req.files || []).map(f => {
      const rel = path.relative(path.join(__dirname, 'public'), f.path);
      return '/' + rel.replace(/\\/g, '/'); // web path
    });
    return res.json({ ok: true, paths });
  } catch (e) {
    console.error('Upload error:', e);
    return res.status(500).json({ error: 'Upload failed' });
  }
});

// Save configuration sent from the front-end into both public/panel-config.json and root panel-config.json
app.post('/api/save-config', (req, res) => {
  try {
    const config = req.body || {};
    if (typeof config !== 'object' || Array.isArray(config)) {
      return res.status(400).json({ error: 'Invalid JSON format' });
    }
    const dir = gameDir(req.query.game);
    const publicFilePath = dir
      ? path.join(dir, 'panel-config.json')
      : path.join(__dirname, 'public', 'panel-config.json');
    const rootFilePath = dir ? null : path.join(__dirname, 'panel-config.json');
    const dataStr = JSON.stringify(config, null, 2);

    fs.writeFile(publicFilePath, dataStr, 'utf8', (err) => {
      if (err) {
        console.error(`Failed writing ${publicFilePath}:`, err);
        return res.status(500).json({ error: 'Failed to save configuration' });
      }
      // Keep root panel-config.json synced as well (solo para el remasterizado)
      if (rootFilePath) fs.writeFile(rootFilePath, dataStr, 'utf8', () => {});
      console.log(`panel-config.json actualizado en ${path.relative(__dirname, publicFilePath)}`);
      return res.json({ ok: true });
    });
  } catch (e) {
    console.error('Error saving configuration:', e);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🍷 Deli & Wine — servidor local en:`);
  console.log(`   http://localhost:${PORT}/                        galería (index.html)`);
  console.log(`   http://localhost:${PORT}/juegovino.html           Deli & Wine 1 (original)`);
  console.log(`   http://localhost:${PORT}/juegovinoremastered.html Deli & Wine Remastered`);
  console.log(`   http://localhost:${PORT}/servirvino.html          Serve Wine`);
  console.log(`   Estáticos desde /public`);
  console.log(`==================================================`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`❌ El puerto ${PORT} ya está en uso.`);
  } else {
    console.error('❌ Error al iniciar el servidor:', err);
  }
});
