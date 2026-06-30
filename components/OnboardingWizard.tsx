"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { ActionBar } from "@/components/ui/action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  PencilEdit01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

type Role = "student" | "teacher";

const ROLES: { value: Role; icon: typeof PencilEdit01Icon; title: string; body: string }[] = [
  { value: "student", icon: PencilEdit01Icon, title: "Soy alumno/a", body: "Quiero rendir los simulacros que me habilite mi profe." },
  { value: "teacher", icon: UserGroupIcon, title: "Soy docente", body: "Quiero crear simulacros y seguir a mi comisión. Necesitás un código." },
];

export function OnboardingWizard({
  defaultName,
  defaultGroup,
}: {
  defaultName: string;
  defaultGroup: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [role, setRole] = useState<Role | null>(null);
  const [name, setName] = useState(defaultName);
  const [group, setGroup] = useState(defaultGroup);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTeacher = role === "teacher";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name, groupName: group, inviteCode: isTeacher ? code : "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No pudimos guardar tus datos. Probá de nuevo.");
        return;
      }
      router.push(data.role === "teacher" ? "/teacher" : "/exams");
      router.refresh();
    } catch {
      setError("No pudimos guardar tus datos. Revisá tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex min-h-[calc(100vh-4rem)] flex-col pb-44 lg:pb-28">
      <div className="px-4 pt-8">
        <div className="mx-auto w-full max-w-2xl">
          <Progress value={step === 0 ? 50 : 100} caption={`Paso ${step + 1} de 2`} />
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-10">
        <div className="w-full max-w-2xl">
          {step === 0 ? (
            <>
              <h1 className="font-disp text-3xl text-ink text-center mb-2">¿Cómo vas a usar Rendi?</h1>
              <p className="text-[#656565] text-center mb-8">Elegí tu perfil para configurar tu cuenta.</p>
              <div className="grid gap-3">
                {ROLES.map((r) => {
                  const active = role === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value)}
                      aria-pressed={active}
                      className={cn(
                        "flex items-center gap-4 rounded-xl border bg-white p-5 text-left transition",
                        active ? "border-yellow ring-2 ring-yellow/30" : "border-grey-100 hover:border-grey-300"
                      )}
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-cream text-ink">
                        <HugeiconsIcon icon={r.icon} size={22} />
                      </span>
                      <span className="flex-1">
                        <span className="block font-disp font-semibold text-ink">{r.title}</span>
                        <span className="block text-sm text-grey-600">{r.body}</span>
                      </span>
                      <Checkbox shape="round" checked={active} />
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h1 className="font-disp text-3xl text-ink text-center mb-2">
                {isTeacher ? "Tus datos de docente" : "Contanos quién sos"}
              </h1>
              <p className="text-[#656565] text-center mb-8">
                {isTeacher
                  ? "Con el código te damos acceso al panel docente."
                  : "Así tu profe te encuentra y te habilita los simulacros de tu comisión."}
              </p>
              <div className="mx-auto grid max-w-md gap-5">
                <Field label="Nombre y apellido" htmlFor="ob-name">
                  <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Ana Pérez" autoComplete="name" required />
                </Field>

                {isTeacher ? (
                  <>
                    <Field label="Comisión (opcional)" htmlFor="ob-group">
                      <Input id="ob-group" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Ej: Comisión 3 · Turno tarde" />
                    </Field>
                    <Field label="Código de docente" htmlFor="ob-code">
                      <Input id="ob-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Pegá el código que te dieron" autoComplete="off" required />
                    </Field>
                  </>
                ) : (
                  <Field label="Comisión / curso" htmlFor="ob-group">
                    <Input id="ob-group" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Ej: Comisión 3 · Turno tarde" required />
                  </Field>
                )}

                {error && <p className="text-sm font-semibold text-[#e31d1c]">{error}</p>}
              </div>
            </>
          )}
        </div>
      </div>

      <ActionBar
        stack
        className="fixed inset-x-0 bottom-0 z-30"
        back={
          step === 1 ? (
            <Button type="button" variant="secondary" size="lg" className="w-full lg:w-auto" onClick={() => { setError(null); setStep(0); }}>
              <HugeiconsIcon icon={ArrowLeft01Icon} />Atrás
            </Button>
          ) : undefined
        }
      >
        {step === 0 ? (
          <Button type="button" size="lg" className="w-full lg:w-auto" disabled={!role} onClick={() => setStep(1)}>
            Continuar<HugeiconsIcon icon={ArrowRight01Icon} />
          </Button>
        ) : (
          <Button type="submit" size="lg" className="w-full lg:w-auto" disabled={busy}>
            {busy ? "Guardando…" : "Entrar a Rendi"}
            {!busy && <HugeiconsIcon icon={ArrowRight01Icon} />}
          </Button>
        )}
      </ActionBar>
    </form>
  );
}
