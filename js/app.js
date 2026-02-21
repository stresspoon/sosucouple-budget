import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

let supabase = null;
try {
  const envRes = await fetch('/api/env');
  if (envRes.ok) {
    const env = await envRes.json();
    if (env.supabaseUrl && env.supabaseAnonKey) {
      supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
    }
  }
} catch (e) {
  console.warn("Supabase init failed.", e);
}

const KEY = 'gemini_api_key';
const TX = 'ledger_transactions_v2';
const CATS = ['식비', '카페', '교통', '쇼핑', '의료', '주거', '문화생활', '기타'];

// Run 1-time migration from localStorage
if (supabase) {
  const oldDataStr = localStorage.getItem(TX);
  if (oldDataStr) {
    try {
      const oldArr = JSON.parse(oldDataStr);
      if (Array.isArray(oldArr) && oldArr.length > 0) {
        const inserts = oldArr.map(t => ({
          tx_date: t.tx_date || new Date().toISOString().split('T')[0],
          amount: Number(t.amount) || 0,
          category: t.category || '기타',
          merchant: t.merchant || '미상',
          payer: t.payer || 'me',
          memo: t.memo || '',
          items: t.items || []
        }));
        await supabase.from('transactions').insert(inserts);
      }
      localStorage.removeItem(TX);
    } catch (e) { console.error("Migration error", e); }
  }
}

export function getKey() { return localStorage.getItem(KEY) || ''; }
export function setKey(v) { localStorage.setItem(KEY, v || ''); }

const BUDGET_KEY = 'couple_monthly_budget';
export function getBudget() { return Number(localStorage.getItem(BUDGET_KEY)) || 1500000; }
export function setBudget(v) { localStorage.setItem(BUDGET_KEY, Number(v) || 1500000); }

export function getMeAlias() { return localStorage.getItem('alias_me') || '나'; }
export function setMeAlias(v) { localStorage.setItem('alias_me', v || '나'); }
export function getYouAlias() { return localStorage.getItem('alias_you') || '상대방'; }
export function setYouAlias(v) { localStorage.setItem('alias_you', v || '상대방'); }

export function getMyRole() { return localStorage.getItem('device_role') || '1'; }
export function setMyRole(v) { localStorage.setItem('device_role', v); }

export function toAbsolutePayer(relative) {
  if (relative === 'together') return 'together';
  const my = getMyRole();
  const other = my === '1' ? '2' : '1';
  if (relative === 'me') return my;
  if (relative === 'you') return other;
  return my;
}

export function toRelativePayer(stored) {
  if (stored === 'together') return 'together';
  const my = getMyRole();
  if (stored === my) return 'me';
  if (stored === '1' || stored === '2') return 'you';
  // Legacy: 'me'/'you' — treat 'me' as role '1', 'you' as role '2'
  if (stored === 'me') return my === '1' ? 'me' : 'you';
  if (stored === 'you') return my === '1' ? 'you' : 'me';
  return 'me';
}

