import { PublicBottomCta, PublicPageHero, PublicShell } from "../components/public-shell";
import { PublicFeatureCard, PublicSection } from "../components/public-ui";

const faqItems = [
  {
    title: "Text？",
    body: "Text、OAuth Text、Text、Text TOTP Text。",
  },
  {
    title: "TextDomainText？",
    body: "TextDomainText、TextDomainText、DNS Text、Text、Text。",
  },
  {
    title: "Text？",
    body: "Text、Text、Text、Text、Body、Text EML Text。",
  },
  {
    title: "API Key TextDomainText？",
    body: "Text。API Key Text scope、DomainText，Text scope TextDomainText。",
  },
  {
    title: "Webhook Text？",
    body: "Text、Text、Text Webhook，Text。",
  },
  {
    title: "Text？",
    body: "Text；Text。",
  },
];

export function FaqPage() {
  return (
    <PublicShell>
      <PublicPageHero
        eyebrow="FAQ"
        title="Textissue"
        description="Text、Textissue。"
      />

      <PublicSection description="Text。" title="Textissue">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {faqItems.map((item) => (
            <PublicFeatureCard description={item.body} key={item.title} title={item.title} />
          ))}
        </div>
      </PublicSection>

      <PublicBottomCta />
    </PublicShell>
  );
}
