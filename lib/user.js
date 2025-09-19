// lib/user.js
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase'; // 确保 firebase.js 导出了 db 和 storage

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
    updatedAt: serverTimestamp() // 添加更新时间戳
  };
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
  // 创建一个指向 Firebase Storage 的引用路径，例如: profilePictures/userId/filename.jpg
  const filePath = `profilePictures/${userId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, filePath);

  // 上传文件
  const snapshot = await uploadBytes(storageRef, file);
  
  // 获取下载 URL
  const downloadURL = await getDownloadURL(snapshot.ref);
  
  return downloadURL;
};
