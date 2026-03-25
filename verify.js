/** 
 * verify.js - Logic for receipt verification 
 */

const API_URL = API_CONFIG.BASE_URL;

let dataCache = {
    donate: null,
    workshop: null
};

let activeTab = 'donate';
let currentStatusFilter = 'all';
let currentProcessingOrder = null;

document.addEventListener('DOMContentLoaded', () => {
    switchTab('donate');
    setupFormHandlers();
});

async function switchTab(tab) {
    activeTab = tab;

    // UI update
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    // Clear feed first
    const container = document.getElementById('feed-container');
    container.innerHTML = '';

    if (dataCache[tab]) {
        renderFeed(dataCache[tab], tab);
    } else {
        await fetchFeed(tab);
    }
}

async function fetchFeed(tab) {
    showLoading(true);
    try {
        const action = tab === 'donate' ? 'getDonateFeed' : 'getWorkshopFeed';
        const response = await fetch(`${API_URL}?action=${action}`);
        const result = await response.json();

        if (result.status === 'ok') {
            dataCache[tab] = result.data;
            // Update counts in info bar
            const count = result.count || result.data.length;
            document.getElementById('tab-info-bar').innerText = `พบรายการทั้งหมด ${count} รายการ`;
            renderFeed(result.data, tab);
        } else {
            showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + result.message);
        }
    } catch (error) {
        console.error('Fetch error:', error);
        showToast('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
        showLoading(false);
    }
}

function refreshCurrentTab() {
    dataCache[activeTab] = null;
    fetchFeed(activeTab);
}

function filterByStatus(status, btn) {
    currentStatusFilter = status;

    // UI update for filter buttons
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (dataCache[activeTab]) {
        renderFeed(dataCache[activeTab], activeTab);
    }
}

function renderFeed(items, type) {
    const container = document.getElementById('feed-container');
    container.innerHTML = '';

    if (!items || items.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-muted); font-weight: 700;">ไม่พบข้อมูลรายการ</div>';
        return;
    }

    // Apply Status Filter
    let filtered = items;
    if (currentStatusFilter !== 'all') {
        filtered = items.filter(item => {
            const rawStatus = item.status || (type === 'donate' ? item.donate_status : item.workshop_status);
            const status = String(rawStatus || '').trim().toLowerCase();
            return status === currentStatusFilter.toLowerCase();
        });
    }

    // Sort by order descending (latest first)
    const sorted = [...filtered].sort((a, b) => b.order - a.order);

    // Update info bar with filtered count
    const totalCount = items.length;
    const filteredCount = sorted.length;
    document.getElementById('tab-info-bar').innerText =
        currentStatusFilter === 'all'
            ? `พบรายการทั้งหมด ${totalCount} รายการ`
            : `พบรายการที่กรองไว้ ${filteredCount} จาก ${totalCount} รายการ`;

    if (sorted.length === 0) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-muted); font-weight: 700;">ไม่พบรายการสถานะ "${currentStatusFilter}"</div>`;
        return;
    }

    sorted.forEach(item => {
        const card = createCardElement(item, type);
        container.appendChild(card);
    });
}

