// =============================================
//   RT INVOICE — Dashboard App Logic
//   Design & Developed by Rishbah Shah
// =============================================

let invoices         = [];
let currentInvoiceId = null;
let currentItems     = [];
let currentUserId    = null;

// Small inline seal used inside popup print windows (relative asset paths
// don't resolve from an about:blank document, so we inline the mark).
const SEAL_SVG_INLINE = `<svg width="34" height="34" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#5B4FE0"/><stop offset="55%" stop-color="#7C6CF0"/><stop offset="100%" stop-color="#12A883"/>
  </linearGradient></defs>
  <circle cx="60" cy="60" r="58" fill="url(#pg)"/>
  <circle cx="60" cy="60" r="50" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.4" stroke-dasharray="1.2 4.2"/>
  <text x="60" y="70" text-anchor="middle" font-family="Georgia, serif" font-size="34" font-weight="700" fill="#ffffff">RT</text>
</svg>`;

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  setupModalListeners();
  setupItemListeners();
  setupTaxListeners();
  setupSearch();
  setupHamburger();
  setupGlobalPopoverClose();
  updateCalculations();
});

// ---- Load user invoices (called by auth.js after login check) ----
window.loadUserInvoices = function(userId) {
  currentUserId = userId;
  const all = JSON.parse(localStorage.getItem('rt_invoices') || '[]');
  invoices = all.filter(inv => inv.userId === userId);
  renderInvoiceList();
  updateInvoiceCount();
};

// ---- Persist ----
function saveInvoices() {
  const all    = JSON.parse(localStorage.getItem('rt_invoices') || '[]');
  const others = all.filter(inv => inv.userId !== currentUserId);
  localStorage.setItem('rt_invoices', JSON.stringify([...others, ...invoices]));
  renderInvoiceList();
  updateInvoiceCount();
}

// ---- Helpers ----
function generateInvoiceNumber() {
  const year  = new Date().getFullYear();
  const count = String(invoices.length + 1).padStart(4, '0');
  return `RT-${year}-${count}`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 2
  }).format(amount);
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function invoiceCardHTML(inv) {
  const paid = inv.status === 'Paid';
  return `
    <div class="inv-card ${currentInvoiceId === inv.id ? 'active' : ''}"
         onclick="selectInvoice('${inv.id}')">
      <div class="inv-card-top">
        <span class="inv-num">${inv.invoiceNumber}</span>
        <span class="inv-date">${formatDate(inv.date)}</span>
      </div>
      <div class="inv-customer">${inv.customer.name || 'Guest'}</div>
      <div class="inv-card-top" style="margin-bottom:0">
        <span class="inv-amount">${formatCurrency(inv.grandTotal)}</span>
        <span class="inv-list-status ${paid ? 'is-paid' : ''}">${inv.status || 'Pending'}</span>
      </div>
    </div>
  `;
}

// ---- Render Invoice List ----
function renderInvoiceList() {
  const container  = document.getElementById('invoiceList');
  const emptyState = document.getElementById('emptyInvoices');
  if (!container) return;

  if (invoices.length === 0) {
    emptyState?.classList.remove('hidden');
    container.innerHTML = '';
    return;
  }
  emptyState?.classList.add('hidden');
  container.innerHTML = invoices.map(invoiceCardHTML).join('');
}

function updateInvoiceCount() {
  const el = document.getElementById('invoiceCount');
  if (el) el.textContent = invoices.length;
}

// ---- Search ----
function setupSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.addEventListener('input', e => {
    const term     = e.target.value.toLowerCase();
    const filtered = invoices.filter(inv =>
      inv.invoiceNumber.toLowerCase().includes(term) ||
      (inv.customer.name  || '').toLowerCase().includes(term) ||
      (inv.customer.email || '').toLowerCase().includes(term)
    );
    const container  = document.getElementById('invoiceList');
    const emptyState = document.getElementById('emptyInvoices');
    if (!container) return;
    if (filtered.length === 0) {
      emptyState?.classList.remove('hidden');
      container.innerHTML = '';
    } else {
      emptyState?.classList.add('hidden');
      container.innerHTML = filtered.map(invoiceCardHTML).join('');
    }
  });
}

