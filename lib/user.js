// lib/user.js (Complete and Enhanced Version)

import {
  doc, updateDoc, serverTimestamp, collection, query, where, limit, getDocs,
  onSnapshot, writeBatch, getDoc, deleteDoc, increment, orderBy, setDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

// =================================================================
// HELPERS
// =================================================================

/**
 * [OPTIMIZATION] Fetches multiple user profiles efficiently using an 'in' query.
 * Firestore 'in' queries are limited to 30 documents at a time. This function handles chunking for larger lists.
 * @param {string[]} userIds - An array of user IDs to fetch.
 * @returns {Promise<Object[]>} - A promise that resolves to an array of user profile objects.
 */
const getUsersByIds = async (userIds) => {
  if (!userIds || userIds.length === 0) {
    return [];
  }

  const users = [];
  // Chunk the userIds array into groups of 30
  for (let i = 0; i < userIds.length; i += 30) {
    const chunk = userIds.slice(i, i + 30);
    const q = query(collection(db, 'users'), where('__name__', 'in', chunk));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      users.push({ uid: doc.id, ...doc.data() });
    });
  }
  return users;
};

/**
 * [REUSABLE] Fetches a user's profile.
 * This is a standalone version to be used across the app.
 * @param {string} userId - The ID of the user to fetch.
 * @returns {Promise<Object|null>}
 */
export const getUserProfile = async (userId) => {
  if (!userId) return null;
  const userRef = doc(db, 'users', userId);
  const docSnap = await getDoc(userRef);
  return docSnap.exists() ? { uid: docSnap.id, ...docSnap.data() } : null;
};


// =================================================================
// USER PROFILE MANAGEMENT
// =================================================================

/**
 * Uploads a new profile picture to Firebase Storage.
 * @param {string} userId - The current user's ID.
 * @param {File} file - The image file to upload.
 * @returns {Promise<string>} The public URL of the uploaded image.
 */
export const uploadProfilePicture = async (userId, file) => {
  if (!userId || !file) throw new Error('User ID and file are required.');
  
  const filePath = `profilePictures/${userId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, filePath);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
};

/**
 * Uploads a new background image for the user's profile.
 * @param {string} userId - The current user's ID.
 * @param {File} file - The image file to upload.
 * @returns {Promise<string>} The public URL of the uploaded image.
 */
export const uploadUserBackground = async (userId, file) => {
  if (!userId || !file) throw new Error('User ID and file are required.');

  const filePath = `userBackgrounds/${userId}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, filePath);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
};

/**
 * Updates a user's profile data in Firestore.
 * @param {string} userId - The ID of the user to update.
 * @param {Object} data - An object containing the fields to update.
 */
export const updateUserProfile = async (userId, data) => {
  if (!userId || !data) throw new Error('User ID and data are required.');
  
  const userDocRef = doc(db, 'users', userId);
  const updateData = {
    ...data,
    updatedAt: serverTimestamp()
  };

  // Add a lowercase version of the display name for case-insensitive searching
  if (data.displayName) {
    updateData.displayName_lowercase = data.displayName.toLowerCase();
  }

  await updateDoc(userDocRef, updateData);
};

/**
 * Searches for users by their nickname.
 * @param {string} searchTerm - The nickname to search for.
 * @returns {Promise<Object[]>} A list of matching users.
 */
export const searchUsersByNickname = async (searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') return [];
  
  const lowercasedTerm = searchTerm.toLowerCase();
  const usersRef = collection(db, 'users');
  // Use a range query for "starts with" search functionality
  const q = query(
    usersRef,
    where('displayName_lowercase', '>=', lowercasedTerm),
    where('displayName_lowercase', '<=', lowercasedTerm + '\uf8ff'),
    limit(10)
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
};


// =================================================================
// SOCIAL RELATIONSHIPS (FOLLOW, BLOCK, FRIENDS)
// =================================================================

/**
 * Follows a user. Creates documents in subcollections for scalability.
 * @param {string} currentUserId - The ID of the user performing the action.
 * @param {string} targetUserId - The ID of the user to follow.
 */
export const followUser = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) return;

  const currentUserFollowingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const targetUserFollowersRef = doc(db, 'users', targetUserId, 'followers', currentUserId);
  const currentUserDocRef = doc(db, 'users', currentUserId);
  const targetUserDocRef = doc(db, 'users', targetUserId);

  const batch = writeBatch(db);
  batch.set(currentUserFollowingRef, { timestamp: serverTimestamp() });
  batch.set(targetUserFollowersRef, { timestamp: serverTimestamp() });
  batch.update(currentUserDocRef, { followingCount: increment(1) });
  batch.update(targetUserDocRef, { followersCount: increment(1) });

  await batch.commit();
};

