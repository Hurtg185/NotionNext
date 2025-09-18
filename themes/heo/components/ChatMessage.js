// themes/heo/components/ChatMessage.js (最终美化版)

import { useAuth } from '@/lib/AuthContext'

const ChatMessage = ({ message, otherUser }) => {
  const { user } = useAuth()
  const isMe = message.senderId === user.uid

  return (
    // 【核心CSS修复 1】: 添加 w-full 确保占满整行，以便 justify-end 生效
    <div className={`flex items-end gap-2 my-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
      
      {/* 对方头像 */}
      {!isMe && (
        // 【核心CSS修复 2】: 使用 flex-shrink-0 确保头像不被压缩
        <div className="flex-shrink-0">
          <img
            src={otherUser?.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
            alt={otherUser?.displayName}
            className="rounded-full w-12 h-12 object-cover"
          />
        </div>
      )}
      
      {/* 消息气泡 */}
      <div
        className={`max-w-xs md:max-w-md px-4 py-2 rounded-lg break-words ${
          // 【核心颜色修改】: 使用新定义的颜色
          isMe 
            ? 'bg-chat-bubble-me text-gray-800 rounded-br-none' // 我方气泡
            : 'bg-chat-bubble-other dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none' // 对方气泡
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
            // 【核心CSS修复 3】: 统一双方头像尺寸为 w-10 h-10
            className="rounded-full w-12 h-12 object-cover"
          />
        </div>
      )}
    </div>
  )
}

export default ChatMessage
