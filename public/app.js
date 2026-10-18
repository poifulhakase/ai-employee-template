import { characterSvg, shade } from './character.js';
import { afterRender, calendarHtml, handleCalendarClick, handleCalendarKey, STATUS } from './calendar.js';

const OUTCOME_LABEL = { same: 'そのまま受け取った', edited: '直して受け取った', unused: '使わなかった', pending: '待ち' };
const $main = document.getElementById('main');
const $modal = document.getElementById('modal');

let S = null; // サーバーの状態（/api/state）
let looks = null;
const ui = { filter: 'all' };

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => Number(n ?? 0).toLocaleString('ja-JP');
const dt = (s) => (s ? new Date(s).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `通信に失敗しました（${res.status}）`);
  return data;
}

function toast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `show${isErr ? ' err' : ''}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = ''), isErr ? 5000 : 2600);
}

async function refresh() {
  S = await api('/api/state');
  render();
}

function colorsOf(agent) {
  return looks.palettes[agent.look?.palette ?? 0] ?? looks.palettes[0];
}

function poseOf(agent) {
  const s = agent.stats;
  if (!s.active) return 'rest';
  if (s.todayTotal > 0 && s.todayDone === s.todayTotal) return 'jump';
  return s.todayDone % 2 ? 'wave' : 'laptop';
}

// ---------- AI社員一覧 ----------

function cardHtml(a) {
  const c = colorsOf(a);
  const s = a.stats;
  const ink = shade(c.shirtDark, 0.28);
  const now = s.active
    ? (s.todayDone === s.todayTotal ? `今日の ${s.todayTotal}件 を実行しました` : esc(s.latest?.request ?? ''))
    : '休憩中';
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  return `
<article class="card">
  <div class="card-top" style="background:${c.tint}">
    <span class="status" style="background:${s.active ? 'var(--green)' : 'var(--rest)'}"><i class="pulse"></i>${s.active ? '作業中' : '休憩中'}</span>
    <span class="level">レベル ${s.level}</span>
    ${characterSvg(c, a.look?.acc, poseOf(a), 108)}
  </div>
  <div class="card-body">
    <div class="who">
      <div class="dept">${esc(a.fields.dept)}</div>
      <div class="name">${esc(a.fields.name)}</div>
      <div class="role">${esc(a.fields.role)}</div>
    </div>
    <div class="bubble">
      <div class="bubble-text"><b style="color:${ink}">いま</b>${now}</div>
      <div class="progress"><div class="meter"><div style="width:${pct(s.todayDone, s.todayTotal)}%;background:${c.shirt}"></div></div><span>今日 <b>${s.todayDone}</b> / ${s.todayTotal}件</span></div>
    </div>
    <div class="exp">
      <div class="exp-head"><span class="exp-label">経験値</span><span class="exp-num">${s.trust}<small>%</small></span></div>
      <div class="meter"><div style="width:${s.trust}%"></div></div>
      <div class="exp-note">累計 ${fmt(s.count)}件</div>
    </div>
  </div>
</article>`;
}

function viewList() {
  const shown = S.agents
    .filter((a) => ui.filter === 'all' || (ui.filter === 'active') === a.stats.active);
  const f = (id, label) => `<button class="${ui.filter === id ? 'on' : ''}" data-filter="${id}">${label}</button>`;
  return `
<header class="head">
  <div>
    <div class="title-row">
      <h1>AI社員一覧</h1>
      <details class="help">
        <summary aria-label="ヘルプ" title="ヘルプ"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5"/><circle cx="12" cy="17.6" r=".6" fill="currentColor"/></svg></summary>
        <div class="help-body">
          <div class="chip"><span class="lv">レベル</span>件数と経験値で決まる</div>
          <div class="chip"><span class="bar"></span>経験値＝直さずに受け取った割合</div>
          <div class="chip"><span class="dot"></span>作業中＝今日の依頼あり</div>
          <div class="chip">${S.aiConnected ? 'AI接続あり' : 'AI未接続：結果はテスト用の文になります（ANTHROPIC_API_KEY を入れて起動すると、AIが実行します）'}</div>
        </div>
      </details>
    </div>
  </div>
