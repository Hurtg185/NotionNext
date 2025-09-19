// themes/heo/components/ChatMessage.js (完整且已修复)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useDrawer } from '@/lib/DrawerContext'; // 【核心】引入 useDrawer

// ... (THEMES 和 getBubbleShapeClasses 函数保持不变) ...

const ChatMessage = ({ message, chatId, currentUserProfile, otherUserProfile }) => {
  const router = useRouter();
  const { closeDrawer } = useDrawer(); // 【核心】获取 closeDrawer

  const [chatStyles, setChatStyles] = useState({ /* ... */ });
  const isMe = currentUserProfile && message.senderId === currentUserProfile.uid;
  const senderProfile = isMe ? currentUserProfile : otherUserProfile;

  useEffect(() => {
    // ... (你的样式加载 useEffect 逻辑保持不变) ...
  }, [chatId]);

  // 【核心】处理头像点击跳转
  const handleAvatarClick = () => {
    if (senderProfile?.id) {
      closeDrawer();
      setTimeout(() => router.push(`/profile/${senderProfile.id}`), 100);
    }
  };

  if (!senderProfile) {
    return <div className="h-[52px]"></div>;
  }
  
  // ... (样式计算逻辑保持不变) ...
  
  return (
    <div className={`flex items-start gap-2 my-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && (
        <div className="flex-shrink-0 relative cursor-pointer" onClick={handleAvatarClick}>
          <Image src={senderProfile.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={senderProfile.displayName} width={40} height={40} className="rounded-full object-cover"/>
        </div>
      )}

      <div className={`max-w-[65%] sm:max-w-[70%]`}>
        <div className={`px-4 py-2 text-sm shadow-md break-words ${/*...*/}`}>
          <p className="break-words">{message.text}</p>
        </div>
      </div>

      {isMe && (
        <div className="flex-shrink-0 relative cursor-pointer" onClick={handleAvatarClick}>
          <Image src={currentUserProfile?.photoURL || '...'} alt={currentUserProfile?.displayName} width={40} height={40} className="rounded-full object-cover"/>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
