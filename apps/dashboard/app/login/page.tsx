'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center px-6 py-12 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-lavender-bg rounded-full blur-3xl"></div>
      
      <div className="w-full max-w-sm mx-auto relative z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-accent-gradient rounded-full mx-auto flex items-center justify-center text-white mb-6 shadow-[0_12px_24px_rgba(56,74,216,0.25)] relative">
            <Sparkles className="w-8 h-8" />
            <div className="absolute top-0 right-0 w-4 h-4 bg-white/20 rounded-full blur-sm"></div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-on-surface mb-2">Halo, Saya Karen</h1>
          <p className="text-secondary text-sm">Masuk untuk melihat asisten pribadi Anda.</p>
        </div>
        
        {error && (
          <div className="bg-error-container text-on-error-container p-4 rounded-[16px] mb-6 text-sm font-medium flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-error"></div>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-on-surface mb-2" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="w-full bg-surface-bright border-2 border-surface-variant rounded-[16px] px-4 py-3.5 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-on-surface mb-2" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="w-full bg-surface-bright border-2 border-surface-variant rounded-[16px] px-4 py-3.5 text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-accent-gradient text-white font-bold rounded-full py-4 mt-8 flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(56,74,216,0.25)] hover:shadow-[0_12px_32px_rgba(56,74,216,0.35)] transition-all active:scale-[0.98]"
            disabled={loading}
          >
            {loading ? 'Masuk...' : (
              <>Lanjutkan <ArrowRight className="w-5 h-5" /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
