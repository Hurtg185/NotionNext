// pages/forum/post/[id].js (最终完整版 - 集成 TTS 和 Gemini 翻译)
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

// =====================================
// 1. 模态框和辅助组件
// =====================================

const ShareModal = ({ url, onClose }) => {
    // ... (ShareModal 代码不变)
};

const GeminiSettingsModal = ({ isOpen, onClose, onSave, currentKey, currentModel }) => {
  const [apiKey, setApiKey] = useState(currentKey);
  const [model, setModel] = useState(currentModel);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(apiKey, model);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-4">Gemini 翻译设置</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">API 密钥 (Key)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="请输入你的 Gemini API Key"
              className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700"
            />
             <p className="text-xs text-gray-500 mt-1">你的密钥将仅存储在你的浏览器中，不会上传到服务器。</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">模型 (Model)</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="例如 gemini-pro"
              className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700"
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end space-x-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">取消</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded-md">保存</button>
        </div>
      </div>
    </div>
  );
};

const CompactReply = ({ reply }) => (
    <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
        <Link href={`/profile/${reply.authorId}`} passHref>
            <a className="font-semibold text-gray-800 dark:text-white hover:underline">{reply.authorName || '匿名用户'}</a>
        </Link>
        <span className="ml-2">{reply.text}</span>
    </div>
);

