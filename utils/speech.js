// utils/speech.js

// 1. 简单的相似度算法 (0-100分)
const calculateScore = (target, input) => {
  if (!target || !input) return 0;
  const t = target.replace(/[^\u4e00-\u9fa5]/g, ''); // 只比对中文
  const i = input.replace(/[^\u4e00-\u9fa5]/g, '');
  if (t === i) return 100;
  if (!i) return 0;
  
  // 简易 Levenshtein
  const track = Array(i.length + 1).fill(null).map(() => Array(t.length + 1).fill(null));
  for (let x = 0; x <= i.length; x++) track[x][0] = x;
  for (let y = 0; y <= t.length; y++) track[0][y] = y;
  for (let x = 1; x <= i.length; x++) {
    for (let y = 1; y <= t.length; y++) {
      const indicator = i[x - 1] === t[y - 1] ? 0 : 1;
      track[x][y] = Math.min(
        track[x][y - 1] + 1,
        track[x - 1][y] + 1,
        track[x - 1][y - 1] + indicator
      );
    }
  }
  const distance = track[i.length][t.length];
  const score = Math.max(0, 100 - (distance / t.length) * 100);
  return Math.floor(score);
};

// 2. 浏览器语音识别
export const startSpeechRecognition = (lang = 'zh-CN') => {
  return new Promise((resolve, reject) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      reject("Browser not supported");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      resolve(transcript);
    };
    recognition.onerror = (e) => reject(e.error);
    recognition.start();
  });
};

// 3. 录音机 (用于回放)
export const createRecorder = () => {
  let mediaRecorder = null;
  let audioChunks = [];

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.start();
  };

  const stop = () => {
    return new Promise(resolve => {
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(audioBlob);
        resolve(audioUrl);
      };
      mediaRecorder.stop();
    });
  };

  return { start, stop };
};
