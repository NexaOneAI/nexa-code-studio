import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListUsers,
  adminListPurchases,
  adminListTransactions,
  adminStats,
} from "@/server/admin.functions";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { authedHeaders } from "@/lib/auth-headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, Users, CreditCard, Receipt, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Admin — Nexa One" }] }),
  component: AdminPage,
});

type Stats = { users: number; approved: number; pending: number; revenue: number; credits_sold: number };
type UserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
  balance: number;
  unlimited: boolean;
  roles: string[];
};
type PurchaseRow = {
  id: string;
  user_id: string;
  email: string | null;
  plan_name: string;
  credits: number;
  amount: number | string;
  currency: string;
  status: string;
  mercado_pago_payment_id: string | null;
  created_at: string;
  processed_at: string | null;
};
type TxRow = {
  id: string;
  user_id: string;
  email: string | null;
  amount: number;
  reason: string;
  created_at: string;
};

function toIsoOrNull(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function statusBadge(status: string) {
  const cls =
    status === "approved"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : status === "pending"
        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
        : "bg-destructive/15 text-destructive border-destructive/30";
  return <Badge variant="outline" className={cls}>{status}</Badge>;
}

function AdminPage() {
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const fnStats = useServerFn(adminStats);
  const fnUsers = useServerFn(adminListUsers);
  const fnPurchases = useServerFn(adminListPurchases);
  const fnTx = useServerFn(adminListTransactions);

  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filtros
  const [userSearch, setUserSearch] = useState("");
  const [email, setEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filters = useMemo(
    () => ({
      email: email.trim() || null,
      from: from ? toIsoOrNull(from) : null,
      to: to ? toIsoOrNull(to) : null,
    }),
    [email, from, to]
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const headers = await authedHeaders();
      const [s, u, p, t] = await Promise.all([
        fnStats({ headers, data: {} }),
        fnUsers({ headers, data: { search: userSearch.trim() || null } }),
        fnPurchases({ headers, data: filters }),
        fnTx({ headers, data: filters }),
      ]);
      setStats(s);
      setUsers(u.users as UserRow[]);
      setPurchases(p.purchases as PurchaseRow[]);
      setTransactions(t.transactions as TxRow[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error cargando datos";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (roleLoading) {
    return (
      <div className="p-10 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando permisos…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-10 max-w-xl mx-auto text-center">
        <Shield className="h-10 w-10 mx-auto text-destructive" />
        <h1 className="text-2xl font-bold mt-4">Acceso restringido</h1>
        <p className="text-muted-foreground mt-2">
          Solo los administradores pueden acceder a este panel.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/dashboard">Volver al dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7 text-[color:var(--neon-violet)]" />
            Panel de administración
          </h1>
          <p className="text-muted-foreground text-sm">
            Usuarios, compras y movimientos de créditos.
          </p>
        </div>
        <Button onClick={loadAll} disabled={loading} variant="outline">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Actualizar</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Usuarios" value={stats?.users ?? "—"} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Compras OK" value={stats?.approved ?? "—"} icon={<CreditCard className="h-4 w-4" />} />
        <StatCard label="Pendientes" value={stats?.pending ?? "—"} icon={<CreditCard className="h-4 w-4" />} />
        <StatCard
          label="Ingresos MXN"
          value={stats ? `$${Number(stats.revenue).toLocaleString("es-MX")}` : "—"}
          icon={<Receipt className="h-4 w-4" />}
        />
        <StatCard label="Créditos vendidos" value={stats?.credits_sold ?? "—"} icon={<Receipt className="h-4 w-4" />} />
      </div>

      {/* Filtros globales */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Email</Label>
            <Input
              placeholder="usuario@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Desde</Label>
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={loadAll} disabled={loading} className="w-full bg-gradient-primary border-0">
              Aplicar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="purchases">Compras</TabsTrigger>
          <TabsTrigger value="transactions">Transacciones</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Usuarios ({users.length})</CardTitle>
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar email o nombre…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-64"
                />
                <Button variant="outline" onClick={loadAll} disabled={loading}>
                  Buscar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="text-right">Créditos</TableHead>
                    <TableHead>Alta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                      <TableCell>{u.display_name ?? "—"}</TableCell>
                      <TableCell className="space-x-1">
                        {u.roles.length === 0 ? (
                          <Badge variant="outline">user</Badge>
                        ) : (
                          u.roles.map((r) => (
                            <Badge
                              key={r}
                              variant="outline"
                              className={
                                r === "admin"
                                  ? "border-[color:var(--neon-violet)]/40 text-[color:var(--neon-violet)]"
                                  : ""
                              }
                            >
                              {r}
                            </Badge>
                          ))
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {u.unlimited ? "∞" : u.balance}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleString("es-MX")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Sin usuarios.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">Compras ({purchases.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Créditos</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Payment ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">
                        {new Date(p.created_at).toLocaleString("es-MX")}
                      </TableCell>
                      <TableCell>{p.email ?? p.user_id.slice(0, 8)}</TableCell>
                      <TableCell>{p.plan_name}</TableCell>
                      <TableCell className="text-right font-mono">{p.credits}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${Number(p.amount).toLocaleString("es-MX")} {p.currency}
                      </TableCell>
                      <TableCell>{statusBadge(p.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.mercado_pago_payment_id ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {purchases.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Sin compras en el rango seleccionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base">Transacciones ({transactions.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Razón</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">
                        {new Date(t.created_at).toLocaleString("es-MX")}
                      </TableCell>
                      <TableCell>{t.email ?? t.user_id.slice(0, 8)}</TableCell>
                      <TableCell
                        className={`text-right font-mono ${
                          t.amount > 0
                            ? "text-emerald-400"
                            : t.amount < 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {t.amount > 0 ? `+${t.amount}` : t.amount}
                      </TableCell>
                      <TableCell className="text-sm">{t.reason}</TableCell>
                    </TableRow>
                  ))}
                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Sin transacciones en el rango seleccionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="glass-card neon-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider">
          <span>{label}</span>
          {icon}
        </div>
        <div className="text-2xl font-bold mt-1 text-gradient">{value}</div>
      </CardContent>
    </Card>
  );
}