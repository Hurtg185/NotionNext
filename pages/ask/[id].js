// pages/ask/[id].js - 问题详情页 (最终修复版)

import { getGlobalData } from '@/lib/db/getSiteData'
import { Layout } from '../../themes' // 1. 使用相对路径，确保能找到 Layout
import { useRouter } from 'next/router'
import Comment from '@/components/Comment'
import { useState, useEffect, useCallback, useRef } from 'react'
import twikoo from 'twikoo'

const AskDetailPage = (props) => {
  const router = useRouter()
  const { id } = router.query
  const [topic, setTopic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const TWIKOO_ENV_ID = props?.NOTION_CONFIG?.COMMENT_TWIKOO_ENV_ID;

  const fetchTopicDetails = useCallback(() => {
    if (!TWIKOO_ENV_ID || !id) {
      if (!TWIKOO_ENV_ID) setError('Twikoo ENV_ID 未配置');
      if (!id) setError('问题ID缺失');
      setLoading(false);
      return;
    }

    setLoading(true);
    twikoo.getComments({ envId: TWIKOO_ENV_ID, urls: [`/ask/${id}`] })
      .then(res => {
        if (res[0].data && res[0].data.length > 0) {
          const mainComment = res[0].data.find(c => c.id === id);
          if(mainComment) {
            setTopic(mainComment);
          } else {
            setError('未找到该问题或已被删除。');
          }
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
    if(router.isReady) {
        fetchTopicDetails();
    }
  }, [router.isReady, fetchTopicDetails]);


  return (
    <Layout {...props}>
      <div className='px-5 pt-10 pb-20'>
        {loading && <div className="text-center dark:text-white">加载中...</div>}
        {error && <div className="text-center text-red-500 mb-8">{error}</div>}

        {!loading && !error && topic && (
          <div className='w-full max-w-4xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md'>
            <div className='mb-6'>
              <h1 className='text-2xl font-bold dark:text-white mb-2 whitespace-pre-wrap'>{topic.comment}</h1>
              <div className='flex items-center text-sm text-gray-500 dark:text-gray-400'>
                <i className='fas fa-user-circle mr-2'></i> {topic.nick}
                <span className='mx-2'>·</span>
                <i className='far fa-clock mr-1'></i> {new Date(topic.time).toLocaleString()}
              </div>
            </div>

            <hr className='border-dashed my-6 dark:border-gray-700' />

            <h3 className='text-xl font-bold dark:text-white mb-4'>所有回复</h3>
            <Comment frontMatter={{
              id: `/ask/${id}`,
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
  const { id } = params;
  const props = await getGlobalData({ from: 'ask-detail-page', locale });
  delete props.allPages;
  delete props.posts;
  delete props.postCount;
  delete props.latestPosts;
  return {
    props: {
      ...props,
      id
    },
    revalidate: parseInt(
      props.NOTION_CONFIG?.POSTS_PAGE_REVALIDATE_SECONDS || '3600'
    ),
  };
}

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  };
}

export default AskDetailPage;
