// themes/heo/components/ChatMessage.js (最终优化版 - 已整合七牛云实时图片样式)

import React from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useDrawer } from '@/lib/DrawerContext';
import { useChatStyle, getBubbleShapeClasses } from '@/lib/ChatStyleContext'; 

const ChatMessage = ({ message, chatId, currentUserProfile, otherUserProfile }) => {
  const router = useRouter();
  const { closeDrawer } = useDrawer();

  const { styles } = useChatStyle();
  const { theme, fontSize, fontWeight, bubbleShapeKey } = styles;

  const isMe = currentUserProfile && message.senderId === currentUserProfile.uid;
  const senderProfile = isMe ? currentUserProfile : otherUserProfile;

  const handleAvatarClick = () => {
    if (senderProfile?.id) {
      closeDrawer();
      setTimeout(() => router.push(`/profile/${senderProfile.id}`), 100);
    }
  };

  const renderMessageContent = () => {
    // 渲染媒体内容
    if (message.mediaUrl && message.mediaType) {
      if (message.mediaType === 'image') {
        // 【核心修改】动态拼接七牛云图片样式，不再依赖数据库的 thumbnailUrl 字段
        const thumbnailUrl = `${message.mediaUrl}?thumb400`; 

        return (
          <div className="relative group cursor-pointer" onClick={() => window.open(message.mediaUrl, '_blank')}>
            <img 
              src={thumbnailUrl} 
              alt="聊天图片" 
              className="max-w-xs max-h-64 object-cover rounded-lg"
            />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                <i className="fas fa-search-plus text-white text-2xl"></i>
            </div>
          </div>
        );
      }
      if (message.mediaType === 'video') {
        // 视频逻辑保持不变，依然使用工作流生成的 thumbnailUrl
        const thumbnailUrl = message.thumbnailUrl || message.mediaUrl; 

        return (
          <video 
            src={message.mediaUrl}
            poster={thumbnailUrl}
            controls 
            preload="metadata"
            className="max-w-xs rounded-lg" 
          />
        );
      }
      if (message.mediaType === 'audio') {
        return <audio src={message.mediaUrl} controls className="w-full max-w-xs" />;
      }
    }
    
    // 渲染纯文本内容
    if (message.text) {
      return <p className="break-all whitespace-pre-wrap">{message.text}</p>;
    }
    
    // 降级处理
    if (message.mediaUrl && !message.text) {
        return <p className="text-sm italic opacity-75">[不支持的媒体类型]</p>
    }

    return null;
  };
  
  const renderTextBelowMedia = () => {
      if (message.mediaUrl && message.mediaType && message.text) {
          return <p className="mt-2 break-all whitespace-pre-wrap">{message.text}</p>;
      }
      return null;
  };

  if (!senderProfile) {
    return <div className="h-[52px]"></div>;
  }
  
  const bubbleTheme = isMe ? theme.outgoing : theme.incoming;
  const isPureMedia = (message.mediaType === 'image' || message.mediaType === 'video') && !message.text;
  const bubbleBaseClasses = `inline-block max-w-full overflow-hidden ${isPureMedia ? 'p-0' : 'px-4 py-2'}`;
  
  const bubbleShapeClasses = getBubbleShapeClasses(bubbleShapeKey, isMe);
  const bubbleColorAndFontClasses = `${bubbleTheme.className} ${fontSize} ${fontWeight}`;

  return (
    <div className={`flex items-start gap-2 my-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && (
        <div className="flex-shrink-0 relative cursor-pointer" onClick={handleAvatarClick}>
          <Image src={senderProfile.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={senderProfile.displayName} width={40} height={40} className="rounded-full object-cover"/>
        </div>
      )}

      <div className={`max-w-[80%] sm:max-w-[75%]`}>
        <div 
          className={`${bubbleBaseClasses} ${bubbleShapeClasses} ${bubbleColorAndFontClasses}`} 
          style={bubbleTheme.style}
        >
          {message.mediaUrl && message.mediaType ? (
            <div>
              {renderMessageContent()}
              {isPureMedia ? null : renderTextBelowMedia()}
            </div>
          ) : (
            renderMessageContent()
          )}
        </div>
        {isPureMedia && renderTextBelowMedia() && (
             <div className="text-sm text-gray-600 dark:text-gray-300 mt-1 px-2">
                {renderTextBelowMedia()}
             </div>
        )}
      </div>

      {isMe && (
        <div className="flex-shrink-0 relative cursor-pointer" onClick={handleAvatarClick}>
          <Image src={senderProfile.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={senderProfile.displayName} width={40} height={40} className="rounded-full object-cover"/>
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