// ---- Select Invoice ----
window.selectInvoice = function(id) {
  currentInvoiceId = id;
  const inv = invoices.find(i => i.id === id);
  if (inv) { displayInvoice(inv); renderInvoiceList(); }

  // Close sidebar on mobile
  document.querySelector('.sidebar')?.classList.remove('open');
};

// ---- Display Invoice ----
function displayInvoice(inv) {
  const wrapper      = document.getElementById('invoicePreview');
  const emptyPreview = document.getElementById('emptyPreview');
  if (!wrapper) return;

  emptyPreview?.classList.add('hidden');
  wrapper.classList.remove('hidden');

  const dueDate = new Date(new Date(inv.date).getTime() + 15 * 86400000);
  const paid    = inv.status === 'Paid';

  const itemRows = inv.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>${formatCurrency(item.price)}</td>
      <td>${formatCurrency(item.quantity * item.price)}</td>
    </tr>
  `).join('');

  wrapper.innerHTML = `
    <div class="invoice-preview-wrapper">
      <div class="inv-paper">

        <!-- Header bar -->
        <div class="inv-paper-top">
          <div class="inv-brand-row">
            <img src="assets/logo.svg" alt="RT Invoice seal">
            <div>
              <div class="inv-co-name">RT <span>Invoice</span></div>
              <div class="inv-co-details">
                GST: 27AABCR1234F1Z5<br>
                123 Business Avenue, Surat, Gujarat - 395001<br>
                contact@rtinvoice.com &nbsp;|&nbsp; +91 98765 43210
              </div>
            </div>
          </div>
          <div class="inv-title-block">
            <div class="inv-word">INVOICE</div>
            <div class="inv-num-tag">${inv.invoiceNumber}</div>
            <div class="inv-date-tag">Date: ${formatDate(inv.date)}</div>
            <div class="inv-date-tag">Due: ${formatDate(dueDate)}</div>
            <div class="inv-status-tag ${paid ? 'is-paid' : ''}">${inv.status || 'Pending'}</div>
          </div>
        </div>

        <!-- Body -->
        <div class="inv-paper-body">

          <!-- Billing grid -->
          <div class="inv-billing-grid">
            <div>
              <div class="inv-section-label">Bill To</div>
              <div class="inv-client-name">${inv.customer.name || 'N/A'}</div>
              <div class="inv-client-detail">
                ${inv.customer.email   ? inv.customer.email   + '<br>' : ''}
                ${inv.customer.phone   ? inv.customer.phone   + '<br>' : ''}
                ${inv.customer.address ? inv.customer.address + '<br>' : ''}
                ${inv.customer.gst     ? 'GST: ' + inv.customer.gst    : ''}
              </div>
            </div>
            <div>
              <div class="inv-section-label">Payment Details</div>
              <div class="inv-client-detail">
                <strong>Method:</strong> ${inv.paymentMethod}<br>
                <strong>Status:</strong> ${inv.status || 'Pending'}<br>
                <strong>Terms:</strong> Due within 15 days
              </div>
              <div class="inv-payment-badge" style="margin-top:12px">
                💳 ${inv.paymentMethod}
              </div>
            </div>
          </div>

          <!-- Items -->
          <table class="inv-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <!-- Summary -->
          <div class="inv-summary-row">
            <div class="inv-summary-box">
              <div class="inv-sum-line"><span>Subtotal</span><span>${formatCurrency(inv.subtotal)}</span></div>
              <div class="inv-sum-line"><span>CGST (${inv.cgstRate}%)</span><span>${formatCurrency(inv.cgst)}</span></div>
              <div class="inv-sum-line"><span>SGST (${inv.sgstRate}%)</span><span>${formatCurrency(inv.sgst)}</span></div>
              ${inv.discount > 0 ? `<div class="inv-sum-line"><span>Discount (${inv.discountPercent}%)</span><span>−${formatCurrency(inv.discount)}</span></div>` : ''}
              <div class="inv-sum-total"><span>Grand Total</span><span>${formatCurrency(inv.grandTotal)}</span></div>
            </div>
          </div>

          <!-- Bank info -->
          <div style="background:var(--surface);border-radius:var(--r-md);padding:14px 18px;margin-bottom:8px;font-size:13px;color:var(--ink-soft);">
            <strong style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);">Bank / UPI Details</strong><br style="margin-bottom:6px">
            UPI: <strong>rtinvoice@okhdfcbank</strong> &nbsp;|&nbsp; A/C: <strong>9876543210</strong> (HDFC Bank, Surat)
          </div>

          <!-- Signature -->
          <div class="inv-signature-row">
            <div class="inv-signature-note">
              This is a digitally generated invoice from RT Invoice. Payment is due within 15 days
              of the invoice date unless otherwise agreed with the customer.
            </div>
            <div class="inv-signature-block">
              <div class="rt-seal inv-signature-seal">RT</div>
              <div class="inv-signature-text">
                <span class="inv-signature-script">Rishbah Shah</span>
                <div class="inv-signature-line"><span class="inv-signature-label">Authorized Signatory</span></div>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="inv-actions">
            <button class="btn-danger-ghost" onclick="deleteInvoice('${inv.id}')">
              🗑️ Delete
            </button>
            <button class="btn-secondary" onclick="markPaid('${inv.id}')">
              ${paid ? '↺ Mark Pending' : '✓ Mark as Paid'}
            </button>
            <div class="share-wrap">
              <button class="btn-secondary" onclick="toggleShare('${inv.id}', event)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" style="vertical-align:-2px;margin-right:2px">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.6" y1="10.6" x2="15.4" y2="6.4"/><line x1="8.6" y1="13.4" x2="15.4" y2="17.6"/>
                </svg>
                Share
              </button>
              <div class="share-popover hidden" id="sharePop-${inv.id}">
                <button class="share-opt" onclick="shareVia('${inv.id}','whatsapp')"><span class="share-emoji">🟢</span> WhatsApp</button>
                <button class="share-opt" onclick="shareVia('${inv.id}','email')"><span class="share-emoji">✉️</span> Email</button>
                <button class="share-opt" onclick="shareVia('${inv.id}','copy')"><span class="share-emoji">📋</span> Copy summary</button>
                <button class="share-opt" onclick="shareVia('${inv.id}','native')"><span class="share-emoji">📤</span> More options</button>
              </div>
            </div>
            <button class="btn-primary" onclick="printInvoice('${inv.id}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <path d="M6 9V3h12v6"/><rect x="6" y="15" width="12" height="6" rx="2"/>
              </svg>
              Print / PDF
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="inv-footer">
          <div class="inv-footer-brand">RT Invoice</div>
          <div class="inv-footer-credit">
            © ${new Date().getFullYear()} RT Invoice &nbsp;·&nbsp; Design &amp; Developed by <strong>Rishbah Shah</strong>
          </div>
        </div>

      </div>
    </div>
  `;
}

// ---- Delete Invoice ----
window.deleteInvoice = function(id) {
  if (!confirm('Delete this invoice? This cannot be undone.')) return;
  invoices = invoices.filter(i => i.id !== id);
  saveInvoices();
  currentInvoiceId = null;
  document.getElementById('invoicePreview')?.classList.add('hidden');
  document.getElementById('emptyPreview')?.classList.remove('hidden');
  showToast('Invoice deleted', 'warning');
};

// ---- Mark Paid / Pending ----
window.markPaid = function(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  inv.status = inv.status === 'Paid' ? 'Pending' : 'Paid';
  saveInvoices();
  displayInvoice(inv);
  renderInvoiceList();
  showToast(inv.status === 'Paid' ? `${inv.invoiceNumber} marked as paid ✓` : `${inv.invoiceNumber} marked as pending`, 'success');
};

// =====================
// SHARE INVOICE
// =====================
function buildShareText(inv) {
  const lines = [
    `🧾 RT Invoice — ${inv.invoiceNumber}`,
    `Customer: ${inv.customer.name || 'N/A'}`,
    `Date: ${formatDate(inv.date)}`,
    `Amount Due: ${formatCurrency(inv.grandTotal)}`,
    `Status: ${inv.status || 'Pending'}`,
    `Payment Method: ${inv.paymentMethod}`,
    ``,
    `Items:`,
    ...inv.items.map(it => `• ${it.name} × ${it.quantity} — ${formatCurrency(it.quantity * it.price)}`),
    ``,
    `Pay via UPI: rtinvoice@okhdfcbank`,
    `Thank you for your business — RT Invoice`
  ];
  return lines.join('\n');
}

window.toggleShare = function(id, event) {
  event?.stopPropagation();
  const pop = document.getElementById(`sharePop-${id}`);
  if (!pop) return;
  const wasHidden = pop.classList.contains('hidden');
  document.querySelectorAll('.share-popover').forEach(p => p.classList.add('hidden'));
  if (wasHidden) pop.classList.remove('hidden');
};

function setupGlobalPopoverClose() {
  document.addEventListener('click', e => {
    if (!e.target.closest('.share-wrap')) {
      document.querySelectorAll('.share-popover').forEach(p => p.classList.add('hidden'));
    }
  });
}

window.shareVia = async function(id, channel) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  const text = buildShareText(inv);
  document.querySelectorAll('.share-popover').forEach(p => p.classList.add('hidden'));

  if (channel === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  } else if (channel === 'email') {
    const subject = `RT Invoice ${inv.invoiceNumber} — ${formatCurrency(inv.grandTotal)}`;
    window.location.href = `mailto:${inv.customer.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  } else if (channel === 'copy') {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Invoice summary copied to clipboard 📋', 'success');
    } catch {
      showToast('Could not copy — please copy manually', 'error');
    }
  } else if (channel === 'native') {
    if (navigator.share) {
      try {
        await navigator.share({ title: `RT Invoice ${inv.invoiceNumber}`, text });
      } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        showToast('Sharing not supported here — summary copied instead', 'warning');
      } catch {
        showToast('Sharing is not supported on this device', 'error');
      }
    }
  }
};

