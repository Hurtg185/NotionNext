// themes/heo/components/ChatMessage.js (最终字体/颜色修复版)

import { useAuth } from '@/lib/AuthContext'

const ChatMessage = ({ message, otherUser }) => {
  const { user } = useAuth()
  const isMe = message.senderId === user.uid

  return (
    <div className={`flex items-end gap-2 my-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
      
      {/* 对方头像 */}
      {!isMe && (
        <div className="flex-shrink-0">
          <img
            src={otherUser?.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
            alt={otherUser?.displayName}
            className="rounded-full w-10 h-10 object-cover"
          />
        </div>
      )}
      
      {/* 消息气泡 */}
      <div
        className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg break-words ${
          // 【核心修改】:
          isMe 
            ? 'bg-chat-bubble-me text-white rounded-br-none font-semibold' // 我方气泡：字体改为白色，加粗
            : 'bg-chat-bubble-other dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none font-semibold' // 对方气泡：字体加粗
        }`}
      >
        <p>{message.text}</p>
      </div>

      {/* 我方头像 */}
       {isMe && (
        <div className="flex-shrink-0">
          <img
            src={user?.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
            alt={user?.displayName}
            className="rounded-full w-10 h-10 object-cover"
          />
        </div>
      )}
    </div>
  )
}

export default ChatMessage
