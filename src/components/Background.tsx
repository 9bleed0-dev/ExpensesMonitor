export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="blob absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-violet-600/30 blur-[110px] light:bg-violet-400/30" />
      <div className="blob absolute top-1/3 -right-40 h-[26rem] w-[26rem] rounded-full bg-cyan-500/20 blur-[110px] [animation-delay:-6s] light:bg-cyan-300/30" />
      <div className="blob absolute -bottom-40 left-1/4 h-[24rem] w-[24rem] rounded-full bg-fuchsia-600/20 blur-[120px] [animation-delay:-12s] light:bg-fuchsia-300/25" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,var(--bg)_75%)] opacity-60" />
    </div>
  )
}