// ---- Print Invoice ----
window.printInvoice = function(id) {
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;

  const dueDate = new Date(new Date(inv.date).getTime() + 15 * 86400000);
  const paid    = inv.status === 'Paid';

  const itemRows = inv.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${formatCurrency(item.price)}</td>
      <td style="text-align:right;font-weight:600">${formatCurrency(item.quantity * item.price)}</td>
    </tr>
  `).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="en"><head>
    <meta charset="UTF-8">
    <title>${inv.invoiceNumber} — RT Invoice</title>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&family=Caveat:wght@600;700&display=swap" rel="stylesheet">
    <style>
      * { margin:0;padding:0;box-sizing:border-box; }
      body { font-family:'Inter',sans-serif; color:#17162c; background:#fff; padding:36px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; padding:30px 38px; background:#17162c; border-radius:18px 18px 0 0; }
      .brand-row { display:flex; align-items:center; gap:12px; }
      .co-name { font-family:'Fraunces',serif; font-size:24px; font-weight:700; color:#fff; }
      .co-name span { color:#7ee0c4; }
      .co-details { font-size:12px; color:rgba(255,255,255,.55); line-height:1.8; margin-top:6px; }
      .inv-block { text-align:right; }
      .inv-word { font-family:'Fraunces',serif; font-size:32px; font-weight:700; color:rgba(255,255,255,.14); letter-spacing:.08em; }
      .inv-num { font-family:'IBM Plex Mono',monospace; font-size:13px; font-weight:700; color:#fff; margin-top:4px; }
      .inv-date { font-size:12px; color:rgba(255,255,255,.55); margin-top:3px; }
      .status-tag { display:inline-block; margin-top:8px; font-size:10px; font-weight:700; padding:3px 10px; border-radius:999px; text-transform:uppercase; letter-spacing:.05em; background:${paid ? 'rgba(18,168,131,.25)' : 'rgba(234,156,46,.25)'}; color:${paid ? '#7ee0c4' : '#ffc978'}; }
      .body { padding:30px 38px; border:1px solid #e6e0cf; border-top:none; border-radius:0 0 18px 18px; }
      .billing { display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-bottom:26px; padding-bottom:22px; border-bottom:1px solid #e6e0cf; }
      .sec-label { font-size:10px; font-weight:700; color:#8b889f; text-transform:uppercase; letter-spacing:.1em; margin-bottom:8px; }
      .client-name { font-size:15px; font-weight:700; margin-bottom:6px; }
      .client-detail { font-size:12.5px; color:#4a4863; line-height:1.8; }
      table { width:100%; border-collapse:collapse; margin-bottom:22px; }
      th { padding:9px 12px; background:#f2eee3; font-size:11px; font-weight:700; color:#8b889f; text-transform:uppercase; letter-spacing:.08em; text-align:left; border-bottom:1.5px solid #e6e0cf; }
      td { padding:11px 12px; font-size:13px; color:#4a4863; border-bottom:1px solid #e6e0cf; font-family:'IBM Plex Mono',monospace; }
      td:first-child { font-family:'Inter',sans-serif; color:#17162c; }
      .sum-box { width:290px; margin-left:auto; background:#f2eee3; border-radius:12px; padding:16px 20px; }
      .sum-line { display:flex; justify-content:space-between; font-size:13px; color:#4a4863; padding:4px 0; font-family:'IBM Plex Mono',monospace; }
      .sum-total { display:flex; justify-content:space-between; font-family:'Fraunces',serif; font-size:18px; font-weight:700; color:#5b4fe0; border-top:2px solid #e6e0cf; margin-top:8px; padding-top:12px; }
      .bank-box { background:#f2eee3; border-radius:10px; padding:14px 18px; margin:22px 0; font-size:13px; color:#4a4863; }
      .sig-row { display:flex; justify-content:space-between; align-items:flex-end; margin-top:14px; gap:20px; }
      .sig-note { font-size:11px; color:#8b889f; max-width:300px; line-height:1.7; }
      .sig-block { display:flex; align-items:center; gap:12px; }
      .sig-text { text-align:right; }
      .sig-script { font-family:'Caveat',cursive; font-size:30px; font-weight:700; color:#17162c; display:inline-block; transform:rotate(-2deg); }
      .sig-line { width:150px; border-top:1.4px solid #4a4863; margin-top:2px; padding-top:4px; font-size:9.5px; color:#8b889f; text-transform:uppercase; letter-spacing:.08em; font-weight:700; }
      .footer { text-align:center; font-size:11px; color:#8b889f; padding-top:18px; border-top:1px solid #e6e0cf; margin-top:18px; }
    </style>
  </head><body>
    <div class="header">
      <div class="brand-row">
        ${SEAL_SVG_INLINE}
        <div>
          <div class="co-name">RT <span>Invoice</span></div>
          <div class="co-details">GST: 27AABCR1234F1Z5<br>123 Business Avenue, Surat, Gujarat - 395001<br>contact@rtinvoice.com | +91 98765 43210</div>
        </div>
      </div>
      <div class="inv-block">
        <div class="inv-word">INVOICE</div>
        <div class="inv-num">${inv.invoiceNumber}</div>
        <div class="inv-date">Date: ${formatDate(inv.date)}</div>
        <div class="inv-date">Due: ${formatDate(dueDate)}</div>
        <div class="status-tag">${inv.status || 'Pending'}</div>
      </div>
    </div>
    <div class="body">
      <div class="billing">
        <div>
          <div class="sec-label">Bill To</div>
          <div class="client-name">${inv.customer.name || 'N/A'}</div>
          <div class="client-detail">
            ${inv.customer.email   ? inv.customer.email   + '<br>' : ''}
            ${inv.customer.phone   ? inv.customer.phone   + '<br>' : ''}
            ${inv.customer.address ? inv.customer.address + '<br>' : ''}
            ${inv.customer.gst     ? 'GST: ' + inv.customer.gst    : ''}
          </div>
        </div>
        <div>
          <div class="sec-label">Payment</div>
          <div class="client-detail">
            Method: ${inv.paymentMethod}<br>
            Status: ${inv.status || 'Pending'}<br>
            Terms: Due within 15 days
          </div>
        </div>
      </div>
      <table>
        <thead><tr><th>Description</th><th>Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="sum-box">
        <div class="sum-line"><span>Subtotal</span><span>${formatCurrency(inv.subtotal)}</span></div>
        <div class="sum-line"><span>CGST (${inv.cgstRate}%)</span><span>${formatCurrency(inv.cgst)}</span></div>
        <div class="sum-line"><span>SGST (${inv.sgstRate}%)</span><span>${formatCurrency(inv.sgst)}</span></div>
        ${inv.discount > 0 ? `<div class="sum-line"><span>Discount (${inv.discountPercent}%)</span><span>−${formatCurrency(inv.discount)}</span></div>` : ''}
        <div class="sum-total"><span>Grand Total</span><span>${formatCurrency(inv.grandTotal)}</span></div>
      </div>
      <div class="bank-box"><strong style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#8b889f">Bank / UPI Details</strong><br>UPI: rtinvoice@okhdfcbank &nbsp;|&nbsp; A/C: 9876543210 (HDFC Bank, Surat)</div>
      <div class="sig-row">
        <div class="sig-note">This is a digitally generated invoice from RT Invoice. Payment is due within 15 days of the invoice date unless otherwise agreed.</div>
        <div class="sig-block">
          ${SEAL_SVG_INLINE}
          <div class="sig-text">
            <span class="sig-script">Rishbah Shah</span>
            <div class="sig-line">Authorized Signatory</div>
          </div>
        </div>
      </div>
      <div class="footer">
        © ${new Date().getFullYear()} RT Invoice &nbsp;·&nbsp; Design &amp; Developed by <strong>Rishbah Shah</strong>
      </div>
    </div>
    <script>window.onload = () => { window.print(); };<\/script>
  </body></html>`);
  win.document.close();
};

