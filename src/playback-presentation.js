export function playbackPresentation(alive, paused) {
  const ended = alive === 0;
  return {
    ended,
    paused: ended || paused,
    pauseDisabled: ended,
    stepDisabled: ended,
    resetDisabled: false,
    pauseLabel: ended ? "Town ended" : paused ? "Resume" : "Pause",
    clockSuffix: ended ? " · Town ended" : "",
  };
}
