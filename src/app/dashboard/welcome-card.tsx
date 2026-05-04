"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart,
  TrendingUp,
  Package,
  ArrowUpRight,
  DollarSign,
  Users,
} from "lucide-react";

export function WelcomeCard() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {/* Ventas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ventas Totales
          </CardTitle>
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <DollarSign className="size-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="font-heading text-3xl font-bold tracking-tight">
            $12,450
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
              <TrendingUp className="size-3" />
              +12.5%
            </span>
            <span className="text-muted-foreground">vs mes anterior</span>
          </div>
          <Separator className="my-4" />
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Meta mensual</span>
              <span className="font-semibold">78%</span>
            </div>
            <Progress value={78} />
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" className="w-full">
            Ver reportes
            <ArrowUpRight className="ml-1 size-3" />
          </Button>
        </CardFooter>
      </Card>

      {/* Pedidos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pedidos
          </CardTitle>
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <ShoppingCart className="size-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="font-heading text-3xl font-bold tracking-tight">
            384
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            24 pedidos nuevos hoy
          </p>
          <Separator className="my-4" />
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-primary" />
                <span className="text-sm">Completados</span>
              </div>
              <Badge variant="secondary">256</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-chart-2" />
                <span className="text-sm">En proceso</span>
              </div>
              <Badge variant="secondary">89</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-destructive" />
                <span className="text-sm">Cancelados</span>
              </div>
              <Badge variant="destructive">39</Badge>
            </div>
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button size="sm" className="flex-1">
            Nuevo pedido
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            Ver todos
          </Button>
        </CardFooter>
      </Card>

      {/* Productos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Productos
          </CardTitle>
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Package className="size-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="font-heading text-3xl font-bold tracking-tight">
            1,234
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            productos activos en el catalogo
          </p>
          <Separator className="my-4" />
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Stock bajo</span>
              <Badge variant="destructive">18 items</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Usuarios activos</span>
              <div className="flex items-center gap-1.5">
                <Users className="size-3.5 text-primary" />
                <span className="font-semibold">2,847</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Rating promedio</span>
              <span className="font-semibold">4.8 / 5.0</span>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" className="w-full">
            Gestionar catalogo
            <ArrowUpRight className="ml-1 size-3" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
