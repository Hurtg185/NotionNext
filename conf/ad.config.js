/**
 * 广告播放插件
 */
module.exports = {
  // 谷歌广告
  // 1. 填入你的发布商ID (从你的截图里看到的)
  ADSENSE_GOOGLE_ID: 'ca-pub-5979923534004539', 
  
  // 2. 建议设为 false。如果是 true，则只显示占位方块，不显示真实广告。
  ADSENSE_GOOGLE_TEST: false, 

  // 3. 下面这四个 SLOT ID 需要你去 Google AdSense 后台「按单元广告」创建后获取
  // 如果你还没创建，先空着或者用默认值，审核通过后再改
  
  // 对应：新建 -> 文章内嵌广告 (In-article ads)
  ADSENSE_GOOGLE_SLOT_IN_ARTICLE: '你的文章内嵌广告SLOT_ID', 
  
  // 对应：新建 -> 信息流广告 (In-feed ads)
  ADSENSE_GOOGLE_SLOT_FLOW: '你的信息流广告SLOT_ID', 
  
  // 对应：新建 -> 多重广告 (Multiplex ads) 原生广告单元
  ADSENSE_GOOGLE_SLOT_NATIVE: '你的原生广告SLOT_ID', 
  
  // 对应：新建 -> 展示广告 (Display ads) —— 这个最常用，建议给背单词组件用这个
  ADSENSE_GOOGLE_SLOT_AUTO: '你的展示广告SLOT_ID', 

  // 万维广告 (如果你不用这个，保持默认或 null 即可)
  AD_WWADS_ID: null,
  AD_WWADS_BLOCK_DETECT: false 
}