// =====================
// MODAL
// =====================
const modal = document.getElementById('invoiceModal');

function openModal() {
  if (!modal) return;
  modal.classList.add('active');
  resetModal();
  showStep(1);
  document.getElementById('modalTitle').textContent = 'New Invoice — Customer Info';
}

function closeModalFn() {
  modal?.classList.remove('active');
}

function resetModal() {
  ['custName','custEmail','custPhone','custAddress','custGst'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('cgstRate').value     = '2.5';
  document.getElementById('sgstRate').value     = '2.5';
  document.getElementById('discountRate').value = '0';
  currentItems = [];
  renderItemsTable();
  updateCalculations();
}

function showStep(n) {
  document.querySelectorAll('.modal-step').forEach(s => s.classList.remove('active'));
  document.getElementById('step' + n)?.classList.add('active');
  // update step dots & line
  for (let i = 1; i <= 2; i++) {
    const dot  = document.getElementById('stepDot' + i);
    const fill = document.getElementById('stepFill' + i);
    if (dot) {
      dot.classList.remove('active','done');
      if (i < n)  dot.classList.add('done');
      if (i === n) dot.classList.add('active');
    }
    if (fill) fill.style.width = i < n ? '100%' : '0%';
  }
}

function setupModalListeners() {
  document.getElementById('createInvoiceBtn')?.addEventListener('click', openModal);
  document.getElementById('emptyCreateBtn')?.addEventListener('click', openModal);
  document.getElementById('closeModalBtn')?.addEventListener('click', closeModalFn);

  modal?.addEventListener('click', e => { if (e.target === modal) closeModalFn(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) closeModalFn();
  });

  document.getElementById('nextToStep2')?.addEventListener('click', () => {
    const name  = document.getElementById('custName').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    if (!name || !email) { showToast('Name and email are required', 'error'); return; }
    showStep(2);
    document.getElementById('modalTitle').textContent = 'New Invoice — Items & Payment';
  });

  document.getElementById('backToStep1')?.addEventListener('click', () => {
    showStep(1);
    document.getElementById('modalTitle').textContent = 'New Invoice — Customer Info';
  });

  document.getElementById('generateInvoiceBtn')?.addEventListener('click', generateInvoice);
}

// =====================
// ITEMS
// =====================
function setupItemListeners() {
  document.getElementById('addItemButton')?.addEventListener('click', addItem);
  document.getElementById('itemPrice')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addItem();
  });
}

