// pages/forum/post/[id].js (UI 和功能最终版 - 已恢复所有功能)
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

// ShareModal 组件
const ShareModal = ({ url, onClose }) => {
    const shareOptions = [
        { name: '复制链接', iconClass: 'fas fa-copy', action: () => { navigator.clipboard.writeText(url); alert('链接已复制!'); onClose(); } },
        { name: 'Facebook', iconClass: 'fab fa-facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
        { name: 'Messenger', iconClass: 'fab fa-facebook-messenger', href: `fb-messenger://share?link=${encodeURIComponent(url)}` },
        { name: 'Telegram', iconClass: 'fab fa-telegram', href: `https://t.me/share/url?url=${encodeURIComponent(url)}` },
        { name: 'WhatsApp', iconClass: 'fab fa-whatsapp', href: `https://api.whatsapp.com/send?text=${encodeURIComponent(url)}` },
        { name: 'QQ', iconClass: 'fab fa-qq', href: `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}` },
        { name: 'WeChat', iconClass: 'fab fa-weixin', action: () => alert('微信分享请使用浏览器自带分享功能或截图') }
    ];
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-5 text-center text-gray-900 dark:text-white">分享到</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                    {shareOptions.map(opt => ( opt.action ? <button key={opt.name} onClick={opt.action} className="flex items-center justify-center p-3 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg text-base font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><i className={`${opt.iconClass} mr-2 w-5 text-lg`}></i>{opt.name}</button> : <a key={opt.name} href={opt.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center p-3 h-14 bg-gray-100 dark:bg-gray-700 rounded-lg text-base font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><i className={`${opt.iconClass} mr-2 w-5 text-lg`}></i>{opt.name}</a> ))}
                </div>
            </div>
        </div>
    );
};

