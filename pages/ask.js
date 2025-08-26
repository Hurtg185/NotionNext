// pages/ask.js

import { getGlobalData } from '@/lib/db/getSiteData'
import { useGlobal } from '@/lib/global'
import { siteConfig } from '@/lib/config'
import { useRouter } from 'next/router'
import { Layout } from '@/themes'
import {
  Comment
} from 'react-cusdis' // Cusdis, Giscus, Utterances, Twikoo, Waline 等都使用这个组件名

const AskPage = (props) => {
  const { locale } = useGlobal()
  const router = useRouter()
  return <Layout {...props}>
    <div className='px-5 pt-10 pb-20'>
        <div className='text-center'>
            <h1 className='text-3xl font-bold mb-4 dark:text-white'>提问交流区</h1>
            <p className='text-gray-600 dark:text-gray-400 mb-8'>遇到学习问题？在这里提出，大家会帮助你！</p>
        </div>
        <div className='w-full max-w-4xl mx-auto bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md'>
            {/* 这里嵌入了评论组件作为“发帖”功能 */}
            {/* 您需要确保 blog.config.js 中配置了评论系统 */}
            <Comment frontMatter={{
              id: 'ask-page', // 评论系统会根据这个ID来区分不同的评论区
              title: '提问交流区',
              // 如果您的主题需要，可能还需要添加其他属性
              slug: 'ask',
              type: 'Page'
            }} />
        </div>
    </div>
  </Layout>
}

export async function getStaticProps() {
  const props = await getGlobalData({
    from: 'ask-page'
  })
  // 删除不必要的数据，减小页面大小
  delete props.allPages
  delete props.posts
  delete props.postCount
  delete props.latestPosts
  return {
    props,
    revalidate: parseInt(siteConfig('POSTS_PAGE_REVALIDATE_SECONDS', '3600'))
  }
}

export default AskPage
