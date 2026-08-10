import { createContext, useContext, useMemo, useState } from "react";

interface AgentCommand {
  id: string;
  prompt: string;
}

interface AgentCommandContextValue {
  command: AgentCommand | null;
  ask: (prompt: string) => void;
  clear: (id: string) => void;
}

const STANDALONE_CONTEXT: AgentCommandContextValue = {
  command: null,
  ask: () => {},
  clear: () => {},
};

const AgentCommandContext = createContext<AgentCommandContextValue>(STANDALONE_CONTEXT);

export function AgentCommandProvider({ children }: { children: React.ReactNode }) {
  const [command, setCommand] = useState<AgentCommand | null>(null);
  const value = useMemo<AgentCommandContextValue>(() => ({
    command,
    ask: (prompt) => {
      setCommand({ id: crypto.randomUUID(), prompt });
      document.querySelector('[aria-label="Assistente de comércio"]')?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    clear: (id) => setCommand((current) => current?.id === id ? null : current),
  }), [command]);

  return <AgentCommandContext.Provider value={value}>{children}</AgentCommandContext.Provider>;
}

// The hook lives beside its provider so the command contract has one owner.
// eslint-disable-next-line react-refresh/only-export-components
export function useAgentCommand(): AgentCommandContextValue {
  return useContext(AgentCommandContext);
}
