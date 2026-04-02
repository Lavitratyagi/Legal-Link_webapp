/* ══════════════════════════════════════════════
   legal-help.js  — FIXED v3
   ══════════════════════════════════════════════ */

const API = 'http://localhost:5000/api/legal';

const GEO_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 15000,
  maximumAge: 300000
};

/* ── TAB SWITCHING ── */
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      buttons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('pane-' + tab).classList.add('active');
      if (tab === 'police') askLocationThenFetchStations();
    });
  });
}

/* ── GPS: prompt as soon as we need coordinates (tab click or lawyers init) ── */
function askLocationThenFetch(onSuccess, onFail) {
  if (!navigator.geolocation) {
    window._userCity = window._userCity || 'Ghaziabad, Uttar Pradesh';
    onFail?.();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      window._userLat = pos.coords.latitude;
      window._userLng = pos.coords.longitude;
      window._userCity = null;
      document.querySelectorAll('.loc-banner strong')
        .forEach(el => { el.textContent = 'your location'; });
      onSuccess?.();
    },
    () => {
      window._userLat = null;
      window._userLng = null;
      window._userCity = window._userCity || 'Ghaziabad, Uttar Pradesh';
      document.querySelectorAll('.loc-banner strong').forEach(el => {
        el.textContent = window._userCity;
      });
      onFail?.();
    },
    GEO_OPTIONS
  );
}

/** Request GPS then run callback; used for "Change location" on lawyers pane */
function requestUserLocationThen(thenFn) {
  if (!navigator.geolocation) {
    const loc = prompt('Enter your city or area:');
    if (loc?.trim()) {
      window._userCity = loc.trim();
      window._userLat = null;
      window._userLng = null;
      document.querySelectorAll('.loc-banner strong').forEach(el => { el.textContent = loc.trim(); });
    }
    thenFn?.();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      window._userLat = pos.coords.latitude;
      window._userLng = pos.coords.longitude;
      window._userCity = null;
      document.querySelectorAll('.loc-banner strong')
        .forEach(el => { el.textContent = 'your location'; });
      thenFn?.();
    },
    () => {
      const loc = prompt('Location access denied or unavailable. Enter your city or area:');
      if (loc?.trim()) {
        window._userCity = loc.trim();
        window._userLat = null;
        window._userLng = null;
        document.querySelectorAll('.loc-banner strong').forEach(el => { el.textContent = loc.trim(); });
      }
      thenFn?.();
    },
    GEO_OPTIONS
  );
}

/* ════════════════════════════
   LAWYERS
   ════════════════════════════ */
const BADGE_CLASS = { free_consult:'badge-green', sliding_scale:'badge-amber', no_win_no_fee:'badge-blue', fixed:'badge-blue' };
const BADGE_LABEL = { free_consult:'Free consult', sliding_scale:'Sliding scale', no_win_no_fee:'No win no fee', fixed:'Fixed fee' };

function renderLawyers(lawyers) {
  const container = document.getElementById('lawyer-list');
  const noResults = document.getElementById('no-lawyers');
  if (!lawyers?.length) {
    container.innerHTML = '';
    noResults.style.display = 'block';
    return;
  }
  noResults.style.display = 'none';
  container.innerHTML = lawyers.map(l => {
    const initials = l.name.replace(/^Adv\.\s*/i,'').split(' ').slice(0,2).map(w=>w[0]).join('');
    const spec     = Array.isArray(l.specializations) ? l.specializations[0] : (l.specializations||'');
    const fee      = l.feePerHour ? `₹${Number(l.feePerHour).toLocaleString('en-IN')}/hr` : 'Contact for fee';
    const badge    = BADGE_CLASS[l.feeStructure] || 'badge-blue';
    const bLabel   = BADGE_LABEL[l.feeStructure] || 'Fixed fee';
    const loc      = [l.location?.address, l.location?.city].filter(Boolean).join(', ');
    return `
      <div class="lawyer-card">
        <div class="avatar">${initials}</div>
        <div class="lawyer-info">
          <div class="lawyer-name">${l.name}<span class="badge badge-blue" style="margin-left:8px">${spec}</span></div>
          <div class="lawyer-sub">${loc}${l.experience?' · '+l.experience+' yrs':''}</div>
          <div class="lawyer-meta">
            ${l.rating?`<span class="rating">★ ${l.rating}</span>`:''}
            <span>${fee}</span>
            <span class="badge ${badge}">${bLabel}</span>
          </div>
        </div>
        <button class="btn-contact" onclick="contactLawyer('${l.name}','${l.phone||''}')">Contact</button>
      </div>`;
  }).join('');
}

