// テンプレートを外へ持ち運ぶための1ファイル（テンプレートパック）。会社のデータ（依頼の中身）は入れない

export const PACK_FORMAT = 'ai-employee-template-pack';
export const PACK_VERSION = 1;

/**
 * @param {object} template 固定層を含むテンプレート
 * @param {object[]} agents 個別層も持ち出すときだけ渡す（名前・担当などの設定。依頼の記録は入れない）
 */
export function buildPack(template, agents = []) {
  return {
    format: PACK_FORMAT,
    packVersion: PACK_VERSION,
    exportedAt: new Date().toISOString(),
    template,
    agents: agents.map(({ id, fields, look }) => ({ id, fields, look })),
  };
}

export function parsePack(json) {
  const pack = typeof json === 'string' ? JSON.parse(json) : json;
  const errors = [];
  if (pack?.format !== PACK_FORMAT) errors.push(`形式が違います（format=${pack?.format ?? 'なし'}）`);
  if (pack?.packVersion > PACK_VERSION) errors.push(`新しい版のパックです（${pack.packVersion}）。アプリを更新してください`);
  const t = pack?.template;
  if (!t?.version) errors.push('テンプレートの版がありません');
  if (!String(t?.fixed ?? '').trim()) errors.push('固定層が空です');
  if (!Array.isArray(t?.fields) || !t.fields.length) errors.push('個別層の項目がありません');
  if (!Array.isArray(t?.levels)) errors.push('レベルの条件がありません');
  if (!t?.classify) errors.push('区分のしきい値がありません');
  if (errors.length) throw Object.assign(new Error(errors.join('／')), { errors });
  return { template: t, agents: Array.isArray(pack.agents) ? pack.agents : [] };
}

/** 版の番号を1つ上げる（1.0 → 1.1） */
export function bumpVersion(version) {
  const [major, minor = '0'] = String(version).split('.');
  return `${major}.${Number(minor) + 1}`;
}
