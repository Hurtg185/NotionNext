// lib/cheatDict.ts
export type CheatTranslation = { translation: string; back_translation: string };
export type CheatItem = {
  source: string; // 严格匹配文本（建议你数据里就写“最终输入会是什么”）
  targets: Record<string, CheatTranslation[]>; // key: targetLang
};
export type CheatDict = { lang: string; items: CheatItem[] };

const normalizeStrict = (s: string) => (s ?? '').trim(); // 严格：只 trim，不改标点不去空格（你要求严格匹配）

export async function loadCheatDict(sourceLang: string): Promise<CheatDict | null> {
  try {
    if (sourceLang === 'zh-CN') return (await import('@/data/cheat-dict/zh-CN.json')).default as CheatDict;
    if (sourceLang === 'my-MM') return (await import('@/data/cheat-dict/my-MM.json')).default as CheatDict;
    if (sourceLang === 'vi-VN') return (await import('@/data/cheat-dict/vi-VN.json')).default as CheatDict;
    if (sourceLang === 'th-TH') return (await import('@/data/cheat-dict/th-TH.json')).default as CheatDict;
    if (sourceLang === 'lo-LA') return (await import('@/data/cheat-dict/lo-LA.json')).default as CheatDict;
    if (sourceLang === 'ru-RU') return (await import('@/data/cheat-dict/ru-RU.json')).default as CheatDict;
    return null;
  } catch {
    return null;
  }
}

export function matchCheatStrict(
  dict: CheatDict | null,
  input: string,
  targetLang: string
): CheatTranslation[] | null {
  if (!dict) return null;
  const key = normalizeStrict(input);
  if (!key) return null;

  const hit = dict.items.find((it) => normalizeStrict(it.source) === key);
  if (!hit) return null;

  const arr = hit.targets?.[targetLang];
  if (!arr || arr.length === 0) return null;

  // 强制变成 4 条
  const out = arr.slice(0, 4).map((x) => ({
    translation: String(x?.translation ?? ''),
    back_translation: String(x?.back_translation ?? '')
  }));
  while (out.length < 4) out.push(out[out.length - 1]);
  return out;
}