</header>
<section class="stats">
  <div class="stat"><div class="stat-label">登録済みAI社員</div><div class="stat-num">${S.summary.total}<small>人</small></div></div>
  <div class="stat"><div class="stat-label">稼働中</div><div class="stat-num" style="color:var(--green)">${S.summary.active}<small>人</small></div></div>
  <div class="stat"><div class="stat-label">今日の対応件数</div><div class="stat-num">${S.summary.today}<small>件</small></div></div>
</section>
<section class="list">
  <div class="toolbar">
    <div class="filters">${f('all', '全員')}${f('active', '作業中')}${f('rest', '休憩中')}</div>
  </div>
  <div class="grid">
    ${shown.map(cardHtml).join('') || `<div class="empty">${S.agents.length ? '該当するAI社員はいません' : 'AI社員はまだいません。管理者が npm run agent -- add で追加します'}</div>`}
  </div>
</section>`;
}

// ---------- カレンダー（public/calendar.js） ----------

const calendarCtx = () => ({ api, S, colorsOf, esc, toast, openOccurrence, reload: render });

async function viewCalendar() {
  return calendarHtml(calendarCtx());
}

// 予定の1回分の結果を開く（受け取る／使わないを決める）
async function openOccurrence(sid, date, items) {
  const s = await api(`/api/schedules/${sid}`);
  const it = items.find((x) => x.scheduleId === sid && x.date === date) ?? { status: 'planned' };
  const a = S.agents.find((x) => x.id === s.agentId);
  const task = it.taskId ? await api(`/api/tasks/${it.taskId}`) : null;
  const st = STATUS[it.status];
  const body = task && !task.outcome
    ? `${task.offline ? '<div class="notice">AIにつながっていないため、テスト用の文です。</div>' : ''}
       <label class="field">AIの結果<span class="hint">このまま受け取るか、直してから受け取ってください</span><textarea id="used" class="tall">${esc(task.draft)}</textarea></label>`
    : task
      ? `<div class="notice result-${task.outcome}">${OUTCOME_LABEL[task.outcome]}${task.similarity != null ? `（一致${Math.round(task.similarity * 100)}%）` : ''}</div>
         ${task.usedText ? `<label class="field">受け取った文<pre class="mono">${esc(task.usedText)}</pre></label>` : ''}`
      : `<div class="notice">${esc(it.error ?? 'まだ結果はありません')}</div>`;
  const foot = task && !task.outcome
    ? `<button class="btn small danger" data-act="discard" data-task="${task.id}" style="margin-right:auto">使わない</button><button class="btn small dark" data-act="use" data-task="${task.id}">受け取る</button>`
    : '<button class="btn small dark" data-act="close">閉じる</button>';
  openModal(`<div class="dlg">
    <div class="dlg-head"><h2>${esc(s.title)}　<span class="outcome ${it.status === 'planned' || it.status === 'error' ? 'pending' : it.status}">${st.mark} ${st.label}</span></h2><button class="close" data-act="close" aria-label="閉じる">×</button></div>
    <div class="dlg-body" id="chat-body">
      <table><tbody>
        <tr><td style="width:7em" class="muted">AI社員</td><td style="font-weight:900">${esc(a?.fields.name ?? '（いません）')}</td></tr>
        <tr><td class="muted">日時</td><td>${date} ${esc(s.time)}</td></tr>
        <tr><td class="muted">依頼</td><td style="white-space:pre-wrap">${esc(s.request)}</td></tr>
      </tbody></table>
      ${body}
    </div>
    <div class="dlg-foot" id="chat-foot">${foot}</div>
  </div>`);
}

// ---------- 稼働ログ ----------

async function viewLogs() {
  const tasks = await api('/api/tasks');
  const name = Object.fromEntries(S.agents.map((a) => [a.id, a.fields.name]));
  const outcomeOf = (t) => t.outcome ?? 'pending';
  return `
