import { toPng } from "html-to-image";

export async function captureAndShareSeasonCard(
  node: HTMLElement,
  filename = "27-0-season.png"
): Promise<"shared" | "downloaded" | "failed"> {
  try {
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 1,
      backgroundColor: "#07120f",
    });

    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: "image/png" });

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      (!navigator.canShare || navigator.canShare({ files: [file] }))
    ) {
      try {
        await navigator.share({
          files: [file],
          title: "27-0 season",
          text: "My 27-0 season",
        });
        return "shared";
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return "failed";
      }
    }

    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
    return "downloaded";
  } catch {
    return "failed";
  }
}