const CommentItem = ({ comment, allComments, user, postAuthorId, handleVote, handleDelete, handleReply, handleTTS, handleTranslate, translatedText, isTranslating }) => {
  const [showFullText, setShowFullText] = useState(false);
  const isCommentLiked = user && Array.isArray(comment.likedBy) && comment.likedBy.includes(user.uid);
  const isCommentDisliked = user && Array.isArray(comment.dislikedBy) && comment.dislikedBy.includes(user.uid);
  const isAuthor = user && user.uid === comment.authorId;
  const isPostAuthor = user && user.uid === postAuthorId;
  const canDelete = isAuthor || isPostAuthor;
  const directReplies = allComments.filter(c => c.parentId === comment.id);
  const visibleReplies = directReplies.slice(0, 2);
  const hasMoreReplies = directReplies.length > 2;
  
  const contentToShow = translatedText || comment.text;
  const canToggle = contentToShow.length > 200;

  return (
    <div className="flex items-start space-x-3 w-full">
      {(comment.parentId === null) && (
        <Link href={`/profile/${comment.authorId}`} passHref><a><img src={comment.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={comment.authorName || '匿名用户'} className="w-10 h-10 rounded-full object-cover cursor-pointer flex-shrink-0"/></a></Link>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <Link href={`/profile/${comment.authorId}`} passHref><a className="font-bold text-lg text-gray-800 dark:text-white cursor-pointer hover:underline">{comment.authorName || '匿名用户'}</a></Link>
          {comment.authorId === postAuthorId && <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded-full font-semibold">楼主</span>}
        </div>
        <p className="text-gray-800 dark:text-gray-200 text-base font-normal break-words">
          {canToggle && !showFullText ? `${contentToShow.substring(0, 200)}...` : contentToShow}
        </p>
        {canToggle && (<button onClick={() => setShowFullText(!showFullText)} className="text-blue-500 text-sm mt-1">{showFullText ? '收起' : '展开'}</button>)}
        {translatedText && (<button onClick={() => handleTranslate(comment.text, 'comment', comment.id, true)} className="text-gray-500 text-sm mt-1 ml-2">查看原文</button>)}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mt-2">
          <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
          <div className="flex items-center space-x-5">
            <button onClick={() => handleTTS(contentToShow)} className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"><i className="fas fa-volume-high text-xl"></i></button>
            <button onClick={() => handleTranslate(comment.text, 'comment', comment.id)} disabled={isTranslating} className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors disabled:opacity-50"><i className="fas fa-language text-xl"></i></button>
            <button onClick={() => handleVote(comment.id, 'like')} disabled={!user} className={`flex items-center space-x-1 text-base transition-colors ${isCommentLiked ? 'text-red-500' : 'text-gray-400 dark:text-gray-500 hover:text-red-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${isCommentLiked ? 'fas' : 'far'} fa-heart text-xl`}></i><span className="font-semibold">{comment.likedBy?.length || 0}</span></button>
            <button onClick={() => handleVote(comment.id, 'dislike')} disabled={!user} className={`flex items-center space-x-1 text-base transition-colors ${isCommentDisliked ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500 hover:text-blue-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${isCommentDisliked ? 'fas' : 'far'} fa-thumbs-down text-xl`}></i><span className="font-semibold">{comment.dislikedBy?.length || 0}</span></button>
            <button onClick={() => handleReply(comment)} className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"><i className="fas fa-comment-dots text-xl"></i></button>
            {canDelete && <button onClick={() => handleDelete(comment.id)} className="text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors"><i className="fas fa-trash text-lg"></i></button>}
          </div>
        </div>
        {directReplies.length > 0 && (
          <div className="mt-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg space-y-2">
            <div className="space-y-1">{visibleReplies.map(reply => (<CompactReply key={reply.id} reply={reply} />))}</div>
            {hasMoreReplies && (<Link href={`/forum/comment/${comment.id}`} passHref><a className="text-blue-500 dark:text-blue-400 text-sm font-semibold hover:underline mt-2 inline-block">查看全部 {directReplies.length} 条回复</a></Link>)}
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
  const [sortOrder, setSortOrder] = useState('最新');
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const commentInputRef = useRef(null);

  const [currentAudio, setCurrentAudio] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedPostContent, setTranslatedPostContent] = useState(null);
  const [translatedComments, setTranslatedComments] = useState({});
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState('gemini-pro');

  useEffect(() => {
    const savedKey = localStorage.getItem('geminiApiKey');
    const savedModel = localStorage.getItem('geminiModel');
    if (savedKey) setGeminiApiKey(savedKey);
    if (savedModel) setGeminiModel(savedModel);
  }, []);

  useEffect(() => {
    if (authLoading || !postId) return;
    setDataLoading(true);
    const postRef = doc(db, 'posts', postId);
    const postUnsubscribe = onSnapshot(postRef, (docSnap) => { if (docSnap.exists()) { const postData = docSnap.data(); setPost({ id: docSnap.id, ...postData, likes: Array.isArray(postData.likes) ? postData.likes : [], dislikes: Array.isArray(postData.dislikes) ? postData.dislikes : [], likesCount: postData.likesCount || 0, commentsCount: postData.commentsCount || 0 }); } else { setPost(null); } }, (error) => { console.error("获取帖子失败:", error); setPost(null); });
    const commentsRef = collection(db, 'posts', postId, 'comments');
    let q;
    if (sortOrder === '最热') { q = query(commentsRef, orderBy('likedByCount', 'desc'), orderBy('createdAt', 'desc')); } else { q = query(commentsRef, orderBy('createdAt', 'asc')); }
    const commentsUnsubscribe = onSnapshot(q, (querySnapshot) => { const allCommentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate() || new Date(), likedBy: Array.isArray(doc.data().likedBy) ? doc.data().likedBy : [], dislikedBy: Array.isArray(doc.data().dislikedBy) ? doc.data().dislikedBy : [], parentId: doc.data().parentId || null })); setComments(allCommentsData); setDataLoading(false); }, (error) => { console.error("获取评论失败:", error); setComments([]); setDataLoading(false); });
    return () => { postUnsubscribe(); commentsUnsubscribe(); };
  }, [postId, authLoading, sortOrder]);

  const handleTTS = (text) => {
    if (currentAudio) { currentAudio.pause(); }
    const encodedText = encodeURIComponent(text);
    const ttsUrl = `https://t.leftsite.cn/tts?t=${encodedText}&v=zh-CN-XiaoxiaoMultilingualNeural&r=0&p=0&o=audio-24khz-48kbitrate-mono-mp3`;
    const audio = new Audio(ttsUrl);
    audio.play();
    setCurrentAudio(audio);
  };

  const callGeminiApi = async (text, apiKey, model) => {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const prompt = `Translate the following text into Chinese. Do not add any extra explanations, introductory phrases, or quotation marks. Just return the translated text directly:\n\n"${text}"`;
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message || 'Gemini API request failed');
    }
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  };

  const handleTranslate = async (text, type, id, forceOriginal = false) => {
    if (forceOriginal) {
      if (type === 'post') setTranslatedPostContent(null);
      if (type === 'comment') setTranslatedComments(prev => ({ ...prev, [id]: null }));
      return;
    }
    if (!geminiApiKey) { setIsGeminiModalOpen(true); return; }
    setIsTranslating(true);
    try {
      const translatedText = await callGeminiApi(text, geminiApiKey, geminiModel);
      if (type === 'post') setTranslatedPostContent(translatedText);
      if (type === 'comment') setTranslatedComments(prev => ({ ...prev, [id]: translatedText }));
    } catch (error) { console.error('翻译错误:', error); alert(`翻译失败: ${error.message}`); } finally { setIsTranslating(false); }
  };
  
  const handleSaveGeminiSettings = (key, model) => {
    localStorage.setItem('geminiApiKey', key);
    localStorage.setItem('geminiModel', model);
    setGeminiApiKey(key);
    setGeminiModel(model);
    alert('设置已保存！');
  };

  const voteHandler = async (docRef, type, currentLikes, currentDislikes, isPost = false) => {
    if (!user) { alert('请登录后操作！'); return; }
    const userId = user.uid;
    const batch = writeBatch(db);
    const isLiked = currentLikes.includes(userId);
    const isDisliked = currentDislikes.includes(userId);
    if (type === 'like') {
        if (isLiked) { batch.update(docRef, { likedBy: arrayRemove(userId) }); if(isPost) { batch.update(docRef, { likesCount: increment(-1) }); } else { batch.update(docRef, { likedByCount: increment(-1) }); } }
        else { batch.update(docRef, { likedBy: arrayUnion(userId) }); if(isPost) { batch.update(docRef, { likesCount: increment(1) }); } else { batch.update(docRef, { likedByCount: increment(1) }); } if (isDisliked) { batch.update(docRef, { dislikedBy: arrayRemove(userId) }); } }
    } else {
        if (isDisliked) { batch.update(docRef, { dislikedBy: arrayRemove(userId) }); }
        else { batch.update(docRef, { dislikedBy: arrayUnion(userId) }); if (isLiked) { batch.update(docRef, { likedBy: arrayRemove(userId) }); if(isPost) { batch.update(docRef, { likesCount: increment(-1) }); } else { batch.update(docRef, { likedByCount: increment(-1) }); } } }
    }
    try { await batch.commit(); } catch (error) { console.error("投票操作失败:", error); }
  };
  
  const handlePostVote = (type) => { if (!post) return; const postRef = doc(db, 'posts', postId); voteHandler(postRef, type, post.likes, post.dislikes, true); };
  const handleCommentVote = (commentId, type) => { const commentRef = doc(db, 'posts', postId, 'comments', commentId); const comment = comments.find(c => c.id === commentId); if (comment) { voteHandler(commentRef, type, comment.likedBy, comment.dislikedBy, false); } };
  const handleDeleteComment = async (commentId) => { if (!post) return; const isAuthor = user && user.uid === comments.find(c => c.id === commentId)?.authorId; const isPostAuthor = user && user.uid === post.authorId; if (!isAuthor && !isPostAuthor) return; if (confirm('确定要删除这条评论及其所有回复吗？')) { let count = 0; const countReplies = (cId) => { count++; comments.filter(c => c.parentId === cId).forEach(r => countReplies(r.id)); }; countReplies(commentId); const deleteRecursive = async (cId) => { const replies = comments.filter(c => c.parentId === cId); for (const r of replies) { await deleteRecursive(r.id); } await deleteDoc(doc(db, 'posts', postId, 'comments', cId)); }; try { await deleteRecursive(commentId); await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(-count) }); } catch (error) {} } };
  const handleAddComment = async (e) => { e.preventDefault(); if (!newComment.trim() || !user || !post) return; const postRef = doc(db, 'posts', postId); const commentsRef = collection(db, 'posts', postId, 'comments'); const newCommentRef = doc(commentsRef); const batch = writeBatch(db); batch.set(newCommentRef, { postId: postId, text: newComment, authorId: user.uid, authorName: user.displayName || '匿名用户', authorAvatar: user.photoURL || 'https://www.gravatar.com/avatar?d=mp', createdAt: serverTimestamp(), likedBy: [], dislikedBy: [], likedByCount: 0, parentId: replyTo ? replyTo.id : null }); batch.update(postRef, { commentsCount: increment(1) }); try { await batch.commit(); setNewComment(''); setReplyTo(null); } catch (error) {} };
  const handleReplyClick = (comment) => { setReplyTo({ id: comment.id, authorName: comment.authorName }); setNewComment(`@${comment.authorName} `); if (commentInputRef.current) { commentInputRef.current.focus(); } };
  const handleFollow = async () => { if (!user || !post || user.uid === post.authorId) return; const userRef = doc(db, 'users', user.uid); try { await updateDoc(userRef, { following: userData?.following?.includes(post.authorId) ? arrayRemove(post.authorId) : arrayUnion(post.authorId) }); } catch (error) {} };
  const handleBookmark = async () => { if (!user || !post) return; const userRef = doc(db, 'users', user.uid); try { await updateDoc(userRef, { bookmarks: userData?.bookmarks?.includes(postId) ? arrayRemove(postId) : arrayUnion(postId) }); } catch (error) {} };
  const handleMenuItemClick = async (action) => { setShowMenu(false); if (!user || !post) return; switch (action) { case 'delete': if (user.uid !== post.authorId) return; if (confirm('确定要删除此帖子吗？')) { try { await deleteDoc(doc(db, 'posts', postId)); router.push('/forum'); } catch (error) {} } break; case 'edit': if (user.uid !== post.authorId) return; alert('修改功能待实现。'); break; case 'share': setShowShareModal(true); break; case 'bookmark': handleBookmark(); break; case 'report': alert('举报功能待实现。'); break; case 'gemini': setIsGeminiModalOpen(true); break; } };

  if (authLoading || dataLoading) { return <LayoutBase><p className="p-8 text-center text-xl">加载中...</p></LayoutBase>; }
  if (!post) { return <LayoutBase><p className="p-8 text-center text-xl text-red-500">帖子不存在或已被删除。</p></LayoutBase>; }

  const mainComments = comments.filter(comment => !comment.parentId);
  const postIsLiked = user && post.likes.includes(user.uid);
  const postIsDisliked = user && post.dislikes.includes(user.uid);
  const isFollowingPostAuthor = user && userData?.following?.includes(post.authorId);
  const isBookmarked = user && userData?.bookmarks?.includes(postId);
  const postContentToShow = translatedPostContent || post.content;

  return (
    <LayoutBase>
      <GeminiSettingsModal isOpen={isGeminiModalOpen} onClose={() => setIsGeminiModalOpen(false)} onSave={handleSaveGeminiSettings} currentKey={geminiApiKey} currentModel={geminiModel} />
      {showShareModal && <ShareModal url={window.location.href} onClose={() => setShowShareModal(false)} />}
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen py-8">
        <div className="container mx-auto p-4 max-w-4xl text-base sm:text-lg">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg relative mb-6">
            <h1 className="text-3xl sm:text-4xl font-extrabold mb-4 text-gray-900 dark:text-white leading-tight flex items-center">
              <span>{post.title}</span>
              <button onClick={() => handleTTS(post.title)} className="ml-4 text-gray-400 hover:text-blue-500 transition-colors"><i className="fas fa-volume-high"></i></button>
            </h1>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-3"><Link href={`/profile/${post.authorId}`} passHref><a className="flex items-center space-x-3 cursor-pointer"><img src={post.authorAvatar || 'https://www.gravatar.com/avatar?d=mp'} alt={post.authorName || '匿名用户'} className="w-14 h-14 rounded-full object-cover border-2 border-blue-400 flex-shrink-0"/><div><p className="font-bold text-xl text-gray-900 dark:text-white hover:underline">{post.authorName || '匿名用户'}</p><p className="text-sm text-gray-500 dark:text-gray-400">{new Date(post.createdAt?.toDate()).toLocaleDateString()}</p></div></a></Link></div>
              <div className="flex items-center space-x-3">{user && post.authorId !== user.uid && <button onClick={handleFollow} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${isFollowingPostAuthor ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>{isFollowingPostAuthor ? '已关注' : '关注'}</button>}
                <div className="relative"><button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><i className="fas fa-ellipsis text-2xl text-gray-500 dark:text-gray-300"></i></button>{showMenu && <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 py-1 text-base"><button onClick={() => handleMenuItemClick('gemini')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-brain mr-2 text-lg"></i>Gemini 设置</button>{user && user.uid === post.authorId && (<><button onClick={() => handleMenuItemClick('edit')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-pen-to-square mr-2 text-lg"></i>修改</button><button onClick={() => handleMenuItemClick('delete')} className="flex items-center w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-800 font-semibold"><i className="fas fa-trash mr-2 text-lg"></i>删除</button></>)}<button onClick={() => handleMenuItemClick('share')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-share-nodes mr-2 text-lg"></i>分享</button><button onClick={() => handleMenuItemClick('bookmark')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className={`${isBookmarked ? 'fas' : 'far'} fa-bookmark mr-2 text-lg`}></i>收藏</button><button onClick={() => handleMenuItemClick('report')} className="flex items-center w-full text-left px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 font-semibold"><i className="fas fa-flag mr-2 text-lg"></i>举报</button></div>}</div>
              </div>
            </div>
            <div className="prose dark:prose-invert max-w-none text-lg leading-relaxed mt-6">{post.content && <PostContent content={postContentToShow} />}
             {translatedPostContent && (<button onClick={() => handleTranslate(post.content, 'post', post.id, true)} className="text-gray-500 text-sm mt-2 hover:underline">查看原文</button>)}
            </div>
            <div className="flex items-center justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 space-x-6">
                <button onClick={() => handleTTS(postContentToShow)} className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"><i className="fas fa-volume-high text-2xl"></i></button>
                <button onClick={() => handleTranslate(post.content, 'post', post.id)} disabled={isTranslating} className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors disabled:opacity-50"><i className="fas fa-language text-2xl"></i></button>
                <button onClick={() => handlePostVote('like')} disabled={!user} className={`flex items-center space-x-1 transition-colors ${postIsLiked ? 'text-red-500' : 'text-gray-400 dark:text-gray-500 hover:text-red-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${postIsLiked ? 'fas' : 'far'} fa-heart text-2xl`}></i><span className="font-semibold">{post.likesCount || 0}</span></button>
                <button onClick={() => handlePostVote('dislike')} disabled={!user} className={`flex items-center space-x-1 transition-colors ${postIsDisliked ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500 hover:text-blue-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${postIsDisliked ? 'fas' : 'far'} fa-thumbs-down text-2xl`}></i></button>
                <button onClick={handleBookmark} disabled={!user} className={`transition-colors ${isBookmarked ? 'text-yellow-500' : 'text-gray-400 dark:text-gray-500 hover:text-yellow-400'} ${!user ? 'opacity-50' : ''}`}><i className={`${isBookmarked ? 'fas' : 'far'} fa-bookmark text-2xl`}></i></button>
                <button onClick={() => setShowShareModal(true)} className="text-gray-400 dark:text-gray-500 hover:text-blue-500 transition-colors"><i className="fas fa-share-nodes text-2xl"></i></button>
            </div>
          </div>
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">评论 ({post.commentsCount || 0})</h2><div className="flex items-center space-x-4 text-sm font-semibold"><button onClick={() => setSortOrder('最新')} className={sortOrder === '最新' ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}>最新</button><button onClick={() => setSortOrder('最热')} className={sortOrder === '最热' ? 'text-blue-500' : 'text-gray-500 hover:text-blue-500'}>最热</button></div></div>
            {user ? (<form onSubmit={handleAddComment} className="mb-8 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg"><div className="relative"><textarea ref={commentInputRef} value={newComment} onChange={(e) => setNewComment(e.target.valu
