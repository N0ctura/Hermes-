import React, { useState } from "react";
import { Lock, Sparkles, ShieldAlert } from "lucide-react";

interface LoginProps {
  needPassword: boolean;
  onLogin: (password: string) => Promise<boolean>;
}

const Login: React.FC<LoginProps> = ({ needPassword, onLogin }) => {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const ok = await onLogin(pwd);
      if (!ok) setErr("Password errata. Riprova.");
    } catch (e: any) {
      setErr(e?.message || "Errore di rete");
    } finally {
      setLoading(false);
    }
  };

  if (!needPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#120D09]">
        <div className="w-full max-w-md bg-[#211A12] border border-neutral-800 rounded-2xl p-8 shadow-2xl animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="font-black text-white text-xl">Hermes v1</h1>
              <p className="text-xs text-neutral-400">Nessuna password impostata</p>
            </div>
          </div>
          <p className="text-sm text-neutral-300 leading-relaxed mb-6">
            La dashboard è accessibile localmente senza autenticazione. Per proteggerla imposta
            <code className="mx-1 px-2 py-0.5 bg-black/40 rounded text-emerald-300 text-xs font-mono">DASHBOARD_PASSWORD</code>
            nel file <code className="px-2 py-0.5 bg-black/40 rounded text-emerald-300 text-xs font-mono">.env</code>.
          </p>
          <button
            onClick={() => onLogin("")}
            className="w-full py-3 bg-[#C9A227] hover:bg-[#8A6B1D] text-white font-semibold rounded-lg transition-colors border border-[#C9A227]/20"
          >
            Accedi alla Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#120D09]">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-[#211A12] border border-neutral-800 rounded-2xl p-8 shadow-2xl animate-fade-in"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
            <Lock className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="font-black text-white text-xl">Hermes v1 — Accesso</h1>
            <p className="text-xs text-neutral-400">Inserisci la password della dashboard</p>
          </div>
        </div>

        <label className="text-[11px] font-bold uppercase tracking-wide text-neutral-500 block mb-2">
          Password
        </label>
        <input
          type="password"
          autoFocus
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Inserisci password..."
          className="w-full bg-neutral-900 border border-neutral-800 px-4 py-3 rounded-lg text-sm text-neutral-100 focus:outline-none focus:border-indigo-500 mb-3"
        />

        {err && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" /> {err}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#C9A227] hover:bg-[#8A6B1D] disabled:bg-[#C9A227]/40 text-white font-semibold rounded-lg transition-colors border border-[#C9A227]/20 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Controllo...
            </>
          ) : (
            "Accedi"
          )}
        </button>
      </form>
    </div>
  );
};

export default Login;
