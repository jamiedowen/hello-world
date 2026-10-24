import { useEffect } from 'react';
import { Icon } from './components/Icon';
import { fmtClock } from './lib/format';
import { cancelRestNotification, initNative, onAppStateChange, restFinishedAlert, scheduleRestNotification } from './lib/native';
import { handleBack, push, setTab, useNav, type Route, type Tab } from './lib/nav';
import { getState, useStore } from './lib/store';
import { useNow } from './lib/useNow';
import { stopRest } from './lib/workout';
import { ActiveWorkoutScreen } from './screens/ActiveWorkout';
import { CreateExerciseScreen, ExerciseDetailScreen, ExercisesTab } from './screens/Exercises';
import { FinishWorkoutScreen } from './screens/FinishWorkout';
import { HomeScreen } from './screens/Home';
import { ProfileScreen, SettingsScreen } from './screens/Profile';
import { RoutineEditorScreen } from './screens/RoutineEditor';
import { WorkoutDetailScreen } from './screens/WorkoutDetail';
import { WorkoutTab } from './screens/WorkoutTab';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'workout', label: 'Workout', icon: 'dumbbell' },
  { id: 'exercises', label: 'Exercises', icon: 'list' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

function renderRoute(r: Route) {
  switch (r.name) {
    case 'active':
      return <ActiveWorkoutScreen />;
    case 'finish':
      return <FinishWorkoutScreen />;
    case 'workout':
      return <WorkoutDetailScreen id={r.id} fresh={r.fresh} />;
    case 'exercise':
      return <ExerciseDetailScreen id={r.id} />;
    case 'routine':
      return <RoutineEditorScreen id={r.id} />;
    case 'settings':
      return <SettingsScreen />;
    case 'createExercise':
      return <CreateExerciseScreen />;
  }
}

/** Watches the rest timer and fires the alert when it reaches zero. */
function useRestWatcher() {
  const rest = useStore((s) => s.rest);
  useEffect(() => {
    if (!rest) return;
    const ms = rest.endsAt - Date.now();
    const t = setTimeout(() => {
      const { settings } = getState();
      restFinishedAlert(settings.restSound, settings.restVibrate);
      stopRest();
    }, Math.max(0, ms));
    return () => clearTimeout(t);
  }, [rest]);
}

export default function App() {
  const { tab, stack } = useNav();
  const active = useStore((s) => s.active);
  const rest = useStore((s) => s.rest);
  const onActive = stack.some((r) => r.name === 'active' || r.name === 'finish');
  const now = useNow(1000, !!active && !onActive);
  useRestWatcher();

  useEffect(() => {
    initNative(handleBack);
    // Only use a system notification while the app is backgrounded; in the foreground the in-app alert fires.
    onAppStateChange((isActive) => {
      const r = getState().rest;
      if (isActive) cancelRestNotification();
      else if (r && r.endsAt > Date.now()) scheduleRestNotification(r.endsAt, r.exerciseName);
    });
  }, []);

  return (
    <div className="app">
      <div className="main-area">
        {tab === 'home' && <HomeScreen />}
        {tab === 'workout' && <WorkoutTab />}
        {tab === 'exercises' && <ExercisesTab />}
        {tab === 'profile' && <ProfileScreen />}
        {stack.map((r, i) => (
          <div key={i} className="screen pushed" style={{ zIndex: 50 + i }}>
            {renderRoute(r)}
          </div>
        ))}
      </div>

      {active && !onActive && (
        <button className="mini-bar" onClick={() => push({ name: 'active' })}>
          <span className="pulse" />
          <div className="grow" style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600 }} className="ellipsis">
              {active.title}
            </div>
            <div className="small muted">
              Workout in progress · {fmtClock((now - active.startedAt) / 1000)}
              {rest ? ` · Rest ${fmtClock((rest.endsAt - now) / 1000)}` : ''}
            </div>
          </div>
          <span className="link">Resume</span>
        </button>
      )}

      {!onActive && (
        <nav className="tabbar">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id && stack.length === 0 ? 'active' : ''} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={24} />
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
