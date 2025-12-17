import React from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// 动态导入
const PinyinChartClient = dynamic(
  () => import('@/components/PinyinChartClient'),
  { 
    ssr: false,
    loading: () => <div className="pt-20 text-center text-white">正在加载拼音模块...</div>
  }
);

// ==========================================
// 配置区域 - 请核对这里！
// ==========================================

// 1. 基础路径 (不带末尾斜杠)
const BASE_DOMAIN = 'https://audio.886.best/chinese-vocab-audio';

// 2. 文件夹名称配置 (为了防止手滑写错，统一在这里改)
// 重要：请去你的 R2 确认文件夹名字完全一致（包括繁简、空格）
const ROOT_FOLDER = '拼音音频'; 
const INITIALS_FOLDER = '声母';
const FINALS_FOLDER = '韵母';
const WHOLE_FOLDER = '整体读音';
const TONES_FOLDER = '声调表'; // ⚠️ 你描述说是 "音调表"，如果是，请这里改成 '音调表'，如果是 '声调表' 则保持原样。

// 3. 构建 URL 的辅助函数 (自动处理中文编码)
const getAudioUrl = (folder, subFolder, filename) => {
    // 拼接路径：比如 拼音音频/声母/b.mp3
    // 使用 encodeURIComponent 确保中文路径在所有浏览器都能读
    const parts = [ROOT_FOLDER, folder, subFolder, filename].filter(Boolean);
    const path = parts.map(part => encodeURIComponent(part)).join('/');
    return `${BASE_DOMAIN}/${path}`;
};

// --- 谐音映射表 (保持不变) ---
const burmeseMap = {
  'b': 'ဗ (ဘ)', 'p': 'ပ (ဖ)', 'm': 'မ', 'f': 'ဖ(ွ)', 'd': 'ဒ', 't': 'ထ', 'n': 'န', 'l': 'လ', 'g': 'ဂ', 'k': 'ခ', 'h': 'ဟ', 'j': 'ကျ', 'q': 'ချ', 'x': 'ရှ', 'zh': 'ကျ(zh)', 'ch': 'ချ(ch)', 'sh': 'ရှ(sh)', 'r': 'ရ(r)', 'z': 'ဇ', 'c': 'ဆ', 's': 'ဆ(ွ)', 'y': 'ယ', 'w': 'ဝ',
  'a': 'အာ', 'o': 'အော', 'e': 'အ', 'i': 'အီ', 'u': 'အူ', 'ü': 'ယူ',
  'ai': 'အိုင်', 'ei': 'အေ', 'ui': 'ဝေ', 'ao': 'အောက်', 'ou': 'အို', 'iu': 'ယူ', 'ie': 'ယဲ', 'üe': 'ရွဲ့', 'er': 'အာရ်',
  'an': 'အန်', 'en': 'အန်(en)', 'in': 'အင်', 'un': 'ဝန်း', 'ün': 'ရွန်း',
  'ang': 'အောင်', 'eng': 'အိုင်(eng)', 'ing': 'အိုင်', 'ong': 'အုန်',
  'zhi': 'ကျ(zh)', 'chi': 'ချ(ch)', 'shi': 'ရှ(sh)', 'ri': 'ရ(r)', 'zi': 'ဇ', 'ci': 'ဆ', 'si': 'ဆ(ွ)', 'yi': 'ယီး', 'wu': 'ဝူး', 'yu': 'ယွီး', 'ye': 'ယဲ', 'yue': 'ရွဲ့', 'yuan': 'ယွမ်', 'yin': 'ယင်း', 'yun': 'ယွန်း', 'ying': 'ယင်း(g)'
};

