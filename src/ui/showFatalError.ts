/** Shows the readable fatal-error overlay and hides interactive game UI. */
export function showFatalError(message: string): void {
  for (const id of [
    'start-screen',
    'pause-screen',
    'harbor-screen',
    'result-screen',
    'hud',
    'touch-controls',
  ]) {
    document.getElementById(id)?.classList.add('is-hidden');
  }

  const overlay = document.getElementById('fatal-error');
  overlay?.classList.remove('is-hidden');

  const detail = document.getElementById('fatal-message');
  if (detail) detail.textContent = message;
}
