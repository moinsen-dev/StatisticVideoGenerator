import { useEffect, useState } from 'react';
import type { ServerStatus } from '../../shared/dataset.ts';
import { getStatus } from '../lib/api.ts';
import { useLang, useT, type Lang, type MessageKey, type Translate } from '../lib/i18n.ts';
import { forgetAllKeys } from '../lib/keys.ts';
import {
  BYOK_PROVIDERS,
  defaultProvider,
  hasKey,
  PROVIDERS,
  saveProvider,
  usdRange,
  type Provider,
  type ProviderId,
} from '../lib/providers.ts';
import { Brand } from './Brand.tsx';
import { KeyField } from './KeyField.tsx';
import { LangSwitch } from './LangSwitch.tsx';

const DESCRIPTION: Record<ProviderId, MessageKey> = {
  'claude-code': 'provClaudeCodeDesc',
  anthropic: 'provAnthropicDesc',
  openai: 'provOpenaiDesc',
};

export const providerTitle = (id: ProviderId, t: Translate) =>
  id === 'claude-code' ? t('claudeCodeLocal') : `${PROVIDERS[id].name} · ${PROVIDERS[id].vendor}`;

const costText = (p: Provider, lang: Lang) =>
  p.cost ? `${usdRange(p.cost.fast, lang)} (${p.models.thorough}: ${usdRange(p.cost.thorough, lang)})` : '';

/** Key input for a research provider, with its hint about where the key goes and what a run costs. */
export function ProviderKeyField({ id, onChange }: { id: ProviderId; onChange?: () => void }) {
  const t = useT();
  const lang = useLang();
  const p = PROVIDERS[id];
  if (!p.key) return null;
  return (
    <KeyField
      key={id}
      name={p.key.name}
      label={t('keyLabel', { vendor: p.vendor })}
      createUrl={p.key.createUrl}
      placeholder={p.key.placeholder}
      hint={t('keyHint', { host: p.key.host, cost: costText(p, lang) })}
      onChange={onChange}
    />
  );
}

export function Settings(props: { onBack: () => void }) {
  const t = useT();
  const lang = useLang();
  const [status, setStatus] = useState<ServerStatus | null | undefined>(undefined);
  const [provider, setProvider] = useState<ProviderId>(() => defaultProvider(false));
  const [, setKeyVersion] = useState(0);
  // Bumped by "remove all keys" so every key field starts empty again.
  const [generation, setGeneration] = useState(0);
  const cliReady = Boolean(status?.claude.available && status.claude.loggedIn);

  useEffect(() => {
    void getStatus().then((s) => {
      setStatus(s);
      setProvider(defaultProvider(Boolean(s?.claude.available && s.claude.loggedIn)));
    });
  }, []);

  const ids: ProviderId[] = cliReady ? ['claude-code', ...BYOK_PROVIDERS] : BYOK_PROVIDERS;
  const choose = (id: ProviderId) => {
    setProvider(id);
    saveProvider(id);
  };

  return (
    <div className="home">
      <header className="app-bar">
        <Brand tag={t('tagline')} />
        <span className="spacer" />
        <LangSwitch />
      </header>

      <main className="settings-main" key={generation}>
        <button type="button" className="ghost" onClick={props.onBack}>
          ← {t('back')}
        </button>
        <h1>{t('settings')}</h1>
        <p className="lead">{t('settingsLead')}</p>

        <section className="settings-section">
          <h2>{t('researchAi')}</h2>
          <div className="choices" role="radiogroup" aria-label={t('researchAi')}>
            {ids.map((id) => {
              const p = PROVIDERS[id];
              const on = provider === id;
              return (
                <div key={id} className={`provider ${on ? 'on' : ''}`}>
                  <label className="provider-head">
                    <input type="radio" name="provider" checked={on} onChange={() => choose(id)} />
                    <span>
                      <strong>{providerTitle(id, t)}</strong>
                      <small>
                        {p.models.fast} · {p.models.thorough}
                        {p.cost && ` · ${t('perResearch', { cost: usdRange(p.cost.fast, lang) })}`}
                      </small>
                      <small>{t(DESCRIPTION[id])}</small>
                    </span>
                    {p.key && <em className={`badge ${hasKey(id) ? 'ok' : ''}`}>{hasKey(id) ? t('keySaved') : t('keyNone')}</em>}
                  </label>
                  {on && <ProviderKeyField id={id} onChange={() => setKeyVersion((v) => v + 1)} />}
                </div>
              );
            })}
          </div>
        </section>

        <section className="settings-section">
          <h2>{t('musicGenerator')}</h2>
          <p className="hint">{t('musicSettingsDesc')}</p>
          {status?.elevenlabs ? (
            <p className="good">{t('elevenReady')}</p>
          ) : (
            <KeyField
              name="elevenlabs"
              label={t('elevenKey')}
              createUrl="https://elevenlabs.io/app/settings/api-keys"
              hint={t('elevenKeyHint')}
            />
          )}
        </section>

        <section className="settings-section">
          <h2>{t('privacy')}</h2>
          <p className="hint">{t('privacyText')}</p>
          <div className="row-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                forgetAllKeys();
                setGeneration((g) => g + 1);
              }}
            >
              {t('forgetAll')}
            </button>
            {generation > 0 && <span className="hint">{t('keysForgotten')}</span>}
          </div>
        </section>
      </main>
    </div>
  );
}
