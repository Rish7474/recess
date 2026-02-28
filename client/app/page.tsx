import Auth from "@/components/Auth";
import Lobby from "@/components/Lobby";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col animate-in fade-in duration-500">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-accent">RECESS</span>
          </h1>
          <p className="text-[11px] text-muted hidden sm:block">
            Daily 5-min multiplayer games at 6 PM EST
          </p>
        </div>
        <Auth />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <Lobby />
      </main>

      <footer className="text-center py-4 text-xs text-muted border-t border-border">
        Every day at 6:00 PM EST. 5 minutes. One shot.
      </footer>
    </div>
  );
}