function addItem() {
  const name  = document.getElementById('itemName').value.trim();
  const qty   = parseInt(document.getElementById('itemQty').value);
  const price = parseFloat(document.getElementById('itemPrice').value);
  if (!name || !qty || isNaN(price) || price < 0) {
    showToast('Please fill in all item fields', 'error'); return;
  }
  currentItems.push({ name, quantity: qty, price });
  renderItemsTable();
  document.getElementById('itemName').value  = '';
  document.getElementById('itemQty').value   = '1';
  document.getElementById('itemPrice').value = '';
  document.getElementById('itemName').focus();
  showToast('Item added ✓', 'success');
}

function renderItemsTable() {
  const tbody = document.getElementById('itemsTableBody');
  if (!tbody) return;
  if (currentItems.length === 0) {
    tbody.innerHTML = `
      <tr id="emptyItemRow">
        <td colspan="5" style="text-align:center;color:var(--muted);font-size:13px;padding:18px">
          No items added yet — use the form below
        </td>
      </tr>`;
  } else {
    tbody.innerHTML = currentItems.map((item, i) => `
      <tr>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(item.price)}</td>
        <td>${formatCurrency(item.quantity * item.price)}</td>
        <td><button class="delete-item" onclick="removeItem(${i})">🗑️</button></td>
      </tr>
    `).join('');
  }
  updateCalculations();
}

