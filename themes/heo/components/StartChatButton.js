// themes/heo/components/StartChatButton.js (连接全局Context版)

import { useAuth } from '@/lib/AuthContext'
import { startChat } from '@/lib/chat'
import { useDrawer } from '@/lib/DrawerContext'

const StartChatButton = ({ targetUserId }) => {
  const { user } = useAuth()
  const { openDrawer } = useDrawer();

  const handleStartChat = async () => {
    if (!user) { alert('请先登录！'); return; }
    
    const conversation = await startChat(user.uid, targetUserId);
    if (conversation) {
      openDrawer({ type: 'chat', conversation: conversation });
    } else {
      alert('无法开启对话，请稍后再试。');
    }
  }

  if (!user || user.uid === targetUserId) {
    return null
  }

  return (
    <button
      onClick={handleStartChat}
      className="flex items-center space-x-2 px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
    >
      <i className="fas fa-paper-plane"></i>
      <span>私信</span>
    </button>
  )
}
export default StartChatButton
