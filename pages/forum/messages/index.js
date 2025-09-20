// pages/forum/messages/index.js (最终合版)
import React, { useState } from 'react';
import { LayoutBase } from '@/themes/heo';
import dynamic from 'next/dynamic';

import MessageHeader from '@/themes/heo/components/MessageHeader';

const ConversationList = dynamic(() => import('@/themes/heo/components/ConversationList'), {
  ssr: false,
  loading: () => <div className="p-4 text-center text-gray-500">加载私信列表...</div>
});
const NotificationList = dynamic(() => import('@/themes/heo/components/NotificationList'), { ssr: false, loading: () => <div className="p-4 text-center text-gray-500">加载通知...</div> });
const DiscoverPage = dynamic(() => import('@/themes/heo/components/DiscoverPage'), { ssr: false, loading: () => <div className="p-4 text-center text-gray-500">加载发现...</div> });
const ContactList = dynamic(() => import('@/themes/heo/components/ContactList'), { ssr: false, loading: () => <div className="p-4 text-center text-gray-500">加载联系人...</div> });

const MessagesPage = () => {
  const [activeTab, setActiveTab] = useState('messages');

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <MessageHeader activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="flex-grow">
          {activeTab === 'messages' && <ConversationList />}
          {activeTab === 'notifications' && <NotificationList />}
          {activeTab === 'discover' && <DiscoverPage />}
          {activeTab === 'contacts' && <ContactList />}
        </div>
      </div>
    </LayoutBase>
  );
};

export default MessagesPage;
