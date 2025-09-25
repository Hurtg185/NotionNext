// next.config.js (最终修复版 - 已修复 i18n 配置问题)

const { THEME } = require('./blog.config')
const fs = require('fs')
const path = require('path')
const BLOG = require('./blog.config')
const { extractLangPrefix } = require('./lib/utils/pageId')

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: BLOG.BUNDLE_ANALYZER
})

// ... (其他函数保持不变)
function scanSubdirectories(directory) { /* ... */ }
const preBuild = (function () { /* ... */ })()
const themes = scanSubdirectories(path.resolve(__dirname, 'themes'))


// 【核心修改】增加健壮性，确保 locales 始终是一个有效的数组
const locales = (() => {
  // 提供一个默认语言，以防 BLOG.LANG 未定义
  const defaultLang = BLOG.LANG || 'en';
  const langs = [defaultLang];
  
  if (BLOG.NOTION_PAGE_ID && BLOG.NOTION_PAGE_ID.indexOf(',') > 0) {
    const siteIds = BLOG.NOTION_PAGE_ID.split(',');
    for (const siteId of siteIds) {
      const prefix = extractLangPrefix(siteId);
      // 确保 prefix 是一个有效的字符串，并且不重复
      if (prefix && !langs.includes(prefix)) {
        langs.push(prefix);
      }
    }
  }
  // 过滤掉任何可能的 undefined 或 null 值
  return langs.filter(Boolean);
})();


/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // ... (其他配置保持不变)
  eslint: { ignoreDuringBuilds: true },
  output: process.env.EXPORT ? 'export' : process.env.NEXT_BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  staticPageGenerationTimeout: 120,
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  swcMinify: true,
  modularizeImports: {
    '@heroicons/react/24/outline': { transform: '@heroicons/react/24/outline/{{member}}' },
    '@heroicons/react/24/solid': { transform: '@heroicons/react/24/solid/{{member}}' }
  },
  
  // 【核心修改】确保 i18n 配置始终有效
  i18n: process.env.EXPORT ? undefined : {
    locales: locales.length > 0 ? locales : ['en'], // 如果计算后为空，则提供一个默认值
    defaultLocale: BLOG.LANG || 'en',
  },
  
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: [
      'gravatar.com', 'www.notion.so', 'avatars.githubusercontent.com',
      'images.unsplash.com', 'source.unsplash.com', 'p1.qhimg.com',
      'webmention.io', 'ko-fi.com', 'lh3.googleusercontent.com',
      'graph.facebook.com', 'i.ytimg.com',
      'cdn.843075.xyz' 
    ],
    loader: 'default',
    minimumCacheTTL: 60 * 60 * 24 * 7,
    dangerouslyAllowSVG: true,
  },
  
  redirects: process.env.EXPORT ? undefined : () => {
    return [{ source: '/feed', destination: '/rss/feed.xml', permanent: true }]
  },
  
  rewrites: process.env.EXPORT ? undefined : () => {
    const langsRewrites = []
    if (BLOG.NOTION_PAGE_ID.indexOf(',') > 0) {
      const siteIds = BLOG.NOTION_PAGE_ID.split(',')
      const langs = []
      for (let index = 0; index < siteIds.length; index++) {
        const siteId = siteIds[index]
        const prefix = extractLangPrefix(siteId)
        if (prefix) { langs.push(prefix) }
      }
      langsRewrites.push(
        { source: `/:locale(${langs.join('|')})/:path*`, destination: '/:path*' },
        { source: `/:locale(${langs.join('|')})`, destination: '/' },
        { source: `/:locale(${langs.join('|')})/`, destination: '/' }
      )
    }
    return [ ...langsRewrites, { source: '/:path*.html', destination: '/:path*' } ]
  },

  headers: process.env.EXPORT ? undefined : async () => {
    const ContentSecurityPolicy = `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' *.googletagmanager.com *.google-analytics.com *.youtube.com *.tiktok.com *.static-z.com *.facebook.net busuanzi.ibruce.info cdnjs.cloudflare.com;
      style-src 'self' 'unsafe-inline' *.googleapis.com cdnjs.cloudflare.com;
      img-src * blob: data:;
      media-src 'self' blob: https: *.googlevideo.com *.tiktok.com ${process.env.NEXT_PUBLIC_QINIU_DOMAIN || ''};
      font-src 'self' data: cdnjs.cloudflare.com;
      frame-src 'self' *.google.com *.youtube.com *.facebook.com *.tiktok.com chrome-sum-448615-f2.firebaseapp.com;
      connect-src 'self' *.google.com *.googleapis.com firestore.googleapis.com identitytoolkit.googleapis.com securetoken.googleapis.com wss://*.firebaseio.com *.qiniup.com *.tiktok.com *.facebook.com busuanzi.ibruce.info www.google-analytics.com;
    `.replace(/\s{2,}/g, ' ').trim();
    
    return [{ source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: ContentSecurityPolicy }] }];
  },
  
  webpack: (config, { dev, isServer }) => {
    config.resolve.alias['@'] = path.resolve(__dirname)
    const currentTheme = THEME || 'heo';
    if (!isServer) { console.log('[当前主题]', path.resolve(__dirname, 'themes', currentTheme)) }
    config.resolve.alias['@theme-components'] = path.resolve(__dirname, 'themes', currentTheme)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false, tls: false, fs: false, child_process: false,
        'react-native-sqlite-storage': false, dns: false
      };
    }
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendors', chunks: 'all' },
            common: { name: 'common', minChunks: 2, chunks: 'all', enforce: true },
          },
        },
      }
    }
    if (dev || process.env.NODE_ENV_API === 'development') { config.devtool = 'eval-source-map' }
    config.resolve.modules = [ path.resolve(__dirname, 'node_modules'), 'node_modules' ]
    return config
  },
  experimental: {
    scrollRestoration: true,
    optimizePackageImports: ['@heroicons/react', 'lodash']
  },
  exportPathMap: function (defaultPathMap, { dev, dir, outDir, distDir, buildId }) {
    const pages = { ...defaultPathMap };
    delete pages['/sitemap.xml'];
    delete pages['/auth'];
    return pages;
  },
  publicRuntimeConfig: {
    THEMES: themes
  }
}

module.exports = process.env.ANALYZE
  ? withBundleAnalyzer(nextConfig)
  : nextConfig;
