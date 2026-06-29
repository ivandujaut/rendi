"use client";

import { useRouter } from "next/navigation";
import { Select } from "@base-ui/react/select";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

type ExamItem = { id: string; title: string; year: number | null };

/**
 * Selector de simulacro custom (no nativo) para el panel docente.
 * Lista todos los simulacros creados, muestra el conteo, y navega al elegido.
 */
export function ExamSwitcher({ examList, examId }: { examList: ExamItem[]; examId: string | null }) {
  const router = useRouter();

  return (
    <Select.Root
      value={examId}
      onValueChange={(value) => {
        if (value) router.push(`/teacher?exam=${value}`);
      }}
    >
      <Select.Trigger className="flex h-12 w-64 max-w-full items-center justify-between gap-2 rounded-lg border border-grey-100 bg-white px-4 text-left text-sm text-ink outline-none transition-colors hover:bg-[#fafafa] focus-visible:border-ink data-[popup-open]:border-ink">
        <Select.Value placeholder="Elegí un simulacro" className="truncate">
          {(value: string | null) => examList.find((e) => e.id === value)?.title ?? "Elegí un simulacro"}
        </Select.Value>
        <Select.Icon className="shrink-0 text-grey-600 transition-transform data-[popup-open]:rotate-180">
          <HugeiconsIcon icon={ArrowDown01Icon} size={18} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner className="z-50 outline-none" side="bottom" align="start" sideOffset={6}>
          <Select.Popup className="min-w-[var(--anchor-width)] max-h-[var(--available-height)] overflow-y-auto rounded-xl border border-grey-100 bg-white p-1 shadow-[0_8px_28px_rgba(58,58,58,0.12)] outline-none">
            <div className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-grey-600">
              {examList.length} simulacro{examList.length !== 1 ? "s" : ""}
            </div>
            <Select.List>
              {examList.map((e) => (
                <Select.Item
                  key={e.id}
                  value={e.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink outline-none data-[highlighted]:bg-[#fffcf5] data-[selected]:bg-[#fff7e0]"
                >
                  <span className="flex w-5 shrink-0 items-center justify-center text-yellow">
                    <Select.ItemIndicator>
                      <HugeiconsIcon icon={Tick02Icon} size={16} />
                    </Select.ItemIndicator>
                  </span>
                  <Select.ItemText className="flex-1 truncate">{e.title}</Select.ItemText>
                  {e.year && <span className="font-mono text-xs text-grey-600">{e.year}</span>}
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
