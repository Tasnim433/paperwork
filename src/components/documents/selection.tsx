"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, useContext, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { DeletionKind } from "@/lib/deletion";

import { DeleteDocumentsDialog } from "./delete-documents-dialog";

type SelectionContextValue = {
  ids: string[];
  selected: string[];
  toggle: (id: string, checked: boolean) => void;
  setAll: (checked: boolean) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) throw new Error("Selection components must be inside SelectionProvider");
  return context;
}

/** Row selection for a table of documents with a bulk delete bar above it. */
export function SelectionProvider({
  ids,
  kind,
  children,
}: {
  ids: string[];
  kind: DeletionKind;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  // Rows can disappear (deleted elsewhere): only keep what is still listed.
  const visible = useMemo(() => selected.filter((id) => ids.includes(id)), [selected, ids]);

  const value: SelectionContextValue = {
    ids,
    selected: visible,
    toggle: (id, checked) =>
      setSelected((current) =>
        checked ? [...new Set([...current, id])] : current.filter((x) => x !== id),
      ),
    setAll: (checked) => setSelected(checked ? ids : []),
  };

  return (
    <SelectionContext.Provider value={value}>
      <SelectionBar kind={kind} onDeleted={() => setSelected([])} />
      {children}
    </SelectionContext.Provider>
  );
}

function SelectionBar({ kind, onDeleted }: { kind: DeletionKind; onDeleted: () => void }) {
  const t = useTranslations("documents");
  const router = useRouter();
  const { selected, setAll } = useSelection();
  const [open, setOpen] = useState(false);
  if (selected.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2 text-[13px]">
      <span className="tabular-nums">{t("selected", { count: selected.length })}</span>
      <Button variant="ghost" size="sm" onClick={() => setAll(false)}>
        {t("clearSelection")}
      </Button>
      <div className="flex-1" />
      <Button
        variant="outline"
        size="sm"
        className="text-danger hover:text-danger"
        onClick={() => setOpen(true)}
      >
        {t(`delete.${kind}.selected`)}
      </Button>
      <DeleteDocumentsDialog
        ids={selected}
        kind={kind}
        open={open}
        onOpenChange={setOpen}
        onDeleted={() => {
          onDeleted();
          router.refresh();
        }}
      />
    </div>
  );
}

const checkboxClass = "size-3.5 cursor-pointer accent-[var(--brand)]";

export function SelectAllCheckbox() {
  const t = useTranslations("documents");
  const { ids, selected, setAll } = useSelection();
  const all = ids.length > 0 && selected.length === ids.length;
  return (
    <input
      type="checkbox"
      aria-label={t("selectAll")}
      checked={all}
      ref={(element) => {
        if (element) element.indeterminate = selected.length > 0 && !all;
      }}
      onChange={(event) => setAll(event.target.checked)}
      className={checkboxClass}
    />
  );
}

export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const t = useTranslations("documents");
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      aria-label={t("select", { name: label })}
      checked={selected.includes(id)}
      onChange={(event) => toggle(id, event.target.checked)}
      className={checkboxClass}
    />
  );
}
