import {
  configuration,
  insertEvent,
  latestFeedTimestamp,
  madridDay,
  madridTime,
  validTank,
} from "../_lib/aquarium";

export const dynamic = "force-dynamic";

const automaticActions = new Set(["feed", "water", "fertilizer", "filter1", "filter2"]);

const successMessages: Record<string, string> = {
  feed: "✅ Alimentación añadida.",
  water: "✅ Cambio de agua añadido.",
  fertilizer: "✅ Fertilización añadida.",
  filter1: "✅ Limpieza del filtro 1 añadida.",
  filter2: "✅ Limpieza del filtro 2 añadida.",
};

function message(text: string, status = 200) {
  return new Response(text, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function GET() {
  return message("Este enlace de automatización debe ejecutarse mediante una petición POST.", 405);
}

export async function POST(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const tank = params.get("tank");
    const action = params.get("action");

    if (!validTank(tank)) return message("No se reconoce este acuario.", 400);
    if (!action || !automaticActions.has(action)) {
      return message("Esta automatización no está disponible.", 400);
    }

    const { url, key } = configuration();
    const now = Date.now();

    if (action === "feed") {
      const lastFeed = await latestFeedTimestamp(tank, url, key);
      if (lastFeed && madridDay(lastFeed) === madridDay(now)) {
        return message(`⚠️ Ya se alimentó hoy a las ${madridTime(lastFeed)}.`);
      }
    }

    await insertEvent(tank, action, { source: "nfc" }, now, url, key);
    return message(successMessages[action]);
  } catch (error) {
    return message(
      `❌ ${error instanceof Error ? error.message : "No se pudo registrar la alimentación"}`,
      500,
    );
  }
}
