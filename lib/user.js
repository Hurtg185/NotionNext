// lib/user.js (添加详细日志)
import { doc, updateDoc, serverTimestamp, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

/**
 * 更新用户的个人资料
 * @param {string} userId - 要更新的用户的 UID
 * @param {object} data - 包含要更新字段的对象
 */
export const updateUserProfile = async (userId, data) => {
  console.log('DEBUG [updateUserProfile]: Function called.');
  console.log('DEBUG [updateUserProfile]: Attempting to update profile for userId:', userId);
  console.log('DEBUG [updateUserProfile]: Data to update:', data);

  if (!userId || !data) {
    console.error('ERROR [updateUserProfile]: User ID or data is missing.', { userId, data });
    throw new Error('User ID and data are required to update profile.');
  }
  const userDocRef = doc(db, 'users', userId);
  
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };

  if (data.displayName) {
    updateData.displayName_lowercase = data.displayName.toLowerCase();
  }

  try {
    await updateDoc(userDocRef, updateData);
    console.log('SUCCESS [updateUserProfile]: Firestore updateDoc succeeded for userId:', userId);
  } catch (error) {
    // 【核心】捕获并打印 updateDoc 的详细错误
    console.error('ERROR [updateUserProfile]: Firestore updateDoc failed:', error.message);
    console.error('ERROR [updateUserProfile]: Full error object:', JSON.stringify(error, null, 2));
    // 向上抛出错误，让前端的 catch 块也能捕捉到
    throw error; 
  }
};

// ... (其他函数保持不变) ...

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
  const q = query(
    usersRef,
    where('displayName_lowercase', '>=', lowercasedTerm),
    where('displayName_lowercase', '<=', lowercasedTerm + '\uf8ff'),
    limit(10)
  );
  try {
    const querySnapshot = await getDocs(q);
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    return users;
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
};