export async function getTx(monthFilter) {
  if (!supabase) return [];
  let query = supabase.from('transactions')
    .select('*')
    .order('tx_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (monthFilter && /^\d{4}-\d{2}$/.test(monthFilter)) {
    const startDate = monthFilter + '-01';
    const [y, m] = monthFilter.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = monthFilter + '-' + String(lastDay).padStart(2, '0');
    query = query.gte('tx_date', startDate).lte('tx_date', endDate);
  } else {
    query = query.limit(10000);
  }
  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function addTx(t) {
  if (!supabase) throw new Error('데이터베이스에 연결할 수 없습니다.');
  // Input validation
  const amount = Number(t.amount);
  if (!amount || amount <= 0 || amount > 100000000) throw new Error('유효하지 않은 금액입니다.');
  if (!t.tx_date || !/^\d{4}-\d{2}-\d{2}$/.test(t.tx_date)) throw new Error('유효하지 않은 날짜입니다.');
  if (!CATS.includes(t.category)) t.category = '기타';
  if (!['1', '2', 'together', 'me', 'you'].includes(t.payer)) t.payer = '1';
  t.merchant = String(t.merchant || '미분류').slice(0, 100);
  t.memo = String(t.memo || '').slice(0, 500);
  if (!Array.isArray(t.items)) t.items = [];
  const { error } = await supabase.from('transactions').insert([t]);
  if (error) throw new Error(error.message || '저장에 실패했습니다.');
}

export async function deleteTx(id) {
  if (!supabase) throw new Error('데이터베이스에 연결할 수 없습니다.');
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw new Error(error.message || '삭제에 실패했습니다.');
}

export async function getTxById(id) {
  if (!supabase) throw new Error('데이터베이스에 연결할 수 없습니다.');
  const { data, error } = await supabase.from('transactions').select('*').eq('id', id).single();
  if (error) throw new Error(error.message || '데이터를 불러올 수 없습니다.');
  return data;
}

export async function updateTx(id, updates) {
  if (!supabase) throw new Error('데이터베이스에 연결할 수 없습니다.');
  const { error } = await supabase.from('transactions').update(updates).eq('id', id);
  if (error) throw new Error(error.message || '수정에 실패했습니다.');
}

export async function clearTx() {
  if (!supabase) return;
  // Safety: delete in batches with explicit confirmation token
  const { data: rows } = await supabase.from('transactions').select('id').limit(10000);
  if (!rows || rows.length === 0) return;
  const ids = rows.map(r => r.id);
  const { error } = await supabase.from('transactions').delete().in('id', ids);
  if (error) console.error(error);
}
export function won(n) { return Number(n || 0).toLocaleString('ko-KR'); }
export function ym(d) { return (d || new Date()).toISOString().slice(0, 7); }
export function ymd(d) {
  const date = d || new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split('T')[0];
}

export function getPayerLabel(payer) {
  const rel = toRelativePayer(payer);
  if (rel === 'me') return getMeAlias();
  if (rel === 'you') return getYouAlias();
  if (rel === 'together') return '함께';
  return getMeAlias();
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Sanitize HTML from AI responses — allow only safe tags/attributes
export function sanitizeHtml(html) {
  const allowedTags = ['div', 'span', 'p', 'strong', 'em', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'b', 'i'];
  const allowedAttrs = ['class', 'style'];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function clean(node) {
    const children = Array.from(node.childNodes);
    children.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) return;
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase();
        if (!allowedTags.includes(tag)) {
          // Replace disallowed tag with its text content
          const text = document.createTextNode(child.textContent);
          node.replaceChild(text, child);
          return;
        }
        // Remove disallowed attributes
        Array.from(child.attributes).forEach(attr => {
          if (!allowedAttrs.includes(attr.name.toLowerCase())) {
            child.removeAttribute(attr.name);
          }
        });
        // Remove dangerous style values
        if (child.style) {
          const style = child.getAttribute('style') || '';
          if (/expression|javascript|url\s*\(/i.test(style)) {
            child.removeAttribute('style');
          }
        }
        clean(child);
      } else {
        node.removeChild(child);
      }
    });
  }
  clean(doc.body);
  return doc.body.innerHTML;
}

// Shared payer badge HTML generator
export function getPayerBadgeHtml(payer) {
  const payerType = toRelativePayer(payer);
  const payerLabel = getPayerLabel(payer);
  if (payerType === 'me') {
    return `<span class="bg-slate-700 text-slate-200 text-[10px] px-1.5 py-0.5 rounded font-bold ml-2 relative -top-0.5">${escapeHtml(payerLabel)}</span>`;
  } else if (payerType === 'you') {
    return `<span class="bg-indigo-900/50 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded font-bold ml-2 relative -top-0.5">${escapeHtml(payerLabel)}</span>`;
  } else if (payerType === 'together') {
    return `<span class="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded font-bold ml-2 relative -top-0.5 border border-primary/30">${escapeHtml(payerLabel)}</span>`;
  }
  return '';
}

// Shared receipt scan handler
export async function handleReceiptScan(file, payerStr) {
  const key = getKey();
  if (!key) throw new Error('설정에서 Gemini API 키를 먼저 등록해주세요.');
  const r = await parseReceiptWithGemini(file, key);
  await addTx({ ...r, payer: toAbsolutePayer(payerStr), amount: Number(r.amount || 0) });
}

const RED_MODE_KEY = 'red_mode_month';

