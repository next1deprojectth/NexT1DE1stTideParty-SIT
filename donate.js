document.addEventListener('DOMContentLoaded', () => {
    // Check if system is open
    if (typeof API_CONFIG !== 'undefined' && API_CONFIG.IS_DONATE_OPEN === false) {
        window.location.href = 'https://forms.gle/zDtENR1ryZWJPD9z9';
        return;
    }

    // --- State Management ---
    let currentState = 1;
    let slipData = null;
    let selectedSocial = 'x';
    let selectedMethod = 'onsite'; // Default is onsite
    let mergedDonationData = { status: 'new', total_amount: 0, donations: [], user: null, receive: null };
    let nickname = '';
    let isChangingReception = false;
    let isShippingRefunded = false;
    let currentDonationAmount = 0;
    let shippingFee = 0;
    let totalToPay = 0;

    let slipImageBase64 = '';
    let slipMimeType = '';

    // --- Load Persistent Data ---
    const savedType = localStorage.getItem('next1de_social_type');
    const savedName = localStorage.getItem('next1de_social_name');
    if (savedName) {
        document.getElementById('social-username').value = savedName;
    }
    if (savedType) {
        selectedSocial = savedType;
        // Update tabs UI after selectors are defined
    }

    const RECEIVER_NAME_TARGET = "ธัญดา";
    const WEBHOOK_URL = "https://next1de.app.n8n.cloud/webhook/6e4a539b-5580-40f9-a85f-47a488a2e842";
    const API_ENDPOINT = API_CONFIG.BASE_URL;
    const GET_API_URL = API_ENDPOINT;
    const SAVE_API_URL = API_ENDPOINT;
    const UPLOAD_API_URL = API_ENDPOINT;

    // --- Selectors ---
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');
    const step4 = document.getElementById('step-4');
    const stepLabelText = document.getElementById('step-label-text');

    const globalLoading = document.getElementById('global-loading');
    const globalLoadingText = document.getElementById('global-loading-text');

    // Step 1
    const socialTabs = document.querySelectorAll('.social-tab');
    const socialInput = document.getElementById('social-username');
    const btnConfirmStep1 = document.getElementById('btn-confirm-step1');

    // Step 2
    const amountButtons = document.querySelectorAll('.amount-btn');
    const customAmountInput = document.getElementById('custom-amount-input');
    const btnTotalPaymentStep2 = document.getElementById('btn-total-payment-step2');
    const nicknameInput = document.getElementById('nickname-input');
    const btnClearNickname = document.getElementById('btn-clear-nickname');
    const receptionSectionWrapper = document.getElementById('reception-section-wrapper');

    // Step 3
    const paymentStepTotal = document.getElementById('payment-step-total');
    const uploadZone = document.getElementById('upload-zone');
    const slipFileInput = document.getElementById('slip-file-input');
    const uploadPreviewWrapper = document.getElementById('upload-preview-wrapper');
    const uploadZoneContent = document.getElementById('upload-zone-content');
    const slipPreviewImg = document.getElementById('slip-preview-img');
    const uploadErrorMsg = document.getElementById('upload-error-msg');
    const aiLoading = document.getElementById('api-loading');

    // Step 4
    const summarySocial = document.getElementById('summary-social');
    const summaryNickname = document.getElementById('summary-nickname');
    const summaryCurrentAmount = document.getElementById('summary-current-amount');
    const summaryFeeRow = document.getElementById('summary-fee-row');
    const btnSubmitFinal = document.getElementById('btn-submit-final');

    // === Nickname Logic ===
    const updateClearButton = () => {
        if (btnClearNickname && nicknameInput) {
            btnClearNickname.style.display = nicknameInput.value.length > 0 ? 'flex' : 'none';
        }
    };

    if (socialInput && nicknameInput) {
        socialInput.addEventListener('input', () => {
            nicknameInput.value = socialInput.value;
            updateClearButton();
        });
    }

    if (nicknameInput) {
        nicknameInput.addEventListener('input', updateClearButton);
    }

    if (btnClearNickname && nicknameInput) {
        btnClearNickname.addEventListener('click', () => {
            nicknameInput.value = '';
            nicknameInput.focus();
            updateClearButton();
        });
    }


    const showLoading = (text = "กำลังประมวลผล...") => {
        globalLoadingText.innerText = text;
        globalLoading.style.display = 'flex';
    };

    const hideLoading = () => {
        globalLoading.style.display = 'none';
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

        let nextGoal = 0;
        let diff = 0;
        if (totalAmount < 177) { nextGoal = 177; diff = 177 - totalAmount; }
        else if (totalAmount < 477) { nextGoal = 477; diff = 477 - totalAmount; }
        else if (totalAmount < 777) { nextGoal = 777; diff = 777 - totalAmount; }
        else if (totalAmount < 1277) { nextGoal = 1277; diff = 1277 - totalAmount; }

        return { gifts, diff, hasAny: totalAmount >= 177 };
    };

    const getLevelTitle = (amount) => {
        if (amount >= 1277) return "คุณได้รับ Giveaway Level 4";
        if (amount >= 777) return "คุณได้รับ Giveaway Level 3";
        if (amount >= 477) return "คุณได้รับ Giveaway Level 2";
        if (amount >= 177) return "คุณได้รับ Giveaway Level 1";
        return "Giveaway ที่คุณได้รับ";
    };

    const formatAmount = (num) => `฿${num.toLocaleString('th-TH', {
        minimumFractionDigits: num % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
    })}`;

    const initStep2 = () => {
        // Amount Buttons
        amountButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                amountButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const amt = parseFloat(btn.dataset.amount);
                customAmountInput.value = amt;
                currentDonationAmount = amt;
                updateStep2Total();
            });
        });

        // Custom Input
        customAmountInput.addEventListener('input', (e) => {
            amountButtons.forEach(b => b.classList.remove('active'));

            // Allow only numbers and one decimal point
            let val = customAmountInput.value.replace(/[^0-9.]/g, '');
            const dots = val.split('.');
            if (dots.length > 2) val = dots[0] + '.' + dots.slice(1).join('');

            // Limit to 2 decimal places if needed (optional but good)
            if (dots.length === 2 && dots[1].length > 2) {
                val = dots[0] + '.' + dots[1].substring(0, 2);
            }

            if (customAmountInput.value !== val) {
                customAmountInput.value = val;
            }

            currentDonationAmount = parseFloat(val) || 0;
            updateStep2Total();
        });

        // --- selectMethod Exposed to Global ---
        window.selectMethod = (method) => {
            selectedMethod = method;
            const r = mergedDonationData.receive;

            // Shipping Refund Logic
            if (r && r.delivery_type === 'delivery' && method === 'onsite') {
                isShippingRefunded = true;
                const refundNotice = document.getElementById('shipping-refund-notice');
                if (refundNotice) refundNotice.style.display = 'block';
            } else {
                isShippingRefunded = false;
                const refundNotice = document.getElementById('shipping-refund-notice');
                if (refundNotice) refundNotice.style.display = 'none';
            }

            document.querySelectorAll('.delivery-method-card').forEach(c => {
                c.classList.remove('active');
                if (c.dataset.method === method) c.classList.add('active');
            });

            const deliveryForm = document.getElementById('new-delivery-address-fields');
            if (deliveryForm) {
                deliveryForm.style.display = (method === 'delivery' ? 'block' : 'none');
            }
            updateStep2Total();
        };

        // Init Reception Method
        const r = mergedDonationData.receive;
        if (r && !isChangingReception) {
            // Show past reception box
            document.getElementById('past-reception-box').style.display = 'block';
            document.getElementById('reception-methods-selection').style.display = 'none';
            document.getElementById('past-type-text').innerText = (r.delivery_type === 'onsite' ? 'รับที่จามจุรีสแควร์ วันที่ 24-25 เม.ย. 69' : 'จัดส่งตามที่อยู่');
            document.getElementById('past-details').style.display = (r.delivery_type === 'onsite' ? 'none' : 'block');
            document.getElementById('past-ship-name').innerText = r.recipient_name || '-';
            document.getElementById('past-ship-address').innerText = r.shipping_address || '-';
            document.getElementById('past-ship-postal').innerText = r.shipping_postal || '-';
            document.getElementById('past-ship-phone').innerText = r.shipping_phone || '-';
            selectedMethod = r.delivery_type;
        } else {
            document.getElementById('past-reception-box').style.display = 'none';
            document.getElementById('reception-methods-selection').style.display = 'block';
            selectMethod(selectedMethod || 'onsite');
        }

        // Nickname
        if (!nicknameInput.value) {
            nicknameInput.value = socialInput.value;
        }
        updateClearButton();

        // Init Summary
        document.getElementById('step2-past-total').innerText = formatAmount(mergedDonationData.total_amount || 0);

        // Edit Reception
        const btnChangeReception = document.getElementById('btn-change-reception');
        if (btnChangeReception) {
            btnChangeReception.addEventListener('click', () => {
                const r = mergedDonationData.receive;
                // If past was delivery, require phone verification
                if (r && r.delivery_type === 'delivery' && !isChangingReception) {
                    document.getElementById('past-reception-box').style.display = 'none';
                    document.getElementById('delivery-verification-form').style.display = 'block';
                    document.getElementById('verify-phone-input').value = '';
                    document.getElementById('verify-phone-error').style.display = 'none';
                } else {
                    isChangingReception = true;
                    document.getElementById('past-reception-box').style.display = 'none';
                    document.getElementById('delivery-verification-form').style.display = 'none';
                    document.getElementById('reception-methods-selection').style.display = 'block';
                    selectMethod(selectedMethod || 'onsite');
                }
            });
        }

        const btnVerifyPhone = document.getElementById('btn-verify-phone');
        if (btnVerifyPhone) {
            btnVerifyPhone.addEventListener('click', () => {
                const inputPhone = document.getElementById('verify-phone-input').value.trim();
                const pastPhone = mergedDonationData.receive ? (mergedDonationData.receive.shipping_phone || '') : '';

                if (inputPhone === pastPhone) {
                    isChangingReception = true;
                    document.getElementById('delivery-verification-form').style.display = 'none';
                    document.getElementById('reception-methods-selection').style.display = 'block';

                    // Pre-fill
                    const r = mergedDonationData.receive;
                    document.getElementById('ship-name').value = r.recipient_name || '';
                    document.getElementById('phone-number').value = r.shipping_phone || '';
                    document.getElementById('shipping-address').value = r.shipping_address || '';
                    document.getElementById('postal-code').value = r.shipping_postal || '';

                    selectMethod('delivery');
                } else {
                    document.getElementById('verify-phone-error').style.display = 'block';
                }
            });
        }
        const btnCancelVerify = document.getElementById('btn-cancel-verify');
        if (btnCancelVerify) {
            btnCancelVerify.addEventListener('click', () => {
                document.getElementById('delivery-verification-form').style.display = 'none';
                document.getElementById('past-reception-box').style.display = 'block';
                document.getElementById('verify-phone-input').value = '';
                document.getElementById('verify-phone-error').style.display = 'none';
            });
        }

        updateStep2Total();
    };

    const updateStep2Total = () => {
        shippingFee = (selectedMethod === 'delivery' ? 50 : 0);

        // Shipping Refund Bonus
        const refundBonus = (isShippingRefunded ? 50 : 0);

        totalToPay = currentDonationAmount + shippingFee;
        const pastTotal = mergedDonationData.total_amount || 0;
        const totalAccumulated = pastTotal + currentDonationAmount + refundBonus;

        // Update Summary UI
        const summaryBlock = document.getElementById('step2-cumulative-summary');
        if (summaryBlock) {
            summaryBlock.style.display = pastTotal > 0 ? 'flex' : 'none';
        }

        document.getElementById('step2-current-amt').innerText = `+ ${formatAmount(currentDonationAmount)}`;
        document.getElementById('step2-new-total').innerText = formatAmount(totalAccumulated);

        // Show/Hide reception based on cumulative amount
        if (totalAccumulated >= 177) {
            receptionSectionWrapper.style.display = 'block';
            document.getElementById('step2-minimum-notice').style.display = 'none';
        } else {
            receptionSectionWrapper.style.display = 'none';
            document.getElementById('step2-minimum-notice').style.display = 'block';
            selectedMethod = 'onsite';
        }

        // Calculate Shipping Fee
        const hasPastDelivery = mergedDonationData.receive && mergedDonationData.receive.delivery_type === 'delivery';
        const paidShippingInDonation = mergedDonationData.donations && mergedDonationData.donations.some(d => d.include_shipping === true);

        if (selectedMethod === 'delivery' && !hasPastDelivery && !paidShippingInDonation) {
            shippingFee = 50;
        } else {
            shippingFee = 0;
        }

        totalToPay = currentDonationAmount + shippingFee;
        btnTotalPaymentStep2.innerText = `ชำระเงิน ${formatNumber(totalToPay)} บาท`;

        // Dynamic update shipping text
        const shippingFeeText = document.getElementById('shipping-fee-text');
        if (shippingFeeText) {
            if (hasPastDelivery || paidShippingInDonation) {
                shippingFeeText.innerText = 'ชำระค่าส่งแล้ว';
                shippingFeeText.style.color = '#38A169';
            } else {
                shippingFeeText.innerText = 'ชำระเพิ่ม 50 บาท';
                shippingFeeText.style.color = '#F871B4';
            }
        }
    };

    btnTotalPaymentStep2.addEventListener('click', () => {
        const pastTotal = mergedDonationData.total_amount || 0;
        const refundBonus = (isShippingRefunded ? 50 : 0);
        const totalAccumulated = pastTotal + currentDonationAmount + refundBonus;

        if (currentDonationAmount <= 0) {
            alert('กรุณาระบุยอดโดเนท');
            return;
        }
        if (totalAccumulated >= 177 && selectedMethod === 'delivery') {
            const name = document.getElementById('ship-name').value.trim();
            const phone = document.getElementById('phone-number').value.trim();
            const addr = document.getElementById('shipping-address').value.trim();
            const post = document.getElementById('postal-code').value.trim();
            
            // Check if it's not a verified past delivery
            const isVerifiedPastDelivery = !isChangingReception && 
                                          mergedDonationData.receive && 
                                          mergedDonationData.receive.delivery_type === 'delivery';
            
            if (!isVerifiedPastDelivery && (!name || !phone || !addr || !post)) {
                alert('กรุณากรอกข้อมูลที่อยู่จัดส่งให้ครบถ้วน');
                return;
            }
            if (!isVerifiedPastDelivery && post.length !== 5) {
                alert('รหัสไปรษณีย์ต้องมี 5 หลัก');
                return;
            }
        }
        nickname = nicknameInput.value.trim();
        if (!nickname) {
            alert('กรุณากรอกนามแฝง');
            return;
        }
        setStepUI(3);
    });

    const initStep3 = () => {
        paymentStepTotal.innerText = formatNumber(totalToPay);

        const breakdownEl = document.getElementById('payment-breakdown');
        const breakdownDonationEl = document.getElementById('breakdown-donation');
        const breakdownShippingEl = document.getElementById('breakdown-shipping');

        if (shippingFee > 0) {
            breakdownEl.style.display = 'block';
            breakdownDonationEl.innerText = formatAmount(currentDonationAmount);
            breakdownShippingEl.innerText = formatAmount(shippingFee);
        } else if (isShippingRefunded) {
            breakdownEl.style.display = 'block';
            breakdownDonationEl.innerText = formatAmount(currentDonationAmount);
            breakdownShippingEl.innerHTML = `<span style="color:#10B981;">คืนค่าส่ง (+50)</span>`;
        } else {
            breakdownEl.style.display = 'none';
        }

        // Reset slip upload state
        slipData = null;
        slipImageBase64 = '';
        uploadPreviewWrapper.style.display = 'none';
        uploadZoneContent.style.display = 'flex';
        document.getElementById('slip-verification-details').style.display = 'none';
    };

    const initStep4 = () => {
        const summarySocialEl = document.getElementById('summary-social');
        const summaryNicknameEl = document.getElementById('summary-nickname');
        const summaryCurrentNetEl = document.getElementById('summary-current-net');
        const summaryShippingFeeEl = document.getElementById('summary-shipping-fee');
        const summaryCumulativeTotalEl = document.getElementById('summary-cumulative-total');

        const historyWrapper = document.getElementById('history-section-wrapper');
        const giveawayTitle = document.getElementById('step4-giveaway-title');
        const giveawayBadges = document.getElementById('step4-giveaway-badges');
        const giveawayMore = document.getElementById('step4-giveaway-more');

        const pastTotal = mergedDonationData.total_amount || 0;
        const currentTotal = slipData ? (slipData.amount || 0) : 0;
        const currentShipping = shippingFee || 0;
        const refundBonus = (isShippingRefunded ? 50 : 0);
        const currentNet = currentTotal - currentShipping + refundBonus;
        const totalAccumulated = pastTotal + currentTotal + refundBonus;

        summarySocialEl.innerText = `${selectedSocial.toUpperCase()}: ${socialInput.value}`;
        summaryNicknameEl.innerText = nickname;
        summaryCurrentNetEl.innerText = formatAmount(currentNet);
        summaryShippingFeeEl.innerText = formatAmount(currentShipping);
        summaryCumulativeTotalEl.innerText = formatAmount(totalAccumulated);

        // History Visibility
        const hasHistory = (mergedDonationData.donations && mergedDonationData.donations.length > 0);
        if (historyWrapper) {
            historyWrapper.style.display = hasHistory ? 'block' : 'none';
        }

        // Giveaway Calculation
        const { gifts, diff, hasAny } = calculateGifts(totalAccumulated);
        if (giveawayTitle) giveawayTitle.innerText = getLevelTitle(totalAccumulated);

        if (hasAny) {
            giveawayBadges.innerHTML = getGiftHtml(gifts);
        } else {
            giveawayBadges.innerHTML = '<p style="color:#A0AEC0; font-size:0.9rem;">ยังไม่ถึงเกณฑ์รับ Giveaway</p>';
        }

        if (diff > 0) {
            giveawayMore.style.display = 'block';
            giveawayMore.innerText = `โดเนทเพิ่มอีก ${formatAmount(diff)} เพื่อรับ Giveaway เลเวลถัดไป!`;
        } else {
            giveawayMore.style.display = 'none';
        }

        // History
        renderHistory();
    };

    const renderHistory = () => {
        const historyContainer = document.getElementById('history-section');
        const socialUsername = socialInput.value;
        const currentAmount = slipData ? (slipData.amount || 0) : 0;
        const currentDate = slipData ? slipData.date : new Date().toISOString();

        let timelineHtml = `
            <div style="background: white; border-radius: 32px; padding: 45px 25px 25px; border: 1px solid #E2E8F0; margin-top: 50px; text-align: left; position: relative;">
                <div style="position: absolute; top: -18px; left: 50%; transform: translateX(-50%); background: white; border: 1.5px solid #E2E8F0; padding: 8px 30px; border-radius: 50px; white-space: nowrap; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                    <h4 style="margin:0; font-size:1rem; color:#000000; font-weight:800; letter-spacing:-0.4px;">ประวัติการโดเนทของ <span style="font-weight:400;">${socialUsername}</span></h4>
                </div>
                <div class="history-list">
        `;

        // Current Donation
        timelineHtml += `
            <div class="history-item">
                <div class="history-dot current"></div>
                <div class="history-content">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <p class="history-label">สนับสนุนโปรเจกต์ <span style="font-weight:400; color:#718096;">(รอบนี้)</span></p>
                        <div style="text-align: right;">
                            <p class="history-amount">${formatAmount(currentAmount)}${shippingFee > 0 ? ` <span style="font-size:0.65rem; color:#F871B4; font-weight:600; vertical-align:middle;">(-${formatAmount(shippingFee)})</span>` : (isShippingRefunded ? ` <span style="font-size:0.65rem; color:#10B981; font-weight:600; vertical-align:middle;">(+฿50)</span>` : '')}</p>
                            <div style="background:#F59E0B; color:white; padding:2px 8px; border-radius:6px; font-size:0.6rem; font-weight:800; display:inline-block; margin-top:4px;">รอตรวจสอบ</div>
                        </div>
                    </div>
                    <p class="history-date" style="margin-top:-10px;">${formatThaiDate(currentDate)}</p>
                </div>
            </div>
        `;

        // Past Donations
        if (mergedDonationData.donations && mergedDonationData.donations.length > 0) {
            mergedDonationData.donations.forEach(don => {
                const donDate = don.transaction_date || don.date || don.timestamp || '-';

                // Determine status badge
                const status = (don.donate_status || 'verified').toLowerCase();
                let statusText = 'ตรวจผ่านแล้ว';
                let statusBg = '#059669'; // Green

                if (status === 'pending' || status === 'waiting') {
                    statusText = 'รอตรวจสอบ';
                    statusBg = '#F59E0B'; // Orange
                } else if (status === 'rejected' || status === 'fail' || status === 'rejected_slip') {
                    statusText = 'ไม่ผ่านการตรวจสอบ';
                    statusBg = '#EF4444'; // Red
                }

                timelineHtml += `
                    <div class="history-item">
                        <div class="history-dot past"></div>
                        <div class="history-content">
                            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                                <p class="history-label">สนับสนุนโปรเจกต์</p>
                                <div style="text-align: right;">
                                    <p class="history-amount">${formatAmount(don.amount)}${don.include_shipping ? ` <span style="font-size:0.65rem; color:#F871B4; font-weight:600; vertical-align:middle;">(-฿50)</span>` : ''}</p>
                                    <div style="background:${statusBg}; color:white; padding:2px 8px; border-radius:6px; font-size:0.6rem; font-weight:800; display:inline-block; margin-top:4px;">${statusText}</div>
                                </div>
                            </div>
                            <p class="history-date" style="margin-top:-10px;">${formatThaiDate(donDate)}</p>
                        </div>
                    </div>
                `;
            });
        }

        timelineHtml += `</div></div>`;
        historyContainer.innerHTML = timelineHtml;
    };

    const setStepUI = (step) => {
        currentState = step;
        step1.style.display = 'none';
        step2.style.display = 'none';
        step3.style.display = 'none';
        step4.style.display = 'none';

        const bars = [
            document.getElementById('bar-1'),
            document.getElementById('bar-2'),
            document.getElementById('bar-3'),
            document.getElementById('bar-4')
        ];
        bars.forEach(b => b.className = 'progress-bar-item');

        if (step === 1) {
            step1.style.display = 'block';
            bars[0].classList.add('step-1-active');
            stepLabelText.innerText = 'ข้อมูลผู้โดเนท (1/4)';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (step === 2) {
            step2.style.display = 'block';
            bars[0].classList.add('step-1-active');
            bars[1].classList.add('step-2-active');
            stepLabelText.innerText = 'ระบุยอดโดเนท (2/4)';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            initStep2();
        } else if (step === 3) {
            step3.style.display = 'block';
            bars[0].classList.add('step-1-active');
            bars[1].classList.add('step-2-active');
            bars[2].classList.add('step-3-active');
            stepLabelText.innerText = 'ชำระเงินและแนบสลิป (3/4)';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            initStep3();
        } else if (step === 4) {
            step4.style.display = 'block';
            bars[0].classList.add('step-1-active');
            bars[1].classList.add('step-2-active');
            bars[2].classList.add('step-3-active');
            bars[3].classList.add('step-4-active');
            stepLabelText.innerText = 'สรุปข้อมูลโดเนท (4/4)';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            initStep4();
        }
    };

    // --- Step 1 ---
    socialInput.addEventListener('input', () => {
        let val = socialInput.value.replace(/\s/g, '');
        if (val.startsWith('@')) val = val.substring(1);
        socialInput.value = val;
    });

    socialTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            socialTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            selectedSocial = tab.dataset.social;
            socialInput.placeholder = 'Username';
        });
    });

    // --- Lightbox / Image Zoom ---
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');

    if (lightbox) {
        lightbox.addEventListener('click', () => {
            lightbox.style.display = 'none';
            document.body.style.overflow = 'auto';
            lightboxImg.classList.remove('zoomed');
        });

        lightboxImg.addEventListener('click', (e) => {
            e.stopPropagation();
            lightboxImg.classList.toggle('zoomed');
        });

        const closeBtn = document.querySelector('.lightbox-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                lightbox.style.display = 'none';
                document.body.style.overflow = 'auto';
            });
        }
    }

    if (slipPreviewImg) {
        slipPreviewImg.addEventListener('click', () => {
            if (slipPreviewImg.src) {
                lightboxImg.src = slipPreviewImg.src;
                lightbox.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        });
    }

    btnConfirmStep1.addEventListener('click', async () => {
        const val = socialInput.value.trim();
        if (!val) {
            alert('กรุณากรอกชื่อบัญชีโซเชียลของคุณ');
            return;
        }

        // --- Persistent Cookie/Local Storage ---
        localStorage.setItem('next1de_social_type', selectedSocial);
        localStorage.setItem('next1de_social_name', val);

        showLoading('กำลังตรวจสอบข้อมูลรับสิทธิ์...');
        try {
            const res = await fetch(`${GET_API_URL}?action=getDonate&socialName=${encodeURIComponent(val)}&socialType=${encodeURIComponent(selectedSocial)}`);
            let data = await res.json();

            const duplicateNotice = document.getElementById('step2-duplicate-notice');
            const duplicateMsg = document.getElementById('step2-duplicate-msg');

            if (data.status !== 'ok') {
                mergedDonationData = { status: 'new', total_amount: 0, donations: [], user: null, receive: null };
                if (duplicateNotice) duplicateNotice.style.display = 'none';
                hideLoading();
                setStepUI(2);
            } else {
                mergedDonationData = data;
                if (!mergedDonationData.total_amount) {
                    mergedDonationData.total_amount = data.donations.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
                }

                const hasDonations = mergedDonationData.total_amount > 0;
                if (hasDonations && duplicateNotice && duplicateMsg) {
                    const lastDate = mergedDonationData.donations[0].issue_date || mergedDonationData.donations[0].timestamp;
                    duplicateMsg.innerHTML = `โดเนทล่าสุดเมื่อ <b>${formatThaiDate(lastDate)} น.</b><br><span style="font-size:0.75rem; color:#A0AEC0; font-weight:400;">(หากไม่ใช่บัญชีของคุณ กรุณา<span id="link-not-me" style="color:#286ACD; font-weight:700; text-decoration:underline; cursor:pointer;">ระบุบัญชีใหม่</span>)</span>`;
                    duplicateNotice.style.display = 'block';
                } else if (duplicateNotice) {
                    duplicateNotice.style.display = 'none';
                }

                hideLoading();
                setStepUI(2);
            }
        } catch (e) {
            console.error(e);
            hideLoading();
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + e.message);
        }
    });

    const duplicateNotice = document.getElementById('step2-duplicate-notice');
    if (duplicateNotice) {
        duplicateNotice.addEventListener('click', (e) => {
            if (e.target.id === 'link-not-me') {
                setStepUI(1);
                socialInput.value = '';
                socialInput.focus();
                mergedDonationData = { status: 'new', total_amount: 0, donations: [], user: null, receive: null };
                duplicateNotice.style.display = 'none';
            }
        });
    }

    // Helper for number formatting
    function formatNumber(num) {
        return Number(num).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    // --- Step 2 ---
    // --- File Upload Helpers Exposed to Global ---
    window.triggerFileInput = () => slipFileInput.click();

    window.handleFileSelected = (input) => {
        const file = input.files ? input.files[0] : (input.target ? input.target.files[0] : null);
        if (!file) return;
        input.value = '';

        uploadErrorMsg.style.display = 'none';
        document.getElementById('slip-verification-details').style.display = 'none';
        const reader = new FileReader();
        reader.onload = (e) => {
            slipPreviewImg.src = e.target.result;
            uploadPreviewWrapper.style.display = 'block';
            uploadZoneContent.style.display = 'none';
            // Store base64 for later upload
            slipImageBase64 = e.target.result.split(',')[1];
            slipMimeType = file.type || 'image/jpeg';
        };
        reader.readAsDataURL(file);

        processSlipWithAI(file);
    };

    const processSlipWithAI = async (file) => {
        aiLoading.style.display = 'block';
        document.getElementById('slip-verification-details').style.display = 'none'; // Hide previous details

        // Disable upload interactions during analysis
        const uploadZone = document.getElementById('upload-zone');
        const btnReUpload = document.getElementById('btn-re-upload');
        if (uploadZone) uploadZone.style.pointerEvents = 'none';
        if (btnReUpload) {
            btnReUpload.disabled = true;
            btnReUpload.style.opacity = '0.5';
        }

        try {
            const formData = new FormData();
            formData.append('image', file);

            const aiResponse = await fetch(WEBHOOK_URL, { method: 'POST', body: formData });
            if (!aiResponse.ok) throw new Error('AI analysis failed');
            const aiData = await aiResponse.json();

            aiLoading.style.display = 'none';
            document.getElementById('slip-verification-details').style.display = 'block';

            if (!aiData || !aiData.is_slip) {
                document.getElementById('verification-error-text').innerText = 'ไม่สามารถอ่านสลิปได้ กรุณาลองใหม่อีกครั้ง';
                document.getElementById('verification-error-text').style.display = 'block';
                document.getElementById('verification-success-data').style.display = 'none';
                document.getElementById('slip-verification-buttons').style.display = 'none';
                slipData = { is_slip: false, amount: 0, sender_name: '', date: '' };
            } else {
                let rName = aiData.receiver_name || '';
                if (!rName.includes(RECEIVER_NAME_TARGET)) {
                    document.getElementById('verification-error-text').innerText = 'อ่านบัญชีปลายทางไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง';
                    document.getElementById('verification-error-text').style.display = 'block';
                    document.getElementById('verification-success-data').style.display = 'none';
                    document.getElementById('slip-verification-buttons').style.display = 'none';
                    slipData = aiData;
                } else {
                    const refNum = aiData.ref_number || aiData.transaction_ref;
                    let isDuplicate = false;
                    if (refNum && mergedDonationData && mergedDonationData.donations) {
                        isDuplicate = mergedDonationData.donations.some(d => d.transaction_ref === refNum || d.ref_number === refNum);
                    }

                    if (isDuplicate) {
                        document.getElementById('verification-error-text').innerText = 'สลิปถูกใช้โอนโดเนทไปแล้ว ไม่สามารถใช้งานซ้ำได้';
                        document.getElementById('verification-error-text').style.display = 'block';
                        document.getElementById('verification-success-data').style.display = 'none';
                        document.getElementById('slip-verification-buttons').style.display = 'none';
                        slipData = { is_slip: false, amount: 0, sender_name: '', date: '' };
                    } else {
                        // Check if amount matches
                        const slipAmt = parseFloat(aiData.amount);
                        if (Math.abs(slipAmt - totalToPay) > 0.01) {
                            document.getElementById('verification-error-text').innerText = `ยอดโอนในสลิป (${slipAmt}) ไม่ตรงกับยอดที่ระบุ (${totalToPay}) กรุณาตรวจสอบอีกครั้ง`;
                            document.getElementById('verification-error-text').style.display = 'block';
                            document.getElementById('verification-success-data').style.display = 'none';
                            document.getElementById('slip-verification-buttons').style.display = 'none';
                            return;
                        }

                        document.getElementById('verification-error-text').style.display = 'none';
                        document.getElementById('verification-success-data').style.display = 'block';
                        document.getElementById('slip-verification-buttons').style.display = 'flex';

                        // Hide fee notice when showing verified details
                        const feeNotice = document.getElementById('step2-fee-notice');
                        if (feeNotice) feeNotice.style.display = 'none';

                        slipData = aiData;

                        document.getElementById('verify-sender-name').innerText = slipData.sender_name || '-';
                        document.getElementById('verify-amount').innerText = slipData.amount ? slipData.amount + ' ฿' : '-';
                        document.getElementById('verify-date').innerText = slipData.date ? formatFromDatetimeLocal(formatToDatetimeLocal(slipData.date)) : '-';
                    }
                }
            }

        } catch (error) {
            console.error(error);
            aiLoading.style.display = 'none';
            uploadErrorMsg.innerText = 'เกิดข้อผิดพลาดทางเทคนิค, กรุณาลองใหม่อีกครั้ง';
            uploadErrorMsg.style.display = 'block';
            document.getElementById('slip-verification-details').style.display = 'none';
        } finally {
            // Re-enable interactions
            if (uploadZone) uploadZone.style.pointerEvents = 'auto';
            if (btnReUpload) {
                btnReUpload.disabled = false;
                btnReUpload.style.opacity = '1';
            }
        }
    };

    const getGiftHtml = (gifts, justify = 'center') => {
        let h = `<div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:${justify}; margin-top:10px; justify-content:center">`;
        const badgeStyle = `style="background:#404040; color:white; padding:6px 18px; border-radius:50px; font-size:0.7rem; font-weight:700; white-space:nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border:none;"`;

        if (gifts.a6Sticker > 0) h += `<span ${badgeStyle}>A6 Sticker</span>`;
        if (gifts.uvSticker > 0) h += `<span ${badgeStyle}>UV Sticker</span>`;
        if (gifts.clearPurse > 0) h += `<span ${badgeStyle}>Clear Plastic Purse</span>`;
        if (gifts.acrylicFrame > 0) h += `<span ${badgeStyle}>Acrylic Frame</span>`;
        if (gifts.lightSignStrap > 0) h += `<span ${badgeStyle}>Light Sign Strap</span>`;
        if (gifts.workshop > 0) h += `<span ${badgeStyle}>Work Shop</span>`;

        h += '</div>';
        return h;
    };


    document.getElementById('btn-confirm-slip-data').addEventListener('click', () => {
        setStepUI(4);
    });

    // --- Date Formatting Functions ---
    function formatToDatetimeLocal(str) {
        if (!str) return '';
        if (str.includes('T') && str.length >= 16) return str.substring(0, 16);
        const parts = str.split(/[\s/:.-]/);
        if (parts.length >= 5) {
            const day = parts[0], month = parts[1], year = parts[2], hour = parts[3], minute = parts[4];
            return `${year}-${month}-${day}T${hour}:${minute}`;
        }
        return '';
    }

    function formatFromDatetimeLocal(str) {
        if (!str || !str.includes('T')) return str;
        const [d, t] = str.split('T');
        const [y, m, day] = d.split('-');
        return `${day}/${m}/${y} ${t}:00`;
    }

    const formatThaiDate = (dateStr) => {
        if (!dateStr || dateStr === '-') return '-';
        let date;
        if (dateStr.includes('T') || dateStr.includes('-')) {
            date = new Date(dateStr);
        } else if (dateStr.includes('/')) {
            const parts = dateStr.split(/[\s/:]/);
            if (parts.length >= 3) {
                const day = parseInt(parts[0], 10), monthIdx = parseInt(parts[1], 10) - 1, year = parseInt(parts[2], 10);
                const hours = parts[3] || '00', minutes = parts[4] || '00';
                date = new Date(year, monthIdx, day, hours, minutes);
            }
        }
        if (date && !isNaN(date)) {
            const day = date.getDate(), monthIdx = date.getMonth(), year = date.getFullYear() + 543;
            const hours = date.getHours().toString().padStart(2, '0'), minutes = date.getMinutes().toString().padStart(2, '0');
            const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
            return `${day} ${thaiMonths[monthIdx]} ${year.toString().slice(-2)}, ${hours}:${minutes}`;
        }
        return dateStr;
    };

    // --- Final Submit ---
    const submitDonationData = async () => {
        let finalMethod = selectedMethod;
        const rec = mergedDonationData.receive;
        let shipName = document.getElementById('ship-name').value.trim();
        let phone = document.getElementById('phone-number').value.trim();
        let address = document.getElementById('shipping-address').value.trim();
        let postal = document.getElementById('postal-code').value.trim();

        if (rec && !isChangingReception && finalMethod === 'delivery') {
            shipName = rec.recipient_name || '';
            phone = rec.shipping_phone || '';
            address = rec.shipping_address || '';
            postal = rec.shipping_postal || '';
        }

        const quote = document.getElementById('donate-quote').value.trim();
        document.getElementById('quote-modal').style.display = 'none';
        showLoading('กำลังบันทึกข้อมูล...');

        try {
            let uploadedImageUrl = "";
            if (slipImageBase64) {
                const uploadRes = await fetch(UPLOAD_API_URL, {
                    method: 'POST',
                    body: JSON.stringify({ action: "uploadImage", mimeType: slipMimeType, base64: slipImageBase64 })
                });
                const uploadData = await uploadRes.json();
                if (uploadData.status === 'ok') uploadedImageUrl = uploadData.view_url;
                else throw new Error('ไม่สามารถอัปโหลดรูปภาพได้');
            }

            const hasPastDelivery = mergedDonationData.receive && mergedDonationData.receive.delivery_type === 'delivery';
            const paidShippingInDonation = mergedDonationData.donations && mergedDonationData.donations.some(d => d.include_shipping === true);
            const isReturnShippingPrice = (hasPastDelivery || paidShippingInDonation) && (finalMethod === 'onsite');

            // --- Requirement: Total < 177 -> delivery_type = "" and event_type = "" ---
            const subtotal = (mergedDonationData.total_amount || 0) + (slipData.amount || 0);
            const skipGiveawayFields = subtotal < 177;

            const body = {
                action: "saveDonate",
                social_name: socialInput.value || "",
                social_type: selectedSocial || "",
                name: slipData.sender_name || "",
                bank_no: slipData.sender_account || "",
                bank: slipData.bank_code || "",
                transaction_date: (slipData.date || "").replace(/\//g, '/'),
                transaction_ref: slipData.ref_number || "",
                receive_name: slipData.receiver_name || "",
                amount: slipData.amount || 0,
                image: uploadedImageUrl || "",
                username: nickname || "",
                event_type: skipGiveawayFields ? "" : "donate",
                delivery_type: skipGiveawayFields ? "" : ((finalMethod === 'delivery') ? 'delivery' : 'onsite'),
                include_shipping: shippingFee > 0,
                isReturnShippingPrice: isReturnShippingPrice,
                recipient_name: (finalMethod === 'delivery' ? shipName : ""),
                shipping_phone: (finalMethod === 'delivery' ? phone : ""),
                shipping_address: (finalMethod === 'delivery' ? address : ""),
                shipping_postal: (finalMethod === 'delivery' ? postal : ""),
                quote: quote
            };

            const saveRes = await fetch(SAVE_API_URL, { method: 'POST', body: JSON.stringify(body) });
            const saveData = await saveRes.json();
            if (saveData.status === 'ok') {
                hideLoading();
                showSuccessScreen();
            } else throw new Error(saveData.message || 'บันทึกข้อมูลไม่สำเร็จ');
        } catch (error) {
            console.error("Save Error:", error);
            hideLoading();
            alert('เกิดข้อผิดพลาด: ' + error.message);
        }
    };

    btnSubmitFinal.addEventListener('click', () => {
        document.getElementById('quote-modal').style.display = 'flex';
    });

    document.getElementById('btn-submit-with-quote').addEventListener('click', () => {
        const quote = document.getElementById('donate-quote').value.trim();
        if (!quote) {
            alert('เขียนข้อความถึง NexT1DE หรือกดข้ามหากยังไม่ต้องการ');
            document.getElementById('donate-quote').focus();
            return;
        }
        submitDonationData();
    });
    document.getElementById('btn-skip-quote').addEventListener('click', () => {
        document.getElementById('donate-quote').value = "";
        submitDonationData();
    });

    const showSuccessScreen = () => {
        const screen = document.getElementById('success-screen');
        const pastTotal = mergedDonationData.total_amount || 0;
        const currentAmount = slipData ? (slipData.amount || 0) : 0;
        const netAmt = pastTotal + currentAmount;

        window.scrollTo(0, 0);
        document.getElementById('success-total-amount').innerText = formatAmount(netAmt);
        const successFeeEl = document.getElementById('success-delivery-fee');
        if (successFeeEl) successFeeEl.style.display = 'none';

        const hashtagsEl = document.getElementById('success-hashtags');
        if (hashtagsEl) hashtagsEl.innerText = '#NextT1DE1stTideParty #NexT1DEProjectTH #NexT1DE';

        const giftInfo = calculateGifts(netAmt);
        const listEl = document.getElementById('success-gift-list');
        const giftWrapper = document.querySelector('.success-gift-list-wrapper');
        const successTitleEl = document.getElementById('success-gift-title');

        if (giftInfo.hasAny) {
            giftWrapper.style.display = 'block';
            let message = "";
            if (netAmt < 177) message = `อีกเพียง ฿${(177 - netAmt).toLocaleString()} ก็จะได้รับ Giveaway ชิ้นแรก!`;
            else if (netAmt < 477) message = `สะสมต่ออีก ฿${(477 - netAmt).toLocaleString()} เพื่อรับ Giveaway เพิ่มขึ้น!`;
            else if (netAmt < 777) message = `ใกล้แล้ว! อีก ฿${(777 - netAmt).toLocaleString()} ก็จะได้รับ Giveaway เพิ่มชิ้น`;
            else if (netAmt < 1277) message = `เกือบครบแล้ว! อีกแค่ ฿${(1277 - netAmt).toLocaleString()} ก็จะได้รับ Giveaway ครบทุกชิ้น`;
            else message = `ยินดีด้วย! คุณได้รับ Giveaway ครบทุกชิ้นแล้ว`;

            if (successTitleEl) successTitleEl.innerText = message;
            if (listEl) listEl.innerHTML = getGiftHtml(giftInfo.gifts, 'flex-start');

            const qrBox = document.getElementById('success-qr-code-box');
            const qrImg = document.getElementById('success-qr-img');
            const divider = document.getElementById('success-divider');
            if (qrBox && qrImg) {
                const profileUrl = "https://next1deprojectth.github.io/NexT1DE1stTideParty/profile.html?socialName=" + encodeURIComponent(socialInput.value || mergedDonationData.socialName) + "&socialType=" + encodeURIComponent(selectedSocial);
                qrImg.src = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" + encodeURIComponent(profileUrl);
                qrBox.style.display = 'flex';
                if (divider) divider.style.display = 'block';
            }
        } else {
            const qrBox = document.getElementById('success-qr-code-box');
            const divider = document.getElementById('success-divider');
            if (qrBox) qrBox.style.display = 'none';
            if (divider) divider.style.display = 'none';
        }
        screen.style.display = 'flex';
        document.querySelector('.donate-main').style.display = 'none';
        document.querySelector('.step-indicator-container').style.display = 'none';
    };

    const loadImageAsDataUrl = (relativePath) => {
        if (window.location.protocol === 'file:') return Promise.resolve(null);
        return fetch(new URL(relativePath, window.location.href))
            .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('fetch'))))
            .then((blob) => new Promise((resolve) => {
                const fr = new FileReader();
                fr.onload = () => resolve(fr.result);
                fr.onerror = () => resolve(null);
                fr.readAsDataURL(blob);
            }))
            .catch(() => null);
    };

    const shareBtn = document.querySelector('.btn-success-share');
    let donateShareInProgress = false;
    if (shareBtn) {
        shareBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>แชร์`;
        shareBtn.addEventListener('click', async () => {
            if (donateShareInProgress) return;
            const root = document.getElementById('success-screen'), btns = document.querySelector('.success-actions');
            if (!root) return;
            donateShareInProgress = true;
            if (typeof showLoading === 'function') showLoading("กำลังเตรียมรูปภาพสำหรับแชร์...");
            if (btns) btns.style.display = 'none';
            try {
                const [bgDataUrl, logoDataUrl] = await Promise.all([loadImageAsDataUrl('images/background.jpg'), loadImageAsDataUrl('images/logo-project.png')]);
                html2canvas(root, {
                    useCORS: false, scale: 2, backgroundColor: null, logging: false,
                    onclone: (clonedDoc) => {
                        const clonedRoot = clonedDoc.getElementById('success-screen');
                        const clonedBg = clonedDoc.querySelector('.success-bg');
                        if (clonedBg) clonedBg.style.display = 'none';
                        if (clonedRoot) {
                            clonedRoot.style.position = 'relative'; clonedRoot.style.width = '600px'; clonedRoot.style.height = '800px';
                            clonedRoot.style.display = 'flex'; clonedRoot.style.flexDirection = 'column'; clonedRoot.style.alignItems = 'center'; clonedRoot.style.justifyContent = 'center'; clonedRoot.style.padding = '40px';
                            if (bgDataUrl) clonedRoot.style.background = `url(${bgDataUrl}) center center / cover no-repeat`;
                            const qrBoxHide = clonedDoc.getElementById('success-qr-code-box');
                            if (qrBoxHide) qrBoxHide.style.display = 'none';
                            clonedRoot.style.setProperty('opacity', '1', 'important'); clonedRoot.style.setProperty('filter', 'none', 'important');
                            const cumCard = clonedDoc.querySelector('.success-cumulative-card');
                            if (cumCard) cumCard.style.setProperty('background', 'rgba(255, 255, 255, 0.8)', 'important');
                            const priceVal = clonedDoc.querySelector('.success-total-amount');
                            if (priceVal) {
                                priceVal.style.setProperty('background', 'none', 'important'); priceVal.style.setProperty('background-image', 'none', 'important');
                                priceVal.style.setProperty('-webkit-text-fill-color', '#65A7D4', 'important'); priceVal.style.setProperty('color', '#65A7D4', 'important');
                                priceVal.style.setProperty('-webkit-background-clip', 'border-box', 'important'); priceVal.style.setProperty('background-clip', 'border-box', 'important');
                            }
                            clonedRoot.querySelectorAll('.success-project-title').forEach((el) => {
                                el.style.setProperty('background', 'none', 'important'); el.style.setProperty('-webkit-text-fill-color', '#286ACD', 'important');
                                el.style.setProperty('color', '#286ACD', 'important'); el.style.setProperty('font-size', '34px', 'important');
                                el.style.setProperty('white-space', 'nowrap', 'important'); el.style.setProperty('filter', 'none', 'important');
                            });
                            const thankYou = clonedDoc.querySelector('.success-thank-you');
                            if (thankYou) { thankYou.style.setProperty('color', '#4A5568', 'important'); thankYou.style.setProperty('font-weight', '700', 'important'); thankYou.style.setProperty('opacity', '1', 'important'); }
                            const hashtags = clonedDoc.getElementById('success-hashtags');
                            if (hashtags) { hashtags.style.setProperty('color', '#286ACD', 'important'); hashtags.style.setProperty('font-weight', '700', 'important'); hashtags.style.setProperty('opacity', '1', 'important'); }
                            clonedRoot.querySelectorAll('img').forEach((img) => {
                                if (img.id === 'success-qr-img') return;
                                if (logoDataUrl && (img.src.includes('logo') || img.alt === 'NexT1DE' || img.src.includes('profile'))) {
                                    const parent = img.parentElement;
                                    if (parent) { parent.style.background = `url(${logoDataUrl}) center center / cover no-repeat`; parent.style.setProperty('background', `url(${logoDataUrl}) center center / cover no-repeat`, 'important'); img.style.display = 'none'; }
                                } else if (logoDataUrl && !img.src.includes('qr')) img.src = logoDataUrl;
                            });
                        }
                    }
                }).then(canvas => {
                    if (btns) btns.style.display = 'flex';
                    if (typeof hideLoading === 'function') hideLoading();
                    canvas.toBlob((blob) => {
                        donateShareInProgress = false;
                        if (!blob) return;
                        const file = new File([blob], 'NexT1DE-Moment.png', { type: 'image/png' });
                        const filesData = { files: [file], title: 'NexT1DE 1st Tide Party', text: '#NexT1DE1stTideParty #NexT1DEProjectTH #NexT1DE' };
                        if (navigator.share && navigator.canShare && navigator.canShare(filesData)) navigator.share(filesData).catch(() => { });
                        else {
                            const link = document.createElement('a'); link.href = canvas.toDataURL('image/png'); link.download = 'NexT1DE-Moment.png'; link.click();
                            alert('บันทึกรูปภาพเรียบร้อยแล้ว!');
                        }
                    }, 'image/png', 1);
                });
            } catch (err) {
                console.error(err);
                if (btns) btns.style.display = 'flex';
                if (typeof hideLoading === 'function') hideLoading();
                donateShareInProgress = false;
            }
        });
    }

    const quoteInput = document.getElementById('donate-quote'), quoteCount = document.getElementById('quote-char-count');
    if (quoteInput && quoteCount) {
        quoteInput.addEventListener('input', () => {
            const length = quoteInput.value.length;
            quoteCount.innerText = `${length}/100`;
            quoteCount.style.color = (length >= 100) ? '#E53E3E' : '#718096';
        });
    }

    const shareUrlBtn = document.getElementById('btn-share-link-donate');
    if (shareUrlBtn) {
        shareUrlBtn.addEventListener('click', () => {
            const shareUrl = 'https://next1deprojectth.github.io/NexT1DE1stTideParty/donate.html';
            const shareData = { title: 'NexT1DE 1st Tide Party', text: 'มาร่วมสนับสนุน NexT1DE 1st Tide Party ไปด้วยกันนะ\nร่วมเป็นส่วนหนึ่งของโปรเจคได้ที่นี่', url: shareUrl };
            if (navigator.share) navigator.share(shareData).catch(console.error);
            else navigator.clipboard.writeText(shareUrl).then(() => alert('คัดลอกลิงก์เรียบร้อยแล้ว!'));
        });
    }

    const navBack = document.getElementById('nav-back');
    if (navBack) {
        navBack.addEventListener('click', () => {
            if (currentState === 1) window.location.href = 'index.html';
            else if (currentState > 1) setStepUI(currentState - 1);
        });
    }

    setStepUI(1);
});

function copyAccountNumber() {
    const accNumber = document.getElementById('account-number').innerText;
    navigator.clipboard.writeText(accNumber).then(() => {
        const copyBtn = document.querySelector('.btn-copy');
        if (copyBtn) {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = 'คัดลอกแล้ว';
            setTimeout(() => { copyBtn.innerHTML = originalText; }, 2000);
        }
    }).catch(err => console.error('Failed to copy: ', err));
}
