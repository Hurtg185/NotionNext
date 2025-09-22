// lib/AuthContext.js (最终修复版 - 添加实时 userData 监听)

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, GoogleAuthProvider, FacebookAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth, db } from './firebase'; 
import { doc, setDoc, getDoc, serverTimestamp, onSnapshot } from 'firebase/firestore'; // 【新增】导入 onSnapshot

const AuthContext = createContext();

const syncUserToFirestore = async (user) => {
  if (!user) return;
  const userRef = doc(db, 'users', user.uid);
  try {
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      const newUserProfile = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        // 【新增】为新用户添加交互字段
        bookmarks: [], 
        following: [],
        followers: [],
        followingCount: 0,
        followersCount: 0,
        bio: '',
        gender: 'not-specified',
      };
      await setDoc(userRef, newUserProfile);
    } else {
      await setDoc(userRef, { lastLoginAt: serverTimestamp() }, { merge: true });
    }
  } catch (error) {
    console.error("同步用户信息到 Firestore 失败:", error);
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null); // 【新增】专门用于存储 Firestore 中的用户数据
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        await syncUserToFirestore(authUser);
        // 【重要】设置基础 user 对象，用于快速验证登录状态
        setUser({
            uid: authUser.uid,
            email: authUser.email,
            displayName: authUser.displayName,
            photoURL: authUser.photoURL,
        });
      } else {
        setUser(null);
        setUserData(null); // 用户登出时清空 userData
        setLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // 【核心新增】当 user 对象存在时，实时监听 Firestore 中的用户文档
  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const unsubscribeFirestore = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserData({ ...docSnap.data(), uid: docSnap.id });
        } else {
          setUserData(null);
        }
        setLoading(false); // 只有在获取到 Firestore 数据后，才真正结束加载
      }, (error) => {
        console.error("监听用户数据失败:", error);
        setUserData(null);
        setLoading(false);
      });
      return () => unsubscribeFirestore();
    }
  }, [user]);

  const socialLogin = async (provider, onSuccessCallback) => {
    try {
      await signInWithPopup(auth, provider);
      if (onSuccessCallback) onSuccessCallback();
    } catch (error) { console.error("社交登录失败:", error); }
  };

  const loginWithGoogle = (onSuccessCallback) => { socialLogin(new GoogleAuthProvider(), onSuccessCallback); };
  const loginWithFacebook = (onSuccessCallback) => { socialLogin(new FacebookAuthProvider(), onSuccessCallback); };

  const logout = async () => {
    setUser(null);
    setUserData(null);
    await signOut(auth);
  };

  const value = {
    user,
    userData, // 【新增】导出 userData
    loading,
    loginWithGoogle,
    loginWithFacebook,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
};