function showLawyerSkeleton() {
  document.getElementById('lawyer-list').innerHTML = [1,2,3].map(()=>`
    <div class="lawyer-card" style="opacity:0.4">
      <div class="avatar" style="background:#e5e7eb"></div>
      <div class="lawyer-info">
        <div style="height:13px;background:#e5e7eb;border-radius:4px;width:55%;margin-bottom:8px"></div>
        <div style="height:11px;background:#f3f4f6;border-radius:4px;width:75%;margin-bottom:6px"></div>
        <div style="height:11px;background:#f3f4f6;border-radius:4px;width:40%"></div>
      </div>
    </div>`).join('');
}

let filterTimer;
async function fetchLawyers(extraParams = {}) {
  showLawyerSkeleton();
  try {
    const params = new URLSearchParams();
    if (window._userLat != null && window._userLng != null) {
      params.set('lat', String(window._userLat));
      params.set('lng', String(window._userLng));
    } else {
      params.set('address', window._userCity || 'Ghaziabad, Uttar Pradesh');
    }
    if (extraParams.caseType) params.set('caseType', extraParams.caseType);
    if (extraParams.fee)      params.set('fee',      extraParams.fee);
    if (extraParams.q)        params.set('q',        extraParams.q);

    const res  = await fetch(`${API}/lawyers?${params}`);
    const data = await res.json();
    if (data.success) renderLawyers(data.lawyers);
    else {
      document.getElementById('lawyer-list').innerHTML =
        `<p class="no-results" style="display:block;color:#ef4444">${data.message}</p>`;
    }
  } catch {
    document.getElementById('lawyer-list').innerHTML =
      `<p class="no-results" style="display:block;color:#ef4444">
        Could not connect — is the backend running on port 5000?
      </p>`;
  }
}

function onFilterChange() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(() => {
    fetchLawyers({
      caseType: document.getElementById('lctype').value,
      fee:      document.getElementById('lfee').value,
      q:        document.getElementById('lsearch').value
    });
  }, 400);
}

function contactLawyer(name, phone) {
  if (phone) { if (confirm(`Call ${name}?\n📞 ${phone}`)) window.location.href = `tel:${phone}`; }
  else alert(`Submit your case via "Submit Case / FIR Help" and we will connect you with ${name}.`);
}

function initLawyers() {
  askLocationThenFetch(() => fetchLawyers(), () => fetchLawyers());
  document.getElementById('lsearch').addEventListener('input',  onFilterChange);
  document.getElementById('lctype').addEventListener('change',  onFilterChange);
  document.getElementById('lfee').addEventListener('change',    onFilterChange);
  document.getElementById('change-loc-btn').addEventListener('click', () => {
    requestUserLocationThen(() => fetchLawyers());
  });
  document.getElementById('change-loc-police-btn')?.addEventListener('click', () => {
    requestUserLocationThen(() => fetchPoliceStations());
  });
}

/* ════════════════════════════
   POLICE STATIONS
   ════════════════════════════ */
function askLocationThenFetchStations() {
  const container = document.getElementById('station-list');
  container.innerHTML =
    `<p class="fetch-msg" style="color:#6b7280;font-size:14px;padding:1rem 0">📍 Allow location when your browser asks — we use it with OpenStreetMap to find nearby police stations.</p>`;

  askLocationThenFetch(
    () => fetchPoliceStations(),
    () => fetchPoliceStations()
  );
}

