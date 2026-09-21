import React, { useState, useEffect } from 'react';
import HeroEntrance from './components/HeroEntrance';
import MissionControl from './components/MissionControl';
import ScenarioEditorModal from './components/ScenarioEditorModal';
import { fetchScenarios, createSession } from './api/client';

export default function App() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('hero'); // 'hero' | 'mission_control'
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorBaseScenarioId, setEditorBaseScenarioId] = useState('P01_intro');
  const [appError, setAppError] = useState('');

  const loadScenariosList = async () => {
    try {
      const data = await fetchScenarios();
      setScenarios(data);
      if (data.length > 0 && !editorBaseScenarioId) {
        setEditorBaseScenarioId(data[0].id);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setAppError('Не удалось загрузить сценарии. Проверьте локальный контур и обновите страницу.');
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScenariosList();
  }, []);

  const handleLaunchSession = async ({ scenarioId, goal, algorithm, autoPrune }) => {
    try {
      setAppError('');
      const res = await createSession(scenarioId, goal, algorithm, autoPrune);
      setActiveSessionId(res.session_id);
      setCurrentView('mission_control');
    } catch (err) {
      setAppError(`Не удалось открыть смену: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="mission-loading">
        <span className="mission-loading__mark">V</span>
        <p>Подключаем сценарии смены…</p>
      </div>
    );
  }

  return (
    <div>
      {currentView === 'hero' && (
        <HeroEntrance
          scenarios={scenarios}
          onLaunch={handleLaunchSession}
          onOpenEditor={() => setShowEditor(true)}
        />
      )}

      {currentView === 'mission_control' && activeSessionId && (
        <MissionControl
          sessionId={activeSessionId}
          onBackToHero={() => setCurrentView('hero')}
        />
      )}

      {showEditor && (
        <ScenarioEditorModal
          baseScenarioId={editorBaseScenarioId || 'P01_intro'}
          onClose={() => setShowEditor(false)}
          onCreated={(newId) => {
            loadScenariosList();
            setEditorBaseScenarioId(newId);
          }}
        />
      )}

      {appError && (
        <div className="status-toast" role="alert">
          <span>{appError}</span>
          <button type="button" onClick={() => setAppError('')} aria-label="Закрыть сообщение">×</button>
        </div>
      )}
    </div>
  );
}
