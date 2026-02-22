const engineForm = document.getElementById('engineForm');
const formMessage = document.getElementById('formMessage');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchMessage = document.getElementById('searchMessage');
const engineList = document.getElementById('engineList');
const engineDetails = document.getElementById('engineDetails');
const editBtn = document.getElementById('editBtn');
const deleteBtn = document.getElementById('deleteBtn');
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const closeModal = document.getElementById('closeModal');

let selectedEngine = null;

function setMessage(el, text, type = '') {
  el.textContent = text;
  el.className = `message ${type}`.trim();
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

function renderDetails(engine) {
  selectedEngine = engine;
  editBtn.disabled = false;
  deleteBtn.disabled = false;

  const gallery = engine.images.length
    ? `<div class="gallery">
      ${engine.images
        .map(
          (image) => `
          <div class="image-card">
            <img src="${image}" alt="${engine.engineName}" data-zoom-src="${image}" />
            <button data-delete-image="${image}" title="Delete image">✕</button>
          </div>`
        )
        .join('')}
      </div>`
    : '<p>No images uploaded.</p>';

  engineDetails.className = 'engine-details';
  engineDetails.innerHTML = `
    <div class="detail-grid">
      <div><strong>Engine Name:</strong> ${engine.engineName}</div>
      <div><strong>Air Filter:</strong> ${engine.airFilter || '-'}</div>
      <div><strong>Last Loaded Testbed:</strong> ${engine.lastLoadedTestbed || '-'}</div>
      <div><strong>Remarks:</strong> ${engine.remarks || '-'}</div>
    </div>
    ${gallery}
  `;
}

function clearDetails() {
  selectedEngine = null;
  editBtn.disabled = true;
  deleteBtn.disabled = true;
  engineDetails.className = 'engine-details empty-state';
  engineDetails.textContent = 'Select or search an engine to view details.';
}

async function loadEngines() {
  const engines = await fetchJSON('/api/engines');
  engineList.innerHTML = '';

  engines.forEach((engine) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'btn';
    button.textContent = engine.engineName;
    button.addEventListener('click', () => renderDetails(engine));
    li.appendChild(button);
    engineList.appendChild(li);
  });
}

engineForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = new FormData(engineForm);
  const files = document.getElementById('images').files;

  if (files.length > 10) {
    setMessage(formMessage, 'Maximum 10 images allowed.', 'error');
    return;
  }

  try {
    const created = await fetchJSON('/api/engines', {
      method: 'POST',
      body: data,
    });
    setMessage(formMessage, 'Engine saved successfully.', 'success');
    engineForm.reset();
    await loadEngines();
    renderDetails(created);
  } catch (error) {
    setMessage(formMessage, error.message, 'error');
  }
});

searchBtn.addEventListener('click', async () => {
  const name = searchInput.value.trim();
  if (!name) {
    setMessage(searchMessage, 'Enter an engine name to search.', 'error');
    return;
  }

  try {
    const engine = await fetchJSON(`/api/engines/search?name=${encodeURIComponent(name)}`);
    setMessage(searchMessage, `Found ${engine.engineName}.`, 'success');
    renderDetails(engine);
  } catch (error) {
    setMessage(searchMessage, error.message, 'error');
  }
});

editBtn.addEventListener('click', async () => {
  if (!selectedEngine) return;

  const engineName = prompt('Engine Name', selectedEngine.engineName);
  if (!engineName) return;

  const airFilter = prompt('Air Filter', selectedEngine.airFilter || '') ?? selectedEngine.airFilter;
  const lastLoadedTestbed = prompt('Last Loaded Testbed', selectedEngine.lastLoadedTestbed || '') ?? selectedEngine.lastLoadedTestbed;
  const remarks = prompt('Remarks', selectedEngine.remarks || '') ?? selectedEngine.remarks;

  const payload = { engineName, airFilter, lastLoadedTestbed, remarks };

  try {
    const updated = await fetchJSON(`/api/engines/${selectedEngine._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setMessage(searchMessage, 'Engine updated successfully.', 'success');
    renderDetails(updated);
    await loadEngines();
  } catch (error) {
    setMessage(searchMessage, error.message, 'error');
  }
});

deleteBtn.addEventListener('click', async () => {
  if (!selectedEngine || !confirm(`Delete ${selectedEngine.engineName}?`)) return;

  try {
    await fetchJSON(`/api/engines/${selectedEngine._id}`, { method: 'DELETE' });
    setMessage(searchMessage, 'Engine deleted.', 'success');
    clearDetails();
    await loadEngines();
  } catch (error) {
    setMessage(searchMessage, error.message, 'error');
  }
});

engineDetails.addEventListener('click', async (event) => {
  const zoomTarget = event.target.closest('[data-zoom-src]');
  if (zoomTarget) {
    modalImage.src = zoomTarget.dataset.zoomSrc;
    imageModal.classList.add('open');
    imageModal.setAttribute('aria-hidden', 'false');
    return;
  }

  const deleteTarget = event.target.closest('[data-delete-image]');
  if (deleteTarget && selectedEngine) {
    const imagePath = deleteTarget.dataset.deleteImage;
    if (!confirm('Delete this image?')) return;

    try {
      const updated = await fetchJSON(`/api/engines/${selectedEngine._id}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath }),
      });
      renderDetails(updated);
      await loadEngines();
      setMessage(searchMessage, 'Image deleted.', 'success');
    } catch (error) {
      setMessage(searchMessage, error.message, 'error');
    }
  }
});

function closeImageModal() {
  imageModal.classList.remove('open');
  imageModal.setAttribute('aria-hidden', 'true');
  modalImage.src = '';
}

closeModal.addEventListener('click', closeImageModal);
imageModal.addEventListener('click', (event) => {
  if (event.target === imageModal) closeImageModal();
});

loadEngines().catch((error) => setMessage(searchMessage, error.message, 'error'));
