import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import throttle from 'lodash.throttle'
import SmartLink from '@/components/SmartLink'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import CONFIG from '../config'
import ButtonRandomPost from './ButtonRandomPost'
import CategoryGroup from './CategoryGroup'
import Logo from './Logo'
import { MenuListTop } from './MenuListTop'
import SearchButton from './SearchButton'
import SearchDrawer from './SearchDrawer'
import SideBar from './SideBar'
import SideBarDrawer from './SideBarDrawer'
import TagGroups from './TagGroups'

const Header = props => {
  const searchDrawer = useRef()
  const { tags, currentTag, categories, currentCategory } = props
  const { locale } = useGlobal()
  const router = useRouter()

  const [isOpen, setIsOpen] = useState(false)
  const [isNavTransparent, setIsNavTransparent] = useState(true)
  const [isNavHidden, setIsNavHidden] = useState(false)

  const lastScrollRef = useRef(0)

  const showSearchButton = siteConfig('HEXO_MENU_SEARCH', false, CONFIG)
  const showRandomButton = siteConfig('HEXO_MENU_RANDOM', false, CONFIG)

  const hideAccountButton = props?.hideAccountButtonOnHome

  const toggleMenuOpen = () => setIsOpen(prev => !prev)
  const toggleSideBarClose = () => setIsOpen(false)

  const updateNavStyle = useCallback(() => {
    if (typeof window === 'undefined') return

    const scrollY = window.scrollY
    const heroHeader = document.querySelector('#header')
    const heroHeight = heroHeader?.clientHeight || 0

    const inHero = heroHeader && (scrollY < 10 || scrollY < heroHeight - 50)
    setIsNavTransparent(Boolean(inHero))

    const shouldShow =
      scrollY <= lastScrollRef.current || scrollY < 5 || (heroHeader && scrollY <= heroHeight + 100)

    setIsNavHidden(!shouldShow)
    lastScrollRef.current = scrollY
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onScroll = throttle(updateNavStyle, 120)
    window.addEventListener('scroll', onScroll, { passive: true })
    router.events.on('routeChangeComplete', onScroll)
    onScroll()

    return () => {
      router.events.off('routeChangeComplete', onScroll)
      window.removeEventListener('scroll', onScroll)
      onScroll.cancel?.()
    }
  }, [router.events, updateNavStyle])

  const searchDrawerSlot = useMemo(
    () => (
      <>
        {categories && (
          <section className='mt-8'>
            <div className='text-sm flex flex-nowrap justify-between font-light px-2'>
              <div className='text-gray-600 dark:text-gray-200'>
                <i className='mr-2 fas fa-th-list' />
                {locale.COMMON.CATEGORY}
              </div>
              <SmartLink
                href='/category'
                passHref
                className='mb-3 text-gray-400 hover:text-black dark:text-gray-400 dark:hover:text-white hover:underline cursor-pointer'
              >
                {locale.COMMON.MORE} <i className='fas fa-angle-double-right' />
              </SmartLink>
            </div>
            <CategoryGroup currentCategory={currentCategory} categories={categories} />
          </section>
        )}

        {tags && (
          <section className='mt-4'>
            <div className='text-sm py-2 px-2 flex flex-nowrap justify-between font-light dark:text-gray-200'>
              <div className='text-gray-600 dark:text-gray-200'>
                <i className='mr-2 fas fa-tag' />
                {locale.COMMON.TAGS}
              </div>
              <SmartLink
                href='/tag'
                passHref
                className='text-gray-400 hover:text-black dark:hover:text-white hover:underline cursor-pointer'
              >
                {locale.COMMON.MORE} <i className='fas fa-angle-double-right' />
              </SmartLink>
            </div>
            <div className='p-2'>
              <TagGroups tags={tags} currentTag={currentTag} />
            </div>
          </section>
        )}
      </>
    ),
    [categories, currentCategory, currentTag, locale, tags]
  )

  return (
    <div id='top-nav' className='z-40'>
      <SearchDrawer cRef={searchDrawer} slot={searchDrawerSlot} />

      <div
        id='sticky-nav'
        style={{ backdropFilter: 'blur(10px)' }}
        className={`fixed inset-x-0 z-20 transform transition-all duration-300 ${
          isNavHidden ? '-top-20' : 'top-0'
        } ${
          isNavTransparent
            ? 'bg-transparent text-white border-transparent shadow-none'
            : 'bg-white/88 text-slate-800 border-b border-slate-200 shadow-[0_6px_20px_rgba(15,23,42,0.08)] dark:bg-hexo-black-gray/88 dark:text-gray-100 dark:border-zinc-800'
        }`}
      >
        <div className='w-full flex justify-between items-center px-3 py-2'>
          <div className='flex'>
            <Logo {...props} />
          </div>

          <div className='mr-0.5 flex justify-end items-center gap-1'>
            <div className='hidden lg:flex'>
              <MenuListTop {...props} hideAccountButton={hideAccountButton} />
            </div>

            {showSearchButton && <SearchButton />}
            {showRandomButton && <ButtonRandomPost {...props} />}

            <button
              onClick={toggleMenuOpen}
              className='h-11 w-11 lg:hidden inline-flex items-center justify-center rounded-xl active:scale-95'
              aria-label='Open menu'
              type='button'
            >
              {isOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      <SideBarDrawer isOpen={isOpen} onClose={toggleSideBarClose}>
        <SideBar {...props} hideAccountButton={hideAccountButton} />
      </SideBarDrawer>
    </div>
  )
}

export default Header
