// lib/AuthContext.js (最终修复版 - 解决数据覆盖问题)

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  FacebookAuthProvider,
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { auth, db } from './firebase'; 
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'; // 【新增】导入 getDoc 和 serverTimestamp

const AuthContext = createContext();

/**
 * 【核心修改】将用户信息同步到 Firestore，但只在用户首次创建时写入，或只更新基础信息
 * @param {object} user - Firebase Auth 返回的用户对象
 */
const syncUserToFirestore = async (user) => {
  if (!user) return;
  
  const userRef = doc(db, 'users', user.uid);
  
  try {
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // 1. 如果用户文档不存在（首次登录），则创建一个新文档
      const newUserProfile = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(), // 记录创建时间
        // 在这里可以设置一些默认值
        bio: '',
        gender: 'not-specified',
      };
      await setDoc(userRef, newUserProfile);
      console.log(`新用户已创建并同步到 Firestore: ${user.uid}`);
    } else {
      // 2. 如果用户文档已存在，只更新一些基础的、不易变动的信息
      // 例如 lastLoginAt。我们不再覆盖 displayName 和 photoURL，因为用户可能已经自己修改过了。
      const updatedData = {
        lastLoginAt: serverTimestamp(), // 记录最后登录时间
        email: user.email, // email 通常不会变
      };
      await setDoc(userRef, updatedData, { merge: true });
      console.log(`现有用户信息已更新: ${user.uid}`);
    }
  } catch (error) {
    console.error("同步用户信息到 Firestore 失败:", error);
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 【核心修改】在 onAuthStateChanged 中调用新的同步函数
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        // 关键：当认证状态改变且用户存在时，调用新的同步函数
        await syncUserToFirestore(authUser);
        
        // 【重要】从 Firestore 获取最新的、完整的用户资料来设置 user state
        // 而不是直接用 authUser 的信息
        const userRef = doc(db, 'users', authUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          setUser({ ...userDoc.data(), uid: userDoc.id }); // 确保 uid 存在
        } else {
          // 如果 Firestore 中还未创建，先用 authUser 的信息
          setUser({
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName,
            photoURL: authUser.photoURL,
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const socialLogin = async (provider, onSuccessCallback) => {
    try {
      await signInWithPopup(auth, provider);
      if (onSuccessCallback) {
        onSuccessCallback();
      }
    } catch (error) {
      console.error("社交登录失败:", error);
    }
  };

  const loginWithGoogle = (onSuccessCallback) => {
    socialLogin(new GoogleAuthProvider(), onSuccessCallback);
  };

  const loginWithFacebook = (onSuccessCallback) => {
    socialLogin(new FacebookAuthProvider(), onSuccessCallback);
  };

  const logout = async () => {
    setUser(null);
    await signOut(auth);
  };

  const value = {
    user,
    loading,
    loginWithGoogle,
    loginWithFacebook,
    logout,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
};