<header class="head"><div><h1>稼働ログ</h1><p>依頼の新しい順に300件まで。区分は人が使った文との比較で自動で付きます。</p></div></header>
<section class="panel" style="overflow:auto">
  <table>
    <thead><tr><th>日時</th><th>AI社員</th><th>依頼</th><th>区分</th><th class="num">一致率</th><th>固定層</th></tr></thead>
    <tbody>${tasks.map((t) => `<tr>
      <td style="white-space:nowrap">${dt(t.createdAt)}</td>
      <td style="white-space:nowrap">${esc(name[t.agentId] ?? '（削除済み）')}</td>
      <td>${esc(String(t.request).slice(0, 80))}${t.offline ? ' <span class="muted">（AI未接続）</span>' : ''}</td>
      <td><span class="outcome ${outcomeOf(t)}">${OUTCOME_LABEL[outcomeOf(t)]}</span>${t.numbersChanged ? ' <span class="ng" title="数字が変わった">数</span>' : ''}</td>
      <td class="num">${t.similarity != null ? Math.round(t.similarity * 100) + '%' : ''}</td>
      <td>${t.templateVersion ? 'v' + esc(t.templateVersion) : ''}</td></tr>`).join('')}</tbody>
  </table>
  ${tasks.length ? '' : '<div class="empty">まだ依頼がありません</div>'}
</section>`;
}

// ---------- ダイアログ ----------

function openModal(html) {
  $modal.innerHTML = html;
  if (!$modal.open) $modal.showModal();
}
const closeModal = () => $modal.close();

function showResult(task) {
  const msg = {
    same: 'そのまま受け取りました。',
    edited: `直して受け取りました（一致${Math.round((task.similarity ?? 0) * 100)}%${task.numbersChanged ? '・数字が変わった' : ''}）。`,
    unused: '使いませんでした。',
  }[task.outcome];
  document.getElementById('chat-body').innerHTML = `<div class="notice result-${task.outcome}">${msg}</div>`;
  document.getElementById('chat-foot').innerHTML = `<button class="btn small dark" data-act="close">閉じる</button>`;
}

// ---------- 画面の切り替え ----------

async function render() {
  const view = (location.hash.slice(1) || 'list').split('?')[0];
  document.querySelectorAll('.menu a').forEach((a) => a.classList.toggle('on', a.dataset.view === view));
  const views = { list: viewList, calendar: viewCalendar, logs: viewLogs };
  $main.innerHTML = await (views[view] ?? viewList)();
  if (view === 'calendar') afterRender();
}

async function busy(btn, fn) {
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  try { await fn(); } catch (e) { toast(e.message, true); } finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = label; } }
}

document.addEventListener('click', async (e) => {
  if (await handleCalendarClick(e)) return;
  const el = e.target.closest('[data-act],[data-filter]');
  if (!el) return;
  if (el.dataset.filter) { ui.filter = el.dataset.filter; return render(); }
  const { act, id, task } = el.dataset;
  if (act === 'close') return closeModal();
  if (act === 'use') return busy(el, async () => { const t = await api(`/api/tasks/${task}/use`, { method: 'POST', body: { usedText: document.getElementById('used').value } }); showResult(t); refresh(); });
  if (act === 'discard') return busy(el, async () => { const t = await api(`/api/tasks/${task}/discard`, { method: 'POST' }); showResult(t); refresh(); });
});

window.addEventListener('hashchange', render);
document.addEventListener('keydown', (e) => handleCalendarKey(e));

(async () => {
  try {
    looks = await api('/api/looks');
    await refresh();
  } catch (e) {
    $main.innerHTML = `<div class="panel"><h2>読み込めませんでした</h2><p>${esc(e.message)}</p></div>`;
  }
})();
