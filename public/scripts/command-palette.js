function setupPalette() {
  const palette = document.getElementById('command-palette');
  const searchInput = document.getElementById('palette-search');
  const closeBtn = document.getElementById('palette-close');
  const items = Array.from(document.querySelectorAll('.result-item'));
  const emptyState = document.getElementById('palette-empty');

  if (!palette || !searchInput || !closeBtn) return;

  let selectedIndex = -1;
  let visibleItems = items;

  function openPalette() {
    palette.showModal();
    searchInput.value = '';
    filterItems('');
    searchInput.focus();
    document.body.style.overflow = 'hidden';
  }

  function closePalette() {
    palette.close();
    document.body.style.overflow = '';
  }

  function filterItems(query) {
    const q = query.toLowerCase().trim();
    visibleItems = [];
    items.forEach((item) => {
      const title = item.dataset.title || '';
      if (title.includes(q)) {
        item.style.display = 'block';
        visibleItems.push(item);
      } else {
        item.style.display = 'none';
      }
      item.classList.remove('selected');
    });

    if (visibleItems.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
    }

    selectedIndex = visibleItems.length > 0 ? 0 : -1;
    updateSelection();
  }

  function updateSelection() {
    visibleItems.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('selected');
      }
    });
  }

  // Keyboard shortcut to open palette (Cmd+K or Ctrl+K)
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      openPalette();
    }
  });

  // Close when clicking outside
  closeBtn.addEventListener('click', closePalette);
  palette.addEventListener('click', (e) => {
    if (e.target === palette) closePalette();
  });

  // Filter on input
  searchInput.addEventListener('input', (e) => {
    filterItems(e.target.value);
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    if (visibleItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % visibleItems.length;
      updateSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + visibleItems.length) % visibleItems.length;
      updateSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && visibleItems[selectedIndex]) {
        const url = visibleItems[selectedIndex].dataset.url;
        if (url) window.location.href = url;
      }
    }
  });
}

document.addEventListener('astro:page-load', setupPalette);
