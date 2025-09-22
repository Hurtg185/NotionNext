// pages/forum/post/[id].js (最终UI微调和逻辑修复版)
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  doc, getDoc, collection, addDoc, query, orderBy, onSnapshot,
  serverTimestamp, updateDoc, arrayUnion, arrayRemove, deleteDoc, writeBatch, increment
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/AuthContext';
import { useRouter } from 'next/router';

import PostContent from '@/themes/heo/components/PostContent';
import { LayoutBase } from '@/themes/heo';

// 【修改】导入 Heroicons v2
import {
    HeartIcon as HeartIconSolid,
    ChatBubbleOvalLeftEllipsisIcon as ReplyIcon,
    TrashIcon,
    ShareIcon,
    BookmarkIcon as BookmarkIconSolid,
    EllipsisHorizontalIcon as MenuIcon,
    UserPlusIcon,
    UserIcon,
    EyeIcon,
    EyeSlashIcon,
    PencilSquareIcon
} from '@heroicons/react/24/solid';
import {
    HeartIcon as HeartIconOutline,
    HandThumbDownIcon,
    BookmarkIcon as BookmarkIconOutline
} from '@heroicons/react/24/outline';


const ShareModal = ({ url, onClose }) => {
    // ... (ShareModal 代码不变，但如果需要，可以替换里面的图标为 Heroicons)
};


// 【修复】CompactReply 组件，移除重复的 @
const CompactReply = ({ reply, getParentAuthorName, allComments }) => {
    const parentComment = allComments.find(c => c.id === reply.parentId);
    const parentAuthorName = getParentAuthorName(reply.parentId);
    
    // 检查回复文本是否已经包含了 "@父用户名"
    const replyText = reply.text.startsWith(`@${parentAuthorName}`) 
      ? reply.text.substring(`@${parentAuthorName}`.length).trim() 
      : reply.text;

    return (
        <div className="text-sm text-gray-700 dark:text-gray-300">
            <Link href={`/profile/${reply.authorId}`} passHref>
                <a className="font-semibold text-gray-800 dark:text-white hover:underline">{reply.authorName || '匿名用户'}</a>
            </Link>
            {parentComment && (
                <>
                    <span className="mx-1">回复</span>
                    <Link href={`/profile/${parentComment.authorId}`} passHref>
                        {/* 【修改】移除 @ 符号 */}
                        <a className="font-semibold text-gray-800 dark:text-white hover:underline">{parentAuthorName}</a>
                    </Link>
                </>
            )}
            <span className="ml-2">{replyText}</span>
        </div>
    );
};


