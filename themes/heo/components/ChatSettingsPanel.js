// themes/heo/components/ChatSettingsPanel.js (100%完整修复版)

import React, 'react'
import { useState, useEffect } from 'react'

// 【核心修复】: 恢复 SettingsItem 组件的完整实现代码
const SettingsItem = ({ icon, label, onClick, isDestructive = false }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center p-4 text-left text-base font-semibold transition-colors duration-200 ${
      isDestructive 
        ? 'text-red-500 hover:bg-red-50/50' 
        : 'text-gray-800 dark:text-gray-100 hover:bg-black/5 dark:hover:bg-white/10'
    }`}
  >
    <i className={`${icon} w-6 text-center mr-4`}></i>
    <span>{label}</span>
  </button>
);

const ChatSettingsPanel = ({ onClose, chatId }) => {
  const handlePanelClick = e => e.stopPropagation()
  const fileInputRef = React.useRef(null)
  
  const handleBackgroundChange = event => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = e => {
      const imageUrl = e.target.result
      localStorage.setItem(`chat_bg_${chatId}`, imageUrl)
      window.dispatchEvent(new CustomEvent('chat-bg-change', { detail: { chatId, imageUrl } }))
      onClose()
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end" onClick={onClose}>
      <div className="w-full bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-lg rounded-t-2xl shadow-lg p-2 animate-slide-up" onClick={handlePanelClick}>
        <div className="py-2">
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleBackgroundChange} style={{ display: 'none' }} />
          <SettingsItem icon="fas fa-image" label="更换聊天背景" onClick={() => fileInputRef.current.click()} />
        </div>
        
        <BubbleStyleSettings chatId={chatId} />

        <hr className="my-2 border-gray-200/50 dark:border-gray-600/50" />
        <div className="py-2">
           <SettingsItem icon="fas fa-trash" label="清空聊天记录" isDestructive={true} onClick={() => alert('功能开发中...')} />
        </div>
        <hr className="my-2 border-gray-200/50 dark:border-gray-600/50" />
        
        <div className="py-2">
            <button
              onClick={onClose}
              className="w-full p-4 text-center text-base font-bold text-blue-500 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg"
            >
              取消
            </button>
        </div>
      </div>
      <style jsx global>{`
        @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
      `}</style>
    </div>
  )
}

const BubbleStyleSettings = ({ chatId }) => {
    const [currentTheme, setCurrentTheme] = useState(null)

    useEffect(() => {
        const savedTheme = localStorage.getItem(`chat_theme_${chatId}`)
        setCurrentTheme(savedTheme || 'default')
    }, [chatId])

    const themes = {
        default: { name: '默认', me: 'bg-blue-500 text-white', other: 'bg-gray-200 text-black' },
        purple: { name: '雅紫', me: 'bg-purple-500 text-white', other: 'bg-purple-100 text-purple-900' },
        green: { name: '清新', me: 'bg-green-500 text-white', other: 'bg-green-100 text-green-900' },
        dark: { name: '酷黑', me: 'bg-gray-700 text-white', other: 'bg-gray-300 text-black' }
    }

    const applyTheme = (themeKey) => {
        setCurrentTheme(themeKey)
        localStorage.setItem(`chat_theme_${chatId}`, themeKey)
        window.dispatchEvent(new CustomEvent('chat-style-change', { detail: { theme: themes[themeKey] } }))
    }

    if (!currentTheme) {
        return <div className="h-[120px] animate-pulse"></div>
    }

    return (
        <div className="px-4 py-2">
            <h3 className="font-bold text-lg mb-3 text-gray-800 dark:text-gray-100">聊天主题</h3>
            <div className="flex justify-around">
                {Object.entries(themes).map(([key, theme]) => (
                    <div key={key} className="flex flex-col items-center space-y-2 cursor-pointer" onClick={() => applyTheme(key)}>
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center border-2 ${currentTheme === key ? 'border-blue-500' : 'border-transparent'}`}>
                            <div className={`w-12 h-12 rounded-full flex overflow-hidden ${theme.me}`}>
                                <div className={`w-1/2 h-full ${theme.other}`}></div>
                            </div>
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-300">{theme.name}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default ChatSettingsPanel
