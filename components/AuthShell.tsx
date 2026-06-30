import { AuthCarousel } from "./AuthCarousel";

/**
 * Marco de marca para las pantallas de autenticación, responsive:
 * - mobile (<md): solo el formulario sobre crema.
 * - tablet (md–lg): carrusel como banner superior + formulario debajo
 *   (adaptación del hero del Figma de tablet).
 * - desktop (lg+): layout partido — formulario izq + carrusel der.
 */
export function AuthShell({
  subtitle,
  tagline,
  children,
}: {
  subtitle: string;
  tagline: string;
  children: React.ReactNode;
}) {
  return (
    <main className="lg:grid lg:grid-cols-2 lg:min-h-[calc(100vh-4rem)]">
      {/* Banner superior (solo tablet) */}
      <div className="hidden md:block lg:hidden h-72">
        <AuthCarousel />
      </div>

      {/* Formulario */}
      <section className="grid place-items-center bg-[#FFFCF5] px-6 py-12 lg:min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-sm">
          <h1 className="font-disp text-3xl text-ink mb-1 text-center lg:text-left">{subtitle}</h1>
          <p className="text-[#656565] mb-8 text-center lg:text-left">{tagline}</p>
          <div className="flex justify-center lg:justify-start">{children}</div>
        </div>
      </section>

      {/* Panel lateral (solo desktop) */}
      <aside className="hidden lg:block">
        <AuthCarousel />
      </aside>
    </main>
  );
}
