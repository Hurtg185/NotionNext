// /pages/forum.js (这是一个新文件，已为您配置好)
import { Layout } from '@/layouts';
import CusdisForum from '@/components/CusdisForum';
import { useGlobal } from '@/lib/global';
import { useRouter } from 'next/router';
import { siteConfig } from '@/lib/config'; // 确保导入siteConfig
import Head from 'next/head';

// --- 新增：使用 getStaticProps 在服务器端获取配置 ---
export async function getStaticProps() {
  const siteUrl = siteConfig('LINK') || 'https://your-website.com'; // 从配置读取，或提供一个备用URL
  return {
    props: {
      siteUrl,
    },
    revalidate: 1,
  };
}

const ForumPage = ({ siteUrl }) => { // 接收从getStaticProps传递来的siteUrl
  const { locale } = useGlobal();
  const router = useRouter();

  // 为Cusdis生成唯一的页面ID和URL
  const pageId = router.asPath;
  const pageUrl = siteUrl + router.asPath;

  return (
    <Layout
      title="学生交流区"
      description="一个供学生们发帖和回复的简单论坛"
    >
      <Head>
        {/* 将Cusdis脚本放在Head中，并使用defer确保在页面渲染后加载 */}
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
  );
};

export default ForumPage;
