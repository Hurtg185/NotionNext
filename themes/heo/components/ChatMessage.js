// themes/heo/components/ChatMessage.js (完整且已修改)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useDrawer } from '@/lib/DrawerContext';
import { useAuth } from '@/lib/AuthContext';

// ... (THEMES 和 getBubbleShapeClasses 函数保持不变) ...

const ChatMessage = ({ message, chatId, currentUserProfile, otherUserProfile }) => {
  const router = useRouter();
  const { closeDrawer } = useDrawer();
  const { user: localCurrentUser } = useAuth(); // 使用不同的变量名以示区分

  const [chatStyles, setChatStyles] = useState({ /* ... */ });

  // 使用传入的 currentUserProfile 作为主要判断依据
  const isMe = currentUserProfile && message.senderId === currentUserProfile.uid;
  
  // 确保 senderProfile 总是有一个有效的对象
  const senderProfile = isMe ? currentUserProfile : otherUserProfile;

  // ... (useEffect 逻辑保持不变) ...

  const handleAvatarClick = () => {
    if (senderProfile?.id) {
      closeDrawer();
      setTimeout(() => router.push(`/profile/${senderProfile.id}`), 100);
    }
  };

  const getFlagEmoji = (countryCode) => { /* ... */ };

  if (!senderProfile) {
    return <div className="h-[52px]"></div>;
  }
  
  const bubbleTheme = isMe ? chatStyles.theme.outgoing : chatStyles.theme.incoming;
  const bubbleBaseClasses = 'inline-block px-4 py-2';
  
  const bubbleShapeClasses = getBubbleShapeClasses(chatStyles.bubbleShapeKey, isMe);
  const bubbleColorAndFontClasses = `${bubbleTheme.className} ${chatStyles.fontSize} ${chatStyles.fontWeight}`;

  return (
    <div className={`flex items-start gap-2 my-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && (
        <div className="flex-shrink-0 relative cursor-pointer" onClick={handleAvatarClick}>
          <Image src={senderProfile.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={senderProfile.displayName} width={40} height={40} className="rounded-full object-cover"/>
          {senderProfile.country && (<span className="absolute bottom-0 right-0 text-lg leading-none">{getFlagEmoji(senderProfile.country)}</span>)}
        </div>
      )}

      <div className={`max-w-[65%] sm:max-w-[70%]`}>
        <div 
          className={`${bubbleBaseClasses} ${bubbleShapeClasses} ${bubbleColorAndFontClasses}`} 
          style={bubbleTheme.style}
        >
          {/* 【核心修复】添加 whitespace-pre-wrap 来处理换行 */}
          <p className="break-words whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>

      {isMe && (
        <div className="flex-shrink-0 relative cursor-pointer" onClick={handleAvatarClick}>
          <Image src={senderProfile.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={senderProfile.displayName} width={40} height={40} className="rounded-full object-cover"/>
          {senderProfile.country && (<span className="absolute bottom-0 right-0 text-lg leading-none">{getFlagEmoji(senderProfile.country)}</span>)}
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
