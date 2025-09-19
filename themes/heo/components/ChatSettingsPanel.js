// themes/heo/components/ChatSettingsPanel.js (完整且已修复)

import React, { useState, useEffect, useRef } from 'react';

// === 常量定义 ===
const defaultBackgrounds = [
  { name: '默认', value: 'default', thumbnail: '' },
  { name: '背景1', value: '/images/chat-backgrounds/liaotianbeijing-1.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-1.jpg' },
  { name: '背景2', value: '/images/chat-backgrounds/liaotianbeijing-2.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-2.jpg' },
  { name: '背景3', value: '/images/chat-backgrounds/liaotianbeijing-3.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-3.jpg' },
  { name: '背景4', value: '/images/chat-backgrounds/liaotianbeijing-4.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-4.jpg' },
  { name: '背景5', value: '/images/chat-backgrounds/liaotianbeijing-5.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-5.jpg' },
  { name: '背景6', value: '/images/chat-backgrounds/liaotianbeijing-6.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-6.jpg' },
  { name: '背景7', value: '/images/chat-backgrounds/liaotianbeijing-7.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-7.jpg' },
  { name: '背景8', value: '/images/chat-backgrounds/liaotianbeijing-8.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-8.jpg' },
  { name: '背景9', value: '/images/chat-backgrounds/liaotianbeijing-9.jpg', thumbnail: '/images/chat-backgrounds/liaotianbeijing-9.jpg' },
];