async function fetchPoliceStations() {
  const container = document.getElementById('station-list');
  container.innerHTML =
    `<p class="fetch-msg" style="color:#6b7280;font-size:14px;padding:1rem 0">Searching nearby police stations (OpenStreetMap / Overpass)...</p>`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 35000);

  try {
    const params = new URLSearchParams();
    if (window._userLat != null && window._userLng != null) {
      params.set('lat', String(window._userLat));
      params.set('lng', String(window._userLng));
    } else {
      params.set('address', window._userCity || 'Ghaziabad, Uttar Pradesh');
    }

    const res = await fetch(`${API}/police-stations?${params}`, { signal: ctrl.signal });
    const data = await res.json();

    if (!data.success || !data.stations?.length) {
      container.innerHTML =
        `<p style="color:#6b7280;font-size:14px;padding:1rem 0">
          No stations found. Please call <strong>100</strong> (Police) or <strong>112</strong> (Emergency).
        </p>`;
      return;
    }

    // Show source note if using hardcoded fallback
    const sourceNote = data.source === 'hardcoded'
      ? `<p style="font-size:12px;color:#f59e0b;background:#fffbeb;padding:8px 12px;
                   border-radius:6px;margin-bottom:10px">
           ⚠️ Live map data unavailable — showing known stations for your area. Call 112 in emergency.
         </p>`
      : '';

    container.innerHTML = sourceNote + data.stations.map(s => `
      <div class="station-card">
        <div class="station-icon">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="7" r="2.5" stroke="#185FA5" stroke-width="1.4"/>
            <path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z"
              stroke="#185FA5" stroke-width="1.4" fill="none"/>
          </svg>
        </div>
        <div class="station-body">
          <div class="station-name">${s.name}</div>
          <div class="station-addr">${s.address || ''}</div>
        </div>
        <div class="station-meta">
          <div class="open-badge">Open 24/7</div>
          ${s.distance ? `<div class="station-dist">${s.distance}</div>` : ''}
          ${s.phone    ? `<div class="station-phone">${s.phone}</div>`   : ''}
        </div>
      </div>`).join('');

  } catch (err) {
    console.error('Police stations error:', err);
    const msg = err.name === 'AbortError'
      ? 'Request timed out. Try again or check your connection.'
      : 'Could not load stations. For emergency call <strong>112</strong>.';
    container.innerHTML =
      `<p style="color:#ef4444;font-size:14px;padding:1rem 0">${msg}</p>`;
  } finally {
    clearTimeout(t);
  }
}

/* ════════════════════════════
   AI CHAT
   ════════════════════════════ */
let chatHistory = [];

function appendMsg(text, role) {
  const box = document.getElementById('chat-box');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}

async function sendMsg() {
  const inp = document.getElementById('chat-in');
  const val = inp.value.trim();
  if (!val) return;
  inp.value = ''; inp.disabled = true;
  appendMsg(val, 'user');
  chatHistory.push({ role: 'user', content: val });
  const typing = appendMsg('Typing...', 'typing');
  try {
    const res  = await fetch(`${API}/ai-chat`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ message: val, history: chatHistory.slice(-10) })
    });
    const data = await res.json();
    typing.remove();
    if (data.success && data.reply) {
      appendMsg(data.reply, 'bot');
      chatHistory.push({ role:'assistant', content:data.reply });
    } else {
      appendMsg('Sorry, could not get a response. Please try again.', 'bot');
    }
  } catch {
    typing.remove();
    appendMsg('Network error — please make sure the backend is running.', 'bot');
  } finally { inp.disabled = false; inp.focus(); }
}

function initChat() {
  document.getElementById('chat-send').addEventListener('click', sendMsg);
  document.getElementById('chat-in').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) sendMsg();
  });
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('chat-in').value = chip.dataset.q;
      sendMsg();
    });
  });
}

/* ════════════════════════════
   FIR FORM
   ════════════════════════════ */
