import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getApiConfig,
  storeApiKey,
  storedApiKey,
  verifyApiKey,
} from "@/lib/api";

interface ApiAccessGateProps {
  children: ReactNode;
}

type GateState = "checking" | "locked" | "authorized" | "unavailable";

export function ApiAccessGate({ children }: ApiAccessGateProps) {
  const [state, setState] = useState<GateState>("checking");
  const [key, setKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkConfiguration = async (): Promise<void> => {
    setState("checking");
    setError(null);
    try {
      const config = await getApiConfig();
      if (!config.requiresApiKey) {
        setState("authorized");
        return;
      }
      const existing = storedApiKey();
      if (existing && await verifyApiKey(existing)) {
        setState("authorized");
        return;
      }
      storeApiKey("");
      setState("locked");
    } catch {
      setState("unavailable");
    }
  };

  useEffect(() => {
    void checkConfiguration();
  }, []);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!key.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (!await verifyApiKey(key)) {
        setError("Chave inválida.");
        return;
      }
      storeApiKey(key);
      setState("authorized");
    } catch {
      setError("Não foi possível validar a chave.");
    } finally {
      setSubmitting(false);
    }
  };

  if (state === "authorized") return children;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {state === "checking" ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
          </span>
          <CardTitle>Acesso à análise</CardTitle>
        </CardHeader>
        <CardContent>
          {state === "checking" ? (
            <p className="text-sm text-muted-foreground">Verificando a API…</p>
          ) : state === "unavailable" ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">A API não está disponível.</p>
              <Button type="button" variant="outline" onClick={() => void checkConfiguration()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <form className="space-y-3" onSubmit={(event) => void submit(event)}>
              <p className="text-sm text-muted-foreground">
                Informe a chave fornecida pelo administrador desta instalação.
              </p>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input
                  type="password"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  className="pl-9"
                  aria-label="Chave de acesso à API"
                  autoComplete="current-password"
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={!key.trim() || submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : null}
                Entrar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