export function applyRedMode() {
  if (document.getElementById('red-mode-style')) return;
  const style = document.createElement('style');
  style.id = 'red-mode-style';
  style.textContent = `
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background: linear-gradient(160deg, rgba(220,38,38,0.06) 0%, rgba(127,0,0,0.11) 100%);
      pointer-events: none;
      z-index: 9998;
    }
    .text-primary, .dark .dark\\:text-primary { color: #ef4444 !important; }
    .bg-primary, .dark .dark\\:bg-primary { background-color: #ef4444 !important; }
    .border-primary { border-color: #ef4444 !important; }
    .bg-primary\\/10 { background-color: rgba(239,68,68,0.1) !important; }
    .bg-primary\\/20 { background-color: rgba(239,68,68,0.2) !important; }
    .bg-primary\\/30 { background-color: rgba(239,68,68,0.3) !important; }
    .border-primary\\/20 { border-color: rgba(239,68,68,0.2) !important; }
    .border-primary\\/30 { border-color: rgba(239,68,68,0.3) !important; }
    .border-primary\\/50 { border-color: rgba(239,68,68,0.5) !important; }
    .hover\\:text-primary:hover { color: #ef4444 !important; }
    .group:hover .group-hover\\:text-primary { color: #ef4444 !important; }
    .dark .dark\\:hover\\:text-primary:hover { color: #ef4444 !important; }
    .dark .group:hover .dark\\:group-hover\\:text-primary { color: #ef4444 !important; }
    .shadow-primary\\/40 { box-shadow: 0 4px 20px rgba(239,68,68,0.4) !important; }
    .selection\\:bg-primary ::selection { background-color: #ef4444 !important; color: white !important; }
    ::selection { background-color: #ef4444 !important; color: white !important; }
  `;
  document.head.appendChild(style);
}

export function checkAndSetRedMode(total) {
  const budget = getBudget();
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (budget > 0 && total > budget) {
    localStorage.setItem(RED_MODE_KEY, currentMonth);
    applyRedMode();
  } else {
    const stored = localStorage.getItem(RED_MODE_KEY);
    if (stored && stored !== currentMonth) localStorage.removeItem(RED_MODE_KEY);
  }
}

export function checkRedModeCache() {
  const stored = localStorage.getItem(RED_MODE_KEY);
  const currentMonth = new Date().toISOString().slice(0, 7);
  if (stored === currentMonth) applyRedMode();
  else if (stored) localStorage.removeItem(RED_MODE_KEY);
}

export const catIconRecord = {
  '식비': { icon: 'restaurant', bgColor: 'bg-emerald-100 dark:bg-emerald-900/20', textColor: 'text-emerald-600 dark:text-emerald-400' },
  '카페': { icon: 'coffee', bgColor: 'bg-amber-100 dark:bg-amber-900/20', textColor: 'text-amber-600 dark:text-amber-400' },
  '교통': { icon: 'directions_bus', bgColor: 'bg-blue-100 dark:bg-blue-900/20', textColor: 'text-blue-600 dark:text-blue-400' },
  '쇼핑': { icon: 'shopping_bag', bgColor: 'bg-purple-100 dark:bg-purple-900/20', textColor: 'text-purple-600 dark:text-purple-400' },
  '의료': { icon: 'medical_services', bgColor: 'bg-red-100 dark:bg-red-900/20', textColor: 'text-red-600 dark:text-red-400' },
  '주거': { icon: 'home', bgColor: 'bg-indigo-100 dark:bg-indigo-900/20', textColor: 'text-indigo-600 dark:text-indigo-400' },
  '문화생활': { icon: 'movie', bgColor: 'bg-pink-100 dark:bg-pink-900/20', textColor: 'text-pink-600 dark:text-pink-400' },
  '기타': { icon: 'receipt_long', bgColor: 'bg-slate-200 dark:bg-slate-800', textColor: 'text-slate-600 dark:text-slate-400' }
};

export function getCatIconInfo(category) {
  return catIconRecord[category] || catIconRecord['기타'];
}

