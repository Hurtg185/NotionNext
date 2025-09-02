// /pages/forum.js (最终修复版 - 使用Cusdis评论组件，确保Layout能正确渲染，并在当前页面加载Cusdis脚本)
import { LayoutBase } from '@/themes/heo'; // 修正导入LayoutBase的路径，它通常从主题的index.js中导出
import CusdisForum from '@/components/CusdisForum'; // 导入CusdisForum组件
import { useGlobal } from '@/lib/global'; // 导入useGlobal
import { useRouter } from 'next/router'; // 导入useRouter
import { siteConfig } from '@/lib/config'; // 导入siteConfig
import Head from 'next/head'; // 导入Head

// --- 使用 getStaticProps 在服务器端获取所有页面都需要的基础数据 ---
export async function getStaticProps() {
  // 修正导入路径：getGlobalData通常位于 @/lib/notion/getAllNotionPosts 或 @/lib/notion/getNotionData 
  // 如果您的项目中是其他路径，请根据实际情况进行调整。
  // 这里假设使用 @/lib/notion/getAllNotionPosts 中的 getGlobalData
  const { allPosts, allPages, siteInfo, categories, tags, NOTION_CONFIG, THEME_CONFIG } = await (await import('@/lib/notion/getAllNotionPosts')).getGlobalData();

  const siteUrl = siteConfig('LINK', 'https://your-website.com', NOTION_CONFIG || THEME_CONFIG);

  return {
    props: {
      allPosts,
      allPages,
      siteInfo,
      categories,
      tags,
      // 论坛页面本身的meta信息
      post: { // 使用post，而不是frontMatter，以兼容LayoutBase的prop要求
        id: 'forum-page',
        title: '学生交流区',
        slug: 'forum',
        summary: '一个供学生们发帖和回复的简单论坛',
        type: 'Page',
        fullWidth: true // 如果希望论坛页面是全宽的
      },
      NOTION_CONFIG, // 传递配置，确保前端siteConfig能读取
      THEME_CONFIG, // 传递主题配置
      siteUrl // 传递 siteUrl
    },
    revalidate: 1, // 每隔1秒重新生成一次页面，确保数据最新（根据需求调整）
  };
}

const ForumPage = (props) => { // 接收所有从getStaticProps传递来的props
  const { locale } = useGlobal();
  const router = useRouter();

  // 为Cusdis生成唯一的页面ID和URL
  const pageId = router.asPath;
  const pageUrl = props.siteUrl + router.asPath;
  const pageTitle = "学生交流区";

  return (
    // 将所有props传递给LayoutBase，确保其能正常渲染
    <LayoutBase
      {...props}
      // LayoutBase可能需要单独的title和description prop来设置页面<title>和<meta description>
      title={pageTitle}
      description={props.post.summary} // 使用props.post.summary作为描述
    >
      <Head>
        {/* Cusdis脚本现在直接在这里加载，只在ForumPage页面生效 */}
        <script defer src="https://cusdis.com/js/cusdis.es.js"></script>
      </Head>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-extrabold dark:text-gray-200 mb-8 text-center">{pageTitle}</h1>
        
        {/* 这里渲染您的Cusdis评论组件 */}
        <CusdisForum
          id={pageId}
          url={pageUrl}
          title={pageTitle}
        />
      </div>
    </LayoutBase>
  );
};

export default ForumPage;
