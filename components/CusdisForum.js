// /components/CusdisForum.js (这是一个新文件，已为您配置好)
import React, { useEffect, useRef } from 'react';
import { useGlobal } from '@/lib/global';

const CusdisForum = ({ id, url, title }) => {
  const { isDarkMode } = useGlobal();
  const theme = isDarkMode ? 'dark' : 'light';
  const cusdisRef = useRef(null);

  useEffect(() => {
    // 动态更新主题，当用户切换网站的亮/暗模式时，评论区也会同步切换
    const cusdisIframe = cusdisRef.current?.querySelector('iframe.cusdis');
    if (cusdisIframe) {
      cusdisIframe.contentWindow.postMessage({
        type: 'cusdis:theme',
        payload: theme
      }, 'https://cusdis.com');
    }
  }, [theme]);

  return (
    <div className="w-full max-w-4xl mx-auto my-8">
      <h2 className="text-3xl font-bold text-center mb-6 dark:text-white">学生交流区</h2>
      <div
        id="cusdis_thread"
        ref={cusdisRef}
        key={id + theme} // 当ID或主题变化时，强制React重新渲染此组件
        data-host="https://cusdis.com"
        data-app-id="3a58cfa2-a328-4959-920b-06a48df52ea0" // <-- 已为您填好
        data-page-id={id}
        data-page-url={url}
        data-page-title={title}
        data-theme={theme}
      ></div>
    </div>
  );
};

export default CusdisForum;
