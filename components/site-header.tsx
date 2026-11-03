import Link from "next/link";

export function SiteHeader() {
  return <header><nav className="shell" style={{ display: "flex", justifyContent: "space-between" }}>
    <Link href="/"><strong>Portfolio</strong></Link><Link href="/admin">Draft review</Link>
  </nav></header>;
}
