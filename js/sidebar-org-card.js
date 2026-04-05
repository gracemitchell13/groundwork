// Shared helper — populate the org profile card in the sidebar

export function populateSidebarCard(org) {
  const card = document.getElementById('sidebar-org-card');
  if (!card || !org?.name) return;

  document.getElementById('card-org-name').textContent    = org.name || '';
  
  const mission = org.mission || '';
  const missionEl = document.getElementById('card-org-mission');
  missionEl.textContent = mission.length > 100 ? mission.slice(0, 100).trimEnd() + '…' : mission;

  const budgetEl = document.getElementById('card-org-budget');
  budgetEl.textContent = org.budget ? `Annual budget: ${org.budget}` : '';

  card.classList.add('visible');
}
