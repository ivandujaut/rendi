import { Landing } from "@/components/Landing";

export const dynamic = "force-dynamic";

// La landing es pública para todos. Si el usuario está logueado, el navbar
// (SiteHeader) le muestra su foto y un acceso directo a la app, así no tiene
// que volver a loguearse.
export default function Home() {
  return <Landing />;
}
