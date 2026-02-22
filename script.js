const form = document.getElementById('engine-form');
const message = document.getElementById('form-message');
const searchInput = document.getElementById('search');
const results = document.getElementById('results');
const template = document.getElementById('engine-card-template');

const STORAGE_KEY = 'engineCatalogEntries';

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? '#dc2626' : '#166534';
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderEntries(filter = '') {
  const entries = loadEntries();
  const normalizedFilter = filter.trim().toLowerCase();
  const visible = normalizedFilter
    ? entries.filter((entry) => entry.engineName.toLowerCase().includes(normalizedFilter))
    : entries;

  results.innerHTML = '';

  if (!visible.length) {
    results.innerHTML = '<p>No matching engines found.</p>';
    return;
  }

  visible.forEach((entry) => {
    const clone = template.content.cloneNode(true);
    clone.querySelector('.engine-title').textContent = entry.engineName;
    clone.querySelector('.air-filter').textContent = entry.airFilter;
    clone.querySelector('.remarks').textContent = entry.remarks || 'N/A';

    const imageGrid = clone.querySelector('.image-grid');
    entry.images.forEach((src, index) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = `${entry.engineName} image ${index + 1}`;
      imageGrid.appendChild(img);
    });

    results.appendChild(clone);
  });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showMessage('');

  const engineName = document.getElementById('engineName').value.trim();
  const airFilter = document.getElementById('airFilter').value.trim();
  const remarks = document.getElementById('remarks').value.trim();
  const imageInput = document.getElementById('images');

  const files = Array.from(imageInput.files || []);

  if (!files.length) {
    showMessage('Please upload at least one image.', true);
    return;
  }

  if (files.length > 10) {
    showMessage('You can upload a maximum of 10 images.', true);
    return;
  }

  const imageData = await Promise.all(files.map(fileToDataUrl));

  const entries = loadEntries();
  entries.push({
    engineName,
    airFilter,
    remarks,
    images: imageData,
    savedAt: new Date().toISOString(),
  });

  saveEntries(entries);
  form.reset();
  showMessage('Engine saved successfully!');
  renderEntries(searchInput.value);
});

searchInput.addEventListener('input', () => {
  renderEntries(searchInput.value);
});

renderEntries();
