// /components/TwikooForum.js (这是一个新文件，或者替换旧文件)
import React, { useEffect } from 'react';
import { useGlobal } from '@/lib/global';
import { siteConfig } from '@/lib/config';
import styles from './TwikooForum.module.css'; // 我们将创建一个CSS模块来美化

const TwikooForum = ({ frontMatter }) => {
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
      <div className={styles.twikooWrapper}>
        <h2 className={styles.title}>学生交流区</h2>
        <p className="text-red-500 text-center">错误：Twikoo ENV_ID 未配置！</p>
      </div>
    );
  }

  return (
    <div className={styles.twikooWrapper}>
      <h2 className={styles.title}>学生交流区</h2>
      <p className={styles.description}>评论名称邮箱随意填，欢迎交流！</p>
      <div id="twikoo-forum-comment" className={styles.twikooContainer}></div>
    </div>
  );
};

export default TwikooForum;
