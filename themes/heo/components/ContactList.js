// themes/heo/components/ContactList.js (新增分类联系人列表好友关系粉丝)

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getFriends, getFollowing, getFollowers } from '@/lib/user';
import Link from 'next/link';

// 单个联系人项 (可复用)
const ContactItem = ({ user }) => (
  <Link href={`/profile/${user.id}`} passHref>
    <a className="flex items-center p-3 space-x-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
      <img src={user.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={user.displayName} className="w-12 h-12 rounded-full object-cover" />
      <div>
        <p className="font-bold text-gray-900 dark:text-white">{user.displayName}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{user.bio?.substring(0, 30)}...</p>
      </div>
    </a>
  </Link>
);

const ContactList = () => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('friends'); // 'friends', 'following', 'followers'
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  const subTabs = [
    { key: 'friends', name: '好友' },
    { key: 'following', name: '关注' },
    { key: 'followers', name: '粉丝' },
  ];

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setContacts([]);
      return;
    }

    setLoading(true);
    let unsubscribe;

    if (activeSubTab === 'friends') {
      unsubscribe = getFriends(user.uid, (data) => {
        setContacts(data);
        setLoading(false);
      });
    } else if (activeSubTab === 'following') {
      unsubscribe = getFollowing(user.uid, (data) => {
        setContacts(data);
        setLoading(false);
      });
    } else if (activeSubTab === 'followers') {
      unsubscribe = getFollowers(user.uid, (data) => {
        setContacts(data);
        setLoading(false);
      });
    }

    return () => unsubscribe && unsubscribe();
  }, [user, activeSubTab]);

  return (
    <div className="flex flex-col h-full">
      {/* 次级标签导航 */}
      <div className="flex justify-around border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-10 sticky top-0">
        {subTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`py-2 px-4 font-semibold text-center w-1/3 transition-colors duration-300 ${activeSubTab === tab.key ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400 hover:text-blue-500'}`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* 联系人列表 */}
      <div className="flex-grow overflow-y-auto">
        {loading ? (
          <p className="p-4 text-center text-gray-500">加载中...</p>
        ) : contacts.length > 0 ? (
          contacts.map(contact => <ContactItem key={contact.id} user={contact} />)
        ) : (
          <p className="p-6 text-center text-gray-500 dark:text-gray-400 mt-10">
            这里空空如也...
          </p>
        )}
      </div>
    </div>
  );
};

export default ContactList;