/**
 * Unfollows a user.
 * @param {string} currentUserId - The ID of the user performing the action.
 * @param {string} targetUserId - The ID of the user to unfollow.
 */
export const unfollowUser = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) return;

  const currentUserFollowingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const targetUserFollowersRef = doc(db, 'users', targetUserId, 'followers', currentUserId);
  const currentUserDocRef = doc(db, 'users', currentUserId);
  const targetUserDocRef = doc(db, 'users', targetUserId);

  const batch = writeBatch(db);
  batch.delete(currentUserFollowingRef);
  batch.delete(targetUserFollowersRef);
  batch.update(currentUserDocRef, { followingCount: increment(-1) });
  batch.update(targetUserDocRef, { followersCount: increment(-1) });

  await batch.commit();
};

/**
 * Checks if the current user is following the target user.
 * @param {string} currentUserId
 * @param {string} targetUserId
 * @returns {Promise<boolean>}
 */
export const checkFollowing = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId) return false;
  const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const docSnap = await getDoc(followingRef);
  return docSnap.exists();
};

/**
 * Blocks a user. This will also force an unfollow in one direction.
 * @param {string} currentUserId
 * @param {string} targetUserId
 */
export const blockUser = async (currentUserId, targetUserId) => {
  if (currentUserId === targetUserId) return;
  const blockRef = doc(db, 'users', currentUserId, 'blockedUsers', targetUserId);
  
  // Set the block record first
  await setDoc(blockRef, { timestamp: serverTimestamp() });
  
  // [BUSINESS LOGIC] When you block someone, you automatically unfollow them.
  // We also unfollow them from your followers list to sever the connection completely.
  try { await unfollowUser(currentUserId, targetUserId); } catch (e) { /* Fails silently if not following */ }
  try { await unfollowUser(targetUserId, currentUserId); } catch (e) { /* Fails silently if they aren't following you */ }
};

/**
 * Unblocks a user.
 * @param {string} currentUserId
 * @param {string} targetUserId
 */
export const unblockUser = async (currentUserId, targetUserId) => {
  const blockRef = doc(db, 'users', currentUserId, 'blockedUsers', targetUserId);
  await deleteDoc(blockRef);
};

/**
 * Checks if the current user has blocked the target user.
 * @param {string} currentUserId
 * @param {string} targetUserId
 * @returns {Promise<boolean>}
 */
export const checkBlocked = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId) return false;
  const blockRef = doc(db, 'users', currentUserId, 'blockedUsers', targetUserId);
  const docSnap = await getDoc(blockRef);
  return docSnap.exists();
};


// =================================================================
// USER CONTENT (POSTS, FAVORITES, HISTORY)
// =================================================================

/**
 * [REAL-TIME] Gets all posts published by a specific user.
 * @param {string} userId
 * @param {Function} callback - Function to call with the posts array.
 * @returns {import('firebase/firestore').Unsubscribe}
 */
export const getPostsByUser = (userId, callback) => {
  const q = query(collection(db, 'posts'), where('authorId', '==', userId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(posts);
  });
};

/**
 * [REAL-TIME] Gets a user's favorited posts.
 * @param {string} userId
 * @param {Function} callback
 * @returns {import('firebase/firestore').Unsubscribe}
 */
