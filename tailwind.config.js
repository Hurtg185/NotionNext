// tailwind.config.js

const BLOG = require('./blog.config')
const { fontFamilies } = require('./lib/font')

module.exports = {
  content: [
    './pages/**/*.js',
    './components/**/*.js',
    './layouts/**/*.js',
    './themes/**/*.js'
  ],
  darkMode: BLOG.APPEARANCE === 'class' ? 'media' : 'class', // or 'media' or 'class'
  theme: {
    fontFamily: fontFamilies,
    screens: {
      sm: '540px',
      md: '720px',
      lg: '960px',
      xl: '1140px',
      '2xl': '1536px'
    },
    container: {
      center: true,
      padding: '16px'
    },
    extend: {
      colors: {
        day: {
          DEFAULT: BLOG.BACKGROUND_LIGHT || '#ffffff'
        },
        night: {
          DEFAULT: BLOG.BACKGROUND_DARK || '#111827'
        },
        hexo: {
          'background-gray': '#f5f5f5',
          'black-gray': '#101414',
          'light-gray': '#e5e5e5'
        },
        'dark-700': '#090e34b3',
        dark: {
          DEFAULT: '#111928',
          2: '#1F2A37',
          3: '#374151',
          4: '#4B5563',
          5: '#6B7280',
          6: '#9CA3AF',
          7: '#D1D5DB',
          8: '#E5E7EB'
        },
        primary: '#3758F9',
        'blue-dark': '#1B44C8',
        secondary: '#13C296',
        'body-color': '#637381',
        'body-secondary': '#8899A8',
        warning: '#FBBF24',
        stroke: '#DFE4EA',
        'gray-1': '#F9FAFB',
        'gray-2': '#F3F4F6',
        'gray-7': '#CED4DA'
      },
      maxWidth: {
        side: '14rem',
        '9/10': '90%',
        'screen-3xl': '1440px',
        'screen-4xl': '1560px'
      },
      boxShadow: {
        input: '0px 7px 20px rgba(0, 0, 0, 0.03)',
        form: '0px 1px 55px -11px rgba(0, 0, 0, 0.01)',
        pricing: '0px 0px 40px 0px rgba(0, 0, 0, 0.08)',
        'switch-1': '0px 0px 5px rgba(0, 0, 0, 0.15)',
        testimonial: '0px 10px 20px 0px rgba(92, 115, 160, 0.07)',
        'testimonial-btn': '0px 8px 15px 0px rgba(72, 72, 138, 0.08)',
        1: '0px 1px 3px 0px rgba(166, 175, 195, 0.40)',
        2: '0px 5px 12px 0px rgba(0, 0, 0, 0.10)'
      },
      // --- 新增的动画配置 ---
      keyframes: {
        'kenburns-top': {
          '0%': {
            transform: 'scale(1) translateY(0)',
            'transform-origin': '50% 16%'
          },
          '100%': {
            transform: 'scale(1.25) translateY(-15px)',
            'transform-origin': 'top'
          }
        },
        'modal-pop-in': { // 这个是给弹窗用的，可以先留着
          '0%': {
            transform: 'scale(0.9)',
            opacity: '0'
          },
          '100%': {
            transform: 'scale(1)',
            opacity: '1'
          }
        }
      },
      animation: {
        'ken-burns': 'kenburns-top 7s ease-out both',
        'modal-pop': 'modal-pop-in 0.3s ease-out both'
      }
    }
  },
  variants: {
    extend: {}
  },
  plugins: []
}
