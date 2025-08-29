// /components/AiCorrector.js - 使用用户自己的 Google Gemini API Key
import React, { useState, useEffect } from 'react';

// 一个简单的 Markdown 解析器，用于显示 AI 返回的格式化文本
const SimpleMarkdown = ({ text }) => {
    if (!text) return null;
    const lines = text.split('\n').map((line, index) => {
      // 匹配 **加粗**
      if (line.startsWith('**') && line.endsWith('**')) {
        return <strong key={index} className="block my-2 text-lg">{line.replace(/\*\*/g, '')}</strong>;
      }
      // 匹配 * 列表项
      if (line.startsWith('* ')) {
        return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>;
      }
      // 匹配 - 列表项
       if (line.startsWith('- ')) {
        return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>;
      }
      // 匹配普通段落
      return <p key={index} className="my-1">{line}</p>;
    });
    return <div>{lines}</div>;
};


const AiCorrector = () => {
  const [userInput, setUserInput] = useState('');
  const [correction, setCorrection] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  
  // 在组件加载时，尝试从 localStorage 读取 API Key
  useEffect(() => {
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }
  }, []);

  // 当 API Key 变化时，将其保存到 localStorage
  const handleApiKeyChange = (e) => {
    const newApiKey = e.target.value;
    setApiKey(newApiKey);
    localStorage.setItem('gemini_api_key', newApiKey);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;
    if (!apiKey.trim()) {
      setError('请输入您的 Google Gemini API 密钥！');
      return;
    }

    setIsLoading(true);
    setError('');
    setCorrection('');

    const systemPrompt = `你是一位专业的、耐心的中文老师，你的学生是缅甸人。你的任务是纠正他们写的中文句子。
    请遵循以下规则：
    1.  首先，用中文写出“**纠正后的句子：**”。
    2.  然后，另起一行，用中文和缅甸语双语，简单清晰地解释错误的原因。缅甸语翻译用括号括起来。例如：“**错误分析：** 在中文里，表示地点的词（比如“在食堂”）通常要放在动词（比如“吃饭”）的前面。(မြန်မာဘာသာဖြင့်၊ နေရာပြစကားလုံးများ (ဥပမာ "食堂မှာ") သည် ကြိယာ ("စားသည်") ၏ ရှေ့တွင် လာလေ့ရှိသည်။)”
    3.  最后，另起一行，提供 1-2 个使用正确语法的额外例句，并用列表符号“-”开头。例如：“**更多例句：**\n- 我在学校学习中文。\n- 他在公园跑步。”
    4.  你的回答要简洁、友好、鼓励学生。`;

    const fullPrompt = `${systemPrompt}\n\n请纠正以下句子：\n"${userInput}"`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Google Gemini API Error:', errorData);
        throw new Error(errorData.error?.message || '请求失败，请检查您的 API 密钥或网络连接。');
      }

      const data = await response.json();
      const aiResponse = data.candidates[0]?.content.parts[0]?.text;
      if (!aiResponse) {
          throw new Error('AI 未能返回有效内容。');
      }
      
      setCorrection(aiResponse);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-8 p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700">
      <h2 className="text-3xl font-bold mb-2 text-center text-gray-800 dark:text-white">AI 中文语法助手</h2>
      <p className="text-center text-gray-500 dark:text-gray-400 mb-6">输入一个中文句子，AI 老师帮你纠正！</p>

      {/* API Key 输入框 */}
      <div className="mb-4">
        <label htmlFor="api-key-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          你的 Google Gemini API 密钥
        </label>
        <input
          id="api-key-input"
          type="password"
          value={apiKey}
          onChange={handleApiKeyChange}
          placeholder="在此粘贴你的 API 密钥"
          className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          密钥将保存在你的浏览器中，不会上传。
          <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
            获取免费密钥
          </a>
        </p>
      </div>

      {/* 输入表单 */}
      <form onSubmit={handleSubmit}>
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="例如：我吃饭了在食堂"
          className="w-full h-24 px-4 py-3 text-lg text-gray-700 bg-gray-100 dark:bg-gray-700 dark:text-gray-200 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors resize-none"
          disabled={isLoading}
        />
        <button
          type="submit"
          className="w-full mt-4 px-6 py-3 bg-primary text-white font-bold text-xl rounded-lg shadow-md hover:bg-blue-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || !userInput.trim()}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-4 border-solid border-white border-t-transparent mr-2"></div>
              正在思考...
            </div>
          ) : '纠正语法'}
        </button>
      </form>

      {/* 结果显示区域 */}
      {error && <div className="mt-6 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg">{error}</div>}
      
      {correction && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg prose dark:prose-invert max-w-none text-left">
          <SimpleMarkdown text={correction} />
        </div>
      )}
    </div>
  );
};

export default AiCorrector;
