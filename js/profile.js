/**
 * js/profile.js
 * Master School Profile & Gatekeeper Logic
 */

const ProfileModule = {
  KEY: StorageEngine.PREFIX + 'school_profile',

  getProfile() {
    const raw = localStorage.getItem(this.KEY);
    return raw ? JSON.parse(raw) : null;
  },

  isConfigured() {
    const p = this.getProfile();
    return !!(p && p.schoolName && p.schoolName.trim() !== '' && p.udise && p.udise.trim() !== '');
  },

  saveProfile() {
    const name = document.getElementById('cfg-school-name').value.trim();
    const udise = document.getElementById('cfg-udise').value.trim();
    const block = document.getElementById('cfg-block').value.trim();
    const htName = document.getElementById('cfg-ht-name').value.trim();
    const cat = document.getElementById('cfg-cat') ? document.getElementById('cfg-cat').value : 'LP';

    if (!name || !udise) {
      alert("Please enter at least School Name and UDISE Code to activate the school portal.");
      return;
    }

    const data = {
      schoolName: name,
      udise: udise,
      block: block,
      htName: htName,
      category: cat,
      configuredAt: new Date().toISOString()
    };

    localStorage.setItem(this.KEY, JSON.stringify(data));
    this.applyHeader();

    // Unlock workspace
    document.getElementById('profile-gatekeeper').style.display = 'none';
    document.getElementById('app-navigation').style.display = 'flex';
    document.getElementById('workspace-container').style.display = 'block';

    // Show success message and navigate to Daily Desk
    switchTab('daily');
    alert("✅ School profile registered successfully! Workspace unlocked.");
  },

  applyHeader() {
    const p = this.getProfile();
    const nameEl = document.getElementById('header-school-name');
    const udiseEl = document.getElementById('header-udise');

    if (p && p.schoolName) {
      if (nameEl) nameEl.innerText = p.schoolName.toUpperCase();
      if (udiseEl) udiseEl.innerText = `UDISE: ${p.udise} | BLOCK: ${p.block || '-'}`;
    } else {
      if (nameEl) nameEl.innerText = 'ASSAM PRIMARY SCHOOL';
      if (udiseEl) udiseEl.innerText = 'UDISE: Not Set | District/Block: -';
    }
  },

  loadProfileUI() {
    const p = this.getProfile();
    if (p) {
      if (document.getElementById('cfg-school-name')) document.getElementById('cfg-school-name').value = p.schoolName || '';
      if (document.getElementById('cfg-udise')) document.getElementById('cfg-udise').value = p.udise || '';
      if (document.getElementById('cfg-block')) document.getElementById('cfg-block').value = p.block || '';
      if (document.getElementById('cfg-ht-name')) document.getElementById('cfg-ht-name').value = p.htName || '';
      if (document.getElementById('cfg-cat') && p.category) document.getElementById('cfg-cat').value = p.category;
    }
  },

  init() {
    this.applyHeader();
    this.loadProfileUI();

    const gate = document.getElementById('profile-gatekeeper');
    const nav = document.getElementById('app-navigation');
    const work = document.getElementById('workspace-container');

    if (!this.isConfigured()) {
      // First time: Hide all workspaces, lock on Setup Gatekeeper
      if (gate) gate.style.display = 'block';
      if (nav) nav.style.display = 'none';
      if (work) work.style.display = 'none';
    } else {
      // Already configured: Show normal workspace
      if (gate) gate.style.display = 'none';
      if (nav) nav.style.display = 'flex';
      if (work) work.style.display = 'block';
    }
  }
};
