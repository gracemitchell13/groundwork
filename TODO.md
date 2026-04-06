# Groundwork — Project To-Do

Last updated: April 5, 2026

---

## Content review (before sharing with Deb)

- [ ] Review all 33 glossary terms for accuracy, completeness, and plain-language clarity
- [ ] Verify all 15 resource links are still live
- [ ] Check resource tags (Free / Freemium / Paid) for accuracy
- [ ] Consider adding glossary terms: **program-related investment (PRI)**, **letter of support**, **indirect cost rate negotiation**
- [ ] Consider adding resource: nonprofit finance basics (still searching for a reliable free link)

---

## Sections to build

- [ ] **Section 3: Prepare Your Application** — RFP checklist, backward-mapped timeline, workplan scaffold
- [ ] **Section 4: Build Your Language Library** — reusable narrative blocks (save, edit, delete, copy)
- [ ] **Section 5: Track Your Pipeline** — table with add/edit/delete rows, status tracking, deadline visibility

---

## Wiring & dashboard

- [ ] Wire dashboard dots and status cards for Sections 3, 4, 5
- [ ] Populate org profile sidebar card on `index.html` dashboard (currently only on section pages)
- [ ] Confirm dot logic for Section 2 (evaluations.length) is working correctly

---

## Polish & testing

- [ ] Empty states for all sections (what does an org see before they've added anything?)
- [ ] Error handling — what happens if Firestore read/write fails?
- [ ] Mobile responsiveness pass across all pages
- [ ] Cross-browser test (Safari, Chrome, Firefox)
- [ ] Test full flow with real data (Deb at ECEC)

---

## Known issues / deferred

- [ ] Settings button currently shows an alert — wire to actual settings (or remove)
- [ ] Previous evaluations: only shows 10 most recent — consider pagination if list grows
- [ ] Org profile sidebar card: on Section 1, the card shows stale data until page reload after save — consider live update on save

---

## Completed ✓

- [x] Section 1: Know Your Organization — form, Firestore save/load, sidebar wiring
- [x] Section 2: Evaluate This Opportunity — 8-question evaluator, scoring, hard stops, prose summary, copy, save, delete, previous evals
- [x] Definitions & Resources — 33-term glossary, 15 resources across 7 categories, verified links
- [x] Auth (Google Sign-In), Firestore security rules
- [x] Dashboard with dots, greeting, org name
- [x] Sidebar org profile card (collapsible, green-tinted)
- [x] "Groundwork" wordmark as live link to homepage on all pages
- [x] Book icon for Definitions & Resources sidebar link
- [x] Hard stops: eligibility and mission fit override scoring
- [x] Deadline auto-integration in Question 3
