import { LogIn, LogOut, Mail } from 'lucide-react';
import { useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';

export default function AuthPanel({ session }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const userEmail = session?.user?.email;

  const signIn = async (event) => {
    event.preventDefault();
    if (!supabase || !email || !password) return;

    setIsLoading(true);
    setStatus('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      setStatus(signUpError ? signUpError.message : '註冊完成。若 Supabase 要求驗證信箱，請先完成驗證。');
    } else {
      setStatus('已登入。');
    }

    setIsLoading(false);
  };

  const signOut = async () => {
    if (!supabase) return;
    setIsLoading(true);
    await supabase.auth.signOut();
    setStatus('已登出。');
    setIsLoading(false);
  };

  if (!isSupabaseConfigured) {
    return (
      <section className="auth-panel" aria-labelledby="auth-title">
        <div>
          <p className="eyebrow">Account</p>
          <h2 id="auth-title">Supabase 尚未設定</h2>
        </div>
        <p>請在 `.env` 設定 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_ANON_KEY` 後重新啟動 dev server。</p>
      </section>
    );
  }

  if (userEmail) {
    return (
      <section className="auth-panel" aria-labelledby="auth-title">
        <div>
          <p className="eyebrow">Account</p>
          <h2 id="auth-title">已登入</h2>
          <p>{userEmail}</p>
        </div>
        <button type="button" onClick={signOut} disabled={isLoading}>
          <LogOut size={16} />
          登出
        </button>
        {status ? <small>{status}</small> : null}
      </section>
    );
  }

  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <div>
        <p className="eyebrow">Account</p>
        <h2 id="auth-title">登入以追蹤進步</h2>
      </div>
      <form onSubmit={signIn}>
        <label>
          <Mail size={15} />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
          />
        </label>
        <label>
          <LogIn size={15} />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit" disabled={isLoading}>
          <LogIn size={16} />
          登入 / 註冊
        </button>
      </form>
      <p>只儲存分析後的詞語、詞頻、CEFR 與統計數據，不儲存原文。</p>
      {status ? <small>{status}</small> : null}
    </section>
  );
}
