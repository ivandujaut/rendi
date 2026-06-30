"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

export function WaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [useCase, setUseCase] = useState("");
  const [pain, setPain] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name, email, useCase, pain }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No pudimos sumarte. Probá de nuevo.");
        return;
      }
      setDone(true);
    } catch {
      setError("No pudimos sumarte. Revisá tu conexión.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-[linear-gradient(225deg,var(--color-yellow-light)_0%,var(--color-yellow)_100%)] text-ink">
          <HugeiconsIcon icon={Tick02Icon} size={26} />
        </div>
        <h3 className="font-disp font-bold text-xl text-ink mb-1">¡Listo, quedaste en la lista!</h3>
        <p className="text-grey-600">Te escribimos a <b className="text-ink">{email}</b> apenas te toque entrar.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card p-6 sm:p-8 grid gap-5 text-left">
      <Field label="Email" htmlFor="wl-email">
        <Input id="wl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@colegio.edu.ar" autoComplete="email" required />
      </Field>
      <Field label="Nombre y apellido (opcional)" htmlFor="wl-name">
        <Input id="wl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Ana Pérez" autoComplete="name" />
      </Field>
      <Field label="¿Para qué lo querés usar? (opcional)" htmlFor="wl-use">
        <Select id="wl-use" value={useCase} onChange={(e) => setUseCase(e.target.value)}>
          <option value="">Sin especificar</option>
          <option value="oatec">Preparar para la OATec u otra olimpiada</option>
          <option value="aula">Evaluar en el aula, día a día</option>
          <option value="ambas">Las dos</option>
          <option value="otra">Otra</option>
        </Select>
      </Field>
      <Field label="¿Cuál es tu mayor dolor a la hora de evaluar? (opcional)" htmlFor="wl-pain">
        <Input id="wl-pain" value={pain} onChange={(e) => setPain(e.target.value)} placeholder="Contámelo en una línea" />
      </Field>

      {error && <p className="text-sm font-semibold text-[#e31d1c]">{error}</p>}

      <Button type="submit" variant="accent" size="lg" disabled={busy} className="w-full">
        {busy ? "Sumándote…" : "Sumarme a la lista"}
        {!busy && <HugeiconsIcon icon={ArrowRight01Icon} />}
      </Button>
      <p className="text-center text-xs text-grey-600">Sin spam. Te escribimos solo cuando te toque entrar.</p>
    </form>
  );
}