window.removeItem = function(index) {
  currentItems.splice(index, 1);
  renderItemsTable();
};

// =====================
// CALCULATIONS
// =====================
function setupTaxListeners() {
  ['cgstRate','sgstRate','discountRate'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateCalculations);
  });
}

function updateCalculations() {
  const subtotal        = currentItems.reduce((s, i) => s + i.quantity * i.price, 0);
  const cgstRate         = parseFloat(document.getElementById('cgstRate')?.value)     || 0;
  const sgstRate         = parseFloat(document.getElementById('sgstRate')?.value)     || 0;
  const discountPercent  = parseFloat(document.getElementById('discountRate')?.value) || 0;

  const cgst     = subtotal * (cgstRate / 100);
  const sgst     = subtotal * (sgstRate / 100);
  const discount = subtotal * (discountPercent / 100);
  const grand    = subtotal + cgst + sgst - discount;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('summarySubtotal',   formatCurrency(subtotal));
  set('summaryCgst',       formatCurrency(cgst));
  set('summarySgst',       formatCurrency(sgst));
  set('summaryDiscount',   formatCurrency(discount));
  set('summaryGrandTotal', formatCurrency(grand));
  set('cgstLabel', cgstRate);
  set('sgstLabel', sgstRate);

  return { subtotal, cgstRate, sgstRate, cgst, sgst, discountPercent, discount, grandTotal: grand };
}

