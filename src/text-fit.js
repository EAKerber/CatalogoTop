(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};

  function lineBudget(card) {
    const width = card?.dataset.cardWidth || 'simple';
    let lines = width === 'full' ? 5 : width === 'wide' ? 4 : 3;
    if (card?.closest('.template-showcase')) lines = Math.max(lines, 4);
    return lines;
  }

  function lineHeightPx(element) {
    const computed = window.getComputedStyle(element);
    const explicit = Number.parseFloat(computed.lineHeight);
    if (Number.isFinite(explicit)) return explicit;
    const fontSize = Number.parseFloat(computed.fontSize) || 12;
    return fontSize * 1.12;
  }

  function fitsWithinLines(element, text, maxLines) {
    element.textContent = text;
    element.style.maxHeight = 'none';
    element.style.overflow = 'visible';
    const lineHeight = lineHeightPx(element);
    const allowedHeight = lineHeight * Math.max(1, maxLines) + 1;
    return { fits: element.scrollHeight <= allowedHeight, lineHeight, allowedHeight };
  }

  function fitHeading(element, maxLines) {
    if (!element) return null;
    const full = String(element.dataset.fullDescription || element.textContent || '').trim().replace(/\s+/g, ' ');
    if (!full) return null;
    element.dataset.fullDescription = full;
    element.title = full;

    if (element.getBoundingClientRect().width <= 0) {
      element.textContent = full;
      return { full, visible: full, truncated: false, lines: maxLines };
    }

    const words = full.split(' ').filter(Boolean);
    let visible = full;
    let measurement = fitsWithinLines(element, full, maxLines);

    if (!measurement.fits && words.length > 1) {
      let low = 1;
      let high = words.length;
      let best = 1;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = words.slice(0, middle).join(' ');
        const result = fitsWithinLines(element, candidate, maxLines);
        measurement = result;
        if (result.fits) {
          best = middle;
          low = middle + 1;
        } else {
          high = middle - 1;
        }
      }
      visible = words.slice(0, best).join(' ');
      measurement = fitsWithinLines(element, visible, maxLines);
    }

    element.textContent = visible;
    element.style.maxHeight = `${measurement.lineHeight * Math.max(1, maxLines) + 1}px`;
    element.style.overflow = 'hidden';
    element.dataset.fitLines = String(maxLines);
    element.dataset.visibleWords = String(visible.split(' ').filter(Boolean).length);
    element.dataset.descriptionTruncated = String(visible !== full);
    return { full, visible, truncated: visible !== full, lines: maxLines };
  }

  function fitCatalog(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll('.catalog-card[data-product-id] h3')).map(heading => {
      const card = heading.closest('.catalog-card');
      return fitHeading(heading, lineBudget(card));
    }).filter(Boolean);
  }

  NS.TextFit = { lineBudget, fitHeading, fitCatalog };
})();
