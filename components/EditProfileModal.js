// components/EditProfileModal.js (功能增强版)
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { updateUserProfile } from '@/lib/user';

// 预设的兴趣爱好标签
const HOBBY_OPTIONS = [ "电影", "音乐", "阅读", "旅游", "摄影", "美食", "运动", "游戏", "刷视频", "绘画", "交友" ];

const EditProfileModal = ({ onClose, onProfileUpdate }) => {
    const { userData, user } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    
    // 使用一个 state 来管理所有表单数据
    const [formData, setFormData] = useState({
        displayName: '',
        bio: '',
        nationality: '',
        hometown: '',
        city: '',
        occupation: '',
        dob: '', // 存储为 YYYY-MM-DD 格式
        hobbies: [],
        socials: { github: '', twitter: '' }
    });

    useEffect(() => {
        if (userData) {
            setFormData({
                displayName: userData.displayName || '',
                bio: userData.bio || '',
                nationality: userData.nationality || '',
                hometown: userData.hometown || '',
                city: userData.city || '',
                occupation: userData.occupation || '',
                // 将 Firestore Timestamp 转换为 YYYY-MM-DD
                dob: userData.dob?.toDate().toISOString().split('T')[0] || '',
                hobbies: userData.hobbies || [],
                socials: userData.socials || { github: '', twitter: '' }
            });
        }
    }, [userData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSocialChange = (platform, value) => {
        setFormData(prev => ({
            ...prev,
            socials: { ...prev.socials, [platform]: value }
        }));
    };

    const handleHobbyToggle = (hobby) => {
        setFormData(prev => {
            const newHobbies = prev.hobbies.includes(hobby)
                ? prev.hobbies.filter(h => h !== hobby)
                : [...prev.hobbies, hobby];
            return { ...prev, hobbies: newHobbies };
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        // 准备要上传到 Firestore 的数据
        const dataToSave = {
            ...formData,
            // 如果 dob 存在，则转换为 Firestore Timestamp
            dob: formData.dob ? new Date(formData.dob) : null
        };

        try {
            await updateUserProfile(user.uid, dataToSave);
            onProfileUpdate();
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
                
                {/* 字段输入区 */}
                <input name="displayName" value={formData.displayName} onChange={handleInputChange} placeholder="昵称" className="input-style" />
                <textarea name="bio" value={formData.bio} onChange={handleInputChange} placeholder="自我介绍" rows="3" className="input-style"></textarea>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input name="nationality" value={formData.nationality} onChange={handleInputChange} placeholder="国籍" className="input-style" />
                    <input name="hometown" value={formData.hometown} onChange={handleInputChange} placeholder="家乡" className="input-style" />
                    <input name="city" value={formData.city} onChange={handleInputChange} placeholder="所在城市" className="input-style" />
                    <input name="occupation" value={formData.occupation} onChange={handleInputChange} placeholder="职业" className="input-style" />
                </div>
                <div>
                    <label className="text-sm text-gray-500">出生日期</label>
                    <input name="dob" type="date" value={formData.dob} onChange={handleInputChange} className="input-style" />
                </div>
                
                {/* 兴趣爱好选择器 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">兴趣爱好</label>
                    <div className="flex flex-wrap gap-2">
                        {HOBBY_OPTIONS.map(hobby => (
                            <button key={hobby} onClick={() => handleHobbyToggle(hobby)}
                                className={`px-3 py-1 text-sm rounded-full transition-colors ${formData.hobbies.includes(hobby) ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                                {hobby}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 社交账号 */}
                <input value={formData.socials.github} onChange={(e) => handleSocialChange('github', e.target.value)} placeholder="GitHub 用户名" className="input-style" />
                <input value={formData.socials.twitter} onChange={(e) => handleSocialChange('twitter', e.target.value)} placeholder="Twitter 用户名" className="input-style" />

                <div className="flex justify-end space-x-3 pt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md font-semibold">取消</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold disabled:opacity-50">
                        {isSaving ? '保存中...' : '保存'}
                    </button>
                </div>
            </div>
            <style jsx>{`.input-style { background-color: #f3f4f6; border: 1px solid #d1d5db; border-radius: 0.375rem; padding: 0.5rem 0.75rem; width: 100%; } .dark .input-style { background-color: #374151; border-color: #4b5563; color: white; }`}</style>
        </div>
    );
};

export default EditProfileModal;
