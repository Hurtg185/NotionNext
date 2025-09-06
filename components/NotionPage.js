// /components/NotionPage.js (修复版)
import { siteConfig } from '@/lib/config'
import { compressImage, mapImgUrl } from '@/lib/notion/mapImage'
import { isBrowser, loadExternalResource } from '@/lib/utils'
import mediumZoom from '@fisch0920/medium-zoom'
import 'katex/dist/katex.min.css'
import dynamic from 'next/dynamic'
import React, { useEffect, useRef } from 'react'
import { NotionRenderer } from 'react-notion-x'

// ===================================================================================================================
// START: 自定义组件解析逻辑
// ===================================================================================================================

const CUSTOM_COMPONENTS_MAP = {
  '/components/XuanZeTi.js': dynamic(() => import('@/components/XuanZeTi'), { ssr: false }),
  '/components/PaiXuTi.js': dynamic(() => import('@/components/PaiXuTi'), { ssr: false }),
  '/components/ExternalTextToSpeech.js': dynamic(() => import('@/components/ExternalTextToSpeech'), { ssr: false }),
  '/components/AiChatAssistant.js': dynamic(() => import('@/components/AiChatAssistant'), { ssr: false }),
  '/components/PinyinHanziQuiz.js': dynamic(() => import('@/components/PinyinHanziQuiz'), { ssr: false }),
  '/components/LianXianTi.js': dynamic(() => import('@/components/LianXianTi'), { ssr: false }),
  '/components/AiCorrector.js': dynamic(() => import('@/components/AiCorrector'), { ssr: false }),
  '/components/PronunciationChecker.js': dynamic(() => import('@/components/PronunciationChecker'), { ssr: false }),
  '/components/JumpToCardModal.js': dynamic(() => import('@/components/JumpToCardModal'), { ssr: false }),
  '/components/BeiDanCi.js': dynamic(() => import('@/components/BeiDanCi'), { ssr: false }),
};

const getTextContent = (richTextArray) => {
  if (!richTextArray || !Array.isArray(richTextArray)) {
    return '';
  }
  return richTextArray.map(segment => segment[0]).join('');
};

const DefaultNotionCodeRenderer = dynamic(
  () => import('react-notion-x/build/third-party/code').then(m => m.Code),
  { ssr: false }
);

const CustomCodeRenderer = ({ block, className }) => {
  if (!block || block.type !== 'code') {
    return <DefaultNotionCodeRenderer block={block} className={className} />;
  }

  const codeContent = getTextContent(block.properties?.title);
  const language = getTextContent(block.properties?.language);

  if (language === 'Plain Text' && codeContent && codeContent.startsWith('!include')) {
    try {
      const includeRegex = /^!include\s+(\S+)\s*(\{.*\})?$/;
      const match = codeContent.match(includeRegex);

      if (match) {
        const componentPath = match[1];
        const propsJson = match[2] ? JSON.parse(match[2]) : {};
        const DynamicComponent = CUSTOM_COMPONENTS_MAP[componentPath];

        if (DynamicComponent) {
          return <DynamicComponent {...propsJson} />;
        } else {
          console.error(`Error: Custom component not found for path: ${componentPath}. Please add it to CUSTOM_COMPONENTS_MAP.`);
          return (
            <div className="bg-red-100 text-red-700 p-3 rounded-md my-2 dark:bg-red-900 dark:text-red-200">
              {/* --- 修复：使用单引号或模板字符串 --- */}
              错误：无法加载自定义组件 '{componentPath}'。请检查路径或是否已在代码中注册。
            </div>
          );
        }
      }
    } catch (e) {
      console.error('Error parsing !include block:', e, codeContent);
      return (
        <div className="bg-red-100 text-red-700 p-3 rounded-md my-2 dark:bg-red-900 dark:text-red-200">
          错误：解析自定义组件 `!include` 块时出错。请检查语法。
          <pre className="whitespace-pre-wrap text-sm">{codeContent}</pre>
          <pre className="whitespace-pre-wrap text-sm text-red-500">{e.message}</pre>
        </div>
      );
    }
  }

  return <DefaultNotionCodeRenderer block={block} className={className} />;
};

// ===================================================================================================================
// END: 自定义组件解析逻辑
// ===================================================================================================================

