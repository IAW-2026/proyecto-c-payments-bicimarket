import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShoppingBag } from "lucide-react";

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <ShoppingBag className="size-6 text-primary" />
          </div>
          <CardTitle className="font-heading text-2xl font-bold tracking-tight">
            Marketplace
          </CardTitle>
          <CardDescription>
            Plataforma de compra-venta entre usuarios
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Link
            href="/sign-in"
            className={buttonVariants({ size: "lg", className: "w-full" })}
          >
            Iniciar Sesion
          </Link>
          <Link
            href="/sign-up"
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "w-full",
            })}
          >
            Crear Cuenta
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
