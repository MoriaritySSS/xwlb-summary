import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, BookOpenText, X, Sun, Moon } from 'lucide-react';
import { NewsCard } from './components/NewsCard';
import { DetailModal } from './components/DetailModal';
import { useTheme } from './hooks/useTheme';
import type { NewsSummary, NewsDetail } from './types';

const API_BASE = 'https://xwlb-summary.tonbi.workers.dev';

export default function App() {
  const [list, setList] = useState<NewsSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<NewsDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const { theme, toggleTheme } = useTheme();

  const loadList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/list?limit=30`);
      if (!res.ok) throw new Error('网络请求失败');
      const data = await res.json();
      setList(data);
    } catch (err: any) {
      setError('无法连接到服务器，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const search = async () => {
    const q = searchQuery.trim();
    if (!q) {
      loadList();
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('搜索失败');
      const data = await res.json();
      setList(data);
    } catch (err: any) {
      setError('搜索请求失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDetail = async (date: string) => {
    setSelectedDate(date);
    setIsDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/news?date=${encodeURIComponent(date)}`);
      if (!res.ok) throw new Error('无法加载详情');
      const data = await res.json();
      setDetail(data);
    } catch (err) {
      // Basic fallback
      setDetail(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      search();
    }
  };

  const closeDetail = () => {
    setSelectedDate(null);
    setTimeout(() => setDetail(null), 300); // clear after animation
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-neutral-900 dark:text-neutral-100 transition-colors duration-300">
      {/* Header - Editorial Style */}
      <header className="bg-white dark:bg-[#141415] border-b border-neutral-200 dark:border-neutral-800 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] dark:shadow-none sticky top-0 z-30 transition-colors">
        <div className="container mx-auto px-4 py-6 md:py-8 max-w-3xl flex flex-col items-center justify-center text-center relative">
          {/* Theme Toggle Button */}
          <div className="absolute right-4 top-4 md:right-0 md:top-6">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-full bg-neutral-100 dark:bg-[#202022] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-[#2A2A2D] transition-colors focus:outline-none"
              aria-label="Toggle Dark Mode"
            >
              {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-700 dark:bg-red-800/80 rounded-lg text-white shadow-sm transition-colors">
              <BookOpenText className="w-6 h-6" />
            </div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold tracking-wide text-neutral-900 dark:text-neutral-100 transition-colors">
              新闻联播精华
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-neutral-500 dark:text-neutral-400 tracking-wider transition-colors">
            <span className="w-8 h-[1px] bg-neutral-300 dark:bg-neutral-700"></span>
            <span>考公助手 · 每日速递</span>
            <span className="w-8 h-[1px] bg-neutral-300 dark:bg-neutral-700"></span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 md:py-10 text-neutral-800 dark:text-neutral-200">
        
        {/* Search & Action Bar */}
        <div className="bg-white dark:bg-[#1A1A1C] rounded-2xl p-2 shadow-sm dark:shadow-none border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row gap-2 mb-10 transition-all focus-within:shadow-md dark:focus-within:border-neutral-600 focus-within:border-red-200">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              className="w-full bg-transparent text-neutral-900 dark:text-neutral-100 rounded-xl pl-11 pr-4 py-3 sm:py-3.5 focus:outline-none placeholder-neutral-400 dark:placeholder-neutral-500 font-medium"
              placeholder="输入关键词，如：新质生产力、中国式现代化"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={search}
              className="px-6 py-3 sm:py-3.5 bg-neutral-900 dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-medium rounded-xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-neutral-400 active:scale-[0.98]"
            >
              检索
            </button>
            <button
              onClick={() => {
                setSearchQuery('');
                loadList();
              }}
              className="px-5 py-3 sm:py-3.5 bg-neutral-100 dark:bg-[#202022] hover:bg-neutral-200 dark:hover:bg-[#2A2A2D] text-neutral-700 dark:text-neutral-300 font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-700 active:scale-[0.98] whitespace-nowrap"
            >
              清空
            </button>
          </div>
        </div>

        {/* Results / List */}
        <div>
          {isLoading ? (
            <div className="py-24 flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-500">
              <Loader2 className="w-8 h-8 animate-spin text-red-700 dark:text-red-600 mb-4" />
              <p className="font-medium tracking-wide text-sm">正在加载数据卷宗...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/30 p-8 transition-colors">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">无法连接到档案库</h3>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">{error}</p>
              <button 
                onClick={loadList}
                className="inline-flex items-center justify-center px-6 py-2.5 bg-white dark:bg-[#1A1A1C] border border-neutral-300 dark:border-neutral-700 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-[#202022] hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors shadow-sm"
              >
                重新尝试
              </button>
            </div>
          ) : list.length === 0 ? (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-neutral-100 dark:bg-[#1A1A1C] text-neutral-300 dark:text-neutral-600 rounded-full flex items-center justify-center mx-auto mb-5 transition-colors">
                <BookOpenText className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-serif text-neutral-800 dark:text-neutral-200 mb-2 transition-colors">未找到匹配记录</h3>
              <p className="text-neutral-500 dark:text-neutral-400">
                {searchQuery ? '当前关键词没有检索到相关新闻，请缩短关键词再试' : '暂无最新数据被收录'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {list.map((item) => (
                <NewsCard
                  key={item.id}
                  news={item}
                  onClick={() => loadDetail(item.date)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-10 text-center bg-white dark:bg-[#141415] border-t border-neutral-200 dark:border-neutral-800 transition-colors">
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium tracking-wide">
          非官方应用 · 仅供考公辅助学习
        </p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
          数据来源于公开网络信息，通过 AI 提炼处理
        </p>
      </footer>

      {/* Detail Modal */}
      <DetailModal
        isOpen={!!selectedDate}
        onClose={closeDetail}
        isLoading={isDetailLoading}
        detail={detail}
      />
    </div>
  );
}
