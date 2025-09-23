// components/EditProfileModal.js (完整版)
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { updateUserProfile } from '@/lib/user';

const SOCIAL_PLATFORMS = {
    weibo: { name: '微博', icon: 'fab fa-weibo', placeholder: '请输入微博主页用户名' },
    github: { name: 'GitHub', icon: 'fab fa-github', placeholder: '请输入GitHub用户名' },
    twitter: { name: 'X (Twitter)', icon: 'fab fa-twitter', placeholder: '请输入X用户名' },
    instagram: { name: 'Instagram', icon: 'fab fa-instagram', placeholder: '请输入Instagram用户名' },
};

const EditProfileModal = ({ onClose, onProfileUpdate }) => {
    const { userData, user } = useAuth();
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [gender, setGender] = useState('');
    const [tags, setTags] = useState(''); // 以逗号分隔的字符串
    const [socials, setSocials] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (userData) {
            setDisplayName(userData.displayName || '');
            setBio(userData.bio || '');
            setGender(userData.gender || 'not_specified');
            setTags((userData.tags || []).join(', '));
            setSocials(userData.socials || {});
        }
    }, [userData]);

    const handleSocialChange = (platform, value) => {
        setSocials(prev => ({ ...prev, [platform]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const tagsArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
        const profileData = {
            displayName,
            bio,
            gender,
            tags: tagsArray,
            socials,
        };

        try {
            await updateUserProfile(user.uid, profileData);
            onProfileUpdate(); // 通知父组件刷新
            onClose();
        } catch (error) {
            console.error("更新资料失败:", error);
            alert("更新失败，请稍后再试。");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4 overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">编辑资料</h2>

                {/* 基本信息 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">昵称</label>
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 block w-full input-style" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">自我介绍</label>
                    <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows="3" className="mt-1 block w-full input-style"></textarea>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">性别</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-1 block w-full input-style">
                        <option value="not_specified">不透露</option>
                        <option value="male">男</option>
                        <option value="female">女</option>
                    </select>
                </div>

                {/* 标签 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">性格爱好标签</label>
                    <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="用逗号分隔，如：旅游, 摄影" className="mt-1 block w-full input-style" />
                </div>

                {/* 社交账号 */}
                <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">社交平台</label>
                    {Object.entries(SOCIAL_PLATFORMS).map(([key, { name, icon, placeholder }]) => (
                        <div key={key} className="flex items-center space-x-2">
                            <i className={`${icon} w-6 text-center text-lg text-gray-500`}></i>
                            <input
                                type="text"
                                value={socials[key] || ''}
                                onChange={(e) => handleSocialChange(key, e.target.value)}
                                placeholder={placeholder}
                                className="flex-1 input-style"
                            />
                        </div>
                    ))}
                </div>

                {/* 操作按钮 */}
                <div className="flex justify-end space-x-3 pt-4">
                    <button onClick={onClose} className="btn-secondary">取消</button>
                    <button onClick={handleSave} disabled={isSaving} className="btn-primary">
                        {isSaving ? '保存中...' : '保存'}
                    </button>
                </div>
            </div>
            {/* 定义一些通用样式，可以放在 global.css 中 */}
            <style jsx>{`
                .input-style {
                    background-color: #f3f4f6; /* gray-100 */
                    border: 1px solid #d1d5db; /* gray-300 */
                    border-radius: 0.375rem; /* rounded-md */
                    padding: 0.5rem 0.75rem;
                    width: 100%;
                }
                .dark .input-style {
                    background-color: #374151; /* dark:bg-gray-700 */
                    border-color: #4b5563; /* dark:border-gray-600 */
                    color: white;
                }
                .btn-primary {
                    background-color: #2563eb; /* bg-blue-600 */
                    color: white;
                    padding: 0.5rem 1.25rem;
                    border-radius: 9999px; /* rounded-full */
                    font-weight: 600;
                }
                .btn-primary:hover {
                    background-color: #1d4ed8; /* hover:bg-blue-700 */
                }
                .btn-primary:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .btn-secondary {
                    background-color: #e5e7eb; /* bg-gray-200 */
                    color: #1f2937; /* text-gray-800 */
                    padding: 0.5rem 1.25rem;
                    border-radius: 9999px; /* rounded-full */
                    font-weight: 600;
                }
                .dark .btn-secondary {
                    background-color: #4b5563; /* dark:bg-gray-600 */
                    color: #f3f4f6; /* dark:text-gray-100 */
                }
            `}</style>
        </div>
    );
};

export default EditProfileModal;
