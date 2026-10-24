import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { StatusBar, Style } from '@capacitor/status-bar';

const isNative = Capacitor.isNativePlatform();
const REST_NOTIFICATION_ID = 4242;

export async function initNative(onBack: () => boolean) {
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#000000' });
  } catch {
    /* not supported */
  }
  App.addListener('backButton', () => {
    if (!onBack()) App.minimizeApp();
  });
  try {
    await LocalNotifications.requestPermissions();
  } catch {
    /* ignore */
  }
}

export function tap() {
  if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

let audio: AudioContext | null = null;
function beep() {
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.22);
    });
  } catch {
    /* audio unavailable */
  }
}

export function restFinishedAlert(sound: boolean, vibrate: boolean) {
  if (sound) beep();
  if (vibrate) {
    if (isNative) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else navigator.vibrate?.([200, 100, 200]);
  }
}

/** Schedule a system notification so the rest timer still alerts when the app is in the background. */
export async function scheduleRestNotification(endsAt: number, exerciseName: string) {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_NOTIFICATION_ID,
          title: 'Rest complete',
          body: `Time for your next set of ${exerciseName}`,
          schedule: { at: new Date(endsAt), allowWhileIdle: true },
        },
      ],
    });
  } catch {
    /* permission denied */
  }
}

export async function cancelRestNotification() {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
  } catch {
    /* ignore */
  }
}

export function onAppStateChange(cb: (active: boolean) => void) {
  if (!isNative) return;
  App.addListener('appStateChange', ({ isActive }) => cb(isActive));
}
