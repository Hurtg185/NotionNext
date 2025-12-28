// components/TranslatorChat.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, Send, Settings, X, 
  Volume2, Copy, BrainCircuit, ChevronDown,
  ExternalLink, Sparkles, ArrowRightLeft,
  Loader2, Star, Languages, Check, Globe, 
  Voicemail, ChevronUp, MicOff, Play, Pause, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- 语音配置 (移除类型注解) ---
const VOICE_LIBRARY = {
  "中文": [
    { name: '小晓 (女声)', id: 'zh-CN-XiaoxiaoNeural' },
    { name: '云希 (男声)', id: 'zh-CN-YunxiNeural' },
    { name: '晓辰 (女声)', id: 'zh-CN-XiaochenNeural' },
    { name: '云健 (男声)', id: 'zh-CN-YunjianNeural' },
  ],
  "英文": [
    { name: 'Jenny (女声)', id: 'en-US-JennyNeural' },
    { name: 'Guy (男声)', id: 'en-US-GuyNeural' },
    { name: 'Aria (女声)', id: 'en-US-AriaNeural' },
    { name: 'Davis (男声)', id: 'en-US-DavisNeural' },
  ],
  "缅甸语": [
    { name: 'Nilar (女声)', id: 'my-MM-NilarNeural' },
    { name: 'Thiha (男声)', id: 'my-MM-ThihaNeural' },
  ]
};

const DEFAULT_VOICES = {
  "中文": 'zh-CN-XiaoxiaoNeural',
  "英文": 'en-US-JennyNeural',
  "缅甸语": 'my-MM-NilarNeural'
};

