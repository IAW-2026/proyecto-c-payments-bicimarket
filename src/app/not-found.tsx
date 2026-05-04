import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="text-lg text-muted-foreground">
        La pagina que buscas no existe.
      </p>
      <Link href="/" className={buttonVariants()}>
        Volver al inicio
      </Link>
    </main>
  );
}