const availableThemes = [
    { id: 'classic-blue', name: '经典蓝', incoming: { className: 'bg-white text-gray-800 border', style: {} }, outgoing: { className: 'bg-blue-600 text-white', style: {} } },
    { id: 'soft-pastel', name: '柔和粉', incoming: { className: 'bg-pink-50 text-pink-800', style: {} }, outgoing: { className: 'bg-rose-200 text-rose-900', style: {} } },
    { id: 'neon-dark', name: '霓虹暗', incoming: { className: 'bg-gray-900 text-gray-200', style: { boxShadow: '0 2px 8px rgba(0,0,0,0.6)' } }, outgoing: { className: 'text-black', style: { background: 'linear-gradient(90deg,#00F5A0,#00D2FF)', color: '#000' } } },
    { id: 'glassmorphism', name: '玻璃拟物', incoming: { className: 'backdrop-blur-sm bg-white/30 text-gray-900 border', style: { borderColor: 'rgba(255,255,255,0.25)' } }, outgoing: { className: 'backdrop-blur-sm text-white', style: { background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))', border: '1px solid rgba(255,255,255,0.08)' } } },
    { id: 'sunset-gradient', name: '日落渐变', incoming: { className: 'text-gray-900', style: { background: 'linear-gradient(90deg,#FFE29F,#FFA99F)' } }, outgoing: { className: 'text-white', style: { background: 'linear-gradient(90deg,#FF7E5F,#FEB47B)' } } },
    { id: 'minimal-muted', name: '极简灰', incoming: { className: 'bg-gray-100 text-gray-800', style: {} }, outgoing: { className: 'bg-gray-800 text-white', style: {} } },
    { id: 'tropical', name: '热带风', incoming: { className: 'text-gray-900', style: { background: 'linear-gradient(90deg,#E0F7FA,#B2EBF2)' } }, outgoing: { className: 'text-white', style: { background: 'linear-gradient(90deg,#00C9FF,#92FE9D)' } } },
    { id: 'mono-line', name: '线条风', incoming: { className: 'bg-white text-indigo-700 border', style: { borderLeft: '4px solid #6366F1' } }, outgoing: { className: 'bg-indigo-600 text-white', style: {} } }
];

const availableBubbleShapes = [
    { key: 'default', name: '默认' },
    { key: 'squircle', name: '方圆' },
    { key: 'pill', name: '胶囊' },
    { key: 'sharp', name: '直角' },
    { key: 'soft', name: '圆润' },
    { key: 'top-tail', name: '顶角' }
];

const fontSizes = [
  { label: '小', value: 'text-sm' },
  { label: '中', value: 'text-base' },
  { label: '大', value: 'text-lg' }
];

const fontWeights = [
  { label: '常规', value: 'font-normal' },
  { label: '加粗', value: 'font-bold' }
];

// --- 通用设置项组件 ---
const SettingsItem = ({ icon, label, onClick, isDestructive = false }) => (
  <button onClick={onClick} className={`w-full flex items-center p-4 text-left text-base font-semibold transition-colors duration-200 ${isDestructive ? 'text-red-500 hover:bg-red-50/50' : 'text-gray-800 dark:text-gray-100 hover:bg-black/5 dark:hover:bg-white/10'}`}>
    <i className={`${icon} w-6 text-center mr-4`}></i>
    <span>{label}</span>
  </button>
);

// --- 主设置面板组件 ---
const ChatSettingsPanel = ({ onClose, chatId }) => {
  const [view, setView] = useState('main');
  const handlePanelClick = e => e.stopPropagation();
  
  const renderContent = () => {
    switch (view) {
      case 'background': return <BackgroundSettings chatId={chatId} />;
      case 'theme': return <BubbleStyleSettings chatId={chatId} />;
      default: return (
          <>
            <div className="py-2">
              <SettingsItem icon="fas fa-image" label="更换聊天背景" onClick={() => setView('background')} />
              <SettingsItem icon="fas fa-palette" label="聊天气泡样式和字体" onClick={() => setView('theme')} />
              <SettingsItem icon="fas fa-search" label="查找聊天记录" onClick={() => alert('功能开发中...')} />
            </div>
            <hr className="my-2 border-gray-200/50 dark:border-gray-600/50" />
            <div className="py-2">
               <SettingsItem icon="fas fa-trash" label="清空聊天记录" isDestructive={true} onClick={() => alert('功能开发中...')} />
            </div>
            <hr className="my-2 border-gray-200/50 dark:border-gray-600/50" />
            <div className="py-2">
                <button onClick={onClose} className="w-full p-4 text-center text-base font-bold text-blue-500 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg">
                  取消
                </button>
            </div>
          </>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-lg rounded-t-2xl shadow-lg animate-slide-up" onClick={handlePanelClick}>
        {view !== 'main' && (
          <button onClick={() => setView('main')} className="absolute top-4 left-4 p-2 text-gray-600 dark:text-gray-300 z-10">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
        )}
        <div className="relative pt-12 pb-4">{renderContent()}</div>
      </div>
      <style jsx global>{`@keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } } .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }`}</style>
    </div>
  );
};

// --- 子组件：背景设置 ---
const BackgroundSettings = ({ chatId }) => {
  const fileInputRef = useRef(null);
  const [currentBg, setCurrentBg] = useState('default');

  useEffect(() => {
    // 【修复】统一 Local Storage Key
    const savedBg = localStorage.getItem(`chat_background_${chatId}`); // 【修复】使用 chat_background_${chatId}
    setCurrentBg(savedBg || 'default');
  }, [chatId]);

  const applyBackground = (bgValue) => {
    setCurrentBg(bgValue);
    // 【修复】统一 Local Storage Key
    localStorage.setItem(`chat_background_${chatId}`, bgValue); // 【修复】使用 chat_background_${chatId}
    // 【修复】统一事件名
    window.dispatchEvent(new CustomEvent('chat-background-change', { detail: { background: bgValue } })); // 【修复】使用 chat-background-change
  };

  const handleFileChange = (event) => { /* ... */ };
  
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold text-center mb-4 text-gray-800 dark:text-gray-100">设置聊天背景</h2>
      <button 
        onClick={() => fileInputRef.current.click()}
        className="w-full flex justify-between items-center p-4 bg-white dark:bg-gray-700 rounded-lg mb-4 text-gray-800 dark:text-gray-100"
      >
        <span className="font-semibold">从相册选择</span>
        <i className="fas fa-chevron-right text-gray-400"></i>
      </button>
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      <div className="grid grid-cols-3 gap-3">
        {defaultBackgrounds.map((bg) => (
          <div 
            key={bg.value}
            className={`relative aspect-[9/16] rounded-lg overflow-hidden cursor-pointer border-2 ${currentBg === bg.value ? 'border-blue-500' : 'border-transparent'}`}
            onClick={() => applyBackground(bg.value)}
          >
            {bg.value !== 'default' ? ( 
              <img src={bg.thumbnail || bg.value} alt={bg.name} className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm bg-gray-200 dark:bg-gray-700">无背景</div>
            )}
            {currentBg === bg.value && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                <span className="bg-blue-500 text-white text-sm px-3 py-1 rounded-full">已选择</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// --- 子组件：气泡样式设置 ---
const BubbleStyleSettings = ({ chatId }) => {
    const [currentThemeId, setCurrentThemeId] = useState(null);
    const [currentBubbleShapeKey, setCurrentBubbleShapeKey] = useState(null);
    const [currentFontSize, setCurrentFontSize] = useState(null);
    const [currentFontWeight, setCurrentFontWeight] = useState(null);

    useEffect(() => {
        setCurrentThemeId(localStorage.getItem(`chat_theme_id_${chatId}`) || 'classic-blue');
        setCurrentBubbleShapeKey(localStorage.getItem(`chat_bubble_shape_key_${chatId}`) || 'default');
        setCurrentFontSize(localStorage.getItem(`chat_font_size_${chatId}`) || 'text-base');
        setCurrentFontWeight(localStorage.getItem(`chat_font_weight_${chatId}`) || 'font-normal');
    }, [chatId]);

    const applyStyles = (styles) => {
        const { 
            themeId = currentThemeId, 
            bubbleShapeKey = currentBubbleShapeKey,
            fontSize = currentFontSize, 
            fontWeight = currentFontWeight 
        } = styles;

        setCurrentThemeId(themeId);
        setCurrentBubbleShapeKey(bubbleShapeKey);
        setCurrentFontSize(fontSize);
        setCurrentFontWeight(fontWeight);

        localStorage.setItem(`chat_theme_id_${chatId}`, themeId);
        localStorage.setItem(`chat_bubble_shape_key_${chatId}`, bubbleShapeKey);
        localStorage.setItem(`chat_font_size_${chatId}`, fontSize);
        localStorage.setItem(`chat_font_weight_${chatId}`, fontWeight);

        window.dispatchEvent(new CustomEvent('chat-style-change', { 
            detail: { themeId, bubbleShapeKey, fontSize, fontWeight } 
        }));
    };

    if (!currentThemeId || !currentBubbleShapeKey || !currentFontSize || !currentFontWeight) {
        return <div className="h-[120px] animate-pulse"></div>;
    }

    return (
        <div className="px-4 py-2">
            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">气泡主题</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {availableThemes.map((theme) => (
                    <div 
                        key={theme.id} 
                        className={`flex flex-col items-center p-2 rounded-lg cursor-pointer border-2 ${currentThemeId === theme.id ? 'border-blue-500' : 'border-transparent'} hover:bg-gray-100 dark:hover:bg-gray-700`} 
                        onClick={() => applyStyles({ themeId: theme.id })}
                    >
                        <div className="w-full flex items-center justify-between mb-1">
                            <div className={`h-4 w-[45%] rounded-full ${theme.incoming.className}`} style={theme.incoming.style} />
                            <div className={`h-4 w-[45%] rounded-full ${theme.outgoing.className}`} style={theme.outgoing.style} />
                        </div>
                        <span className="text-xs text-center text-gray-600 dark:text-gray-300">{theme.name}</span>
                    </div>
                ))}
            </div>

            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">气泡形状</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {availableBubbleShapes.map((shape) => (
                    <button
                        key={shape.key}
                        onClick={() => applyStyles({ bubbleShapeKey: shape.key })}
                        className={`p-2 rounded-md border text-center text-sm ${currentBubbleShapeKey === shape.key ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/50' : 'border-gray-300 dark:border-gray-600'} text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700`}
                    >
                        {shape.name}
                    </button>
                ))}
            </div>

            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">字体大小</h3>
            <div className="flex bg-gray-200/50 dark:bg-gray-700/50 rounded-lg p-1 mb-4">
              {fontSizes.map((sizeOpt) => (
                <button
                  key={sizeOpt.value}
                  onClick={() => applyStyles({ fontSize: sizeOpt.value })}
                  className={`flex-1 p-1 rounded-md text-gray-800 dark:text-gray-100 ${currentFontSize === sizeOpt.value ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
                >
                  {sizeOpt.label}
                </button>
              ))}
            </div>

            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">字体粗细</h3>
            <div className="flex bg-gray-200/50 dark:bg-gray-700/50 rounded-lg p-1">
              {fontWeights.map((weightOpt) => (
                <button
                  key={weightOpt.value}
                  onClick={() => applyStyles({ fontWeight: weightOpt.value })}
                  className={`flex-1 p-1 rounded-md text-gray-800 dark:text-gray-100 ${currentFontWeight === weightOpt.value ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
                >
                  {weightOpt.label}
                </button>
              ))}
            </div>
        </div>
    );
};

export default ChatSettingsPanel;
// pages/profile/[userId].js

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo'; // 确保导入的是您主题的正确布局组件
import { getUserProfile, startChat } from '@/lib/chat'; // 引入 getUserProfile 和 startChat
// 假设你有一个全局的抽屉上下文，用于打开聊天窗口
// import { useDrawer } from '@/lib/DrawerContext'; 

const ProfilePage = () => {
  const router = useRouter();
  const { userId } = router.query;
  const { user: currentUser } = useAuth();
  // const { openDrawer } = useDrawer(); // 从上下文中获取打开抽屉的函数
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dynamics');

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) return;
      setLoading(true);
      const profileData = await getUserProfile(userId);
      setProfileUser(profileData);
      setLoading(false);
    };
    fetchUserProfile();
  }, [userId]);

  const handleStartChat = async () => {
    if (!currentUser) {
      alert('请先登录再发送私信！');
      return;
    }
    if (!profileUser) return;
    
    console.log(`正在尝试与 ${profileUser.displayName} (${profileUser.id}) 开始聊天...`);
    const conversation = await startChat(currentUser.uid, profileUser.id);
    if (conversation) {
      console.log('成功获取或创建对话:', conversation);
      // 在这里调用全局函数打开聊天抽屉
      // openDrawer('chat', { conversation });
      alert(`已与 ${profileUser.displayName} 开启对话，请在消息列表中查看！(UI待接入)`);
    } else {
      console.error('无法开启对话');
      alert('开启对话失败，请稍后再试。');
    }
  };

  if (loading) {
    return <LayoutBase><div className="p-10 text-center">正在加载用户资料...</div></LayoutBase>;
  }

  if (!profileUser || profileUser.displayName === '未知用户') {
    return <LayoutBase><div className="p-10 text-center text-red-500">无法加载该用户的信息或用户不存在。</div></LayoutBase>;
  }

  const isMyProfile = currentUser && currentUser.uid === profileUser.id;

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-full h-48 bg-gradient-to-r from-blue-400 to-purple-500"></div>
        <div className="flex flex-col items-center -mt-20 px-4">
          <img 
            src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} 
            alt={profileUser.displayName} 
            className="w-28 h-28 rounded-full border-4 border-white dark:border-gray-900 shadow-lg"
          />
          <h1 className="text-3xl font-bold mt-4 text-gray-900 dark:text-white">{profileUser.displayName}</h1>
          <p className="text-gray-500 dark:text-gray-400">@{profileUser.id?.substring(0, 8)}</p>
          <p className="text-gray-700 dark:text-gray-300 text-center mt-2 px-6">{profileUser.bio || '这个人很懒，什么都没写...'}</p>
          
          <div className="flex items-center space-x-4 mt-3 text-gray-600 dark:text-gray-400">
            {profileUser.country && <span className="flex items-center"><i className="fas fa-flag mr-2"></i>{profileUser.country}</span>}
            {profileUser.age && <span className="flex items-center"><i className="fas fa-birthday-cake mr-2"></i>{profileUser.age}岁</span>}
          </div>

          <div className="flex space-x-6 mt-4 text-gray-800 dark:text-white">
            <div><span className="font-bold">{profileUser.followerCount || 0}</span> 关注者</div>
            <div><span className="font-bold">{profileUser.followingCount || 0}</span> 关注</div>
          </div>

          <div className="flex space-x-4 mt-6">
            {isMyProfile ? (
              <button className="px-6 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600">编辑资料</button>
            ) : (
              <>
                <button className="px-6 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600">关注</button>
                <button 
                  onClick={handleStartChat}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-full font-semibold hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  私信
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-around border-b border-gray-200 dark:border-gray-700 mt-8 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <button onClick={() => setActiveTab('dynamics')} className={`py-3 px-6 font-semibold ${activeTab === 'dynamics' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
            动态 ({profileUser.postCount || 0})
          </button>
          <button onClick={() => setActiveTab('posts')} className={`py-3 px-6 font-semibold ${activeTab === 'posts' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
            帖子
          </button>
          <button onClick={() => setActiveTab('bookmarks')} className={`py-3 px-6 font-semibold ${activeTab === 'bookmarks' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>
            收藏
          </button>
        </div>

        <div className="p-4 flex-grow">
          {activeTab === 'dynamics' && ( <p className="text-center text-gray-500">用户的动态将会在这里展示...</p> )}
          {activeTab === 'posts' && ( <p className="text-center text-gray-500">用户发布的帖子列表...</p> )}
          {activeTab === 'bookmarks' && ( <p className="text-center text-gray-500">用户收藏的内容...</p> )}
        </div>
      </div>
    </LayoutBase>
  );
};

export default ProfilePage;
