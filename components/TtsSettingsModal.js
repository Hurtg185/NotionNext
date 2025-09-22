// /components/TtsSettingsModal.js
import { useState, useEffect } from 'react';

// 可用的第三方语音选项
const thirdPartyVoices = [
  { name: '晓晓 (多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' },
  { name: '晓辰 (多语言)', value: 'zh-CN-XiaochenMultilingualNeural' },
  { name: '云希 (标准)', value: 'zh-CN-YunxiNeural' },
  { name: '云扬 (新闻)', value: 'zh-CN-YunyangNeural' },
  { name: '晓伊 (情感)', value: 'zh-CN-XiaoyiNeural' },
];

const TtsSettingsModal = ({ currentSettings, onSave, onClose }) => {
  const [settings, setSettings] = useState(currentSettings);

  useEffect(() => {
    // 当外部传入的设置变化时，同步内部状态
    setSettings(currentSettings);
  }, [currentSettings]);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };
  
  const handleSliderChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: parseInt(value, 10) }));
  };

  const handleVoiceChange = (e) => {
    const { value } = e.target;
    setSettings(prev => ({ ...prev, thirdPartyTtsVoice: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold mb-6 text-center text-gray-900 dark:text-white">朗读设置</h3>
        
        <div className="space-y-6">
          {/* 发音人设置 */}
          <div>
            <label htmlFor="thirdPartyTtsVoice" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">发音人</label>
            <select
              id="thirdPartyTtsVoice"
              name="thirdPartyTtsVoice"
              value={settings.thirdPartyTtsVoice}
              onChange={handleVoiceChange}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            >
              {thirdPartyVoices.map(voice => (
                <option key={voice.value} value={voice.value}>{voice.name}</option>
              ))}
            </select>
          </div>

          {/* 语速设置 */}
          <div>
            <label htmlFor="ttsRate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              语速 <span className="text-blue-500 font-semibold">{settings.ttsRate}%</span>
            </label>
            <input
              type="range"
              id="ttsRate"
              name="ttsRate"
              min="-100"
              max="100"
              step="10"
              value={settings.ttsRate}
              onChange={handleSliderChange}
              className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* 音调设置 */}
          <div>
            <label htmlFor="ttsPitch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              音调 <span className="text-blue-500 font-semibold">{settings.ttsPitch}%</span>
            </label>
            <input
              type="range"
              id="ttsPitch"
              name="ttsPitch"
              min="-100"
              max="100"
              step="10"
              value={settings.ttsPitch}
              onChange={handleSliderChange}
              className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-4">
          <button onClick={onClose} className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300 dark:text-gray-200 dark:bg-gray-600 dark:hover:bg-gray-500 font-semibold">取消</button>
          <button onClick={handleSave} className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 font-semibold">保存</button>
        </div>
      </div>
    </div>
  );
};

export default TtsSettingsModal;
