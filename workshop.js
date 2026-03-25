document.addEventListener('DOMContentLoaded', () => {
    // Check if system is open
    if (typeof API_CONFIG !== 'undefined' && API_CONFIG.IS_WORKSHOP_OPEN === false) {
        window.location.href = 'index.html';
        return;
    }

    // --- State Management ---
    let currentState = 0;
    let selectedSocial = 'x';
    let socialNameInput = '';
    let apiData = null;
    let slipData = null;
    let isEditMode = false;

    let totalRights = 0;
    let fromDirect = 0;

    let itemCount = 1; // Default to 1
    let deliveryMethod = 'onsite'; // onsite or delivery
    let isEditingReception = false;
    let hasPastDelivery = false;
    let pastDeliveryType = 'onsite';
    let expectedTotal = 0;
    let expectedShipping = 0;

    // --- Load Persistent Data ---
    const savedType = localStorage.getItem('next1de_social_type');
    const savedName = localStorage.getItem('next1de_social_name');
    if (savedName) {
        document.getElementById('social-username').value = savedName;
        socialNameInput = savedName; // Also sync to inner state
    }
    if (savedType) {
        selectedSocial = savedType;
    }

    let slipImageBase64 = '';
    let slipMimeType = '';
    let isReturnShippingPrice = false;

    const WORKSHOP_PRICE = 277;
    const SHIPPING_FEE = 50;

    // --- Endpoints ---
    const RECEIVER_NAME_TARGET = "ธัญดา";
    const WEBHOOK_URL = "https://next1de.app.n8n.cloud/webhook/6e4a539b-5580-40f9-a85f-47a488a2e842";
    const API_ENDPOINT = API_CONFIG.BASE_URL;
    const GET_API_URL = `${API_ENDPOINT}?action=getWorkshop`;
    const SAVE_API_URL = API_ENDPOINT;

    // --- DOM Elements ---
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');
    const step3 = document.getElementById('step-3');
    const stepSuccess = document.getElementById('step-success');

    const bar1 = document.getElementById('bar-1');
    const bar2 = document.getElementById('bar-2');
    const bar3 = document.getElementById('bar-3');
    const stepLabel = document.getElementById('step-label-text');
    const navBack = document.getElementById('nav-back');
    const mainBg = document.getElementById('main-bg');
    const socialUsernameEl = document.getElementById('social-username');

    if (socialUsernameEl) {
        socialUsernameEl.addEventListener('input', () => {
            let val = socialUsernameEl.value.replace(/\s/g, '');
            if (val.startsWith('@')) val = val.substring(1);
            socialUsernameEl.value = val;
        });
    }

    // === Step 0 Logic ===
    const btnNextStep0 = document.getElementById('btn-next-step0');
    if (btnNextStep0) {
        btnNextStep0.addEventListener('click', () => {
            isEditMode = false;
            updateStep1Labels();
            goToStep(1);
            stepLabel.innerText = "ข้อมูลผู้ร่วม workshop (1/3)";
        });
    }

    const tabs = document.querySelectorAll('.social-tab');
    tabs.forEach(tab => {
        // Init UI from saved data
        if (savedType && tab.getAttribute('data-social') === savedType) {
            tab.classList.add('active');
        } else if (!savedType && tab.getAttribute('data-social') === selectedSocial) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }

        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            selectedSocial = tab.getAttribute('data-social');
        });
    });

    // Step 0 Edit Button Logic
    const btnEditLocation = document.getElementById('btn-edit-location');
    if (btnEditLocation) {
        btnEditLocation.addEventListener('click', () => {
            isEditMode = true;
            updateStep1Labels();
            goToStep(1);
            stepLabel.innerText = "ข้อมูลผู้ร่วมทำ workshop (1/3)";
        });
    }

    const btnGoRegister = document.getElementById('btn-go-register');
    if (btnGoRegister) {
        btnGoRegister.addEventListener('click', () => {
            isEditMode = false;
            updateStep1Labels();
            document.getElementById('edit-error-modal').style.display = 'none';
            stepLabel.innerText = "ข้อมูลผู้ร่วม workshop (1/3)";
            // Registering as a new user
            itemCount = 1;
            initStep2();
            goToStep(2);
        });
    }

    function updateStep1Labels() {
        const navTitle = document.getElementById('nav-title');
        const socialLabel = document.getElementById('social-login-label');
        const socialNote = document.getElementById('social-login-note');

        if (isEditMode) {
            if (navTitle) navTitle.innerText = "แก้ไขข้อมูล workshop";
            if (socialLabel) socialLabel.innerText = "บัญชีโซเชียลของคุณที่เคยลงทะเบียน Workshop";
            if (socialNote) socialNote.style.display = "none";
        } else {
            if (navTitle) navTitle.innerText = "Workshop NexT1DE";
            if (socialLabel) socialLabel.innerText = "บัญชีโซเชียลของคุณ";
            if (socialNote) socialNote.style.display = "block";
        }
    }

    // === Step 1 Logic ===
    const btnNextStep1 = document.getElementById('btn-next-step1');
    btnNextStep1.addEventListener('click', async () => {
        const usernameEl = document.getElementById('social-username');
        const userValue = usernameEl.value.trim();
        if (!userValue) {
            usernameEl.style.border = "2px solid #E53E3E";
            setTimeout(() => usernameEl.style.border = "1px solid #E2E8F0", 2000);
            return;
        }
        socialNameInput = userValue;

        // --- Save to Cache/LocalStorage ---
        localStorage.setItem('next1de_social_type', selectedSocial);
        localStorage.setItem('next1de_social_name', socialNameInput);

        // Show Loading
        const loader = document.getElementById('api-loading-social');
        btnNextStep1.style.display = 'none';
        loader.style.display = 'block';

        try {
            const res = await fetch(`${GET_API_URL}&socialName=${encodeURIComponent(socialNameInput)}&socialType=${selectedSocial}`);
            const data = await res.json();

            if (data.status === 'ok') {
                apiData = data;
                totalRights = data.rights ? data.rights.total : 0;
                fromDirect = data.rights ? data.rights.from_direct : 0;

                if (isEditMode && fromDirect === 0) {
                    document.getElementById('edit-error-modal').style.display = 'flex';
                    return;
                }

                // Determine past delivery
                if (data.receive) {
                    hasPastDelivery = true;
                    pastDeliveryType = data.receive.delivery_type === 'delivery' ? 'delivery' : 'onsite';
                    deliveryMethod = pastDeliveryType;
                } else {
                    hasPastDelivery = false;
                    deliveryMethod = 'onsite';
                }

                // Allow minimum 0 if they already have rights (or if edit mode)
                if (totalRights > 0 || isEditMode) {
                    itemCount = 0;
                } else {
                    itemCount = 1;
                }

                initStep2();
                goToStep(2);
            } else {
                if (isEditMode) {
                    document.getElementById('edit-error-modal').style.display = 'flex';
                } else {
                    alert('ไม่พบข้อมูล หรือเกิดข้อผิดพลาดในการโหลด');
                }
            }
        } catch (error) {
            console.error(error);
            alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
        } finally {
            loader.style.display = 'none';
            btnNextStep1.style.display = 'block';
        }
    });

    // === Step 2 Logic ===
    const displayRights = document.getElementById('display-current-rights');
    const rightsDetail = document.getElementById('current-rights-detail');
    const displayQty = document.getElementById('display-qty');
    const btnMinus = document.getElementById('btn-qty-minus');
    const btnPlus = document.getElementById('btn-qty-plus');
    const summaryQty = document.getElementById('summary-qty-inline');
    const summaryShipping = document.getElementById('summary-shipping-inline');
    const btnTotalPrice = document.getElementById('btn-total-price');
    const btnNextStep2 = document.getElementById('btn-next-step2');

    const pastBox = document.getElementById('past-reception-box');
    const normalSelector = document.getElementById('reception-selector');
    const pastTypeText = document.getElementById('past-type-text');
    const btnEditReception = document.getElementById('btn-edit-reception');
    const deliveryForm = document.getElementById('delivery-details-form');

    const deliveryCards = document.querySelectorAll('.delivery-method-card');

    function initStep2() {
        const rightsSection = document.getElementById('current-rights-box');
        if (totalRights > 0) {
            if (rightsSection) rightsSection.style.display = 'block';
            displayRights.innerText = totalRights.toString();
            let rightsTextArray = [];
            if (apiData && apiData.rights) {
                if (apiData.rights.from_donate > 0) rightsTextArray.push(`${apiData.rights.from_donate} สิทธิ์จากการโดเนท`);
                if (apiData.rights.from_direct > 0) rightsTextArray.push(`${apiData.rights.from_direct} สิทธิ์จากการซื้อ workshop`);
            }
            if (rightsTextArray.length > 0) {
                rightsDetail.innerText = rightsTextArray.join(' และ ');
                rightsDetail.style.display = 'block';
            } else {
                rightsDetail.style.display = 'none';
            }
        } else {
            if (rightsSection) rightsSection.style.display = 'none';
        }

        isEditingReception = !hasPastDelivery;

        if (hasPastDelivery) {
            pastBox.style.display = 'block';
            normalSelector.style.display = 'none';
            pastTypeText.innerText = pastDeliveryType === 'delivery' ? 'จัดส่งตามที่อยู่' : 'ร่วมทำ workshop ที่จามจุรีสแควร์ วันที่ 24-25 เม.ย. 69';

            const pastDetails = document.getElementById('past-details');
            if (pastDetails) {
                if (pastDeliveryType === 'delivery' && apiData && apiData.receive) {
                    const maskText = (str, maxLen = 15) => {
                        if (!str || str === '-') return '-';
                        const s = String(str).trim();
                        if (s.length <= 2) return s;
                        const hiddenCount = s.length - 2;
                        const xCount = Math.min(hiddenCount, maxLen - 3);
                        return s[0] + 'x'.repeat(xCount) + s[s.length - 1];
                    };

                    const maskPhone = (str) => {
                        if (!str || str === '-') return '-';
                        const s = String(str).trim();
                        if (s.length <= 2) return s;
                        return 'x'.repeat(s.length - 3) + s.slice(-3);
                    };

                    const maskPostal = (str) => {
                        if (!str || str === '-') return '-';
                        const s = String(str).trim();
                        if (s.length <= 2) return s;
                        return 'x'.repeat(s.length - 2) + s.slice(-2);
                    };

                    document.getElementById('past-name').innerText = maskText(apiData.receive.recipient_name);
                    document.getElementById('past-phone').innerText = maskPhone(apiData.receive.shipping_phone);
                    document.getElementById('past-address').innerText = maskText(apiData.receive.shipping_address);
                    document.getElementById('past-postal').innerText = maskPostal(apiData.receive.shipping_postal);
                    document.getElementById('past-fee-note').style.display = 'block';
                    pastDetails.style.display = 'block';
                } else {
                    pastDetails.style.display = 'none';
                    document.getElementById('past-fee-note').style.display = 'none';
                }
            }

            deliveryForm.style.display = 'none';
        } else {
            pastBox.style.display = 'none';
            normalSelector.style.display = 'flex';
            toggleDeliveryForm();
        }

        const shippingFeeText = document.getElementById('shipping-fee-text');
        if (shippingFeeText) {
            if (hasPastDelivery && pastDeliveryType === 'delivery') {
                shippingFeeText.innerText = 'ชำระค่าส่งแล้ว';
                shippingFeeText.style.color = '#48BB78';
            } else {
                shippingFeeText.innerText = 'ชำระเพิ่ม 50 บาท';
                shippingFeeText.style.color = '#F871B4';
            }
        }

        updatePricing();
    }

    btnMinus.addEventListener('click', () => {
        let min = totalRights > 0 ? 0 : 1;
        if (itemCount > min) {
            itemCount--;
            updatePricing();
        }
    });

    btnPlus.addEventListener('click', () => {
        if (itemCount < 10) {
            itemCount++;
            updatePricing();
        }
    });

    deliveryCards.forEach(card => {
        card.addEventListener('click', () => {
            const newMethod = card.getAttribute('data-method');
            const onsiteNotice = document.getElementById('onsite-notice-box');

            if (hasPastDelivery && pastDeliveryType === 'delivery' && newMethod === 'onsite') {
                if (onsiteNotice) onsiteNotice.style.display = 'block';
                isReturnShippingPrice = true;
            } else {
                if (onsiteNotice) onsiteNotice.style.display = 'none';
                isReturnShippingPrice = false;
            }

            deliveryCards.forEach(c => {
                c.classList.remove('active');
                c.style.border = '1px solid #E2E8F0';
            });
            card.classList.add('active');
            card.style.border = '2px solid #286ACD';
            deliveryMethod = newMethod;
            toggleDeliveryForm();
            updatePricing();
        });
    });

    btnEditReception.addEventListener('click', () => {
        const r = apiData ? apiData.receive : null;
        if (r && r.shipping_phone) {
            const inputPhone = prompt("กรุณาระบุเบอร์โทรศัพท์ที่เคยใช้ลงทะเบียนเพื่อระบุตัวตนของคุณ:");
            if (!inputPhone) return;

            const cleanInput = inputPhone.replace(/[^0-9]/g, '');
            const cleanTarget = String(r.shipping_phone).replace(/[^0-9]/g, '');

            if (cleanInput !== cleanTarget) {
                alert("เบอร์โทรศัพท์ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
                return;
            }
        }

        isEditingReception = true;
        pastBox.style.display = 'none';
        normalSelector.style.display = 'flex';

        if (pastDeliveryType === 'delivery' && apiData && apiData.receive) {
            document.getElementById('ship-name').value = apiData.receive.recipient_name || '';
            document.getElementById('ship-phone').value = apiData.receive.shipping_phone || '';
            document.getElementById('ship-address').value = apiData.receive.shipping_address || '';
            document.getElementById('ship-postal').value = apiData.receive.shipping_postal || '';
        }

        // Select matching card
        deliveryCards.forEach(c => {
            if (c.getAttribute('data-method') === pastDeliveryType) {
                c.click();
            }
        });
        updatePricing();
    });

    function checkAddressChanged() {
        if (!isEditMode || !apiData || !apiData.receive) return false;
        const finalMethod = isEditingReception ? deliveryMethod : pastDeliveryType;
        if (finalMethod !== 'delivery') return false;

        const r = apiData.receive;
        const name = document.getElementById('ship-name').value.trim();
        const phone = document.getElementById('ship-phone').value.trim();
        const address = document.getElementById('ship-address').value.trim();
        const postal = document.getElementById('ship-postal').value.trim();

        return (name !== (String(r.recipient_name || ''))) ||
            (phone !== (String(r.shipping_phone || ''))) ||
            (address !== (String(r.shipping_address || ''))) ||
            (postal !== (String(r.shipping_postal || '')));
    }

    ['ship-name', 'ship-phone', 'ship-address', 'ship-postal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                if (isEditMode) updatePricing();
            });
        }
    });

    function toggleDeliveryForm() {
        if (deliveryMethod === 'delivery') {
            deliveryForm.style.display = 'block';
        } else {
            deliveryForm.style.display = 'none';
        }
    }

    function updatePricing() {
        const divider = document.getElementById('location-divider');
        const itemSelector = document.getElementById('item-selector-wrapper');
        const stickySummary = document.querySelector('.sticky-summary-box');

        if (isEditMode) {
            itemCount = 0;
            if (itemSelector) itemSelector.style.display = 'none';
            if (divider) divider.style.display = 'none';
        } else {
            if (itemSelector) itemSelector.style.display = 'block';
            if (divider) divider.style.display = 'block';
        }

        displayQty.innerText = `${itemCount} สิทธิ์`;

        const locationSection = document.getElementById('location-section-wrapper');
        if (locationSection) {
            if (isEditMode) {
                locationSection.style.display = 'block';
            } else if (itemCount === 0) {
                locationSection.style.display = 'none';
            } else {
                locationSection.style.display = 'block';
            }
        }

        // Update Button Styles
        let minActionCount = totalRights > 0 ? 0 : 1;
        if (itemCount <= minActionCount) {
            btnMinus.style.background = "#EDF2F7";
            btnMinus.style.color = "#CBD5E0";
            btnMinus.style.cursor = "not-allowed";
            btnMinus.style.opacity = "0.6";
        } else {
            btnMinus.style.background = "#EDF2F7";
            btnMinus.style.color = "#4A5568";
            btnMinus.style.cursor = "pointer";
            btnMinus.style.opacity = "1";
        }

        let subtotal = isEditMode ? 0 : itemCount * WORKSHOP_PRICE;

        // Calculate shipping logic
        let shipping = 0;
        let finalMethod = isEditingReception ? deliveryMethod : pastDeliveryType;

        if (finalMethod === 'delivery') {
            if (!hasPastDelivery || (hasPastDelivery && pastDeliveryType !== 'delivery')) {
                shipping = SHIPPING_FEE;
            }
        }

        expectedShipping = shipping;
        expectedTotal = subtotal + shipping;

        const formatMoney = (num) => num.toLocaleString('th-TH');

        summaryQty.innerText = itemCount.toString();
        document.getElementById('summary-price-inline').innerText = `${formatMoney(subtotal)} บาท`;
        document.getElementById('summary-shipping-inline').innerText = `${formatMoney(shipping)} บาท`;

        if (isEditMode) {
            const methodChanged = isEditingReception && (finalMethod !== pastDeliveryType);
            const addressChanged = isEditingReception && checkAddressChanged();
            const requiresPayment = (expectedTotal > 0);

            if (stickySummary) {
                if (methodChanged || addressChanged || requiresPayment) {
                    stickySummary.style.display = 'flex';
                    btnNextStep2.style.display = 'block';
                } else {
                    stickySummary.style.display = 'none';
                    btnNextStep2.style.display = 'none';
                }
            }

            if (requiresPayment) {
                btnNextStep2.innerHTML = `ชำระค่าส่ง ${formatMoney(expectedTotal)} บาท`;
                btnNextStep2.style.background = "#FF6666";
            } else {
                btnNextStep2.innerHTML = `ยืนยัน`;
                btnNextStep2.style.background = "linear-gradient(135deg, #286ACD 0%, #A3E4DB 100%)";
            }
        } else {
            if (stickySummary) stickySummary.style.display = 'flex';
            btnNextStep2.style.display = 'block';
            if (expectedTotal === 0 && itemCount === 0) {
                btnNextStep2.innerHTML = `ดูสิทธิ์ (QR Code)`;
                btnNextStep2.style.background = "linear-gradient(135deg, #286ACD 0%, #A3E4DB 100%)";
            } else {
                btnNextStep2.innerHTML = `ยอดชำระ ${formatMoney(expectedTotal)} บาท`;
                btnNextStep2.style.background = "#FF6666";
            }
        }
    }

    btnNextStep2.addEventListener('click', async () => {
        const isFreeEdit = isEditMode && (expectedTotal === 0);
        console.log("btnNextStep2 clicked. isEditMode:", isEditMode, "expectedTotal:", expectedTotal, "isFreeEdit:", isFreeEdit);

        if (isFreeEdit) {
            const loader = document.getElementById('submit-loading');
            if (loader) loader.style.display = 'block';
            btnNextStep2.style.display = 'none';

            try {
                const finalMethod = isEditingReception ? deliveryMethod : pastDeliveryType;
                const isSwitchToOnsite = (hasPastDelivery && pastDeliveryType === 'delivery' && finalMethod === 'onsite');
                const isUpdateAddress = (finalMethod === 'delivery' && checkAddressChanged());

                console.log("Entering Free Edit Logic. isSwitchToOnsite:", isSwitchToOnsite, "isUpdateAddress:", isUpdateAddress, "finalMethod:", finalMethod);

                if (isSwitchToOnsite) {
                    const userId = (apiData.user && apiData.user.user_id) ? apiData.user.user_id : (apiData.userId || apiData.user_id);
                    const payload = {
                        action: "workshopChangeToOnsite",
                        user_id: userId
                    };
                    console.log("Payload (workshopChangeToOnsite):", payload);
                    await fetch(SAVE_API_URL, {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    alert("เปลี่ยนวิธีการทำ workshop เสร็จแล้ว");
                    showSuccessScreen();
                } else if (isUpdateAddress) {
                    const userId = (apiData.user && apiData.user.user_id) ? apiData.user.user_id : (apiData.userId || apiData.user_id);
                    const payload = {
                        action: "updateShipping",
                        user_id: userId,
                        recipient_name: document.getElementById('ship-name').value.trim(),
                        shipping_phone: document.getElementById('ship-phone').value.trim(),
                        shipping_address: document.getElementById('ship-address').value.trim(),
                        shipping_postal: document.getElementById('ship-postal').value.trim()
                    };
                    console.log("Payload (updateShipping):", payload);
                    await fetch(SAVE_API_URL, {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                    alert("แก้ไขที่อยู่จัดส่งเรียบร้อยแล้ว");
                    showSuccessScreen();
                } else {
                    console.warn("Free Edit block entered but no conditions met. Fallback to success.");
                    showSuccessScreen();
                }
            } catch (err) {
                console.error("Critical Error in Free Edit Flow:", err);
                alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + err.message);
            } finally {
                if (loader) loader.style.display = 'none';
                btnNextStep2.style.display = 'block';
            }
            return;
        }

        if (expectedTotal === 0 && itemCount === 0 && !isEditMode) {
            console.log("Standard 0-total 0-item checkout, showing success.");
            showSuccessScreen();
        } else {
            console.log("Moving to Step 3 for payment/verification.");
            let finalMethod = isEditingReception ? deliveryMethod : pastDeliveryType;
            if (finalMethod === 'delivery' && (!hasPastDelivery || isEditingReception)) {
                const nameV = document.getElementById('ship-name').value.trim();
                const phoneV = document.getElementById('ship-phone').value.trim();
                const addrV = document.getElementById('ship-address').value.trim();
                const postalV = document.getElementById('ship-postal').value.trim();

                if (!nameV || !phoneV || !addrV || !postalV) {
                    alert("กรุณากรอกข้อมูลจัดส่งให้ครบถ้วน");
                    return;
                }
            }
            initStep3();
            goToStep(3);
        }
    });

    // === Step 3 Logic ===
    function initStep3() {
        document.getElementById('final-qty').innerText = itemCount;
        document.getElementById('final-base-price').innerText = itemCount * WORKSHOP_PRICE;
        document.getElementById('final-shipping').innerText = expectedShipping;
        document.getElementById('final-total').innerText = expectedTotal;

        // Reset verify UI
        document.getElementById('slip-file-input').value = "";
        document.getElementById('upload-zone-content').style.display = 'flex';
        document.getElementById('upload-preview-wrapper').style.display = 'none';

        document.getElementById('api-loading').style.display = 'none';
        document.getElementById('verification-result-box').style.display = 'none';
        document.getElementById('btn-submit-final').style.display = 'none';
    }

    // Expose file input trigger
    window.triggerFileInput = function () {
        document.getElementById('slip-file-input').click();
    };

    window.handleFileSelected = function (input) {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            slipMimeType = file.type;

            document.getElementById('upload-zone-content').style.display = 'none';
            const previewWrapper = document.getElementById('upload-preview-wrapper');
            const previewImg = document.getElementById('slip-preview-img');
            previewWrapper.style.display = 'block';

            const reader = new FileReader();
            reader.onload = function (e) {
                previewImg.src = e.target.result;
                slipImageBase64 = e.target.result.split(',')[1];
                verifySlipWithAI(file);
                // Clear input value so same file can be selected again
                input.value = "";
            };
            reader.readAsDataURL(file);
        }
    };

    async function verifySlipWithAI(file) {
        document.getElementById('api-loading').style.display = 'block';
        document.getElementById('verification-result-box').style.display = 'none';
        document.getElementById('btn-submit-final').style.display = 'none';

        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('AI analysis failed');
            const aiResult = await response.json();

            // 1. Not a slip check
            if (!aiResult || aiResult.is_slip === false || !aiResult.amount) {
                showVerifyError("ไม่สามารถอ่านสลิปได้ กรุณาลองใหม่อีกครั้ง");
                return;
            }

            // 2. Receiver Name Check
            const rName = aiResult.receiver_name || '';
            if (!rName.includes(RECEIVER_NAME_TARGET)) {
                showVerifyError("บัญชีปลายทางไม่ถูกต้อง ");
                return;
            }

            // 3. Duplicate Ref Check
            const refNum = aiResult.ref_number || aiResult.transaction_ref;
            if (refNum && apiData && apiData.workshops) {
                const isDuplicate = apiData.workshops.some(w => w.transaction_ref === refNum);
                if (isDuplicate) {
                    showVerifyError("สลิปนี้ถูกใช้งานไปแล้ว ไม่สามารถใช้งานซ้ำได้");
                    return;
                }
            }

            // 4. Amount Check
            let parseAmountRaw = String(aiResult.amount).replace(/,/g, '');
            let amountExtracted = parseFloat(parseAmountRaw) || 0;

            if (Math.abs(amountExtracted - expectedTotal) > 0.1) {
                showVerifyError(`ยอดเงินไม่ถูกต้อง (สลิป: ${amountExtracted.toLocaleString()} ฿, ยอดที่ต้องจ่าย: ${expectedTotal.toLocaleString()} ฿)`);
                return;
            }

            slipData = aiResult;
            showVerifySuccess();

        } catch (error) {
            console.error('AI Verify Error:', error);
            showVerifyError("เกิดข้อผิดพลาดทางเทคนิคในการตรวจสอบสลิป");
        } finally {
            document.getElementById('api-loading').style.display = 'none';
        }
    }

    function showVerifyError(msg) {
        document.getElementById('verification-result-box').style.display = 'block';

        const verifySuccessDiv = document.getElementById('verify-success');
        const verifyErrorDiv = document.getElementById('verify-error');
        if (verifySuccessDiv) verifySuccessDiv.style.display = 'none';
        if (verifyErrorDiv) {
            verifyErrorDiv.style.display = 'block';
            const msgEl = document.getElementById('verify-error-msg');
            if (msgEl) msgEl.innerText = msg;
        }

        document.getElementById('btn-submit-final').style.display = 'none';
        // Clear input as well for re-upload
        const fileInput = document.getElementById('slip-file-input');
        if (fileInput) fileInput.value = "";
    }

    function showVerifySuccess() {
        document.getElementById('verification-result-box').style.display = 'block';

        const verifySuccessDiv = document.getElementById('verify-success');
        const verifyErrorDiv = document.getElementById('verify-error');
        if (verifySuccessDiv) verifySuccessDiv.style.display = 'block';
        if (verifyErrorDiv) verifyErrorDiv.style.display = 'none';

        document.getElementById('verify-sender-name').innerText = slipData.sender_name || '-';
        document.getElementById('verify-amount').innerText = `฿ ${slipData.amount.toLocaleString()}`;
        document.getElementById('verify-date').innerText = slipData.date || '-';

        document.getElementById('btn-submit-final').style.display = 'block';
    }

    const btnSubmit = document.getElementById('btn-submit-final');
    btnSubmit.addEventListener('click', async () => {
        btnSubmit.style.display = 'none';
        document.getElementById('submit-loading').style.display = 'block';

        let finalMethod = isEditingReception ? deliveryMethod : pastDeliveryType;
        let shipName = document.getElementById('ship-name').value;
        let shipPhone = document.getElementById('ship-phone').value;
        let shipAddress = document.getElementById('ship-address').value;
        let shipPostal = document.getElementById('ship-postal').value;

        let isIncludeShipping = (finalMethod === 'delivery' && (!hasPastDelivery || pastDeliveryType !== 'delivery'));

        try {
            // 1. Upload Image first (Same as donate.js)
            let uploadedImageUrl = "";
            if (slipImageBase64) {
                const uploadBody = {
                    action: "uploadImage",
                    mimeType: slipMimeType,
                    base64: slipImageBase64
                };
                const uploadRes = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    body: JSON.stringify(uploadBody)
                });
                const uploadData = await uploadRes.json();
                if (uploadData.status === 'ok') {
                    uploadedImageUrl = uploadData.view_url;
                } else {
                    throw new Error('ไม่สามารถอัปโหลดรูปภาพได้');
                }
            }

            // 2. Save Workshop Data
            const payload = {
                action: "saveWorkshop",
                social_name: socialNameInput,
                social_type: selectedSocial,
                name: slipData.sender_name || "",
                bank_no: slipData.sender_account || "",
                bank: slipData.bank_code || "",
                username: socialNameInput,
                transaction_date: slipData.date ? slipData.date.replace(/\//g, '/') : "",
                transaction_ref: slipData.ref_number || "",
                receive_name: slipData.receiver_name || "",
                amount: isEditMode ? expectedTotal : (slipData.amount || expectedTotal),
                item_count: isEditMode ? 0 : itemCount,
                image: uploadedImageUrl,
                include_shipping: isIncludeShipping,
                event_type: "workshop",
                delivery_type: finalMethod,
                recipient_name: finalMethod === 'delivery' ? shipName : "",
                shipping_phone: finalMethod === 'delivery' ? shipPhone : "",
                shipping_address: finalMethod === 'delivery' ? shipAddress : "",
                shipping_postal: finalMethod === 'delivery' ? shipPostal : "",
                remark: (isEditMode && expectedShipping > 0) ? "ค่าส่งจากการเปลี่ยนวิธีการรับ workshop" : ""
            };

            await fetch(SAVE_API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    ...payload,
                    isReturnShippingPrice: isReturnShippingPrice
                })
            });
            showSuccessScreen();
        } catch (error) {
            console.error('Save failed', error);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message);
            document.getElementById('submit-loading').style.display = 'none';
        }
    });

    // === Success Screen Logic ===
    function showSuccessScreen() {
        const indicator = document.querySelector('.step-indicator-container');
        if (indicator) indicator.style.display = 'none';

        const navbar = document.querySelector('.nav-bar');
        if (navbar) navbar.style.display = 'none';

        const stickyBox = document.querySelector('.sticky-summary-box');
        if (stickyBox) stickyBox.style.display = 'none';

        // Show background
        if (mainBg) {
            mainBg.classList.remove('donate-hide');
            mainBg.style.display = 'block';
            mainBg.style.background = 'url("images/background_workshop.png") no-repeat center center / cover';
            mainBg.innerHTML = '<div style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:-1;"></div>';
        }

        // Remove overflow:hidden so it can scroll properly on all devices
        document.body.style.overflow = '';
        window.scrollTo(0, 0);

        document.querySelectorAll('.donate-step').forEach(s => {
            s.style.display = 'none';
        });

        // Final fallback for step-0 button just in case
        const step0Btn = document.querySelector('.step0-btn-wrapper');
        if (step0Btn) step0Btn.style.display = 'none';

        if (stepSuccess) stepSuccess.style.display = 'flex'; // It's flex in new design

        let finalTotalRights = totalRights + itemCount;
        document.getElementById('success-total-rights').innerText = finalTotalRights;

    }

    document.getElementById('btn-back-home').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    const loadImageAsDataUrl = (relativePath) => {
        if (window.location.protocol === 'file:') {
            return Promise.resolve(null);
        }
        return fetch(new URL(relativePath, window.location.href))
            .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('fetch'))))
            .then(
                (blob) =>
                    new Promise((resolve) => {
                        const fr = new FileReader();
                        fr.onload = () => resolve(fr.result);
                        fr.onerror = () => resolve(null);
                        fr.readAsDataURL(blob);
                    })
            )
            .catch(() => null);
    };

    const padCanvasToAspectRatio = (source, widthRatio, heightRatio) => {
        const targetAspect = widthRatio / heightRatio;
        const sw = source.width;
        const sh = source.height;
        const curAspect = sw / sh;
        let outW;
        let outH;
        if (curAspect > targetAspect + 0.0001) {
            outW = sw;
            outH = Math.max(1, Math.round(sw / targetAspect));
        } else {
            outH = sh;
            outW = Math.max(1, Math.round(sh * targetAspect));
        }
        const out = document.createElement('canvas');
        out.width = outW;
        out.height = outH;
        const ctx = out.getContext('2d');
        const dx = Math.floor((outW - sw) / 2);
        const dy = Math.floor((outH - sh) / 2);
        ctx.fillStyle = '#0c1222';
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(source, dx, dy);
        return out;
    };

    const cleanupHtml2CanvasArtifacts = () => {
        document.querySelectorAll('.html2canvas-container').forEach((el) => el.remove());
    };

    const shareBtn = document.getElementById('btn-share');
    let workshopShareInProgress = false;
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            if (workshopShareInProgress) return;
            const captureRoot =
                document.getElementById('workshop-share-capture-root') ||
                document.getElementById('step-success');
            if (!captureRoot) return;

            workshopShareInProgress = true;

            const [bgDataUrl, logoDataUrl] = await Promise.all([
                loadImageAsDataUrl('images/background_workshop.png'),
                loadImageAsDataUrl('images/logo-project.png')
            ]);

            const fallbackBg =
                'linear-gradient(165deg, #243b6b 0%, #2f6fdb 42%, #1ba89a 100%)';

            html2canvas(captureRoot, {
                useCORS: false,
                scale: 2,
                backgroundColor: null,
                logging: false,
                onclone: (clonedDoc) => {
                    clonedDoc.body.style.margin = '0';
                    clonedDoc.body.style.padding = '0';
                    clonedDoc.body.style.backgroundColor = 'transparent';
                    clonedDoc.querySelectorAll('script').forEach((el) => el.remove());
                    clonedDoc.querySelectorAll('link[rel="preload"]').forEach((el) => el.remove());

                    const root = clonedDoc.getElementById('workshop-share-capture-root');
                    const liveRoot = document.getElementById('workshop-share-capture-root');
                    if (!root) return;

                    const h = liveRoot ? liveRoot.scrollHeight : root.scrollHeight;
                    root.style.boxSizing = 'border-box';
                    // FORCE 3:4 RATIO
                    root.style.width = '600px';
                    root.style.height = '800px';
                    root.style.padding = '50px 30px';
                    root.style.display = 'flex';
                    root.style.flexDirection = 'column';
                    root.style.alignItems = 'center';
                    root.style.justifyContent = 'center';
                    root.style.setProperty('opacity', '1', 'important');
                    root.style.setProperty('filter', 'none', 'important');
                    if (bgDataUrl) {
                        // Apply 50% BLACK OVERLAY on background image
                        root.style.background = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${bgDataUrl}) center center / cover no-repeat`;
                    } else {
                        root.style.background = fallbackBg;
                    }

                    const pillCardStack = clonedDoc.getElementById('workshop-success-pill-card');
                    if (pillCardStack) {
                        pillCardStack.style.setProperty('display', 'flex', 'important');
                        pillCardStack.style.setProperty('flex-direction', 'column', 'important');
                        pillCardStack.style.setProperty('align-items', 'center', 'important');
                        pillCardStack.style.setProperty('justify-content', 'flex-start', 'important');
                        pillCardStack.style.setProperty('gap', '0', 'important');
                        pillCardStack.style.setProperty('width', '100%', 'important');
                        pillCardStack.style.setProperty('max-width', '450px', 'important');
                        pillCardStack.style.setProperty('margin', '0 auto 20px', 'important');
                        pillCardStack.style.setProperty('box-sizing', 'border-box', 'important');

                        const pillEl = pillCardStack.children[0];
                        const cardEl = pillCardStack.children[1];
                        if (pillEl) {
                            pillEl.style.setProperty('position', 'relative', 'important');
                            pillEl.style.setProperty('z-index', '10', 'important');
                            pillEl.style.setProperty('background', '#FF7B9C', 'important');
                            pillEl.style.setProperty('color', '#ffffff', 'important');
                            pillEl.style.setProperty('margin', '0 auto -20px', 'important'); // Pull it over the white card
                            pillEl.style.setProperty('flex-shrink', '0', 'important');
                            pillEl.style.setProperty('padding', '10px 30px', 'important');
                            pillEl.style.setProperty('white-space', 'nowrap', 'important');
                            pillEl.style.setProperty('border-radius', '100px', 'important');
                            pillEl.style.setProperty('font-size', '1rem', 'important');
                        }
                        if (cardEl) {
                            cardEl.style.setProperty('margin', '0', 'important');
                            cardEl.style.setProperty('position', 'relative', 'important');
                            cardEl.style.setProperty('z-index', '1', 'important');
                            cardEl.style.setProperty('flex-shrink', '0', 'important');
                            cardEl.style.setProperty('background', '#ffffff', 'important');
                            cardEl.style.setProperty('padding-top', '40px', 'important'); // Extra padding for the pill
                        }
                    }

                    root.querySelectorAll('.success-project-title').forEach((el) => {
                        el.style.setProperty('background', 'none', 'important');
                        el.style.setProperty('-webkit-background-clip', 'border-box', 'important');
                        el.style.setProperty('background-clip', 'border-box', 'important');
                        el.style.setProperty('-webkit-text-fill-color', '#A3E4DB', 'important');
                        el.style.setProperty('color', '#A3E4DB', 'important');
                        el.style.setProperty('font-size', '34px', 'important');
                        el.style.setProperty('white-space', 'nowrap', 'important');
                        el.style.setProperty('font-weight', '800', 'important');
                        el.style.setProperty('filter', 'none', 'important');
                        el.style.setProperty('text-shadow', 'none', 'important');
                    });

                    root.querySelectorAll('div[style*="backdrop-filter"]').forEach((div) => {
                        div.style.setProperty('background', '#ffffff', 'important');
                        div.style.setProperty('backdrop-filter', 'none', 'important');
                        div.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
                        div.style.setProperty('opacity', '1', 'important');
                    });

                    root.querySelectorAll('img').forEach((img) => {
                        img.style.setProperty('opacity', '1', 'important');
                        if (logoDataUrl && (img.src.includes('logo') || img.alt === 'NexT1DE')) {
                            const parent = img.parentElement;
                            if (parent) {
                                parent.style.background = `url(${logoDataUrl}) center center / cover no-repeat`;
                                parent.style.setProperty('background', `url(${logoDataUrl}) center center / cover no-repeat`, 'important');
                                img.style.display = 'none';
                            }
                        } else if (logoDataUrl && !img.src.includes('qr')) {
                            img.src = logoDataUrl;
                        } else {
                            // If it's something else not loaded, hide it
                            if (!img.src.startsWith('data:') && !img.src.includes('qr')) {
                                img.style.display = 'none';
                            }
                        }
                    });

                    root.querySelectorAll('h2, p').forEach((el) => {
                        const st = el.getAttribute('style') || '';
                        if (st.includes('text-shadow') || st.includes('color: white')) {
                            el.style.setProperty('opacity', '1', 'important');
                            el.style.setProperty('color', '#ffffff', 'important');
                        }
                    });

                    root.querySelectorAll('span, p').forEach((el) => {
                        const st = el.getAttribute('style') || '';
                        if (st.includes('#1A202C') || st.includes('#4A5568')) {
                            el.style.setProperty('opacity', '1', 'important');
                        }
                        if (st.includes('#1A202C')) {
                            el.style.setProperty('color', '#1a202c', 'important');
                        }
                        if (st.includes('#4A5568')) {
                            el.style.setProperty('color', '#2d3748', 'important');
                        }
                    });
                }
            })
                .then((canvas) => {
                    cleanupHtml2CanvasArtifacts();
                    const outCanvas = padCanvasToAspectRatio(canvas, 3, 4);

                    outCanvas.toBlob(
                        (blob) => {
                            workshopShareInProgress = false;
                            cleanupHtml2CanvasArtifacts();
                            if (!blob) return;
                            const file = new File([blob], 'NexT1DE-Workshop.png', { type: 'image/png' });
                            const shareHashtags = '#NexT1DE1stTideParty #NexT1DEProjectTH #NexT1DE';
                            const shareDataWithFiles = {
                                files: [file],
                                title: 'NexT1DE 1st Tide Party',
                                text: shareHashtags
                            };

                            if (navigator.share && (!navigator.canShare || navigator.canShare(shareDataWithFiles))) {
                                navigator.share(shareDataWithFiles).catch((e) => console.log('Share failed', e));
                            } else {
                                const link = document.createElement('a');
                                link.href = outCanvas.toDataURL('image/png');
                                link.download = 'NexT1DE-Workshop.png';
                                link.click();
                                alert(
                                    'เบราว์เซอร์ของคุณไม่รองรับการแชร์รูปภาพโดยตรง ระบบบันทึกรูปภาพลงในเครื่องแล้ว คุณสามารถแชร์ต่อได้ทันที!'
                                );
                            }
                        },
                        'image/png',
                        1
                    );
                })
                .catch((err) => {
                    console.error('Capture failed', err);
                    cleanupHtml2CanvasArtifacts();
                    workshopShareInProgress = false;
                    alert('เกิดข้อผิดพลาดในการสร้างรูปภาพ');
                });
        });
    }

    const shareUrlBtn = document.getElementById('btn-share-url');
    if (shareUrlBtn) {
        shareUrlBtn.addEventListener('click', () => {
            const shareUrl = 'https://next1deprojectth.github.io/NexT1DE1stTideParty/workshop.html';
            const shareData = {
                title: 'NexT1DE 1st Tide Party',
                text: 'มาร่วมสนับสนุน NexT1DE 1st Tide Party ไปด้วยกันนะ\nร่วมเป็นส่วนหนึ่งของโปรเจคได้ที่นี่',
                url: shareUrl
            };
            if (navigator.share) {
                navigator.share(shareData).catch(console.error);
            } else {
                // Only copy the URL
                navigator.clipboard.writeText(shareUrl).then(() => {
                    alert('คัดลอกลิงก์เรียบร้อยแล้ว!');
                });
            }
        });
    }

    const backHomeBtn = document.getElementById('btn-back-home');
    if (backHomeBtn) {
        backHomeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // === Navigation System ===
    function goToStep(step) {
        document.querySelectorAll('.donate-step').forEach(s => s.style.display = 'none');
        const targetStep = document.getElementById(`step-${step}`);
        if (targetStep) targetStep.style.display = 'block';
        currentState = step;

        if (bar1) {
            bar1.className = 'progress-bar-item';
            if (step >= 1) bar1.classList.add('step-1-active');
        }
        if (bar2) {
            bar2.className = 'progress-bar-item';
            if (step >= 2) bar2.classList.add('step-2-active');
        }
        if (bar3) {
            bar3.className = 'progress-bar-item';
            if (step >= 3) bar3.classList.add('step-3-active');
        }

        if (step === 1) {
            stepLabel.innerText = "ข้อมูลผู้ร่วมทำ Workshop (1/3)";
        }
        if (step === 2) {
            stepLabel.innerText = isEditMode ? "แก้ไขวิธีรับ Workshop (2/3)" : "เลือกสิทธิ์และวิธีรับ (2/3)";
        }
        if (step === 3) {
            stepLabel.innerText = "ชำระเงินและแนบหลักฐานการชำระ (3/3)";
        }

        const stepIndicatorWrapper = document.getElementById('step-indicator-wrapper');
        if (step === 0) {
            if (stepIndicatorWrapper) stepIndicatorWrapper.style.display = 'none';
        } else {
            if (stepIndicatorWrapper) stepIndicatorWrapper.style.display = 'block';
        }

        const stickySummary = document.querySelector('.sticky-summary-box');
        if (stickySummary) {
            if (step === 2) {
                // Let updatePricing handle display
                updatePricing();
            } else {
                stickySummary.style.display = 'none';
            }
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    navBack.addEventListener('click', () => {
        if (currentState === 0) {
            window.location.href = 'index.html';
        } else if (currentState === 1) {
            goToStep(0);
        } else {
            goToStep(currentState - 1);
        }
    });

});

// --- Copy Function ---
function copyAccountNumber() {
    const accNumber = document.getElementById('account-number').innerText;
    navigator.clipboard.writeText(accNumber).then(() => {
        const copyBtn = document.querySelector('.btn-copy');
        if (copyBtn) {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = 'คัดลอกแล้ว';
            setTimeout(() => {
                copyBtn.innerHTML = originalText;
            }, 2000);
        }
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}
