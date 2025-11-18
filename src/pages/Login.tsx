import React, { useState } from "react";
import { Link } from "react-router-dom";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/ews_logo1.jpg";
import Adlogo from "../assets/ad.png";

export default function Login() {
  const { login } = useAuth();

  const [mode, setMode] = useState<"user" | "azure">("user");
  const [email, setEmail] = useState("demo@bank.com");
  const [password, setPassword] = useState("demo123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "user") {
        await login(email, password);
      } else {
        alert("Azure AD login coming soon");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen flex items-center justify-center px-4 bg-linear-to-b from-white to-slate-50 dark:from-[#162532] dark:to-[#014389]">
        <div className="w-full max-w-md p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0d243a]">

          {/* BRAND HEADER (LOGO + TEXT) */}
          <div className="flex flex-col items-center mb-4">
            {/* <img
              src="/assets/ews_logo1.jpg"
              alt="EWS Logo"
              className="w-20 h-20 object-contain rounded-md shadow-sm mb-2"
            /> */}
             <img src={logo} alt="logo" className="w-20 h-20 object-contain rounded-md shadow-sm mb-2" />
            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
              EWS Secure Portal
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Sign in to access enterprise services
            </p>
          </div>

          {/* TITLE */}
          <h1 className="text-center text-xl font-semibold text-blue-700 dark:text-blue-300">
            Login With
          </h1>

          {/* MODE SWITCHER */}
          <div className="mt-5 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl flex">
            <button
              onClick={() => setMode("user")}
              className={`
                flex-1 px-4 py-2 text-sm font-medium rounded-lg transition
                ${
                  mode === "user"
                    ? "bg-white dark:bg-[#04366b] text-blue-700 dark:text-blue-400 shadow"
                    : "text-slate-600 dark:text-slate-400"
                }
              `}
            >
              User ID Login
            </button>

            <button
              onClick={() => setMode("azure")}
              className={`
                flex-1 px-4 py-2 text-sm font-medium rounded-lg transition
                ${
                  mode === "azure"
                    ? "bg-white dark:bg-[#102c4a] text-blue-700 dark:text-blue-300 shadow"
                    : "text-slate-600 dark:text-slate-400"
                }
              `}
            >
              Azure AD Login
            </button>
          </div>

          {/* FORM CONTENT */}
          <form onSubmit={submit} className="mt-6 space-y-4">

            {/* USER LOGIN */}
            {mode === "user" && (
              <>
                <Input
                  label="Email / User ID"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@bank.com"
                />

                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </>
            )}

            {/* AZURE LOGIN */}
            {mode === "azure" && (
              <div className="text-center text-sm text-slate-600 dark:text-slate-300 p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/30">

                <div className="flex justify-center mb-3">
                  <img src={Adlogo} alt="logo" className="w-14 h-14 object-contain opacity-90" />
                </div>

                <p className="mb-3">
                  Azure AD login will redirect you to Microsoft’s secure login.
                </p>

                <Button type="button" fullWidth>
                  Continue with Azure AD
                </Button>
              </div>
            )}

            {error && <div className="text-sm text-red-600">{error}</div>}

            {/* Remember + Forgot */}
            {mode === "user" && (
              <div className="flex items-center justify-between text-sm mt-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-slate-400" />
                  <span className="text-slate-700 dark:text-slate-300">
                    Remember me
                  </span>
                </label>

                <Link
                  to="/forgot-password"
                  className="text-blue-700 dark:text-blue-300 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            )}

            {/* LOGIN BUTTON WITH LOADING SPINNER */}
            {mode === "user" && (
              <Button fullWidth type="submit" disabled={loading}>
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Signing in...
                  </div>
                ) : (
                  "Sign in"
                )}
              </Button>
            )}

            {/* SIGNUP */}
            <div className="text-center text-sm text-slate-600 dark:text-slate-400 mt-4">
              No account?{" "}
              <Link
                to="/signup"
                className="text-blue-700 dark:text-blue-300 font-medium hover:underline"
              >
                Request access
              </Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
