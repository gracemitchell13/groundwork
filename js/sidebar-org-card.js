// Groundwork — sidebar org context
// Populates the wordmark area with org name + metadata once Section 1 is saved

export function populateSidebarCard(org) {
  if (!org?.name) return;

  const subEl  = document.getElementById('wordmark-sub');
  const metaEl = document.getElementById('wordmark-org-meta');

  if (subEl) {
    subEl.textContent = org.name.toUpperCase();
    subEl.style.color        = '#C8D8BC';
    subEl.style.letterSpacing = '0.04em';
    subEl.style.lineHeight   = '1.35';
    subEl.style.fontSize     = '10.5px';
  }

  if (metaEl) {
    metaEl.style.display = 'none';
  }

  // Keep hidden footer IDs updated for any JS that still references them
  const nameEl = document.getElementById('org-name');
  const fullEl = document.getElementById('org-full');
  if (nameEl) nameEl.textContent = org.abbreviation || org.name || '';
  if (fullEl) fullEl.textContent = '';
}
