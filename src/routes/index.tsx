import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, ClipboardList, Settings, Users, Wallet } from "lucide-react";
import { OrdersView } from "@/components/tracker/OrdersView";
import { CalendarView } from "@/components/tracker/CalendarView";
import { ClientsView } from "@/components/tracker/ClientsView";
import { EarningsView } from "@/components/tracker/EarningsView";
import { SettingsView } from "@/components/tracker/SettingsView";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Смена — учёт заказов экскаватора-погрузчика" },
      {
        name: "description",
        content:
          "Мобильное приложение для оператора экскаватора-погрузчика: заказы, клиенты, планирование и учёт заработка.",
      },
      { property: "og:title", content: "Смена — учёт заказов" },
      {
        property: "og:description",
        content:
          "Заказы, клиенты, планирование и заработок оператора спецтехники в одном приложении.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

type Tab = "orders" | "clients" | "money";

function App() {
  const [tab, setTab] = useState<Tab>("orders");

  return (
    <div className="min-h-screen bg-background text-foreground max-w-2xl mx-auto">
      <header className="px-4 pt-6 pb-3 flex items-center gap-3">
        <div className="size-10 rounded-xl bg-primary text-primary-foreground grid place-items-center font-display font-bold text-lg">
          С
        </div>
        <div>
          <div className="font-display text-2xl uppercase leading-none">Смена</div>
          <div className="text-xs text-muted-foreground">
            {tabLabel(tab)}
          </div>
        </div>
      </header>

      <main>
        {tab === "orders" && <OrdersView />}
        {tab === "clients" && <ClientsView />}
        {tab === "money" && <EarningsView />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border">
        <div className="max-w-2xl mx-auto grid grid-cols-3">
          <TabButton
            active={tab === "orders"}
            onClick={() => setTab("orders")}
            icon={ClipboardList}
            label="Заказы"
          />
          <TabButton
            active={tab === "clients"}
            onClick={() => setTab("clients")}
            icon={Users}
            label="Клиенты"
          />
          <TabButton
            active={tab === "money"}
            onClick={() => setTab("money")}
            icon={Wallet}
            label="Доход"
          />
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>

      <style>{`
        .input {
          width: 100%;
          background-color: var(--color-input);
          color: var(--color-foreground);
          border: 1px solid var(--color-border);
          border-radius: 0.75rem;
          padding: 0.75rem 0.875rem;
          font-size: 1rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input:focus {
          border-color: var(--color-ring);
        }
      `}</style>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ClipboardList;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-3 flex flex-col items-center gap-1 transition ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className="size-6" strokeWidth={active ? 2.5 : 2} />
      <span className={`text-[11px] font-semibold uppercase tracking-wider`}>{label}</span>
    </button>
  );
}

function tabLabel(t: Tab) {
  return t === "orders" ? "Заказы и планирование" : t === "clients" ? "База клиентов" : "Учёт заработка";
}
