export type AiGatewayModel = string;

function isNonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function getAiGatewayConfig():
  | {
      enabled: true;
      apiKey: string;
      baseUrl: string;
      model: AiGatewayModel;
    }
  | { enabled: false } {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!isNonEmpty(apiKey)) return { enabled: false };

  const baseUrl = isNonEmpty(process.env.AI_GATEWAY_BASE_URL)
    ? String(process.env.AI_GATEWAY_BASE_URL).trim()
    : 'https://ai-gateway.vercel.sh/v1';

  const model = isNonEmpty(process.env.AI_GATEWAY_MODEL)
    ? String(process.env.AI_GATEWAY_MODEL).trim()
    : 'openai/gpt-5';

  return { enabled: true, apiKey: apiKey.trim(), baseUrl, model };
}

type ChatMessage = { role: 'system' | 'user'; content: string };

export async function aiGatewayGenerateText(params: {
  system?: string;
  prompt: string;
  model?: AiGatewayModel;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string> {
  const cfg = getAiGatewayConfig();
  if (!cfg.enabled) {
    throw new Error('AI Gateway is not configured');
  }

  const messages: ChatMessage[] = [];
  if (isNonEmpty(params.system)) messages.push({ role: 'system', content: params.system.trim() });
  messages.push({ role: 'user', content: params.prompt });

  const controller = new AbortController();
  const timeoutMs = typeof params.timeoutMs === 'number' ? params.timeoutMs : 25_000;
  const timeout = setTimeout(() => controller.abort(), Math.max(1_000, timeoutMs));

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model || cfg.model,
        messages,
        stream: false,
        temperature: typeof params.temperature === 'number' ? params.temperature : 0.3,
        max_tokens: typeof params.maxTokens === 'number' ? params.maxTokens : 1200,
      }),
      signal: controller.signal,
    });

    const text = await res.text().catch(() => '');
    if (!res.ok) {
      // Keep error message compact (don’t leak full upstream payload).
      const suffix = text ? `: ${text.slice(0, 300)}` : '';
      const err = new Error(`AI Gateway request failed (${res.status})${suffix}`);
      (err as any).status = 502;
      throw err;
    }

    let json: any;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      const err = new Error('AI Gateway returned non-JSON response');
      (err as any).status = 502;
      throw err;
    }

    const content =
      json?.choices?.[0]?.message?.content ??
      json?.choices?.[0]?.delta?.content ??
      json?.text ??
      '';

    if (!isNonEmpty(content)) {
      const err = new Error('Empty response from AI');
      (err as any).status = 502;
      throw err;
    }

    return String(content);
  } finally {
    clearTimeout(timeout);
  }
}
