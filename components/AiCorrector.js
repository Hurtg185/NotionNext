// /components/DangbeiAiEmbed.js
import React from 'react';

const DangbeiAiEmbed = () => {
  return (
    <div className="w-full max-w-2xl mx-auto my-8 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <h2 className="text-3xl font-bold mb-4 text-center text-gray-800 dark:text-white">当贝 AI 助手</h2>
      <div className="relative w-full" style={{ paddingTop: '100%', position: 'relative' }}> {/* 100% height to make it square */}
        <iframe
          src="https://ai.dangbei.com/chat" // 当贝 AI 的聊天页面 URL
          title="当贝 AI 聊天"
          width="100%"
          height="100%"
          style={{ border: 'none', position: 'absolute', top: 0, left: 0 }}
          allow="microphone; camera" // 如果当贝 AI 需要麦克风/摄像头权限
        >
          您的浏览器不支持 iframe。
        </iframe>
      </div>
      <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
        此为嵌入的当贝 AI 网页，页面样式由当贝提供。
      </p>
    </div>
  );
};

export default DangbeiAiEmbed;
