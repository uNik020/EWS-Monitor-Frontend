import React from "react";
import Navbar from "./Navbar";

const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#071b2c] transition-colors">
      <Navbar />

      <main className="flex-1 p-4 md:p-6 lg:p-8 bg-linear-to-b from-white to-slate-50 dark:from-[#081a2b] dark:to-[#0b2238] transition-colors">
        {children}
      </main>

      <footer className="text-center py-4 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700">
        Demo EWS • Internal Banking Demo — {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default PageWrapper;
