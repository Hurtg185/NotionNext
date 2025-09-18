// themes/heo/components/ConversationList.js (最终防闪烁 + 功能完整版)

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { getConversationsForUser } from '@/lib/chat'
import ConversationItem from './ConversationItem'
import { useDrawer } from '@/lib/DrawerContext';

// 独立的骨架屏组件，确保样式稳定
const ConversationSkeleton = () => (
  <div className="flex items-center p-3 animate-pulse border-b border-gray-200 dark:border-gray-700">
    <div className="w-14 h-14 bg-gray-300 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
    <div className="flex-1 ml-3 space-y-2">
      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
    </div>
  </div>
);

const ConversationList = () => {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true) 
  const { openDrawer } = useDrawer();

  // 使用最标准、最简单的 useEffect 数据获取模式
  useEffect(() => {
    // 如果用户不存在，则不加载，并清空列表
    if (!user) {
      setLoading(false);
      setConversations([]);
      return;
    }

    // 用户存在，开始订阅数据
    setLoading(true); // 立即显示骨架屏
    const unsubscribe = getConversationsForUser(user.uid, (convs) => {
      setConversations(convs);
      setLoading(false); // 数据已到达（即使是空列表），停止加载
    });

    // 组件卸载时，取消订阅
    return () => {
      unsubscribe();
    };
  }, [user]); // 依赖项只有 user

  const handleSelectChat = (conversation) => {
    openDrawer('chat', { conversation });
  };

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-800">
      {/* 消息标题和搜索框现在由父页面 pages/forum/messages/index.js 管理 */}

      {loading ? (
        // 加载时，始终渲染固定数量的骨架屏，避免布局跳动
        <div>
          {[...Array(8)].map((_, i) => <ConversationSkeleton key={i} />)}
        </div>
      ) : conversations.length > 0 ? (
        // 数据加载完成后，渲染真实列表
        conversations.map(conv => (
          <ConversationItem key={conv.id} conversation={conv} onClick={() => handleSelectChat(conv)} />
        ))
      ) : (
        // 如果没有对话，显示友好的提示
        <div className="p-6 text-center text-gray-500 dark:text-gray-400 mt-10">
          <i className="fas fa-comments text-4xl text-gray-300 dark:text-gray-600 mb-4"></i>
          <p className="font-semibold">还没有对话</p>
          <p className="text-sm">去社区里开启第一次交流吧！</p>
        </div>
      )}
    </div>
  )
}

export default ConversationList
