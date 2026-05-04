import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WelcomeCard } from "./welcome-card";

export default async function DashboardPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-6 py-3">
          <h1 className="font-heading text-lg font-semibold tracking-tight">
            Marketplace
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user.firstName} {user.lastName}
            </span>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-6 px-6 py-8">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bienvenido al marketplace. Personalizalo segun tu modulo.
          </p>
        </div>

        <WelcomeCard />
      </main>
    </div>
  );
}
