const API = 'http://localhost:5000/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('user'));

if (!token || user?.role !== 'lawyer') {
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    lucide?.createIcons?.();
    fetchCases();
    initProfileDropdown();
});

/* ── PROFILE DROPDOWN ── */
function initProfileDropdown() {
    const trigger = document.getElementById('nav-profile-trigger');
    const container = document.getElementById('profile-dropdown-container');
    if (!trigger || !container) return;

    container.innerHTML = `
        <div id="profile-dropdown" class="glass-card" style="
            display:none; position:absolute; top:70px; right:6%;
            min-width:200px; z-index:9999; padding: 8px 0;
        ">
            <div style="padding:12px 20px; font-size:0.8rem; font-weight:700; border-bottom:1px solid var(--glass-border); color:var(--gold); text-transform:uppercase;">
                👤 <span id="dd-username">${user?.name || 'Lawyer'}</span>
            </div>
            <button onclick="logout()" style="display:flex; align-items:center; gap:12px; width:100%; padding:14px 20px; font-size:0.9rem; color:#ef4444; background:none; border:none; cursor:pointer; text-align:left; font-family:inherit; font-weight:600;" onmouseover="this.style.background='rgba(239, 68, 68, 0.1)'" onmouseout="this.style.background='none'">
                🚪 Logout session
            </button>
        </div>
    `;

    trigger.onclick = (e) => {
        e.stopPropagation();
        const dd = document.getElementById('profile-dropdown');
        dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
    };

    document.onclick = () => {
        const dd = document.getElementById('profile-dropdown');
        if (dd) dd.style.display = 'none';
    };
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

/* ── CASE MATRIX LOGIC ── */
async function fetchCases() {
    const list = document.getElementById('case-list-container');
    try {
        const res = await fetch(`${API}/cases/my`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const cases = data.cases || [];

        document.getElementById('stat-total').textContent = cases.length;
        document.getElementById('stat-active').textContent = cases.filter(c => c.status === 'active').length;
        
        // We'll calculate verified count from evidence, but for now sum total cases
        document.getElementById('stat-verified').textContent = cases.reduce((acc, c) => acc + (c.evidenceCount || 0), 0);

        if (cases.length === 0) {
            list.innerHTML = `<div class="glass-card" style="padding:40px; text-align:center; color:var(--text-secondary)">No active dossier found in the current jurisdiction.</div>`;
            return;
        }

        list.innerHTML = cases.map(c => `
            <div class="glass-card case-card" onclick="showDetails('${c._id}')">
                <div class="case-icon-box">
                    <i data-lucide="folder"></i>
                </div>
                <div class="case-info">
                    <h3>${c.title}</h3>
                    <p>Client: ${c.clientName} | Case #${c._id.slice(-6)}</p>
                </div>
                <div class="case-actions">
                    <span class="badge" style="background:rgba(16,185,129,0.1); color:var(--emerald)">${c.status.toUpperCase()}</span>
                    <i data-lucide="chevron-right" style="color:var(--text-secondary)"></i>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    } catch (err) {
        list.innerHTML = `<div class="glass-card" style="padding:20px; color:#ef4444">Matrix link failure: Check secure server status.</div>`;
    }
}

async function createCase() {
    const title = document.getElementById('m-title').value;
    const clientName = document.getElementById('m-client').value;
    const type = document.getElementById('m-type').value;
    const description = document.getElementById('m-desc').value;

    if (!title || !clientName) return alert('Dossier requires title and client identification.');

    try {
        const res = await fetch(`${API}/cases/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title, clientName, caseType: type, description })
        });
        if (res.ok) {
            hideCreateModal();
            fetchCases();
        }
    } catch (err) {
        console.error(err);
    }
}

/* ── CASE DETAILS & EVIDENCE ── */
let currentCaseId = null;

