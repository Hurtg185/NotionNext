// /pages/forum.js (最终修复版 - 使用Twikoo评论组件，确保Layout能正确渲染)
import { LayoutBase } from '@/themes/heo';
import TwikooForum from '@/components/TwikooForum'; // <-- 导入我们新的 TwikooForum 组件
import { useGlobal } from '@/lib/global';
import { useRouter } from 'next/router';
import { siteConfig } from '@/lib/config';
import Head from 'next/head';
import { getGlobalData } from '@/lib/notion';

// --- 关键修复：使用 getStaticProps 在服务器端获取所有页面都需要的基础数据 ---
export async function getStaticProps() {
  const props = await getGlobalData({ from: 'forum-page' });
  delete props.post; // 论坛页面不需要具体的post数据

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
      }
    },
    revalidate: 1,
  };
}

const ForumPage = (props) => {
  const router = useRouter();

  // 为评论系统生成唯一的页面ID
  const pageId = router.asPath;
  const pageTitle = "学生交流区";

  // 构建评论组件需要的frontMatter对象
  const commentFrontMatter = {
    ...props.post,
    id: pageId,
    title: pageTitle,
  };

  return (
    <LayoutBase {...props} title={pageTitle} description={props.post.summary}>
      <Head>
        {/* Twikoo脚本通常在<Comment>组件或全局加载，这里无需重复 */}
      </Head>
      <div className="container mx-auto px-4 py-8">
        {/* 这里渲染我们全新的、美化过的TwikooForum组件 */}
        <TwikooForum frontMatter={commentFrontMatter} />
      </div>
    </LayoutBase>
  );
};

export default ForumPage;
