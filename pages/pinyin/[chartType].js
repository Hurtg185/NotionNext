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
    loading: () => (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-gray-500 font-myanmar">ခေတ္တစောင့်ဆိုင်းပါ...</p>
        </div>
      </div>
    )
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

// --- 缅文谐音映射表 ---
const burmeseMap = {
  'b': 'ဗ (ဘ)', 'p': 'ပ (ဖ)', 'm': 'မ', 'f': 'ဖ(ွ)', 'd': 'ဒ', 't': 'ထ', 'n': 'န', 'l': 'လ', 'g': 'ဂ', 'k': 'ခ', 'h': 'ဟ', 'j': 'ကျ', 'q': 'ချ', 'x': 'ရှ', 'zh': 'ကျ(zh)', 'ch': 'ချ(ch)', 'sh': 'ရှ(sh)', 'r': 'ရ(r)', 'z': 'ဇ', 'c': 'ဆ', 's': 'ဆ(ွ)', 'y': 'ယ', 'w': 'ဝ',
  'a': 'အာ', 'o': 'အော', 'e': 'အ', 'i': 'အီ', 'u': 'အူ', 'ü': 'ယူ',
  'ai': 'အိုင်', 'ei': 'အေ', 'ui': 'ဝေ', 'ao': 'အောက်', 'ou': 'အို', 'iu': 'ယူ', 'ie': 'ယဲ', 'üe': 'ရွဲ့', 'er': 'အာရ်',
  'an': 'အန်', 'en': 'အန်(en)', 'in': 'အင်', 'un': 'ဝန်း', 'ün': 'ရွန်း',
  'ang': 'အောင်', 'eng': 'အိုင်(eng)', 'ing': 'အိုင်', 'ong': 'အုန်',
  'zhi': 'ကျ(zh)', 'chi': 'ချ(ch)', 'shi': 'ရှ(sh)', 'ri': 'ရ(r)', 'zi': 'ဇ', 'ci': 'ဆ', 'si': 'ဆ(ွ)', 'yi': 'ယီး', 'wu': 'ဝူး', 'yu': 'ယွီး', 'ye': 'ယဲ', 'yue': 'ရွဲ့', 'yuan': 'ယွမ်', 'yin': 'ယင်း', 'yun': 'ယွန်း', 'ying': 'ယင်း(g)'
};

// ==========================================
// 2. 数据中心 (全扁平化处理)
// ==========================================

// 辅助函数：将多维声调数据打平
const flattenTones = () => {
    const categories = [
        { folder: '单韵母', rows: [['ā','á','ǎ','à'], ['ō','ó','ǒ','ò'], ['ē','é','ě','è'], ['ī','í','ǐ','ì'], ['ū','ú','ǔ','ù'], ['ǖ','ǘ','ǚ','ǜ']] },
        { folder: '复韵母', rows: [['āi','ái','ǎi','ài'], ['ēi','éi','ěi','èi'], ['uī','uí','uǐ','uì'], ['āo','áo','ǎo','ào'], ['ōu','óu','ǒu','òu'], ['iū','iú','iǔ','iù'], ['iē','ié','iě','iè'], ['üē','üé','üě','üè'], ['ēr','ér','ěr','èr']] },
        { folder: '鼻韵母', rows: [['ān','án','ǎn','àn'], ['ēn','én','ěn','èn'], ['īn','ín','ǐn','ìn'], ['ūn','ún','ǔn','ùn'], ['ǖn','ǘn','ǚn','ǜn'], ['āng','áng','ǎng','àng'], ['ēng','éng','ěng','èng'], ['īng','íng','ǐng','ìng'], ['ōng','óng','ǒng','òng']] },
        { folder: '整体读音', rows: [['zhī','zhí','zhǐ','zhì'], ['chī','chí','chǐ','chì'], ['shī','shí','shǐ','shì'], ['rī','rí','rǐ','rì'], ['zī','zí','zǐ','zì'], ['cī','cí','cǐ','cì'], ['sī','sí','sǐ','sì'], ['yī','yí','yǐ','yì'], ['wū','wú','wǔ','ù'], ['yū','yú','yǔ','yù'], ['yē','yé','yě','yè'], ['yuē','yué','yuě','yuè'], ['yuān','yuán','yuǎn','yuàn'], ['yīn','yín','yǐ','yìn'], ['yūn','yún','yǔn','yùn'], ['yīng','yíng','ǐng','yìng']] }
    ];

    const flatList = [];
    categories.forEach(cat => {
        cat.rows.forEach(row => {
            row.forEach(letter => {
                const normalizedLetter = letter.normalize("NFC");
                const cleanLetter = letter.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
                flatList.push({
                    letter: normalizedLetter,
                    audio: getAudioUrl(TONES_FOLDER, cat.folder, `${letter}.mp3`),
                    burmese: burmeseMap[letter] || burmeseMap[cleanLetter] || ''
                });
            });
        });
    });
    return flatList;
};

