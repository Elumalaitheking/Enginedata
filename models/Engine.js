const mongoose = require('mongoose');

const engineSchema = new mongoose.Schema(
  {
    engineName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    airFilter: {
      type: String,
      default: '',
      trim: true,
    },
    lastLoadedTestbed: {
      type: String,
      default: '',
      trim: true,
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator(paths) {
          return paths.length <= 10;
        },
        message: 'Maximum 10 images per engine allowed.',
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Engine', engineSchema);
