// themes/heo/components/ChatWindow.js (最终优化版 - 仅支持文本和语音)

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { getUserProfile, getMessagesForChat, markChatAsRead, sendMessage } from '@/lib/chat';
import ChatMessage from './ChatMessage';
import ChatSettingsPanel from './ChatSettingsPanel';
import { useDrawer } from '@/lib/DrawerContext';
// 【已移除】QiniuUploader 不再需要
// import QiniuUploader from '@/components/QiniuUploader'; 
import axios from 'axios'; // 语音上传仍需要 axios

// 【已移除】EmojiPicker 不再需要
// import EmojiPicker, { Theme } from 'emoji-picker-react';
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
  // 【已移除】mediaToSend 状态不再需要
  // const [mediaToSend, setMediaToSend] = useState(null); 
  const [isUploading, setIsUploading] = useState(false); // 仅用于语音上传

  // 【已移除】表情相关的 state 和 ref 不再需要
  // const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // const emojiPickerRef = useRef(null);
  const textareaRef = useRef(null);
  
  // 键盘避让相关 (保留)
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

  // ... (所有 useEffect 逻辑保持不变)

  const cleanupInput = () => {
    setTextContent('');
    // 【已移除】setMediaToSend(null);
    setRecordedAudio(null);
    setIsUploading(false);
  };
  
  const handleSendMessage = async (payloadOverride = null) => {
    if (isUploading || !currentUser) return;
    
    let messagePayload = payloadOverride || { text: textContent.trim() };

    try {
        // 处理待发送的语音消息 (保留)
        if (recordedAudio && !payloadOverride) {
            setIsUploading(true);
            const tokenResponse = await axios.get('/api/qiniu/upload-token?fileType=audio');
            const formData = new FormData();
            formData.append('file', recordedAudio.file);
            formData.append('token', tokenResponse.data.token);
            const QINIU_UPLOAD_URL = 'https://up-as0.qiniup.com'; // 假设这是您的语音上传地址
            const uploadResponse = await axios.post(QINIU_UPLOAD_URL, formData);
            const domain = process.env.NEXT_PUBLIC_QINIU_DOMAIN;
            messagePayload.mediaUrl = `${domain}/${uploadResponse.data.key}`;
            messagePayload.mediaType = 'audio';
            // 语音消息不需要缩略图
            messagePayload.thumbnailUrl = null; 
        }

        // 检查最终是否有内容要发送 (只检查文本或语音媒体)
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

  // 【已移除】媒体上传成功回调 (因为不再直接上传图片/视频)
  // const handleUploadSuccess = (uploadResult) => { /* ... */ };
  // const handleUploadStart = () => setIsUploading(true);
  // const handleUploadError = (err) => { alert(err); setIsUploading(false); };

  // 语音录制函数 (完整保留)
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

  const stopRecording = () => { /* ... (函数体无变化) ... */ };
  const togglePauseRecording = () => { /* ... (函数体无变化) ... */ };
  const cancelRecording = () => { /* ... (函数体无变化) ... */ };
  const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${('0' + seconds % 60).slice(-2)}`;

  // 【修改】showSendButton 逻辑，不再依赖 mediaToSend
  const showSendButton = textContent.trim() || recordedAudio;

  // ... (loading 状态和背景渲染逻辑保留)

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
          // 聊天消息组件现在要处理没有图片/视频的情况
          <ChatMessage key={msg.id} message={msg} chatId={chatId} currentUserProfile={currentUser} otherUserProfile={otherUser}/>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer ref={footerRef} className={`fixed bottom-0 left-0 right-0 z-20 flex-shrink-0 p-3 ${isBgImage ? 'bg-black/20' : 'bg-white/50 dark:bg-gray-800/50'} border-t border-gray-200/20 dark:border-gray-700/20 backdrop-blur-lg transition-transform duration-200 ease-in-out`} style={{ transform: `translateY(${-keyboardHeight}px)` }}>
        <div className="relative">
          {/* 【已移除】showEmojiPicker 相关的 JSX */}
          {/* 【已移除】mediaToSend 相关的预览 JSX */}
          
          {recordedAudio && ( /* 录音预览区保留 */
             <div className="flex items-center p-2 rounded-lg mb-2 bg-gray-200 dark:bg-gray-600">
                <audio src={recordedAudio.url} controls className="flex-grow" />
                <button onClick={cancelRecording} className="ml-2 text-red-500 p-2 text-lg">&times;</button>
             </div>
          )}
          
          {isRecording ? ( /* 录音控制条保留 */ ) : (
            <div className="flex items-end space-x-2">
                <div className={`relative flex-grow flex items-center rounded-full ${isBgImage ? 'bg-black/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                    {/* 【已移除】图片和拍照按钮 */}
                    
                    <TextareaAutosize
                      ref={textareaRef}
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="输入消息..."
                      minRows={1}
                      maxRows={5}
                      className={`w-full px-4 py-2.5 bg-transparent resize-none overflow-hidden focus:outline-none ${isBgImage ? 'text-white placeholder-gray-300' : 'text-gray-900 dark:text-white'}`}
                    />

                    {/* 【已移除】表情按钮 */}
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
