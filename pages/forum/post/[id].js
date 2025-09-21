// pages/forum/post/[id].js (最终重构版 -帖子详细页 贴吧风格)
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link'; // 【新增】用于跳转个人主页
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

// 【图标替换与新增】
const StarIcon = ({ filled = false, className = '' }) => (
  <svg className={`w-5 h-5 ${className} ${filled ? 'fill-yellow-400 stroke-yellow-500' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
  </svg>
);
const BrokenStarIcon = ({ filled = false, className = '' }) => (
  <svg className={`w-5 h-5 ${className} ${filled ? 'stroke-red-500' : 'stroke-current'}`} fill="none" viewBox="0 0 24 24" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.42 3.4l1.24 2.52.28.57.63.05 2.78.22-2.1 1.8-.46.4.11.64.65 2.72-2.36-1.42-.56-.34-.56.34-2.36 1.42.65-2.72.11-.64-.46-.4-2.1-1.8 2.78-.22.63-.05.28-.57L9.42 3.4zM15.5 10.5l4.5 3.9-6 1.5M12 17.25V21m-3.5-10.5L4 14.4l6 1.5" />
  </svg>
);
const CommentIcon = ({ className = '' }) => (
  <svg className={`w-5 h-5 ${className} fill-none stroke-current`} viewBox="0 0 24 24" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.158 2.098.286 3.15 0.354 1.134.068 2.298.068 3.432 0 1.052-.068 2.082-.196 3.15-.354 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.344 48.344 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
  </svg>
);
const TrashIcon = ({ className = '' }) => (
  <svg className={`w-4 h-4 ${className} stroke-current`} fill="none" viewBox="0 0 24 24" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.033-2.134H8.71c-1.123 0-2.033.954-2.033 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);
const ShareIcon = ({ className = '' }) => (
    <svg className={`w-5 h-5 ${className} fill-none stroke-current`} viewBox="0 0 24 24" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.195.025.39.05.586.077a2.25 2.25 0 11-1.172 0c.195-.026.39-.051.586-.077zM12 9.75a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5zM16.783 10.907a2.25 2.25 0 100 2.186m0-2.186c-.195.025-.39.05-.586.077a2.25 2.25 0 111.172 0c-.195-.026-.39-.051-.586-.077z" />
    </svg>
);

// 【新增】分享模态框组件
const ShareModal = ({ url, onClose }) => {
  const shareOptions = [
    { name: '复制链接', action: () => { navigator.clipboard.writeText(url); alert('链接已复制!'); onClose(); } },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { name: 'Messenger', href: `fb-messenger://share?link=${encodeURIComponent(url)}` },
    { name: 'Telegram', href: `https://t.me/share/url?url=${encodeURIComponent(url)}` },
    { name: 'WhatsApp', href: `https://api.whatsapp.com/send?text=${encodeURIComponent(url)}` },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl w-11/12 max-w-xs" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">分享到</h3>
        <div className="grid grid-cols-2 gap-4 text-center">
          {shareOptions.map(opt => (
            opt.action ? (
              <button key={opt.name} onClick={opt.action} className="p-3 text-left bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold">{opt.name}</button>
            ) : (
              <a key={opt.name} href={opt.href} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 block font-semibold">{opt.name}</a>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

// 【重构】CommentItem 组件，支持递归渲染
const CommentItem = ({ comment, allComments, user, postAuthorId, handleVote, handleDelete, handleReply }) => {
  const isCommentLiked = user && comment.likedBy.includes(user.uid);
  const isCommentDisliked = user && comment.dislikedBy.includes(user.uid);
  const isAuthor = user && user.uid === comment.authorId;
  const isPostAuthor = user && user.uid === postAuthorId;
  const canDelete = isAuthor || isPostAuthor;

  const replies = allComments.filter(c => c.parentId === comment.id);

  return (
    <div className="flex items-start space-x-3">
      <Link href={`/profile/${comment.authorId}`} passHref>
        <a>
            <img
                src={comment.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'}
                alt={comment.authorName || '匿名用户'}
                className="w-10 h-10 rounded-full object-cover cursor-pointer"
            />
        </a>
      </Link>
      <div className="flex-1">
        <div className="flex items-center space-x-2">
            <Link href={`/profile/${comment.authorId}`} passHref>
              <a className="font-semibold text-base text-gray-800 dark:text-white cursor-pointer hover:underline">
                {comment.authorName || '匿名用户'}
              </a>
            </Link>
          {comment.authorId === postAuthorId && (
            <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full font-medium">楼主</span>
          )}
        </div>
        <p className="text-gray-800 dark:text-gray-200 my-1 text-base">{comment.text}</p>
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{comment.createdAt}</span>
          <div className="flex items-center space-x-5">
            <button
              onClick={() => handleVote(comment.id, 'like')}
              disabled={!user}
              className={`flex items-center space-x-1 hover:text-yellow-500 transition-colors ${isCommentLiked ? 'text-yellow-400' : ''} ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <StarIcon filled={isCommentLiked} />
              <span>{comment.likedBy.length}</span>
            </button>
            <button
              onClick={() => handleVote(comment.id, 'dislike')}
              disabled={!user}
              className={`flex items-center space-x-1 hover:text-red-500 transition-colors ${isCommentDisliked ? 'text-red-500' : ''} ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <BrokenStarIcon filled={isCommentDisliked} />
              <span>{comment.dislikedBy.length}</span>
            </button>
            <button onClick={() => handleReply(comment)} className="flex items-center space-x-1 hover:text-blue-500 transition-colors">
              <CommentIcon />
              <span>回复</span>
            </button>
            {canDelete && (
                <button onClick={() => handleDelete(comment.id)} className="flex items-center space-x-1 text-gray-400 hover:text-red-500 transition-colors">
                    <TrashIcon />
                </button>
            )}
          </div>
        </div>
        
        {replies.length > 0 && (
          <div className="mt-4 space-y-4 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
            {replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                allComments={allComments}
                user={user}
                postAuthorId={postAuthorId}
                handleVote={handleVote}
                handleDelete={handleDelete}
                handleReply={handleReply}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


const PostDetailPage = () => {
  const router = useRouter();
  const { id: postId } = router.query;
  const { user, userData } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const commentInputRef = useRef(null);

  useEffect(() => {
    if (!postId) return;
    const postRef = doc(db, 'posts', postId);
    const unsubscribe = onSnapshot(postRef, (docSnap) => {
        if (docSnap.exists()) {
            const postData = docSnap.data();
            setPost({
                id: docSnap.id,
                ...postData,
                likes: postData.likes || [],
                dislikes: postData.dislikes || []
            });
        } else {
            console.log("找不到该帖子!");
            setPost(null);
        }
        setLoading(false);
    }, (error) => {
        console.error("获取帖子失败: ", error);
        setLoading(false);
    });
    return () => unsubscribe();
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const allCommentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate().toLocaleString() || '刚刚',
        likedBy: doc.data().likedBy || [],
        dislikedBy: doc.data().dislikedBy || [],
        parentId: doc.data().parentId || null
      }));
      setComments(allCommentsData);
    }, (error) => {
      console.error("实时获取评论失败: ", error);
    });
    return () => unsubscribe();
  }, [postId]);

  const voteHandler = async (docRef, type, currentLikes, currentDislikes) => {
    if (!user) { alert('请登录后操作！'); return; }
    const userId = user.uid;
    let updateData = {};

    if (type === 'like') {
        updateData.dislikes = arrayRemove(userId);
        updateData.likes = currentLikes.includes(userId) ? arrayRemove(userId) : arrayUnion(userId);
    } else {
        updateData.likes = arrayRemove(userId);
        updateData.dislikes = currentDislikes.includes(userId) ? arrayRemove(userId) : arrayUnion(userId);
    }
    await updateDoc(docRef, updateData);
  };
  
  const handlePostVote = (type) => {
    const postRef = doc(db, 'posts', postId);
    voteHandler(postRef, type, post.likes, post.dislikes);
  };
  
  const handleCommentVote = (commentId, type) => {
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
        voteHandler(commentRef, type, comment.likedBy, comment.dislikedBy);
    }
  };

  const handleDeleteComment = async (commentId) => {
    const commentToDelete = comments.find(c => c.id === commentId);
    if (!commentToDelete) return;

    const isAuthor = user && user.uid === commentToDelete.authorId;
    const isPostAuthor = user && user.uid === post.authorId;
    
    if (!isAuthor && !isPostAuthor) {
        alert('您没有权限删除此评论。');
        return;
    }

    if (confirm('确定要删除这条评论吗？')) {
        try {
            const repliesToDelete = comments.filter(c => c.parentId === commentId);
            for (const reply of repliesToDelete) {
                // 递归删除所有子评论
                await handleDeleteComment(reply.id);
            }
            await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
        } catch (error) {
            console.error("删除评论失败: ", error);
            alert('删除评论失败。');
        }
    }
  };

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
        parentId: replyTo ? replyTo.id : null
      });
      setNewComment('');
      setReplyTo(null);
    } catch (error) {
      console.error("添加评论失败: ", error);
    }
  };

  const handleReplyClick = (comment) => {
    setReplyTo({ id: comment.id, authorName: comment.authorName });
    if (commentInputRef.current) {
      commentInputRef.current.focus();
    }
  };

  if (loading) return <LayoutBase><p className="p-8 text-center text-lg">加载中...</p></LayoutBase>;
  if (!post) return <LayoutBase><p className="p-8 text-center text-lg text-red-500">帖子不存在或已被删除。</p></LayoutBase>;

  const mainComments = comments.filter(comment => !comment.parentId);
  const postIsLiked = user && post.likes.includes(user.uid);
  const postIsDisliked = user && post.dislikes.includes(user.uid);

  return (
    <LayoutBase>
      {showShareModal && <ShareModal url={window.location.href} onClose={() => setShowShareModal(false)} />}
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h1 className="text-3xl font-bold mb-6">{post.title}</h1>
          <div className="flex items-center space-x-3 mb-6">
            <Link href={`/profile/${post.authorId}`} passHref>
                <a>
                    <img
                        src={post.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'}
                        alt={post.authorName || '匿名用户'}
                        className="w-12 h-12 rounded-full object-cover cursor-pointer"
                    />
                </a>
            </Link>
            <div>
              <Link href={`/profile/${post.authorId}`} passHref>
                <a className="font-bold text-lg text-gray-900 dark:text-white hover:underline">
                    {post.authorName || '匿名用户'}
                </a>
              </Link>
              <p className="text-sm text-gray-500 dark:text-gray-400">发布于 {post.createdAt?.toDate().toLocaleString() || '未知时间'}</p>
            </div>
          </div>
          
          <div className="prose dark:prose-invert max-w-none text-lg">
            <PostContent content={post.content} />
          </div>

          <div className="flex items-center justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-x-6">
            <button onClick={() => handlePostVote('like')} disabled={!user} className={`flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-yellow-500 transition-colors ${postIsLiked ? 'text-yellow-400' : ''} ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <StarIcon filled={postIsLiked} />
                <span className="font-semibold">{post.likes.length}</span>
            </button>
            <button onClick={() => handlePostVote('dislike')} disabled={!user} className={`flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-red-500 transition-colors ${postIsDisliked ? 'text-red-500' : ''} ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <BrokenStarIcon filled={postIsDisliked} />
                <span className="font-semibold">{post.dislikes.length}</span>
            </button>
            <button onClick={() => setShowShareModal(true)} className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-blue-500 transition-colors">
                <ShareIcon />
                <span className="font-semibold">分享</span>
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-6">评论 ({comments.length})</h2>
          
          {user ? (
            <form onSubmit={handleAddComment} className="mb-8">
              <div className="relative">
                <textarea
                  ref={commentInputRef}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={replyTo ? `回复 @${replyTo.authorName}...` : "发表你的看法..."}
                  rows="4"
                  className="w-full p-3 text-base border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute bottom-3 right-3 flex items-center space-x-2">
                    {replyTo && (
                        <button type="button" onClick={() => setReplyTo(null)} className="text-sm text-gray-500 hover:text-red-500">取消回复</button>
                    )}
                    <button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors">
                        发表评论
                    </button>
                </div>
              </div>
            </form>
          ) : (
            <p className="text-center text-lg text-gray-600 dark:text-gray-400 mb-8">请<Link href="/signin"><a className="text-blue-500 hover:underline">登录</a></Link>后发表评论。</p>
          )}

          <div className="space-y-6">
            {mainComments.map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                allComments={comments}
                user={user}
                postAuthorId={post.authorId}
                handleVote={handleCommentVote}
                handleDelete={handleDeleteComment}
                handleReply={handleReplyClick}
              />
            ))}
          </div>
        </div>
      </div>
    </LayoutBase>
  );
};

export default PostDetailPage;
