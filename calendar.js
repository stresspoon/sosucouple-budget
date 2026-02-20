import { getTx, won, ym, getCatIconInfo, parseReceiptWithGemini, addTx, getKey, getMeAlias, getYouAlias, getPayerLabel, escapeHtml } from './app.js';

let cur = new Date();
const drawer = document.getElementById('dayDrawer');

window.closeDrawer = () => {
    drawer.classList.add('translate-y-full');
};

async function render() {
    const month = ym(cur);
    const mStr = `${cur.getFullYear()}년 ${cur.getMonth() + 1}월`;
    document.getElementById('monthTitle').textContent = mStr;

    const allTx = await getTx();
    const currTx = allTx.filter(t => t.tx_date?.startsWith(month));

    let totalMonth = 0;
    let togetherSum = 0;
    const map = {}; // date -> total amount
    const dayData = {}; // date -> transaction array

    currTx.forEach(t => {
        const amt = Number(t.amount || 0);
        totalMonth += amt;
        if (t.payer === 'together') togetherSum += amt;

        map[t.tx_date] = (map[t.tx_date] || 0) + amt;

        if (!dayData[t.tx_date]) dayData[t.tx_date] = [];
        dayData[t.tx_date].push(t);
    });

    document.getElementById('monthlyTotal').textContent = won(totalMonth);
    document.getElementById('togetherText').textContent = `공동 ${won(togetherSum)}`;

    const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const last = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();

    const cal = document.getElementById('calendarGrid');
    cal.innerHTML = '';

    // empty slots
    for (let i = 0; i < first.getDay(); i++) {
        cal.innerHTML += `<div class="h-16"></div>`;
    }

    const todayStr = ym(new Date()) + '-' + String(new Date().getDate()).padStart(2, '0');

    // days
    for (let d = 1; d <= last; d++) {
        const dt = `${month}-${String(d).padStart(2, '0')}`;
        const hasData = map[dt] > 0;
        const isToday = (dt === todayStr);

        const btnClass = isToday
            ? "group flex flex-col items-center justify-start h-16 pt-1 rounded-lg bg-primary text-background-dark shadow-md ring-2 ring-primary relative transform scale-105 transition-all"
            : "group flex flex-col items-center justify-start h-16 pt-1 rounded-lg hover:bg-surface-dark transition-colors relative cursor-pointer";

        const numClass = isToday
            ? "text-sm font-bold text-background-dark"
            : "text-sm font-medium text-text-main";

        let amtHtml = '';
        if (hasData) {
            let short = (map[dt] / 10000);
            if (short >= 1) short = short.toFixed(1).replace('.0', '') + '만';
            else short = (map[dt] / 1000).toFixed(0) + '천';

            const colorClass = isToday ? "text-background-dark opacity-80 font-bold" : "text-text-muted opacity-80";
            amtHtml = `<span class="text-[10px] mt-1 ${colorClass}">-${short}</span>`;
        }

        const elem = document.createElement('div');
        elem.innerHTML = `
<button class="${btnClass}">
    <span class="${numClass}">${d}</span>
    ${amtHtml}
</button>
`;
        const btn = elem.firstElementChild;
        btn.onclick = () => showDay(dt, dayData[dt] || [], map[dt] || 0);
        cal.appendChild(btn);
    }
}

function showDay(dateStr, txList, totalDayAmt) {
    drawer.classList.remove('translate-y-full');
    const [_, m, d] = dateStr.split('-');
    document.getElementById('drawerTitle').textContent = `${Number(m)}월 ${Number(d)}일`;
    document.getElementById('drawerTotal').textContent = totalDayAmt > 0 ? `-${won(totalDayAmt)}` : '0원';

    const listE = document.getElementById('drawerList');
    if (txList.length === 0) {
        listE.innerHTML = '<div class="text-slate-400 text-center text-sm py-4">이 날은 지출이 없습니다.</div>';
        return;
    }

    listE.innerHTML = txList.map(t => {
        const c = getCatIconInfo(t.category);

        let payerBadge = '';
        const payerLabel = getPayerLabel(t.payer);
        if (t.payer === 'me') {
            payerBadge = `<span class="bg-slate-700 text-slate-200 text-[10px] px-1.5 py-0.5 rounded font-bold ml-2">${escapeHtml(payerLabel)}</span>`;
        } else if (t.payer === 'you') {
            payerBadge = `<span class="bg-indigo-900/50 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded font-bold ml-2">${escapeHtml(payerLabel)}</span>`;
        } else if (t.payer === 'together') {
            payerBadge = `<span class="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded font-bold ml-2 border border-primary/30">${escapeHtml(payerLabel)}</span>`;
        }

        // Generate inner items (세부 내역) if any
        let itemsHtml = '';
        if (t.items && t.items.length > 0) {
            itemsHtml = `<div class="w-full mt-2 pl-2 border-l border-white/10 space-y-1">` +
                t.items.map(item => `
            <div class="flex justify-between text-[11px] text-text-muted">
                <span>- ${escapeHtml(item.name)}</span>
                <span>₩${Number(item.price || 0).toLocaleString()}</span>
            </div>
        `).join('') + `</div>`;
        }

        return `
<a href="/add?id=${t.id}" class="block py-2 border-b border-white/5 last:border-0 cursor-pointer active:bg-white/5 rounded-lg transition-colors">
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl ${c.bgColor} flex items-center justify-center ${c.textColor}">
                <span class="material-symbols-outlined text-[20px]">${c.icon}</span>
            </div>
            <div class="flex flex-col">
                <div class="flex items-center">
                    <span class="text-white font-bold text-sm">${escapeHtml(t.merchant)}</span>
                    ${payerBadge}
                </div>
                <span class="text-text-muted text-[11px]">${t.category}</span>
            </div>
        </div>
        <div class="flex items-center gap-2">
            <p class="text-white font-bold text-sm whitespace-nowrap">-₩${Number(t.amount || 0).toLocaleString()}</p>
            <span class="material-symbols-outlined text-[14px] text-slate-500">chevron_right</span>
        </div>
    </div>
    ${itemsHtml}
</a>
`;
    }).join('');
}


document.getElementById('prevBtn').onclick = () => { cur.setMonth(cur.getMonth() - 1); render(); };
document.getElementById('nextBtn').onclick = () => { cur.setMonth(cur.getMonth() + 1); render(); };

// Set modal aliases
const modalMe = document.getElementById('modalMeAlias');
const modalYou = document.getElementById('modalYouAlias');
if (modalMe) modalMe.textContent = getMeAlias();
if (modalYou) modalYou.textContent = getYouAlias();

// Payer modal handler for camera FAB
let selectedPayer = 'me';
window.handleModalPayerSelect = (payer) => {
    selectedPayer = payer;
    const modal = document.getElementById('payerModal');
    const content = document.getElementById('payerModalContent');
    modal.classList.add('opacity-0');
    content.classList.add('translate-y-full');
    setTimeout(() => modal.classList.add('hidden'), 300);
    document.getElementById('modalCameraInput').click();
};

const modalCameraInput = document.getElementById('modalCameraInput');
if (modalCameraInput) {
    modalCameraInput.onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        if (!getKey()) { alert('설정에서 Gemini API 키를 먼저 등록해주세요.'); return; }
        try {
            const r = await parseReceiptWithGemini(f, getKey());
            await addTx({ ...r, payer: selectedPayer, amount: Number(r.amount || 0) });
            location.reload();
        } catch (err) {
            alert('영수증 인식 실패: ' + err.message);
        }
    };
}

render();
