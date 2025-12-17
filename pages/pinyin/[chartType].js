// 文件：pages/pinyin/[chartType].js

import React from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// 动态导入客户端组件
const PinyinChartClient = dynamic(
  () => import('@/components/PinyinChartClient'),
  { 
    ssr: false,
    loading: () => (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <div className="animate-pulse flex flex-col items-center">
                <div className="h-4 w-4 bg-cyan-500 rounded-full mb-2 animate-bounce"></div>
                正在加载拼音模块...
            </div>
        </div>
    ) 
  }
);

// --- 0. 定义 R2 音频基础路径 ---
const BASE_AUDIO_URL = 'https://audio.886.best/chinese-vocab-audio/拼音音频';

// --- 1. 定义谐音映射表 ---
const burmeseMap = {
  // === 声母 (Initials) ===
  'b': 'ဗ (ဘ)', 'p': 'ပ (ဖ)', 'm': 'မ', 'f': 'ဖ(ွ)', 'd': 'ဒ', 't': 'ထ', 'n': 'န', 'l': 'လ', 'g': 'ဂ', 'k': 'ခ', 'h': 'ဟ', 'j': 'ကျ', 'q': 'ချ', 'x': 'ရှ', 'zh': 'ကျ(zh)', 'ch': 'ချ(ch)', 'sh': 'ရှ(sh)', 'r': 'ရ(r)', 'z': 'ဇ', 'c': 'ဆ', 's': 'ဆ(ွ)', 'y': 'ယ', 'w': 'ဝ',
  // === 单韵母 ===
  'a': 'အာ', 'o': 'အော', 'e': 'အ', 'i': 'အီ', 'u': 'အူ', 'ü': 'ယူ',
  // === 复韵母 ===
  'ai': 'အိုင်', 'ei': 'အေ', 'ui': 'ဝေ', 'ao': 'အောက်', 'ou': 'အို', 'iu': 'ယူ', 'ie': 'ယဲ', 'üe': 'ရွဲ့', 'er': 'အာရ်',
  // === 前鼻韵母 ===
  'an': 'အန်', 'en': 'အန်(en)', 'in': 'အင်', 'un': 'ဝန်း', 'ün': 'ရွန်း',
  // === 后鼻韵母 ===
  'ang': 'အောင်', 'eng': 'အိုင်(eng)', 'ing': 'အိုင်', 'ong': 'အုန်',
  // === 整体认读音节 ===
  'zhi': 'ကျ(zh)', 'chi': 'ချ(ch)', 'shi': 'ရှ(sh)', 'ri': 'ရ(r)', 'zi': 'ဇ', 'ci': 'ဆ', 'si': 'ဆ(ွ)', 'yi': 'ယီး', 'wu': 'ဝူး', 'yu': 'ယွီး', 'ye': 'ယဲ', 'yue': 'ရွဲ့', 'yuan': 'ယွမ်', 'yin': 'ယင်း', 'yun': 'ယွန်း', 'ying': 'ယင်း(g)'
};

// --- 2. 拼音数据中心 ---
const pinyinData = {
  // 1. 声母 (纯列表)
  initials: { 
    title: '声母表 (Initials)', 
    type: 'grid', // 标记为网格布局
    items: ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'].map(l => ({ 
      letter: l, 
      audio: `${BASE_AUDIO_URL}/声母/${l}.mp3`,
      burmese: burmeseMap[l] || '' 
    })) 
  },

  // 2. 韵母 (分类布局)
  finals: { 
    title: '韵母表 (Finals)',
    type: 'sections', // 标记为分节布局
    categories: [
      { name: '单韵母', rows: [['a','o','e','i','u','ü']] },
      { name: '复韵母', rows: [['ai','ei','ui','ao','ou','iu','ie','üe','er']] },
      { name: '前鼻韵母', rows: [['an','en','in','un','ün']] },
      { name: '后鼻韵母', rows: [['ang','eng','ing','ong']] }
    ].map(category => ({
      ...category,
      rows: category.rows.map(row => row.map(letter => ({
        letter,
        audio: `${BASE_AUDIO_URL}/韵母/${letter}.mp3`,
        burmese: burmeseMap[letter] || '' 
      })))
    }))
  },

  // 3. 整体认读 (分类布局)
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
        audio: `${BASE_AUDIO_URL}/整体读音/${letter}.mp3`,
        burmese: burmeseMap[letter] || ''
      })))
    }))
  },

  // 4. 声调表 (分类布局)
  tones: { 
    title: '声调表 (Tones)',
    type: 'sections',
    categories: [
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
          audio: `${BASE_AUDIO_URL}/声调表/${category.folder}/${letter}.mp3`,
          burmese: burmeseMap[letter] || burmeseMap[cleanLetter] || '' 
        };
      }))
    }))
  }
};

export default function PinyinChartPage() {
  const router = useRouter();
  const { chartType } = router.query;

  // 等待路由参数就绪
  if (!router.isReady) {
    return null; // 或者返回 loading
  }

  // 特殊处理 "tips" 页面，如果访问 tips，这里最好重定向或者显示特定内容
  // 为了防止报错，如果 key 不存在，默认显示 initials
  const chartData = pinyinData[chartType] || pinyinData['initials']; 

  return (
    <>
      <Head>
        <title>{chartData.title} - 汉语学习</title>
      </Head>
      
      {/* 顶部导航栏 */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md z-50 flex items-center px-4 border-b border-gray-200 dark:border-gray-800">
         <Link href="/" passHref>
            <a className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <ArrowLeft size={24} className="text-gray-700 dark:text-gray-200" />
            </a>
         </Link>
         <h1 className="ml-4 text-lg font-bold text-gray-800 dark:text-gray-100">{chartData.title}</h1>
      </div>

      {/* 内容区域 */}
      <div className="pt-20 pb-10 min-h-screen bg-gray-50 dark:bg-gray-900">
         <PinyinChartClient initialData={chartData} />
      </div>
    </>
  );
}
