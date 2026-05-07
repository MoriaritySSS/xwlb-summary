import React from 'react';
import { motion } from 'motion/react';
import { CalendarDays, ChevronRight, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { NewsSummary } from '../types';

interface NewsCardProps {
  news: NewsSummary;
  onClick: () => void;
}

export function NewsCard({ news, onClick }: NewsCardProps) {
  // Extract a plain text preview from markdown summary
  const getPreview = (text: string) => {
    if (!text) return '暂无摘要内容...';
    // Remove markdown headers
    let preview = text.replace(/#+\s+.*?(?:\n|$)/g, '');
    // Clean up bold/italic
    preview = preview.replace(/[*_]/g, '');
    return preview.trim();
  };

  const formattedDate = news.date 
    ? format(parseISO(news.date), 'yyyy年MM月dd日 EEEE', { locale: zhCN })
    : '未知日期';

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      className="group relative bg-white dark:bg-[#1A1A1C] rounded-2xl p-6 sm:p-8 border border-neutral-200 dark:border-neutral-800/80 shadow-sm hover:shadow-md hover:border-red-200 dark:hover:border-red-900/50 cursor-pointer text-left transition-all overflow-hidden"
      onClick={onClick}
    >
      {/* Decorative accent */}
      <div className="absolute top-0 left-0 w-1.5 h-full bg-neutral-100 dark:bg-neutral-800/50 group-hover:bg-red-700 dark:group-hover:bg-red-600 transition-colors" />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <div className="inline-flex items-center text-[13px] font-semibold tracking-wider text-red-700 dark:text-red-400 uppercase bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-md mb-3 transition-colors">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            联播摘要
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-red-800 dark:group-hover:text-red-400 transition-colors leading-snug">
            {formattedDate} · 精华速览
          </h2>
        </div>
        
        <div className="flex items-center text-sm font-medium text-neutral-500 dark:text-neutral-400 whitespace-nowrap bg-neutral-50 dark:bg-[#202022] px-3 py-1.5 rounded-lg border border-neutral-100 dark:border-neutral-800/80 shrink-0 transition-colors">
          <CalendarDays className="w-4 h-4 mr-2 opacity-70" />
          <time>{news.date}</time>
        </div>
      </div>
      
      <p className="text-neutral-600 dark:text-neutral-400 text-[15px] sm:text-[16px] leading-relaxed line-clamp-3 mb-6 text-justify transition-colors">
        {getPreview(news.summary)}
      </p>
      
      <div className="flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800/80 pt-5 mt-auto transition-colors">
        <div className="text-xs text-neutral-400 dark:text-neutral-500 font-medium tracking-wide">
          系统收录于 {news.created_at ? format(new Date(news.created_at.replace(' ', 'T')), 'MM-dd HH:mm') : '最近'}
        </div>
        <div className="flex items-center text-red-700 dark:text-red-500 text-sm font-semibold tracking-wide bg-white dark:bg-[#1A1A1C] px-2 group-hover:translate-x-1 transition-all">
          查看完整卷宗
          <ChevronRight className="w-4 h-4 ml-1" />
        </div>
      </div>
    </motion.div>
  );
}
