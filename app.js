// MoneyMind AI Frontend - Vanilla JS
const API_BASE = '/api';
let token = localStorage.getItem('token') || null;
let currentUser = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  if (token) {
    await loadUserProfile();
    showApp();
  } else {
    showAuth();
  }
  loadServiceStatus();
});

// Auth Functions
async function register() {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const phone = document.getElementById('phone')?.value.trim() || '';

  if (!name || !email || !password) {
    showMessage('Name, email, and password are required', 'error');
    return;
  }

  showMessage('Creating account...', 'loading');
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Registration failed');
    }

    const data = await res.json();
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
    showMessage('Account created successfully!', 'success');
    setTimeout(() => showApp(), 1000);
  } catch (err) {
    showMessage('Error: ' + err.message, 'error');
  }
}

async function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    showMessage('Email and password are required', 'error');
    return;
  }

  showMessage('Logging in...', 'loading');
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await res.json();
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
    showMessage('Logged in successfully!', 'success');
    setTimeout(() => showApp(), 500);
  } catch (err) {
    showMessage('Error: ' + err.message, 'error');
  }
}

async function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showMessage('Logged out', 'success');
  setTimeout(() => showAuth(), 500);
}

async function loadUserProfile() {
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      localStorage.setItem('user', JSON.stringify(currentUser));
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

// Chat and Plans
async function chat() {
  const message = document.getElementById('message').value.trim();
  if (!message) {
    showMessage('Please enter a message', 'error');
    return;
  }

  const resultEl = document.getElementById('result');
  resultEl.innerHTML = '<p class="loading">Processing your request...</p>';

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ message })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Chat failed');
    }

    const data = await res.json();
    const plan = data.plan || {};
    const reply = data.reply || '';

    let html = `<h4>AI Response:</h4><p>${escapeHtml(reply)}</p>`;
    if (plan.selectedAgents && plan.selectedAgents.length > 0) {
      html += `<h4>Agents Selected:</h4><ul>`;
      plan.selectedAgents.forEach(agent => {
        html += `<li>${escapeHtml(agent)}</li>`;
      });
      html += `</ul>`;
    }
    if (plan.plan && plan.plan.length > 0) {
      html += `<h4>Execution Plan:</h4><ol>`;
      plan.plan.forEach(step => {
        html += `<li><strong>${escapeHtml(step.agent)}</strong>: ${escapeHtml(step.task)}</li>`;
      });
      html += `</ol>`;
    }
    resultEl.innerHTML = html;
    document.getElementById('message').value = '';
    showMessage('Request processed', 'success');
  } catch (err) {
    resultEl.innerHTML = `<p class="error">Error: ${escapeHtml(err.message)}</p>`;
    showMessage('Error: ' + err.message, 'error');
  }
}

async function loadPlans() {
  try {
    const res = await fetch(`${API_BASE}/plans`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Failed to load plans');

    const plans = await res.json();
    const plansEl = document.getElementById('plans');
    if (!plansEl) return;

    if (plans.length === 0) {
      plansEl.innerHTML = '<p class="empty">No plans yet. Ask MoneyMind AI a question to get started!</p>';
      return;
    }

    let html = '<h4>Recent Plans</h4>';
    plans.forEach(plan => {
      const date = new Date(plan.createdAt).toLocaleDateString();
      html += `
        <div class="plan-item">
          <p><strong>${escapeHtml(plan.message)}</strong></p>
          <small>${date}</small>
        </div>
      `;
    });
    plansEl.innerHTML = html;
  } catch (err) {
    console.error('Failed to load plans:', err);
  }
}

// Service Status
async function loadServiceStatus() {
  try {
    const statuses = {};
    const services = ['payment', 'sms', 'email', 'push', 'kyc'];

    for (const service of services) {
      try {
        const res = await fetch(`${API_BASE}/${service}/status`);
        if (res.ok) {
          statuses[service] = await res.json();
        }
      } catch (err) {
        console.error(`Failed to load ${service} status:`, err);
      }
    }

    const statusEl = document.getElementById('status');
    if (!statusEl) return;

    let html = '<div class="status-grid">';
    Object.entries(statuses).forEach(([service, data]) => {
      const enabled = data.enabled ? '✓' : '✗';
      const enabledClass = data.enabled ? 'enabled' : 'disabled';
      html += `<div class="status-item ${enabledClass}"><strong>${service}</strong>: ${enabled}</div>`;
    });
    html += '</div>';
    statusEl.innerHTML = html;
  } catch (err) {
    console.error('Failed to load service status:', err);
  }
}

// UI Functions
function showAuth() {
  document.getElementById('auth').style.display = 'block';
  document.getElementById('app').style.display = 'none';
  document.getElementById('name').value = '';
  document.getElementById('email').value = '';
  document.getElementById('password').value = '';
}

function showApp() {
  document.getElementById('auth').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  if (currentUser) {
    document.getElementById('who').textContent = `Welcome, ${currentUser.name}!`;
  }
  loadPlans();
  loadServiceStatus();
}

function showMessage(text, type = 'info') {
  const msgEl = document.getElementById('msg');
  msgEl.textContent = text;
  msgEl.className = `message message-${type}`;
  if (type !== 'loading') {
    setTimeout(() => {
      msgEl.textContent = '';
      msgEl.className = '';
    }, 3000);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Handle Enter key in auth form
document.addEventListener('DOMContentLoaded', () => {
  const passwordInput = document.getElementById('password');
  if (passwordInput) {
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const authSection = document.getElementById('auth');
        if (authSection && authSection.style.display !== 'none') {
          login();
        }
      }
    });
  }
});
