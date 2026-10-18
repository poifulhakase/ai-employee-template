// AI社員の追加（複製）。画面からは行わず、管理者がコマンド（npm run agent -- add）で行う
import { randomUUID } from 'node:crypto';
import { defaultLook } from './looks.js';
import { missingFields } from './prompt.js';

export function newAgent(fields, look, existing) {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    fields,
    look: look ?? defaultLook(existing.length),
  };
}

/**
 * テンプレートの個別層に照らして、AI社員を追加する。同じ名前・必須項目の抜けは追加しない
 * @param {object} template
 * @param {object[]} existing 今いるAI社員
 * @param {{fields:object, look?:object}[]} incoming 追加したいAI社員
 */
export function addAgents(template, existing, incoming) {
  const agents = [...existing];
  const added = [];
  const skipped = [];
  for (const a of incoming) {
    const name = String(a.fields?.name ?? '').trim();
    if (name && agents.some((x) => x.fields?.name === name)) { skipped.push(`${name}（同じ名前がいる）`); continue; }
    const missing = missingFields(template, a.fields);
    if (missing.length) { skipped.push(`${name || '名前なし'}（未入力：${missing.join('・')}）`); continue; }
    const agent = newAgent(a.fields, a.look, agents);
    agents.push(agent);
    added.push(agent);
  }
  return { agents, added, skipped };
}
