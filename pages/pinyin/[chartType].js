import React from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// 动态导入客户端组件
const PinyinChartClient = dynamic(
  () => import('@/components/PinyinChartClient'),
  { 
    ssr: false,
    loading: () => <div className="pt-20 text-center text-white font-myanmar">ခေတ္တစောင့်ဆိုင်းပါ...</div>
  }
);

// ==========================================
// 1. 配置区域
// ==========================================

const BASE_DOMAIN = 'https://audio.886.best/chinese-vocab-audio';
const ROOT_FOLDER = '拼音音频'; 
const INITIALS_FOLDER = '声母';
const FINALS_FOLDER = '韵母';
const WHOLE_FOLDER = '整体读音';
const TONES_FOLDER = '声调表';

const getAudioUrl = (folder, subFolder, filename) => {
    const parts = [ROOT_FOLDER, folder, subFolder, filename].filter(Boolean);
    const path = parts.map(part => encodeURIComponent(part)).join('/');
    return `${BASE_DOMAIN}/${path}`;
};

// --- 谐音映射表 (缅文) ---
const burmeseMap = {
  'b': 'ဗ (ဘ)', 'p': 'ပ (ဖ)', 'm': 'မ', 'f': 'ဖ(ွ)', 'd': 'ဒ', 't': 'ထ', 'n': 'န', 'l': 'လ', 'g': 'ဂ', 'k': 'ခ', 'h': 'ဟ', 'j': 'ကျ', 'q': 'ချ', 'x': 'ရှ', 'zh': 'ကျ(zh)', 'ch': 'ချ(ch)', 'sh': 'ရှ(sh)', 'r': 'ရ(r)', 'z': 'ဇ', 'c': 'ဆ', 's': 'ဆ(ွ)', 'y': 'ယ', 'w': 'ဝ',
  'a': 'အာ', 'o': 'အော', 'e': 'အ', 'i': 'အီ', 'u': 'အူ', 'ü': 'ယူ',
  'ai': 'အိုင်', 'ei': 'အေ', 'ui': 'ဝေ', 'ao': 'အောက်', 'ou': 'အို', 'iu': 'ယူ', 'ie': 'ယဲ', 'üe': 'ရွဲ့', 'er': 'အာရ်',
  'an': 'အန်', 'en': 'အန်(en)', 'in': 'အင်', 'un': 'ဝန်း', 'ün': 'ရွန်း',
  'ang': 'အောင်', 'eng': 'အိုင်(eng)', 'ing': 'အိုင်', 'ong': 'အုန်',
  'zhi': 'ကျ(zh)', 'chi': 'ချ(ch)', 'shi': 'ရှ(sh)', 'ri': 'ရ(r)', 'zi': 'ဇ', 'ci': 'ဆ', 'si': 'ဆ(ွ)', 'yi': 'ယီး', 'wu': 'ဝူး', 'yu': 'ယွီး', 'ye': 'ယဲ', 'yue': 'ရွဲ့', 'yuan': 'ယွမ်', 'yin': 'ယင်း', 'yun': 'ယွန်း', 'ying': 'ယင်း(g)'
};

// ==========================================
// 2. 数据中心
// ==========================================

