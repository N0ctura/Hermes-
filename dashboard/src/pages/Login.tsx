import React, { useState } from "react";
import { ArrowRight, CircleCheck, Command, Lock, ShieldAlert } from "lucide-react";

interface LoginProps {
  needPassword: boolean;
  onLogin: (password: string) => Promise<boolean>;
}

const Login: React.FC<LoginProps> = ({ needPassword, onLogin }) => {
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const ok = await onLogin(pwd);
      if (!ok) setErr("Password errata. Riprova.");
    } catch (error: any) {
      setErr(error?.message || "Errore di rete");
    } finally {
      setLoading(false);
    }
  };

  const background = <><div className="hermes-login-noise" aria-hidden="true" /><div className="hermes-login-orbit hermes-login-orbit-a" aria-hidden="true" /><div className="hermes-login-orbit hermes-login-orbit-b" aria-hidden="true" /><div className="hermes-login-grid" aria-hidden="true" /></>;
  const brand = <div className="hermes-login-brand"><div className="hermes-login-logo-wrap"><img src="/assets/logo.png" alt="Hermes" className="hermes-login-logo" /></div><div><div className="hermes-login-kicker">CELESTIAL ELYSIUM</div><h1>Hermes</h1><p>Control center della community</p></div></div>;
  const footer = (protectedAccess: boolean) => <div className="hermes-login-foot"><CircleCheck className="w-3 h-3" /><span>{protectedAccess ? "Accesso protetto" : "Accesso locale"}</span><span>•</span><span>Hermes Dashboard</span></div>;

  if (!needPassword) return <div className="hermes-login">{background}<div className="hermes-login-card animate-fade-in">{brand}<div className="hermes-login-divider" /><div className="hermes-login-welcome"><div className="hermes-login-welcome-icon"><Command className="w-4 h-4" /></div><div><span className="hermes-login-section-label">ACCESSO DISPONIBILE</span><h2>Benvenuto nel centro di comando.</h2></div></div><p className="hermes-login-copy">La dashboard è configurata per l'accesso locale senza autenticazione. Per proteggere l'accesso imposta <code>DASHBOARD_PASSWORD</code> nel file <code>.env</code>.</p><button onClick={() => onLogin("")} className="hermes-login-button"><span>Accedi alla Dashboard</span><ArrowRight className="w-4 h-4" /></button>{footer(false)}</div></div>;

  return <div className="hermes-login">{background}<form onSubmit={handleSubmit} className="hermes-login-card animate-fade-in">{brand}<div className="hermes-login-divider" /><div className="hermes-login-welcome"><div className="hermes-login-welcome-icon"><Lock className="w-4 h-4" /></div><div><span className="hermes-login-section-label">AREA RISERVATA</span><h2>Autenticazione richiesta.</h2></div></div><div className="hermes-login-field"><label htmlFor="hermes-password" className="hermes-login-label">Password dashboard</label><div className="hermes-login-input-wrap"><Lock className="w-4 h-4" aria-hidden="true" /><input id="hermes-password" type="password" autoFocus value={pwd} onChange={(event) => setPwd(event.target.value)} placeholder="Inserisci password..." autoComplete="current-password" aria-invalid={Boolean(err)} aria-describedby={err ? "hermes-login-error" : undefined} /></div></div>{err && <div id="hermes-login-error" className="hermes-login-error" role="alert"><ShieldAlert className="w-4 h-4 shrink-0" /><span>{err}</span></div>}<button type="submit" disabled={loading} className="hermes-login-button">{loading ? <><span className="hermes-login-spinner" /><span>Verifica in corso...</span></> : <><span>Entra nel Control Center</span><ArrowRight className="w-4 h-4" /></>}</button>{footer(true)}</form></div>;
};

export default Login;
