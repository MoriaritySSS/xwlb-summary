import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, BookOpen, Share2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { format, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { NewsDetail } from '../types';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  detail: NewsDetail | null;
}

export function DetailModal({ isOpen, onClose, isLoading, detail }: DetailModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Reset scroll position when opening a new detail
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const formattedDate = detail?.date 
    ? format(parseISO(detail.date), 'yyyy年MM月dd日 (EEEE)', { locale: zhCN })
    : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-neutral-900/60 dark:bg-black/80 backdrop-blur-sm z-40 transition-colors"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 sm:inset-x-auto sm:inset-y-6 sm:left-[50%] sm:-translate-x-[50%] z-50 w-full sm:w-[800px] sm:max-w-[calc(100vw-32px)] bg-[#FDFDFD] dark:bg-[#141415] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-neutral-200 dark:border-neutral-800 transition-colors"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 sm:px-8 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#141415] z-10 shrink-0 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center transition-colors">
                  <BookOpen className="w-4 h-4 text-red-700 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-[17px] font-bold text-neutral-900 dark:text-neutral-100 font-serif leading-tight transition-colors">
                    新闻联播文字版
                  </h2>
                  <p className="text-[13px] text-neutral-500 dark:text-neutral-400 font-medium transition-colors">
                    {formattedDate}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (navigator.share && detail) {
                      navigator.share({
                        title: `新闻联播摘要 (${detail.date})`,
                        text: `快来看${detail.date}的新闻联播摘要精华！`,
                        url: window.location.href,
                      });
                    }
                  }}
                  className="p-2 sm:p-2.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors focus:outline-none hidden sm:block"
                  title="分享"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 sm:p-2.5 text-neutral-500 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full transition-colors focus:outline-none"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content area */}
            <div 
              ref={contentRef}
              className="flex-1 overflow-y-auto px-6 py-8 sm:px-12 sm:py-10 overscroll-contain bg-[#FDFDFD] dark:bg-[#141415] transition-colors"
            >
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-neutral-400 dark:text-neutral-500">
                  <Loader2 className="w-10 h-10 animate-spin mb-5 text-red-700 dark:text-red-600" />
                  <p className="font-medium tracking-wide">正在解析卷宗内容...</p>
                </div>
              ) : detail ? (
                <article className="max-w-prose mx-auto">
                  <div className="text-center mb-10 pb-10 border-b border-neutral-200 dark:border-neutral-800 transition-colors">
                    <h1 className="text-3xl sm:text-4xl font-serif font-bold text-neutral-900 dark:text-neutral-100 mb-4 leading-normal transition-colors">
                      新闻联播精华速递
                    </h1>
                    <p className="text-neutral-500 dark:text-neutral-400 font-medium tracking-wide transition-colors">
                      {formattedDate}
                    </p>
                  </div>
                  <div className="markdown-body">
                    <Markdown>{detail.summary}</Markdown>
                  </div>
                  
                  <div className="mt-16 pt-8 border-t border-neutral-200 dark:border-neutral-800 text-center transition-colors">
                    <p className="text-sm font-medium text-neutral-400 dark:text-neutral-500">— 结束 —</p>
                  </div>
                </article>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-neutral-400 dark:text-neutral-500">
                  <p>未找到对应内容</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
