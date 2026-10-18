// AI社員ポータルのローカルサーバー（npm start → http://localhost:4100）
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize as normPath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aiConnected, draftReply } from './src/ai.js';
import { classify, OUTCOME } from './src/core/classify.js';
import { buildSystemPrompt } from './src/core/prompt.js';
import { agentStats } from './src/core/stats.js';
import { ACCESSORIES, PALETTES } from './src/core/looks.js';
import { dueOccurrence, occurrencesBetween, REPEAT, validateSchedule } from './src/core/schedule.js';
import {
  loadAgents, loadChangelog, loadSchedules, loadTasks, loadTemplate, saveSchedules, saveTasks,
} from './src/store.js';

// .env があれば読む（ANTHROPIC_API_KEY・PORT）。無ければ環境変数のまま
try { process.loadEnvFile(); } catch { /* .env なし */ }

const PORT = Number(process.env.PORT ?? 4100);
const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));


const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function send(res, status, body, headers = {}) {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(json);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'JSONとして読めません'); }
}

function agentView(agent, template, tasksByAgent) {
  const stats = agentStats(tasksByAgent.get(agent.id) ?? [], template);
  return {
    ...agent,
    stats: { ...stats, latest: stats.latest ? { request: stats.latest.request, createdAt: stats.latest.createdAt } : null },
    templateLabel: `${template.name} v${template.version}`,
  };
}

function groupTasks(tasks) {
  const m = new Map();
  for (const t of tasks) {
    if (!m.has(t.agentId)) m.set(t.agentId, []);
    m.get(t.agentId).push(t);
  }
  return m;
}

function state() {
  const template = loadTemplate();
  const tasks = loadTasks();
  const byAgent = groupTasks(tasks);
  const agents = loadAgents().map((a) => agentView(a, template, byAgent));
  return {
    aiConnected: aiConnected(),
    template,
    changelog: loadChangelog(),
    agents,
    summary: {
      total: agents.length,
      active: agents.filter((a) => a.stats.active).length,
      today: agents.reduce((s, a) => s + a.stats.todayTotal, 0),
    },
  };
}

function findAgent(id) {
  const agents = loadAgents();
  const agent = agents.find((a) => a.id === id);
  if (!agent) throw new HttpError(404, 'そのAI社員はいません');
  return { agents, agent };
}

function findTask(id) {
  const tasks = loadTasks();
  const task = tasks.find((t) => t.id === id);
  if (!task) throw new HttpError(404, 'その依頼はありません');
  return { tasks, task };
}

async function createTask(agent, request, extra = {}) {
  const template = loadTemplate();
  const systemPrompt = buildSystemPrompt(template, agent);
  const reply = await draftReply({ template, systemPrompt, agent, request });
  const task = {
    id: randomUUID(),
    agentId: agent.id,
    createdAt: new Date().toISOString(),
    templateVersion: template.version,
    request,
    draft: reply.text,
    offline: reply.offline,
    model: reply.model ?? null,
    usage: reply.usage ?? null,
    usedText: null,
    usedAt: null,
    outcome: null,
    ...extra,
  };
  saveTasks([...loadTasks(), task]);
  return task;
}

function findSchedule(id) {
  const schedules = loadSchedules();
  const schedule = schedules.find((s) => s.id === id);
  if (!schedule) throw new HttpError(404, 'その予定はありません');
  return { schedules, schedule };
}

function scheduleFrom(body) {
  const s = {
    agentId: body.agentId,
    title: String(body.title ?? '').trim(),
    request: String(body.request ?? '').trim(),
    date: body.date,
    time: body.time,
    repeat: body.repeat ?? 'none',
    until: body.until || null,
  };
  const errors = validateSchedule(s);
  if (errors.length) throw new HttpError(400, `入力を確かめてください：${errors.join('・')}`);
  return s;
}

// 予定の1回分をAIに頼み、結果（または失敗）を予定に記録する
async function runOccurrence(schedule, date) {
  const agent = loadAgents().find((a) => a.id === schedule.agentId);
  let record;
  try {
    if (!agent) throw new Error('AI社員がいません');
    const task = await createTask(agent, schedule.request, { scheduleId: schedule.id, scheduleDate: date });
    record = { date, taskId: task.id, at: new Date().toISOString() };
  } catch (e) {
    record = { date, taskId: null, at: new Date().toISOString(), error: e.message };
  }
  const { schedules, schedule: s } = findSchedule(schedule.id);
  s.runs = [...(s.runs ?? []).filter((r) => r.date !== date), record];
  saveSchedules(schedules);
  if (record.error) throw new HttpError(502, record.error);
  return findTask(record.taskId).task;
}

// 1分ごとに、時刻を過ぎた予定を探して案を作る。止まっていた間の回は、一番新しい1回だけ
let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    for (const s of loadSchedules()) {
      const date = dueOccurrence(s);
      if (!date) continue;
      try {
        await runOccurrence(s, date);
        console.log(`予定「${s.title}」(${date}) の案を作りました`);
      } catch (e) {
        console.error(`予定「${s.title}」(${date}) に失敗：${e.message}`);
      }
    }
  } finally {
    ticking = false;
  }
}