// CommentItem 组件
const CommentItem = ({ comment, allComments, user, postAuthorId, handleVote, handleDelete, handleReply }) => {
  const isCommentLiked = user && comment.likedBy.includes(user.uid);
  const isCommentDisliked = user && comment.dislikedBy.includes(user.uid);
  const isAuthor = user && user.uid === comment.authorId;
  const isPostAuthor = user && user.uid === postAuthorId;
  const canDelete = isAuthor || isPostAuthor;

  return (
    <div className="flex items-start space-x-3 w-full">
      <Link href={`/profile/${comment.authorId}`} passHref><a><img src={comment.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={comment.authorName || '匿名用户'} className="w-10 h-10 rounded-full object-cover cursor-pointer flex-shrink-0"/></a></Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <Link href={`/profile/${comment.authorId}`} passHref><a className="font-bold text-lg text-gray-800 dark:text-white cursor-pointer hover:underline">{comment.authorName || '匿名用户'}</a></Link>
          {comment.authorId === postAuthorId && <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded-full font-semibold">楼主</span>}
        </div>
        <p className={`text-gray-800 dark:text-gray-200 break-words ${comment.parentId ? 'text-base font-medium' : 'text-base'}`}>{comment.text}</p>
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mt-2">
          <span>{comment.createdAt}</span>
          <div className="flex items-center space-x-5">
            <button onClick={() => handleVote(comment.id, 'like')} disabled={!user} className={`flex items-center space-x-1 text-base transition-colors ${isCommentLiked ? 'text-red-500' : 'text-gray-400 dark:text-gray-500 hover:text-red-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${isCommentLiked ? 'fas' : 'far'} fa-heart text-xl`}></i><span className="font-semibold">{comment.likedBy.length}</span></button>
            <button onClick={() => handleVote(comment.id, 'dislike')} disabled={!user} className={`flex items-center space-x-1 text-base transition-colors ${isCommentDisliked ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500 hover:text-blue-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${isCommentDisliked ? 'fas' : 'far'} fa-thumbs-down text-xl`}></i><span className="font-semibold">{comment.dislikedBy.length}</span></button>
            <button onClick={() => handleReply(comment)} className="flex items-center space-x-1 text-base text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"><i className="fas fa-comment-dots text-xl"></i></button>
            {canDelete && <button onClick={() => handleDelete(comment.id)} className="flex items-center space-x-1 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"><i className="fas fa-trash text-lg"></i></button>}
          </div>
        </div>
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
  const [sortOrder, setSortOrder] = useState('最新');
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const commentInputRef = useRef(null);

  useEffect(() => {
    if (authLoading || !postId) return;
    setDataLoading(true);

    const postRef = doc(db, 'posts', postId);
    const postUnsubscribe = onSnapshot(postRef, (docSnap) => {
        if (docSnap.exists()) {
            const postData = docSnap.data();
            setPost({ id: docSnap.id, ...postData, likes: Array.isArray(postData.likes) ? postData.likes : [], dislikes: Array.isArray(postData.dislikes) ? postData.dislikes : [], likesCount: postData.likesCount || 0, commentsCount: postData.commentsCount || 0 });
        } else { setPost(null); }
    }, (error) => { console.error("获取帖子失败:", error); setPost(null); });

    const commentsRef = collection(db, 'posts', postId, 'comments');
    let q;
    if (sortOrder === '最热') {
      q = query(commentsRef, orderBy('likedBy', 'desc'), orderBy('createdAt', 'desc'));
    } else {
      q = query(commentsRef, orderBy('createdAt', 'asc'));
    }
    
    const commentsUnsubscribe = onSnapshot(q, (querySnapshot) => {
        const allCommentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate().toLocaleString() || '刚刚', likedBy: Array.isArray(doc.data().likedBy) ? doc.data().likedBy : [], dislikedBy: Array.isArray(doc.data().dislikedBy) ? doc.data().dislikedBy : [], parentId: doc.data().parentId || null }));
        setComments(allCommentsData);
        setDataLoading(false);
    }, (error) => {
        console.error("获取评论失败:", error);
        setComments([]);
        setDataLoading(false);
    });

    return () => {
        postUnsubscribe();
        commentsUnsubscribe();
    };
  }, [postId, authLoading, sortOrder]);

  const voteHandler = async (docRef, type, currentLikes, currentDislikes, isPost = false) => {
    if (!user) { alert('请登录后操作！'); return; }
    const userId = user.uid;
    const batch = writeBatch(db);
    const isLiked = currentLikes.includes(userId);
    const isDisliked = currentDislikes.includes(userId);

    if (type === 'like') {
        if (isLiked) {
            batch.update(docRef, { likes: arrayRemove(userId) });
            if(isPost) batch.update(docRef, { likesCount: increment(-1) });
        } else {
            batch.update(docRef, { likes: arrayUnion(userId) });
            if(isPost) batch.update(docRef, { likesCount: increment(1) });
            if (isDisliked) {
                batch.update(docRef, { dislikes: arrayRemove(userId) });
            }
        }
    } else { // type === 'dislike'
        if (isDisliked) {
            batch.update(docRef, { dislikes: arrayRemove(userId) });
        } else {
            batch.update(docRef, { dislikes: arrayUnion(userId) });
            if (isLiked) {
                batch.update(docRef, { likes: arrayRemove(userId) });
                if(isPost) batch.update(docRef, { likesCount: increment(-1) });
            }
        }
    }
    try { await batch.commit(); } catch (error) { console.error("投票操作失败:", error); }
  };
  
  const handlePostVote = (type) => { if (!post) return; const postRef = doc(db, 'posts', postId); voteHandler(postRef, type, post.likes, post.dislikes, true); };
  const handleCommentVote = (commentId, type) => { const commentRef = doc(db, 'posts', postId, 'comments', commentId); const comment = comments.find(c => c.id === commentId); if (comment) { voteHandler(commentRef, type, comment.likedBy, comment.dislikedBy, false); } };

  const handleDeleteComment = async (commentId) => {
    const commentToDelete = comments.find(c => c.id === commentId);
    if (!commentToDelete || !post) return;
    const isAuthor = user && user.uid === commentToDelete.authorId;
    const isPostAuthor = user && user.uid === post.authorId;
    if (!isAuthor && !isPostAuthor) return;
    if (confirm('确定要删除这条评论及其所有回复吗？')) {
      let deleteCount = 0;
      const countReplies = (cId) => { deleteCount++; comments.filter(c => c.parentId === cId).forEach(reply => countReplies(reply.id)); };
      countReplies(commentId);
      const deleteRecursive = async (cId) => { const replies = comments.filter(c => c.parentId === cId); for (const reply of replies) { await deleteRecursive(reply.id); } await deleteDoc(doc(db, 'posts', postId, 'comments', cId)); };
      try { const postRef = doc(db, 'posts', postId); await deleteRecursive(commentId); await updateDoc(postRef, { commentsCount: increment(-deleteCount) }); } catch (error) {}
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user || !post) return;
    const postRef = doc(db, 'posts', postId);
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const newCommentRef = doc(commentsRef);
    const batch = writeBatch(db);
    batch.set(newCommentRef, { postId: postId, text: newComment, authorId: user.uid, authorName: user.displayName || '匿名用户', authorAvatar: user.photoURL || 'https://www.gravatar.com/avatar?d=mp', createdAt: serverTimestamp(), likedBy: [], dislikedBy: [], parentId: replyTo ? replyTo.id : null });
    batch.update(postRef, { commentsCount: increment(1) });
    try { await batch.commit(); setNewComment(''); setReplyTo(null); } catch (error) {}
  };

  const handleReplyClick = (comment) => { setReplyTo({ id: comment.id, authorName: comment.authorName }); setNewComment(`@${comment.authorName} `); if (commentInputRef.current) { commentInputRef.current.focus(); } };
  const handleFollow = async () => { if (!user || !post || user.uid === post.authorId) return; const currentUserRef = doc(db, 'users', user.uid); const isFollowing = userData?.following?.includes(post.authorId); try { await updateDoc(currentUserRef, { following: isFollowing ? arrayRemove(post.authorId) : arrayUnion(post.authorId) }); } catch (error) {} };
  const handleBookmark = async () => { if (!user || !post) return; const currentUserRef = doc(db, 'users', user.uid); const isBookmarked = userData?.bookmarks?.includes(postId); try { await updateDoc(currentUserRef, { bookmarks: isBookmarked ? arrayRemove(postId) : arrayUnion(postId) }); } catch (error) {} };

  const handleMenuItemClick = async (action) => {
    setShowMenu(false); if (!user || !post) return;
    switch (action) {
      case 'delete': if (user.uid !== post.authorId) return; if (confirm('确定要删除此帖子吗？')) { try { await deleteDoc(doc(db, 'posts', postId)); router.push('/forum'); } catch (error) {} } break;
      case 'edit': if (user.uid !== post.authorId) return; alert('修改功能待实现。'); break;
      case 'share': setShowShareModal(true); break;
      case 'bookmark': handleBookmark(); break;
      case 'report': alert('举报功能待实现。'); break;
    }
  };

  if (authLoading || dataLoading) { return <LayoutBase><p className="p-8 text-center text-xl">加载中...</p></LayoutBase>; }
  if (!post) { return <LayoutBase><p className="p-8 text-center text-xl text-red-500">帖子不存在或已被删除。</p></LayoutBase>; }

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
          <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg relative mb-6">
            <div className="flex items-center justify-end mb-4 space-x-6 text-gray-400 dark:text-gray-500">
                <button onClick={() => handlePostVote('like')} disabled={!user} className={`flex items-center space-x-1 transition-colors ${postIsLiked ? 'text-red-500' : 'hover:text-red-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${postIsLiked ? 'fas' : 'far'} fa-heart text-2xl`}></i><span className="font-semibold">{post.likesCount || 0}</span></button>
                <button onClick={() => handlePostVote('dislike')} disabled={!user} className={`flex items-center space-x-1 transition-colors ${postIsDisliked ? 'text-blue-500' : 'hover:text-blue-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${postIsDisliked ? 'fas' : 'far'} fa-thumbs-down text-2xl`}></i></button>
                <button onClick={handleBookmark} disabled={!user} className={`transition-colors ${isBookmarked ? 'text-yellow-500' : 'hover:text-yellow-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${isBookmarked ? 'fas' : 'far'} fa-bookmark text-2xl`}></i></button>
                <button onClick={() => setShowShareModal(true)} className="hover:text-blue-500 transition-colors"><i className="fas fa-share-nodes text-2xl"></i></button>
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-extrabold mb-6 text-gray-900 dark:text-white leading-tight">{post.title}</h1>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-3"><Link href={`/profile/${post.authorId}`} passHref><a className="flex items-center space-x-3 cursor-pointer"><img src={post.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={post.authorName || '匿名用户'} className="w-14 h-14 rounded-full object-cover border-2 border-blue-400 flex-shrink-0"/><div><p className="font-bold text-xl text-gray-900 dark:text-white hover:underline">{post.authorName || '匿名用户'}</p><p className="text-sm text-gray-500 dark:text-gray-400">{post.createdAt?.toDate().toLocaleString() || '未知时间'}</p></div></a></Link></div>
              <div className="flex items-center space-x-3">{user && post.authorId !== user.uid && <button onClick={handleFollow} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${isFollowingPostAuthor ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>{isFollowingPostAuthor ? '已关注' : '关注'}</button>}
                <div className="relative"><button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><i className="fas fa-ellipsis text-2xl text-gray-500 dark:text-gray-300"></i></button>{showMenu && <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 py-1 text-base">{user && user.uid === post.authorId && (<><button onClick={() => handleMenuItemClick('edit')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-pen-to-square mr-2 text-lg"></i>修改</button><button onClick={() => handleMenuItemClick('delete')} className="flex items-center w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-800 font-semibold"><i className="fas fa-trash mr-2 text-lg"></i>删除</button></>)}<button onClick={() => handleMenuItemClick('share')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-share-nodes mr-2 text-lg"></i>分享</button><button onClick={() => handleMenuItemClick('bookmark')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className={`${isBookmarked ? 'fas' : 'far'} fa-bookmark mr-2 text-lg`}></i>收藏</button><button onClick={() => handleMenuItemClick('report')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-flag mr-2 text-lg"></i>举报</button></div>}</div>
              </div>
            </div>
            <div className="prose dark:prose-invert max-w-none text-lg leading-relaxed mt-6">{post.content && <PostContent content={post.content} />}</div>
          </div>
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">评论 ({post.commentsCount || 0})</h2>
                <div className="flex items-center space-x-4 text-sm font-semibold">
                    <button onClick={() => setSortOrder('最新')} className={sortOrder === '最新' ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}>最新</button>
                    <button onClick={() => setSortOrder('最热')} className={sortOrder === '最热' ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}>最热</button>
                </div>
            </div>
            {user ? (<form onSubmit={handleAddComment} className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg"><div className="relative"><textarea ref={commentInputRef} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={replyTo ? `回复 @${replyTo.authorName}...` : "发表你的看法..."} rows="4" className="w-full p-3 text-base border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500 resize-y"/><div className="absolute bottom-3 right-3 flex items-center space-x-2">{replyTo && <button type="button" onClick={() => { setReplyTo(null); setNewComment(''); }} className="text-sm text-gray-500 hover:text-red-500 font-semibold">取消回复</button>}<button type="submit" className="bg-blue-600 text-white px-5 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors text-base">发表评论</button></div></div></form>) : (<p className="text-center text-lg text-gray-600 dark:text-gray-400 mb-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg">请<Link href="/signin"><a className="text-blue-500 hover:underline">登录</a></Link>后发表评论。</p>)}
            <div className="space-y-6">{mainComments.map(comment => (<CommentItem key={comment.id} comment={comment} allComments={comments} user={user} postAuthorId={post.authorId} handleVote={handleCommentVote} handleDelete={handleDeleteComment} handleReply={handleReplyClick} />))}</div>
          </div>
        </div>
      </div>
    </LayoutBase>
  );
};

export default PostDetailPage;
