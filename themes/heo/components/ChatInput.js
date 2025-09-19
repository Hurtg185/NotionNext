// themes/heo/components/ChatInput.js (完整且已修复)

import { useState } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { sendMessage } from '@/lib/chat'

const ChatInput = ({ chatId, conversation }) => { // 接收 conversation 以便传递给 sendMessage
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false); // 防止重复发送

  const handleSend = async (e) => {
    e.preventDefault()
    if (!chatId || !user || !text.trim() || isSending) return;

    setIsSending(true);

    // 【核心修复】修正 sendMessage 的调用参数顺序和内容
    // 正确的签名是: sendMessage(currentUser, chatId, text)
    const result = await sendMessage(user, chatId, text);
    
    if (result.success) {
      setText(''); // 只有发送成功才清空
    } else {
      // 可以给用户一个发送失败的提示
      alert(result.message || '消息发送失败，请稍后再试。');
    }
    
    setIsSending(false);
  }

  return (
    <form onSubmit={handleSend} className="flex items-center space-x-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="输入消息..."
        className="flex-1 p-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={!text.trim() || isSending}
        className="p-3 w-12 h-12 flex items-center justify-center bg-blue-500 text-white rounded-full disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
      >
        {isSending ? (
          <i className="fas fa-spinner fa-spin"></i> // 发送中显示加载动画
        ) : (
          <i className="fas fa-paper-plane"></i>
        )}
      </button>
    </form>
  )
}

export default ChatInput
