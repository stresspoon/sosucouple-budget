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

export async function getTx() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('transactions')
    .select('*')
    .order('tx_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(10000);
  if (error) { console.error(error); return []; }
  return data || [];
}

export async function addTx(t) {
  if (!supabase) throw new Error('데이터베이스에 연결할 수 없습니다.');
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
  const { error } = await supabase.from('transactions').delete().neq('payer', 'invalid_payer');
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
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/\${model}:generateContent?key=\${encodeURIComponent(key)}`, {
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

  const txCtx = txList.map(t => `${t.tx_date}|${t.category}|${t.amount}원|${t.merchant}|결제:${getPayerLabel(t.payer)}`).join('\\n');
  const prompt = `너는 냉철하고 위트있는 커플 가계부 분석 AI야. 
다음은 ${monthStr} 한 달간 발생한 결제 내역들이야. 
절대 이모티콘을 사용하지 말고, 다음 4가지 항목을 각각 HTML <div class="mb-4"> 태그로 감싸서 응답해줘. 
각 항목의 제목은 <strong class="text-primary block mb-1 font-bold"> 태그로 감싸고 내용은 그 뒤에 한 줄로 간결하게 팩트폭행을 담아 작성할 것. 전체를 <div class="text-sm space-y-2"> 로 감쌀 것.

1. 이번 달 데이트 테마 명명 (예: 카페 투어가 잦았던 휴식의 달)
2. 결제 요정 타이틀 부여 (예: 상대방은 디저트 탐험가, 나는 든든한 밥스폰서)
3. 예산 대비 방심했던 지출 팩트폭행 조언 (예: 잦은 편의점 방문으로 누수 발생. 야식을 줄이세요.)
4. 돈을 가장 알차게 쓴 날(Top 1) 동선 회고 (예: 15일 식당-카페 동선은 완벽했습니다.)

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

  let text = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\\n').trim();
  return text.replace(/```html/g, '').replace(/```/g, '').trim();
}

