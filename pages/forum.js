// /pages/forum.js (最终修复版 - 修正所有导入路径，确保Layout能正确渲染)
import { LayoutBase } from '@/themes/heo'; // <-- **关键修正1**：LayoutBase 是从主题的根index.js导出的
import CusdisForum from '@/components/CusdisForum';
import { useGlobal } from '@/lib/global';
import { useRouter } from 'next/router';
import { siteConfig } from '@/lib/config';
import Head from 'next/head';
// --- **关键修正2**：在NotionNext中，获取全局数据的核心函数通常是 getGlobalData ---
import { getGlobalData } from '@/lib/notion'; 

// --- 使用 getStaticProps 在服务器端获取所有页面都需要的基础数据 ---
export async function getStaticProps() {
  const props = await getGlobalData({ from: 'forum-page' });

  // 确保 siteUrl 存在
  const siteUrl = siteConfig('LINK', null, props.NOTION_CONFIG) || props.siteInfo?.link || 'https://www.843075.xyz';

  // 为论坛页面创建一个虚拟的 post 对象，以满足 LayoutBase 的 props 要求
  props.post = {
    id: 'forum-page',
    title: '学生交流区',
    slug: 'forum',
    summary: '一个供学生们发帖和回复的简单论坛',
    type: 'Page',
    fullWidth: true // 如果希望论坛页面是全宽的
  };

  props.siteUrl = siteUrl;

  return {
    props,
    revalidate: 1,
  };
}

const ForumPage = (props) => {
  const router = useRouter();

  // 为Cusdis生成唯一的页面ID和URL
  const pageId = router.asPath;
  const pageUrl = props.siteUrl + router.asPath;
  const pageTitle = "学生交流区";

  return (
    // 将所有props传递给LayoutBase，确保其能正常渲染
    <LayoutBase
      {...props}
      // 覆盖从props中传递的默认meta信息，使用更具体的页面信息
      meta={{
        title: `${pageTitle} | ${props.siteInfo?.title}`,
        description: props.post.summary,
        slug: 'forum',
        type: 'website'
      }}
    >
      <Head>
        {/* Cusdis脚本现在已经在 _app.js 中加载，这里无需重复 */}
      </Head>
      <div className="container mx-auto px-4 py-8">
        {/* CusdisForum 组件现在被包裹在美化样式中 */}
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
