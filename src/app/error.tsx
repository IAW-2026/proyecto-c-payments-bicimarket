"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">Algo salio mal</h1>
      <p className="text-lg text-muted-foreground">
        {error.message || "Ocurrio un error inesperado."}
      </p>
      <Button onClick={reset}>Intentar de nuevo</Button>
    </main>
  );
}
