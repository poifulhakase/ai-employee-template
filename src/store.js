// データの置き場所。テンプレート（template/）は持ち運ぶもの、AI社員と依頼（data/）は会社ごとのもの
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATE_DIR = process.env.TEMPLATE_DIR ?? join(ROOT, 'template');
export const DATA_DIR = process.env.DATA_DIR ?? join(ROOT, 'data');

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

// 途中で落ちても壊れないよう、別名に書いてから置き換える
function writeAtomic(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, path);
}

const writeJson = (path, value) => writeAtomic(path, JSON.stringify(value, null, 2) + '\n');

export function loadTemplate() {
  const template = readJson(join(TEMPLATE_DIR, 'template.json'), null);
  if (!template) throw new Error(`テンプレートがありません：${TEMPLATE_DIR}`);
  template.fixed = readFileSync(join(TEMPLATE_DIR, 'fixed.md'), 'utf8');
  return template;
}

export function saveTemplate({ fixed, ...template }) {
  writeJson(join(TEMPLATE_DIR, 'template.json'), template);
  writeAtomic(join(TEMPLATE_DIR, 'fixed.md'), fixed);
}

export const loadAgents = () => readJson(join(DATA_DIR, 'agents.json'), []);
export const saveAgents = (agents) => writeJson(join(DATA_DIR, 'agents.json'), agents);
export const loadTasks = () => readJson(join(DATA_DIR, 'tasks.json'), []);
export const saveTasks = (tasks) => writeJson(join(DATA_DIR, 'tasks.json'), tasks);
export const loadSchedules = () => readJson(join(DATA_DIR, 'schedules.json'), []);
export const saveSchedules = (schedules) => writeJson(join(DATA_DIR, 'schedules.json'), schedules);
export const loadChangelog = () => readJson(join(DATA_DIR, 'template_changelog.json'), []);
export const saveChangelog = (log) => writeJson(join(DATA_DIR, 'template_changelog.json'), log);
