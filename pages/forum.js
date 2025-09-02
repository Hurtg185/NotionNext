// /pages/forum.js (最终修复版 - 确保Layout能正确渲染)
import { LayoutBase } from '@/themes/heo/LayoutBase'; // <-- 修正导入路径
import CusdisForum from '@/components/CusdisForum';
import { useGlobal } from '@/lib/global';
import { useRouter } from 'next/router';
import { siteConfig } from '@/lib/config';
import Head from 'next/head';
import { getAllPosts, getGlobalData } from '@/lib/notion/getAllNotionPosts'; // <-- 修正导入路径

// --- 关键修复：使用 getStaticProps 在服务器端获取所有页面都需要的基础数据 ---
export async function getStaticProps() {
  const { allPosts, allPages, siteInfo, categories, tags, postCount } = await getGlobalData({ from: 'forum-page' }); // <-- 使用getGlobalData获取通用数据

  const siteUrl = siteConfig('LINK') || 'https://your-website.com';
  
  return {
    props: {
      allPosts,
      allPages,
      siteInfo,
      categories,
      tags,
      postCount,
      siteUrl, // 传递 siteUrl
      // NotionNext的LayoutBase通常需要一个post对象，我们可以传递一个空的或者代表当前页面的对象
      post: {
        id: 'forum-page',
        title: '学生交流区',
        slug: 'forum',
        summary: '一个供学生们发帖和回复的简单论坛',
        type: 'Page',
        fullWidth: true // 如果希望论坛页面是全宽的
      },
      NOTION_CONFIG: await getGlobalData({ from: 'server' }).then(res => res.NOTION_CONFIG),
      THEME_CONFIG: await getGlobalData({ from: 'server' }).then(res => res.THEME_CONFIG)
    },
    revalidate: 1,
  };
}

// 注意：Layout组件在Next.js项目中通常是页面共享的结构。
// 根据您的代码结构，通常是 `LayoutBase` 或者您的主题提供的 `Layout`
// 这里我们使用 `LayoutBase`，因为它在您的 `themes/heo/index.js` 中是可见的。
const ForumPage = (props) => { // 接收所有从getStaticProps传递来的props
  const { locale } = useGlobal();
  const router = useRouter();

  // 为Cusdis生成唯一的页面ID和URL
  const pageId = router.asPath;
  const pageUrl = props.siteUrl + router.asPath; // 使用从props接收到的siteUrl

  return (
    // 将所有props传递给LayoutBase
    <LayoutBase
      {...props} // <-- 关键修复！将所有从getStaticProps获取的props传递给LayoutBase
      title="学生交流区" // 传递标题
      description="一个供学生们发帖和回复的简单论坛" // 传递描述
    >
      <Head>
        <script defer src="https://cusdis.com/js/cusdis.es.js"></script>
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
