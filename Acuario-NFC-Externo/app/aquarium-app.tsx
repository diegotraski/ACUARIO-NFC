"use client";

import { FormEvent, useEffect, useState } from "react";

type ActionKey =
  | "feed"
  | "water"
  | "parameters"
  | "filter1"
  | "filter2"
  | "fertilizer";

type AquariumEvent = {
  id: number;
  action: ActionKey;
  details: Record<string, string | number>;
  createdAt: number;
};

type ActionDefinition = {
  key: ActionKey;
  icon: string;
  label: string;
  shortLabel: string;
  description: string;
  tone: string;
};

const actions: ActionDefinition[] = [
  {
    key: "feed",
    icon: "◒",
    label: "Alimentar",
    shortLabel: "Alimentar",
    description: "Registra la comida y evita duplicados.",
    tone: "coral",
  },
  {
    key: "parameters",
    icon: "⌁",
    label: "Medir parámetros",
    shortLabel: "Parámetros",
    description: "pH, temperatura, NO₂, NO₃, GH y KH.",
    tone: "violet",
  },
  {
    key: "water",
    icon: "◉",
    label: "Cambio de agua",
    shortLabel: "Cambio de agua",
    description: "Guarda el porcentaje renovado.",
    tone: "blue",
  },
  {
    key: "fertilizer",
    icon: "✦",
    label: "Añadir fertilizante",
    shortLabel: "Fertilizar",
    description: "Producto y dosis utilizados.",
    tone: "green",
  },
  {
    key: "filter1",
    icon: "Ⅰ",
    label: "Limpiar filtro 1",
    shortLabel: "Filtro 1",
    description: "Mantenimiento alternado de filtros.",
    tone: "cyan",
  },
  {
    key: "filter2",
    icon: "Ⅱ",
    label: "Limpiar filtro 2",
    shortLabel: "Filtro 2",
    description: "Mantenimiento alternado de filtros.",
    tone: "amber",
  },
];

const actionMap = Object.fromEntries(
  actions.map((action) => [action.key, action]),
) as Record<ActionKey, ActionDefinition>;

const DAY = 24 * 60 * 60 * 1000;

function isAction(value: string | null): value is ActionKey {
  return actions.some((item) => item.key === value);
}

function randomTankId() {
  const randomPart = Array.from({ length: 4 }, () =>
    Math.random().toString(36).slice(2, 10),
  ).join("-");
  return `tank-${Date.now().toString(36)}-${randomPart}`;
}

