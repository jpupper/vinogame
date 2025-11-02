// Simple Express server to serve the VinoGame app and persist panel-config.json
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 4353; // Requested port

// Parse JSON bodies (increase limit to tolerate larger configs)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static assets from /public (maps /js, /css, /img, /sh, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html from project root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve panel-config.json from project root (front loads ./panel-config.json)
app.get('/panel-config.json', (req, res) => {
  const filePath = path.join(__dirname, 'panel-config.json');
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
  const filePath = path.join(__dirname, 'panel-config.json');
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
    const dest = path.join(__dirname, 'public', 'img', 'custom', category);
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

// Save configuration sent from the front-end
app.post('/api/save-config', (req, res) => {
  try {
    const config = req.body || {};
    // Basic validation
    if (typeof config !== 'object' || Array.isArray(config)) {
      return res.status(400).json({ error: 'Invalid JSON format' });
    }
    const filePath = path.join(__dirname, 'panel-config.json');
    const dataStr = JSON.stringify(config, null, 2);

    fs.writeFile(filePath, dataStr, 'utf8', (err) => {
      if (err) {
        console.error('Failed writing panel-config.json:', err);
        return res.status(500).json({ error: 'Failed to save configuration' });
      }
      console.log('panel-config.json updated');
      return res.json({ ok: true });
    });
  } catch (e) {
    console.error('Error saving configuration:', e);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

app.listen(PORT, () => {
  console.log(`VinoGame server running at http://localhost:${PORT}`);
});