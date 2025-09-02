// /pages/forum.js (最终修复版 - 确保Layout能正确渲染)
import { Layout } from '@/layouts';
import CusdisForum from '@/components/CusdisForum';
import { useGlobal } from '@/lib/global';
import { useRouter } from 'next/router';
import { siteConfig } from '@/lib/config';
import Head from 'next/head';
import { getAllPosts, getPostBlocks } from '@/lib/notion'; // <-- 1. 导入关键函数

// --- 关键修复：使用 getStaticProps 在服务器端获取所有页面都需要的基础数据 ---
export async function getStaticProps() {
  const posts = await getAllPosts({ from: 'forum-page' }); // 获取所有文章
  const aPost = posts[0];
  const post = await getPostBlocks(aPost.id); // 获取一篇文章的blocks，通常用于获取配置

  const siteUrl = siteConfig('LINK') || 'https://your-website.com';
  
  return {
    props: {
      post, // <-- 2. 将post传递给Layout
      posts, // <-- 3. 将posts传递给Layout
      siteUrl,
    },
    revalidate: 1,
  };
}

const ForumPage = (props) => { // <-- 4. 接收所有props
  const { locale } = useGlobal();
  const router = useRouter();

  // 为Cusdis生成唯一的页面ID和URL
  const pageId = router.asPath;
  const pageUrl = props.siteUrl + router.asPath;

  return (
    // vvvvvvv 5. 将所有props传递给Layout vvvvvvv
    <Layout
      title="学生交流区"
      description="一个供学生们发帖和回复的简单论坛"
      {...props} // <-- 关键修复！
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
    </Layout>
    // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  );
};

export default ForumPage;
