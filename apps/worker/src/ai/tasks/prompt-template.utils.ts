export type LoadedPromptTemplate = {
  key: string;
  version: number;
  systemPrompt: string;
  userPrompt: string | null;
};

export function mergeSystemPrompt(
  basePrompt: string,
  template?: LoadedPromptTemplate | null
) {
  const extraPrompt = template?.systemPrompt?.trim();

  if (!extraPrompt) {
    return basePrompt;
  }

  return `${basePrompt}\n\nEk tenant/operasyon talimati:\n${extraPrompt}`;
}

export function mergeJsonUserPrompt(
  payload: Record<string, unknown>,
  template?: LoadedPromptTemplate | null
) {
  const basePayload = JSON.stringify(payload);
  const extraPrompt = template?.userPrompt?.trim();

  if (!extraPrompt) {
    return basePayload;
  }

  return `${basePayload}\n\nEk tenant/operasyon talimati:\n${extraPrompt}`;
}
