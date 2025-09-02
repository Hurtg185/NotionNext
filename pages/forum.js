// /pages/forum.js (最终修复版 - 修正所有导入路径，确保Layout能正确渲染)
import { LayoutBase } from '@/themes/heo'; // <-- **关键修正1**：LayoutBase通常从主题的index.js中导出
import CusdisForum from '@/components/CusdisForum';
import { useGlobal } from '@/lib/global';
import { useRouter } from 'next/router';
import { siteConfig } from '@/lib/config';
import Head from 'next/head';
import { getGlobalData } from '@/lib/notion'; // <-- **关键修正2**：getGlobalData的正确路径

// --- 使用 getStaticProps 在服务器端获取所有页面都需要的基础数据 ---
export async function getStaticProps() {
  const props = await getGlobalData({ from: 'forum-page' });
  delete props.post; // 论坛页面不需要具体的post数据，删除以避免冲突

  return {
    props: {
      ...props,
      // 论坛页面本身的meta信息
      post: {
        id: 'forum-page',
        title: '学生交流区',
        slug: 'forum',
        summary: '一个供学生们发帖和回复的简单论坛',
        type: 'Page',
        fullWidth: true
      },
      siteUrl: props.siteInfo?.link || siteConfig('LINK')
    },
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
