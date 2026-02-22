const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Engine = require('../models/Engine');

const router = express.Router();
const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeName = (value = '') => value.trim().replace(/\s+/g, ' ');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e7)}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { files: 10, fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  },
});

const toImagePaths = (files = []) => files.map((f) => `/uploads/${f.filename}`);

const removeFiles = (paths = []) => {
  paths.forEach((relativePath) => {
    const full = path.join(process.cwd(), relativePath.replace(/^\//, ''));
    if (fs.existsSync(full)) fs.unlinkSync(full);
  });
};

const parseArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

router.get('/', async (_req, res) => {
  const engines = await Engine.find().sort({ engineName: 1 });
  res.json(engines);
});

router.get('/search', async (req, res) => {
  const name = normalizeName(req.query.name || '');
  if (!name) return res.status(400).json({ message: 'name query parameter is required.' });

  const engine = await Engine.findOne({ engineName: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } });
  if (!engine) return res.status(404).json({ message: 'Engine not found.' });
  return res.json(engine);
});

router.get('/:id', async (req, res) => {
  const engine = await Engine.findById(req.params.id);
  if (!engine) return res.status(404).json({ message: 'Engine not found.' });
  return res.json(engine);
});

router.post('/', upload.array('images', 10), async (req, res) => {
  const uploaded = toImagePaths(req.files);

  try {
    const engineName = normalizeName(req.body.engineName || '');
    if (!engineName) {
      removeFiles(uploaded);
      return res.status(400).json({ message: 'Engine Name is required.' });
    }

    const duplicate = await Engine.findOne({ engineName: { $regex: `^${escapeRegex(engineName)}$`, $options: 'i' } });
    if (duplicate) {
      removeFiles(uploaded);
      return res.status(409).json({ message: 'Engine name already exists.' });
    }

    const engine = await Engine.create({
      engineName,
      airFilter: req.body.airFilter || '',
      lastLoadedTestbed: req.body.lastLoadedTestbed || '',
      remarks: req.body.remarks || '',
      images: uploaded,
    });

    return res.status(201).json(engine);
  } catch (error) {
    removeFiles(uploaded);
    return res.status(400).json({ message: error.message || 'Unable to create engine.' });
  }
});

router.put('/:id', upload.array('images', 10), async (req, res) => {
  const uploaded = toImagePaths(req.files);

  try {
    const engine = await Engine.findById(req.params.id);
    if (!engine) {
      removeFiles(uploaded);
      return res.status(404).json({ message: 'Engine not found.' });
    }

    const incomingName = req.body.engineName ? normalizeName(req.body.engineName) : engine.engineName;
    if (!incomingName) {
      removeFiles(uploaded);
      return res.status(400).json({ message: 'Engine Name cannot be empty.' });
    }

    if (incomingName.toLowerCase() !== engine.engineName.toLowerCase()) {
      const duplicate = await Engine.findOne({
        _id: { $ne: engine._id },
        engineName: { $regex: `^${escapeRegex(incomingName)}$`, $options: 'i' },
      });
      if (duplicate) {
        removeFiles(uploaded);
        return res.status(409).json({ message: 'Engine name already exists.' });
      }
    }

    const keepImages = parseArray(req.body.keepImages);
    const kept = keepImages.filter((img) => engine.images.includes(img));
    const removed = engine.images.filter((img) => !kept.includes(img));
    const nextImages = [...kept, ...uploaded];

    if (nextImages.length > 10) {
      removeFiles(uploaded);
      return res.status(400).json({ message: 'Maximum 10 images are allowed per engine.' });
    }

    removeFiles(removed);

    engine.engineName = incomingName;
    engine.airFilter = req.body.airFilter ?? engine.airFilter;
    engine.lastLoadedTestbed = req.body.lastLoadedTestbed ?? engine.lastLoadedTestbed;
    engine.remarks = req.body.remarks ?? engine.remarks;
    engine.images = nextImages;

    await engine.save();
    return res.json(engine);
  } catch (error) {
    removeFiles(uploaded);
    return res.status(400).json({ message: error.message || 'Unable to update engine.' });
  }
});

router.delete('/:id', async (req, res) => {
  const engine = await Engine.findById(req.params.id);
  if (!engine) return res.status(404).json({ message: 'Engine not found.' });
  removeFiles(engine.images);
  await engine.deleteOne();
  return res.json({ message: 'Engine deleted successfully.' });
});

router.delete('/:id/images', async (req, res) => {
  const { imagePath } = req.body;
  if (!imagePath) return res.status(400).json({ message: 'imagePath is required.' });

  const engine = await Engine.findById(req.params.id);
  if (!engine) return res.status(404).json({ message: 'Engine not found.' });
  if (!engine.images.includes(imagePath)) return res.status(404).json({ message: 'Image not found for this engine.' });

  removeFiles([imagePath]);
  engine.images = engine.images.filter((img) => img !== imagePath);
  await engine.save();

  return res.json(engine);
});

module.exports = router;
