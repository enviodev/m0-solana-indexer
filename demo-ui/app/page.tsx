import { WidgetBody } from "@/components/WidgetBody";
import { LiveStatus } from "@/components/LiveStatus";
import { siteConfig } from "@/site.config";
import { getEndpoint, slugify } from "@/lib/data";
import type { Section, Widget } from "@/lib/types";

function spanOf(widget: Widget): number {
  if (widget.span) return widget.span;
  return widget.kind === "stat" ? 4 : 8;
}

function Card({ widget, index }: { widget: Widget; index: number }) {
  const span = spanOf(widget);
  return (
    <article
      data-widget={widget.kind}
      data-span={span}
      className="card"
      style={{ gridColumn: `span ${span}`, "--enter": index + 1 } as React.CSSProperties}
    >
      <h3 className="card-title">{widget.title}</h3>
      <WidgetBody widget={widget} />
    </article>
  );
}

function SectionBlock({ section, offset }: { section: Section; offset: number }) {
  const id = section.id ?? slugify(section.title);
  return (
    <section className="section" id={id} aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <div>
          {section.eyebrow ? <span className="section-eyebrow">{section.eyebrow}</span> : null}
          <h2 className="section-title" id={`${id}-title`}>
            {section.title}
          </h2>
        </div>
        {section.description ? <p className="section-desc">{section.description}</p> : null}
      </div>
      <div className="grid">
        {section.widgets.map((widget, i) => (
          <Card key={i} widget={widget} index={offset + i} />
        ))}
      </div>
    </section>
  );
}

export default function Page() {
  const { protocolName, protocolTag, eyebrow, title, subtitle, chains, hero, facts, footerLinks } =
    siteConfig;
  const halo = siteConfig.theme?.halo ?? false;
  const sections: Section[] =
    siteConfig.sections ?? (siteConfig.widgets ? [{ title: "Overview", widgets: siteConfig.widgets }] : []);
  const endpoint = getEndpoint();

  let enter = 0;
  return (
    <main className="page">
      <nav className="topbar" aria-label="Site">
        <a className="brand" href="#top">
          <span className="brand-dot" aria-hidden />
          <span className="brand-name">{protocolName}</span>
          {protocolTag ? <span className="brand-tag">{protocolTag}</span> : null}
        </a>
        <div className="topbar-chips">
          {chains?.map((c) => (
            <span key={c.id} className="chip chip--muted">
              {c.label}
            </span>
          ))}
          {siteConfig.liveStatus !== false ? <LiveStatus /> : null}
          <a className="chip chip--accent" href="https://envio.dev" target="_blank" rel="noreferrer">
            Powered by Envio
          </a>
        </div>
      </nav>

      <header id="top" className={`hero${halo ? " hero--halo" : ""}`}>
        <div className="hero-copy">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="headline">{title}</h1>
          <p className="subhead">{subtitle}</p>
          {facts?.length ? (
            <dl className="facts">
              {facts.map((f, i) => (
                <div className="fact" key={i}>
                  <dt>{f.label}</dt>
                  <dd>
                    {f.href ? (
                      <a href={f.href} target="_blank" rel="noreferrer">
                        {f.value}
                      </a>
                    ) : (
                      f.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        {hero ? (
          <aside className="hero-stat card" data-widget="stat">
            <h2 className="card-title">{hero.title}</h2>
            <WidgetBody widget={hero} />
          </aside>
        ) : null}
      </header>

      {sections.map((section, i) => {
        const block = <SectionBlock key={section.id ?? i} section={section} offset={enter} />;
        enter += section.widgets.length;
        return block;
      })}

      <footer className="footer">
        <div className="footer-brand">
          <strong>{protocolName} on-chain data</strong>
          <span>
            Indexed in real time by{" "}
            <a href="https://envio.dev" target="_blank" rel="noreferrer">
              Envio HyperIndex
            </a>
            {chains?.length ? ` · ${chains.map((c) => c.label).join(", ")}` : ""}
          </span>
        </div>
        {footerLinks?.length ? (
          <nav className="footer-links" aria-label="Footer">
            {footerLinks.map((link, i) => (
              <a key={i} href={link.href} target="_blank" rel="noreferrer">
                {link.label}
              </a>
            ))}
          </nav>
        ) : null}
        {endpoint ? (
          <div className="footer-endpoint">
            <span>GraphQL</span>
            <code>{endpoint}</code>
          </div>
        ) : null}
      </footer>
    </main>
  );
}
