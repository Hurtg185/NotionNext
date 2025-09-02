// /pages/forum.js (最终修复版 - 确保Layout和数据能正确导入和渲染)
import { LayoutBase } from '@/themes/heo/index'; // <-- **关键修正1**：LayoutBase通常从主题的index文件导出
import CusdisForum from '@/components/CusdisForum';
import { useGlobal } from '@/lib/global';
import { useRouter } from 'next/router';
import { siteConfig } from '@/lib/config';
import Head from 'next/head';
// 假设您的getGlobalData是这样导入的，如果不是，请根据您的项目结构调整
import { getGlobalData } from '@/lib/notion/getAllNotionPosts'; // <-- **关键修正2**：确认getGlobalData的路径

// --- 使用 getStaticProps 在服务器端获取所有页面都需要的基础数据 ---
export async function getStaticProps() {
  const { allPosts, allPages, siteInfo, categories, tags, postCount, NOTION_CONFIG, THEME_CONFIG } = await getGlobalData({ from: 'forum-page' });

  const siteUrl = siteConfig('LINK', 'https://your-website.com', NOTION_CONFIG || THEME_CONFIG);

  return {
    props: {
      allPosts,
      allPages,
      siteInfo,
      categories,
      tags,
      postCount,
      siteUrl,
      // 论坛页面本身的meta信息
      post: {
        id: 'forum-page',
        title: '学生交流区',
        slug: 'forum',
        summary: '一个供学生们发帖和回复的简单论坛',
        type: 'Page',
        fullWidth: true
      },
      NOTION_CONFIG,
      THEME_CONFIG
    },
    revalidate: 1,
  };
}

const ForumPage = (props) => {
  const { locale } = useGlobal();
  const router = useRouter();

  const pageId = router.asPath;
  const pageUrl = props.siteUrl + router.asPath;

  return (
    <LayoutBase
      {...props}
      title="学生交流区"
      description="一个供学生们发帖和回复的简单论坛"
    >
      <Head>
        {/* Cusdis脚本现在已经在 _app.js 中加载，这里可以移除，避免重复 */}
        {/* <script defer src="https://cusdis.com/js/cusdis.es.js"></script> */}
      </Head>
      <div className="container mx-auto px-4 py-8">
        <CusdisForum
          id={pageId}
          url={pageUrl}
          title="学生交流区"
        />
      </div>
    </LayoutBase>
  );
};

export default ForumPage;
