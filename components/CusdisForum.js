// /components/CusdisForum.js (最终美化版 - 集成Cusdis评论)
import React, { useEffect, useRef } from 'react';
import { useGlobal } from '@/lib/global';

const CusdisForum = ({ id, url, title }) => {
  const { isDarkMode } = useGlobal();
  const theme = isDarkMode ? 'dark' : 'light'; // 根据网站主题设置Cusdis主题
  const cusdisRef = useRef(null);

  useEffect(() => {
    // 动态更新主题，当用户切换网站的亮/暗模式时，评论区也会同步切换
    // Cusdis的iframe加载后，可以通过postMessage来更新主题
    const cusdisIframe = cusdisRef.current?.querySelector('iframe.cusdis');
    if (cusdisIframe) {
      cusdisIframe.contentWindow.postMessage({
        type: 'cusdis:theme',
        payload: theme
      }, 'https://cusdis.com'); // 确保目标源正确
    }
  }, [theme]);

  return (
    <div className="w-full max-w-4xl mx-auto my-8 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700"> {/* 极致美化：更大的圆角，更强的阴影，更精致的边框 */}
      <h2 className="text-3xl font-bold text-center mb-6 dark:text-white">学生交流区</h2>
      <p className="text-gray-600 dark:text-gray-300 text-center mb-6">评论名称邮箱随意填，欢迎交流！</p> {/* 友好提示 */}
      <div
        id="cusdis_thread"
        ref={cusdisRef}
        key={id + theme} // 当ID或主题变化时，强制React重新渲染此div
        data-host="https://cusdis.com"
        data-app-id="3a58cfa2-a328-4959-920b-06a48df52ea0" // <-- 您的 Cusdis APP ID
        data-page-id={id}
        data-page-url={url}
        data-page-title={title}
        data-theme={theme}
        style={{ minHeight: '300px' }} // 给评论区一个最小高度
      ></div>
    </div>
  );
};

export default CusdisForum;
