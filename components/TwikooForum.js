// /components/TwikooForum.js (这是一个新文件，已包含所有逻辑和样式)
import React, { useEffect } from 'react';
import { useGlobal } from '@/lib/global';
import { siteConfig } from '@/lib/config';

const TwikooForum = () => {
  const { isDarkMode } = useGlobal();
  const theme = isDarkMode ? 'dark' : 'light';

  useEffect(() => {
    // 确保在客户端执行
    if (typeof window !== 'undefined' && typeof twikoo !== 'undefined') {
      try {
        twikoo.init({
          envId: siteConfig('COMMENT_TWIKOO_ENV_ID'),
          el: '#twikoo-forum-comment',
          path: location.pathname, // 使用当前路径作为唯一标识
          lang: useGlobal().locale.lang,
          theme: theme
        });
      } catch (e) {
        console.error('Twikoo init failed:', e);
      }
    }
  }, [theme]);

  const twikooEnvId = siteConfig('COMMENT_TWIKOO_ENV_ID');

  if (!twikooEnvId) {
    return (
      <div className="twikoo-forum-wrapper">
        <h2 className="twikoo-forum-title">学生交流区</h2>
        <p className="text-red-500 text-center">错误：Twikoo ENV_ID 未配置！</p>
      </div>
    );
  }

  return (
    <>
      {/* 这部分是专门为论坛页面的Twikoo定制的CSS，它不会影响其他页面的评论区 */}
      <style jsx global>{`
        .twikoo-forum-wrapper {
            max-width: 800px;
            margin: 2rem auto;
            padding: 2rem;
            background-color: var(--bg-white);
            border-radius: 1.5rem;
            box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1);
            border: 1px solid var(--gray-2);
        }
        .dark .twikoo-forum-wrapper {
            background-color: #1E1E1E;
            border-color: #333;
        }
        .twikoo-forum-title {
            text-align: center;
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 0.5rem;
            color: var(--text-color);
        }
        .twikoo-forum-description {
            text-align: center;
            color: var(--gray-5);
            margin-bottom: 2.5rem;
        }
        
        /* 针对ID为 #twikoo-forum-comment 的Twikoo实例进行样式覆盖 */
        #twikoo-forum-comment .tk-input,
        #twikoo-forum-comment .tk-textarea {
            background-color: var(--bg-gray) !important;
            border-radius: 12px !important;
            border: 1px solid var(--gray-3) !important;
            transition: all 0.2s ease-in-out;
        }
        .dark #twikoo-forum-comment .tk-input,
        .dark #twikoo-forum-comment .tk-textarea {
            background-color: #374151 !important;
            border-color: #4b5563 !important;
            color: #e5e7eb !important;
        }
        #twikoo-forum-comment .tk-input:focus,
        #twikoo-forum-comment .tk-textarea:focus {
            border-color: var(--theme-color) !important;
            box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.3) !important;
        }
        #twikoo-forum-comment .tk-submit {
            border-radius: 12px !important;
            background-color: var(--theme-color) !important;
            color: white !important;
            font-weight: bold !important;
            padding: 12px 20px !important;
            transition: all 0.2s ease-in-out;
        }
        #twikoo-forum-comment .tk-submit:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }
        #twikoo-forum-comment .tk-comment {
            margin-top: 1.5rem !important;
            border-radius: 12px !important;
            padding: 1rem 1.25rem !important;
            background-color: transparent !important;
            border: none !important;
            box-shadow: none !important;
            border-top: 1px solid var(--gray-2) !important;
        }
        .dark #twikoo-forum-comment .tk-comment {
            border-top-color: #333 !important;
        }
      `}</style>

      <div className="twikoo-forum-wrapper">
        <h2 className="twikoo-forum-title">学生交流区</h2>
        <p className="twikoo-forum-description">评论名称邮箱随意填，欢迎交流！</p>
        <div id="twikoo-forum-comment"></div>
      </div>
    </>
  );
};

export default TwikooForum;
