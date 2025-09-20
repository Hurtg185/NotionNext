// lib/presence.js (新建文件)
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { app } from './firebase'; // 你的 firebase app

let isPresenceInitialized = false;

export const initializePresence = () => {
  if (isPresenceInitialized || typeof window === 'undefined') return;

  const auth = getAuth(app);
  const db = getDatabase(app);

  onAuthStateChanged(auth, user => {
    if (user) {
      isPresenceInitialized = true;
      const userStatusRef = ref(db, `/status/${user.uid}`);
      
      const isOfflineForRTDB = {
        state: 'offline',
        timestamp: serverTimestamp()
      };
      
      const isOnlineForRTDB = {
        state: 'online',
        timestamp: serverTimestamp()
      };
      
      // 监听连接状态
      onValue(ref(db, '.info/connected'), snapshot => {
        if (snapshot.val() === false) {
          return;
        }

        // 设置 onDisconnect "遗嘱"
        onDisconnect(userStatusRef).set(isOfflineForRTDB).then(() => {
          // 成功设置遗嘱后，将自己标记为在线
          set(userStatusRef, isOnlineForRTDB);
        });
      });
    } else {
      isPresenceInitialized = false;
    }
  });
};
