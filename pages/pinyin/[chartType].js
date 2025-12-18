import React from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const PinyinChartClient = dynamic(() => import('@/components/PinyinChartClient'), { ssr: false });

// 基础配置
const BASE_DOMAIN = 'https://audio.886.best/chinese-vocab-audio';
const ROOT_FOLDER = '拼音音频'; 

const getAudioUrl = (folder, subFolder, filename) => {
    const parts = [ROOT_FOLDER, folder, subFolder, filename].filter(Boolean);
    const path = parts.map(part => encodeURIComponent(part)).join('/');
    return `${BASE_DOMAIN}/${path}`;
};

const burmeseMap = {
  'b': 'ဗ (ဘ)', 'p': 'ပ (ဖ)', 'm': 'မ', 'f': 'ဖ(ွ)', 'd': 'ဒ', 't': 'ထ', 'n': 'န', 'l': 'လ', 'g': 'ဂ', 'k': 'ခ', 'h': 'ဟ', 'j': 'ကျ', 'q': 'ချ', 'x': 'ရှ', 'zh': 'ကျ(zh)', 'ch': 'ချ(ch)', 'sh': 'ရှ(sh)', 'r': 'ရ(r)', 'z': 'ဇ', 'c': 'ဆ', 's': 'ဆ(ွ)', 'y': 'ယ', 'w': 'ဝ',
  'a': 'အာ', 'o': 'အော', 'e': 'အ', 'i': 'အီ', 'u': 'အူ', 'ü': 'ယူ',
  'ai': 'အိုင်', 'ei': 'အေ', 'ui': 'ဝေ', 'ao': 'အောက်', 'ou': 'အို', 'iu': 'ယူ', 'ie': 'ယဲ', 'üe': 'ရွဲ့', 'er': 'အာရ်',
  'an': 'အန်', 'en': 'အန်(en)', 'in': 'အင်', 'un': 'ဝန်း', 'ün': 'ရွန်း',
  'ang': 'အောင်', 'eng': 'အိုင်(eng)', 'ing': 'အိုင်', 'ong': 'အုန်',
  'zhi': 'ကျ(zh)', 'chi': 'ချ(ch)', 'shi': 'ရှ(sh)', 'ri': 'ရ(r)', 'zi': 'ဇ', 'ci': 'ဆ', 'si': 'ဆ(ွ)', 'yi': 'ယီး', 'wu': 'ဝူး', 'yu': 'ယွီး', 'ye': 'ယဲ', 'yue': 'ရွဲ့', 'yuan': 'ယွမ်', 'yin': 'ယင်း', 'yun': 'ယွန်း', 'ying': 'ယင်း(g)'
};

const pinyinData = {
  initials: { 
    title: '声母表 (Initials)', type: 'grid',
    items: ['b','p','m','f','d','t','n','l','g','k','h','j','q','x','zh','ch','sh','r','z','c','s','y','w'].map(l => ({ 
      letter: l, audio: getAudioUrl('声母', null, `${l}.mp3`), burmese: burmeseMap[l] || '' 
    })) 
  },
  finals: { 
    title: '韵母表 (Finals)', type: 'sections',
    categories: [{ name: '单韵母', rows: [['a','o','e','i','u','ü']] }].map(cat => ({
      ...cat, rows: cat.rows.map(row => row.map(letter => ({ letter, audio: getAudioUrl('韵母', null, `${letter}.mp3`), burmese: burmeseMap[letter] || '' })))
    }))
  }
};

// 静态路径导出
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

export default function PinyinChartPage({ chartType: initialType }) {
  const router = useRouter();
  const chartType = initialType || router.query.chartType;
  const chartData = pinyinData[chartType] || pinyinData['initials']; 

  return (
    <>
      <Head><title>{chartData.title}</title></Head>
      <div className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 z-50 flex items-center px-4 border-b">
         <Link href="/hsk" passHref><a className="p-2"><ArrowLeft size={24} /></a></Link>
         <h1 className="ml-4 font-bold">{chartData.title}</h1>
      </div>
      <div className="pt-20 min-h-screen bg-gray-50 dark:bg-gray-900">
         <PinyinChartClient initialData={chartData} />
      </div>
    </>
  );
}