function createCardElement(item, type) {
    const rawStatus = item.status || (type === 'donate' ? item.donate_status : item.workshop_status);
    const status = String(rawStatus || 'pending').toLowerCase();
    const card = document.createElement('div');
    card.className = `card status-${status}`;
    card.id = `card-${type}-${item.order}`;

    const issueDateStr = formatDate(item.issue_date);
    const transDateStr = formatDate(item.transaction_date);

    // Status Label Translation
    const statusMap = {
        'pending': 'รอตรวจสอบ',
        'approved': 'ผ่าน',
        'rejected': 'ไม่ผ่าน'
    };

    // Shipping alert
    const shippingHtml = item.include_shipping
        ? '<div class="shipping-alert">📢 หักค่าส่ง</div>'
        : '';

    // Status Area Logic
    let statusAreaHtml = '';
    if (status === 'pending') {
        statusAreaHtml = `
            <div class="status-workflow-area">
                <button class="status-vibrant-btn approved" onclick="updateStatus(${item.order}, 'approved', '${type}')">ผ่าน</button>
                <button class="status-vibrant-btn rejected" onclick="updateStatus(${item.order}, 'rejected', '${type}')">ไม่ผ่าน</button>
            </div>
        `;
    } else {
        statusAreaHtml = `
            <div class="status-workflow-area" id="status-toggle-${type}-${item.order}">
                <button class="btn-change-status-new" onclick="showStatusSelection(${item.order}, '${type}')">เปลี่ยนสถานะ</button>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="card-status-header">
            <div class="issue-date-label">#${item.order} | แจ้งเมื่อ: ${issueDateStr}</div>
            <div class="status-label">${statusMap[status] || status}</div>
        </div>

        <div class="card-split-section">
            <div class="card-image-wrapper" onclick="window.open('${item.image}', '_blank')">
                <img src="${item.image}" class="card-image" alt="Receipt" onerror="this.src='https://placehold.co/400x600?text=No+Image'">
            </div>
            
            <div class="card-details-side">
                <div class="detail-row">
                    <span class="detail-label">ยอดโอน</span>
                    <div class="amount-mega">฿${item.amount.toLocaleString()}</div>
                </div>
                ${type === 'workshop' ? `
                <div class="detail-row">
                    <span class="detail-label">จำนวนไอเทม</span>
                    <div class="detail-value" style="color:#6366F1; font-weight:800; font-size:1.1rem;">${item.item_count} ชิ้น</div>
                </div>
                ` : ''}
                <div class="detail-row">
                    <span class="detail-label">วันเวลาโอน</span>
                    <div class="detail-value">${transDateStr}</div>
                </div>
                <div class="detail-row">
                    <span class="detail-label">เลขธุรกรรม</span>
                    <div class="detail-value" style="font-size:0.75rem;">${item.transaction_ref}</div>
                </div>
                <div class="detail-row">
                    <span class="detail-label">ชื่อผู้โอน</span>
                    <div class="detail-value" style="color:var(--primary); font-weight:800;">${item.bank.name}</div>
                </div>
                ${shippingHtml}
            </div>
        </div>

        <div class="card-footer-info">
            <div class="user-full-info"> Account : ${item.user.social_name} ( จาก ${item.user.social_type})</div>
            ${item.remark ? `<div class="remark-container" onclick="openRemarkModal(${item.order}, '${type}')"><span class="label">หมายเหตุ:</span> ${item.remark}</div>` : ''}
        </div>

        <div class="card-bottom-actions">
            <div class="action-row-group">
                <button class="btn-icon-minimal" onclick="openEditModal(${item.order}, '${type}')" title="แก้ไข">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                
                <button class="btn-remark-text" onclick="openRemarkModal(${item.order}, '${type}')">
                    ${item.remark ? 'แก้หมายเหตุ' : '+ หมายเหตุ'}
                </button>

                <div class="status-container">
                    ${statusAreaHtml}
                </div>
            </div>
        </div>
    `;

    return card;
}

function showStatusSelection(order, type) {
    const container = document.getElementById(`status-toggle-${type}-${order}`);
    container.innerHTML = `
        <div class="status-workflow-area">
            <button class="status-vibrant-btn pending" onclick="updateStatus(${order}, 'pending', '${type}')">รอตรวจ</button>
            <button class="status-vibrant-btn approved" onclick="updateStatus(${order}, 'approved', '${type}')">ผ่าน</button>
            <button class="status-vibrant-btn rejected" onclick="updateStatus(${order}, 'rejected', '${type}')">ไม่ผ่าน</button>
        </div>
    `;
}

// --- API Actions ---

async function updateStatus(order, status, type) {
    showLoading(true);
    try {
        const action = type === 'donate' ? 'updateDonate' : 'updateWorkshop';
        const payload = {
            action: action,
            order: order,
            status: status
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.status === 'ok') {
            const statusMap = {
                'pending': 'รอตรวจสอบ',
                'approved': 'ผ่าน',
                'rejected': 'ไม่ผ่าน'
            };
            showToast(`เปลี่ยนสถานะเป็น "${statusMap[status] || status}" เรียบร้อยแล้ว`);
            // Update local cache
            const items = dataCache[type];
            const idx = items.findIndex(i => i.order === order);
            if (idx !== -1) {
                // Update both general status and type-specific status
                items[idx].status = status;
                if (type === 'donate') items[idx].donate_status = status;
                else items[idx].workshop_status = status;

                // Refresh UI
                renderFeed(items, type);
            }
        } else {
            showToast('อัปเดตไม่สำเร็จ: ' + result.message);
        }
    } catch (error) {
        console.error('Update error:', error);
        showToast('ไม่สามารถเชื่อมต่อเพื่ออัปเดตได้');
    } finally {
        showLoading(false);
    }
}

async function saveTransactionDetails(payload, type) {
    showLoading(true);
    try {
        const action = type === 'donate' ? 'updateDonate' : 'updateWorkshop';
        payload.action = action; // inject action

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.status === 'ok') {
            showToast('บันทึกข้อมูลเรียบร้อยแล้ว');
            closeModal();

            // Update local cache
            const items = dataCache[type];
            const idx = items.findIndex(i => i.order === payload.order);
            if (idx !== -1) {
                // Merge changed fields
                Object.assign(items[idx], payload);
                renderFeed(items, type);
            }
        } else {
            showToast('บันทึกไม่สำเร็จ: ' + result.message);
        }
    } catch (error) {
        console.error('Save error:', error);
        showToast('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
        showLoading(false);
    }
}

async function saveRemark() {
    const remark = document.getElementById('remark-input').value;
    const order = currentProcessingOrder.order;
    const type = currentProcessingOrder.type;

    showLoading(true);
    try {
        const action = type === 'donate' ? 'updateDonate' : 'updateWorkshop';
        const payload = {
            action: action,
            order: order,
            remark: remark
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.status === 'ok') {
            showToast('บันทึกหมายเหตุสำเร็จ');
            closeRemarkModal();

            const items = dataCache[type];
            const idx = items.findIndex(i => i.order === order);
            if (idx !== -1) {
                items[idx].remark = remark;
                renderFeed(items, type);
            }
        } else {
            showToast('ไม่สามารถบันทึกหมายเหตุได้');
        }
    } catch (error) {
        showToast('Error saving remark');
    } finally {
        showLoading(false);
    }
}

// --- UI Logic ---

function showLoading(active) {
    const loader = document.getElementById('loader-modal');
    if (active) loader.classList.add('active');
    else loader.classList.remove('active');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.add('active');
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

function formatDate(isoString) {
    if (!isoString) return '-';
    try {
        const d = new Date(isoString);
        return d.toLocaleString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    } catch (e) {
        return isoString;
    }
}

// --- Modal Controls ---

function openEditModal(order, type) {
    const item = dataCache[type].find(i => i.order === order);
    if (!item) return;

    document.getElementById('edit-order').value = order;
    document.getElementById('edit-type').value = type;
    document.getElementById('edit-amount').value = item.amount;

    // Format date for pre-fill (YYYY/MM/DD HH:mm:ss)
    let d = new Date(item.transaction_date);
    let dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    document.getElementById('edit-date').value = dateStr;

    document.getElementById('edit-ref').value = item.transaction_ref;

    const workshopFields = document.getElementById('workshop-fields');
    if (type === 'workshop') {
        workshopFields.style.display = 'block';
        document.getElementById('edit-items').value = item.item_count;
    } else {
        workshopFields.style.display = 'none';
    }

    document.getElementById('edit-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('edit-modal').classList.remove('active');
}

function openRemarkModal(order, type) {
    const item = dataCache[type].find(i => i.order === order);
    if (!item) return;

    currentProcessingOrder = { order, type };
    document.getElementById('remark-input').value = item.remark || '';
    document.getElementById('remark-modal').classList.add('active');
}

function closeRemarkModal() {
    document.getElementById('remark-modal').classList.remove('active');
    currentProcessingOrder = null;
}

function setupFormHandlers() {
    document.getElementById('edit-form').onsubmit = (e) => {
        e.preventDefault();
        const order = parseInt(document.getElementById('edit-order').value);
        const type = document.getElementById('edit-type').value;
        const payload = {
            order: order,
            amount: parseFloat(document.getElementById('edit-amount').value),
            transaction_date: document.getElementById('edit-date').value,
            transaction_ref: document.getElementById('edit-ref').value
        };

        if (type === 'workshop') {
            payload.item_count = parseInt(document.getElementById('edit-items').value);
        }

        saveTransactionDetails(payload, type);
    };
}
