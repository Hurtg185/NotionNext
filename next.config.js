// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development'
})

module.exports = withPWA({
  // 在这里保留你 NotionNext 项目原有的所有 next.config.js 配置
  // 如果你的原始文件是空的，就保持这样即可
  // 例如，如果原来有 images 配置，就保留它：
  // images: {
  //   domains: ['gravatar.com', 'www.notion.so', 's3.us-west-2.amazonaws.com']
  // },
  webpack: (config, { isServer }) => {
    // 你的 webpack 配置（如果有的话）
    return config
  }
})