function timeAgo(timestamp: number | undefined, now: number) {
  if (!timestamp) return "Sin registros";
  if (!now) return "Ahora";
  const difference = now - timestamp;
  const minutes = Math.max(1, Math.floor(difference / 60000));
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} ${days === 1 ? "día" : "días"}`;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function dueLabel(timestamp: number | undefined, intervalDays: number, now: number) {
  if (!timestamp) return { label: "Pendiente", status: "due" };
  if (!now) return { label: "Calculando", status: "ok" };
  const daysLeft = Math.ceil((timestamp + intervalDays * DAY - now) / DAY);
  if (daysLeft < 0) {
    return { label: `${Math.abs(daysLeft)} d de retraso`, status: "due" };
  }
  if (daysLeft === 0) return { label: "Hoy", status: "soon" };
  return { label: `En ${daysLeft} d`, status: daysLeft <= 3 ? "soon" : "ok" };
}

function latest(events: AquariumEvent[], action: ActionKey) {
  return events.find((event) => event.action === action);
}

function historyDetail(event: AquariumEvent) {
  const d = event.details;
  if (event.action === "water") return `${d.percentage ?? 30}% renovado`;
  if (event.action === "parameters") {
    const values = [
      d.temperature && `${d.temperature} °C`,
      d.ph && `pH ${d.ph}`,
      d.no3 && `NO₃ ${d.no3}`,
      d.no2 && `NO₂ ${d.no2}`,
    ].filter(Boolean);
    return values.join(" · ") || "Medición guardada";
  }
  if (event.action === "fertilizer") {
    return [d.product, d.amount && `${d.amount} ml`].filter(Boolean).join(" · ") || "Dosis registrada";
  }
  if (event.action === "feed") return String(d.food || "Alimentación registrada");
  return "Mantenimiento completado";
}

export default function AquariumApp() {
  const [tankId, setTankId] = useState("");
  const [events, setEvents] = useState<AquariumEvent[]>([]);
  const [activeAction, setActiveAction] = useState<ActionKey | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [now, setNow] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingTank = params.get("tank");
    const storedTank = window.localStorage.getItem("aquarium-tank-id");
    const resolvedTank = incomingTank || storedTank || randomTankId();
    window.localStorage.setItem("aquarium-tank-id", resolvedTank);
    // The browser owns the per-aquarium key; it is intentionally hydrated after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTankId(resolvedTank);
    setNow(Date.now());

    const requestedAction = params.get("action");
    if (isAction(requestedAction)) setActiveAction(requestedAction);
  }, []);

  async function loadEvents(currentTank: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/events?tank=${encodeURIComponent(currentTank)}`);
      const data = (await response.json()) as { events?: AquariumEvent[]; error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo cargar el historial");
      setEvents(data.events || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Loading begins when the browser-resolved aquarium key becomes available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tankId) void loadEvents(tankId);
  }, [tankId]);

  const lastFeed = latest(events, "feed");
  const lastWater = latest(events, "water");
  const lastFilter1 = latest(events, "filter1");
  const lastFilter2 = latest(events, "filter2");
  const lastParameters = latest(events, "parameters");
  const waterDue = dueLabel(lastWater?.createdAt, 7, now);
  const filter1Due = dueLabel(lastFilter1?.createdAt, 30, now);
  const filter2Due = dueLabel(lastFilter2?.createdAt, 30, now);

  let warning = "";
  if (activeAction === "feed" && lastFeed && now - lastFeed.createdAt < 4 * 60 * 60 * 1000) {
    warning = `Ya registraste una alimentación ${timeAgo(lastFeed.createdAt, now).toLowerCase()}.`;
  } else if (activeAction === "filter1" && lastFilter2 && now - lastFilter2.createdAt < 7 * DAY) {
    warning = "El filtro 2 se limpió hace menos de 7 días. Conviene espaciar ambas limpiezas.";
  } else if (activeAction === "filter2" && lastFilter1 && now - lastFilter1.createdAt < 7 * DAY) {
    warning = "El filtro 1 se limpió hace menos de 7 días. Conviene espaciar ambas limpiezas.";
  }

  function openAction(action: ActionKey) {
    setActiveAction(action);
    setError("");
    const url = new URL(window.location.href);
    url.searchParams.set("tank", tankId);
    url.searchParams.set("action", action);
    window.history.replaceState({}, "", url);
  }

  function closeAction() {
    setActiveAction(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("action");
    window.history.replaceState({}, "", url);
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAction) return;
    setSaving(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const details: Record<string, string> = {};
    formData.forEach((value, key) => {
      const cleanValue = String(value).trim();
      if (cleanValue) details[key] = cleanValue;
    });

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tank: tankId, action: activeAction, details }),
      });
      const data = (await response.json()) as { event?: AquariumEvent; error?: string };
      if (!response.ok || !data.event) throw new Error(data.error || "No se pudo guardar");
      setEvents((current) => [data.event as AquariumEvent, ...current]);
      setNow(data.event.createdAt);
      closeAction();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink(action?: ActionKey) {
    const url = new URL(window.location.origin);
    url.searchParams.set("tank", tankId);
    if (action) url.searchParams.set("action", action);
    await navigator.clipboard.writeText(url.toString());
    const key = action || "dashboard";
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1400);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <div>
            <span className="eyebrow">AQUA LOG</span>
            <strong>Mi acuario</strong>
          </div>
        </div>
        <button className="icon-button" type="button" onClick={() => setShowSetup(true)} aria-label="Configurar etiquetas NFC">
          NFC
        </button>
      </header>

      <section className="hero-card">
        <div className="hero-copy">
          <span className="status-dot" />
          <p>Estado de hoy</p>
          <h1>{lastFeed ? "Todo bajo control" : "Empieza el registro"}</h1>
          <span>{lastFeed ? `Última alimentación ${timeAgo(lastFeed.createdAt, now).toLowerCase()}` : "Registra la primera alimentación para comenzar."}</span>
        </div>
        <div className="water-orbit" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="fish">›</span>
        </div>
      </section>

      {error && <div className="error-banner" role="alert">{error}</div>}

      <section className="snapshot" aria-label="Resumen del acuario">
        <article>
          <span className="snapshot-icon blue">◉</span>
          <div><small>Cambio de agua</small><strong>{waterDue.label}</strong></div>
        </article>
        <article>
          <span className="snapshot-icon violet">⌁</span>
          <div><small>Última medición</small><strong>{lastParameters ? timeAgo(lastParameters.createdAt, now) : "Pendiente"}</strong></div>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><span>REGISTRO RÁPIDO</span><h2>¿Qué has hecho?</h2></div>
          <small>Toca o escanea</small>
        </div>
        <div className="action-grid">
          {actions.map((action) => (
            <button key={action.key} className={`action-card ${action.tone}`} type="button" onClick={() => openAction(action.key)}>
              <span className="action-icon" aria-hidden="true">{action.icon}</span>
              <strong>{action.shortLabel}</strong>
              <small>{action.description}</small>
              <span className="action-arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block maintenance-block">
        <div className="section-heading">
          <div><span>PRÓXIMOS CUIDADOS</span><h2>Mantenimiento</h2></div>
        </div>
        <div className="maintenance-list">
          <MaintenanceRow title="Cambio de agua" subtitle={lastWater ? `Último ${timeAgo(lastWater.createdAt, now).toLowerCase()}` : "Aún sin registrar"} due={waterDue} tone="blue" />
          <MaintenanceRow title="Limpieza filtro 1" subtitle={lastFilter1 ? `Última ${timeAgo(lastFilter1.createdAt, now).toLowerCase()}` : "Aún sin registrar"} due={filter1Due} tone="cyan" />
          <MaintenanceRow title="Limpieza filtro 2" subtitle={lastFilter2 ? `Última ${timeAgo(lastFilter2.createdAt, now).toLowerCase()}` : "Aún sin registrar"} due={filter2Due} tone="amber" />
        </div>
      </section>

      <section className="section-block history-block">
        <div className="section-heading">
          <div><span>ACTIVIDAD</span><h2>Historial reciente</h2></div>
          {loading && <small>Actualizando…</small>}
        </div>
        <div className="history-list">
          {!loading && events.length === 0 && (
            <div className="empty-state"><span>＋</span><p>Tu historial aparecerá aquí al guardar la primera acción.</p></div>
          )}
          {events.slice(0, 8).map((item) => {
            const definition = actionMap[item.action];
            return (
              <article key={item.id} className="history-item">
                <span className={`history-icon ${definition.tone}`}>{definition.icon}</span>
                <div><strong>{definition.label}</strong><small>{historyDetail(item)}</small></div>
                <time>{formatDate(item.createdAt)}</time>
              </article>
            );
          })}
        </div>
      </section>

      <footer>
        <span className="brand-mark mini" aria-hidden="true"><i /></span>
        <p>Un registro sencillo para un acuario estable.</p>
      </footer>

      {activeAction && (
        <ActionSheet action={actionMap[activeAction]} warning={warning} saving={saving} error={error} onClose={closeAction} onSubmit={submitAction} />
      )}

      {showSetup && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setShowSetup(false)}>
          <section className="action-sheet setup-sheet" role="dialog" aria-modal="true" aria-labelledby="setup-title">
            <button className="close-button" type="button" onClick={() => setShowSetup(false)} aria-label="Cerrar">×</button>
            <span className="sheet-kicker">CONFIGURACIÓN NFC</span>
            <h2 id="setup-title">Enlaces para tus etiquetas</h2>
            <p className="sheet-intro">Copia cada enlace y grábalo en su NFC. Todos guardarán los datos en este mismo acuario.</p>
            <div className="link-list">
              <button type="button" onClick={() => copyLink()}><span><b>Panel general</b><small>Resumen e historial</small></span><em>{copied === "dashboard" ? "Copiado" : "Copiar"}</em></button>
              {actions.map((action) => (
                <button type="button" key={action.key} onClick={() => copyLink(action.key)}>
                  <span><b>{action.shortLabel}</b><small>Apertura directa</small></span><em>{copied === action.key ? "Copiado" : "Copiar"}</em>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function MaintenanceRow({ title, subtitle, due, tone }: { title: string; subtitle: string; due: { label: string; status: string }; tone: string }) {
  return (
    <article className="maintenance-row">
      <span className={`maintenance-bar ${tone}`} />
      <div><strong>{title}</strong><small>{subtitle}</small></div>
      <span className={`due-chip ${due.status}`}>{due.label}</span>
    </article>
  );
}

function ActionSheet({ action, warning, saving, error, onClose, onSubmit }: {
  action: ActionDefinition;
  warning: string;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="action-sheet" role="dialog" aria-modal="true" aria-labelledby="action-title">
        <button className="close-button" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        <span className={`sheet-icon ${action.tone}`}>{action.icon}</span>
        <span className="sheet-kicker">REGISTRO RÁPIDO</span>
        <h2 id="action-title">{action.label}</h2>
        <p className="sheet-intro">{action.description}</p>
        {warning && <div className="warning-box"><strong>Antes de continuar</strong><span>{warning}</span></div>}
        {error && <div className="inline-error">{error}</div>}
        <form onSubmit={onSubmit}>
          {action.key === "feed" && (
            <label>Tipo de comida<input name="food" placeholder="Escamas, granulado…" /></label>
          )}
          {action.key === "water" && (
            <label>Porcentaje de agua cambiado<div className="input-suffix"><input name="percentage" inputMode="decimal" defaultValue="30" required /><span>%</span></div></label>
          )}
          {action.key === "fertilizer" && (
            <div className="form-grid"><label>Producto<input name="product" placeholder="Nombre" /></label><label>Cantidad<div className="input-suffix"><input name="amount" inputMode="decimal" placeholder="2" /><span>ml</span></div></label></div>
          )}
          {action.key === "parameters" && (
            <div className="parameter-grid">
              <label>Temperatura<div className="input-suffix"><input name="temperature" inputMode="decimal" placeholder="24.5" /><span>°C</span></div></label>
              <label>pH<input name="ph" inputMode="decimal" placeholder="7.0" /></label>
              <label>NO₂<div className="input-suffix"><input name="no2" inputMode="decimal" placeholder="0" /><span>mg/L</span></div></label>
              <label>NO₃<div className="input-suffix"><input name="no3" inputMode="decimal" placeholder="10" /><span>mg/L</span></div></label>
              <label>GH<input name="gh" inputMode="numeric" placeholder="8" /></label>
              <label>KH<input name="kh" inputMode="numeric" placeholder="5" /></label>
            </div>
          )}
          <label>Nota opcional<textarea name="note" placeholder="Añade cualquier detalle…" rows={2} /></label>
          <button className="primary-button" disabled={saving} type="submit">{saving ? "Guardando…" : warning ? "Registrar de todas formas" : "Confirmar registro"}</button>
        </form>
      </section>
    </div>
  );
}
