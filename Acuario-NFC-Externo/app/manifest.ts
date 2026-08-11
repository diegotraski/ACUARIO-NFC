import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Acuario NFC",
    short_name: "Acuario",
    description: "Registro y mantenimiento inteligente para tu acuario.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f4",
    theme_color: "#0d3033",
    lang: "es",
  };
}
