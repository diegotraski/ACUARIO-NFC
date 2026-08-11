const validActions = new Set(["feed", "water", "parameters", "filter1", "filter2", "fertilizer"]);
const tankPattern = /^[a-zA-Z0-9-]{20,64}$/;

type DatabaseRow = {
  id: number;
  action: string;
  details: Record<string, unknown>;
  created_at: number;
};

function validTank(tank: string | null): tank is string {
  return Boolean(tank && tankPattern.test(tank));
}

function configuration() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta conectar la base de datos Supabase.");
  return { url, key };
}

function headers(key: string, prefer?: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

export async function GET(request: Request) {
  try {
    const tank = new URL(request.url).searchParams.get("tank");
    if (!validTank(tank)) {
      return Response.json({ error: "Identificador de acuario no válido" }, { status: 400 });
    }

    const { url, key } = configuration();
    const endpoint = new URL(`${url}/rest/v1/aquarium_events`);
    endpoint.searchParams.set("select", "id,action,details,created_at");
    endpoint.searchParams.set("tank_id", `eq.${tank}`);
    endpoint.searchParams.set("order", "created_at.desc,id.desc");
    endpoint.searchParams.set("limit", "100");

    const response = await fetch(endpoint, { headers: headers(key), cache: "no-store" });
    const rows = (await response.json()) as DatabaseRow[] | { message?: string };
    if (!response.ok || !Array.isArray(rows)) {
      throw new Error(!Array.isArray(rows) && rows.message ? rows.message : "No se pudo cargar el historial");
    }

    return Response.json({
      events: rows.map((row) => ({
        id: row.id,
        action: row.action,
        details: row.details || {},
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el historial" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      tank?: string;
      action?: string;
      details?: Record<string, unknown>;
    };
    if (!validTank(payload.tank || null)) {
      return Response.json({ error: "Identificador de acuario no válido" }, { status: 400 });
    }
    if (!payload.action || !validActions.has(payload.action)) {
      return Response.json({ error: "Acción no válida" }, { status: 400 });
    }

    const details = payload.details && typeof payload.details === "object" ? payload.details : {};
    if (JSON.stringify(details).length > 4000) {
      return Response.json({ error: "El registro contiene demasiada información" }, { status: 400 });
    }

    const { url, key } = configuration();
    const createdAt = Date.now();
    const response = await fetch(`${url}/rest/v1/aquarium_events?select=id`, {
      method: "POST",
      headers: headers(key, "return=representation"),
      body: JSON.stringify({
        tank_id: payload.tank,
        action: payload.action,
        details,
        created_at: createdAt,
      }),
      cache: "no-store",
    });
    const rows = (await response.json()) as Array<{ id: number }> | { message?: string };
    if (!response.ok || !Array.isArray(rows)) {
      throw new Error(!Array.isArray(rows) && rows.message ? rows.message : "No se pudo guardar el registro");
    }

    return Response.json(
      { event: { id: rows[0]?.id ?? createdAt, action: payload.action, details, createdAt } },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el registro" },
      { status: 500 },
    );
  }
}
