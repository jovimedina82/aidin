'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Mail, Shield, ArrowRight, Sparkles } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const devEnabled = process.env.NEXT_PUBLIC_DEV_LOGIN ?? process.env.DEV_LOGIN_ENABLED;

  async function handleDevLogin() {
    try {
      setBusy(true);
      const r = await fetch('/api/auth/dev-login', { method: 'POST' });
      if (!r.ok) throw new Error('dev login failed');
      window.location.href = '/dashboard';
    } catch (e) {
      // console.error(e);
      alert('Dev login failed');
    } finally {
      setBusy(false);
    }
  }

  async function handleAzure() {
    window.location.href = '/api/auth/azure/login';
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#3d6964] to-slate-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#3d6964] rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjAzIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Main card */}
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
            {/* Header with gradient */}
            <div className="relative bg-gradient-to-r from-[#3d6964]/80 to-emerald-600/60 p-8 pb-12">
              <div className="absolute inset-0 bg-black/20"></div>
              <div className="relative">
                {/* Logo */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                  className="flex items-center justify-center mb-6"
                >
                  <img
                    src="/images/logo-transparent.png"
                    alt="AIDIN Helpdesk"
                    className="h-32 drop-shadow-2xl"
                  />
                </motion.div>

                {/* Title */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-center"
                >
                  <h1 className="text-3xl font-bold text-white mb-2">
                    Welcome Back
                  </h1>
                  <p className="text-white/80 text-sm font-medium">
                    Surterre Properties Inc.
                  </p>
                </motion.div>
              </div>
            </div>

            {/* Form section */}
            <div className="p-8 pt-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-4"
              >
                {/* SSO Button */}
                <button
                  onClick={handleAzure}
                  className="group relative w-full bg-gradient-to-r from-[#3d6964] to-emerald-600 hover:from-[#2d5954] hover:to-emerald-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-center space-x-3">
                    <Building2 className="w-5 h-5" />
                    <span>Sign in with Surterre Email</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                  {/* Shine effect */}
                  <div className="absolute inset-0 rounded-xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  </div>
                </button>

                {/* Dev Login Button */}
                {devEnabled === 'true' && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    onClick={handleDevLogin}
                    disabled={busy}
                    className="w-full bg-white/5 hover:bg-white/10 border-2 border-white/20 hover:border-white/30 text-white font-medium py-3 px-6 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Sparkles className="w-4 h-4" />
                      <span>{busy ? 'Signing in…' : 'Dev Login (Bypass)'}</span>
                    </div>
                  </motion.button>
                )}

                {/* Features */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="pt-6 space-y-3"
                >
                  <div className="flex items-center space-x-3 text-white/70 text-sm">
                    <div className="bg-emerald-500/20 p-2 rounded-lg">
                      <Shield className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span>Secure Single Sign-On via Microsoft Entra ID</span>
                  </div>
                  <div className="flex items-center space-x-3 text-white/70 text-sm">
                    <div className="bg-blue-500/20 p-2 rounded-lg">
                      <Mail className="w-4 h-4 text-blue-400" />
                    </div>
                    <span>Access your support tickets & knowledge base</span>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-8 text-center"
          >
            <p className="text-white text-sm font-medium">
              Protected by enterprise-grade security
            </p>
            <p className="text-white/80 text-xs mt-1">
              © 2025 Surterre Properties. All rights reserved.
            </p>
          </motion.div>
        </motion.div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
