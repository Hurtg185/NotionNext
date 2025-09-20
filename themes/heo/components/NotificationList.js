// themes/heo/components/NotificationList.js通知条

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getNotificationsForUser } from '@/lib/chat'; // 导入新函数
import { HiOutlineHeart, HiOutlineChatBubbleLeft, HiOutlineUserPlus } from 'react-icons/hi2';
import Link from 'next/link';

// 单个通知项组件
const NotificationItem = ({ notification }) => {
  const { sender, type, postTitle, commentText } = notification;

  let icon, text, link;

  switch (type) {
    case 'like':
      icon = <HiOutlineHeart className="w-6 h-6 text-red-500" />;
      text = <span><span className="font-bold">{sender?.displayName || '有人'}</span> 赞了你的帖子 <span className="font-semibold text-blue-600">“{postTitle}”</span></span>;
      link = `/forum/post/${notification.postId}`;
      break;
    case 'comment':
      icon = <HiOutlineChatBubbleLeft className="w-6 h-6 text-blue-500" />;
      text = <span><span className="font-bold">{sender?.displayName || '有人'}</span> 评论了你的帖子: <span className="italic">“{commentText}”</span></span>;
      link = `/forum/post/${notification.postId}`;
      break;
    case 'follow':
      icon = <HiOutlineUserPlus className="w-6 h-6 text-green-500" />;
      text = <span><span className="font-bold">{sender?.displayName || '有人'}</span> 开始关注你了</span>;
      link = `/profile/${sender?.id}`;
      break;
    default:
      return null;
  }

  return (
    <Link href={link} passHref>
      <a className="flex items-start p-4 space-x-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
        <div className="flex-shrink-0">
          {sender?.photoURL ? (
            <img src={sender.photoURL} alt={sender.displayName} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
              {icon}
            </div>
          )}
        </div>
        <div className="flex-grow">
          <p className="text-gray-800 dark:text-gray-200">{text}</p>
          <p className="text-xs text-gray-500 mt-1">
            {notification.timestamp?.toDate().toLocaleString() || '刚刚'}
          </p>
        </div>
      </a>
    </Link>
  );
};

const NotificationList = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setNotifications([]);
      return;
    }

    setLoading(true);

    const unsubscribe = getNotificationsForUser(user.uid, (newNotifications) => {
      setNotifications(newNotifications);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return <div className="p-4 text-center text-gray-500">加载通知中...</div>;
  }

  if (notifications.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400 mt-10">
        <HiOutlineBell className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <p className="font-semibold">没有新通知</p>
        <p className="text-sm">与他人互动，获得更多回响。</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-800">
      {notifications.map(notification => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
};

export default NotificationList;
