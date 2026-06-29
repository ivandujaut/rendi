-- =====================================================================
-- 06_autosave.sql  ·  Auto-guardado de respuestas durante el intento
-- Hasta ahora 'responses' solo tenía INSERT, así que las respuestas se
-- guardaban únicamente al entregar. Esta política permite ACTUALIZAR una
-- respuesta mientras el intento sigue abierto (no entregado), habilitando
-- el guardado incremental a medida que el alumno responde.
-- Ejecutar después de 01–05.
-- =====================================================================

create policy "responses: actualizar en intento abierto"
  on public.responses for update to authenticated
  using (
    exists (select 1 from public.attempts a
            where a.id = attempt_id
              and a.user_id = public.clerk_uid()
              and a.submitted_at is null)
  )
  with check (
    exists (select 1 from public.attempts a
            where a.id = attempt_id
              and a.user_id = public.clerk_uid()
              and a.submitted_at is null)
  );
