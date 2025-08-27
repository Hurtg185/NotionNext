// pages/ask.js - 提问交流区列表页 (最终修复版)

import { getGlobalData } from '@/lib/db/getSiteData'
import { Layout } from '@/themes' // <-- 使用 @/themes 别名路径
import { useState, useEffect, useCallback } from 'react'
import twikoo from 'twikoo'
import SmartLink from '@/components/SmartLink'

// --- 提问弹窗组件 ---
const AskModal = ({ isOpen, onClose, onSubmit, askForm, setAskForm }) => {
  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4' onClick={onClose}>
      <div className='bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-sm w-full mx-auto animate-modal-pop' onClick={(e) => e.stopPropagation()}>
        <h3 className='text-xl font-bold mb-4 dark:text-gray-100'>发布我的问题</h3>
        <div className='space-y-4'>
          <input
            type='text'
            placeholder='你的昵称 (必填)'
            value={askForm.nick}
            onChange={(e) => setAskForm({ ...askForm, nick: e.target.value })}
            className='w-full p-2 border rounded dark:bg-gray-700 dark:text-white'
          />
          <input
            type='email'
            placeholder='你的邮箱 (可选，用于接收回复通知)'
            value={askForm.mail}
            onChange={(e) => setAskForm({ ...askForm, mail: e.target.value })}
            className='w-full p-2 border rounded dark:bg-gray-700 dark:text-white'
          />
          <input
            type='url'
            placeholder='你的个人网站 (可选)'
            value={askForm.link}
            onChange={(e) => setAskForm({ ...askForm, link: e.target.value })}
            className='w-full p-2 border rounded dark:bg-gray-700 dark:text-white'
          />
          <textarea
            placeholder='你的问题内容 (必填)'
            value={askForm.comment}
            onChange={(e) => setAskForm({ ...askForm, comment: e.target.value })}
            rows='5'
            className='w-full p-2 border rounded dark:bg-gray-700 dark:text-white'
          ></textarea>
        </div>
        <div className='flex justify-end space-x-2 mt-6'>
          <button
            onClick={onClose}
            className='px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors'>
            取消
          </button>
          <button
            onClick={onSubmit}
            className='px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors'>
            提交问题
          </button>
        </div>
      </div>
    </div>
  );
};

const AskPage = (props) => {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAskModal, setShowAskModal] = useState(false)
  const [askForm, setAskForm] = useState({ nick: '', mail: '', link: '', comment: '' })

  const TWIKOO_ENV_ID = props?.NOTION_CONFIG?.COMMENT_TWIKOO_ENV_ID;

  const fetchTopics = useCallback(() => {
    if (!TWIKOO_ENV_ID) {
      setError('Twikoo ENV_ID 未配置，请检查 blog.config.js');
      setLoading(false);
      return;
    }

    setLoading(true);
    twikoo.getRecentComments({ envId: TWIKOO_ENV_ID, includeReply: false, pageSize: 20 })
      .then(res => {
        const mainComments = res.data.filter(item => !item.replyId);
        setTopics(mainComments);
        setLoading(false);
      })
      .catch(err => {
        console.error('获取提问列表失败', err);
        setError('获取提问列表失败，请检查 Twikoo 后端配置。');
        setLoading(false);
      });
  }, [TWIKOO_ENV_ID]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const handleSubmitAsk = async () => {
    if (!TWIKOO_ENV_ID || !askForm.nick || !askForm.comment) {
      alert('昵称和提问内容不能为空！');
      return;
    }
    setLoading(true);
    try {
      await twikoo.postComment({
        envId: TWIKOO_ENV_ID,
        href: '/ask',
        url: '/ask',
        nick: askForm.nick,
        mail: askForm.mail,
        link: askForm.link,
        comment: askForm.comment,
      });
      alert('提问已提交，请等待审核后显示！');
      setShowAskModal(false);
      setAskForm({ nick: '', mail: '', link: '', comment: '' });
      fetchTopics();
    } catch (error) {
      console.error('提交提问失败', error);
      alert('提交提问失败，请稍后再试。');
      setLoading(false);
    }
  };


  return (
    <Layout {...props}>
      <div className='px-5 pt-10 pb-20'>
        <div className='text-center mb-8'>
          <h1 className='text-3xl font-bold mb-4 dark:text-white'>提问交流区</h1>
          <p className='text-gray-600 dark:text-gray-400'>
            在这里提出你的中文学习问题，或帮助其他同学解答疑惑！
          </p>
          <button
            onClick={() => setShowAskModal(true)}
            className='mt-6 px-6 py-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors duration-200'>
            <i className='fas fa-plus-circle mr-2'></i> 我要提问
          </button>
        </div>

        {loading && <div className="text-center dark:text-white">加载中...</div>}
        {error && <div className="text-center text-red-500">{error}</div>}

        {!loading && !error && (
          <div className='w-full max-w-4xl mx-auto space-y-4'>
            {topics.length === 0 && (
              <div className="text-center dark:text-gray-400 py-8">
                暂无提问，快来发布第一个问题吧！
              </div>
            )}
            {topics.map(topic => (
              <SmartLink href={`/ask/${topic.id}`} key={topic.id} passHref>
                <div className='block p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer'>
                  <div className='flex items-center text-sm text-gray-500 dark:text-gray-400 mb-2'>
                    <i className='fas fa-user-circle mr-2'></i> {topic.nick}
                    <span className='mx-2'>·</span>
                    <i className='far fa-clock mr-1'></i> {new Date(topic.time).toLocaleString()}
                    <span className='mx-2'>·</span>
                    <i className='fas fa-reply mr-1'></i> {topic.replies ? topic.replies.length : 0} 回复
                  </div>
                  <h2 className='text-lg font-semibold dark:text-white mb-2 line-clamp-2'>{topic.comment}</h2>
                </div>
              </SmartLink>
            ))}
          </div>
        )}
      </div>

      <AskModal 
        isOpen={showAskModal}
        onClose={() => setShowAskModal(false)}
        onSubmit={handleSubmitAsk}
        askForm={askForm}
        setAskForm={setAskForm}
      />
    </Layout>
  );
};

export async function getStaticProps(context) {
  const { locale } = context;
  const props = await getGlobalData({ from: 'ask-page', locale });
  delete props.allPages;
  delete props.posts;
  delete props.postCount;
  delete props.latestPosts;
  return {
    props,
    revalidate: parseInt(
      props.NOTION_CONFIG?.POSTS_PAGE_REVALIDATE_SECONDS || '3600'
    ),
  };
}

export default AskPage;
