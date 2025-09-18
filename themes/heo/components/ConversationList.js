// themes/heo/components/ConversationList.js (加载速度优化版)

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { getConversationsForUser } from '@/lib/chat'
import ConversationItem from './ConversationItem'
import { useDrawer } from '@/lib/DrawerContext';

const ConversationList = () => {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  // 【核心修复】: loading 状态由 getConversationsForUser 回调控制
  const [loading, setLoading] = useState(true) 
  const { openDrawer } = useDrawer();

  useEffect(() => {
    if (!user) return;
    setLoading(true); // 开始监听时，设置为加载中
    const unsubscribe = getConversationsForUser(user.uid, (convs, isLoading) => {
      setConversations(convs);
      setLoading(isLoading); // 使用回调返回的加载状态
    });
    return () => unsubscribe();
  }, [user]);

  const handleSelectChat = (conversation) => {
    openDrawer('chat', { conversation });
  };

  // 在加载时显示骨架屏，提升体验
  if (loading) {
    return (
        <div>
            <div className="p-4 border-b"><h2 className="text-xl font-bold">消息</h2></div>
            {[...Array(5)].map((_, i) => <div key={i} className="h-[76px] bg-gray-100 dark:bg-gray-800 animate-pulse border-b border-gray-200 dark:border-gray-700"></div>)}
        </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 border-b"> <h2 className="text-xl font-bold">消息</h2> </div>
      {conversations.length > 0 ? (
        conversations.map(conv => (
          <ConversationItem key={conv.id} conversation={conv} onClick={() => handleSelectChat(conv)} />
        ))
      ) : (
        <div className="p-6 text-center text-gray-500"> <p>还没有对话。</p> </div>
      )}
    </div>
  )
}

export default ConversationList
