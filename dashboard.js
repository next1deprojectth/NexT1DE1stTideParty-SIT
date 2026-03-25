/**
 * dashboard.js - Final Reordered Dashboard Logic
 */

const API_URL = API_CONFIG.BASE_URL;

document.addEventListener('DOMContentLoaded', () => {
    fetchStatistics();

    // Scroll Shrink Logic
    const navWrapper = document.querySelector('.quick-nav-wrapper');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 40) {
            navWrapper.classList.add('shrunk');
        } else {
            navWrapper.classList.remove('shrunk');
        }
    });
});

async function fetchStatistics() {
    try {
        const url = `${API_URL}?action=getStatistics`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'ok') {
            updateUI(data.statistics);
            updateTimestamp();
        } else {
            console.error('API Error:', data.message);
        }
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

function updateUI(stats) {
    // 0. ยอดเงินรวมทั้งหมด (Grand Total)
    const grandTotal = stats.total_donate_net.approved + stats.total_workshop_net.approved + stats.total_shipping_price.approved;
    animateValue('grand-total-amount', grandTotal, true);
    animateValue('breakdown-donate', stats.total_donate_net.approved, true);
    animateValue('breakdown-workshop', stats.total_workshop_net.approved, true);
    animateValue('breakdown-shipping', stats.total_shipping_price.approved, true);

    // 1. ยอดเงินสุทธิ (Pending, Approved, Rejected)
    animateValue('donate-net-pending', stats.total_donate_net.pending, true);
    animateValue('donate-net-approved', stats.total_donate_net.approved, true);
    animateValue('donate-net-rejected', stats.total_donate_net.rejected, true);

    animateValue('workshop-net-pending', stats.total_workshop_net.pending, true);
    animateValue('workshop-net-approved', stats.total_workshop_net.approved, true);
    animateValue('workshop-net-rejected', stats.total_workshop_net.rejected, true);

    // 2. สิทธิ์ Workshop (Approved by Source)
    animateValue('workshop-rights-donate-approved', stats.total_workshop_from_donate.approved);
    animateValue('workshop-rights-sell-approved', stats.total_workshop_from_sell.approved);

    // 3. การจัดส่ง
    // 3.1 งบค่าส่ง (Approved Only)
    animateValue('ship-approved-total', stats.total_shipping_price.approved, true);
    // 3.2 ช่องทาง
    animateValue('onsite-total', stats.total_onsite.total);
    animateValue('delivery-total', stats.total_delivery.total);

    // 4. ปริมาณคน (Approved Only)
    animateValue('donate-users-count', stats.total_donate_users.approved);
    animateValue('donate-trans-count', stats.total_donate_count.approved);
    
    animateValue('workshop-users-count', stats.total_workshop_users.approved);
    animateValue('workshop-trans-count', stats.total_workshop_count.approved);
}

/** 
 * Count-up animation helper 
 */
function animateValue(id, end, isCurrency = false) {
    const obj = document.getElementById(id);
    if (!obj) return;

    let start = 0;
    const duration = 1500;
    let startTimestamp = null;

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const currentVal = Math.floor(progress * (end - start) + start);

        if (isCurrency) {
            obj.innerText = `฿${currentVal.toLocaleString('th-TH')}`;
        } else {
            obj.innerText = currentVal.toLocaleString('th-TH');
        }

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            if (isCurrency) {
                obj.innerText = `฿${end.toLocaleString('th-TH')}`;
            } else {
                obj.innerText = end.toLocaleString('th-TH');
            }
        }
    };
    window.requestAnimationFrame(step);
}

function updateTimestamp() {
    const now = new Date();
    const ts = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const badge = document.getElementById('last-updated');
    if (badge) badge.innerText = `อัพเดทล่าสุด ${ts}`;
}