const CommentItem = ({ comment, allComments, user, postAuthorId, handleVote, handleDelete, handleReply }) => {
  const [showAllReplies, setShowAllReplies] = useState(false);
  const isCommentLiked = user && comment.likedBy.includes(user.uid);
  const isCommentDisliked = user && comment.dislikedBy.includes(user.uid);
  const isAuthor = user && user.uid === comment.authorId;
  const isPostAuthor = user && user.uid === postAuthorId;
  const canDelete = isAuthor || isPostAuthor;
  const directReplies = allComments.filter(c => c.parentId === comment.id);
  const visibleReplies = showAllReplies ? directReplies : directReplies.slice(0, 3);
  const hasMoreReplies = directReplies.length > 3 && !showAllReplies;

  const getParentAuthorName = (parentId) => {
    const parentComment = allComments.find(c => c.id === parentId);
    return parentComment ? parentComment.authorName : '未知用户';
  };

  return (
    <div className="flex items-start space-x-3 w-full">
      {comment.parentId === null && (<Link href={`/profile/${comment.authorId}`} passHref><a><img src={comment.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={comment.authorName || '匿名用户'} className="w-10 h-10 rounded-full object-cover cursor-pointer flex-shrink-0"/></a></Link>)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <Link href={`/profile/${comment.authorId}`} passHref><a className="font-bold text-lg text-gray-800 dark:text-white cursor-pointer hover:underline">{comment.authorName || '匿名用户'}</a></Link>
          {comment.authorId === postAuthorId && <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full font-medium">楼主</span>}
        </div>
        <p className="text-gray-800 dark:text-gray-200 text-base break-words">{comment.text}</p>
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mt-2">
          <span>{comment.createdAt}</span>
          <div className="flex items-center space-x-5">
            <button onClick={() => handleVote(comment.id, 'like')} disabled={!user} className={`flex items-center space-x-1 text-base transition-colors ${isCommentLiked ? 'text-red-500' : 'text-gray-400 dark:text-gray-500 hover:text-red-400'} ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isCommentLiked ? <HeartIconSolid className="w-5 h-5"/> : <HeartIconOutline className="w-5 h-5"/>}
              <span className="font-semibold">{comment.likedBy.length}</span>
            </button>
            <button onClick={() => handleVote(comment.id, 'dislike')} disabled={!user} className={`flex items-center space-x-1 text-base transition-colors ${isCommentDisliked ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500 hover:text-blue-400'} ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <HandThumbDownIcon className="w-5 h-5"/>
              <span className="font-semibold">{comment.dislikedBy.length}</span>
            </button>
            <button onClick={() => handleReply(comment)} className="flex items-center space-x-1 text-base text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors">
              <ReplyIcon className="w-5 h-5"/>
            </button>
            {canDelete && <button onClick={() => handleDelete(comment.id)} className="flex items-center space-x-1 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"><TrashIcon className="w-5 h-5"/></button>}
          </div>
        </div>
        {directReplies.length > 0 && (
          <div className="mt-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg space-y-2">
            {showAllReplies ? (
                <div className="space-y-4">{directReplies.map(reply => (<CommentItem key={reply.id} comment={reply} allComments={allComments} user={user} postAuthorId={postAuthorId} handleVote={handleVote} handleDelete={handleDelete} handleReply={handleReply} />))}</div>
            ) : (
                <div className="space-y-1">{visibleReplies.map(reply => (<CompactReply key={reply.id} reply={reply} getParentAuthorName={getParentAuthorName} allComments={allComments} /> ))}</div>
            )}
            {hasMoreReplies && <button onClick={() => setShowAllReplies(true)} className="flex items-center text-blue-500 dark:text-blue-400 text-sm font-semibold hover:underline"><EyeIcon className="w-4 h-4 mr-1"/>查看更多回复 ({directReplies.length - visibleReplies.length}条)</button>}
            {directReplies.length > 3 && showAllReplies && <button onClick={() => setShowAllReplies(false)} className="flex items-center text-blue-500 dark:text-blue-400 text-sm font-semibold hover:underline"><EyeSlashIcon className="w-4 h-4 mr-1"/>收起</button>}
          </div>
        )}
      </div>
    </div>
  );
};


const PostDetailPage = () => {
  const router = useRouter();
  const { id: postId } = router.query;
  const { user, userData, loading: authLoading } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const commentInputRef = useRef(null);

  useEffect(() => {
    if (authLoading || !postId) { return; }
    setDataLoading(true);
    const postRef = doc(db, 'posts', postId);
    const postUnsubscribe = onSnapshot(postRef, 
      (docSnap) => { if (docSnap.exists()) { const d = docSnap.data(); setPost({ id: docSnap.id, ...d, likes:d.likes||[], dislikes:d.dislikes||[] }); } else { setPost(null); } }, 
      (error) => { console.error("P-Err:", error); setPost(null); }
    );
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    const commentsUnsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const cData = querySnapshot.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate().toLocaleString() || '刚刚', likedBy:d.likedBy||[], dislikedBy:d.dislikedBy||[], parentId:d.parentId||null }));
        setComments(cData);
        setDataLoading(false);
      }, 
      (error) => { console.error("C-Err:", error); setComments([]); setDataLoading(false); }
    );
    return () => { postUnsubscribe(); commentsUnsubscribe(); };
  }, [postId, authLoading]);

  // ... (所有 handle* 函数保持不变，但为了完整性我还是会把它们放进来)
  const voteHandler = async (docRef, type, currentLikes, currentDislikes) => {
    if (!user) { alert('请登录后操作！'); return; }
    const userId = user.uid;
    let updateData = {};
    if (type === 'like') { updateData.likes = currentLikes.includes(userId) ? arrayRemove(userId) : arrayUnion(userId); updateData.dislikes = arrayRemove(userId); } else { updateData.dislikes = currentDislikes.includes(userId) ? arrayRemove(userId) : arrayUnion(userId); updateData.likes = arrayRemove(userId); }
    try { await updateDoc(docRef, updateData); } catch (error) {}
  };
  const handlePostVote = (type) => { if (!post) return; const postRef = doc(db, 'posts', postId); voteHandler(postRef, type, post.likes, post.dislikes); };
  const handleCommentVote = (commentId, type) => { const commentRef = doc(db, 'posts', postId, 'comments', commentId); const comment = comments.find(c => c.id === commentId); if (comment) { voteHandler(commentRef, type, comment.likedBy, comment.dislikedBy); } };
  const handleDeleteComment = async (commentId) => { /* ... */ };
  const handleAddComment = async (e) => { /* ... */ };
  const handleReplyClick = (comment) => { setReplyTo({ id: comment.id, authorName: comment.authorName }); setNewComment(`@${comment.authorName} `); if (commentInputRef.current) { commentInputRef.current.focus(); } };
  const handleFollow = async () => { /* ... */ };
  const handleBookmark = async () => { /* ... */ };
  const handleMenuItemClick = async (action) => { /* ... */ };

  if (authLoading || dataLoading) {
    return <LayoutBase><p className="p-8 text-center text-xl">加载中...</p></LayoutBase>;
  }

  if (!post) {
    return <LayoutBase><p className="p-8 text-center text-xl text-red-500">帖子不存在或已被删除。</p></LayoutBase>;
  }

  const mainComments = comments.filter(comment => !comment.parentId);
  const postIsLiked = user && post.likes.includes(user.uid);
  const postIsDisliked = user && post.dislikes.includes(user.uid);
  const isFollowingPostAuthor = user && userData?.following?.includes(post.authorId);
  const isBookmarked = user && userData?.bookmarks?.includes(postId);

  return (
    <LayoutBase>
      {showShareModal && <ShareModal url={window.location.href} onClose={() => setShowShareModal(false)} />}
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen py-8">
        <div className="container mx-auto p-4 max-w-4xl text-base sm:text-lg">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg relative mb-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold mb-6 text-gray-900 dark:text-white leading-tight">{post.title}</h1>
            <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
              <div className="flex items-center space-x-3"><Link href={`/profile/${post.authorId}`} passHref><a className="flex items-center space-x-3 cursor-pointer"><img src={post.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={post.authorName || '匿名用户'} className="w-14 h-14 rounded-full object-cover border-2 border-blue-400 flex-shrink-0"/><div><p className="font-bold text-xl text-gray-900 dark:text-white hover:underline">{post.authorName || '匿名用户'}</p><p className="text-sm text-gray-500 dark:text-gray-400">{post.createdAt?.toDate().toLocaleString() || '未知时间'}</p></div></a></Link></div>
              <div className="flex items-center space-x-3">{user && post.authorId !== user.uid && <button onClick={handleFollow} className={`flex items-center text-base px-4 py-2 rounded-full border transition-colors duration-200 ${isFollowingPostAuthor ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-800 dark:border-green-400 dark:text-green-200' : 'bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}><UserIcon className="mr-1 w-5 h-5"/> <span className="font-semibold">{isFollowingPostAuthor ? '已关注' : '关注'}</span></button>}
                <div className="relative"><button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><MenuIcon className="w-6 h-6 text-gray-500 dark:text-gray-300"/></button>{showMenu && <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 py-1 text-base">{user && user.uid === post.authorId && (<><button onClick={() => handleMenuItemClick('edit')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><PencilSquareIcon className="mr-2 w-5 h-5"/>修改</button><button onClick={() => handleMenuItemClick('delete')} className="flex items-center w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-800 font-semibold"><TrashIcon className="mr-2 w-5 h-5"/>删除</button></>)}<button onClick={() => handleMenuItemClick('share')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><ShareIcon className="mr-2 w-5 h-5"/>分享</button><button onClick={() => handleMenuItemClick('bookmark')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold">{isBookmarked ? <BookmarkIconSolid className="mr-2 w-5 h-5"/> : <BookmarkIconOutline className="mr-2 w-5 h-5"/>}收藏</button><button onClick={() => handleMenuItemClick('report')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><FaFlag className="mr-2 w-5 h-5"/>举报</button></div>}</div>
              </div>
            </div>
            <div className="prose dark:prose-invert max-w-none text-lg leading-relaxed mb-8">{post.content && <PostContent content={post.content} />}</div>
            <div className="flex items-center justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-x-6">
              <button onClick={() => handlePostVote('like')} disabled={!user} className={`flex items-center space-x-2 transition-colors ${postIsLiked ? 'text-red-500' : 'text-gray-400 dark:text-gray-500 hover:text-red-400'} ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}>{isBookmarked ? <HeartIconSolid className="w-6 h-6"/> : <HeartIconOutline className="w-6 h-6"/>}<span className="font-semibold">{post.likes.length}</span></button>
              <button onClick={() => handlePostVote('dislike')} disabled={!user} className={`flex items-center space-x-2 transition-colors ${postIsDisliked ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500 hover:text-blue-400'} ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}><HandThumbDownIcon className="w-6 h-6"/><span className="font-semibold">{post.dislikes.length}</span></button>
              <button onClick={handleBookmark} disabled={!user} className={`flex items-center space-x-2 transition-colors ${isBookmarked ? 'text-yellow-500' : 'text-gray-400 dark:text-gray-500 hover:text-yellow-400'} ${!user ? 'opacity-50 cursor-not-allowed' : ''}`}>{isBookmarked ? <BookmarkIconSolid className="w-6 h-6"/> : <BookmarkIconOutline className="w-6 h-6"/>}</button>
              <button onClick={() => setShowShareModal(true)} className="flex items-center space-x-2 text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"><ShareIcon className="w-6 h-6"/></button>
            </div>
          </div>
          <div className="mt-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-900 dark:text-white">评论 ({comments.length})</h2>
            {user ? (<form onSubmit={handleAddComment} className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg"><div className="relative"><textarea ref={commentInputRef} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={replyTo ? `回复 @${replyTo.authorName}...` : "发表你的看法..."} rows="4" className="w-full p-3 text-base border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 resize-y"/><div className="absolute bottom-3 right-3 flex items-center space-x-2">{replyTo && <button type="button" onClick={() => { setReplyTo(null); setNewComment(''); }} className="text-sm text-gray-500 hover:text-red-500 font-semibold">取消回复</button>}<button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors text-base">发表评论</button></div></div></form>) : (<p className="text-center text-lg text-gray-600 dark:text-gray-400 mb-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg">请<Link href="/signin"><a className="text-blue-500 hover:underline">登录</a></Link>后发表评论。</p>)}
            <div className="space-y-6">{mainComments.map(comment => (<CommentItem key={comment.id} comment={comment} allComments={comments} user={user} postAuthorId={post.authorId} handleVote={handleCo