const NotionPage = ({ post, className }) => {
  const POST_DISABLE_GALLERY_CLICK = siteConfig('POST_DISABLE_GALLERY_CLICK')
  const POST_DISABLE_DATABASE_CLICK = siteConfig('POST_DISABLE_DATABASE_CLICK')
  const SPOILER_TEXT_TAG = siteConfig('SPOILER_TEXT_TAG')

  const zoom =
    isBrowser &&
    mediumZoom({
      background: 'rgba(0, 0, 0, 0.2)',
      margin: getMediumZoomMargin()
    })

  const zoomRef = useRef(zoom ? zoom.clone() : null)
  const IMAGE_ZOOM_IN_WIDTH = siteConfig('IMAGE_ZOOM_IN_WIDTH', 1200)

  useEffect(() => {
    autoScrollToHash()
  }, [])

  useEffect(() => {
    if (POST_DISABLE_GALLERY_CLICK) {
      processGalleryImg(zoomRef?.current)
    }
    if (POST_DISABLE_DATABASE_CLICK) {
      processDisableDatabaseUrl()
    }
    const observer = new MutationObserver((mutationsList) => {
      mutationsList.forEach(mutation => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          if (mutation.target.classList.contains('medium-zoom-image--opened')) {
            setTimeout(() => {
              const src = mutation?.target?.getAttribute('src')
              mutation?.target?.setAttribute(
                'src',
                compressImage(src, IMAGE_ZOOM_IN_WIDTH)
              )
            }, 800)
          }
        }
      })
    })
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class']
    })
    return () => {
      observer.disconnect()
    }
  }, [post, POST_DISABLE_DATABASE_CLICK, POST_DISABLE_GALLERY_CLICK, IMAGE_ZOOM_IN_WIDTH]) // 添加了缺失的依赖

  useEffect(() => {
    if (SPOILER_TEXT_TAG) {
      import('lodash/escapeRegExp').then(escapeRegExp => {
        Promise.all([
          loadExternalResource('/js/spoilerText.js', 'js'),
          loadExternalResource('/css/spoiler-text.css', 'css')
        ]).then(() => {
          if (window.textToSpoiler) {
            window.textToSpoiler(escapeRegExp.default(SPOILER_TEXT_TAG))
          }
        })
      })
    }
    const timer = setTimeout(() => {
      const elements = document.querySelectorAll(
        '.notion-collection-page-properties'
      )
      elements?.forEach(element => {
        element?.remove()
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [post, SPOILER_TEXT_TAG]) // 添加了缺失的依赖

  return (
    <div
      id='notion-article'
      className={`mx-auto overflow-hidden ${className || ''}`}>
      <NotionRenderer
        recordMap={post?.blockMap}
        mapPageUrl={mapPageUrl}
        mapImageUrl={mapImgUrl}
        components={{
          Code: CustomCodeRenderer,
          Collection,
          Equation,
          Modal,
          Pdf,
          Tweet
        }}
      />
      <AdEmbed />
      <PrismMac />
    </div>
  )
}

const processDisableDatabaseUrl = () => {
  if (isBrowser) {
    const links = document.querySelectorAll('.notion-table a')
    for (const e of links) {
      e.removeAttribute('href')
    }
  }
}

const processGalleryImg = zoom => {
  setTimeout(() => {
    if (isBrowser) {
      const imgList = document?.querySelectorAll(
        '.notion-collection-card-cover img'
      )
      if (imgList && zoom) {
        for (let i = 0; i < imgList.length; i++) {
          zoom.attach(imgList[i])
        }
      }
      const cards = document.getElementsByClassName('notion-collection-card')
      for (const e of cards) {
        e.removeAttribute('href')
      }
    }
  }, 800)
}

const autoScrollToHash = () => {
  setTimeout(() => {
    if (window.location.hash) {
      const tocNode = document.getElementById(window.location.hash.substring(1))
      if (tocNode && tocNode.className.includes('notion')) {
        tocNode.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }
    }
  }, 180)
}

const mapPageUrl = id => {
  return '/' + id.replace(/-/g, '')
}

function getMediumZoomMargin() {
  const width = window.innerWidth
  if (width < 500) return 8
  if (width < 800) return 20
  if (width < 1280) return 30
  if (width < 1600) return 40
  if (width < 1920) return 48
  return 72
}

const Equation = dynamic(
  () =>
    import('@/components/Equation').then(async m => {
      await import('@/lib/plugins/mhchem')
      return m.Equation
    }),
  { ssr: false }
)

const Pdf = dynamic(() => import('@/components/Pdf').then(m => m.Pdf), {
  ssr: false
})

const PrismMac = dynamic(() => import('@/components/PrismMac'), {
  ssr: false
})

const TweetEmbed = dynamic(() => import('react-tweet-embed'), {
  ssr: false
})

const AdEmbed = dynamic(
  () => import('@/components/GoogleAdsense').then(m => m.AdEmbed),
  { ssr: true }
)

const Collection = dynamic(
  () =>
    import('react-notion-x/build/third-party/collection').then(
      m => m.Collection
    ),
  {
    ssr: true
  }
)

const Modal = dynamic(
  () => import('react-notion-x/build/third-party/modal').then(m => m.Modal),
  { ssr: false }
)

const Tweet = ({ id }) => {
  return <TweetEmbed tweetId={id} />
}

export default NotionPage
