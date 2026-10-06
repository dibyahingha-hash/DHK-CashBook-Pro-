
/**
 * js/profile.js
 * School Profile, UDISE Registration & Statutory Rate Configuration
 */

const ProfileModule = {
  KEY: 'profile_data',

  // Default statutory rates for Assam Primary & Upper Primary
  defaultRates: {
    rate_lp: 6.78,    // LP Cooking cost per student (Rs.)
    rate_up: 10.15,   // UP Cooking cost per student (Rs.)
    rice_lp: 0.100,   // LP Rice allocation per student (kg)
    rice_up: 0.150    // UP Rice allocation per student (kg)
  },

  // Load saved profile or provide defaults
  getProfile() {
    const saved = StorageEngine.get(this.KEY, {});
    return {
      udise: saved.udise || '',
      schoolName: saved.schoolName || '',
      block: saved.block || '',
      district: saved.district || '',
      htName: saved.htName || '',
      mobile: saved.mobile || '',
      rate_lp: parseFloat(saved.rate_lp) || this.defaultRates.rate_lp,
      rate_up: parseFloat(saved.rate_up) || this.defaultRates.rate_up,
      rice_lp: parseFloat(saved.rice_lp) || this.defaultRates.rice_lp,
      rice_up: parseFloat(saved.rice_up) || this.defaultRates.rice_up
    };
  },

  // Save profile to storage and refresh UI
  saveProfile(data) {
    StorageEngine.set(this.KEY, data);
    this.updateHeaderBadge(data);
  },

  // Update header badge dynamically
  updateHeaderBadge(data) {
    const dispName = document.getElementById('disp-school-name');
    const dispUdise = document.getElementById('disp-udise-code');
    if (dispName && dispUdise) {
      dispName.innerText = data.schoolName ? data.schoolName : 'School Setup Required';
      dispUdise.innerText = data.udise ? `UDISE: ${data.udise}` : 'UDISE: Not Configured';
    }
  },

  // Populate UI inputs with saved data
  populateUI() {
    const p = this.getProfile();
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };

    setVal('cfg-udise', p.udise);
    setVal('cfg-name', p.schoolName);
    setVal('cfg-block', p.block);
    setVal('cfg-district', p.district);
    setVal('cfg-ht-name', p.htName);
    setVal('cfg-mobile', p.mobile);
    setVal('cfg-rate-lp', p.rate_lp);
    setVal('cfg-rate-up', p.rate_up);
    setVal('cfg-rice-lp', p.rice_lp);
    setVal('cfg-rice-up', p.rice_up);

    this.updateHeaderBadge(p);
  }
};

// Form submission handler
function saveSchoolProfile() {
  const udise = document.getElementById('cfg-udise').value.trim();
  const schoolName = document.getElementById('cfg-name').value.trim();
  const block = document.getElementById('cfg-block').value.trim();
  const district = document.getElementById('cfg-district').value.trim();
  const htName = document.getElementById('cfg-ht-name').value.trim();
  const mobile = document.getElementById('cfg-mobile').value.trim();

  const rate_lp = parseFloat(document.getElementById('cfg-rate-lp').value) || 6.78;
  const rate_up = parseFloat(document.getElementById('cfg-rate-up').value) || 10.15;
  const rice_lp = parseFloat(document.getElementById('cfg-rice-lp').value) || 0.100;
  const rice_up = parseFloat(document.getElementById('cfg-rice-up').value) || 0.150;

  if (udise.length !== 11 || isNaN(udise)) {
    alert('Please enter a valid 11-digit UDISE+ code.');
    return;
  }
  if (!schoolName) {
    alert('Please enter the School Name.');
    return;
  }

  const profileData = {
    udise,
    schoolName,
    block,
    district,
    htName,
    mobile,
    rate_lp,
    rate_up,
    rice_lp,
    rice_up
  };

  ProfileModule.saveProfile(profileData);
  alert('School profile successfully saved!');
}

// Auto-populate on app startup
document.addEventListener('DOMContentLoaded', () => {
  ProfileModule.populateUI();
});
