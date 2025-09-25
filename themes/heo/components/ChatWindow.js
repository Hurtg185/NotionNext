// themes/heo/components/ChatWindow.js (已修复编译错误 + 完整代码)

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile, getMessagesForChat, markChatAsRead, sendMessage } from '@/lib/chat';
import ChatMessage from './ChatMessage';
import ChatSettingsPanel from './ChatSettingsPanel';
import { useDrawer } from '@/lib/DrawerContext';
import QiniuUploader from '@/components/QiniuUploader';
import axios from 'axios';
import TextareaAutosize from 'react-textarea-autosize';

const ChatWindow = ({ chatId, conversation }) => {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const { closeDrawer } = useDrawer();
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [background, setBackground] = useState('default');
  const messagesEndRef = useRef(null);

  const [textContent, setTextContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef(null);
  
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const footerRef = useRef(null);
  const initialViewportHeightRef = useRef(0);

  // 语音录制状态 (完整保留)
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);

  // 1. 获取对方用户信息
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      if (currentUser && conversation) {
        const targetId = conversation.participants.find(p => p !== currentUser.uid);
        if (targetId) {
          const profile = await getUserProfile(targetId);
          setOtherUser(profile);
        }
      }
      setIsLoading(false);
    };
    fetchData();
  }, [conversation, currentUser]);

  // 2. 实时获取聊天消息
  useEffect(() => {
    if (!chatId) return;
    const unsubscribe = getMessagesForChat(chatId, (newMessages) => {
      setMessages(newMessages);
      if (currentUser && newMessages.length > 0) {
        markChatAsRead(chatId, currentUser.uid);
      }
    });
    return () => unsubscribe();
  }, [chatId, currentUser]);

  // 3. 聊天消息滚动到底部
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, keyboardHeight]);

  // 4. 加载和监听聊天背景变化
  useEffect(() => {
    const loadBackground = () => {
      if (typeof window !== 'undefined') {
        const savedBackground = localStorage.getItem(`chat_background_${chatId}`);
        setBackground(savedBackground || 'default');
      }
    };
    loadBackground();
    if (typeof window !== 'undefined') {
      const handleBackgroundChange = (event) => setBackground(event.detail.background);
      window.addEventListener('chat-background-change', handleBackgroundChange);
      return () => window.removeEventListener('chat-background-change', handleBackgroundChange);
    }
  }, [chatId]);

  // 6. 键盘避让逻辑
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initialViewportHeightRef.current === 0) {
      initialViewportHeightRef.current = window.innerHeight;
    }
    const handleViewportChange = () => {
      let calculatedKeyboardHeight = 0;
      if (window.visualViewport) {
        calculatedKeyboardHeight = initialViewportHeightRef.current - window.visualViewport.height;
      } else {
        if (window.innerHeight < initialViewportHeightRef.current) {
          calculatedKeyboardHeight = initialViewportHeightRef.current - window.innerHeight;
        }
      }
      setKeyboardHeight(calculatedKeyboardHeight > 80 ? calculatedKeyboardHeight : 0);
    };
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      return () => window.visualViewport.removeEventListener('resize', handleViewportChange);
    } else {
      window.addEventListener('resize', handleViewportChange);
      return () => window.removeEventListener('resize', handleViewportChange);
    }
  }, []);

  const getTopBarRoleTag = (profile) => {
    if (!profile) return null;
    if (profile.isAdmin) return <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full ml-2 font-bold flex items-center"><i className="fas fa-crown text-xs mr-1"></i> 站长</span>;
    if (profile.isModerator) return <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full ml-2 font-bold flex items-center"><i className="fas fa-shield-alt text-xs mr-1"></i> 管理员</span>;
    return null;
  };

  const handleTopBarClick = () => {
    if (otherUser?.id) {
      closeDrawer();
      setTimeout(() => router.push(`/profile/${otherUser.id}`), 100);
    }
  };

  const cleanupInput = () => {
    setTextContent('');
    setRecordedAudio(null);
    setIsUploading(false);
  };
  
  const handleSendMessage = async (payloadOverride = null) => {
    if (isUploading || !currentUser) return;
    
    let messagePayload = payloadOverride || { text: textContent.trim() };

    try {
        if (recordedAudio && !payloadOverride) {
            setIsUploading(true);
            const tokenResponse = await axios.get('/api/qiniu/upload-token?fileType=audio');
            const formData = new FormData();
            formData.append('file', recordedAudio.file);
            formData.append('token', tokenResponse.data.token);
            const QINIU_UPLOAD_URL = 'https://up-as0.qiniup.com';
            const uploadResponse = await axios.post(QINIU_UPLOAD_URL, formData);
            const domain = process.env.NEXT_PUBLIC_QINIU_DOMAIN;
            messagePayload.mediaUrl = `${domain}/${uploadResponse.data.key}`;
            messagePayload.mediaType = 'audio';
        }

        if (!messagePayload.text && !messagePayload.mediaUrl) {
            return;
        }

        await sendMessage(currentUser, chatId, messagePayload);
        cleanupInput();
    } catch (error) {
        console.error("发送消息失败:", error.message);
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        alert(`发送失败: ${errorMessage}`);
        setIsUploading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleUploadSuccess = (uploadResult) => {
    const { finalUrl, mimeType } = uploadResult;
    const type = mimeType.startsWith('image/') ? 'image' : 'video';
    
    handleSendMessage({
        text: '',
        mediaUrl: finalUrl,
        mediaType: type,
        thumbnailUrl: uploadResult.thumbnailUrl || null
    });
    
    setIsUploading(false);
  };

  const handleUploadStart = () => setIsUploading(true);
  const handleUploadError = (err) => {
    alert(err);
    setIsUploading(false);
  };

  const startRecording = async () => {
    cleanupInput();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = event => {
            audioChunksRef.current.push(event.data);
        };
        
        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            setRecordedAudio({ file: audioFile, url: audioUrl });
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorderRef.current.start();
        setIsRecording(true);
        setIsPaused(false);
        recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) {
        alert("无法访问麦克风。请检查浏览器权限。");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(recordingTimerRef.current);
    setRecordingTime(0);
  };
  
  const togglePauseRecording = () => {
    if (isPaused) {
        mediaRecorderRef.current?.resume();
        recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } else {
        mediaRecorderRef.current?.pause();
        clearInterval(recordingTimerRef.current);
    }
    setIsPaused(!isPaused);
  };
  
  const cancelRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording' || mediaRecorderRef.current?.state === 'paused') {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setIsPaused(false);
    setRecordedAudio(null);
    clearInterval(recordingTimerRef.current);
    setRecordingTime(0);
  };

  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${('0' + seconds % 60).slice(-2)}`;

  const showSendButton = textContent.trim() || recordedAudio;

  if (isLoading || !otherUser) {
    return <div className="flex flex-col h-full items-center justify-center">正在加载聊天...</div>;
  }

  const isBgImage = background !== 'default';

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden bg-cover bg-center" style={{ backgroundImage: isBgImage ? `url(${background})` : 'none' }}>
      {!isBgImage && <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900 z-0"></div>}
      {isBgImage && <div className="absolute inset-0 bg-black/30 z-0"></div>}

      <header className={`relative z-20 flex-shrink-0 p-3 h-14 flex justify-between items-center ${isBgImage ? 'bg-black/20 text-white' : 'bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white'} border-b border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg`}>
        <div className="flex-grow flex justify-center items-center relative cursor-pointer" onClick={handleTopBarClick}>
          <h2 className="font-bold text-lg text-center truncate">{otherUser?.displayName || '未知用户'}</h2>
          {getTopBarRoleTag(otherUser)}
        </div>
        <button onClick={() => setShowSettings(true)} className={`p-2 rounded-full transition ${isBgImage ? 'text-white/80 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
          <i className="fas fa-ellipsis-v"></i>
        </button>
      </header>
      
      <main className="relative z-10 flex-1 w-full overflow-y-auto overflow-x-hidden p-4" style={{ paddingBottom: `calc(1rem + ${footerRef.current?.offsetHeight || 60}px)` }}>
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} chatId={chatId} currentUserProfile={currentUser} otherUserProfile={otherUser}/>
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* 【核心修复】补全了整个 footer 及其闭合标签 */}
      <footer ref={footerRef} className={`fixed bottom-0 left-0 right-0 z-20 flex-shrink-0 p-3 ${isBgImage ? 'bg-black/20' : 'bg-white/50 dark:bg-gray-800/50'} border-t border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg transition-transform duration-200 ease-in-out`} style={{ transform: `translateY(${-keyboardHeight}px)` }}>
        <div className="relative">
          {recordedAudio && (
             <div className="flex items-center p-2 rounded-lg mb-2 bg-gray-200 dark:bg-gray-600">
                <audio src={recordedAudio.url} controls className="flex-grow" />
                <button onClick={cancelRecording} className="ml-2 text-red-500 p-2 text-lg">&times;</button>
             </div>
          )}
          
          {isRecording ? (
            <div className="flex items-center justify-between p-2 rounded-full bg-gray-200 dark:bg-gray-700">
                <button onClick={cancelRecording} className="text-red-500 p-2">删除</button>
                <div className="flex items-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                    <span>{formatTime(recordingTime)}</span>
                </div>
                <button onClick={togglePauseRecording} className="p-2">{isPaused ? <i className="fas fa-play"></i> : <i className="fas fa-pause"></i>}</button>
                <button onClick={stopRecording} className="bg-green-500 text-white rounded-full px-4 py-2 ml-2">完成</button>
            </div>
          ) : (
            <div className="flex items-end space-x-2">
                <div className={`relative flex-grow flex items-center rounded-full ${isBgImage ? 'bg-black/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    <div className="flex items-center pl-2">
                        <QiniuUploader accept="image/*,video/*" onUploadSuccess={handleUploadSuccess} onUploadStart={handleUploadStart} onUploadError={handleUploadError}>
                            <button disabled={isUploading} className={`p-2 rounded-full transition ${isBgImage ? 'text-white/80' : 'text-gray-500'}`} aria-label="上传图片或视频">
                                {isUploading ? (
                                    <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <i className="far fa-image text-xl"></i>
                                )}
                            </button>
                        </QiniuUploader>
                        <QiniuUploader accept="image/*" onUploadSuccess={handleUploadSuccess} onUploadStart={handleUploadStart} onUploadError={handleUploadError} captureMode="environment">
                             <button disabled={isUploading} className={`p-2 rounded-full transition ${isBgImage ? 'text-white/80' : 'text-gray-500'}`} aria-label="拍照">
                                <i className="fas fa-camera text-xl"></i>
                            </button>
                        </QiniuUploader>
                    </div>

                    <TextareaAutosize
                      ref={textareaRef}
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="输入消息..."
                      minRows={1}
                      maxRows={5}
                      className={`w-full px-2 py-2.5 bg-transparent resize-none overflow-hidden focus:outline-none ${isBgImage ? 'text-white placeholder-gray-300' : 'text-gray-900 dark:text-white'}`}
                    />
                </div>

                {showSendButton ? (
                  <button onClick={() => handleSendMessage()} className="w-12 h-12 flex-shrink-0 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 flex items-center justify-center transition-transform transform hover:scale-110" disabled={isUploading}>
                    <i className="fas fa-paper-plane"></i>
                  </button>
                ) : (
                  <button onClick={startRecording} className="w-12 h-12 flex-shrink-0 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 flex items-center justify-center transition-transform transform hover:scale-110">
                    <i className="fas fa-microphone"></i>
                  </button>
                )}
            </div>
          )}
        </div>
      </footer>

      {showSettings && <ChatSettingsPanel onClose={() => setShowSettings(false)} chatId={chatId} />}
    </div>
  );
};

export default ChatWindow;
