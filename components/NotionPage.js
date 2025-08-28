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
const CUSTOM_COMPONENTS_MAP = {
  '/components/MultipleChoiceQuestion.js': dynamic(() => import('@/components/MultipleChoiceQuestion'), { ssr: false }),
  '/components/PinyinInputExercise.js': dynamic(() => import('@/components/PinyinInputExercise'), { ssr: false }),
  '/components/Flashcard.js': dynamic(() => import('@/components/Flashcard'), { ssr: false }),
  '/components/AudioComprehension.js': dynamic(() => import('@/components/AudioComprehension'), { ssr: false }),
  // ... 其他自定义组件也在这里添加
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


// 创建一个自定义的 Code 块渲染器
const CustomCodeRenderer = ({ block, className }) => {
  // --- 关键调试日志：查看接收到的整个 block 对象 ---
  // console.log('--- CustomCodeRenderer DEBUG START ---'); // 减少日志量，只在关键处打印
  // console.log('Received block:', JSON.stringify(block, null, 2)); 

  // 确保 block 和其属性存在，并且是 Code 块类型
  if (!block || block.type !== 'code') {
    // console.log('Block is not a code block or is undefined/null. Falling back to default.');
    const DefaultCode = dynamic(
      () => import('react-notion-x/build/third-party/code').then(m => m.Code),
      { ssr: false }
    );
    // console.log('--- CustomCodeRenderer DEBUG END (Not code block) ---');
    return <DefaultCode block={block} className={className} />;
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
  const DefaultCode = dynamic(
    () => import('react-notion-x/build/third-party/code').then(m => m.Code),
    { ssr: false }
  );
  console.log('--- CustomCodeRenderer DEBUG END (Default Code block rendered) ---');
  return <DefaultCode block={block} className={className} />;
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
  // ... (其余代码保持不变，与你提供的版本一致)

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

// ... (其余辅助函数和动态导入保持不变)

export default NotionPage
