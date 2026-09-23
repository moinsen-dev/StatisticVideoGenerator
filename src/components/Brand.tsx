/** Logo and name; links to the landing page. */
export function Brand({ tag }: { tag?: string }) {
  return (
    <a className="brand" href="/">
      <span className="brand-mark" aria-hidden>
        <i style={{ height: '55%' }} />
        <i style={{ height: '100%' }} />
        <i style={{ height: '75%' }} />
      </span>
      <span className="brand-name">StatRace</span>
      {tag && <span className="brand-tag">{tag}</span>}
    </a>
  );
}
