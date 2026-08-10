import { Banknote, Gauge, MousePointerClick, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ClientBusinessInput } from "@/lib/report";

interface BusinessInputFieldsProps {
  value: ClientBusinessInput;
  onChange: (value: ClientBusinessInput) => void;
}

function toNumber(raw: string): number | undefined {
  const cleaned = raw.trim().replace(",", ".");
  if (cleaned === "") {
    return undefined;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function percentToFraction(percent: string): number | undefined {
  const cleaned = percent.trim().replace(",", ".");
  if (cleaned === "") {
    return undefined;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed / 100 : undefined;
}

export function BusinessInputFields({
  value,
  onChange,
}: BusinessInputFieldsProps) {
  const patch = (update: Partial<ClientBusinessInput>): void => {
    onChange({ ...value, ...update });
  };

  const conversionPercent =
    value.organicConversionRate !== undefined
      ? String(value.organicConversionRate * 100)
      : "";

  return (
    <fieldset className="flex flex-col gap-3 border-l-2 border-primary bg-muted/25 p-4">
      <legend className="px-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Dados da operação (opcional)
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Wallet className="size-3.5" />
            Ticket médio (R$)
          </span>
          <Input
            type="number"
            min={1}
            step="any"
            placeholder="500"
            value={value.avgTicket ?? ""}
            onChange={(event) =>
              patch({ avgTicket: toNumber(event.target.value) })
            }
            aria-label="Ticket médio em reais"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <MousePointerClick className="size-3.5" />
            Conversão orgânica (%)
          </span>
          <Input
            type="number"
            min={0}
            max={100}
            step="any"
            placeholder="2"
            value={conversionPercent}
            onChange={(event) =>
              patch({ organicConversionRate: percentToFraction(event.target.value) })
            }
            aria-label="Conversão orgânica em porcentagem"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Gauge className="size-3.5" />
            Sessões orgânicas/mês
          </span>
          <Input
            type="number"
            min={1}
            step="any"
            placeholder="10000"
            value={value.monthlyOrganicSessions ?? ""}
            onChange={(event) =>
              patch({ monthlyOrganicSessions: toNumber(event.target.value) })
            }
            aria-label="Sessões orgânicas por mês"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Banknote className="size-3.5" />
            Custo de mão de obra/hora (R$)
          </span>
          <Input
            type="number"
            min={1}
            step="any"
            placeholder="60"
            value={value.laborCostPerHour ?? ""}
            onChange={(event) =>
              patch({ laborCostPerHour: toNumber(event.target.value) })
            }
            aria-label="Custo da mão de obra por hora"
          />
        </label>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Opcional. Quando informados, tráfego e receita incrementais são ancorados
        no volume real da operação e o custo evitado considera sua mão de obra.
      </p>
    </fieldset>
  );
}
