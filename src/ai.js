// AI社員の頭脳。Claude を初期値にし、template.json の ai で差し替える
import Anthropic from '@anthropic-ai/sdk';

let client = null;

export function aiConnected() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

function getClient() {
  client ??= new Anthropic();
  return client;
}

// AIにつながっていないときの下書き。画面の流れを確かめるためだけに使い、本物の案と区別できる印を付ける
function offlineDraft(request, agent) {
  return `【AI未接続のためテスト用の下書き】\n${agent.fields?.name ?? 'AI社員'}として、次の依頼への案をここに書きます。\n\n${request}`;
}

/**
 * @returns {Promise<{text:string, offline:boolean, usage?:object, model?:string, stopReason?:string}>}
 */
export async function draftReply({ template, systemPrompt, agent, request }) {
  if (!aiConnected()) return { text: offlineDraft(request, agent), offline: true };

  const { model, effort, maxTokens } = template.ai;
  try {
    const res = await getClient().beta.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      thinking: { type: 'adaptive' },
      output_config: { effort },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: request }],
    });
    if (res.stop_reason === 'refusal') {
      throw new Error(`AIが断りました（${res.stop_details?.category ?? '理由なし'}）`);
    }
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (!text) throw new Error(`AIの返事が空でした（stop_reason=${res.stop_reason}）`);
    return { text, offline: false, usage: res.usage, model: res.model, stopReason: res.stop_reason };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('AIの鍵が正しくありません（ANTHROPIC_API_KEY）');
    if (e instanceof Anthropic.RateLimitError) throw new Error('AIの利用上限に当たりました。少し待ってからやり直してください');
    if (e instanceof Anthropic.APIError) throw new Error(`AIの呼び出しに失敗しました（${e.status ?? '通信'}：${e.message}）`);
    throw e;
  }
}
