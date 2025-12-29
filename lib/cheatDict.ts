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

/**
 * 归一化：忽略标点/符号/空白
 * - 去掉所有 Unicode 标点(P) + 符号(S) + 空白
 * - 中文/缅文/越文/泰文/老挝文/俄文等字母文字保留
 */
const normalizeLoose = (s: string) => {
  const t = (s ?? '').trim()
  // 需要 ES2018+ 支持 unicode property escapes（Next.js 默认 ok）
  // \p{P} 标点, \p{S} 符号, \s 空白
  return t.replace(/[\p{P}\p{S}\s]+/gu, '').toLowerCase()
}

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

export function matchCheatLoose(
  dict: CheatDict | null,
  input: string,
  targetLang: string
): CheatTranslation[] | null {
  if (!dict) return null

  const key = normalizeLoose(input)
  if (!key) return null

  const hit = dict.items.find((it) => normalizeLoose(it.source) === key)
  if (!hit) return null

  const arr = hit.targets?.[targetLang]
  if (!Array.isArray(arr) || arr.length === 0) return null

  // 清洗成有效数组
  const cleaned: CheatTranslation[] = arr
    .map((x) => ({
      translation: String(x?.translation ?? ''),
      back_translation: String(x?.back_translation ?? '')
    }))
    .filter((x) => x.translation || x.back_translation)

  // fallback 用“明确常量”，避免 out[0] 的 undefined 类型问题
  const FALLBACK: CheatTranslation = { translation: '（字典数据为空）', back_translation: '' }

  const base: CheatTranslation[] = cleaned.length > 0 ? cleaned : [FALLBACK]

  const out: CheatTranslation[] = base.slice(0, 4)
  while (out.length < 4) out.push(out[out.length - 1] ?? FALLBACK)

  return out
}
