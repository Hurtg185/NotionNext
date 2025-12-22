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
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400 font-myanmar">ခေတ္တစောင့်ဆိုင်းပါ...</p>
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
// 2. 数据处理中心 (全扁平化)
// ==========================================

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
  initials: { 
    title: 'ဗျည်းများ (Initials)', 
    type: 'grid',
    items: ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'].map(l => ({ 
      letter: l, 
      audio: getAudioUrl(INITIALS_FOLDER, null, `${l}.mp3`),
      burmese: burmeseMap[l] || '' 
    })) 
  },
  finals: { 
    title: 'သရများ (Finals)',
    type: 'grid',
    items: ['a','o','e','i','u','ü','ai','ei','ui','ao','ou','iu','ie','üe','er','an','en','in','un','ün','ang','eng','ing','ong'].map(l => ({
        letter: l,
        audio: getAudioUrl(FINALS_FOLDER, null, `${l}.mp3`),
        burmese: burmeseMap[l] || ''
    }))
  },
  whole: {
    title: 'တစ်ဆက်တည်းဖတ်သံများ',
    type: 'grid',
    items: ['zhi','chi','shi','ri','zi','ci','si','yi','wu','yu','ye','yue','yuan','yin','yun','ying'].map(l => ({
        letter: l,
        audio: getAudioUrl(WHOLE_FOLDER, null, `${l}.mp3`),
        burmese: burmeseMap[l] || ''
    }))
  },
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
    return { 
        paths: [
            { params: { chartType: 'initials' } },
            { params: { chartType: 'finals' } },
            { params: { chartType: 'whole' } },
            { params: { chartType: 'tones' } }
        ], 
        fallback: false 
    };
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
    return <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">Loading...</div>;
  }

  const chartData = pinyinData[chartType]; 

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a]">
      <Head>
        <title>{chartData.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

     
      {/* 网格内容 */}
      <div className="pt-4 pb-16 max-w-2xl mx-auto px-2">
         <PinyinChartClient initialData={chartData} />
      </div>

      <style jsx global>{`
        /* 🔥 核心修复：应用 WordCard 的字体对齐逻辑 */
        .pinyin-letter {
            /* 使用 WordCard 同款字体栈，这是对齐声调的关键 */
            font-family: 'Roboto', 'Segoe UI', 'Arial', sans-serif !important;
            font-weight: 700;
            line-height: 1.1 !important;
            display: inline-block;
            text-shadow: none !important; /* 禁用阴影防止视觉位移 */
            -webkit-font-smoothing: antialiased;
            font-variant-ligatures: none;
        }

        .font-myanmar {
            font-family: 'Padauk', 'Myanmar Text', 'Pyidaungsu', sans-serif;
            line-height: 1.5;
        }

        /* 强制 4 列网格布局 */
        .pinyin-grid-container {
            display: grid !important;
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            gap: 12px !important;
        }

        /* 卡片精细美化 */
        .pinyin-card {
            aspect-ratio: 1 / 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #ffffff;
            border-radius: 20px;
            border: 1px solid rgba(226, 232, 240, 0.8);
            box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.03);
            transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            cursor: pointer;
            position: relative;
            padding: 8px;
        }

        .dark .pinyin-card {
            background: #1e293b;
            border-color: #334155;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }

        /* 点击交互动画 */
        .pinyin-card:active {
            transform: scale(0.9);
            background: #f1f5f9;
        }
        .dark .pinyin-card:active {
            background: #0f172a;
        }

        /* 拼音字母大小调整 */
        .pinyin-card-letter {
            font-size: 1.6rem;
            color: #1e293b;
            margin-bottom: 2px;
        }
        .dark .pinyin-card-letter {
            color: #f1f5f9;
        }

        /* 缅文备注大小 */
        .pinyin-card-burmese {
            font-size: 0.75rem;
            color: #64748b;
            font-weight: 500;
        }

        * {
            -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
}
