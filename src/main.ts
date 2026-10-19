import './styles/main.css';
import { Game } from './game/Game';
import { WebPlatform } from './platform/web/WebPlatform';
import { showFatalError } from './ui/showFatalError';

const canvas = document.getElementById('game-canvas');

try {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('找不到游戏画布 #game-canvas。');
  }

  const platform = new WebPlatform();
  const game = new Game(canvas, platform);
  game.start();

  window.addEventListener(
    'beforeunload',
    () => {
      game.dispose();
    },
    { once: true },
  );
} catch (error) {
  console.error('[Age of Wind Web] 初始化失败', error);
  showFatalError(
    error instanceof Error
      ? error.message
      : '游戏初始化失败。请刷新页面后重试。',
  );
}
