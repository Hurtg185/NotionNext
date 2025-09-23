// lib/postInteractions.js (新建文件)

import { db } from './firebase';
import { doc, writeBatch, increment, arrayUnion, arrayRemove, updateDoc } from 'firebase/firestore';

/**
 * 处理帖子或评论的点赞/点踩操作
 * @param {string} path - 文档的路径，例如 'posts/postId' 或 'posts/postId/comments/commentId'
 * @param {string} userId - 当前操作用户的 UID
 * @param {string[]} currentLikers - 当前的点赞者 UID 数组
 * @param {string[]} currentDislikers - 当前的点踩者 UID 数组
 * @param {'like' | 'dislike'} type - 操作类型
 */
export const handleVote = async (path, userId, currentLikers = [], currentDislikers = [], type) => {
  if (!userId) {
    alert('请登录后操作！');
    return;
  }

  const docRef = doc(db, path);
  const batch = writeBatch(db);

  const isLiked = currentLikers.includes(userId);
  const isDisliked = currentDislikers.includes(userId);

  if (type === 'like') {
    if (isLiked) {
      // 如果已点赞，则取消点赞
      batch.update(docRef, {
        likers: arrayRemove(userId),
        likesCount: increment(-1)
      });
    } else {
      // 如果未点赞，则添加点赞
      batch.update(docRef, {
        likers: arrayUnion(userId),
        likesCount: increment(1)
      });
      // 如果之前点了踩，则取消踩
      if (isDisliked) {
        batch.update(docRef, {
          dislikers: arrayRemove(userId),
          dislikersCount: increment(-1)
        });
      }
    }
  } else if (type === 'dislike') {
    if (isDisliked) {
      // 如果已点踩，则取消点踩
      batch.update(docRef, {
        dislikers: arrayRemove(userId),
        dislikersCount: increment(-1)
      });
    } else {
      // 如果未点踩，则添加点踩
      batch.update(docRef, {
        dislikers: arrayUnion(userId),
        dislikersCount: increment(1)
      });
      // 如果之前点了赞，则取消赞
      if (isLiked) {
        batch.update(docRef, {
          likers: arrayRemove(userId),
          likesCount: increment(-1)
        });
      }
    }
  }

  try {
    await batch.commit();
  } catch (error) {
    console.error("投票操作失败:", error);
    alert('操作失败，请稍后再试。');
  }
};

/**
 * 处理帖子的收藏操作
 * @param {string} userId - 当前操作用户的 UID
 * @param {string} postId - 被收藏的帖子 ID
 * @param {string[]} currentUserBookmarks - 当前用户的收藏列表
 */
export const handleBookmark = async (userId, postId, currentUserBookmarks = []) => {
    if (!userId) {
        alert('请登录后操作！');
        return;
    }
    const userRef = doc(db, 'users', userId);
    const postRef = doc(db, 'posts', postId);

    const isBookmarked = currentUserBookmarks.includes(postId);
    
    try {
        if (isBookmarked) {
            // 取消收藏
            await updateDoc(userRef, { bookmarks: arrayRemove(postId) });
            await updateDoc(postRef, { favoritesCount: increment(-1) }); // 假设帖子有 favoritesCount 字段
        } else {
            // 添加收藏
            await updateDoc(userRef, { bookmarks: arrayUnion(postId) });
            await updateDoc(postRef, { favoritesCount: increment(1) });
        }
    } catch (error) {
        console.error("收藏操作失败:", error);
        alert('收藏失败，请稍后再试。');
    }
};