const pinyinData = {
  // 1. 声母 (ဗျည်းများ) - 不分类
  initials: { 
    title: 'ဗျည်းများ (Initials)', 
    type: 'grid',
    items: ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'].map(l => ({ 
      letter: l, 
      audio: getAudioUrl(INITIALS_FOLDER, null, `${l}.mp3`),
      burmese: burmeseMap[l] || '' 
    })) 
  },

  // 2. 韵母 (သရများ) - 不分类扁平化
  finals: { 
    title: 'သရများ (Finals)',
    type: 'grid',
    items: [
        'a','o','e','i','u','ü', 
        'ai','ei','ui','ao','ou','iu','ie','üe','er',
        'an','en','in','un','ün',
        'ang','eng','ing','ong'
    ].map(l => ({
        letter: l,
        audio: getAudioUrl(FINALS_FOLDER, null, `${l}.mp3`),
        burmese: burmeseMap[l] || ''
    }))
  },

  // 3. 整体认读 (တစ်ဆက်တည်းဖတ်သံများ) - 不分类
  whole: {
    title: 'တစ်ဆက်တည်းဖတ်သံများ (Whole Syllables)',
    type: 'grid',
    items: [
        'zhi','chi','shi','ri','zi','ci','si',
        'yi','wu','yu','ye','yue','yuan','yin','yun','ying'
    ].map(l => ({
        letter: l,
        audio: getAudioUrl(WHOLE_FOLDER, null, `${l}.mp3`),
        burmese: burmeseMap[l] || ''
    }))
  },

  // 4. 声调表 (အသံအနိမ့်အမြင့်ဇယား) - 分类显示
  tones: { 
    title: 'အသံအနိမ့်အမြင့် (Tones)',
    type: 'sections',
    categories: [
      { name: 'သရတစ်ခုတည်း (Single Finals)', folder: '单韵母', rows: [['ā','á','ǎ','à'], ['ō','ó','ǒ','ò'], ['ē','é','ě','è'], ['ī','í','ǐ','ì'], ['ū','ú','ǔ','ù'], ['ǖ','ǘ','ǚ','ǜ']] },
      { name: 'ပေါင်းစပ်သရ (Compound Finals)', folder: '复韵母', rows: [['āi','ái','ǎi','ài'], ['ēi','éi','ěi','èi'], ['uī','uí','uǐ','uì'], ['āo','áo','ǎo','ào'], ['ōu','óu','ǒu','òu'], ['iū','iú','iǔ','iù'], ['iē','ié','iě','iè'], ['üē','üé','üě','üè'], ['ēr','ér','ěr','èr']] },
      { name: 'နှာသံသရ (Nasal Finals)', folder: '鼻韵母', rows: [['ān','án','ǎn','àn'], ['ēn','én','ěn','èn'], ['īn','ín','ǐn','ìn'], ['ūn','ún','ǔn','ùn'], ['ǖn','ǘn','ǚn','ǜn'], ['āng','áng','ǎng','àng'], ['ēng','éng','ěng','èng'], ['īng','íng','ǐng','ìng'], ['ōng','óng','ǒng','òng']] },
      { name: 'တစ်ဆက်တည်းဖတ်သံ (Whole Syllables)', folder: '整体读音', rows: [['zhī','zhí','zhǐ','zhì'], ['chī','chí','chǐ','chì'], ['shī','shí','shǐ','shì'], ['rī','rí','rǐ','rì'], ['zī','zí','zǐ','zì'], ['cī','cí','cǐ','cì'], ['sī','sí','sǐ','sì'], ['yī','yí','yǐ','yì'], ['wū','wú','wǔ','ù'], ['yū','yú','yǔ','yù'], ['yē','yé','yě','yè'], ['yuē','yué','yuě','yuè'], ['yuān','yuán','yuǎn','yuàn'], ['yīn','yín','yǐ','yìn'], ['yūn','yún','yǔn','yùn'], ['yīng','yíng','ǐng','yìng']] }
    ].map(category => ({
      ...category,
      rows: category.rows.map(row => row.map(letter => {
        // 修复第一声偏移：确保使用标准化字符
        const normalizedLetter = letter.normalize("NFC");
        const cleanLetter = letter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return {
          letter: normalizedLetter,
          audio: getAudioUrl(TONES_FOLDER, category.folder, `${letter}.mp3`),
          burmese: burmeseMap[letter] || burmeseMap[cleanLetter] || '' 
        };
      }))
    }))
  }
};

// ==========================================
// 3. 静态路径处理 (适配 Cloudflare Pages)
// ==========================================

export async function getStaticPaths() {
    const paths = [
        { params: { chartType: 'initials' } },
        { params: { chartType: 'finals' } },
        { params: { chartType: 'whole' } },
        { params: { chartType: 'tones' } }
    ];
    return { paths, fallback: false };
}

export async function getStaticProps({ params }) {
    return { props: { chartType: params.chartType } };
}

// ==========================================
// 4. 页面组件
// ==========================================

export default function PinyinChartPage({ chartType: initialType }) {
  const router = useRouter();
  const chartType = initialType || router.query.chartType;
  
  // 保护逻辑
  if (!chartType || !pinyinData[chartType]) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
  }

  const chartData = pinyinData[chartType]; 

  return (
    <>
      <Head>
        <title>{chartData.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* 顶部标题栏 - 已删除左侧返回键 */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md z-50 flex items-center justify-center px-4 border-b border-gray-200 dark:border-gray-800 shadow-sm">
         <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 tracking-tight font-myanmar">
            {chartData.title}
         </h1>
      </div>

      {/* 内容区域 */}
      <div className="pt-20 pb-10 min-h-screen bg-gray-50 dark:bg-gray-900">
         <PinyinChartClient initialData={chartData} />
      </div>

      <style jsx global>{`
        /* 修复拼音第一声和声调偏移的全局样式 */
        .pinyin-letter {
            line-height: 1 !important;
            display: inline-block;
            transform: translateY(-0.05em); /* 微调垂直位置 */
        }
        
        /* 缅文字体支持 */
        .font-myanmar {
            font-family: 'Pyidaungsu', 'Inter', sans-serif;
        }

        /* 移动端点击效果 */
        * {
            -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </>
  );
}
