// themes/heo/components/ConversationItem.js (终极修复版)

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'
import { getUserProfile } from '@/lib/chat'

const ConversationItem = ({ conversation, onClick }) => {
  const { user } = useAuth()
  const [otherUser, setOtherUser] = useState(null)

  useEffect(() => {
    if (user && conversation?.participants) {
      const otherUserId = conversation.participants.find(uid => uid !== user.uid)
      if (otherUserId) {
        setOtherUser(null); 
        getUserProfile(otherUserId).then(setOtherUser)
      }
    }
  }, [conversation, user])

  const handleAvatarClick = (e) => {
    e.stopPropagation();
  };
  
  /**
   * 【核心修改】: 使用更严格的加载状态检查
   * 只有在 otherUser 对象存在，并且其 photoURL 属性也已定义时 (即使是 null),
   * 才认为加载完成。这可以 100% 避免渲染一个不完整的用户数据。
   */
  const isLoading = !otherUser || typeof otherUser.photoURL === 'undefined';

  if (isLoading) {
    // 骨架屏保持不变，它本身是完美的
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
  
  /**
   * 【核心修改】: 创建一个绝对安全的头像 URL
   * 这里的 otherUser.photoURL 可能是 URL 字符串，也可能是 null (来自我们改好的 getUserProfile)
   * `||` 操作符可以完美处理这两种情况。
   */
  const avatarSrc = otherUser.photoURL || 'https://www.gravatar.com/avatar?d=mp';

  return (
    <div
      onClick={onClick}
      className="flex items-center p-3 cursor-pointer transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      <Link href={`/profile/${otherUser.id}`} passHref>
        <a onClick={handleAvatarClick} className="flex-shrink-0">
          <img
            src={avatarSrc} // 使用我们预先计算好的安全 src
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

export default ConversationItem;
