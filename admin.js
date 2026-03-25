/* --- Admin Dashboard Logic (Modern Refined) --- */

let allUsers = [];
let filteredUsers = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchData();

    // Setup Filters
    const searchInp = document.getElementById('search-input');
    const shipFilt = document.getElementById('filter-shipping');

    const handleFilter = () => { applyFilters(); };

    searchInp.addEventListener('input', handleFilter);
    shipFilt.addEventListener('change', handleFilter);
});

async function fetchData() {
    showLoading(true);
    try {
        const url = `${API_CONFIG.BASE_URL}?action=getAdminSummary`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'ok') {
            allUsers = data.users;
            applyFilters(); 
        } else {
            showToast('Error: ' + data.message);
        }
    } catch (err) {
        console.error('Fetch error:', err);
        showToast('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
        showLoading(false);
    }
}

function applyFilters() {
    const term = document.getElementById('search-input').value.toLowerCase().trim();
    const shipping = document.getElementById('filter-shipping').value;

    filteredUsers = allUsers.filter(user => {
        // Search Term Filter
        const matchTerm = user.social_name.toLowerCase().includes(term) ||
                          user.user_id.toLowerCase().includes(term);
        if (!matchTerm) return false;

        // Shipping Filter
        if (shipping !== 'all') {
            const isDelivery = user.shipping.delivery_type === 'delivery';
            if (shipping === 'delivery' && !isDelivery) return false;
            if (shipping === 'onsite' && isDelivery) return false;
        }

        return true;
    });

    renderUsers(filteredUsers);
}

function renderUsers(users) {
    const tbody = document.getElementById('user-rows');
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 100px; color: var(--text-muted); font-weight:800; background:none;">ไม่พบข้อมูลรายการ</td></tr>`;
        document.getElementById('tab-info-bar').innerText = `ไม่พบข้อมูลที่ต้องการค้นหา`;
        return;
    }

    const sorted = [...users].sort((a, b) => a.social_name.localeCompare(b.social_name));

    sorted.forEach(user => {
        const tr = document.createElement('tr');

        // Color Mapping
        const socialColors = { 'X': '#000000', 'TikTok': '#ff0050', 'IG': 'linear-gradient(45deg, #f09433, #dc2743, #bc1888)', 'Line': '#00b900' };
        const sColor = socialColors[user.social_type] || '#64748B';

        // Column 2: Giveaway
        const gifts = user.giftaway.items || [];
        const giftHtml = gifts.length > 0 
            ? gifts.map(g => `<div class="gift-item">${g}</div>`).join('') 
            : '<span style="color:#CBD5E1; font-size:0.75rem;">ไม่มีรายการ</span>';

        // Column 3: Workshop
        let workshopHtml = '<span style="color:#CBD5E1; font-size:0.75rem;">-</span>';
        if (user.workshop && user.workshop.has_workshop) {
            const total = user.workshop.total_rights || 0;
            const fromD = user.workshop.from_donate || 0;
            const fromS = user.workshop.from_direct || 0;
            workshopHtml = `
                <div class="ws-bubble">x${total}</div>
                <div class="ws-sources">
                    ${fromD > 0 ? `<span class="src">x${fromD} (โดเนท)</span>` : ''}
                    ${fromS > 0 ? `<span class="src">x${fromS} (ซื้อเอง)</span>` : ''}
                </div>
            `;
        }

        const isDelivery = user.shipping.delivery_type === 'delivery';
        const pillHtml = `<span class="shipping-pill ${isDelivery ? 'pill-delivery' : 'pill-onsite'}">${isDelivery ? 'จัดส่ง' : 'รับหน้างาน'}</span>`;

        let addressHtml = '-';
        if (isDelivery) {
            const s = user.shipping;
            addressHtml = `
                <div class="addr-group">
                    <div class="addr-top">
                        <b>${s.recipient_name || 'ไม่ระบุ'}</b> 
                        <span>${s.shipping_phone || ''}</span>
                    </div>
                    <div class="addr-text">${s.shipping_address || '-'} ${s.shipping_postal || ''}</div>
                    <button class="btn-copy-address" onclick="copyAddress('${user.user_id}')">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        คัดลอกที่อยู่
                    </button>
                </div>
            `;
        } else {
            addressHtml = `<div style="color:#166534; font-weight:800; font-size:0.8rem;">รับหน้างาน (จามจุรีสแควร์)</div>`;
        }

        tr.innerHTML = `
            <td>
                <div class="user-row-header">
                    <div class="social-badge" style="background:${sColor}">${user.social_type.substring(0, 1)}</div>
                    <div class="user-main-info">
                        <span class="name">${user.social_name}</span>
                        <span class="uid">${user.user_id}</span>
                        <a href="profile.html?socialName=${encodeURIComponent(user.social_name)}&socialType=${encodeURIComponent(user.social_type)}" target="_blank" class="profile-link-btn">Profile</a>
                    </div>
                </div>
            </td>
            <td><div class="gift-list">${giftHtml}</div></td>
            <td><div class="workshop-col-info">${workshopHtml}</div></td>
            <td style="font-weight: 800; color: var(--text-main);">฿${user.donate.net_total.toLocaleString()}</td>
            <td>${pillHtml}</td>
            <td>${addressHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('tab-info-bar').innerText = `พบรายชื่อทั้งหมด ${users.length} คน`;
}

function copyAddress(userId) {
    const user = allUsers.find(u => u.user_id === userId);
    if (!user) return;
    const s = user.shipping;
    const text = `${s.recipient_name}\n${s.shipping_phone}\n${s.shipping_address} ${s.shipping_postal}`;
    navigator.clipboard.writeText(text).then(() => showToast('คัดลอกที่อยู่สำเร็จ'));
}

function showLoading(active) {
    const loader = document.getElementById('loader-modal');
    if (active) loader.classList.add('active');
    else loader.classList.remove('active');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerText = msg;
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 2500);
}