export const getFavoritesByUser = (userId, callback) => {
  const q = query(collection(db, 'users', userId, 'favorites'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, async (snapshot) => {
    const favoritePostIds = snapshot.docs.map(doc => doc.id);
    if (favoritePostIds.length === 0) {
      callback([]);
      return;
    }
    // [OPTIMIZATION] Fetch all post documents at once instead of one by one
    const posts = await getUsersByIds(favoritePostIds.map(id => doc(db, 'posts', id)));
    callback(posts);
  });
};

/**
 * [REAL-TIME & CONSISTENCY] Gets a user's view history, returning full post objects.
 * @param {string} userId
 * @param {Function} callback
 * @returns {import('firebase/firestore').Unsubscribe}
 */
export const getViewHistoryByUser = (userId, callback) => {
    const q = query(collection(db, 'users', userId, 'viewHistory'), orderBy('timestamp', 'desc'), limit(50)); // Limit history for performance
    return onSnapshot(q, async (snapshot) => {
        const historyDocs = snapshot.docs.map(doc => doc.id); // Assuming doc ID is the post ID
        if (historyDocs.length === 0) {
            callback([]);
            return;
        }
        // Fetch the actual post data for the history items
        const posts = await getUsersByIds(historyDocs.map(id => doc(db, 'posts', id)));
        callback(posts);
    });
};


// =================================================================
// SOCIAL LISTS (FOLLOWING, FOLLOWERS, FRIENDS)
// =================================================================

/**
 * [REAL-TIME & OPTIMIZED] Gets the list of users someone is following.
 * @param {string} userId
 * @param {Function} callback
 * @returns {import('firebase/firestore').Unsubscribe}
 */
export const getFollowing = (userId, callback) => {
  if (!userId) return () => {};
  const q = query(collection(db, 'users', userId, 'following'));
  return onSnapshot(q, async (snapshot) => {
    const userIds = snapshot.docs.map(doc => doc.id);
    const users = await getUsersByIds(userIds);
    callback(users);
  });
};

/**
 * [REAL-TIME & OPTIMIZED] Gets the list of users who are following someone.
 * @param {string} userId
 * @param {Function} callback
 * @returns {import('firebase/firestore').Unsubscribe}
 */
export const getFollowers = (userId, callback) => {
  if (!userId) return () => {};
  const q = query(collection(db, 'users', userId, 'followers'));
  return onSnapshot(q, async (snapshot) => {
    const userIds = snapshot.docs.map(doc => doc.id);
    const users = await getUsersByIds(userIds);
    callback(users);
  });
};

/**
 * [REAL-TIME & OPTIMIZED] Gets a user's friends list (mutual followers).
 * This is complex, so it fetches both lists and computes the intersection.
 * @param {string} userId
 * @param {Function} callback
 * @returns {Function} An unsubscribe function to stop both listeners.
 */
export const getFriends = (userId, callback) => {
    if (!userId) return () => {};

    let followingIds = new Set();
    let followersIds = new Set();
    let combinedDataFetched = { following: false, followers: false };

    const computeFriends = async () => {
        // Only run when both datasets have been fetched at least once
        if (!combinedDataFetched.following || !combinedDataFetched.followers) return;
        
        const friendIds = [...followersIds].filter(id => followingIds.has(id));
        
        if (friendIds.length === 0) {
            callback([]);
            return;
        }
        
        const friends = await getUsersByIds(friendIds);
        callback(friends);
    };

    const followingUnsubscribe = onSnapshot(collection(db, 'users', userId, 'following'), (snapshot) => {
        followingIds = new Set(snapshot.docs.map(doc => doc.id));
        combinedDataFetched.following = true;
        computeFriends();
    });

    const followersUnsubscribe = onSnapshot(collection(db, 'users', userId, 'followers'), (snapshot) => {
        followersIds = new Set(snapshot.docs.map(doc => doc.id));
        combinedDataFetched.followers = true;
        computeFriends();
    });

    // Return a function that unsubscribes from both listeners
    return () => {
        followingUnsubscribe();
        followersUnsubscribe();
    };
};


// =================================================================
// APP-SPECIFIC FEATURES (e.g., Language Partners)
// =================================================================

/**
 * [REAL-TIME] Gets a list of potential language partners.
 * @param {Function} callback
 * @returns {import('firebase/firestore').Unsubscribe}
 */
export const getLanguagePartners = (callback) => {
  const q = query(
    collection(db, 'users'),
    where('seekingLanguagePartner', '==', true),
    orderBy('lastSeen', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    callback(users);
  }, (error) => {
    console.error("Error getting language partners:", error);
    callback([]);
  });
};
