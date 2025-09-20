// functions/index.js (完整的云函数代码)

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
    
    // 1. 获取帖子信息
    const postRef = db.collection('posts').doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return null;
    const post = postDoc.data();
    
    // 2. 如果不是自己评论自己，则创建通知
    if (post.authorId !== comment.authorId) {
      const notification = {
        receiverId: post.authorId, // 通知接收者：帖子作者
        senderId: comment.authorId, // 通知发送者：评论者
        type: 'comment',
        postId: postId,
        postTitle: post.title,
        commentText: comment.text.substring(0, 50), // 评论内容预览
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      // 3. 将通知写入 'notifications' 集合
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
    
    // 1. 如果不是自己关注自己
    if (followerId !== followedId) {
      const notification = {
        receiverId: followedId, // 通知接收者：被关注者
        senderId: followerId, // 通知发送者：关注者
        type: 'follow',
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      // 2. 将通知写入 'notifications' 集合
      return db.collection('notifications').add(notification);
    }
    return null;
  });

// --- 监听新的点赞 ---
// 【注意】这需要你的点赞数据结构是 'posts/{postId}/likes/{userId}'
exports.createLikeNotification = functions.firestore
  .document('posts/{postId}/likes/{likerId}')
  .onCreate(async (snap, context) => {
    const likerId = context.params.likerId;
    const postId = context.params.postId;
    
    // 1. 获取帖子信息
    const postRef = db.collection('posts').doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return null;
    const post = postDoc.data();
    
    // 2. 如果不是自己点赞自己
    if (post.authorId !== likerId) {
      const notification = {
        receiverId: post.authorId, // 通知接收者：帖子作者
        senderId: likerId, // 通知发送者：点赞者
        type: 'like',
        postId: postId,
        postTitle: post.title,
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      };
      // 3. 将通知写入 'notifications' 集合
      return db.collection('notifications').add(notification);
    }
    return null;
  });
