(function () {
  'use strict';

  const NS = window.CatalogoTop;
  const Core = NS?.Core;
  const Money = NS?.Money;
  const AssetClient = NS?.AssetClient;
  const form = document.getElementById('productForm');
  const priceField = document.getElementById('price');
  const variantsField = document.getElementById('variants');
  const tableRowsField = document.getElementById('commercialRows');
  const imageDropzone = document.getElementById('imageDropzone');
  if (!Core || !form || !priceField || !variantsField || !tableRowsField) return;

  const priceGrid = priceField.closest('.field-grid');
  const quantityEditor = document.createElement('div');
  quantityEditor.className = 'quantity-price-editor';
  quantityEditor.innerHTML = `
    <label class="quantity-price-toggle"><input id="hasQuantityPrice" type="checkbox" /><span>Preço por quantidade</span></label>
    <div class="quantity-price-fields hidden" id="quantityPriceFields">
      <label>Qtd. mín.<input id="quantityMin" type="number" min="2" step="1" inputmode="numeric" placeholder="Ex.: 10" /></label>
      <label>Preço em quantidade<input id="quantityPrice" inputmode="decimal" placeholder="Ex.: R$ 49,90" /></label>
    </div>`;
  priceGrid?.after(quantityEditor);

  const galleryEditor = document.createElement('section');
  galleryEditor.className = 'product-image-gallery-editor';
  galleryEditor.innerHTML = `
    <div class="product-image-gallery-head"><strong>Imagens alternativas</strong><span>Até 24 por produto</span></div>
    <div class="product-image-gallery-list" id="productImageGalleryList"></div>
    <label class="button secondary compact file-button product-image-gallery-add">+ Adicionar imagens
      <input id="productImageGalleryFiles" type="file" accept="image/*" multiple />
    </label>`;
  imageDropzone?.after(galleryEditor);

  const quantityToggle = document.getElementById('hasQuantityPrice');
  const quantityFields = document.getElementById('quantityPriceFields');
  const quantityMinField = document.getElementById('quantityMin');
  const quantityPriceField = document.getElementById('quantityPrice');
  const galleryList = document.getElementById('productImageGalleryList');
  const galleryFiles = document.getElementById('productImageGalleryFiles');
  let galleryDraft = [];

  function cloneGallery(value) {
    return Core.normalizeImageGallery(value).map(entry => ({
      ...entry,
      provenance: entry.provenance && typeof entry.provenance === 'object' ? { ...entry.provenance } : null
    }));
  }

  function galleryImageId() {
    if (window.crypto?.randomUUID) return `image-${window.crypto.randomUUID()}`;
    return `image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Não foi possível ler a imagem.'));
      reader.readAsDataURL(blob);
    });
  }

  function renderGallery() {
    if (!galleryList) return;
    if (!galleryDraft.length) {
      galleryList.innerHTML = '<div class="product-image-gallery-empty">Nenhuma imagem alternativa. A imagem principal continua sendo o Original.</div>';
      return;
    }
    galleryList.innerHTML = galleryDraft.map((entry, index) => `
      <div class="product-image-gallery-item" data-gallery-index="${index}">
        <img src="${NS.Render.esc(entry.image)}" alt="" />
        <input type="text" value="${NS.Render.esc(entry.label || '')}" placeholder="Nome opcional, ex.: detalhe" data-gallery-label="${index}" aria-label="Nome da imagem alternativa ${index + 1}" />
        <button class="product-image-gallery-remove" type="button" data-gallery-remove="${index}" title="Remover imagem" aria-label="Remover imagem alternativa ${index + 1}">×</button>
      </div>`).join('');
  }

  async function addGalleryFiles(files) {
    if (!AssetClient || !files?.length) return;
    const remaining = Math.max(0, (NS.ImageVariants?.MAX_PRODUCT_GALLERY_IMAGES || 24) - galleryDraft.length);
    const selected = Array.from(files).slice(0, remaining);
    if (!selected.length) return;
    try {
      const additions = [];
      for (const file of selected) {
        const prepared = await AssetClient.prepareImage(file);
        additions.push({
          id: galleryImageId(),
          label: String(file.name || '').replace(/\.[^.]+$/, ''),
          image: await blobToDataUrl(prepared),
          provenance: { kind: 'manual-upload' }
        });
      }
      galleryDraft = Core.normalizeImageGallery(galleryDraft.concat(additions));
      renderGallery();
    } catch (error) {
      alert(error.message || 'Não foi possível preparar uma das imagens alternativas.');
    } finally {
      if (galleryFiles) galleryFiles.value = '';
    }
  }

  function setQuantityEnabled(enabled) {
    const active = Boolean(enabled);
    quantityToggle.checked = active;
    quantityFields.classList.toggle('hidden', !active);
    quantityMinField.disabled = !active;
    quantityPriceField.disabled = !active;
    quantityMinField.required = active;
    quantityPriceField.required = active;
    if (!active) {
      quantityMinField.setCustomValidity('');
      quantityPriceField.setCustomValidity('');
    }
  }

  function clearDetails() {
    variantsField.value = '';
    tableRowsField.value = '';
    priceField.setCustomValidity('');
    tableRowsField.setCustomValidity('');
    quantityMinField.value = '';
    quantityPriceField.value = '';
    galleryDraft = [];
    renderGallery();
    setQuantityEnabled(false);
  }

  function loadDetails() {
    const id = document.getElementById('productId')?.value || '';
    const product = Core.getState().products.find(item => item.id === id);
    if (!product) {
      clearDetails();
      return;
    }
    variantsField.value = Core.variantsToText(product.variants);
    tableRowsField.value = Core.tableRowsToText(product.tableRows);
    galleryDraft = cloneGallery(product.imageGallery);
    renderGallery();
    priceField.setCustomValidity('');
    tableRowsField.setCustomValidity('');
    const quantityPrice = Core.normalizeQuantityPrice(product.quantityPrice);
    quantityMinField.value = quantityPrice?.minQuantity || '';
    quantityPriceField.value = quantityPrice?.price || '';
    setQuantityEnabled(Boolean(quantityPrice));
  }

  function normalizeSinglePriceField() {
    if (!Money) return true;
    const parsed = Money.parse(priceField.value);
    if (!parsed.ok) {
      priceField.setCustomValidity('Informe um valor monetário válido, por exemplo R$ 54,90.');
      return false;
    }
    priceField.setCustomValidity('');
    priceField.value = parsed.canonical;
    return true;
  }

  function normalizeQuantityPriceFields() {
    if (!quantityToggle.checked) {
      quantityMinField.setCustomValidity('');
      quantityPriceField.setCustomValidity('');
      return { ok: true, value: null };
    }
    const minQuantity = Number(quantityMinField.value);
    if (!Number.isSafeInteger(minQuantity) || minQuantity < 2) {
      quantityMinField.setCustomValidity('Informe uma quantidade mínima inteira a partir de 2.');
      quantityPriceField.setCustomValidity('');
      return { ok: false, field: quantityMinField, value: null };
    }
    const parsed = Money?.parse(quantityPriceField.value);
    if (!parsed?.ok || parsed.empty) {
      quantityMinField.setCustomValidity('');
      quantityPriceField.setCustomValidity('Informe um preço em quantidade válido, por exemplo R$ 49,90.');
      return { ok: false, field: quantityPriceField, value: null };
    }
    quantityMinField.setCustomValidity('');
    quantityPriceField.setCustomValidity('');
    quantityPriceField.value = parsed.canonical;
    return { ok: true, value: { minQuantity, price: parsed.canonical } };
  }

  function commercialPriceIssue(text) {
    if (!Money) return null;
    const lines = String(text || '').split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) continue;
      const parts = line.split('|').map(part => part.trim());
      const price = parts[3] || '';
      const minQuantity = parts[4] || '';
      const quantityPrice = parts[5] || '';
      if (price && !Money.parse(price).ok) return { line: index + 1, reason: `Preço inválido: ${price}` };
      if (Boolean(minQuantity) !== Boolean(quantityPrice)) return { line: index + 1, reason: 'Qtd. mín. e preço em quantidade devem ser informados juntos.' };
      if (minQuantity) {
        const minimum = Number(minQuantity);
        if (!Number.isSafeInteger(minimum) || minimum < 2) return { line: index + 1, reason: `Qtd. mín. inválida: ${minQuantity}` };
        const parsed = Money.parse(quantityPrice);
        if (!parsed.ok || parsed.empty) return { line: index + 1, reason: `Preço em quantidade inválido: ${quantityPrice}` };
      }
    }
    return null;
  }

  function normalizeCommercialRowsField() {
    const issue = commercialPriceIssue(tableRowsField.value);
    if (issue) {
      tableRowsField.setCustomValidity(`Linha ${issue.line}: ${issue.reason}`);
      return issue;
    }
    tableRowsField.setCustomValidity('');
    tableRowsField.value = Core.tableRowsToText(Core.parseTableRowsText(tableRowsField.value));
    return null;
  }

  function read() {
    return {
      quantityPrice: quantityToggle.checked
        ? Core.normalizeQuantityPrice({ minQuantity: quantityMinField.value, price: quantityPriceField.value })
        : null,
      imageGallery: Core.normalizeImageGallery(galleryDraft),
      variants: Core.parseVariantsText(variantsField.value),
      tableRows: Core.parseTableRowsText(tableRowsField.value)
    };
  }

  function validateSubmit(event) {
    if (!normalizeSinglePriceField()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelector('[data-form-step-target="2"]')?.click();
      priceField.reportValidity();
      priceField.focus();
      return;
    }

    const quantity = normalizeQuantityPriceFields();
    if (!quantity.ok) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelector('[data-form-step-target="2"]')?.click();
      quantity.field.reportValidity();
      quantity.field.focus();
      return;
    }

    const issue = normalizeCommercialRowsField();
    if (issue) {
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelector('[data-form-step-target="3"]')?.click();
      tableRowsField.reportValidity();
      tableRowsField.focus();
    }
  }

  priceField.addEventListener('input', () => priceField.setCustomValidity(''));
  priceField.addEventListener('blur', () => {
    if (normalizeSinglePriceField()) return;
    priceField.setCustomValidity('Informe um valor monetário válido, por exemplo R$ 54,90.');
  });
  quantityToggle.addEventListener('change', () => setQuantityEnabled(quantityToggle.checked));
  quantityMinField.addEventListener('input', () => quantityMinField.setCustomValidity(''));
  quantityMinField.addEventListener('blur', () => {
    if (quantityToggle.checked) normalizeQuantityPriceFields();
  });
  quantityPriceField.addEventListener('input', () => quantityPriceField.setCustomValidity(''));
  quantityPriceField.addEventListener('blur', () => {
    if (quantityToggle.checked) normalizeQuantityPriceFields();
  });
  tableRowsField.addEventListener('input', () => tableRowsField.setCustomValidity(''));
  tableRowsField.addEventListener('blur', normalizeCommercialRowsField);
  galleryFiles?.addEventListener('change', event => addGalleryFiles(event.target.files));
  galleryList?.addEventListener('input', event => {
    const input = event.target.closest('[data-gallery-label]');
    if (!input) return;
    const index = Number(input.dataset.galleryLabel);
    if (galleryDraft[index]) galleryDraft[index].label = input.value;
  });
  galleryList?.addEventListener('click', event => {
    const button = event.target.closest('[data-gallery-remove]');
    if (!button) return;
    galleryDraft.splice(Number(button.dataset.galleryRemove), 1);
    renderGallery();
  });

  form.addEventListener('submit', validateSubmit, true);

  document.getElementById('productRows')?.addEventListener('click', event => {
    if (!event.target.closest('[data-edit-product]')) return;
    queueMicrotask(loadDetails);
  });
  window.addEventListener('catalogotop:tab-changed', event => {
    if (event.detail?.tabId === 'products') queueMicrotask(loadDetails);
  });

  ['btnNewProduct', 'btnCancelEdit'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => queueMicrotask(clearDetails));
  });

  renderGallery();

  NS.ProductDetails = Object.freeze({
    read,
    loadDetails,
    clearDetails,
    renderGallery
  });
})();