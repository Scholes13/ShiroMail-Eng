import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { PublicBottomCta, PublicPageHero, PublicShell } from "../components/public-shell";
import { PublicSection } from "../components/public-ui";

const updateItems = [
  {
    title: "Text",
    category: "Auth",
    date: "2026-04-02",
    body: "Text、OAuth、Text、Text TOTP Text。",
  },
  {
    title: "DomainText DNS Text",
    category: "Domain",
    date: "2026-04-03",
    body: "TextDomain、TextDomain、DNS Text、Text、Text。",
  },
  {
    title: "Text and Text",
    category: "Mailbox",
    date: "2026-04-04",
    body: "Text、Text、Text、Text、Text EML Text。",
  },
  {
    title: "Text and Text TOTP",
    category: "Security",
    date: "2026-04-05",
    body: "Text、Text、Text。",
  },
];

export function UpdatesPage() {
  return (
    <PublicShell>
      <PublicPageHero
        eyebrow="Updates"
        title="Text"
        description="Text。"
      />

      <PublicSection description="Text。" title="Text">
        <div className="space-y-4">
          {updateItems.map((item) => (
            <Card className="border-border/60 bg-card/92 shadow-none" key={item.title}>
              <CardHeader className="gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border/60 px-2 py-1">{item.category}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    {item.date}
                  </span>
                </div>
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{item.body}</p>
                <Button asChild size="sm" variant="ghost">
                  <Link to="/docs">
                    Text
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </PublicSection>

      <PublicBottomCta />
    </PublicShell>
  );
}
