// pages/forum/post/[id].js (完整版 - 全功能增强)
import { useState, useEffect, useRef } from 'react';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/AuthContext';
import { useRouter } from 'next/router';

import PostContent from '@/themes/heo/components/PostContent';
import { LayoutBase } from '@/themes/heo';

// 【新增】图标组件 (直接嵌入 SVG，无需安装)
const HeartIcon = ({ filled = false, className = '' }) => (
  <svg className={`w-4 h-4 ${className} ${filled ? 'fill-red-500 stroke-red-500' : 'fill-none stroke-gray-500 dark:stroke-gray-300'}`} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);
const ThumbsUpIcon = ({ filled = false, className = '' }) => (
  <svg className={`w-4 h-4 ${className} ${filled ? 'fill-blue-500 stroke-blue-500' : 'fill-none stroke-gray-500 dark:stroke-gray-300'}`} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21H6v-4l4-4V3a3 3 0 016 0v7z" />
  </svg>
);
const ThumbsDownIcon = ({ filled = false, className = '' }) => (
  <svg className={`w-4 h-4 ${className} ${filled ? 'fill-red-500 stroke-red-500' : 'fill-none stroke-gray-500 dark:stroke-gray-300'}`} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3H18v4l-4 4v10a3 3 0 01-6 0v-7z" />
  </svg>
);
const CommentIcon = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className} fill-none stroke-current`} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);
const ShareIcon = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className} fill-none stroke-current`} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.882 13.118 9 12.83 9 12c0-.83-.118-1.118-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.368-2.684 3 3 0 00-5.368 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);
const BookmarkIcon = ({ filled = false, className = '' }) => (
  <svg className={`w-4 h-4 ${className} ${filled ? 'fill-yellow-500 stroke-yellow-500' : 'fill-none stroke-current'}`} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
  </svg>
);
const ReportIcon = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className} fill-none stroke-current`} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.332 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);
const MenuIcon = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className} fill-none stroke-current`} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
  </svg>
);
const FollowIcon = ({ filled = false, className = '' }) => (
  <svg className={`w-4 h-4 ${className} ${filled ? 'fill-green-500 stroke-green-500' : 'fill-none stroke-current'}`} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM12 14v5a2 2 0 002 2h3a2 2 0 002-2v-5M10 10h.01M10 10h.01" />
  </svg>
);


