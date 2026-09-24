import { useEffect, useState } from 'react';
import { Brand } from '../components/Brand.tsx';
import { GalleryList } from '../components/GalleryList.tsx';
import { LangSwitch } from '../components/LangSwitch.tsx';
import { listExamples, type Example } from '../lib/examples.ts';
import { useLang, useT, type MessageKey } from '../lib/i18n.ts';
import { moinsenUrl, REPO_URL } from '../lib/links.ts';
import { BYOK_PROVIDERS, PROVIDERS, usdRange } from '../lib/providers.ts';
import { RaceDemo } from './RaceDemo.tsx';
import './landing.css';

// Landing page at /: explains and motivates StatRace, shows the engine live, and introduces
// moinsen, the studio behind it. The studio itself lives at /app.

const STEPS: [MessageKey, MessageKey][] = [
  ['lStep1Title', 'lStep1Text'],
  ['lStep2Title', 'lStep2Text'],
  ['lStep3Title', 'lStep3Text'],
  ['lStep4Title', 'lStep4Text'],
];
const WHY: [string, MessageKey, MessageKey][] = [
  ['🔎', 'lWhy1Title', 'lWhy1Text'],
  ['🏁', 'lWhy2Title', 'lWhy2Text'],
  ['🔐', 'lWhy3Title', 'lWhy3Text'],
  ['🧩', 'lWhy4Title', 'lWhy4Text'],
];
const FACTS: MessageKey[] = ['lFact1', 'lFact2', 'lFact3', 'lFact4'];
const FAQ: [MessageKey, MessageKey][] = [
  ['lFaq1Q', 'lFaq1A'],
  ['lFaq7Q', 'lFaq7A'],
  ['lFaq2Q', 'lFaq2A'],
  ['lFaq3Q', 'lFaq3A'],
  ['lFaq4Q', 'lFaq4A'],
  ['lFaq5Q', 'lFaq5A'],
  ['lFaq6Q', 'lFaq6A'],
];

