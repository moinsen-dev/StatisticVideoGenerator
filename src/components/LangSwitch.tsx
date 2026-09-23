import { setLang, useLang } from '../lib/i18n.ts';

export function LangSwitch() {
  const lang = useLang();
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {(['en', 'de'] as const).map((l) => (
        <button key={l} type="button" className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
