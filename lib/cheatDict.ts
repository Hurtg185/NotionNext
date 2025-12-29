// lib/cheatDict.ts
export type CheatTranslation = {
  translation: string
  back_translation: string
}

export type CheatItem = {
  source: string
  targets: Record<string, CheatTranslation[]>
}

export type CheatDict = {
  lang: string
  items: CheatItem[]
}

// 严格匹配：只 trim，不做标点/空格归一
const normalizeStrict = (s: string) => (s ?? '').trim()

export async function loadCheatDict(sourceLang: string): Promise<CheatDict | null> {
  try {
    if (sourceLang === 'zh-CN') return (await import('@/data/cheat-dict/zh-CN.json')).default as CheatDict
    if (sourceLang === 'my-MM') return (await import('@/data/cheat-dict/my-MM.json')).default as CheatDict
    if (sourceLang === 'vi-VN') return (await import('@/data/cheat-dict/vi-VN.json')).default as CheatDict
    if (sourceLang === 'th-TH') return (await import('@/data/cheat-dict/th-TH.json')).default as CheatDict
    if (sourceLang === 'lo-LA') return (await import('@/data/cheat-dict/lo-LA.json')).default as CheatDict
    if (sourceLang === 'ru-RU') return (await import('@/data/cheat-dict/ru-RU.json')).default as CheatDict
    return null
  } catch {
    return null
  }
}

export function matchCheatStrict(
  dict: CheatDict | null,
  input: string,
  targetLang: string
): CheatTranslation[] | null {
  if (!dict) return null
  const key = normalizeStrict(input)
  if (!key) return null

  const hit = dict.items.find((it) => normalizeStrict(it.source) === key)
  if (!hit) return null

  const arr = hit.targets?.[targetLang]
  if (!Array.isArray(arr) || arr.length === 0) return null

  // 清洗
  const cleaned: CheatTranslation[] = arr
    .map((x) => ({
      translation: String(x?.translation ?? ''),
      back_translation: String(x?.back_translation ?? '')
    }))
    .filter((x) => x.translation || x.back_translation)

  // 确保至少一条，避免 TS 推断 undefined
  const base: CheatTranslation[] =
    cleaned.length > 0 ? cleaned : [{ translation: '（字典数据为空）', back_translation: '' }]

  // 补足到 4 条
  const out: CheatTranslation[] = base.slice(0, 4)
  const fallback: CheatTranslation = out[0] // 必然存在

  while (out.length < 4) out.push(fallback)

  return out
}
