import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addAgents } from '../src/core/agents.js';

const TEMPLATE = { fields: [{ key: 'name', label: '名前', required: true }, { key: 'dept', label: '部門', required: true }] };

test('個別層の必須項目がそろったAI社員だけを追加する', () => {
  const r = addAgents(TEMPLATE, [], [{ fields: { name: '議事録係', dept: '全社' } }, { fields: { name: '週報まとめ' } }]);
  assert.equal(r.added.length, 1);
  assert.equal(r.agents.length, 1);
  assert.deepEqual(r.skipped, ['週報まとめ（未入力：部門）']);
  assert.ok(r.added[0].id && r.added[0].look);
});

test('同じ名前のAI社員は追加しない（同じパックを2回入れても増えない）', () => {
  const first = addAgents(TEMPLATE, [], [{ fields: { name: '議事録係', dept: '全社' } }]);
  const again = addAgents(TEMPLATE, first.agents, [{ fields: { name: '議事録係', dept: '全社' } }]);
  assert.equal(again.added.length, 0);
  assert.equal(again.agents.length, 1);
  assert.deepEqual(again.skipped, ['議事録係（同じ名前がいる）']);
});
