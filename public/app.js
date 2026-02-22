const qs = (s) => document.querySelector(s);
const engineForm = qs('#engineForm');
const formMessage = qs('#formMessage');
const searchInput = qs('#searchInput');
const searchBtn = qs('#searchBtn');
const searchMessage = qs('#searchMessage');
const engineList = qs('#engineList');
const engineDetails = qs('#engineDetails');
const editBtn = qs('#editBtn');
const deleteBtn = qs('#deleteBtn');
const imageModal = qs('#imageModal');
const modalImage = qs('#modalImage');
const closeModal = qs('#closeModal');
const editModal = qs('#editModal');
const editForm = qs('#editForm');
const cancelEdit = qs('#cancelEdit');
const existingImages = qs('#existingImages');

let selectedEngine = null;

const setMessage = (el, text, type = '') => {
  el.textContent = text;
  el.className = `msg ${type}`.trim();
};

async function request(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function openImage(src) {
  modalImage.src = src;
  imageModal.classList.add('open');
  imageModal.setAttribute('aria-hidden', 'false');
}

function closeImage() {
  imageModal.classList.remove('open');
  imageModal.setAttribute('aria-hidden', 'true');
  modalImage.src = '';
}

function renderDetails(engine) {
  selectedEngine = engine;
  editBtn.disabled = false;
  deleteBtn.disabled = false;

  const gallery = engine.images.length
    ? `<div class="gallery">${engine.images
        .map(
          (img) => `<div class="thumb"><img data-zoom="${img}" src="${img}" alt="${engine.engineName}" /><button data-remove="${img}" title="Delete image">✕</button></div>`
        )
        .join('')}</div>`
    : '<p>No images uploaded.</p>';

  engineDetails.className = '';
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
  engineDetails.className = 'empty';
  engineDetails.textContent = 'Select an engine to view details.';
}

async function loadEngines() {
  const items = await request('/api/engines');
  engineList.innerHTML = '';
  items.forEach((engine) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = engine.engineName;
    b.onclick = () => renderDetails(engine);
    li.appendChild(b);
    engineList.appendChild(li);
  });
}

engineForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const files = qs('#images').files;
  if (files.length > 10) return setMessage(formMessage, 'Maximum 10 images are allowed.', 'error');

  try {
    const created = await request('/api/engines', { method: 'POST', body: new FormData(engineForm) });
    setMessage(formMessage, 'Engine added successfully.', 'success');
    engineForm.reset();
    await loadEngines();
    renderDetails(created);
  } catch (err) {
    setMessage(formMessage, err.message, 'error');
  }
});

searchBtn.addEventListener('click', async () => {
  const name = searchInput.value.trim();
  if (!name) return setMessage(searchMessage, 'Enter an engine name.', 'error');
  try {
    const engine = await request(`/api/engines/search?name=${encodeURIComponent(name)}`);
    renderDetails(engine);
    setMessage(searchMessage, `Found ${engine.engineName}.`, 'success');
  } catch (err) {
    setMessage(searchMessage, err.message, 'error');
  }
});

engineDetails.addEventListener('click', async (e) => {
  const zoom = e.target.closest('[data-zoom]');
  if (zoom) return openImage(zoom.dataset.zoom);

  const remove = e.target.closest('[data-remove]');
  if (remove && selectedEngine) {
    if (!confirm('Delete this image?')) return;
    try {
      const updated = await request(`/api/engines/${selectedEngine._id}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath: remove.dataset.remove }),
      });
      renderDetails(updated);
      await loadEngines();
      setMessage(searchMessage, 'Image deleted.', 'success');
    } catch (err) {
      setMessage(searchMessage, err.message, 'error');
    }
  }
});

editBtn.addEventListener('click', () => {
  if (!selectedEngine) return;
  editForm.engineName.value = selectedEngine.engineName;
  editForm.airFilter.value = selectedEngine.airFilter || '';
  editForm.lastLoadedTestbed.value = selectedEngine.lastLoadedTestbed || '';
  editForm.remarks.value = selectedEngine.remarks || '';

  existingImages.innerHTML = selectedEngine.images
    .map(
      (img) => `<label class="keep-chip"><input type="checkbox" name="keep" value="${img}" checked /><img src="${img}" alt="keep image" /><span>Keep</span></label>`
    )
    .join('');

  editModal.classList.add('open');
  editModal.setAttribute('aria-hidden', 'false');
});

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selectedEngine) return;

  const keepImages = Array.from(editForm.querySelectorAll('input[name="keep"]:checked')).map((i) => i.value);
  const newFiles = editForm.images.files;
  if (keepImages.length + newFiles.length > 10) return alert('Total images cannot exceed 10.');

  const body = new FormData();
  body.append('engineName', editForm.engineName.value);
  body.append('airFilter', editForm.airFilter.value);
  body.append('lastLoadedTestbed', editForm.lastLoadedTestbed.value);
  body.append('remarks', editForm.remarks.value);
  body.append('keepImages', JSON.stringify(keepImages));
  Array.from(newFiles).forEach((f) => body.append('images', f));

  try {
    const updated = await request(`/api/engines/${selectedEngine._id}`, { method: 'PUT', body });
    renderDetails(updated);
    await loadEngines();
    setMessage(searchMessage, 'Engine updated successfully.', 'success');
    editModal.classList.remove('open');
    editForm.reset();
  } catch (err) {
    alert(err.message);
  }
});

deleteBtn.addEventListener('click', async () => {
  if (!selectedEngine || !confirm(`Delete ${selectedEngine.engineName}?`)) return;
  try {
    await request(`/api/engines/${selectedEngine._id}`, { method: 'DELETE' });
    setMessage(searchMessage, 'Engine deleted.', 'success');
    clearDetails();
    await loadEngines();
  } catch (err) {
    setMessage(searchMessage, err.message, 'error');
  }
});

closeModal.onclick = closeImage;
imageModal.addEventListener('click', (e) => e.target === imageModal && closeImage());
cancelEdit.onclick = () => editModal.classList.remove('open');
editModal.addEventListener('click', (e) => e.target === editModal && editModal.classList.remove('open'));

loadEngines().catch((e) => setMessage(searchMessage, e.message, 'error'));