function initForm() {
  document.getElementById('fir-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const required = ['f-name','f-phone','f-city','f-type','f-desc'];
    let valid = true;
    required.forEach(id => {
      const el = document.getElementById(id);
      if (!el.value.trim()) {
        el.style.borderColor = '#E24B4A'; valid = false;
        el.addEventListener('input', () => el.style.borderColor = '', { once:true });
      }
    });
    if (!valid) return;

    const btn = document.querySelector('#fir-form .btn-primary');
    btn.textContent = 'Submitting...'; btn.disabled = true;

    try {
      const headers = { 'Content-Type': 'application/json' };
      const tok = localStorage.getItem('token');
      if (tok) headers['Authorization'] = `Bearer ${tok}`;

      const res = await fetch(`${API}/cases`, {
        method:'POST', headers,
        body: JSON.stringify({
          name:         document.getElementById('f-name').value.trim(),
          phone:        document.getElementById('f-phone').value.trim(),
          email:        document.getElementById('f-email').value.trim(),
          city:         document.getElementById('f-city').value.trim(),
          caseType:     document.getElementById('f-type').value,
          incidentDate: document.getElementById('f-date').value || null,
          description:  document.getElementById('f-desc').value.trim(),
          helpType:     document.getElementById('f-help').value,
          urgency:      document.getElementById('f-urgency').value
        })
      });
      const data = await res.json();
      if (data.success) {
        const s = document.getElementById('fir-success');
        s.classList.add('visible');
        s.scrollIntoView({ behavior:'smooth', block:'nearest' });
        if (data.firDraft) showFirDraft(data.firDraft, data.caseId);
        document.getElementById('fir-form').reset();
      } else {
        alert('Submission failed: ' + (data.message || 'Unknown error'));
      }
    } catch { alert('Network error — check if backend is running.'); }
    finally { btn.textContent = 'Submit Case'; btn.disabled = false; }
  });
}

function showFirDraft(draft, caseId) {
  const existing = document.getElementById('fir-draft-box');
  if (existing) existing.remove();
  const box = document.createElement('div');
  box.id = 'fir-draft-box';
  box.style.cssText = 'margin-top:16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;font-size:13px;line-height:1.75;color:#0c4a6e;white-space:pre-wrap;';
  box.innerHTML = `
    <div style="font-weight:600;margin-bottom:8px">📄 AI-Generated FIR Draft <span style="font-weight:400;font-size:12px">— Case ID: ${caseId}</span></div>
    <div id="fir-draft-text">${draft}</div>
    <button onclick="navigator.clipboard.writeText(document.getElementById('fir-draft-text').textContent).then(()=>this.textContent='Copied!');setTimeout(()=>this.textContent='Copy Draft',2000)"
      style="margin-top:10px;background:#0284c7;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:12px;cursor:pointer">
      Copy Draft
    </button>`;
  document.getElementById('fir-success').after(box);
}

/* ════════════════════════════════════
   PROFILE MENU (Legal Help page)
   ════════════════════════════════════ */
function initProfileDropdown() {
  const navProfile = document.querySelector('.nav-profile');
  if (!navProfile) return;

  navProfile.style.position = 'relative';
  navProfile.style.cursor = 'pointer';

  if (!document.getElementById('profile-dropdown')) {
    navProfile.insertAdjacentHTML('beforeend', `
    <div id="profile-dropdown" style="
      display:none; position:absolute; top:calc(100% + 10px); right:0;
      background:#fff; border:1px solid #e5e7eb; border-radius:12px;
      box-shadow:0 8px 28px rgba(0,0,0,0.12); min-width:170px;
      overflow:hidden; z-index:9999;
    ">
      <div style="padding:12px 16px;font-size:14px;font-weight:600;
                  border-bottom:1px solid #f3f4f6;color:#111;cursor:default;">
        👤 <span id="nav-username">My Account</span>
      </div>
      <button type="button" id="legal-help-logout-btn" style="
        display:flex;align-items:center;gap:8px;width:100%;padding:11px 16px;
        font-size:14px;color:#dc2626;background:none;border:none;cursor:pointer;
        border-top:1px solid #f3f4f6;text-align:left;font-family:inherit;
      " onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='none'">
        🚪 Logout
      </button>
    </div>`);
    document.getElementById('legal-help-logout-btn')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('username');
      sessionStorage.clear();
      window.location.href = 'index.html';
    });
  }

  navProfile.addEventListener('click', (e) => {
    e.stopPropagation();
    const dd = document.getElementById('profile-dropdown');
    if (dd) dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
  });
  document.addEventListener('click', () => {
    const dd = document.getElementById('profile-dropdown');
    if (dd) dd.style.display = 'none';
  });

  try {
    const raw = localStorage.getItem('user') || localStorage.getItem('username');
    if (raw) {
      let name = raw;
      try { name = JSON.parse(raw).username || JSON.parse(raw).name || raw; } catch {}
      const el = document.getElementById('nav-username');
      if (el) el.textContent = name;
    }
  } catch {}
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initLawyers();
  initChat();
  initForm();
  initProfileDropdown();
});