async function loadCaseDetails(caseId) {
    currentCaseId = caseId;
    const timeline = document.getElementById('evidence-timeline');
    timeline.innerHTML = '<p style="color:var(--text-secondary)">Decrypting evidence ledger...</p>';

    try {
        // Fetch specific case info for the header (optional, or pass from list)
        // For now, let's just fetch evidence
        const resEv = await fetch(`${API}/evidence/${caseId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await resEv.json();
        const evidenceList = data.evidence || [];

        // Update header from some global state or refetch (simplified here)
        // document.getElementById('det-title').textContent = ...;

        if (evidenceList.length === 0) {
            timeline.innerHTML = '<p style="color:var(--text-secondary)">No digital evidence has been committed to this ledger.</p>';
        } else {
            timeline.innerHTML = evidenceList.map(ev => `
                <div class="timeline-item">
                    <div class="timeline-node" id="node-${ev._id}"></div>
                    <div class="timeline-content">
                        <div class="timeline-time">${new Date(ev.timestamp).toLocaleString()}</div>
                        <div class="timeline-title">${ev.description}</div>
                        <div style="font-family:monospace; color:var(--gold); font-size:0.75rem; margin: 8px 0; word-break:break-all;">
                            HASH: ${ev.hash}
                        </div>
                        <div style="display:flex; gap:12px; margin-top:16px;">
                            <button class="btn-premium" onclick="verifyEvidence('${ev._id}')" style="padding:4px 12px; font-size:0.75rem;">
                                Verify Integrity
                            </button>
                            <button class="btn-premium" onclick="loadActivity('${ev._id}')" style="padding:4px 12px; font-size:0.75rem; background:transparent; border-color:var(--glass-border)">
                                Chain of Custody
                            </button>
                            <a href="http://localhost:5000${ev.fileUrl}" target="_blank" class="btn-premium" style="padding:4px 12px; font-size:0.75rem; text-decoration:none;">
                                View File
                            </a>
                        </div>
                        <div id="activity-box-${ev._id}" style="margin-top:16px;"></div>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        timeline.innerHTML = 'Ledger sync error.';
    }
}

async function uploadEvidence() {
    const desc = document.getElementById('file-desc').value;
    const file = document.getElementById('file-in').files[0];
    if (!desc || !file) return alert('Description and file transmission required.');

    const formData = new FormData();
    formData.append('caseId', currentCaseId);
    formData.append('description', desc);
    formData.append('file', file);

    try {
        const res = await fetch(`${API}/evidence/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (res.ok) {
            document.getElementById('file-desc').value = '';
            document.getElementById('file-in').value = '';
            loadCaseDetails(currentCaseId);
        }
    } catch (err) {
        alert('Transmission failure.');
    }
}

async function verifyEvidence(evId) {
    const node = document.getElementById(`node-${evId}`);
    try {
        const res = await fetch(`${API}/evidence/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ evidenceId: evId })
        });
        const data = await res.json();
        if (data.status === 'Valid' || data.status === 'valid') {
            node.className = 'timeline-node verified';
            alert('INTEGRITY CONFIRMED: SHA-256 match found.');
        } else {
            node.className = 'timeline-node tampered';
            alert('SECURITY ALERT: Hash mismatch! Document integrity compromised.');
        }
    } catch (err) {
        alert('Verification service offline.');
    }
}

async function loadActivity(evId) {
    const box = document.getElementById(`activity-box-${evId}`);
    box.innerHTML = '<span style="font-size:0.75rem">Synchronizing audit trail...</span>';
    try {
        const res = await fetch(`${API}/evidence/activity/${evId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        const logs = data.logs || [];
        
        box.innerHTML = logs.map(l => `
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:4px; padding-left:12px; border-left:1px solid var(--emerald)">
                <span style="color:var(--emerald)">${l.action}</span> by ${l.performedBy?.username || 'System'} 
                <span style="opacity:0.5">— ${new Date(l.timestamp).toLocaleTimeString()}</span>
            </div>
        `).join('');
    } catch (err) {
        box.innerHTML = 'Audit trail sync error.';
    }
}
