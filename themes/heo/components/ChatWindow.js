// themes/heo/components/ChatWindow.js (最终修复版 - 修复所有已知问题)

import React, 'react';
import { useState, useEffect, useRef } from 'react';
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
  const [pastedImage, setPastedImage] = useState(null); // 用于粘贴板图片预览

  const [textContent, setTextContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef(null);
  const footerRef = useRef(null);

  // 语音录制状态
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);

  // 数据获取和初始化 Effect
  useEffect(() => {
    const fetchChatData = async () => {
      if (!currentUser || !chatId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const otherUserId = conversation.participants.find(p => p !== currentUser.id);
        const profile = await getUserProfile(otherUserId);
        setOtherUser(profile);

        const unsubscribe = getMessagesForChat(chatId, newMessages => {
          setMessages(newMessages);
        });

        if (conversation.unread) {
          await markChatAsRead(chatId, currentUser.id);
        }

        // 获取并设置背景
        const storedBackground = localStorage.getItem(`chatBg_${chatId}`);
        if (storedBackground) {
          setBackground(storedBackground);
        } else {
          setBackground('default');
        }

        return () => unsubscribe();
      } catch (error) {
        console.error("获取聊天数据失败:", error);
        // 可以选择跳转到错误页或显示错误信息
        router.push('/404');
      } finally {
        setIsLoading(false);
      }
    };

    fetchChatData();
  }, [chatId, currentUser, conversation]);
  
  // 消息列表滚动到底部
  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(timer);
  }, [messages]);

  // 处理粘贴事件，用于图片粘贴
  useEffect(() => {
    const handlePaste = (event) => {
        const items = event.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                const url = URL.createObjectURL(file);
                setPastedImage({ file, url });
                break; // 只处理第一张图片
            }
        }
    };
    const textarea = textareaRef.current;
    if (textarea) {
        textarea.addEventListener('paste', handlePaste);
    }
    return () => {
        if (textarea) {
            textarea.removeEventListener('paste', handlePaste);
        }
    };
  }, []);

  // 清理输入状态（文本、录音、粘贴图片）
  const cleanupInput = () => {
    setTextContent('');
    setRecordedAudio(null);
    setPastedImage(null);
    setIsUploading(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // 重置输入框高度
    }
  };
  
  // 发送消息核心函数
  const handleSendMessage = async (payloadOverride = null) => {
    if (isUploading || !currentUser) return;
    
    let messagePayload = payloadOverride || { text: textContent.trim() };
    let fileToUpload = null;

    // 根据当前状态判断要发送的内容
    if (pastedImage && !payloadOverride) {
        fileToUpload = pastedImage.file;
        messagePayload.mediaType = 'image';
    } else if (recordedAudio && !payloadOverride) {
        fileToUpload = recordedAudio.file;
        messagePayload.mediaType = 'audio';
    }

    // 如果有文件需要上传（图片、音视频）
    try {
        if (fileToUpload) {
            setIsUploading(true);
            const tokenResponse = await axios.get(`/api/qiniu/upload-token?fileType=${messagePayload.mediaType}`);
            const formData = new FormData();
            formData.append('file', fileToUpload);
            formData.append('token', tokenResponse.data.token);
            
            const QINIU_UPLOAD_URL = 'https://up-as0.qiniup.com'; // 七牛上传地址，根据自己区域修改
            const uploadResponse = await axios.post(QINIU_UPLOAD_URL, formData);
            
            const domain = process.env.NEXT_PUBLIC_QINIU_DOMAIN;
            messagePayload.mediaUrl = `${domain}/${uploadResponse.data.key}`;
            const key = uploadResponse.data.key;
            
            // 为图片和视频生成缩略图
            if(messagePayload.mediaType === 'video') {
                // 视频缩略图（假设七牛云配置了视频帧截取）
                messagePayload.thumbnailUrl = `${domain}/${key}?vframe/jpg/offset/1`;
            } else if (messagePayload.mediaType === 'image') {
                // 图片缩略图
                messagePayload.thumbnailUrl = `${messagePayload.mediaUrl}?imageView2/2/w/400`; // 使用七牛的图片处理参数
            }
        }

        // 确保有内容才发送（文本或媒体）
        if (!messagePayload.text && !messagePayload.mediaUrl) return;

        await sendMessage(currentUser, chatId, messagePayload);
        cleanupInput();

    } catch (error) {
        console.error("发送消息失败:", error.message);
        alert(`发送失败: ${error.message}`);
    } finally {
        setIsUploading(false);
    }
  };

  // 文件/拍照上传成功后的回调
  const handleUploadSuccess = (uploadResult) => {
    const { finalUrl, mimeType, key } = uploadResult;
    const type = mimeType.startsWith('image/') ? 'image' : 'video';
    const domain = process.env.NEXT_PUBLIC_QINIU_DOMAIN;
    let thumbnailUrl = null;

    if (type === 'image') {
        thumbnailUrl = `${finalUrl}?imageView2/2/w/400`;
    } else if (type === 'video') {
        thumbnailUrl = `${domain}/${key}?vframe/jpg/offset/1`;
    }
    
    handleSendMessage({ text: '', mediaUrl: finalUrl, mediaType: type, thumbnailUrl });
  };
  
  // ==================================
  // 语音录制完整功能
  // ==================================

  const startRecording = async () => {
    cleanupInput();
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = event => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            setRecordedAudio({ file: audioFile, url: audioUrl });
            // 停止媒体流
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorderRef.current.start();
        setIsRecording(true);
        setIsPaused(false);
        setRecordingTime(0);
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(t => t + 1);
        }, 1000);

    } catch (err) {
        console.error("麦克风访问失败:", err);
        alert("无法访问麦克风。请检查浏览器权限设置。");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(recordingTimerRef.current);
  };

  const togglePauseRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } else {
      mediaRecorderRef.current.pause();
      clearInterval(recordingTimerRef.current);
    }
    setIsPaused(!isPaused);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    mediaRecorderRef.current = null;
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setRecordedAudio(null);
    audioChunksRef.current = [];
  };

  // 控制发送按钮的显示逻辑
  const showSendButton = textContent.trim() || recordedAudio || pastedImage;
  // 格式化录音时间
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full">加载中...</div>;
  }
  
  return (
    <div className="flex flex-col h-full w-full bg-cover bg-center transition-all duration-300" style={{ backgroundImage: `url(${background !== 'default' ? background : ''})` }}>
      {background === 'default' && <div className="absolute inset-0 bg-gray-50 dark:bg-gray-800 z-0"></div>}
      {background !== 'default' && <div className="absolute inset-0 bg-black/30 z-0"></div>}
      
      <header className="flex-shrink-0 z-20 flex items-center justify-between p-3 border-b bg-white/70 dark:bg-black/50 backdrop-blur-md dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <button onClick={closeDrawer} className="md:hidden p-2">
            <i className="fas fa-arrow-left"></i>
          </button>
          <img src={otherUser?.avatar || '/default-avatar.png'} alt="avatar" className="w-10 h-10 rounded-full" />
          <h2 className="text-lg font-semibold">{otherUser?.displayName || '聊天'}</h2>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="p-2">
          <i className="fas fa-ellipsis-h"></i>
        </button>
      </header>
      
      {showSettings && <ChatSettingsPanel chatId={chatId} currentBackground={background} onBackgroundChange={setBackground} onClose={() => setShowSettings(false)} />}
      
      <main className="flex-1 w-full overflow-y-auto overflow-x-hidden p-4 z-10">
        {messages.map(msg => (
          <ChatMessage 
            key={msg.id} 
            message={msg} 
            isSender={msg.senderId === currentUser.id} 
            otherUser={otherUser} 
            currentUser={currentUser}
          />
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer ref={footerRef} className="flex-shrink-0 z-20 p-2 sm:p-4 bg-white/70 dark:bg-black/50 backdrop-blur-md">
        <div className="relative">
          {/* 粘贴板图片预览 */}
          {pastedImage && (
            <div className="relative p-2 rounded-lg mb-2 bg-gray-200 dark:bg-gray-600 w-fit">
              <button onClick={() => setPastedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs z-10">&times;</button>
              <img src={pastedImage.url} alt="粘贴的图片预览" className="max-h-28 rounded" />
            </div>
          )}
          
          {/* 录音预览 */}
          {recordedAudio && !isRecording && (
            <div className="flex items-center justify-between p-2 rounded-lg mb-2 bg-gray-200 dark:bg-gray-700">
              <audio src={recordedAudio.url} controls className="w-full" />
              <button onClick={() => setRecordedAudio(null)} className="ml-2 text-red-500 p-2">
                <i className="fas fa-trash"></i>
              </button>
            </div>
          )}

          {/* 录音控制条 */}
          {isRecording && (
              <div className="flex items-center justify-between p-2 h-14 rounded-full mb-2 bg-gray-200 dark:bg-gray-700">
                  <button onClick={cancelRecording} className="text-red-500 px-4 py-2">
                      取消
                  </button>
                  <div className="flex flex-col items-center">
                      <div className="text-sm font-mono">{formatTime(recordingTime)}</div>
                      <div className="text-xs text-gray-500">{isPaused ? '已暂停' : '正在录音...'}</div>
                  </div>
                  <div className="flex items-center">
                    <button onClick={togglePauseRecording} className="text-blue-500 px-4 py-2">
                        <i className={`fas ${isPaused ? 'fa-play' : 'fa-pause'}`}></i>
                    </button>
                    <button onClick={stopRecording} className="bg-green-500 text-white rounded-full w-10 h-10 flex items-center justify-center ml-2">
                        <i className="fas fa-check"></i>
                    </button>
                  </div>
              </div>
          )}
          
          {/* 主输入区域 */}
          {!isRecording && (
            <div className="flex items-end space-x-2">
              <div className="relative flex-grow flex items-center rounded-full bg-gray-100 dark:bg-gray-800 border border-transparent focus-within:border-blue-500">
                <div className="flex items-center pl-2">
                  {/* 从相册选择 */}
                  <QiniuUploader 
                    onUploadSuccess={handleUploadSuccess} 
                    onUploadStart={() => setIsUploading(true)}
                    onUploadEnd={() => setIsUploading(false)}
                    fileType="media"
                  >
                    <button className="p-2 text-gray-500 hover:text-blue-500">
                      <i className="fas fa-photo-video"></i>
                    </button>
                  </QiniuUploader>
                  {/* 拍照/录像 */}
                  <QiniuUploader 
                    onUploadSuccess={handleUploadSuccess}
                    onUploadStart={() => setIsUploading(true)}
                    onUploadEnd={() => setIsUploading(false)}
                    fileType="media"
                    capture="environment"
                  >
                     <button className="p-2 text-gray-500 hover:text-blue-500">
                      <i className="fas fa-camera"></i>
                    </button>
                  </QiniuUploader>
                </div>
                <TextareaAutosize
                  ref={textareaRef}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="输入消息..."
                  className="w-full bg-transparent px-3 py-2.5 text-sm resize-none focus:outline-none"
                  rows={1}
                  maxRows={5} // 限制最大高度为5行
                />
              </div>
              {/* 发送或语音按钮 */}
              {showSendButton ? (
                <button onCl
