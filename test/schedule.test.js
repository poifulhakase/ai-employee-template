import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueOccurrence, occurrencesBetween, validateSchedule } from '../src/core/schedule.js';

const base = { date: '2026-10-01', time: '09:00', repeat: 'none' };

test('繰り返しごとの回の日付', () => {
  assert.deepEqual(occurrencesBetween(base, '2026-10-01', '2026-10-31'), ['2026-10-01']);
  assert.equal(occurrencesBetween({ ...base, repeat: 'daily' }, '2026-09-28', '2026-10-05').length, 5); // 開始日より前は入れない
  assert.deepEqual(occurrencesBetween({ ...base, repeat: 'weekdays' }, '2026-10-02', '2026-10-06'), ['2026-10-02', '2026-10-05', '2026-10-06']); // 10/3・10/4は土日
  assert.deepEqual(occurrencesBetween({ ...base, repeat: 'weekly' }, '2026-10-01', '2026-10-31'), ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']);
  assert.deepEqual(occurrencesBetween({ ...base, repeat: 'daily', until: '2026-10-03' }, '2026-10-01', '2026-10-10'), ['2026-10-01', '2026-10-02', '2026-10-03']);
});

test('毎月31日の予定は、31日が無い月は月末に寄せる', () => {
  const s = { ...base, date: '2026-10-31', repeat: 'monthly' };
  assert.deepEqual(occurrencesBetween(s, '2026-10-01', '2027-03-31'), ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31']);
});

test('時刻を過ぎた回のうち、一番新しい1回だけを作る', () => {
  const s = { ...base, repeat: 'daily', createdAt: '2026-09-30T00:00:00' };
  // 10/5 10:00 時点：10/1〜10/5 が過ぎているが、作るのは 10/5 だけ
  assert.equal(dueOccurrence(s, new Date(2026, 9, 5, 10, 0)), '2026-10-05');
  // 10/5 8:00 時点：10/5 はまだ。10/4 を作る
  assert.equal(dueOccurrence(s, new Date(2026, 9, 5, 8, 0)), '2026-10-04');
  // 作った回は二度作らない。それより古い回にもさかのぼらない
  assert.equal(dueOccurrence({ ...s, runs: [{ date: '2026-10-05' }] }, new Date(2026, 9, 5, 10, 0)), null);
});

test('登録した時刻より前の回は作らない', () => {
  // 10/1 10:00 に「毎日9時」を登録 → 10/1 9時の回は作らない（開始日そのものの回は除く）
  const s = { ...base, date: '2026-09-25', repeat: 'daily', createdAt: '2026-10-01T10:00:00' };
  assert.equal(dueOccurrence(s, new Date(2026, 9, 1, 10, 5)), null);
  assert.equal(dueOccurrence(s, new Date(2026, 9, 2, 9, 1)), '2026-10-02');
  // 開始日を今日・時刻を過去にして登録したら、その回は作る（今すぐ頼みたいとき）
  const today = { ...base, date: '2026-10-01', createdAt: '2026-10-01T10:00:00' };
  assert.equal(dueOccurrence(today, new Date(2026, 9, 1, 10, 5)), '2026-10-01');
});

test('入力の検査', () => {
  assert.deepEqual(validateSchedule({ ...base, agentId: 'a', title: '週報', request: '週報を作る' }), []);
  assert.deepEqual(validateSchedule({ date: '10/1', time: '9', repeat: 'x' }), ['AI社員', '予定の名前', '依頼', '日付', '時刻', '繰り返し']);
});
