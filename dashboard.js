import { getKey, getTx, addTx, won, ym, parseReceiptWithGemini, getCatIconInfo, getBudget, getMeAlias, getYouAlias, getPayerLabel, escapeHtml } from './app.js';

const BUDGET = getBudget();

// Data Load (top-level await — no DOMContentLoaded needed for modules)
const m = ym();
const allTx = await getTx();

const currTx = allTx.filter(t => t.tx_date?.startsWith(m));

let total = 0, me = 0, you = 0, together = 0;
currTx.forEach(t => {
    const a = Number(t.amount || 0);
    total += a;
    if (t.payer === 'me') me += a;
    else if (t.payer === 'you') you += a;
    else if (t.payer === 'together') together += a;
    else me += a;
});

// Overview numbers
document.getElementById('totalExp').textContent = won(total);
document.getElementById('totalExpSmall').textContent = won(total);
document.getElementById('meExp').textContent = won(me);
document.getElementById('youExp').textContent = won(you);

const sharedRatio = total > 0 ? Math.round((together / total) * 100) : 0;
document.getElementById('sharedPercentage').textContent = `공동 ${sharedRatio}%`;

// Budget Bar
const budgetPerc = Math.min(100, Math.round((total / BUDGET) * 100));
const budgetBar = document.getElementById('budgetBar');
budgetBar.style.width = `${budgetPerc}%`;
const left = BUDGET - total;
if (left < 0) {
    document.getElementById('budgetLeft').textContent = `-${won(Math.abs(left))}`;
    document.getElementById('budgetLeft').classList.replace('text-primary', 'text-red-500');
    budgetBar.classList.replace('from-primary', 'from-red-500');
    budgetBar.classList.replace('to-[#0fb845]', 'to-red-600');
    document.getElementById('budgetAlert').classList.remove('hidden');
} else {
    document.getElementById('budgetLeft').textContent = won(left);
}

// Recent List
const recentList = document.getElementById('recentList');
const recentTx = currTx.slice().reverse().slice(0, 5);
if (recentTx.length === 0) {
    recentList.innerHTML = '<div class="text-slate-400 text-center text-sm py-4">이번 달 내역이 아직 없어요.</div>';
} else {
    recentList.innerHTML = recentTx.map(t => {
        const catInfo = getCatIconInfo(t.category);

        let payerBadge = '';
        const payerLabel = getPayerLabel(t.payer);
        if (t.payer === 'me') {
            payerBadge = `<span class="bg-slate-700 text-slate-200 text-[10px] px-1.5 py-0.5 rounded font-bold ml-2 relative -top-0.5">${escapeHtml(payerLabel)}</span>`;
        } else if (t.payer === 'you') {
            payerBadge = `<span class="bg-indigo-900/50 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded font-bold ml-2 relative -top-0.5">${escapeHtml(payerLabel)}</span>`;
        } else if (t.payer === 'together') {
            payerBadge = `<span class="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded font-bold ml-2 relative -top-0.5 border border-primary/30">${escapeHtml(payerLabel)}</span>`;
        }

        return `
    <a href="/add?id=${t.id}" class="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#1c2e22] border border-transparent dark:border-[#2a4232] hover:border-primary/30 transition-all cursor-pointer active:scale-[0.98]">
        <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl ${catInfo.bgColor} flex items-center justify-center ${catInfo.textColor}">
                <span class="material-symbols-outlined">${catInfo.icon}</span>
            </div>
            <div class="flex flex-col">
                <div class="flex items-center">
                    <span class="font-bold text-slate-900 dark:text-white truncate max-w-[120px]">${escapeHtml(t.merchant || '미분류')}</span>
                    ${payerBadge}
                </div>
                <span class="text-xs text-slate-500 dark:text-slate-400">${t.category || '기타'} • ${t.tx_date.slice(5)}</span>
            </div>
        </div>
        <div class="flex items-center gap-2">
            <span class="font-bold text-slate-900 dark:text-white whitespace-nowrap">-₩${Number(t.amount || 0).toLocaleString()}</span>
            <span class="material-symbols-outlined text-[16px] text-slate-500">chevron_right</span>
        </div>
    </a>`;
    }).join('');
}

// Modal elements
const payerModal = document.getElementById('payerModal');
const payerModalContent = document.getElementById('payerModalContent');
const modalMeAlias = document.getElementById('modalMeAlias');
const modalYouAlias = document.getElementById('modalYouAlias');

if (modalMeAlias) modalMeAlias.textContent = getMeAlias();
if (modalYouAlias) modalYouAlias.textContent = getYouAlias();

let currentUploadAction = null;

const openModal = (action) => {
    currentUploadAction = action;
    payerModal.classList.remove('hidden');
    setTimeout(() => {
        payerModal.classList.remove('opacity-0');
        payerModalContent.classList.remove('translate-y-full');
    }, 10);
};

const closeModal = () => {
    payerModal.classList.add('opacity-0');
    payerModalContent.classList.add('translate-y-full');
    setTimeout(() => payerModal.classList.add('hidden'), 300);
};

const closeBtn = document.getElementById('closePayerModal');
if (closeBtn) closeBtn.onclick = closeModal;

const cameraBtn = document.getElementById('cameraBtn');
if (cameraBtn) cameraBtn.onclick = () => openModal('camera');

const uploadBtn = document.getElementById('uploadBtn');
if (uploadBtn) uploadBtn.onclick = () => openModal('file');

let selectedTempPayer = 'me';

document.querySelectorAll('.payer-btn').forEach(btn => {
    btn.onclick = () => {
        selectedTempPayer = btn.getAttribute('data-payer');
        closeModal();
        if (currentUploadAction === 'camera') document.getElementById('cameraInput').click();
        else document.getElementById('uploadInput').click();
    };
});

// Camera / Upload
const scanStatus = document.getElementById('scanStatus');
const handleScan = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!getKey()) {
        scanStatus.textContent = '* 설정에서 API 키를 저장하세요.';
        scanStatus.classList.replace('text-primary', 'text-red-500');
        return;
    }
    scanStatus.classList.replace('text-red-500', 'text-primary');
    scanStatus.textContent = '영수증 인식 중입니다...';
    try {
        const r = await parseReceiptWithGemini(f, getKey());
        await addTx({ ...r, payer: selectedTempPayer, amount: Number(r.amount || 0) });
        scanStatus.textContent = '저장 성공! 새로고침합니다.';
        setTimeout(() => location.reload(), 1000);
    } catch (err) {
        scanStatus.classList.replace('text-primary', 'text-red-500');
        scanStatus.textContent = '실패: ' + err.message;
    }
};

document.getElementById('cameraInput').onchange = handleScan;
document.getElementById('uploadInput').onchange = handleScan;

// View Toggle Logic
const homeView = document.getElementById('homeView');
const dashboardView = document.getElementById('dashboardView');
const toggleDashboardBtn = document.getElementById('toggleDashboardBtn');
const backToHomeBtn = document.getElementById('backToHomeBtn');

if (toggleDashboardBtn && backToHomeBtn) {
    toggleDashboardBtn.onclick = () => {
        homeView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        dashboardView.classList.add('flex');
    };

    backToHomeBtn.onclick = () => {
        dashboardView.classList.add('hidden');
        dashboardView.classList.remove('flex');
        homeView.classList.remove('hidden');
    };
}
