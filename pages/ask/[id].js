// pages/ask/[id].js - 问题详情页

import { getGlobalData } from '@/lib/db/getSiteData'
import { Layout } from '@/components/Layout'
import { useRouter } from 'next/router'
import { useState, useEffect, useCallback } from 'react'
import twikoo from 'twikoo' // 直接引入 twikoo 库

// Twikoo 的评论组件（手动渲染）
const TwikooCommentComponent = ({ envId, href, url }) => {
    const commentRef = useRef(null);

    useEffect(() => {
        if (commentRef.current && envId) {
            twikoo.init({
                envId: envId,
                el: commentRef.current, // 评论框容器
                href: href,
                url: url
            }).then(() => {
                console.log('Twikoo comment initialized for:', href);
            }).catch(err => {
                console.error('Twikoo initialization failed:', err);
            });
        }
    }, [envId, href, url]);

    return <div id="twikoo-comments-container" ref={commentRef}></div>;
};


const AskDetailPage = (props) => {
  const router = useRouter()
  const { id } = router.query // 获取 URL 中的问题 ID
  const [topic, setTopic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const TWIKOO_ENV_ID = props?.NOTION_CONFIG?.COMMENT_TWIKOO_ENV_ID;

  // 获取当前问题的详情（即该评论及其所有回复）
  const fetchTopicDetails = useCallback(() => {
    if (!TWIKOO_ENV_ID || !id) {
      if (!TWIKOO_ENV_ID) setError('Twikoo ENV_ID 未配置');
      if (!id) setError('问题ID缺失');
      setLoading(false);
      return;
    }

    setLoading(true);
    // 获取该评论及其所有回复
    twikoo.getComment({ envId: TWIKOO_ENV_ID, href: `/ask/${id}` })
      .then(res => {
        // getComment 返回的是一个数组，我们取第一个作为主评论
        if (res.data && res.data.length > 0 && res.data[0].id === id) {
          setTopic(res.data[0]); 
        } else {
          setError('未找到该问题或已被删除。');
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('获取问题详情失败', err);
        setError('获取问题详情失败，请检查 Twikoo 后端配置。');
        setLoading(false);
      });
  }, [TWIKOO_ENV_ID, id]);

  useEffect(() => {
    fetchTopicDetails();
  }, [fetchTopicDetails]);


  return (
    <Layout {...props}>
      <div className='px-5 pt-10 pb-20'>
        {loading && <div className="text-center dark:text-white">加载中...</div>}
        {error && <div className="text-center text-red-500 mb-8">{error}</div>}

        {!loading && !error && topic && (
          <div className='w-full max-w-4xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md'>
            <div className='mb-6'>
              <h1 className='text-2xl font-bold dark:text-white mb-2'>{topic.comment}</h1>
              <div className='flex items-center text-sm text-gray-500 dark:text-gray-400'>
                <i className='fas fa-user-circle mr-2'></i> {topic.nick}
                <span className='mx-2'>·</span>
                <i className='far fa-clock mr-1'></i> {new Date(topic.time).toLocaleString()}
                <span className='mx-2'>·</span>
                <i className='fas fa-reply mr-1'></i> {topic.replies ? topic.replies.length : 0} 回复
              </div>
            </div>

            <hr className='border-dashed my-6 dark:border-gray-700' />

            <h3 className='text-xl font-bold dark:text-white mb-4'>所有回复</h3>
            {/* 嵌入评论组件，用于显示该问题的回复和回复框 */}
            <Comment frontMatter={{
              id: `/ask/${id}`, // 评论ID，确保每个问题详情页的评论区唯一
              title: `提问交流 - ${topic.comment.substring(0, 20)}...`,
              slug: `/ask/${id}`,
              type: 'Page'
            }} />
          </div>
        )}
      </div>
    </Layout>
  )
}

export async function getStaticProps(context) {
  const { locale, params } = context;
  const { id } = params; // 获取路由参数中的 id
  const props = await getGlobalData({ from: 'ask-detail-page', locale });
  // 我们不在这里直接获取 Twikoo 评论，因为它是客户端渲染的
  // 只传递全局数据和 id
  return {
    props: {
      ...props,
      id // 传递 id 到页面组件
    },
    revalidate: parseInt(
      props.NOTION_CONFIG?.POSTS_PAGE_REVALIDATE_SECONDS || '3600'
    ),
  };
}

export async function getStaticPaths() {
  // 在这里，如果你希望预渲染一些最热门的评论主题，
  // 你可以调用 Twikoo API 来获取一些评论的 ID。
  // 但对于新创建的社区，最初可以返回空数组或一些已知ID，
  // 启用 fallback: 'blocking'，让 Next.js 在运行时生成页面。
  return {
    paths: [], // 初始不预渲染任何路径
    fallback: 'blocking', // 或者 true，让 Next.js 在运行时生成页面
  };
}

export default AskDetailPage;