export function Landing() {
  const t = useT();
  const lang = useLang();
  const [examples, setExamples] = useState<Example[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    void listExamples().then(setExamples);
  }, []);

  const active = examples.find((ex) => ex.file === picked) ?? examples.find((ex) => ex.language === lang) ?? examples[0];

  return (
    <div className="landing">
      <header className="l-nav">
        <div className="l-wrap l-nav-inner">
          <Brand />
          <nav className="l-links" aria-label="StatRace">
            <a href="#how">{t('lNavHow')}</a>
            <a href="#examples">{t('examples')}</a>
            <a href="#faq">{t('lNavFaq')}</a>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
          <span className="spacer" />
          <LangSwitch />
          <a className="primary as-button small" href="/app">
            {t('lOpenStudio')}
          </a>
        </div>
      </header>

      <main>
        <section className="l-wrap l-hero">
          <p className="eyebrow">{t('lEyebrow')}</p>
          <h1>{t('lHeroTitle')}</h1>
          <p className="lead">{t('lHeroLead')}</p>
          <div className="l-ctas">
            <a className="primary as-button" href="/app">
              {t('lCtaStart')}
            </a>
            <a className="ghost as-button" href="#how">
              {t('lCtaHow')}
            </a>
          </div>
          <p className="hint">{t('lCtaNote')}</p>
        </section>

        <section className="l-wrap l-demo" aria-label={t('lDemoBadge')}>
          {active && <RaceDemo example={active} />}
          <div className="l-demo-bar">
            <div className="chips" role="radiogroup" aria-label={t('lDemoPick')}>
              {examples.map((ex) => (
                <button
                  type="button"
                  key={ex.file}
                  role="radio"
                  aria-checked={ex === active}
                  className={`chip ${ex === active ? 'on' : ''}`}
                  onClick={() => setPicked(ex.file)}
                >
                  {ex.icons[0]} {ex.title}
                </button>
              ))}
            </div>
            {active && (
              <a className="l-open" href={`/app#ex=${active.file}`}>
                {t('lDemoOpen')} →
              </a>
            )}
          </div>
        </section>

        <ul className="l-wrap l-facts">
          {FACTS.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>

        <section id="how" className="l-wrap l-section">
          <h2>{t('lHowTitle')}</h2>
          <ol className="l-steps">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="l-num">{String(i + 1).padStart(2, '0')}</span>
                <h3>{t(title)}</h3>
                <p>{t(text)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="l-wrap l-section">
          <h2>{t('lWhyTitle')}</h2>
          <p className="lead">{t('lWhyLead')}</p>
          <ul className="l-cards">
            {WHY.map(([icon, title, text]) => (
              <li key={title}>
                <span className="l-icon" aria-hidden>
                  {icon}
                </span>
                <h3>{t(title)}</h3>
                <p>{t(text)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="examples" className="l-wrap l-section examples">
          <h2>{t('lExamplesTitle')}</h2>
          <p className="hint">{t('examplesHint')}</p>
          <ul>
            {examples.map((ex) => (
              <li key={ex.file}>
                <a className="example" href={`/app#ex=${ex.file}`}>
                  <span className="example-icons" aria-hidden>
                    {ex.icons.join(' ')}
                  </span>
                  <strong>{ex.title}</strong>
                  <span>{ex.subtitle}</span>
                  <em>{ex.language.toUpperCase()}</em>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <GalleryList heading="h2" className="l-wrap l-section" />

        <section className="l-wrap l-section">
          <h2>{t('lAiTitle')}</h2>
          <p className="lead">{t('lAiLead')}</p>
          <ul className="l-cards l-providers">
            {BYOK_PROVIDERS.map((id) => {
              const p = PROVIDERS[id];
              return (
                <li key={id}>
                  <h3>
                    {p.name} <span className="muted">· {p.vendor}</span>
                  </h3>
                  <p>
                    {p.models.fast} · {p.models.thorough}
                  </p>
                  {p.cost && <p className="l-cost">{t('perResearch', { cost: usdRange(p.cost.fast, lang) })}</p>}
                </li>
              );
            })}
            <li>
              <h3>
                {t('localModel')} <span className="muted">· {PROVIDERS.local.vendor}</span>
              </h3>
              <p>{t('lLocalCard')}</p>
              <p className="l-cost">{t('lFree')}</p>
            </li>
          </ul>
          <p className="hint">{t('lAiLocal')}</p>
          <div className="l-ctas">
            <a className="ghost as-button" href="/app#settings">
              {t('lAiCta')}
            </a>
          </div>
        </section>

        <section className="l-wrap l-section">
          <div className="l-moinsen">
            <p className="eyebrow">{t('lMoinsenEyebrow')}</p>
            <h2>{t('lMoinsenTitle')}</h2>
            <p>{t('lMoinsenText')}</p>
            <p>{t('lMoinsenOffer')}</p>
            <div className="l-ctas">
              <a className="warm as-button" href={moinsenUrl(lang, 'contact')} target="_blank" rel="noreferrer">
                {t('lMoinsenCta')}
              </a>
              <a className="ghost as-button" href={moinsenUrl(lang, 'kmu')} target="_blank" rel="noreferrer">
                {t('lMoinsenKmu')}
              </a>
              <a className="l-open" href={moinsenUrl(lang)} target="_blank" rel="noreferrer">
                moinsen.dev →
              </a>
            </div>
          </div>
        </section>

        <section id="faq" className="l-wrap l-section">
          <h2>{t('lFaqTitle')}</h2>
          <div className="l-faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{t(q)}</summary>
                <p>{t(a)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="l-wrap l-final">
          <h2>{t('lFinalTitle')}</h2>
          <a className="primary as-button" href="/app">
            {t('lCtaStart')}
          </a>
        </section>
      </main>

      <footer className="l-wrap l-footer">
        <span>StatRace · MIT</span>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <span>
          {t('lFooterMade')}{' '}
          <a href={moinsenUrl(lang)} target="_blank" rel="noreferrer">
            moinsen.dev
          </a>
        </span>
        <a href={moinsenUrl(lang, 'impressum')} target="_blank" rel="noreferrer">
          {t('lImprint')}
        </a>
        <a href={moinsenUrl(lang, 'privacy')} target="_blank" rel="noreferrer">
          {t('privacy')}
        </a>
      </footer>
    </div>
  );
}
