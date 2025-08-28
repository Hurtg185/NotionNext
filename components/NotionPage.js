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
// START: 自定义组件解析逻辑 (新增和修改部分)
// ===================================================================================================================

// 定义一个映射表，用于存储可以动态加载的自定义组件
// 这里的路径是相对于项目根目录的，例如 '@/components/MultipleChoiceQuestion'
// 请确保这些组件文件确实存在于你指定的路径
const CUSTOM_COMPONENTS_MAP = {
  '/components/MultipleChoiceQuestion.js': dynamic(() => import('@/components/MultipleChoiceQuestion'), { ssr: false }),
  '/components/PinyinInputExercise.js': dynamic(() => import('@/components/PinyinInputExercise'), { ssr: false }),
  '/components/Flashcard.js': dynamic(() => import('@/components/Flashcard'), { ssr: false }),
  '/components/AudioComprehension.js': dynamic(() => import('@/components/AudioComprehension'), { ssr: false }),
  // ... 如果你创建了其他自定义组件，也在这里添加它们的映射
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
  // --- 关键调试日志：查看接收到的整个 block 对象 ---
  console.log('--- CustomCodeRenderer DEBUG START ---');
  if (block) {
      console.log('  Block Type:', block.type);
      console.log('  Block Properties (partial):', JSON.stringify(block.properties, null, 2)); // 只打印 properties
  } else {
      console.log('  Block is undefined/null.');
  }
  // --- 调试日志结束 ---

  // 确保 block 和其属性存在，并且是 Code 块类型
  if (!block || block.type !== 'code') {
    console.log('  Block is not a code block or is undefined/null. Falling back to default.');
    console.log('--- CustomCodeRenderer DEBUG END (Not code block) ---');
    return <DefaultNotionCodeRenderer block={block} className={className} />; // 使用外部定义的 DefaultNotionCodeRenderer
  }

  // --- 关键修改：使用 getTextContent 辅助函数提取内容和语言 ---
  const codeContent = getTextContent(block.properties?.title); // 获取代码块内容
  const language = getTextContent(block.properties?.language); // 获取代码块语言

  // --- 关键调试日志：查看提取到的内容和语言 ---
  console.log('  Extracted Code Block Content:', codeContent);
  console.log('  Extracted Code Block Language:', language);
  // 修改匹配的语言为 "Plain Text"
  console.log('  Is language "Plain Text" and content starts with "!include"? ', language === 'Plain Text' && codeContent && codeContent.startsWith('!include'));

  // 检查是否是 'Plain Text' 语言的代码块，并且内容以 '!include' 开头
  if (language === 'Plain Text' && codeContent && codeContent.startsWith('!include')) { // <-- 关键修改：匹配 "Plain Text"
    try {
      // 解析 !include 语句
      const includeRegex = /^!include\s+(\S+)\s*(\{.*\})?$/;
      const match = codeContent.match(includeRegex);

      if (match) {
        const componentPath = match[1];
        const propsJson = match[2] ? JSON.parse(match[2]) : {};

        console.log('  Matched !include. Path:', componentPath, 'Props:', propsJson);

        const DynamicComponent = CUSTOM_COMPONENTS_MAP[componentPath];

        if (DynamicComponent) {
          console.log('  Found DynamicComponent for path:', componentPath);
          console.log('--- CustomCodeRenderer DEBUG END (Component rendered) ---');
          return <DynamicComponent {...propsJson} />;
        } else {
          console.error(`Error: Custom component not found for path: ${componentPath}. Please add it to CUSTOM_COMPONENTS_MAP.`);
          console.log('--- CustomCodeRenderer DEBUG END (Component not found) ---');
          return (
            <div className="bg-red-100 text-red-700 p-3 rounded-md my-2 dark:bg-red-900 dark:text-red-200">
              错误：无法加载自定义组件 "{componentPath}"。请检查路径或是否已在代码中注册。
            </div>
          );
        }
      } else {
        console.log('  Code block is "Plain Text" but does not match !include regex.');
      }
    } catch (e) {
      console.error('Error parsing !include block:', e, codeContent);
      console.log('--- CustomCodeRenderer DEBUG END (Parse error) ---');
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
  console.log('--- CustomCodeRenderer DEBUG END (Default Code block rendered) ---');
  return <DefaultNotionCodeRenderer block={block} className={className} />; // 使用外部定义的 DefaultNotionCodeRenderer
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
  // 是否关闭数据库和画册的点击跳转
  const POST_DISABLE_GALLERY_CLICK = siteConfig('POST_DISABLE_GALLERY_CLICK')
  const POST_DISABLE_DATABASE_CLICK = siteConfig('POST_DISABLE_DATABASE_CLICK')
  const SPOILER_TEXT_TAG = siteConfig('SPOILER_TEXT_TAG')

  const zoom =
    isBrowser &&
    mediumZoom({
      //   container: '.notion-viewport',
      background: 'rgba(0, 0, 0, 0.2)',
      margin: getMediumZoomMargin()
    })

  const zoomRef = useRef(zoom ? zoom.clone() : null)
  const IMAGE_ZOOM_IN_WIDTH = siteConfig('IMAGE_ZOOM_IN_WIDTH', 1200)
  // 页面首次打开时执行的勾子
  useEffect(() => {
    // 检测当前的url并自动滚动到对应目标
    autoScrollToHash()
  }, [])

  // 页面文章发生变化时会执行的勾子
  useEffect(() => {
    // 相册视图点击禁止跳转，只能放大查看图片
    if (POST_DISABLE_GALLERY_CLICK) {
      // 针对页面中的gallery视图，点击后是放大图片还是跳转到gallery的内部页面
      processGalleryImg(zoomRef?.current)
    }

    // 页内数据库点击禁止跳转，只能查看
    if (POST_DISABLE_DATABASE_CLICK) {
      processDisableDatabaseUrl()
    }

    /**
     * 放大查看图片时替换成高清图像
     */
    const observer = new MutationObserver((mutationsList, observer) => {
      mutationsList.forEach(mutation => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          if (mutation.target.classList.contains('medium-zoom-image--opened')) {
            // 等待动画完成后替换为更高清的图像
            setTimeout(() => {
              // 获取该元素的 src 属性
              const src = mutation?.target?.getAttribute('src')
              //   替换为更高清的图像
              mutation?.target?.setAttribute(
                'src',
                compressImage(src, IMAGE_ZOOM_IN_WIDTH)
              )
            }, 800)
          }
        }
      })
    })

    // 监视页面元素和属性变化
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
    // Spoiler文本功能
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

    // 查找所有具有 'notion-collection-page-properties' 类的元素,删除notion自带的页面properties
    const timer = setTimeout(() => {
      // 查找所有具有 'notion-collection-page-properties' 类的元素
      const elements = document.querySelectorAll(
        '.notion-collection-page-properties'
      )

      // 遍历这些元素并将其从 DOM 中移除
      elements?.forEach(element => {
        element?.remove()
      })
    }, 1000) // 1000 毫秒 = 1 秒

    // 清理定时器，防止组件卸载时执行
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
          Code: CustomCodeRenderer, // <-- 关键修改：使用你的 CustomCodeRenderer
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
    // 跳转到指定标题
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
  // return 'https://www.notion.so/' + id.replace(/-/g, '')
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

// 注意：原始的 Code 动态导入已被移除，因为 CustomCodeRenderer 会动态导入 react-notion-x 的 Code 组件。

// 公式
const Equation = dynamic(
  () =>
    import('@/components/Equation').then(async m => {
      // 化学方程式
      await import('@/lib/plugins/mhchem')
      return m.Equation
    }),
  { ssr: false }
)

// 原版文档
// const Pdf = dynamic(
//   () => import('react-notion-x/build/third-party/pdf').then(m => m.Pdf),
//   {
//     ssr: false
//   }
// )
const Pdf = dynamic(() => import('@/components/Pdf').then(m => m.Pdf), {
  ssr: false
})

// 美化代码 from: https://github.com/txs
const PrismMac = dynamic(() => import('@/components/PrismMac'), {
  ssr: false
})

/**
 * tweet嵌入
 */
const TweetEmbed = dynamic(() => import('react-tweet-embed'), {
  ssr: false
})

/**
 * 文内google广告
 */
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
