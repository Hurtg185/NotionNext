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
 * 归一化：忽略常见标点/符号/空白（不使用 /u 和 \p{}，兼容低 target）
 * - 移除空白
 * - 移除中英文常见标点、全角半角符号
 * - 英文字母转小写（俄语/泰语/越南语不受影响）
 */
const normalizeLoose = (s: string) => {
  const t = (s ?? '').trim().toLowerCase()

  // 注意：这里是“实用型”符号表，足够覆盖聊天输入常见标点。
  // 如果你后面发现某些符号没去掉，再把它加进来即可。
  const PUNCT_RE =
    /[\s\r\n\t]+|[~`!@#$%^&*()_\-+=$${}\\|;:'",.<>/?，。！？、；：“”‘’（）【】《》〈〉…·—–―「」『』﹏￥]+/g

  return t.replace(PUNCT_RE, '')
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

  const cleaned: CheatTranslation[] = arr
    .map((x) => ({
      translation: String(x?.translation ?? ''),
      back_translation: String(x?.back_translation ?? '')
    }))
    .filter((x) => x.translation || x.back_translation)

  const FALLBACK: CheatTranslation = { translation: '（字典数据为空）', back_translation: '' }
  const base: CheatTranslation[] = cleaned.length ? cleaned : [FALLBACK]

  const out: CheatTranslation[] = base.slice(0, 4)
  while (out.length < 4) out.push(out[out.length - 1] || FALLBACK)

  return out
}
