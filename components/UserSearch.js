// components/UserSearch.js
import { useState, useCallback } from 'react';
import { searchUsersByNickname } from '@/lib/user';
import Link from 'next/link';
import debounce from 'lodash.debounce';

const UserSearch = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);

  // 使用 debounce 防止用户每输入一个字符就触发一次数据库查询
  const debouncedSearch = useCallback(
    debounce(async (term) => {
      if (term.length > 1) {
        setIsLoading(true);
        setNoResults(false);
        const users = await searchUsersByNickname(term);
        setResults(users);
        if (users.length === 0) {
          setNoResults(true);
        }
        setIsLoading(false);
      } else {
        setResults([]);
        setNoResults(false);
      }
    }, 500), // 500ms 延迟
    []
  );

  const handleChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    debouncedSearch(term);
  };

  return (
    <div className="relative w-full max-w-xs">
      <input
        type="text"
        value={searchTerm}
        onChange={handleChange}
        placeholder="按昵称搜索用户..."
        className="w-full px-4 py-2 text-gray-800 bg-white border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {/* 搜索结果下拉框 */}
      {(results.length > 0 || isLoading || noResults) && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden z-20">
          <ul>
            {isLoading && <li className="px-4 py-3 text-gray-500">正在搜索...</li>}
            {noResults && <li className="px-4 py-3 text-gray-500">未找到相关用户。</li>}
            {results.map(user => (
              <li key={user.id} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                <Link href={`/profile/${user.id}`} passHref>
                  <a className="flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    <img
                      src={user.photoURL || 'https://www.gravatar.com/avatar?d=mp'}
                      alt={user.displayName}
                      className="w-10 h-10 rounded-full object-cover mr-3"
                    />
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{user.displayName}</span>
                  </a>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default UserSearch;
