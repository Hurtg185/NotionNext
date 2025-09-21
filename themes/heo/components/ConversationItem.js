// themes/heo/components/ConversationItem.js (优化在线状态显示)

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile } from '@/lib/chat';

const ConversationItem = ({ conversation, onClick }) => {
  const { user } = useAuth();
  const [otherUser, setOtherUser] = useState(null);

  useEffect(() => {
    if (user && conversation?.participants) {
      const otherUserId = conversation.participants.find(uid => uid !== user.uid);
      if (otherUserId) {
        setOtherUser(null);
        getUserProfile(otherUserId).then(setOtherUser);
      }
    }
  }, [conversation, user]);

  const handleAvatarClick = (e) => {
    e.stopPropagation();
  };
  
  const isLoading = !otherUser || typeof otherUser.photoURL === 'undefined';

  if (isLoading) {
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
  
  const lastMessage = conversation.lastMessage || '...';
  const timestamp = conversation.lastMessageTimestamp?.toDate().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) || '';
  
  const avatarSrc = otherUser.photoURL || 'https://www.gravatar.com/avatar?d=mp';

  return (
    <div
      onClick={onClick}
      className="flex items-center p-3 cursor-pointer transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      <Link href={`/profile/${otherUser.id}`} passHref>
        <a onClick={handleAvatarClick} className="flex-shrink-0 relative">
          <div className="avatar-glow">
            <img
              src={avatarSrc}
              alt={otherUser.displayName}
              className="rounded-full object-cover w-16 h-16"
            />
          </div>
          {/* 【核心修改】只在 otherUser.isOnline 为 true 时渲染绿点 */}
          {otherUser.isOnline && (
            <span
              className="absolute bottom-0 right-0 block h-4 w-4 rounded-full border-2 border-white dark:border-gray-800 bg-green-500"
              title="在线"
            />
          )}
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
  );
};

export default ConversationItem;
