import { useMemo, useState } from "react";
import { Phone, Search, Trash2, UserPlus, X, Pencil } from "lucide-react";
import {
  useClients,
  useOrders,
  formatMoney,
  orderTotal,
  uid,
  type Client,
} from "@/lib/tracker-storage";
import { ConfirmDialog } from "./ConfirmDialog";
import { useDialog } from "@/hooks/use-dialog";

export function ClientsView() {
  const [clients, setClients] = useClients();
  const [orders] = useOrders();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const order of orders) {
      if (order.status === "cancelled") continue;
      const keys = [order.clientId, normalize(order.clientName)].filter((key): key is string =>
        Boolean(key),
      );
      for (const key of keys) {
        const current = map.get(key) ?? { count: 0, total: 0 };
        current.count += 1;
        current.total += orderTotal(order);
        map.set(key, current);
      }
    }
    return map;
  }, [orders]);

  const visibleClients = useMemo(() => {
    const needle = normalize(query);
    return [...clients]
      .filter((client) => {
        if (!needle) return true;
        return normalize(`${client.name} ${client.phone ?? ""} ${client.note ?? ""}`).includes(
          needle,
        );
      })
      .sort((a, b) => getClientStats(stats, b).total - getClientStats(stats, a).total);
  }, [clients, query, stats]);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    setFormOpen(true);
  }

  function saveClient(value: Client) {
    setClients((previous) => {
      const exists = previous.some((client) => client.id === value.id);
      return exists
        ? previous.map((client) => (client.id === value.id ? value : client))
        : [value, ...previous];
    });
    setFormOpen(false);
    setEditing(null);
  }

  function requestRemove(client: Client) {
    setPendingDelete(client);
  }

  function confirmRemove() {
    if (!pendingDelete) return;
    setClients((previous) => previous.filter((client) => client.id !== pendingDelete.id));
    setPendingDelete(null);
  }

  return (
    <div className="pb-28">
      <div className="p-3 space-y-3">
        {clients.length > 0 && (
          <label className="relative block">
            <span className="sr-only">Поиск клиентов</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="input pl-10 pr-10"
              placeholder="Найти клиента или телефон"
              type="search"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 min-h-9 min-w-9 -translate-y-1/2 rounded-lg text-muted-foreground"
                aria-label="Очистить поиск"
              >
                <X className="mx-auto size-4" />
              </button>
            )}
          </label>
        )}

        {visibleClients.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto size-24 rounded-full stripe-tape opacity-40 mb-6" />
            <h3 className="font-display text-2xl uppercase mb-2">
              {clients.length === 0 ? "Нет клиентов" : "Ничего не найдено"}
            </h3>
            <p className="text-muted-foreground">
              {clients.length === 0
                ? "Клиенты добавляются автоматически при создании заказа."
                : "Попробуйте изменить запрос."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleClients.map((client) => {
              const clientStats = getClientStats(stats, client);
              return (
                <div key={client.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                    <div className="min-w-0">
                      <div className="font-display text-lg truncate">{client.name}</div>
                      {client.phone && (
                        <a
                          href={`tel:${client.phone}`}
                          className="inline-flex min-h-9 items-center gap-1 text-sm text-primary mt-0.5"
                        >
                          <Phone className="size-3.5" /> {client.phone}
                        </a>
                      )}
                      {client.note && (
                        <p className="text-sm text-muted-foreground mt-1">{client.note}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-lg text-primary leading-none">
                        {formatMoney(clientStats.total)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {clientStats.count}{" "}
                        {plural(clientStats.count, ["заказ", "заказа", "заказов"])}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      onClick={() => openEdit(client)}
                      className="min-h-9 text-xs text-primary inline-flex items-center gap-1"
                    >
                      <Pencil className="size-3" /> изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => requestRemove(client)}
                      className="min-h-9 text-xs text-muted-foreground inline-flex items-center gap-1"
                    >
                      <Trash2 className="size-3" /> удалить
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={openNew}
        className="fixed bottom-24 right-4 z-30 size-16 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center active:scale-95"
        aria-label="Новый клиент"
      >
        <UserPlus className="size-7" strokeWidth={2.5} />
      </button>

      {formOpen && (
        <ClientForm
          initial={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSave={saveClient}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Удалить клиента?"
          description={`${pendingDelete.name}. Заказы сохранятся, но карточку клиента восстановить будет нельзя.`}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmRemove}
        />
      )}
    </div>
  );
}

function ClientForm({
  initial,
  onClose,
  onSave,
}: {
  initial: Client | null;
  onClose: () => void;
  onSave: (client: Client) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  useDialog(true, onClose);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;
    onSave({
      id: initial?.id ?? uid(),
      name: cleanName,
      phone: phone.trim() || undefined,
      note: note.trim() || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      role="presentation"
    >
      <form
        onSubmit={submit}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-card border border-border p-4 space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-form-title"
      >
        <div className="flex items-center justify-between">
          <h2 id="client-form-title" className="font-display text-xl uppercase">
            {initial ? "Изменить клиента" : "Новый клиент"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-lg hover:bg-accent"
            aria-label="Закрыть"
          >
            <X className="mx-auto size-5" />
          </button>
        </div>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Имя *
          </span>
          <input
            required
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="input mt-1"
            placeholder="Имя клиента"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Телефон
          </span>
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="input mt-1"
            placeholder="+7 ..."
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Заметка
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="input mt-1 min-h-20"
            placeholder="Например, удобное время для звонка"
          />
        </label>
        <button
          type="submit"
          className="w-full min-h-12 py-3 rounded-xl bg-primary text-primary-foreground font-bold uppercase"
        >
          {initial ? "Сохранить" : "Добавить"}
        </button>
      </form>
    </div>
  );
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

function getClientStats(stats: Map<string, { count: number; total: number }>, client: Client) {
  return stats.get(client.id) ?? stats.get(normalize(client.name)) ?? { count: 0, total: 0 };
}

function plural(n: number, forms: [string, string, string]) {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}
