// /components/NotionPage.js

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

// 定义一个映射表，用于存储可以动态加载的自定义组件
// 这里的键（key）必须与你在 Notion 中 !include 语句中使用的路径完全一致（例如 '/components/ComponentName.js'）。
// 值为 dynamic(() => import('@/components/ComponentName')) 这种形式，它会使用你的路径别名来正确导入组件。
const CUSTOM_COMPONENTS_MAP = {
  // === 我们目前已开发的交互式题目组件 ===
  '/components/XuanZeTi.js': dynamic(() => import('@/components/XuanZeTi'), { ssr: false }),
  '/components/PaiXuTi.js': dynamic(() => import('@/components/PaiXuTi'), { ssr: false }),
  '/components/ExternalTextToSpeech.js': dynamic(() => import('@/components/ExternalTextToSpeech'), { ssr: false }),
  '/components/AiChatAssistant.js': dynamic(() => import('@/components/AiChatAssistant'), { ssr: false }),
  '/components/PinyinHanziQuiz.js': dynamic(() => import('@/components/PinyinHanziQuiz'), { ssr: false }),
  '/components/LianXianTi.js': dynamic(() => import('@/components/LianXianTi'), { ssr: false }),
  '/components/AiCorrector.js': dynamic(() => import('@/components/AiCorrector'), { ssr: false }),
  '/components/PronunciationChecker.js': dynamic(() => import('@/components/PronunciationChecker'), { ssr: false }),
  '/components/JumpToCardModal.js': dynamic(() => import('@/components/JumpToCardModal'), { ssr: false }),
  '/components/BeiDanCi.js': dynamic(() => import('@/components/BeiDanCi'), { ssr: false }), // 背单词组件
  // ======================================
  
  // === 如果你原有项目中有其他自定义组件，并且你需要它们，请在这里手动添加 ===
  // 例如：
  // '/components/MultipleChoiceQuestion.js': dynamic(() => import('@/components/MultipleChoiceQuestion'), { ssr: false }),
  // '/components/PinyinInputExercise.js': dynamic(() => import('@/components/PinyinInputExercise'), { ssr: false }),
  // '/components/Flashcard.js': dynamic(() => import('@/components/Flashcard'), { ssr: false }),
  // '/components/AudioComprehension.js': dynamic(() => import('@/components/AudioComprehension'), { ssr: false }),
  // ==========================================================================
};

/**
 * 辅助函数：从Notion富文本数组中提取纯文本内容
 * Notion API 的富文本通常是 [[text, style], [text, style]] 这样的结构
 */
const getTextContent = (richTextArray) => {
  if (!richTextArray || !Array.isArray(richTextArray)) {
    return '';
  }
  // 遍历所有文本片段并拼接
  return richTextArray.map(segment => segment[0]).join('');
};

// 重要的修改：将 react-notion-x 默认的 Code 组件的动态导入移到 CustomCodeRenderer 外部
// 这样可以避免在渲染函数内部重复调用 dynamic，解决潜在的编译和运行时问题。
const DefaultNotionCodeRenderer = dynamic(
  () => import('react-notion-x/build/third-party/code').then(m => m.Code),
  { ssr: false }
);

// 创建一个自定义的 Code 块渲染器
const CustomCodeRenderer = ({ block, className }) => {
  // 确保 block 和其属性存在，并且是 Code 块类型
  if (!block || block.type !== 'code') {
    return <DefaultNotionCodeRenderer block={block} className={className} />;
  }

  // 使用 getTextContent 辅助函数提取内容和语言
  const codeContent = getTextContent(block.properties?.title); // 获取代码块内容
  const language = getTextContent(block.properties?.language); // 获取代码块语言

  // 检查是否是 'Plain Text' 语言的代码块，并且内容以 '!include' 开头
  if (language === 'Plain Text' && codeContent && codeContent.startsWith('!include')) {
    try {
      // 解析 !include 语句
      const includeRegex = /^!include\s+(\S+)\s*(\{.*\})?$/;
      const match = codeContent.match(includeRegex);

      if (match) {
        const componentPath = match[1]; // 提取组件路径，例如 /components/XuanZeTi.js
        const propsJson = match[2] ? JSON.parse(match[2]) : {}; // 提取 JSON 格式的 props

        const DynamicComponent = CUSTOM_COMPONENTS_MAP[componentPath];

        if (DynamicComponent) {
          return <DynamicComponent {...propsJson} />;
        } else {
          console.error(`Error: Custom component not found for path: ${componentPath}. Please add it to CUSTOM_COMPONENTS_MAP.`);
          return (
            <div className="bg-red-100 text-red-700 p-3 rounded-md my-2 dark:bg-red-900 dark:text-red-200">
              错误：无法加载自定义组件 "{componentPath}"。请检查路径或是否已在代码中注册。
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

  // 如果不是 !include 块，就用 react-notion-x 默认的 Code 组件渲染
  return <DefaultNotionCodeRenderer block={block} className={className} />;
};

// ===================================================================================================================
// END: 自定义组件解析逻辑
// ===================================================================================================================


/**
 * 整个站点的核心组件
 * 将Notion数据渲染成网页
 * @param {*} param0
 * @returns
 */
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

    const observer = new MutationObserver((mutationsList, observer) => {
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
  }, [post])

  useEffect(() => {
    if (SPOILER_TEXT_TAG) {
      import('lodash/escapeRegExp').then(escapeRegExp => {
        Promise.all([
          loadExternalResource('/js/spoilerText.js', 'js'),
          loadExternalResource('/css/spoiler-text.css', 'css')
        ]).then(() => {
          window.textToSpoiler &&
            window.textToSpoiler(escapeRegExp.default(SPOILER_TEXT_TAG))
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
  }, [post])

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

/**
 * 页面的数据库链接禁止跳转，只能查看
 */
const processDisableDatabaseUrl = () => {
  if (isBrowser) {
    const links = document.querySelectorAll('.notion-table a')
    for (const e of links) {
      e.removeAttribute('href')
    }
  }
}

/**
 * gallery视图，点击后是放大图片还是跳转到gallery的内部页面
 */
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

/**
 * 根据url参数自动滚动到锚位置
 */
const autoScrollToHash = () => {
  setTimeout(() => {
    const hash = window?.location?.hash
    const needToJumpToTitle = hash && hash.length > 0
    if (needToJumpToTitle) {
      console.log('jump to hash', hash)
      const tocNode = document.getElementById(hash.substring(1))
      if (tocNode && tocNode?.className?.indexOf('notion') > -1) {
        tocNode.scrollIntoView({ block: 'start', behavior: 'smooth' })
      }
    }
  }, 180)
}

/**
 * 将id映射成博文内部链接。
 * @param {*} id
 * @returns
 */
const mapPageUrl = id => {
  return '/' + id.replace(/-/g, '')
}

/**
 * 缩放
 * @returns
 */
function getMediumZoomMargin() {
  const width = window.innerWidth

  if (width < 500) {
    return 8
  } else if (width < 800) {
    return 20
  } else if (width < 1280) {
    return 30
  } else if (width < 1600) {
    return 40
  } else if (width < 1920) {
    return 48
  } else {
    return 72
  }
}

// ===================================================================================================================
// START: 原始的动态导入 (部分已不再直接使用，但仍保留导入供其他组件使用)
// ===================================================================================================================

// 公式
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

// ===================================================================================================================
// END: 原始的动态导入
// ===================================================================================================================


export default NotionPage
