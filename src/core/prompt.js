// AI社員1人分の指示文＝固定層（全員共通）＋個別層（その人の担当）。固定層は毎回テンプレートから読むので、直せば全員に反映される

export function buildSystemPrompt(template, agent) {
  const lines = template.fields
    .map((f) => {
      const v = String(agent.fields?.[f.key] ?? '').trim();
      return v ? `### ${f.label}\n${v}` : null;
    })
    .filter(Boolean);
  return `${template.fixed.trim()}\n\n# あなたの担当（${agent.fields?.name ?? ''}）\n\n${lines.join('\n\n')}\n`;
}

/** 必須項目の抜けを返す（複製・編集のときの検査） */
export function missingFields(template, fields) {
  return template.fields.filter((f) => f.required && !String(fields?.[f.key] ?? '').trim()).map((f) => f.label);
}
