document.addEventListener('DOMContentLoaded', () => {

    const API_ENDPOINT = API_CONFIG.BASE_URL;

    const socialTabs = document.querySelectorAll('.social-tab');
    const searchInput = document.getElementById('search-username');
    const btnSearch = document.getElementById('btn-search');

    let selectedSocial = 'x';

    // UI Elements
    const apiLoading = document.getElementById('api-loading');
    const errorMsg = document.getElementById('error-message');
    const resultContainer = document.getElementById('result-container');
    const shareUrlBox = document.getElementById('share-url-box');
    const shareUrlInput = document.getElementById('share-url-input');
    const searchSection = document.getElementById('search-section');
    const navSearchBtn = document.getElementById('nav-search-btn');

    // Parse URL Params
    const urlParams = new URLSearchParams(window.location.search);
    const urlSocialName = urlParams.get('socialName');
    const urlSocialType = urlParams.get('socialType');

    if (urlSocialName) {
        if (searchSection && navSearchBtn) {
            searchSection.style.display = 'none';
            navSearchBtn.style.display = 'block';
        }
        searchInput.value = urlSocialName;
        selectedSocial = urlSocialType || 'x';
        updateTabs(selectedSocial);
        fetchProfile(urlSocialName, selectedSocial);
    }

    // Setup Tabs
    function updateTabs(social) {
        socialTabs.forEach(t => t.classList.remove('active'));
        const activeTab = Array.from(socialTabs).find(t => t.dataset.social === social) || document.getElementById('tab-x');
        if (activeTab) {
            activeTab.classList.add('active');
            selectedSocial = activeTab.dataset.social;
        }
    }

    socialTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            updateTabs(tab.dataset.social);
        });
    });

    // Search Button
    btnSearch.addEventListener('click', () => {
        const val = searchInput.value.trim();
        if (!val) {
            alert('กรุณากรอก Username เพื่อค้นหา');
            return;
        }

        // Update URL
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('socialName', val);
        newUrl.searchParams.set('socialType', selectedSocial);
        window.history.pushState({}, '', newUrl);

        fetchProfile(val, selectedSocial);
    });

    document.getElementById('btn-copy-url').addEventListener('click', function () {
        shareUrlInput.select();
        document.execCommand('copy');
        this.innerText = 'คัดลอกแล้ว';
        setTimeout(() => this.innerText = 'คัดลอก', 2000);
    });

    if (navSearchBtn && searchSection) {
        navSearchBtn.addEventListener('click', () => {
            searchSection.style.display = 'block';
            navSearchBtn.style.display = 'none';
            searchInput.focus();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    async function fetchProfile(socialName, socialType) {
        apiLoading.style.display = 'block';
        errorMsg.style.display = 'none';
        resultContainer.style.display = 'none';
        shareUrlBox.style.display = 'none';

        try {
            const res = await fetch(`${API_ENDPOINT}?action=getDonate&socialName=${encodeURIComponent(socialName)}&socialType=${encodeURIComponent(socialType)}`);
            const data = await res.json();

            if (data.status !== 'ok' || (!data.donations || data.donations.length === 0)) {
                // Not found
                apiLoading.style.display = 'none';
                errorMsg.style.display = 'block';
                if (searchSection && navSearchBtn) {
                    searchSection.style.display = 'block';
                    navSearchBtn.style.display = 'none';
                }
                return;
            }

            // Render Profile
            renderProfile(data);

            apiLoading.style.display = 'none';
            resultContainer.style.display = 'block';

            shareUrlInput.value = window.location.href;
            shareUrlBox.style.display = 'block';

            // Hide search section, show icon
            if (searchSection && navSearchBtn) {
                searchSection.style.display = 'none';
                navSearchBtn.style.display = 'block';
            }

        } catch (error) {
            console.error('Fetch error:', error);
            apiLoading.style.display = 'none';
            errorMsg.style.display = 'block';
            errorMsg.querySelector('p').innerText = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
            if (searchSection && navSearchBtn) {
                searchSection.style.display = 'block';
                navSearchBtn.style.display = 'none';
            }
        }
    }

    function renderProfile(data) {
        // Header
        const pName = data.user?.social_name || data.socialName;
        document.getElementById('profile-name').innerText = pName;
        document.getElementById('profile-social-type').innerText = `ช่องทาง: ${data.user?.social_type || 'x'}`;
        document.getElementById('profile-avatar').innerText = pName.charAt(0).toUpperCase();

        // Total Amount
        const total = data.total_amount || 0;
        document.getElementById('profile-total-amount').innerText = `฿${total.toLocaleString('th-TH', { minimumFractionDigits: total % 1 === 0 ? 0 : 2 })}`;

        // Gifts
        const giftInfo = calculateGifts(total);
        const giftsContainer = document.getElementById('profile-gifts-container');
        if (total >= 177) {
            giftsContainer.innerHTML = getGiftHtml(giftInfo.gifts);
        } else {
            giftsContainer.innerHTML = `<p style="text-align:center; color:#A0AEC0; margin:0; font-size: 0.9rem;">ไม่ได้รับ Giveaway (ยอดน้อยกว่า 177 บาท)</p>`;
        }

        // Reception
        const recCard = document.getElementById('reception-card');
        if (data.receive) {
            recCard.style.display = 'block';
            const r = data.receive;
            document.getElementById('reception-type-label').innerText = r.delivery_type === 'delivery' ? 'จัดส่งตามที่อยู่' : 'รับที่หน้างาน (จามจุรีสแควร์ ชั้น G)';

            if (r.delivery_type === 'delivery') {
                document.getElementById('reception-address-box').style.display = 'block';
                document.getElementById('reception-onsite-box').style.display = 'none';

                document.getElementById('rec-name').innerText = r.recipient_name || '-';
                document.getElementById('rec-address').innerText = r.shipping_address || '-';
                document.getElementById('rec-postal').innerText = r.shipping_postal || '';
                document.getElementById('rec-phone').innerText = r.shipping_phone || '-';
            } else {
                document.getElementById('reception-address-box').style.display = 'none';
                document.getElementById('reception-onsite-box').style.display = 'block';
            }
        } else {
            if (total >= 177) {
                recCard.style.display = 'block';
                document.getElementById('reception-type-label').innerText = 'ยังไม่ได้ลงทะเบียนวิธีรับ Giveaway';
                document.getElementById('reception-type-label').style.color = '#DD6B20';
                document.getElementById('reception-address-box').style.display = 'none';
                document.getElementById('reception-onsite-box').style.display = 'none';
            } else {
                recCard.style.display = 'none';
            }
        }

        // History
        const listContainer = document.getElementById('profile-history-list');
        let html = '';
        if (data.donations && data.donations.length > 0) {
            data.donations.forEach(d => {
                const dateStr = d.transaction_date || d.date || d.timestamp || d['วันเวลาโอน'] || '-';
                const dispDate = formatThaiDate(dateStr);
                const dispAmount = d.amount ? parseFloat(d.amount).toLocaleString('th-TH') : '0';

                // Map bank info matching bank_id
                let dispBank = '-';
                let dispBankName = '-';
                let dispBankNo = '-';
                if (data.banks && data.banks.length > 0) {
                    const b = data.banks.find(x => x.bank_id === d.bank_id);
                    if (b) {
                        dispBank = b.bank || '-';
                        dispBankName = b.name || '-';
                        dispBankNo = b.bank_no || '-';
                    } else if (d.bank) {
                        dispBank = d.bank;
                    }
                } else if (d.bank) {
                    dispBank = d.bank;
                }

                let imgHtml = '';
                if (d.image) {
                    imgHtml = `<a href="${d.image}" target="_blank" style="color: #4299E1; font-size: 0.8rem; text-decoration: none; display: flex; align-items: center; gap: 4px; border: 1px solid #BEE3F8; padding: 4px 10px; border-radius: 20px; background: #EBF8FF; font-weight: 700; transition: all 0.2s;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        ดูสลิป
                    </a>`;
                }

                html += `
                    <div class="history-item" style="display: flex; gap: 10px; position: relative; padding-bottom: 20px;">
                        <div style="display: flex; flex-direction: column; align-items: center;">
                            <div style="width: 14px; height: 14px; background: linear-gradient(135deg, #63B3ED, #3182CE); border-radius: 50%; z-index: 2; box-shadow: 0 0 0 4px #EBF8FF; margin-top: 2px;"></div>
                            <div style="flex: 1; width: 2px; background: rgba(226, 232, 240, 0.8); margin-top: 4px;"></div>
                        </div>
                        <div style="flex: 1; min-width: 0; background: rgba(255,255,255,0.95); padding: 16px 14px; border-radius: 16px; border: 1px solid rgba(226, 232, 240, 0.8); margin-top: -5px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 8px;">
                                <div style="flex: 1; min-width: 0;">
                                    <p style="margin: 0; font-weight: 800; color: #2B6CB0; font-size: 1.05rem; letter-spacing: -0.3px; word-break: break-word;">ยอดโอน ${dispAmount} บาท</p>
                                    <p style="margin: 4px 0 0; color: #718096; font-size: 0.8rem; font-weight: 600; display:flex; align-items:center; gap:4px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                        ${dispDate}
                                    </p>
                                </div>
                                <div style="flex-shrink: 0;">${imgHtml}</div>
                            </div>
                            
                            <div style="padding-top: 10px; border-top: 1px dashed #E2E8F0; display: grid; grid-template-columns: 55px 1fr; gap: 4px 8px; font-size: 0.85rem; line-height: 1.3;">
                                <div style="color:#A0AEC0; font-weight:600;">นามแฝง</div>
                                <div style="color:#4A5568; font-weight:700; word-break: break-all;">${d.username || '-'}</div>
                                
                                <div style="color:#A0AEC0; font-weight:600;">โอนจาก</div>
                                <div style="color:#4A5568; font-weight:700; word-break: break-word;">${dispBankName}</div>
                                
                                <div style="color:#A0AEC0; font-weight:600;">ธนาคาร</div>
                                <div style="color:#4A5568; font-weight:700;">${dispBank}</div>
                                
                                <div style="color:#A0AEC0; font-weight:600;">เลขบัญชี</div>
                                <div style="color:#718096; font-family:monospace; font-weight:600; font-size:0.9rem; letter-spacing:0.5px;">${dispBankNo}</div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }
        listContainer.innerHTML = html;

        // Remove the last timeline line
        const lastLine = listContainer.querySelector('.history-item:last-child > div:first-child > div:last-child');
        if (lastLine) lastLine.style.display = 'none';
        const lastItem = listContainer.querySelector('.history-item:last-child');
        if (lastItem) lastItem.style.paddingBottom = '0';
    }

    // --- Helpers ---
    const formatThaiDate = (dateStr) => {
        if (!dateStr || dateStr === '-') return '-';

        let date;
        if (dateStr.includes('T') || dateStr.includes('-')) {
            date = new Date(dateStr);
        } else if (dateStr.includes('/')) {
            const parts = dateStr.split(/[\s/:]/);
            if (parts.length >= 3) {
                const day = parseInt(parts[0], 10);
                const monthIdx = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                const hours = parts[3] || '00';
                const minutes = parts[4] || '00';
                date = new Date(year, monthIdx, day, hours, minutes);
            }
        }

        if (date && !isNaN(date)) {
            const day = date.getDate();
            const monthIdx = date.getMonth();
            const year = date.getFullYear() + 543;
            const hours = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');
            const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
            return `${day} ${thaiMonths[monthIdx]} ${year.toString().slice(-2)}, ${hours}:${minutes}`;
        }
        return dateStr;
    };

    const calculateGifts = (totalAmount) => {
        const gifts = {
            a6Sticker: (totalAmount >= 177) ? 1 : 0,
            uvSticker: (totalAmount >= 477) ? 1 : 0,
            clearPurse: (totalAmount >= 477) ? 1 : 0,
            acrylicFrame: (totalAmount >= 777) ? 1 : 0,
            lightSignStrap: (totalAmount >= 1277) ? 1 : 0,
            workshop: (totalAmount >= 1277) ? 1 : 0
        };

        return { gifts };
    };

    const getGiftHtml = (gifts) => {
        let h = '<div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center; margin-top:10px;">';
        const badgeStyle = `style="background:#E2E8F0; color:#2D3748; padding:6px 15px; border-radius:50px; font-size:0.8rem; font-weight:700; white-space:nowrap; border:1px solid #CBD5E0;"`;

        if (gifts.a6Sticker > 0) h += `<span ${badgeStyle}>A6 Sticker</span>`;
        if (gifts.uvSticker > 0) h += `<span ${badgeStyle}>UV Sticker</span>`;
        if (gifts.clearPurse > 0) h += `<span ${badgeStyle}>Clear Plastic Purse</span>`;
        if (gifts.acrylicFrame > 0) h += `<span ${badgeStyle}>Acrylic Frame</span>`;
        if (gifts.lightSignStrap > 0) h += `<span ${badgeStyle}>Light Sign Strap</span>`;
        if (gifts.workshop > 0) h += `<span ${badgeStyle}>Work Shop</span>`;

        h += '</div>';
        return h;
    };
});
