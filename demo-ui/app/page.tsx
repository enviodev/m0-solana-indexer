import { WidgetBody } from "@/components/WidgetBody";
import { LiveStatus } from "@/components/LiveStatus";
import { siteConfig } from "@/site.config";
import type { Widget } from "@/lib/types";

function spanOf(widget: Widget): number {
  if (widget.span) return widget.span;
  return widget.kind === "stat" ? 4 : 8;
}

export default function Page() {
  const { protocolName, title, subtitle, chains, hero, widgets, footerLinks } = siteConfig;
  const halo = siteConfig.theme?.halo ?? false;

  return (
    <main className="page">
      <nav className="topbar">
        <div className="brand">
          <span className="brand-dot" aria-hidden />
          <span className="brand-name">{protocolName}</span>
        </div>
        <div className="topbar-chips">
          {chains?.map((c) => (
            <span key={c.id} className="chip chip--muted">
              {c.label}
            </span>
          ))}
          {siteConfig.liveStatus !== false ? <LiveStatus /> : null}
          <span className="chip chip--accent">Powered by Envio</span>
        </div>
      </nav>

      <header className={`hero${halo ? " hero--halo" : ""}`}>
        <div className="hero-copy">
          <h1 className="headline">{title}</h1>
          <p className="subhead">{subtitle}</p>
        </div>
        {hero ? (
          <aside className="hero-stat card" data-widget="stat">
            <h2 className="card-title">{hero.title}</h2>
            <WidgetBody widget={hero} />
          </aside>
        ) : null}
      </header>

      <section className="grid">
        {widgets.map((widget, i) => (
          <article
            key={i}
            data-widget={widget.kind}
            className="card"
            style={{ gridColumn: `span ${spanOf(widget)}`, "--enter": i + 1 } as React.CSSProperties}
          >
            <h2 className="card-title">{widget.title}</h2>
            <WidgetBody widget={widget} />
          </article>
        ))}
      </section>

      <footer className="footer">
        <span className="footer-brand">
          {protocolName} · live on-chain data indexed by{" "}
          <a href="https://envio.dev" target="_blank" rel="noreferrer">
            Envio HyperIndex
          </a>
        </span>
        {footerLinks?.length ? (
          <nav className="footer-links">
            {footerLinks.map((link, i) => (
              <a key={i} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}
      </footer>
    </main>
  );
}