// =====================
// GENERATE INVOICE
// =====================
function generateInvoice() {
  if (currentItems.length === 0) {
    showToast('Add at least one item', 'error'); return;
  }

  const get = id => document.getElementById(id)?.value?.trim() || '';
  const name          = get('custName');
  const email         = get('custEmail');
  const phone         = get('custPhone');
  const address       = get('custAddress');
  const gst           = get('custGst');
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'UPI';
  const calc          = updateCalculations();

  const newInv = {
    id: Date.now().toString(),
    userId: currentUserId,
    invoiceNumber: generateInvoiceNumber(),
    date: new Date().toISOString(),
    status: 'Pending',
    customer: { name, email, phone, address, gst },
    items: [...currentItems],
    paymentMethod,
    ...calc
  };

  invoices.unshift(newInv);
  saveInvoices();
  selectInvoice(newInv.id);
  closeModalFn();
  showToast(`${newInv.invoiceNumber} created — ${formatCurrency(calc.grandTotal)}`, 'success');
}

// =====================
// HAMBURGER (mobile)
// =====================
function setupHamburger() {
  const btn     = document.getElementById('hamburgerBtn');
  const sidebar = document.querySelector('.sidebar');
  if (!btn || !sidebar) return;
  btn.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', e => {
    if (!sidebar.contains(e.target) && e.target !== btn) {
      sidebar.classList.remove('open');
    }
  });
}