// --- 数据中心 ---
const pinyinData = {
  // 1. 声母
  initials: { 
    title: '声母表 (Initials)', 
    type: 'grid',
    items: ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'].map(l => ({ 
      letter: l, 
      // 结果: .../拼音音频/声母/b.mp3
      audio: getAudioUrl(INITIALS_FOLDER, null, `${l}.mp3`),
      burmese: burmeseMap[l] || '' 
    })) 
  },

  // 2. 韵母
  finals: { 
    title: '韵母表 (Finals)',
    type: 'sections',
    categories: [
      { name: '单韵母', rows: [['a','o','e','i','u','ü']] },
      { name: '复韵母', rows: [['ai','ei','ui','ao','ou','iu','ie','üe','er']] },
      { name: '前鼻韵母', rows: [['an','en','in','un','ün']] },
      { name: '后鼻韵母', rows: [['ang','eng','ing','ong']] }
    ].map(category => ({
      ...category,
      rows: category.rows.map(row => row.map(letter => ({
        letter,
        // 结果: .../拼音音频/韵母/a.mp3
        audio: getAudioUrl(FINALS_FOLDER, null, `${letter}.mp3`),
        burmese: burmeseMap[letter] || '' 
      })))
    }))
  },

  // 3. 整体认读
  whole: {
    title: '整体认读 (Whole Syllables)',
    type: 'sections',
    categories: [
      { name: '翘舌音与平舌音', rows: [['zhi','chi','shi','ri'], ['zi','ci','si']] },
      { name: 'i u ü 开头', rows: [['yi','wu','yu'], ['ye','yue','yuan'], ['yin','yun','ying']] }
    ].map(category => ({
      ...category,
      rows: category.rows.map(row => row.map(letter => ({
        letter,
        // 结果: .../拼音音频/整体读音/zhi.mp3
        audio: getAudioUrl(WHOLE_FOLDER, null, `${letter}.mp3`),
        burmese: burmeseMap[letter] || ''
      })))
    }))
  },

  // 4. 声调表
  tones: { 
    title: '声调表 (Tones)',
    type: 'sections',
    categories: [
      // 注意：这里的 folder 对应 R2 里 "声调表" 下面的子文件夹
      { name: '单韵母', folder: '单韵母', rows: [['ā','á','ǎ','à'], ['ō','ó','ǒ','ò'], ['ē','é','ě','è'], ['ī','í','ǐ','ì'], ['ū','ú','ǔ','ù'], ['ǖ','ǘ','ǚ','ǜ']] },
      { name: '复韵母', folder: '复韵母', rows: [['āi','ái','ǎi','ài'], ['ēi','éi','ěi','èi'], ['uī','uí','uǐ','uì'], ['āo','áo','ǎo','ào'], ['ōu','óu','ǒu','òu'], ['iū','iú','iǔ','iù'], ['iē','ié','iě','iè'], ['üē','üé','üě','üè'], ['ēr','ér','ěr','èr']] },
      { name: '前鼻韵母', folder: '鼻韵母', rows: [['ān','án','ǎn','àn'], ['ēn','én','ěn','èn'], ['īn','ín','ǐn','ìn'], ['ūn','ún','ǔn','ùn'], ['ǖn','ǘn','ǚn','ǜn']] },
      { name: '后鼻韵母', folder: '鼻韵母', rows: [['āng','áng','ǎng','àng'], ['ēng','éng','ěng','èng'], ['īng','íng','ǐng','ìng'], ['ōng','óng','ǒng','òng']] },
      { name: '整体认读', folder: '整体读音', rows: [['zhī','zhí','zhǐ','zhì'], ['chī','chí','chǐ','chì'], ['shī','shí','shǐ','shì'], ['rī','rí','rǐ','rì'], ['zī','zí','zǐ','zì'], ['cī','cí','cǐ','cì'], ['sī','sí','sǐ','sì'], ['yī','yí','yǐ','yì'], ['wū','wú','wǔ','ù'], ['yū','yú','yǔ','yù'], ['yē','yé','yě','yè'], ['yuē','yué','yuě','yuè'], ['yuān','yuán','yuǎn','yuàn'], ['yīn','yín','yǐ','yìn'], ['yūn','yún','yǔn','yùn'], ['yīng','yíng','ǐng','yìng']] }
    ].map(category => ({
      ...category,
      rows: category.rows.map(row => row.map(letter => {
        const cleanLetter = letter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace('g', 'g').toLowerCase();
        return {
          letter,
          // 结果: .../拼音音频/声调表/单韵母/ā.mp3
          audio: getAudioUrl(TONES_FOLDER, category.folder, `${letter}.mp3`),
          burmese: burmeseMap[letter] || burmeseMap[cleanLetter] || '' 
        };
      }))
    }))
  }
};

export default function PinyinChartPage() {
  const router = useRouter();
  const { chartType } = router.query;
  if (!router.isReady) return null;
  const chartData = pinyinData[chartType] || pinyinData['initials']; 

  return (
    <>
      <Head><title>{chartData.title}</title></Head>
      <div className="fixed top-0 left-0 right-0 h-16 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md z-50 flex items-center px-4 border-b border-gray-200 dark:border-gray-800">
         <Link href="/" passHref>
            <a className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <ArrowLeft size={24} className="text-gray-700 dark:text-gray-200" />
            </a>
         </Link>
         <h1 className="ml-4 text-lg font-bold text-gray-800 dark:text-gray-100">{chartData.title}</h1>
      </div>
      <div className="pt-20 pb-10 min-h-screen bg-gray-50 dark:bg-gray-900">
         <PinyinChartClient initialData={chartData} />
      </div>
    </>
  );
}
