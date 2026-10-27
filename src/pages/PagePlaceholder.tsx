type PagePlaceholderProps = { eyebrow: string; title: string; description: string; status: string }

export function PagePlaceholder({ eyebrow, title, description, status }: PagePlaceholderProps) {
  return <section className="page-placeholder"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="description">{description}</p><div className="placeholder-card"><span className="status-dot" aria-hidden="true" /><p>{status}</p></div></section>
}