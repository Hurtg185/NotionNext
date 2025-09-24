// themes/heo/components/ChatMessage.js (最终优化版 - 状态隔离 + 缩略图优先)

import React from 'react'; // 移除了 useState 和 useEffect
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useDrawer } from '@/lib/DrawerContext';
// 【核心修改】导入新的 Context Hook 和函数
import { useChatStyle, getBubbleShapeClasses } from '@/lib/ChatStyleContext'; 

const ChatMessage = ({ message, chatId, currentUserProfile, otherUserProfile }) => {
  const router = useRouter();
  const { closeDrawer } = useDrawer();

  // 【核心修改】从 Context 获取样式，不再需要组件内部的状态和监听器
  const { styles } = useChatStyle();
  const { theme, fontSize, fontWeight, bubbleShapeKey } = styles;

  const isMe = currentUserProfile && message.senderId === currentUserProfile.uid;
  const senderProfile = isMe ? currentUserProfile : otherUserProfile;

  // 【已删除】之前用于加载和监听全局事件的 useEffect 已被完全移除，解决了全局状态污染问题。

  const handleAvatarClick = () => {
    if (senderProfile?.id) {
      closeDrawer();
      setTimeout(() => router.push(`/profile/${senderProfile.id}`), 100);
    }
  };

  // 【性能优化】渲染函数，优先使用 thumbnailUrl
  const renderMessageContent = () => {
    // 渲染媒体内容
    if (message.mediaUrl && message.mediaType) {
      const thumbnailUrl = message.thumbnailUrl || message.mediaUrl; // 如果没有缩略图，则降级使用原图

      if (message.mediaType === 'image') {
        return (
          <div className="relative group cursor-pointer" onClick={() => window.open(message.mediaUrl, '_blank')}>
            <img 
              src={thumbnailUrl} 
              alt="聊天图片" 
              className="max-w-xs max-h-64 object-cover rounded-lg" // 使用 object-cover 让缩略图填满容器
            />
            {/* 在图片上覆盖一个放大镜图标，提示用户可以点击看原图 */}
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                <i className="fas fa-search-plus text-white text-2xl"></i>
            </div>
          </div>
        );
      }
      if (message.mediaType === 'video') {
        return (
          <video 
            src={message.mediaUrl} // 视频可以直接播放压缩后的版本
            poster={thumbnailUrl}   // 使用视频截图作为封面
            controls 
            preload="metadata" // 只加载元数据（时长等），不加载整个视频
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
  
  // 渲染媒体下方的文本
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
  // 如果是纯图片或视频，移除内边距，让媒体填满气泡
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
          {/* 根据消息类型决定渲染结构 */}
          {message.mediaUrl && message.mediaType ? (
            <div>
              {renderMessageContent()}
              {/* 如果是纯媒体，文字在气泡外；如果媒体+文字，文字在气泡内 */}
              {isPureMedia ? null : renderTextBelowMedia()}
            </div>
          ) : (
            renderMessageContent() // 纯文本消息
          )}
        </div>
        {/* 如果是纯媒体，把文字显示在气泡下方 */}
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
