const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Engine = require('../models/Engine');

const router = express.Router();

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname);
    const safeBase = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9-_]/g, '_');
    cb(null, `${Date.now()}-${safeBase}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { files: 10, fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image files are allowed.'));
  },
});

const parseImagePaths = (files = []) => files.map((file) => `/uploads/${file.filename}`);

const removeFiles = (relativePaths = []) => {
  for (const relativePath of relativePaths) {
    const localPath = path.join(process.cwd(), relativePath.replace(/^\//, ''));
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  }
};

router.post('/', upload.array('images', 10), async (req, res) => {
  try {
    const imagePaths = parseImagePaths(req.files);

    const existing = await Engine.findOne({
      engineName: { $regex: `^${escapeRegex(req.body.engineName?.trim())}$`, $options: 'i' },
    });

    if (existing) {
      removeFiles(imagePaths);
      return res.status(409).json({ message: 'Engine name already exists.' });
    }

    const engine = await Engine.create({
      engineName: req.body.engineName,
      airFilter: req.body.airFilter,
      lastLoadedTestbed: req.body.lastLoadedTestbed,
      remarks: req.body.remarks,
      images: imagePaths,
    });

    return res.status(201).json(engine);
  } catch (error) {
    if (req.files?.length) {
      removeFiles(parseImagePaths(req.files));
    }
    return res.status(400).json({ message: error.message || 'Could not create engine.' });
  }
});

router.get('/', async (_req, res) => {
  const engines = await Engine.find().sort({ engineName: 1 });
  res.json(engines);
});

router.get('/search', async (req, res) => {
  const query = req.query.name?.trim();
  if (!query) {
    return res.status(400).json({ message: 'name query parameter is required.' });
  }

  const engine = await Engine.findOne({
    engineName: { $regex: `^${escapeRegex(query)}$`, $options: 'i' },
  });

  if (!engine) {
    return res.status(404).json({ message: 'Engine not found.' });
  }

  return res.json(engine);
});

router.get('/:id', async (req, res) => {
  const engine = await Engine.findById(req.params.id);
  if (!engine) {
    return res.status(404).json({ message: 'Engine not found.' });
  }
  return res.json(engine);
});

router.put('/:id', upload.array('images', 10), async (req, res) => {
  try {
    const engine = await Engine.findById(req.params.id);
    if (!engine) {
      removeFiles(parseImagePaths(req.files));
      return res.status(404).json({ message: 'Engine not found.' });
    }

    if (req.body.engineName && req.body.engineName.trim().toLowerCase() !== engine.engineName.toLowerCase()) {
      const duplicate = await Engine.findOne({
        _id: { $ne: engine._id },
        engineName: { $regex: `^${escapeRegex(req.body.engineName.trim())}$`, $options: 'i' },
      });

      if (duplicate) {
        removeFiles(parseImagePaths(req.files));
        return res.status(409).json({ message: 'Engine name already exists.' });
      }
    }

    const newImages = parseImagePaths(req.files);
    const mergedImages = [...engine.images, ...newImages];

    if (mergedImages.length > 10) {
      removeFiles(newImages);
      return res.status(400).json({ message: 'Total image count cannot exceed 10.' });
    }

    engine.engineName = req.body.engineName ?? engine.engineName;
    engine.airFilter = req.body.airFilter ?? engine.airFilter;
    engine.lastLoadedTestbed = req.body.lastLoadedTestbed ?? engine.lastLoadedTestbed;
    engine.remarks = req.body.remarks ?? engine.remarks;
    engine.images = mergedImages;

    await engine.save();
    return res.json(engine);
  } catch (error) {
    if (req.files?.length) {
      removeFiles(parseImagePaths(req.files));
    }
    return res.status(400).json({ message: error.message || 'Could not update engine.' });
  }
});

router.delete('/:id', async (req, res) => {
  const engine = await Engine.findById(req.params.id);
  if (!engine) {
    return res.status(404).json({ message: 'Engine not found.' });
  }

  removeFiles(engine.images);
  await engine.deleteOne();

  return res.json({ message: 'Engine deleted successfully.' });
});

router.delete('/:id/images', async (req, res) => {
  const { imagePath } = req.body;
  if (!imagePath) {
    return res.status(400).json({ message: 'imagePath is required.' });
  }

  const engine = await Engine.findById(req.params.id);
  if (!engine) {
    return res.status(404).json({ message: 'Engine not found.' });
  }

  if (!engine.images.includes(imagePath)) {
    return res.status(404).json({ message: 'Image not found for this engine.' });
  }

  removeFiles([imagePath]);
  engine.images = engine.images.filter((item) => item !== imagePath);
  await engine.save();

  return res.json(engine);
});

module.exports = router;