const routes = [
  ['GET', /^\/api\/state$/, () => state()],

  ['GET', /^\/api\/looks$/, () => ({ palettes: PALETTES, accessories: ACCESSORIES })],

  ['GET', /^\/api\/tasks$/, (req, _, url) => {
    const agentId = url.searchParams.get('agentId');
    const tasks = loadTasks().filter((t) => !agentId || t.agentId === agentId);
    return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300);
  }],

  ['GET', /^\/api\/tasks\/([\w-]+)$/, (req, [id]) => findTask(id).task],

  // ---- カレンダー ----
  ['GET', /^\/api\/schedules$/, (req, _, url) => {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!from || !to) throw new HttpError(400, 'from と to（YYYY-MM-DD）を付けてください');
    const tasks = new Map(loadTasks().map((t) => [t.id, t]));
    const items = [];
    for (const s of loadSchedules()) {
      const runs = new Map((s.runs ?? []).map((r) => [r.date, r]));
      for (const date of occurrencesBetween(s, from, to)) {
        const run = runs.get(date);
        const task = tasks.get(run?.taskId);
        items.push({
          scheduleId: s.id, agentId: s.agentId, title: s.title, date, time: s.time, repeat: s.repeat,
          taskId: task?.id ?? null,
          status: run?.error ? 'error' : task ? (task.outcome ?? 'pending') : 'planned',
          error: run?.error ?? null,
        });
      }
    }
    return { items: items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)), repeat: REPEAT };
  }],

  ['GET', /^\/api\/schedules\/([\w-]+)$/, (req, [id]) => findSchedule(id).schedule],

  ['POST', /^\/api\/schedules$/, async (req) => {
    const s = scheduleFrom(await readBody(req));
    findAgent(s.agentId);
    const schedule = { id: randomUUID(), createdAt: new Date().toISOString(), runs: [], ...s };
    saveSchedules([...loadSchedules(), schedule]);
    tick();
    return schedule;
  }],

  ['PUT', /^\/api\/schedules\/([\w-]+)$/, async (req, [id]) => {
    const s = scheduleFrom(await readBody(req));
    findAgent(s.agentId);
    const { schedules, schedule } = findSchedule(id);
    Object.assign(schedule, s, { updatedAt: new Date().toISOString() });
    saveSchedules(schedules);
    return schedule;
  }],

  ['DELETE', /^\/api\/schedules\/([\w-]+)$/, (req, [id]) => {
    const { schedules } = findSchedule(id);
    saveSchedules(schedules.filter((s) => s.id !== id));
    return { ok: true };
  }],

  // その回を今すぐ頼む（時刻を待たない）
  ['POST', /^\/api\/schedules\/([\w-]+)\/run$/, async (req, [id]) => {
    const { date } = await readBody(req);
    const { schedule } = findSchedule(id);
    if (!date || !occurrencesBetween(schedule, date, date).length) throw new HttpError(400, 'その日はこの予定の回ではありません');
    if ((schedule.runs ?? []).some((r) => r.date === date && r.taskId)) throw new HttpError(409, 'この回の案はもうあります');
    return runOccurrence(schedule, date);
  }],

  // 人が実際に使った文を記録し、区分を自動で付ける
  ['POST', /^\/api\/tasks\/([\w-]+)\/use$/, async (req, [id]) => {
    const { usedText } = await readBody(req);
    if (!String(usedText ?? '').trim()) throw new HttpError(400, '使った文が空です');
    const { tasks, task } = findTask(id);
    if (task.outcome) throw new HttpError(409, 'この依頼はもう区分が付いています');
    const r = classify(task.draft, usedText, loadTemplate().classify);
    Object.assign(task, { usedText, usedAt: new Date().toISOString(), outcome: r.outcome, similarity: r.similarity, numbersChanged: r.numbersChanged });
    saveTasks(tasks);
    return task;
  }],

  ['POST', /^\/api\/tasks\/([\w-]+)\/discard$/, (req, [id]) => {
    const { tasks, task } = findTask(id);
    if (task.outcome) throw new HttpError(409, 'この依頼はもう区分が付いています');
    Object.assign(task, { outcome: OUTCOME.UNUSED, usedAt: new Date().toISOString() });
    saveTasks(tasks);
    return task;
  }],

];

async function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = normPath(join(PUBLIC, rel));
  if (!file.startsWith(normPath(PUBLIC))) return send(res, 403, { error: '見られない場所です' });
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    send(res, 404, { error: 'ありません' });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (!url.pathname.startsWith('/api/')) return await serveStatic(res, url.pathname);
    for (const [method, pattern, handler] of routes) {
      const m = req.method === method && pattern.exec(url.pathname);
      if (!m) continue;
      const out = await handler(req, m.slice(1), url);
      if (out?.__download) {
        return send(res, 200, out.body, { 'content-disposition': `attachment; filename="${encodeURIComponent(out.name)}"` });
      }
      return send(res, 200, out);
    }
    throw new HttpError(404, 'そのAPIはありません');
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    send(res, e.status ?? 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  tick();
  setInterval(tick, 60_000);
  console.log(`AI社員ポータル http://localhost:${PORT}`);
  console.log(aiConnected() ? `AI：接続あり（${loadTemplate().ai.model}）` : 'AI：未接続（ANTHROPIC_API_KEY が無いので、テスト用の下書きを返します）');
});