// 【新的 CommentItem 组件】
const CommentItem = ({ comment, user, postId, handleCommentVote, handleReplyClick, allComments = [], replies = [] }) => {
  const [showAllReplies, setShowAllReplies] = useState(false);
  const isCommentLiked = user && comment.likedBy.includes(user.uid);
  const isCommentDisliked = user && comment.dislikedBy.includes(user.uid);

  // 确保 replies 数组是可迭代的
  const safeReplies = Array.isArray(replies) ? replies : [];

  const visibleReplies = showAllReplies ? safeReplies : safeReplies.slice(0, 3);
  const hasMoreReplies = safeReplies.length > 3 && !showAllReplies;

  // 获取父评论的作者名，用于回复显示 @
  const getParentAuthorName = (parentId) => {
    const parentComment = allComments.find(c => c.id === parentId);
    return parentComment ? parentComment.authorName : '未知用户';
  };

  return (
    <div className="flex items-start space-x-3 group">
      <img
        src={comment.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'}
        alt={comment.authorName || '匿名用户'}
        className="w-10 h-10 rounded-full object-cover"
      />
      <div className="flex-1">
        <div className="relative">
          <p className="font-semibold text-gray-800 dark:text-white">{comment.authorName || '匿名用户'}</p>
          {/* 主评论无背景 */}
          <p className="text-gray-700 dark:text-gray-300">{comment.text}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{comment.createdAt}</p>

          {/* 评论互动按钮 */}
          <div className="flex items-center space-x-3 mt-2 text-sm text-gray-600 dark:text-gray-400">
            <button
              onClick={() => handleCommentVote(comment.id, 'like')}
              disabled={!user}
              className={`flex items-center hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200
                ${isCommentLiked ? 'text-blue-500 dark:text-blue-400' : ''}
                ${!user ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <ThumbsUpIcon filled={isCommentLiked} className="mr-1" /> {comment.likedBy.length}
            </button>
            <button
              onClick={() => handleCommentVote(comment.id, 'dislike')}
              disabled={!user}
              className={`flex items-center hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200
                ${isCommentDisliked ? 'text-red-500 dark:text-red-400' : ''}
                ${!user ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <ThumbsDownIcon filled={isCommentDisliked} className="mr-1" /> {comment.dislikedBy.length}
            </button>
            <button
              onClick={() => handleReplyClick(comment)}
              className="flex items-center hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200"
            >
              <CommentIcon className="mr-1" /> 评论
            </button>
          </div>
        </div>

        {/* 评论的评论（回复）列表 */}
        {safeReplies.length > 0 && (
          <div className="ml-4 mt-4 border-l pl-4 border-gray-200 dark:border-gray-600 space-y-3">
            {visibleReplies.map(reply => (
              <div key={reply.id} className="flex items-start space-x-2 text-sm bg-gray-50 dark:bg-gray-750 p-2 rounded-md">
                <img
                  src={reply.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'}
                  alt={reply.authorName || '匿名用户'}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 dark:text-white">{reply.authorName || '匿名用户'}</p>
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="text-blue-500 dark:text-blue-400 mr-1">@{getParentAuthorName(reply.parentId)}</span>
                    {reply.text}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{reply.createdAt}</p>

                  {/* 回复的点赞/点踩 */}
                  <div className="flex items-center space-x-3 mt-1 text-xs text-gray-600 dark:text-gray-400">
                    <button
                      onClick={() => handleCommentVote(reply.id, 'like')}
                      disabled={!user}
                      className={`flex items-center hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200
                        ${user && reply.likedBy.includes(user.uid) ? 'text-blue-500 dark:text-blue-400' : ''}
                        ${!user ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <ThumbsUpIcon filled={user && reply.likedBy.includes(user.uid)} className="mr-1 w-3 h-3" /> {reply.likedBy.length}
                    </button>
                    <button
                      onClick={() => handleCommentVote(reply.id, 'dislike')}
                      disabled={!user}
                      className={`flex items-center hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200
                        ${user && reply.dislikedBy.includes(user.uid) ? 'text-red-500 dark:text-red-400' : ''}
                        ${!user ? 'opacity-50 cursor-not-allowed' : ''}
                      `}
                    >
                      <ThumbsDownIcon filled={user && reply.dislikedBy.includes(user.uid)} className="mr-1 w-3 h-3" /> {reply.dislikedBy.length}
                    </button>
                    <button
                      onClick={() => handleReplyClick(reply)} // 可以回复回复
                      className="flex items-center hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200"
                    >
                      <CommentIcon className="mr-1 w-3 h-3" /> 回复
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {hasMoreReplies && (
              <button
                onClick={() => setShowAllReplies(true)}
                className="text-blue-500 dark:text-blue-400 text-sm mt-2 hover:underline"
              >
                查看全部 {safeReplies.length - 3} 条回复
              </button>
            )}
            {safeReplies.length > 3 && showAllReplies && (
              <button
                onClick={() => setShowAllReplies(false)}
                className="text-blue-500 dark:text-blue-400 text-sm mt-2 hover:underline"
              >
                收起
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};


const PostDetailPage = () => {
  const router = useRouter();
  const { id: postId } = router.query;
  const { user, userData } = useAuth(); // 获取当前登录用户及额外数据 (如关注列表)

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]); // 存储所有评论（包括回复）
  const [mainComments, setMainComments] = useState([]); // 只存储主评论
  const [repliesMap, setRepliesMap] = useState({}); // 存储每个主评论的回复
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null); // 存储回复的父评论对象 { id, authorName }
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false); // 控制菜单显示

  // ref 用于滚动到评论输入框
  const commentInputRef = useRef(null);

  // 获取帖子详情
  useEffect(() => {
    if (!postId) return;
    const postRef = doc(db, 'posts', postId);
    getDoc(postRef).then((docSnap) => {
      if (docSnap.exists()) {
        const postData = docSnap.data();
        setPost({
          id: docSnap.id,
          ...postData,
          likes: postData.likes || [],     // 初始化点赞数组
          dislikes: postData.dislikes || [] // 初始化点踩数组
        });
      } else {
        console.log("找不到该帖子!");
      }
      setLoading(false);
    }).catch(error => {
      console.error("获取帖子失败: ", error);
      setLoading(false);
    });
  }, [postId]);

  // 实时获取评论 (包括回复)
  useEffect(() => {
    if (!postId) return;
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc')); // 按时间排序所有评论和回复
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const allCommentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toLocaleString() || '刚刚',
        likedBy: doc.data().likedBy || [],
        dislikedBy: doc.data().dislikedBy || [],
        parentId: doc.data().parentId || null // 区分主评论和回复
      }));

      // 区分主评论和回复，并构建回复映射
      const main = allCommentsData.filter(c => !c.parentId);
      const replies = allCommentsData.filter(c => c.parentId);

      const newRepliesMap = {};
      replies.forEach(reply => {
        if (!newRepliesMap[reply.parentId]) {
          newRepliesMap[reply.parentId] = [];
        }
        newRepliesMap[reply.parentId].push(reply);
      });

      setComments(allCommentsData); // 存储所有评论
      setMainComments(main); // 存储主评论
      setRepliesMap(newRepliesMap); // 存储回复映射

    }, (error) => {
      console.error("实时获取评论失败: ", error);
    });
    return () => unsubscribe();
  }, [postId]);

  // 处理主帖点赞/点踩
  const handlePostVote = async (type) => { // 'like' 或 'dislike'
    if (!user) {
      alert('请登录后操作！');
      return;
    }
    const postRef = doc(db, 'posts', postId);
    const currentLikes = post.likes || [];
    const currentDislikes = post.dislikes || [];
    const userId = user.uid;

    let updateData = {};

    if (type === 'like') {
      const isLiked = currentLikes.includes(userId);
      const isDisliked = currentDislikes.includes(userId);

      if (isLiked) {
        updateData.likes = arrayRemove(userId);
      } else {
        updateData.likes = arrayUnion(userId);
        if (isDisliked) {
          updateData.dislikes = arrayRemove(userId);
        }
      }
    } else if (type === 'dislike') {
      const isDisliked = currentDislikes.includes(userId);
      const isLiked = currentLikes.includes(userId);

      if (isDisliked) {
        updateData.dislikes = arrayRemove(userId);
      } else {
        updateData.dislikes = arrayUnion(userId);
        if (isLiked) {
          updateData.likes = arrayRemove(userId);
        }
      }
    }

    try {
      await updateDoc(postRef, updateData);
      // 由于是实时监听，UI 会自动更新，此处可以省略乐观更新。
      // 如果没有实时监听，则需要手动更新 post 状态。
    } catch (error) {
      console.error(`处理主帖${type}失败: `, error);
    }
  };

  // 处理关注功能
  const handleFollow = async () => {
    if (!user) {
      alert('请登录后关注！');
      return;
    }
    if (user.uid === post.authorId) {
      alert('不能关注自己！');
      return;
    }

    const currentUserRef = doc(db, 'users', user.uid); // 假设用户文档在 'users' 集合中
    const isFollowing = userData?.following?.includes(post.authorId);

    try {
      await updateDoc(currentUserRef, {
        following: isFollowing ? arrayRemove(post.authorId) : arrayUnion(post.authorId)
      });
      // userData 的更新通常由 AuthContext 内部监听并提供，这里无需手动更新
      alert(isFollowing ? '已取消关注。' : '关注成功！');
    } catch (error) {
      console.error("处理关注失败: ", error);
      alert('关注操作失败。');
    }
  };

  // 提交新评论或回复
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    try {
      const commentsRef = collection(db, 'posts', postId, 'comments');
      await addDoc(commentsRef, {
        text: newComment,
        authorId: user.uid,
        authorName: user.displayName || '匿名用户',
        authorAvatar: user.photoURL || 'https://www.gravatar.com/avatar?d=mp',
        createdAt: serverTimestamp(),
        likedBy: [],
        dislikedBy: [],
        parentId: replyTo ? replyTo.id : null // 如果是回复，则设置 parentId
      });
      setNewComment('');
      setReplyTo(null); // 清除回复状态
    } catch (error) {
      console.error("添加评论失败: ", error);
      alert('添加评论失败。');
    }
  };

  // 处理评论点赞/点踩
  const handleCommentVote = async (commentId, type) => {
    if (!user) {
      alert('请登录后操作！');
      return;
    }
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const userId = user.uid;

    let updateData = {};
    const currentComment = comments.find(c => c.id === commentId);
    if (!currentComment) return;

    const currentLikes = currentComment.likedBy || [];
    const currentDislikes = currentComment.dislikedBy || [];

    if (type === 'like') {
      const isLiked = currentLikes.includes(userId);
      const isDisliked = currentDislikes.includes(userId);

      if (isLiked) {
        updateData.likedBy = arrayRemove(userId);
      } else {
        updateData.likedBy = arrayUnion(userId);
        if (isDisliked) {
          updateData.dislikedBy = arrayRemove(userId);
        }
      }
    } else if (type === 'dislike') {
      const isDisliked = currentDislikes.includes(userId);
      const isLiked = currentLikes.includes(userId);

      if (isDisliked) {
        updateData.dislikedBy = arrayRemove(userId);
      } else {
        updateData.dislikedBy = arrayUnion(userId);
        if (isLiked) {
          updateData.likedBy = arrayRemove(userId);
        }
      }
    }

    try {
      await updateDoc(commentRef, updateData);
      // UI 会通过 onSnapshot 实时更新
    } catch (error) {
      console.error(`处理评论${type}失败: `, error);
      alert('评论点赞/点踩失败。');
    }
  };

  // 点击评论按钮，设置回复状态并聚焦输入框
  const handleReplyClick = (comment) => {
    setReplyTo({ id: comment.id, authorName: comment.authorName });
    setNewComment(`@${comment.authorName} `); // 预填回复内容
    if (commentInputRef.current) {
      commentInputRef.current.focus();
    }
  };

  // 处理主帖菜单项
  const handleMenuItemClick = async (action) => {
    setShowMenu(false); // 关闭菜单
    if (!user) {
      alert('请登录后操作！');
      return;
    }

    switch (action) {
      case 'delete':
        if (user.uid !== post.authorId) {
          alert('您无权删除此帖子！');
          return;
        }
        if (confirm('确定要删除此帖子吗？此操作不可逆！')) {
          try {
            await deleteDoc(doc(db, 'posts', postId));
            alert('帖子已删除。');
            router.push('/forum'); // 删除后跳转到论坛列表页
          } catch (error) {
            console.error("删除帖子失败: ", error);
            alert('删除帖子失败。');
          }
        }
        break;
      case 'edit':
        if (user.uid !== post.authorId) {
          alert('您无权修改此帖子！');
          return;
        }
        alert('修改功能待实现。实际中会跳转到编辑页面。');
        // router.push(`/forum/edit/${postId}`); // 示例跳转
        break;
      case 'share':
        if (navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(window.location.href);
            alert('帖子链接已复制到剪贴板！');
          } catch (err) {
            console.error('复制失败:', err);
            alert('复制链接失败，请手动复制: ' + window.location.href);
          }
        } else {
          alert('您的浏览器不支持自动复制，请手动复制: ' + window.location.href);
        }
        break;
      case 'bookmark':
        alert('收藏功能待实现。实际中需要更新用户收藏列表。');
        // 示例：更新用户收藏列表
        // const currentUserRef = doc(db, 'users', user.uid);
        // await updateDoc(currentUserRef, {
        //   bookmarks: arrayUnion(postId)
        // });
        break;
      case 'report':
        alert('举报功能待实现。实际中需要将举报信息提交到后台。');
        // 示例：添加举报记录
        // await addDoc(collection(db, 'reports'), {
        //   postId: postId,
        //   reporterId: user.uid,
        //   reason: '用户举报',
        //   createdAt: serverTimestamp()
        // });
        break;
      default:
        break;
    }
  };

  if (loading) return <LayoutBase><p className="p-4 text-center">加载中...</p></LayoutBase>;
  if (!post) return <LayoutBase><p className="p-4 text-center text-red-500">帖子不存在。</p></LayoutBase>;

  const isAuthor = user && user.uid === post.authorId;
  const isFollowing = user && userData?.following?.includes(post.authorId); // 检查是否关注
  const postIsLiked = user && post.likes.includes(user.uid);
  const postIsDisliked = user && post.dislikes.includes(user.uid);

  return (
    <LayoutBase>
      <div className="container mx-auto p-4 max-w-3xl">
        {/* 帖子内容 */}
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow relative">
          <h1 className="text-3xl font-bold mb-4">{post.title}</h1>

          {/* 作者信息和操作 */}
          <div className="flex justify-between items-center text-gray-600 dark:text-gray-400 mb-6">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <img
                  src={post.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'}
                  alt={post.authorName || '匿名用户'}
                  className="w-14 h-14 rounded-full object-cover border-2 border-blue-400" // 头像再大点
                />
                {/* 用户名和时间在头像右侧 */}
                <div className="absolute left-16 top-0 transform -translate-y-1/4"> {/* 调整位置 */}
                  <p className="font-semibold text-lg text-gray-800 dark:text-white">{post.authorName || '匿名用户'}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{post.createdAt?.toDate().toLocaleString() || '未知时间'}</p>
                </div>
              </div>
            </div>

            {/* 关注和菜单按钮 */}
            <div className="flex items-center space-x-2">
              {user && post.authorId !== user.uid && ( // 不能关注自己
                <button
                  onClick={handleFollow}
                  className={`flex items-center text-sm px-3 py-1 rounded-full border
                    ${isFollowing ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-800 dark:border-green-400 dark:text-green-200' : 'bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}
                  `}
                >
                  <FollowIcon filled={isFollowing} className="mr-1" />
                  {isFollowing ? '已关注' : '关注'}
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <MenuIcon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                </button>
                {showMenu && (
                  // 使用绝对定位的 div 作为下拉菜单
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 py-1">
                    {isAuthor && (
                      <>
                        <button
                          onClick={() => handleMenuItemClick('edit')}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          修改
                        </button>
                        <button
                          onClick={() => handleMenuItemClick('delete')}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-800"
                        >
                          删除
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleMenuItemClick('share')}
                      className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                    >
                      <ShareIcon className="mr-2" />分享
                    </button>
                    <button
                      onClick={() => handleMenuItemClick('bookmark')}
                      className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                    >
                      <BookmarkIcon className="mr-2" />收藏
                    </button>
                    <button
                      onClick={() => handleMenuItemClick('report')}
                      className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                    >
                      <ReportIcon className="mr-2" />举报
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="prose dark:prose-invert max-w-none border-t border-gray-200 dark:border-gray-700 pt-6">
            {post.content && typeof post.content === 'string' && post.content.split('\n').map((paragraph, index) => (
              <PostContent key={index} content={paragraph} />
            ))}
          </div>

          {/* 帖子下方互动按钮 */}
          <div className="flex items-center justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-x-4">
            <button
              onClick={() => handlePostVote('like')}
              disabled={!user}
              className={`flex items-center text-sm px-3 py-1 rounded-full transition-colors duration-200
                ${postIsLiked ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}
                ${!user ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <ThumbsUpIcon filled={postIsLiked} className="mr-1" /> {post.likes.length}
            </button>
            <button
              onClick={() => handlePostVote('dislike')}
              disabled={!user}
              className={`flex items-center text-sm px-3 py-1 rounded-full transition-colors duration-200
                ${postIsDisliked ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}
                ${!user ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <ThumbsDownIcon filled={postIsDisliked} className="mr-1" /> {post.dislikes.length}
            </button>
            <button
              onClick={() => {
                if (commentInputRef.current) {
                  commentInputRef.current.focus();
                  setReplyTo(null); // 如果是点击主评论按钮，取消回复状态
                }
              }}
              className="flex items-center text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
            >
              <CommentIcon className="mr-1" /> {comments.length} 评论
            </button>
          </div>
        </div>

        {/* 评论区 */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">评论 ({comments.length})</h2>

          {/* 评论列表 */}
          <div className="space-y-6 mb-6">
            {mainComments.map(mainComment => (
              <CommentItem
                key={mainComment.id}
                comment={mainComment}
                user={user}
                postId={postId}
                handleCommentVote={handleCommentVote}
                handleReplyClick={handleReplyClick}
                allComments={comments} // 传递所有评论，用于解析回复的父评论名
                replies={repliesMap[mainComment.id] || []}
              />
            ))}
          </div>

          {/* 发表评论表单 */}
          {user ? (
            <div className="flex justify-end mt-4"> {/* 评论输入框移到右边 */}
              <form onSubmit={handleAddComment} className="w-full">
                {replyTo && (
                  <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
                    回复 <span className="font-semibold">{replyTo.authorName}</span>
                    <button type="button" onClick={() => {
                      setReplyTo(null);
                      setNewComment(''); // 取消回复时清空输入框
                    }} className="ml-2 text-red-500 hover:underline">
                      取消
                    </button>
                  </div>
                )}
                <textarea
                  ref={commentInputRef} // 绑定 ref
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={replyTo ? `回复 ${replyTo.authorName}...` : "发表你的看法..."}
                  rows="3"
                  className="w-full p-2 border rounded-md dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
                <button type="submit" className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors duration-200">
                  发表评论
                </button>
              </form>
            </div>
          ) : (
            <p className="text-center text-gray-600 dark:text-gray-400">请登录后发表评论。</p>
          )}
        </div>
      </div>
    </LayoutBase>
  );
};

export default PostDetailPage;