export async function parseReceiptWithGemini(file, key) {
  const b64 = await fileToBase64(file);
  const model = 'gemini-2.5-flash';
  const prompt = `너는 커플 가계부 영수증 데이터 추출기다. JSON만 출력해.
스키마: 
{
  "tx_date": "YYYY-MM-DD", 
  "merchant": "가맹점명", 
  "amount": 0, 
  "category": "식비|카페|교통|쇼핑|의료|주거|문화생활|기타", 
  "payer": "me|together", 
  "memo": "영수증 분석 후 짧은 요약",
  "items": [{"name": "품목명", "price": 0}]
}
규칙: 
1. amount는 쉼표 없는 정수로 전체 합계 금액.
2. tx_date를 정수(년/월/일)로 추출해. 모르면 오늘 날짜.
3. 식비가 매우 크거나, 2인 이상 결제, 데이트 코스 관련이면 payer를 "together"로, 그 외엔 "me"로 추측.
4. 이모티콘은 절대 쓰지 마.
5. items 배열에 영수증에 적힌 개별 품목명과 가격을 필수로 남겨줘.
`;
  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: file.type || 'image/jpeg', data: b64.split(',')[1] } }
      ]
    }]
  };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'Gemini 호출 실패');
  const text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim();
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const obj = JSON.parse(cleaned);
  obj.category = CATS.includes(obj.category) ? obj.category : '기타';
  if (!['me', 'you', 'together'].includes(obj.payer)) obj.payer = 'me';
  if (!Array.isArray(obj.items)) obj.items = [];
  return obj;
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

export async function generateMonthlyInsight(monthStr, txList) {
  const key = getKey();
  if (!key) throw new Error('API 키가 셋팅되지 않았습니다. 설정 탭에서 저장해주세요.');
  if (!txList || txList.length === 0) throw new Error('분석할 지출 데이터가 없습니다.');

  const txCtx = txList.map(t => `${t.tx_date}|${t.category}|${t.amount}원|${t.merchant}|결제:${getPayerLabel(t.payer)}`).join('\n');
  const [y, m] = monthStr.split('-');
  const monthLabel = `${y}년 ${Number(m)}월`;

  const prompt = `너는 냉철하고 위트있는 커플 가계부 분석 AI야.
다음은 ${monthLabel} 한 달간 발생한 결제 내역들이야.
반드시 아래 JSON 스키마 형식으로만 응답해. JSON 외 다른 텍스트는 절대 포함하지 마.

스키마:
{
  "subtitle": "${monthLabel} 어워즈",
  "awards": [
    {
      "icon": "Material Symbols Outlined 아이콘명 (예: coffee, dark_mode, local_taxi, shopping_cart, restaurant 등)",
      "color": "orange|purple|blue|pink|green|red|amber 중 하나",
      "title": "어워드 타이틀 (예: 카페인 중독 커플상)",
      "desc": "한 줄 설명 (예: 커피값으로 25만원 지출!)",
      "emoji": "어워드에 어울리는 이모지 1개"
    }
  ],
  "comment": "2~3개 문단으로 구성된 HTML 형식 코멘트. 문단 사이는 <br><br>으로 구분. 중요한 금액·수치는 <span class=\"text-primary font-bold\">금액</span> 형식으로 강조. 놓치지 말아야 할 핵심 인사이트(예: 가장 많이 쓴 카테고리, 절약 포인트)도 같은 span으로 강조. 위트있고 팩트폭행 스타일. 격려와 조언을 자연스럽게 섞어. HTML 태그 외 markdown 사용 금지."
}

규칙:
1. awards는 정확히 3개 생성. 내역 분석 기반으로 창의적인 어워드를 만들어.
2. 어워드 예시: 카페인 중독상, 야식 마스터상, 교통비 폭주상, 알뜰살뜰상, 미식 탐험가상 등
3. icon은 Google Material Symbols Outlined에서 실제 존재하는 아이콘명만 사용.
4. color는 3개 어워드가 모두 다른 색이어야 함.
5. comment에서 이전 달 대비 조언, 절약 팁, 격려를 자연스럽게 섞어줘.
6. 금액을 언급할 때 쉼표 포함 형식 사용 (예: 250,000원).
7. JSON만 출력. markdown 코드블록(\`\`\`) 사용 금지.

결제 내역:
${txCtx}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7 }
  };

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || 'Gemini 분석 실패');

  let text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim();
  text = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(text);

  // Validate structure
  if (!parsed.awards || !Array.isArray(parsed.awards)) throw new Error('AI 응답 형식 오류');
  return parsed;
}

