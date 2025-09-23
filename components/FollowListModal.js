// components/FollowListModal.js (完整版)
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getFollowList } from '@/lib/user';
import Link from 'next/link';

const FollowListModal = ({ userId, type, onClose }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const title = type === 'following' ? '关注列表' : '粉丝列表';

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            const userList = await getFollowList(userId, type);
            setUsers(userList);
            setLoading(false);
        };
        fetchUsers();
    }, [userId, type]);

    const handleUserClick = (uid) => {
        onClose(); // 关闭当前弹窗
        // 跳转到新页面，这里需要手动刷新，或者使用更高级的状态管理
        window.location.href = `/profile/${uid}`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-center mb-4 text-gray-900 dark:text-white">{title}</h3>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <p className="text-center text-gray-500">加载中...</p>
                    ) : users.length === 0 ? (
                        <p className="text-center text-gray-500">列表为空</p>
                    ) : (
                        users.map(u => (
                            <div key={u.uid} className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 cursor-pointer" onClick={() => handleUserClick(u.uid)}>
                                    <img src={u.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={u.displayName} className="w-10 h-10 rounded-full object-cover" />
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">{u.displayName}</span>
                                </div>
                                {/* 在未来可以添加一个关注/取关按钮 */}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default FollowListModal;
