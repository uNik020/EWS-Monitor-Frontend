import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Bars3Icon, XMarkIcon, BellIcon, MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import API from "../../utils/axios";

const NavLink: React.FC<{ to: string; label: string }> = ({ to, label }) => {
  const loc = useLocation();
  const active = loc.pathname === to;

  return (
    <Link
      to={to}
      className={`block px-4 py-2 rounded-lg text-sm font-medium transition-all
        ${
          active
            ? "bg-blue-600/15 text-blue-700 dark:text-blue-300 dark:bg-blue-500/20"
            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        }
      `}
    >
      {label}
    </Link>
  );
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  const [dark, setDark] = useState(() => {
    return localStorage.getItem("theme") === "dark";
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);


  useEffect(() => {
    const loadNotifs = async () => {
      try {
        const res = await API.get("/notifications");
        const unread = res.data.filter((n: any) => !n.read).length;
        setNotifCount(unread);
      } catch (err) {
        console.error("Notification fetch failed", err);
      }
    };
    loadNotifs();
  }, []);

  return (
    <header className="bg-white dark:bg-[#081a2b] border-b border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* TOP BAR */}
        <div className="flex items-center justify-between h-16">

          {/* LOGO */}
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-700 dark:bg-blue-500 flex items-center justify-center text-white font-bold text-lg shadow">
              E
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">EWS Monitor</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 -mt-1">Credit Early Warning</div>
            </div>
          </Link>

          {/* DESKTOP NAV */}
          <div className="hidden md:flex items-center gap-6">

            {/* MENU LINKS */}
            <nav className="flex items-center gap-3">
              <NavLink to="/" label="Dashboard" />
              <NavLink to="/upload/framework" label="Rules Definition" />
              <NavLink to="/upload/events" label="Events Verified" />
              <NavLink to="/alerts" label="Alerts" />
            </nav>

            {/* NOTIFICATIONS */}
            <Link to="/notifications" className="relative">
              <BellIcon className="w-6 h-6 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition" />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {notifCount}
                </span>
              )}
            </Link>

            {/* DARK MODE BUTTON */}
            <button
              onClick={() => setDark(!dark)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {dark ? <SunIcon className="w-5 h-5 text-yellow-300" /> : <MoonIcon className="w-5 h-5 text-slate-700" />}
            </button>

            {/* USER INFO */}
            <div className="flex items-center gap-4">
              <div className="text-sm dark:text-slate-200">
                <div className="font-medium">{user?.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 -mt-1">{user?.role}</div>
              </div>
              <button
                onClick={() => logout()}
                className="text-sm text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30"
              >
                Logout
              </button>
            </div>
          </div>

          {/* MOBILE MENU BUTTON */}
          <button className="md:hidden p-2 rounded-md" onClick={() => setOpen(!open)}>
            {open ? <XMarkIcon className="w-6 h-6"/> : <Bars3Icon className="w-6 h-6"/>}
          </button>
        </div>

        {/* MOBILE MENU */}
        {open && (
          <div className="md:hidden py-3 space-y-1">

            <NavLink to="/" label="Dashboard" />
            <NavLink to="/upload/framework" label="Rules Definition" />
            <NavLink to="/upload/events" label="Events Verified" />
            <NavLink to="/alerts" label="Alerts" />

            {/* MOBILE NOTIFS */}
            <Link
              to="/notifications"
              className="flex justify-between px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              Notifications
              {notifCount > 0 && (
                <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">{notifCount}</span>
              )}
            </Link>

            {/* DARK MODE TOGGLE */}
            <button
              onClick={() => setDark(!dark)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              {dark ? <SunIcon className="w-5 h-5 text-yellow-300" /> : <MoonIcon className="w-5 h-5"/>}
              <span className="text-sm">Toggle Theme</span>
            </button>

            <button
              onClick={() => logout()}
              className="mt-2 text-left px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700"
            >
              Logout
            </button>

          </div>
        )}
      </div>
    </header>
  );
}
