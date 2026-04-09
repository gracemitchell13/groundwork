# Groundwork — Grant Writing Toolkit

**[→ Live app](https://gracemitchell13.github.io/groundwork)**

A free, web-based grant writing toolkit for small nonprofits with no dedicated development staff and no prior grant writing experience.

Built for organizations like the Elkton Community Education Center (ECEC) — where one person is running the whole operation and writing grants largely alone.

## The five sections

1. **Know Your Organization** — org profile builder: mission, programs, population served, budget, theory of change, funder history
2. **Evaluate This Opportunity** — guided go/no-go assessment with explanations of why each question matters
3. **Prepare Your Application** — RFP checklist, backward-mapped timeline, workplan scaffold
4. **Build Your Language Library** — reusable narrative blocks that compound into institutional grant voice
5. **Track Your Pipeline** — simple application tracker: funder, opportunity, deadline, ask, status, notes

## Tech stack

- Plain HTML / CSS / JavaScript (no framework)
- Firebase Authentication (Google sign-in)
- Firebase Firestore (data persistence)
- Hosted on GitHub Pages + custom domain

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/groundwork.git
cd groundwork
```

### 2. Configure Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a project called `groundwork`
3. Add a web app
4. Copy your config values into `js/firebase-config.js`
5. Enable **Authentication → Google** sign-in
6. Enable **Firestore Database**

### 3. Set Firestore security rules

In the Firebase console under Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

This ensures each user can only access their own data.

### 4. Deploy to GitHub Pages

Push to your repo. In Settings → Pages, set source to `main` branch, root directory.

Point your custom domain to GitHub Pages via your DNS registrar.

## Data structure (Firestore)

```
users/
  {uid}/
    data/
      org        — organization profile
        name, abbreviation, mission, programs[], population,
        geography, budget, theoryOfChange, funderHistory[]
      evaluations — array of go/no-go assessments
      applications — array of active applications
      library    — array of narrative blocks
      pipeline   — array of tracked opportunities
```

## License

MIT — free to use, fork, and adapt.

Built by Grace Mitchell · [gracemitchellwriting.com](https://gracemitchellwriting.com)
