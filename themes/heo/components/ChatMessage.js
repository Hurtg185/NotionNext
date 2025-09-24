// themes/heo/components/ChatMessage.js (已增强以支持媒体显示，并保留所有原有功能)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useDrawer } from '@/lib/DrawerContext';

// === 与 ChatSettingsPanel.js 保持一致的主题定义 (保留不变) ===
const THEMES = [
    { id: 'classic-blue', name: '经典蓝', incoming: { className: 'bg-white text-gray-800 border', style: {} }, outgoing: { className: 'bg-blue-600 text-white', style: {} } },
    { id: 'soft-pastel', name: '柔和粉', incoming: { className: 'bg-pink-50 text-pink-800', style: {} }, outgoing: { className: 'bg-rose-200 text-rose-900', style: {} } },
    { id: 'neon-dark', name: '霓虹暗', incoming: { className: 'bg-gray-900 text-gray-200', style: { boxShadow: '0 2px 8px rgba(0,0,0,0.6)' } }, outgoing: { className: 'text-black', style: { background: 'linear-gradient(90deg,#00F5A0,#00D2FF)', color: '#000' } } },
    { id: 'glassmorphism', name: '玻璃拟物', incoming: { className: 'backdrop-blur-sm bg-white/30 text-gray-900 border', style: { borderColor: 'rgba(255,255,255,0.25)' } }, outgoing: { className: 'backdrop-blur-sm text-white', style: { background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.08)' } } },
    { id: 'sunset-gradient', name: '日落渐变', incoming: { className: 'text-gray-900', style: { background: 'linear-gradient(90deg,#FFE29F,#FFA99F)' } }, outgoing: { className: 'text-white', style: { background: 'linear-gradient(90deg,#FF7E5F,#FEB47B)' } } },
    { id: 'minimal-muted', name: '极简灰', incoming: { className: 'bg-gray-100 text-gray-800', style: {} }, outgoing: { className: 'bg-gray-800 text-white', style: {} } },
    { id: 'tropical', name: '热带风', incoming: { className: 'text-gray-900', style: { background: 'linear-gradient(90deg,#E0F7FA,#B2EBF2)' } }, outgoing: { className: 'text-white', style: { background: 'linear-gradient(90deg,#00C9FF,#92FE9D)' } } },
    { id: 'mono-line', name: '线条风', incoming: { className: 'bg-white text-indigo-700 border', style: { borderLeft: '4px solid #6366F1' } }, outgoing: { className: 'bg-indigo-600 text-white', style: {} } }
];

const getBubbleShapeClasses = (shapeKey, isMe) => {
    switch (shapeKey) {
        case 'squircle': return 'rounded-lg';
        case 'pill': return 'rounded-full';
        case 'sharp': return 'rounded-none';
        case 'soft': return 'rounded-3xl';
        case 'top-tail': return isMe ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tl-md';
        case 'default': default: return isMe ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md';
    }
};

const ChatMessage = ({ message, chatId, currentUserProfile, otherUserProfile }) => {
  const router = useRouter();
  const { closeDrawer } = useDrawer();

  const [chatStyles, setChatStyles] = useState({
      theme: THEMES[0],
      fontSize: 'text-base',
      fontWeight: 'font-normal',
      bubbleShapeKey: 'default'
  });

  const isMe = currentUserProfile && message.senderId === currentUserProfile.uid;
  const senderProfile = isMe ? currentUserProfile : otherUserProfile;

  // useEffect for loading and listening to style changes (保留不变)
  useEffect(() => {
    const loadAndListenStyles = () => {
        const savedThemeId = localStorage.getItem(`chat_theme_id_${chatId}`) || 'classic-blue';
        const savedBubbleShapeKey = localStorage.getItem(`chat_bubble_shape_key_${chatId}`) || 'default';
        const savedFontSize = localStorage.getItem(`chat_font_size_${chatId}`) || 'text-base';
        const savedFontWeight = localStorage.getItem(`chat_font_weight_${chatId}`) || 'font-normal';
        const currentTheme = THEMES.find(t => t.id === savedThemeId) || THEMES[0];
        
        setChatStyles({ 
            theme: currentTheme, 
            bubbleShapeKey: savedBubbleShapeKey,
            fontSize: savedFontSize, 
            fontWeight: savedFontWeight 
        });
    };
    loadAndListenStyles();

    const handleStyleChange = (event) => {
        const { themeId, bubbleShapeKey, fontSize, fontWeight } = event.detail;
        const currentTheme = THEMES.find(t => t.id === themeId) || THEMES[0];
        setChatStyles({ 
            theme: currentTheme, 
            bubbleShapeKey: bubbleShapeKey,
            fontSize: fontSize, 
            fontWeight: fontWeight 
        });
    };
    window.addEventListener('chat-style-change', handleStyleChange);

    return () => {
        window.removeEventListener('chat-style-change', handleStyleChange);
    };
  }, [chatId]);

  const handleAvatarClick = () => {
    if (senderProfile?.id) {
      closeDrawer();
      setTimeout(() => router.push(`/profile/${senderProfile.id}`), 100);
    }
  };

  // 【新增】媒体渲染函数
  const renderMessageContent = () => {
    // 优先渲染媒体内容
    if (message.mediaUrl && message.mediaType) {
      if (message.mediaType === 'image') {
        return (
          <a href={message.mediaUrl} target="_blank" rel="noopener noreferrer">
            <img 
              src={message.mediaUrl} 
              alt="聊天图片" 
              className="max-w-xs max-h-64 object-contain rounded-lg cursor-pointer" 
              // 使用 Next/Image 会导致动态 URL 的问题，直接用 img 更稳妥
            />
          </a>
        );
      }
      if (message.mediaType === 'video') {
        return <video src={message.mediaUrl} controls className="max-w-xs rounded-lg" />;
      }
      if (message.mediaType === 'audio') {
        return <audio src={message.mediaUrl} controls className="w-full max-w-xs" />;
      }
    }
    
    // 如果没有媒体，或者同时有文本，渲染文本
    if (message.text) {
      return <p className="break-all whitespace-pre-wrap">{message.text}</p>;
    }
    
    // 如果是纯媒体消息但类型不被识别，显示一个提示
    if (message.mediaUrl && !message.text) {
        return <p className="text-sm italic opacity-75">[不支持的媒体类型]</p>
    }

    return null; // 确保总有返回值
  };
  
  // 【新增】用于在媒体下方显示文本的函数
  const renderTextBelowMedia = () => {
      // 仅当同时存在媒体和文本时才渲染
      if (message.mediaUrl && message.mediaType && message.text) {
          return <p className="mt-2 break-all whitespace-pre-wrap">{message.text}</p>;
      }
      return null;
  };


  if (!senderProfile) {
    // 这是一个占位符，防止在 senderProfile 加载完成前 UI 跳动
    return <div className="h-[52px]"></div>;
  }
  
  const bubbleTheme = isMe ? chatStyles.theme.outgoing : chatStyles.theme.incoming;
  // 【修改】如果消息是纯图片，移除内边距，让图片填满气泡
  const isPureImage = message.mediaType === 'image' && !message.text;
  const bubbleBaseClasses = `inline-block max-w-full ${isPureImage ? '' : 'px-4 py-2'}`;
  
  const bubbleShapeClasses = getBubbleShapeClasses(chatStyles.bubbleShapeKey, isMe);
  const bubbleColorAndFontClasses = `${bubbleTheme.className} ${chatStyles.fontSize} ${chatStyles.fontWeight}`;

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
          {/* 【核心修改】调用新的渲染函数 */}
          {message.mediaUrl && message.mediaType ? (
            <div>
              {renderMessageContent()}
              {renderTextBelowMedia()}
            </div>
          ) : (
            renderMessageContent() // 对于纯文本消息
          )}
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
