import { Activity, BookOpen, Globe, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PublicBottomCta, PublicPageHero, PublicShell } from "../components/public-shell";
import { PublicChecklist, PublicFeatureCard, PublicInfoCard, PublicSection } from "../components/public-ui";
import {
  apiReferenceSections,
  runtimeCapabilities,
  smtpDiagnosticExamples,
  smtpDiagnosticFieldGuides,
} from "../docs-reference";

const docsSections = [
  {
    title: "Text",
    body: "Text、Text、OAuth、Text、Text TOTP Text。",
    icon: ShieldCheck,
  },
  {
    title: "Text",
    body: "Text、Text、Text、Text、Text EML Text。",
    icon: Mail,
  },
  {
    title: "DomainText DNS",
    body: "TextDomainText、TextDomainText、Text、DNS Text。",
    icon: Globe,
  },
  {
    title: "API Key Text Webhook",
    body: "Text API Key、DomainText、Webhook Text。",
    icon: KeyRound,
  },
  {
    title: "SMTP Text",
    body: "Text、Text、reject Text inbound spool Text。",
    icon: Activity,
  },
  {
    title: "Text",
    body: "Text，Text。",
    icon: BookOpen,
  },
];

export function DocsLandingPage() {
  const { t } = useTranslation();

  return (
    <PublicShell>
      <PublicPageHero
        eyebrow="Docs"
        title="Text API Text"
        description="Text。"
      />

      <PublicSection
        description="Text，Text。"
        title="Text"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {docsSections.map((section) => (
            <PublicFeatureCard description={section.body} icon={section.icon} key={section.title} title={section.title} />
          ))}
        </div>
      </PublicSection>

      <PublicInfoCard
        description="Text。"
        title="Text"
      >
        <PublicChecklist items={runtimeCapabilities} marker="index" />
      </PublicInfoCard>

      <PublicInfoCard
        description={t("docsLanding.llmCompanion.description")}
        title={t("docsLanding.llmCompanion.title")}
      >
        <div className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            {t("docsLanding.llmCompanion.fileIntro")} <code>/llm.txt</code>
            <br />
            {t("docsLanding.llmCompanion.fileNote")}
          </p>
          <p>
            {t("docsLanding.llmCompanion.summary")}
            <br />
            {t("docsLanding.llmCompanion.summaryNote")}
          </p>
          <a
            className="inline-flex items-center rounded-lg border border-border/60 bg-card px-3 py-2 font-medium text-foreground transition hover:border-border hover:bg-accent"
            href="/llm.txt"
            rel="noreferrer"
            target="_blank"
          >
            {t("docsLanding.llmCompanion.open")}
          </a>
        </div>
      </PublicInfoCard>

      <PublicSection
        description="Text、Text。"
        title="API Text"
      >
        <div className="space-y-4">
          {apiReferenceSections.map((section) => (
            <div className="rounded-xl border border-border/60 bg-card/92 p-4" key={section.title}>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">{section.title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{section.description}</p>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      <th className="border-b border-border/60 px-3 py-2">Method</th>
                      <th className="border-b border-border/60 px-3 py-2">Path</th>
                      <th className="border-b border-border/60 px-3 py-2">Text</th>
                      <th className="border-b border-border/60 px-3 py-2">Text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.endpoints.map((endpoint) => (
                      <tr className="align-top" key={`${endpoint.method}-${endpoint.path}`}>
                        <td className="border-b border-border/40 px-3 py-3 font-medium">{endpoint.method}</td>
                        <td className="border-b border-border/40 px-3 py-3 font-mono text-xs">{endpoint.path}</td>
                        <td className="border-b border-border/40 px-3 py-3">{endpoint.auth}</td>
                        <td className="border-b border-border/40 px-3 py-3 text-muted-foreground">{endpoint.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        description="Text SMTP Text，Text、Text。"
        title="SMTP Diagnostics Examples"
      >
        <div className="space-y-4">
          {smtpDiagnosticExamples.map((example) => (
            <div className="rounded-xl border border-border/60 bg-card/92 p-4" key={example.title}>
              <div className="space-y-1">
                <h2 className="text-base font-semibold tracking-tight">{example.title}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{example.description}</p>
              </div>
              <pre className="mt-4 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-4 text-xs leading-6 text-foreground">
                <code>{example.payload}</code>
              </pre>
            </div>
          ))}
        </div>
      </PublicSection>

      <PublicSection
        description="Text SMTP Text，Text UI、Text LLM。"
        title="SMTP Diagnostics Field Guide"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {smtpDiagnosticFieldGuides.map((field) => (
            <div className="rounded-xl border border-border/60 bg-card/92 p-4" key={field.name}>
              <div className="font-mono text-sm font-semibold text-foreground">{field.name}</div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{field.meaning}</p>
            </div>
          ))}
        </div>
      </PublicSection>

      <PublicBottomCta />
    </PublicShell>
  );
}
