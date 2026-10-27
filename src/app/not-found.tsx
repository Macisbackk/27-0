import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { GameButton } from "@/components/ui/GameButton";

export default function NotFound() {
  return (
    <StandardPageShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-3xl font-black text-white">Knocked on</h1>
        <p className="text-pitch-300">
          That page doesn&apos;t exist.
===
        </p>
        <GameButton href="/" fullWidth={false}>
          Back to home
        </GameButton>
      </div>
    </StandardPageShell>
  );
}
