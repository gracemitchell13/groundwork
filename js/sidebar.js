// ============================================================
// Groundwork — Sidebar template
// Returns the sidebar HTML string for injection into page shells.
// Pass the active section number (1-5).
// ============================================================

export function sidebarHTML(activeSection = 0) {
  const items = [
    { num: '01', label: 'Know Your Organization',    href: 'org.html' },
    { num: '02', label: 'Evaluate This Opportunity', href: 'evaluate.html' },
    { num: '03', label: 'Prepare Your Application',  href: 'prepare.html' },
    { num: '04', label: 'Build Your Language Library', href: 'library.html' },
    { num: '05', label: 'Track Your Pipeline',       href: 'pipeline.html' },
  ];

  const navItems = items.map((item, i) => `
    <a href="${item.href}" class="nav-item${i + 1 === activeSection ? ' active' : ''}" data-section="${i + 1}">
      <span class="nav-num">${item.num}</span>
      <span class="nav-label">${item.label}</span>
    </a>`).join('');

  const dots = [1,2,3,4,5].map(n =>
    `<div class="dot dot-${n}" id="dot-${n}"></div>`).join('');

  return `
  <aside class="sidebar">
    <div class="sidebar-dots">${dots}</div>
    <div class="sidebar-wordmark">
      <p class="wordmark">Groundwork</p>
      <div class="wordmark-rule"></div>
      <p class="wordmark-sub">Grant Writing Toolkit</p>
    </div>
    <nav class="sidebar-nav">${navItems}</nav>
    <div class="sidebar-footer">
      <div class="org-name" id="org-name">—</div>
      <div class="org-full" id="org-full"></div>
    </div>
  </aside>`;
}
