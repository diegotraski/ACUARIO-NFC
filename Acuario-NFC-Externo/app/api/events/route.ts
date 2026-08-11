import {
  configuration,
  DatabaseRow,
  headers,
  insertEvent,
  latestFeedTimestamp,
  madridDay,
  madridTime,
  validActions,
  validTank,
} from "../_lib/aquarium";

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
    const tank = payload.tank || null;
    const action = payload.action;
    if (!validTank(tank)) {
      return Response.json({ error: "Identificador de acuario no válido" }, { status: 400 });
    }
    if (!action || !validActions.has(action)) {
      return Response.json({ error: "Acción no válida" }, { status: 400 });
    }

    const details = payload.details && typeof payload.details === "object" ? payload.details : {};
    if (JSON.stringify(details).length > 4000) {
      return Response.json({ error: "El registro contiene demasiada información" }, { status: 400 });
    }

    const { url, key } = configuration();
    const createdAt = Date.now();

    if (action === "feed") {
      const lastFeed = await latestFeedTimestamp(tank, url, key);
      if (lastFeed && madridDay(lastFeed) === madridDay(createdAt)) {
        return Response.json(
          { error: `Los peces ya fueron alimentados hoy a las ${madridTime(lastFeed)}.` },
          { status: 409 },
        );
      }
    }

    const id = await insertEvent(tank, action, details, createdAt, url, key);

    return Response.json(
      { event: { id, action, details, createdAt } },
      { status: 201 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "No se pudo guardar el registro" },
      { status: 500 },
    );
  }
}
