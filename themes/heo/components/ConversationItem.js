// themes/heo/components/ConversationItem.js (完美最终版)

import { useEffect, useState } from 'react'
import Link from 'next/link' // 1. 引入 Link 组件用于跳转
import { useAuth } from '@/lib/AuthContext'
import { getUserProfile } from '@/lib/chat'

const ConversationItem = ({ conversation, onClick }) => {
  const { user } = useAuth()
  const [otherUser, setOtherUser] = useState(null)

  useEffect(() => {
    if (user && conversation?.participants) {
      const otherUserId = conversation.participants.find(uid => uid !== user.uid)
      if (otherUserId) {
        // 清空旧用户数据，确保在切换用户时显示加载状态
        setOtherUser(null); 
        getUserProfile(otherUserId).then(setOtherUser)
      }
    }
  }, [conversation, user])

  // 阻止点击头像时，触发整个item的onClick事件（即打开聊天）
  const handleAvatarClick = (e) => {
    e.stopPropagation();
  };
  
  // 2. 创建一个完美的骨架屏，它和最终UI结构完全一致
  // 这能从根本上解决“黑粗线”问题，因为它在加载时根本不渲染 <img> 标签
  if (!otherUser) {
    return (
      <div className="flex items-center p-3">
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
        <div className="flex-1 ml-3 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse"></div>
        </div>
      </div>
    );
  }
  
  const lastMessage = conversation.lastMessage || '...'
  const timestamp = conversation.lastMessageTimestamp?.toDate().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) || ''
  
  return (
    <div
      onClick={onClick}
      className="flex items-center p-3 cursor-pointer transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      {/* 3. 实现可点击的头像，点击后进入对方个人主页 */}
      <Link href={`/profile/${otherUser.id}`} passHref>
        <a onClick={handleAvatarClick} className="flex-shrink-0">
          <img
            src={otherUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
            alt={otherUser.displayName}
            className="rounded-full object-cover w-16 h-16"
          />
        </a>
      </Link>

      <div className="flex-1 ml-3 overflow-hidden">
        <div className="flex justify-between items-center">
          <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{otherUser.displayName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">{timestamp}</p>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{lastMessage}</p>
      </div>
    </div>
  )
}

export default ConversationItem
