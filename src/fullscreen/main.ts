import QRCode from 'qrcode';
import { consumeFullscreenQr, type FullscreenQrSession } from '../browser/fullscreen-qr';
import { QR_ERROR_CORRECTION_LEVEL } from '../domain/payload';
import './styles.css';

const rootElement = document.querySelector<HTMLElement>('#fullscreen-app');
if (!rootElement) throw new Error('Fullscreen QR root is missing');
const root: HTMLElement = rootElement;

let session: FullscreenQrSession | null = null;

function qrSize(): number {
  return Math.max(280, Math.floor(Math.min(window.innerWidth - 80, window.innerHeight - 150, 1400)));
}

async function draw(): Promise<void> {
  if (!session) return;
  const canvas = root.querySelector<HTMLCanvasElement>('#fullscreen-qr');
  if (!canvas) return;
  await QRCode.toCanvas(canvas, session.text, {
    width: qrSize(),
    margin: 0,
    errorCorrectionLevel: QR_ERROR_CORRECTION_LEVEL,
    color: { dark: '#102a2b', light: '#fffdf6' },
  });
}

async function start(): Promise<void> {
  session = await consumeFullscreenQr(window.location.hash);
  if (!session) {
    root.innerHTML = '<section class="fullscreen-error"><h1>二维码已失效</h1><p>请返回插件重新打开全屏显示。</p></section>';
    return;
  }
  root.innerHTML = '<section class="fullscreen-qr"><canvas id="fullscreen-qr" aria-label="Pocket Qt 站点导入二维码"></canvas><strong></strong><p>二维码包含当前站点登录凭据，请勿截图或分享。</p></section>';
  const siteName = root.querySelector<HTMLElement>('strong');
  if (siteName) siteName.textContent = session.siteName;
  await draw();
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => { void draw(); }, 100);
});

void start();
