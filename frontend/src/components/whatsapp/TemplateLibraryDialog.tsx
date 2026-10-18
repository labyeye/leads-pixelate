import { useMemo, useState } from "react";
import { FileText, Languages } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TEMPLATE_LIBRARY,
  libraryToForm,
  type LibraryCategory,
  type LibraryTemplate,
} from "@/config/whatsappTemplateLibrary";

const GROUPS: ("All" | LibraryCategory)[] = [
  "All",
  "Welcome & enquiry",
  "Follow-up",
  "Quotation",
  "Visit & demo",
  "Order & payment",
  "Marketing",
];

const fillSamples = (text: string, samples: string[]) =>
  text.replace(
    /\{\{(\d+)\}\}/g,
    (_, n) => `*${samples[Number(n) - 1] ?? "…"}*`,
  );

/**
 * Demo templates the client can start from. Picking one fills the normal
 * "Create template" form (still fully editable) and from there it goes to Meta.
 */
export function TemplateLibraryDialog({
  open,
  onOpenChange,
  onPick,
  existingNames,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (form: ReturnType<typeof libraryToForm>) => void;
  /** meta template names the tenant already has, to flag duplicates */
  existingNames: string[];
}) {
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("All");
  const [lang, setLang] = useState<"en" | "hi">("en");

  const list = useMemo(
    () => TEMPLATE_LIBRARY.filter((t) => group === "All" || t.group === group),
    [group],
  );

  const pick = (t: LibraryTemplate) => {
    onPick(libraryToForm(t, lang));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Template library</DialogTitle>
          <DialogDescription>
            Pick a ready-made template, edit it if you like, then send it to
            Meta for approval. Approval usually takes a few hours to 2 days.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold uppercase tracking-wider border-2 border-black",
                group === g ? "bg-[#024BAB] text-white" : "bg-white",
              )}
            >
              {g}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <Languages className="w-4 h-4" />
            {(["en", "hi"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={cn(
                  "px-2.5 py-1 text-xs font-bold border-2 border-black",
                  lang === l ? "bg-black text-white" : "bg-white",
                )}
              >
                {l === "en" ? "English" : "हिन्दी"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((t) => {
            const form = libraryToForm(t, lang);
            const exists = existingNames.includes(form.metaTemplateName);
            return (
              <div
                key={t.id}
                className="border-2 border-black bg-white p-4 flex flex-col gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm">{t.title}</h4>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 border-2 border-black shrink-0",
                        t.category === "UTILITY"
                          ? "bg-[#DBEAFE]"
                          : "bg-[#FFEDD5]",
                      )}
                    >
                      {t.category}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.when}
                  </p>
                </div>

                <div className="bg-[#DCF8C6] border-2 border-black p-3 text-xs whitespace-pre-wrap flex-1">
                  {t.headerType === "TEXT" && t.headerText && (
                    <p className="font-bold mb-1">{t.headerText}</p>
                  )}
                  {t.headerType === "DOCUMENT" && (
                    <p className="flex items-center gap-1 font-bold mb-1">
                      <FileText className="w-3.5 h-3.5" /> Document attached
                      (PDF)
                    </p>
                  )}
                  {fillSamples(form.bodyText, t.samples)}
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {form.footerText}
                  </p>
                </div>

                <div className="text-[11px] text-muted-foreground">
                  Variables:{" "}
                  {t.vars.map((v, i) => `{{${i + 1}}} ${v}`).join(" · ")}
                  {t.headerType === "DOCUMENT" && (
                    <p className="mt-1">
                      Needs a sample PDF for Meta review — you'll upload it in
                      the next step.
                    </p>
                  )}
                </div>

                <Button size="sm" onClick={() => pick(t)} disabled={exists}>
                  {exists ? "Already added" : "Use this template"}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
