export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-2 font-extrabold tracking-tight">
      <img src="/favicon.svg" alt="" width={24} height={24} />
      <span className={compact ? "hidden sm:inline" : undefined}>FounderHub</span>
    </span>
  );
}
