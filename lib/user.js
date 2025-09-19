// lib/user.js (修改后，功能增强)
import { doc, updateDoc, serverTimestamp, collection, query, where, limit, getDocs } from 'firebase/firestore'; // 【修改】导入更多函数
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

/**
 * 更新用户的个人资料
 * @param {string} userId - 要更新的用户的 UID
 * @param {object} data - 包含要更新字段的对象
 */
export const updateUserProfile = async (userId, data) => {
  if (!userId || !data) {
    throw new Error('User ID and data are required to update profile.');
  }
  const userDocRef = doc(db, 'users', userId);
  
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };

  // 【新增】如果昵称被更新，同时更新一个全小写的字段，用于不区分大小写的搜索
  if (data.displayName) {
    updateData.displayName_lowercase = data.displayName.toLowerCase();
  }

  await updateDoc(userDocRef, updateData);
};

/**

 * 上传新的头像图片并返回 URL
 * @param {string} userId - 用户 UID
 * @param {File} file - 用户选择的图片文件
 * @returns {Promise<string>} - 图片的公开下载 URL
 */
export const uploadProfilePicture = async (userId, file) => {
  if (!userId || !file) {
    throw new Error('User ID and file are required.');
  }
  const filePath = `profilePictures/${userId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, filePath);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
};

/**
 * 【新增】根据昵称搜索用户 (前缀匹配, 不区分大小写)
 * @param {string} searchTerm - 搜索关键词
 * @returns {Promise<Array>} - 用户对象数组
 */
export const searchUsersByNickname = async (searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') {
    return [];
  }

  const lowercasedTerm = searchTerm.toLowerCase();

  const usersRef = collection(db, 'users');
  // 使用范围查询模拟前缀搜索 (\uf8ff 是一个特殊的 Unicode 字符，用于查询上限)
  const q = query(
    usersRef,
    where('displayName_lowercase', '>=', lowercasedTerm),
    where('displayName_lowercase', '<=', lowercasedTerm + '\uf8ff'),
    limit(10) // 限制返回结果为10个，避免性能问题
  );

  try {
    const querySnapshot = await getDocs(q);
    const users = [];
    querySnapshot.forEach((doc) => {
      // 过滤掉自己
      // if (doc.id !== currentUserId) { 
      //   users.push({ id: doc.id, ...doc.data() });
      // }
      // 暂时先不过滤，UI层可以做
      users.push({ id: doc.id, ...doc.data() });
    });
    return users;
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
};
