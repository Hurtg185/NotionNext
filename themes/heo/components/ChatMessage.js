// themes/heo/components/ChatMessage.js (最终优化版 - 增加加载占位符和时间戳)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useDrawer } from '@/lib/DrawerContext';
import { useChatStyle, getBubbleShapeClasses } from '@/lib/ChatStyleContext'; 

// === [新] 独立的媒体渲染组件，用于处理加载状态 ===
const MediaRenderer = ({ message }) => {
    const [isMediaLoaded, setIsMediaLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    const handleMediaLoad = () => {
        setIsMediaLoaded(true);
    };

    const handleMediaError = () => {
        setHasError(true);
    };

    const mediaUrl = message.mediaUrl;
    const mediaType = message.mediaType;
    
    // 优先使用工作流生成的视频封面，或实时生成的图片缩略图
    const thumbnailUrl = mediaType === 'image' 
        ? `${mediaUrl}?thumb400` 
        : message.thumbnailUrl || mediaUrl;

    if (hasError) {
        return <div className="p-4 text-center text-red-500 bg-red-100 rounded-lg">媒体加载失败</div>;
    }
    
    if (mediaType === 'image') {
        return (
            <div className="relative group cursor-pointer" onClick={() => window.open(mediaUrl, '_blank')}>
                {/* 占位符和真实图片叠加在一起 */}
                <div className="max-w-xs max-h-64">
                    {/* 模糊的背景占位符 */}
                    {!isMediaLoaded && (
                        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-600 animate-pulse rounded-lg"></div>
                    )}
                    {/* 真实图片，加载完成后变为可见 */}
                    <img 
                        src={thumbnailUrl} 
                        alt="聊天图片" 
                        onLoad={handleMediaLoad}
                        onError={handleMediaError}
                        className={`w-full h-full object-cover rounded-lg transition-opacity duration-300 ${isMediaLoaded ? 'opacity-100' : 'opacity-0'}`}
                    />
                </div>
                {/* 放大镜图标 */}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                    <i className="fas fa-search-plus text-white text-2xl"></i>
                </div>
            </div>
        );
    }

    if (mediaType === 'video') {
        return <video src={mediaUrl} poster={thumbnailUrl} controls preload="metadata" className="max-w-xs rounded-lg" />;
    }

    if (mediaType === 'audio') {
        return <audio src={mediaUrl} controls className="w-full max-w-xs" />;
    }

    return null;
}

// === 主组件 ===
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
  
  // 【新增】格式化时间戳的函数
  const formatTimestamp = (timestamp) => {
      if (!timestamp || !timestamp.toDate) {
          return ''; // 如果时间戳不存在或格式不正确，返回空
      }
      const date = timestamp.toDate();
      return date.toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true // 使用12小时制，例如 "上午 10:30"
      });
  };

  const renderMessageContent = () => {
    if (message.mediaUrl && message.mediaType) {
        return <MediaRenderer message={message} />;
    }
    if (message.text) {
        return <p className="break-all whitespace-pre-wrap">{message.text}</p>;
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
  const bubbleColorAndFontClasses = `${theme.className} ${fontSize} ${fontWeight}`;

  return (
    <div className={`flex items-start gap-2 my-2 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
      {!isMe && (
        <div className="flex-shrink-0 relative cursor-pointer" onClick={handleAvatarClick}>
          <Image src={senderProfile.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={senderProfile.displayName} width={40} height={40} className="rounded-full object-cover"/>
        </div>
      )}

      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%] sm:max-w-[75%]`}>
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
        {/* 【新增】显示时间戳 */}
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 px-2">
            {formatTimestamp(message.timestamp || message.createdAt)}
        </div>
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
