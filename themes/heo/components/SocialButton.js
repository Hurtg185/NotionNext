// themes/heo/components/ConversationList.js (最终修复版 - 纠正 useDrawer 导入)

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { getConversationsForUser } from '@/lib/chat'
import ConversationItem from './ConversationItem'
// 【核心修复】: 从正确的路径导入 useDrawer
import { useDrawer } from '@/lib/DrawerContext'; // 导入 useDrawer 应该从 lib/DrawerContext

const ConversationList = () => {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const { openDrawer } = useDrawer();

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const unsubscribe = getConversationsForUser(user.uid, (convs) => {
      setConversations(convs)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [user])

  const handleSelectChat = (conversation) => {
    openDrawer('chat', { conversation });
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">加载对话中...</div>
  }

  return (
    <div className="h-full overflow-y-auto border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">消息</h2>
      </div>
      {conversations.length > 0 ? (
        conversations.map(conv => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            onClick={() => handleSelectChat(conv)}
          />
        ))
      ) : (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          <p>还没有对话。</p>
          <p className="text-sm">去帖子里找人私信吧！</p>
        </div>
      )}
    </div>
  )
}

export default ConversationList
