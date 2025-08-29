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
const CUSTOM_COMPONENTS_MAP = {
  // === 暂时只保留我们目前已开发的交互式题目组件，以解决编译错误 ===
  '/components/XuanZeTi.js': dynamic(() => import('@/components/XuanZeTi'), { ssr: false }),
  '/components/PaiXuTi.js': dynamic(() => import('@/components/PaiXuTi'), { ssr: false }),
  '/components/BeiDanCi.js': dynamic(() => import('@/components/BeiDanCi'), { ssr: false }), 
  // ===================================================================================================================
  
  // === 所有其他你原有项目中的自定义组件，暂时全部禁用 ===
  // 如果你需要使用它们，请逐一取消注释，并在取消注释前，确保该文件本身没有编译错误，
  // 并且该文件内部没有导入任何不存在的模块 (例如 MultipleChoiceQuestion)。
  // ===================================================================================================================
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
        const propsJsonString = match[2];

        let propsJson = {};
        if (propsJsonString) {
          try {
            propsJson = JSON.parse(propsJsonString);
          } catch (jsonError) {
            console.error('Error parsing JSON for custom component:', jsonError, propsJsonString);
            return (
              <div className="bg-red-100 text-red-700 p-3 rounded-md my-2 dark:bg-red-900 dark:text-red-200">
                错误：自定义组件的参数 (JSON) 解析失败。请检查 Notion 代码块中的 JSON 语法。
                <pre className="whitespace-pre-wrap text-sm mt-2">{propsJsonString}</pre>
                <pre className="whitespace-pre-wrap text-sm text-red-500 mt-1">错误信息: {jsonError.message}</pre>
              </div>
            );
          }
        }
        
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
      console.error('Error processing !include block:', e, codeContent);
      return (
        <div className="bg-red-100 text-red-700 p-3 rounded-md my-2 dark:bg-red-900 dark:text-red-200">
          错误：处理自定义组件 `!include` 块时出错。
          <pre className="whitespace-pre-wrap text-sm mt-2">{codeContent}</pre>
          <pre className="whitespace-pre-wrap text-sm text-red-500 mt-1">错误信息: {e.message}</pre>
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
    }
