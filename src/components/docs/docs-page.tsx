"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Link as LinkIcon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

type DocLevel = {
  label: string;
  description: string;
};

type DocItem = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  levels?: DocLevel[];
  examples?: string[];
};

type DocSection = {
  id: string;
  title: string;
  summary?: string;
  items: DocItem[];
};

type DocsContent = {
  title: string;
  updatedAt?: string;
  sections: DocSection[];
};

type DocsPageProps = {
  docs: DocsContent;
};

function normalizeTerm(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildItemText(item: DocItem) {
  const parts = [item.title];
  if (item.paragraphs) parts.push(...item.paragraphs);
  if (item.bullets) parts.push(...item.bullets);
  if (item.examples) parts.push(...item.examples);
  if (item.levels) parts.push(...item.levels.map((level) => `${level.label} ${level.description}`));
  return parts.join(" ");
}

export default function DocsPage({ docs }: DocsPageProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(docs.sections.map((section) => section.id))
  );

  const normalizedQuery = useMemo(() => normalizeTerm(query.trim()), [query]);

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return docs.sections;

    return docs.sections
      .map((section) => {
        const sectionText = normalizeTerm(`${section.title} ${section.summary ?? ""}`);
        const sectionMatches = sectionText.includes(normalizedQuery);
        const items = sectionMatches
          ? section.items
          : section.items.filter((item) => normalizeTerm(buildItemText(item)).includes(normalizedQuery));
        return items.length > 0 ? { ...section, items } : null;
      })
      .filter(Boolean) as DocSection[];
  }, [docs.sections, normalizedQuery]);

  useEffect(() => {
    const ids = filteredSections.flatMap((section) => section.items.map((item) => item.id));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0.2 }
    );

    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [filteredSections]);

  const handleCopy = async (id: string) => {
    try {
      const url = new URL(window.location.href);
      url.hash = id;
      await navigator.clipboard.writeText(url.toString());
      toast({
        title: "Link copiado",
        description: `#${id}`
      });
    } catch {
      toast({
        title: "Nao foi possivel copiar",
        description: "Copie manualmente o link da barra de endereco.",
        variant: "destructive"
      });
    }
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const activeSectionId = useMemo(() => {
    if (!activeId) return null;
    const found = filteredSections.find((section) =>
      section.items.some((item) => item.id === activeId)
    );
    return found?.id ?? null;
  }, [activeId, filteredSections]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            <span>Documentacao</span>
            {docs.updatedAt ? <span>Atualizado em {docs.updatedAt}</span> : null}
          </div>
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            {docs.title}
          </h1>
          <p className="text-muted-foreground">
            Guia pratico para conduzir assessments e interpretar os modulos do SSDF Compass.
          </p>
        </div>
        <div className="w-full max-w-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar na documentacao"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6">
          <div className="rounded-lg border border-border bg-white/80 p-4 text-sm dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Indice</p>
            <nav className="mt-3 space-y-3">
              {filteredSections.map((section) => (
                <div key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={cn(
                      "block text-sm font-semibold",
                      activeSectionId === section.id ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {section.title}
                  </a>
                  <div className="mt-2 space-y-1 border-l border-border pl-3">
                    {section.items.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={cn(
                          "block text-xs",
                          activeId === item.id ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {item.title}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
              {filteredSections.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum resultado.</p>
              ) : null}
            </nav>
          </div>
        </aside>

        <div className="space-y-6">
          {filteredSections.map((section) => {
            const isOpen = normalizedQuery ? true : openSections.has(section.id);
            return (
              <section key={section.id} id={section.id} className="rounded-xl border border-border">
                <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isOpen}
                    className="flex-1 space-y-2 text-left"
                  >
                    <h2 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                      {section.title}
                    </h2>
                    {section.summary ? (
                      <p className="text-sm text-muted-foreground">{section.summary}</p>
                    ) : null}
                  </button>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(section.id)}
                      className="h-8 px-2 text-xs text-muted-foreground"
                    >
                      <LinkIcon className="mr-2 h-3.5 w-3.5" />
                      Copiar link
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {isOpen ? "Fechar" : "Abrir"}
                    </span>
                  </div>
                </div>

                {isOpen ? (
                  <div className="space-y-6 border-t border-border px-5 py-6">
                    {section.items.map((item) => (
                      <div key={item.id} className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <h3 id={item.id} className="text-base font-semibold">
                            {item.title}
                          </h3>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopy(item.id)}
                            className="h-8 px-2 text-xs text-muted-foreground"
                          >
                            <LinkIcon className="mr-2 h-3.5 w-3.5" />
                            Copiar link
                          </Button>
                        </div>
                        {item.paragraphs?.map((paragraph, index) => (
                          <p key={`${item.id}-p-${index}`} className="text-sm text-muted-foreground">
                            {paragraph}
                          </p>
                        ))}
                        {item.bullets ? (
                          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                            {item.bullets.map((bullet, index) => (
                              <li key={`${item.id}-b-${index}`}>{bullet}</li>
                            ))}
                          </ul>
                        ) : null}
                        {item.levels ? (
                          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Niveis
                            </p>
                            <div className="space-y-2">
                              {item.levels.map((level, index) => (
                                <div key={`${item.id}-l-${index}`}>
                                  <p className="font-semibold">{level.label}</p>
                                  <p className="text-muted-foreground">{level.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {item.examples ? (
                          <div className="space-y-2 rounded-lg border border-border bg-white/80 p-4 text-sm dark:bg-slate-900/70">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Exemplos
                            </p>
                            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                              {item.examples.map((example, index) => (
                                <li key={`${item.id}-e-${index}`}>{example}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
