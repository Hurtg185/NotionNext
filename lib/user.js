// lib/user.js (添加获取联系人函数)
import { 
  doc, updateDoc, serverTimestamp, collection, query, where, limit, getDocs,
  onSnapshot, writeBatch, getDoc, deleteDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { getUserProfile } from './chat'; // 假设 getUserProfile 在 lib/chat.js 中

// ... (你已有的 updateUserProfile, uploadProfilePicture, searchUsersByNickname 函数) ...

// --- 【新增】获取联系人函数 ---
export const getFollowing = (userId, callback) => {
  const q = query(collection(db, 'users', userId, 'following'));
  const unsubscribe = onSnapshot(q, async (snapshot) => {
    const userIds = snapshot.docs.map(doc => doc.id);
    const users = await Promise.all(userIds.map(id => getUserProfile(id)));
    callback(users.filter(Boolean));
  });
  return unsubscribe;
};

export const getFollowers = (userId, callback) => {
  const q = query(collection(db, 'users', userId, 'followers'));
  const unsubscribe = onSnapshot(q, async (snapshot) => {
    const userIds = snapshot.docs.map(doc => doc.id);
    const users = await Promise.all(userIds.map(id => getUserProfile(id)));
    callback(users.filter(Boolean));
  });
  return unsubscribe;
};

export const getFriends = (userId, callback) => {
  const followingRef = collection(db, 'users', userId, 'following');
  const unsubscribe = onSnapshot(followingRef, async (followingSnapshot) => {
    const followingIds = new Set(followingSnapshot.docs.map(doc => doc.id));
    if (followingIds.size === 0) {
      callback([]);
      return;
    }
    
    // 查询粉丝中，哪些人也在我的关注列表里
    const followersRef = collection(db, 'users', userId, 'followers');
    const q = query(followersRef, where('__name__', 'in', Array.from(followingIds)));
    const friendsSnapshot = await getDocs(q);
    const friendIds = friendsSnapshot.docs.map(doc => doc.id);
    
    const friends = await Promise.all(friendIds.map(id => getUserProfile(id)));
    callback(friends.filter(Boolean));
  });
  return unsubscribe;
};
