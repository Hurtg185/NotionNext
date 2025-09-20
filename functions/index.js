// functions/index.js (整合在线状态同步)

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// --- 监听新的评论 ---
exports.createCommentNotification = functions.firestore
  .document('posts/{postId}/comments/{commentId}')
  .onCreate(async (snap, context) => {
    const comment = snap.data();
    const postId = context.params.postId;
    
    const postRef = db.collection('posts').doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return null;
    const post = postDoc.data();
    
    if (post.authorId !== comment.authorId) {
      const notification = {
        receiverId: post.authorId,
        senderId: comment.authorId,
        type: 'comment',
        postId: postId,
        postTitle: post.title,
        commentText: comment.text.substring(0, 50),
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      return db.collection('notifications').add(notification);
    }
    return null;
  });

// --- 监听新的关注 ---
exports.createFollowNotification = functions.firestore
  .document('users/{followedId}/followers/{followerId}')
  .onCreate(async (snap, context) => {
    const followerId = context.params.followerId;
    const followedId = context.params.followedId;
    
    if (followerId !== followedId) {
      const notification = {
        receiverId: followedId,
        senderId: followerId,
        type: 'follow',
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      return db.collection('notifications').add(notification);
    }
    return null;
  });

// --- 监听新的点赞 ---
exports.createLikeNotification = functions.firestore
  .document('posts/{postId}/likes/{likerId}')
  .onCreate(async (snap, context) => {
    const likerId = context.params.likerId;
    const postId = context.params.postId;
    
    const postRef = db.collection('posts').doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return null;
    const post = postDoc.data();
    
    if (post.authorId !== likerId) {
      const notification = {
        receiverId: post.authorId,
        senderId: likerId,
        type: 'like',
        postId: postId,
        postTitle: post.title,
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      return db.collection('notifications').add(notification);
    }
    return null;
  });

// --- 【新增】监听 RTDB 用户状态变化，并同步到 Firestore ---
exports.onUserStatusChanged = functions.database
  .ref('/status/{uid}')
  .onWrite(async (change, context) => {
    const eventStatus = change.after.val(); // 获取新状态
    const userStatusRef = db.doc(`/users/${context.params.uid}`);

    // 如果 onDisconnect 触发，eventStatus 可能是 null
    if (!eventStatus) {
      return null;
    }

    const isOnline = eventStatus.state === 'online';

    // 更新 Firestore
    return userStatusRef.update({
      isOnline: isOnline,
      lastSeen: eventStatus.timestamp // RTDB 中记录的时间戳
    });
  });
