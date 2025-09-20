// pages/forum/messages.js (私信列2表)

import React from 'react';
import { LayoutBase } from '@/themes/heo';
import dynamic from 'next/dynamic';

// 【核心】使用 dynamic 动态导入 ConversationList，以避免 SSR 错误
// 这会告诉 Next.js，ConversationList 是一个客户端组件，只在浏览器中渲染
const ConversationList = dynamic(() => import('@/themes/heo/components/ConversationList'), {
  ssr: false, // 禁用服务器端渲染
  loading: () => <div className="p-4 text-center text-gray-500">加载私信列表...</div> // 加载时显示的占位符
});

const MessagesPage = () => {
  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* 直接渲染私信列表 */}
        <ConversationList />
      </div>
    </LayoutBase>
  );
};

export default MessagesPage;
