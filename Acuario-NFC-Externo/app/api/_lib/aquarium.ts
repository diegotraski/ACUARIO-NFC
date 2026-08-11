export const validActions = new Set(["feed", "water", "parameters", "filter1", "filter2", "fertilizer"]);

const tankPattern = /^[a-zA-Z0-9-]{20,64}$/;

export type DatabaseRow = {
  id: number;
  action: string;
  details: Record<string, unknown>;
  created_at: number;
};

export function validTank(tank: string | null): tank is string {
  return Boolean(tank && tankPattern.test(tank));
}

export function configuration() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta conectar la base de datos Supabase.");
  return { url, key };
}

export function headers(key: string, prefer?: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

export function madridDay(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

export function madridTime(timestamp: number) {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export async function latestFeedTimestamp(tank: string, url: string, key: string) {
  const endpoint = new URL(`${url}/rest/v1/aquarium_events`);
  endpoint.searchParams.set("select", "created_at");
  endpoint.searchParams.set("tank_id", `eq.${tank}`);
  endpoint.searchParams.set("action", "eq.feed");
  endpoint.searchParams.set("order", "created_at.desc,id.desc");
  endpoint.searchParams.set("limit", "1");

  const response = await fetch(endpoint, {
    headers: headers(key),
    cache: "no-store",
  });
  const rows = (await response.json()) as Array<{ created_at: number }> | { message?: string };
  if (!response.ok || !Array.isArray(rows)) {
    throw new Error(!Array.isArray(rows) && rows.message ? rows.message : "No se pudo comprobar la última alimentación");
  }
  return rows[0]?.created_at;
}

export async function insertEvent(
  tank: string,
  action: string,
  details: Record<string, unknown>,
  createdAt: number,
  url: string,
  key: string,
) {
  const response = await fetch(`${url}/rest/v1/aquarium_events?select=id`, {
    method: "POST",
    headers: headers(key, "return=representation"),
    body: JSON.stringify({
      tank_id: tank,
      action,
      details,
      created_at: createdAt,
    }),
    cache: "no-store",
  });
  const rows = (await response.json()) as Array<{ id: number }> | { message?: string };
  if (!response.ok || !Array.isArray(rows)) {
    throw new Error(!Array.isArray(rows) && rows.message ? rows.message : "No se pudo guardar el registro");
  }
  return rows[0]?.id ?? createdAt;
}
