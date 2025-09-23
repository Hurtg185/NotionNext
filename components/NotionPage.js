// components/NotionPage.js (V3.1 - 清理了无效导入)

import { siteConfig } from '@/lib/config'
import { compressImage, mapImgUrl } from '@/lib/notion/mapImage'
import { isBrowser, loadExternalResource } from '@/lib/utils'
import mediumZoom from '@fisch0920/medium-zoom'
import 'katex/dist/katex.min.css'
import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import { NotionRenderer } from 'react-notion-x'

// --- [核心修复] 只导入你项目中实际存在的自定义组件 ---
const AiTtsButton = dynamic(() => import('@/components/AiTtsButton'), { ssr: false });
const BeiDanCi = dynamic(() => import('@/components/BeiDanCi'), { ssr: false });
const ImmersiveCubeCard = dynamic(() => import('@/components/ImmersiveCubeCard'), { ssr: false });
const PinyinPracticeCard = dynamic(() => import('@/components/PinyinPracticeCard'), { ssr: false });
// const FlashcardPro = dynamic(() => import('@/components/FlashcardPro'), { ssr: false }); // 如果你有这个文件，就取消注释

// --- 下面这些是你之前的代码里有的，但如果你的项目里没有这些文件，就保持注释或删除 ---
// const PronunciationPractice = dynamic(() => import('@/components/PronunciationPractice'), { ssr: false });
// const MotionTest = dynamic(() => import('@/components/MotionTest'), { ssr: false });
// const HanziWriterPractice = dynamic(() => import('@/components/HanziWriterPractice'), { ssr: false });
// const SentenceScramble = dynamic(() => import('@/components/SentenceScramble'), { ssr: false });
// const SwipeableFlashcard = dynamic(() => import('@/components/SwipeableFlashcard'), { ssr: false });
// const TtsSettingsModal = dynamic(() => import('@/components/TtsSettingsModal'), { ssr: false });
// const TextToSpeechButton = dynamic(() => import('@/components/TextToSpeechButton'), { ssr: false });


// --- 其他组件导入 ---
const Code = dynamic(() => import('react-notion-x/build/third-party/code').then(m => m.Code), { ssr: false });
const Collection = dynamic(() => import('react-notion-x/build/third-party/collection').then(m => m.Collection),{ ssr: true });
const Equation = dynamic(() => import('@/components/Equation').then(async m => { await import('@/lib/plugins/mhchem'); return m.Equation }), { ssr: false });
const Modal = dynamic(() => import('react-notion-x/build/third-party/modal').then(m => m.Modal), { ssr: false });
const Pdf = dynamic(() => import('@/components/Pdf').then(m => m.Pdf), { ssr: false });
const TweetEmbed = dynamic(() => import('react-tweet-embed'), { ssr: false });
const AdEmbed = dynamic(() => import('@/components/GoogleAdsense').then(m => m.AdEmbed), { ssr: true });
const PrismMac = dynamic(() => import('@/components/PrismMac'), { ssr: false });
const Tweet = ({ id }) => { return <TweetEmbed tweetId={id} /> }

const NotionPage = ({ post, className }) => {
  // ... (Hooks 和辅助函数保持不变) ...
  
  const parseInclude = (textContent) => {
    const includeRegex = /!include\s+(\S+\.js)\s*({.*})?/s;
    const match = textContent.match(includeRegex);
    if (match) {
      const componentPath = match[1];
      const propsString = match[2] || '{}';
      try {
        const parsedProps = JSON.parse(propsString);
        return { componentPath, parsedProps };
      } catch (e) {
        console.error('!include JSON 解析失败:', e, `原始JSON字符串: "${propsString}"`);
        return { error: 'JSON_PARSE_ERROR' }; 
      }
    }
    return null;
  };

  return (
    <div id='notion-article' className={`mx-auto overflow-hidden ${className || ''}`}>
      <NotionRenderer
        recordMap={post?.blockMap}
        mapPageUrl={mapPageUrl}
        mapImageUrl={mapImgUrl}
        components={{
          Code: (props) => {
            const blockContent = props.block.properties?.title?.[0]?.[0];
            if (blockContent && blockContent.startsWith('!include')) {
              const includeData = parseInclude(blockContent);
              if (includeData && !includeData.error) {
                 const { componentPath, parsedProps } = includeData;
                 
                 // --- [核心修复] 只渲染你实际拥有的组件 ---
                 if (componentPath === '/components/AiTtsButton.js') return <AiTtsButton key={props.block.id} {...parsedProps} />;
                 if (componentPath === '/components/BeiDanCi.js') return <BeiDanCi key={props.block.id} {...parsedProps} />;
                 if (componentPath === '/components/ImmersiveCubeCard.js') return <ImmersiveCubeCard key={props.block.id} {...parsedProps} />;
                 if (componentPath === '/components/PinyinPracticeCard.js') return <PinyinPracticeCard key={props.block.id} {...parsedProps} />;
                 // if (componentPath === '/components/FlashcardPro.js') return <FlashcardPro key={props.block.id} {...parsedProps} />;

                 // --- 下面这些同理，如果你没有这些文件，就保持注释或删除 ---
                 // if (componentPath === '/components/PronunciationPractice.js') return <PronunciationPractice key={props.block.id} {...parsedProps} />;
                 // ...等等
              } else if (includeData && includeData.error) {
                  return <div style={{padding: '1rem', border: '2px dashed red', color: 'red'}}>!include 块的 JSON 配置错误，请检查 Notion 页面。</div>
              }
            }
            return <Code {...props} />;
          },
          Collection,
          Equation,
          Modal,
          Pdf,
          Tweet,
        }}
      />
      <AdEmbed />
      <PrismMac />
    </div>
  )
}

// ... (所有辅助函数保持不变) ...
const processDisableDatabaseUrl = () => { /* ... */ }
const processGalleryImg = zoom => { /* ... */ }
const autoScrollToHash = () => { /* ... */ }
const mapPageUrl = id => { return '/' + id.replace(/-/g, '') }
function getMediumZoomMargin() { /* ... */ }

export default NotionPage;