// --- 消息组件 ---
const MessageBubble = ({ message, onCopy, onSpeak, isSpeaking }) => {
  const isUser = message.role === 'user';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-gray-100 text-gray-800 rounded-bl-md'
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        
        {!isUser && (
          <div className="flex gap-2 mt-2 pt-2 border-t border-gray-200">
            <button
              onClick={() => onCopy(message.content)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
              title="复制"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => onSpeak(message.content)}
              className={`p-1 hover:bg-gray-200 rounded transition-colors ${
                isSpeaking ? 'text-blue-600' : ''
              }`}
              title="朗读"
            >
              <Volume2 size={14} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// --- 主组件 ---
export default function TranslatorChat() {
  // 状态管理
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sourceLang, setSourceLang] = useState('中文');
  const [targetLang, setTargetLang] = useState('缅甸语');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICES);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Refs
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  
  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // 初始化语音合成
  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
  }, []);
  
  // 交换语言
  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };
  
  // 复制文本
  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };
  
  // 语音朗读
  const handleSpeak = (text) => {
    if (!synthRef.current) return;
    
    // 停止当前朗读
    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 设置语言
    if (text.match(/[\u1000-\u109F]/)) {
      utterance.lang = 'my-MM';
    } else if (text.match(/[\u4e00-\u9fa5]/)) {
      utterance.lang = 'zh-CN';
    } else {
      utterance.lang = 'en-US';
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    synthRef.current.speak(utterance);
  };
  
  // 语音识别
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('您的浏览器不支持语音识别');
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    
    // 根据源语言设置识别语言
    const langMap = {
      '中文': 'zh-CN',
      '英文': 'en-US',
      '缅甸语': 'my-MM'
    };
    recognitionRef.current.lang = langMap[sourceLang] || 'zh-CN';
    
    recognitionRef.current.onstart = () => {
      setIsListening(true);
    };
    
    recognitionRef.current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setInputText(transcript);
    };
    
    recognitionRef.current.onend = () => {
      setIsListening(false);
    };
    
    recognitionRef.current.onerror = (event) => {
      console.error('语音识别错误:', event.error);
      setIsListening(false);
    };
    
    recognitionRef.current.start();
  };
  
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };
  
  // 发送翻译请求
  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;
    
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputText.trim()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: userMessage.content,
          sourceLang,
          targetLang
        }),
      });
      
      if (!response.ok) {
        throw new Error('翻译请求失败');
      }
      
      const data = await response.json();
      
      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.translation || data.result || '翻译完成'
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('翻译错误:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `翻译失败: ${error.message}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 键盘事件处理
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 头部 */}
      <header className="flex items-center justify-between px-4 py-3 bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
            <Languages size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">中缅翻译助手</h1>
            <p className="text-xs text-gray-400">AI 智能翻译</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <Settings size={20} className="text-gray-300" />
        </button>
      </header>
      
      {/* 语言选择栏 */}
      <div className="flex items-center justify-center gap-4 py-3 bg-black/10 border-b border-white/5">
        <select
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
          className="px-4 py-2 bg-white/10 text-white rounded-lg border border-white/20 focus:outline-none focus:border-blue-500"
        >
          <option value="中文" className="text-black">中文</option>
          <option value="缅甸语" className="text-black">缅甸语</option>
          <option value="英文" className="text-black">英文</option>
        </select>
        
        <button
          onClick={swapLanguages}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          title="交换语言"
        >
          <ArrowRightLeft size={20} className="text-blue-400" />
        </button>
        
        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="px-4 py-2 bg-white/10 text-white rounded-lg border border-white/20 focus:outline-none focus:border-blue-500"
        >
          <option value="缅甸语" className="text-black">缅甸语</option>
          <option value="中文" className="text-black">中文</option>
          <option value="英文" className="text-black">英文</option>
        </select>
      </div>
      
      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 bg-white/5 rounded-full mb-4">
              <Sparkles size={48} className="text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">开始翻译</h2>
            <p className="text-gray-400 max-w-md">
              输入中文或缅甸语文本，AI 将为您提供高质量翻译
            </p>
          </div>
        )}
        
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onCopy={handleCopy}
            onSpeak={handleSpeak}
            isSpeaking={isSpeaking}
          />
        ))}
        
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span className="text-gray-600">翻译中...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* 输入区域 */}
      <div className="p-4 bg-black/20 backdrop-blur-lg border-t border-white/10">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`p-3 rounded-full transition-all ${
              isListening 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
            title={isListening ? '停止录音' : '语音输入'}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <div className="flex-1 relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`输入${sourceLang}文本...`}
              rows={1}
              className="w-full px-4 py-3 bg-white/10 text-white placeholder-gray-400 rounded-2xl border border-white/20 focus:outline-none focus:border-blue-500 resize-none"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isLoading}
            className={`p-3 rounded-full transition-all ${
              inputText.trim() && !isLoading
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:opacity-90'
                : 'bg-white/10 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
      
      {/* 复制成功提示 */}
      <AnimatePresence>
        {copied && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-green-500 text-white rounded-lg flex items-center gap-2"
          >
            <Check size={16} />
            已复制到剪贴板
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 设置面板 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-800 rounded-2xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">设置</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1 hover:bg-white/10 rounded-lg"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    中文语音
                  </label>
                  <select
                    value={selectedVoice['中文']}
                    onChange={(e) => setSelectedVoice(prev => ({
                      ...prev,
                      '中文': e.target.value
                    }))}
                    className="w-full px-3 py-2 bg-white/10 text-white rounded-lg border border-white/20"
                  >
                    {VOICE_LIBRARY['中文'].map(voice => (
                      <option key={voice.id} value={voice.id} className="text-black">
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-2">
                    缅甸语语音
                  </label>
                  <select
                    value={selectedVoice['缅甸语']}
                    onChange={(e) => setSelectedVoice(prev => ({
                      ...prev,
                      '缅甸语': e.target.value
                    }))}
                    className="w-full px-3 py-2 bg-white/10 text-white rounded-lg border border-white/20"
                  >
                    {VOICE_LIBRARY['缅甸语'].map(voice => (
                      <option key={voice.id} value={voice.id} className="text-black">
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