const pinyinData = {
  // 1. 声母表
  initials: { 
    title: 'ဗျည်းများ (Initials)', 
    type: 'grid',
    items: ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'].map(l => ({ 
      letter: l, 
      audio: getAudioUrl(INITIALS_FOLDER, null, `${l}.mp3`),
      burmese: burmeseMap[l] || '' 
    })) 
  },

  // 2. 韵母表
  finals: { 
    title: 'သရများ (Finals)',
    type: 'grid',
    items: [
        'a','o','e','i','u','ü', 'ai','ei','ui','ao','ou','iu','ie','üe','er',
        'an','en','in','un','ün', 'ang','eng','ing','ong'
    ].map(l => ({
        letter: l,
        audio: getAudioUrl(FINALS_FOLDER, null, `${l}.mp3`),
        burmese: burmeseMap[l] || ''
    }))
  },

  // 3. 整体认读表
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

  // 4. 声调表 (现在也是网格布局)
  tones: { 
    title: 'အသံအနိမ့်အမြင့် (Tones)',
    type: 'grid',
    items: flattenTones()
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
  
  if (!chartType || !pinyinData[chartType]) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">Loading...</div>;
  }

  const chartData = pinyinData[chartType]; 

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Head>
        <title>{chartData.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* 顶部标题栏 - 高端毛玻璃效果 */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-50 flex items-center justify-center px-4 border-b border-slate-200 dark:border-slate-800">
         <h1 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight font-myanmar">
            {chartData.title}
         </h1>
      </div>

      {/* 内容区域 */}
      <div className="pt-20 pb-16 max-w-2xl mx-auto px-3">
         {/* 这里的 PinyinChartClient 将渲染 4 列布局 */}
         <PinyinChartClient initialData={chartData} />
      </div>

      <style jsx global>{`
        /* 全局美化样式 */
        
        /* 拼音字符对齐与优化 */
        .pinyin-letter {
            font-family: 'Inter', system-ui, sans-serif;
            font-weight: 700;
            line-height: 1 !important;
            display: inline-block;
            /* 修复第一声偏移 */
            font-variant-ligatures: none;
            -webkit-font-smoothing: antialiased;
        }

        /* 缅文字体 */
        .font-myanmar {
            font-family: 'Pyidaungsu', 'Inter', sans-serif;
            line-height: 1.6;
        }

        /* 卡片容器网格控制 (强制 4 列) */
        .pinyin-grid-container {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 0.75rem !important;
        }

        /* 单个卡片美化 */
        .pinyin-card {
            aspect-ratio: 1 / 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #ffffff;
            border-radius: 1.25rem;
            border: 1px solid #f1f5f9;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
            position: relative;
            overflow: hidden;
        }

        .dark .pinyin-card {
            background: #1e293b;
            border-color: #334155;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
        }

        /* 点击反馈 */
        .pinyin-card:active {
            scale: 0.92;
            background: #f8fafc;
        }
        .dark .pinyin-card:active {
            background: #0f172a;
        }

        /* 移除多余的返回键和不必要的间距 */
        * {
            -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
}
