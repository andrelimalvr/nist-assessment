import DocsPage from "@/components/docs/docs-page";
import docsContent from "@/content/docs/assessment-docs.json";

export default function DocumentationPage() {
  return <DocsPage docs={docsContent} />;
}
