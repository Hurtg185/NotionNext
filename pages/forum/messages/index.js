// pages/forum/messages/index.js (连接全局Context版)

import { useAuth } from '@/lib/AuthContext'
import { LayoutBase } from '@/themes/heo'
import ConversationList from '@/themes/heo/components/ConversationList'

const MessagesPage = () => {
  const { user, loading } = useAuth()

  return (
    <LayoutBase>
      {loading && <div className="p-10 text-center">加载中...</div>}
      {!loading && !user && <div className="p-10 text-center">请先登录以查看消息。</div>}
      {!loading && user && (
        <ConversationList />
      )}
    </LayoutBase>
  )
}

export default MessagesPage
