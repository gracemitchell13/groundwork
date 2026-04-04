// ============================================================
// Groundwork — Header template
// Returns the main-header HTML string.
// Pass the page title to show under the greeting.
// ============================================================

export function headerHTML(pageSubtitle = '') {
  return `
  <header class="main-header">
    <div class="header-left">
      <h1 class="greeting" id="greeting">Good morning.</h1>
      ${pageSubtitle ? `<p class="greeting-sub">${pageSubtitle}</p>` : ''}
    </div>
    <div class="header-right">
      <button class="ctrl-btn" id="settings-btn" title="Settings" aria-label="Settings">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="2.2" stroke="currentColor" stroke-width="1.2" fill="none"/>
          <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06"
                stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="avatar-btn" id="avatar-btn" title="Account" aria-label="Account">
        <span id="avatar-initial">?</span>
      </button>
    </div>
    <svg class="corner-mark" width="90" height="90" viewBox="0 0 90 90" fill="none" aria-hidden="true">
      <path d="M90 90 Q55 75 45 45 Q35 15 0 0" stroke="#3D5830" stroke-width="1.5" fill="none"/>
      <path d="M90 90 Q60 80 52 55 Q44 28 10 10" stroke="#3D5830" stroke-width="1.5" fill="none"/>
      <path d="M90 90 Q65 85 58 64 Q52 40 20 20" stroke="#3D5830" stroke-width="1.5" fill="none"/>
      <path d="M90 90 Q70 88 65 72 Q59 52 30 30" stroke="#3D5830" stroke-width="1.5" fill="none"/>
      <path d="M90 90 Q76 90 73 80 Q68 65 42 42" stroke="#3D5830" stroke-width="1.5" fill="none"/>
    </svg>
  </header>`;
}
