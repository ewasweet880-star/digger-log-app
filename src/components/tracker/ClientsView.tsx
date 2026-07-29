import { useMemo, useState } from "react";
import { useClients, useOrders, formatMoney, orderTotal, uid } from "@/lib/tracker-storage";
import { Phone, Trash2, UserPlus, X } from "lucide-react";

export function ClientsView() {
  const [clients, setClients] = useClients();
  const [orders] = useOrders();
  const [adding, setAdding] = useState(false);

  const stats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const o of orders) {
      const key = o.clientId ?? o.clientName;
      const cur = map.get(key) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += orderTotal(o);
      map.set(key, cur);
    }
    return map;
  }, [orders]);

  const sorted = [...clients].sort((a, b) => {
    const sa = stats.get(a.id)?.total ?? 0;
    const sb = stats.get(b.id)?.total ?? 0;
    return sb - sa;
  });

  function remove(id: string) {
    if (!confirm("Удалить клиента? Заказы сохранятся.")) return;
    setClients((p) => p.filter((c) => c.id !== id));
  }

  return (
    <div className="pb-28">
      <div className="p-3">
        {sorted.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto size-24 rounded-full stripe-tape opacity-40 mb-6" />
            <h3 className="font-display text-2xl uppercase mb-2">Нет клиентов</h3>
            <p className="text-muted-foreground">
              Клиенты добавляются автоматически при создании заказа.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((c) => {
              const s = stats.get(c.id) ?? { count: 0, total: 0 };
              return (
                <div
                  key={c.id}
                  className="bg-card border border-border rounded-2xl p-4"
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                    <div className="min-w-0">
                      <div className="font-display text-lg truncate">{c.name}</div>
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="inline-flex items-center gap-1 text-sm text-primary mt-0.5"
                        >
                          <Phone className="size-3.5" /> {c.phone}
                        </a>
                      )}
                      {c.note && (
                        <p className="text-sm text-muted-foreground mt-1">{c.note}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-lg text-primary leading-none">
                        {formatMoney(s.total)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {s.count} {plural(s.count, ["заказ", "заказа", "заказов"])}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(c.id)}
                    className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1"
                  >
                    <Trash2 className="size-3" /> удалить
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => setAdding(true)}
        className="fixed bottom-24 right-4 z-30 size-16 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center active:scale-95"
        aria-label="Новый клиент"
      >
        <UserPlus className="size-7" strokeWidth={2.5} />
      </button>

      {adding && <AddClient onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddClient({ onClose }: { onClose: () => void }) {
  const [, setClients] = useClients();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setClients((prev) => [
      ...prev,
      {
        id: uid(),
        name: name.trim(),
        phone: phone || undefined,
        note: note || undefined,
        createdAt: new Date().toISOString(),
      },
    ]);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <form
        onSubmit={submit}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-card border border-border p-4 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl uppercase">Новый клиент</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-accent">
            <X className="size-5" />
          </button>
        </div>
        <input
          required
          autoFocus
          placeholder="Имя *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
        />
        <input
          type="tel"
          placeholder="Телефон"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="input"
        />
        <textarea
          placeholder="Заметка"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input min-h-20"
        />
        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold uppercase"
        >
          Добавить
        </button>
      </form>
    </div>
  );
}

function plural(n: number, forms: [string, string, string]) {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}
