// themes/heo/components/ConversationList.js (连接全局Context版)

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { getConversationsForUser } from '@/lib/chat'
import ConversationItem from './ConversationItem'
import { useDrawer } from '@/lib/DrawerContext'; // 从全局导入

const ConversationList = () => {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const { openDrawer } = useDrawer(); // 获取全局的 openDrawer

  useEffect(() => {
    if (!user) return;
    const unsubscribe = getConversationsForUser(user.uid, (convs) => {
      setConversations(convs)
      setLoading(false)
    });
    return () => unsubscribe();
  }, [user]);

  const handleSelectChat = (conversation) => {
    openDrawer('chat', { conversation }); // 打开聊天抽屉
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">加载对话中...</div>
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold">消息</h2>
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
        <div className="p-6 text-center text-gray-500">
          <p>还没有对话。</p>
        </div>
      )}
    </div>
  )
}

export default ConversationList
