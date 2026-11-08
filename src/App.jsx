import { Navigate, Route, Routes } from 'react-router-dom';
import CaseStudy from './components/CaseStudy.jsx';
import ParticleBackground from './components/ParticleBackground.jsx';
import ParticleHero from './components/ParticleHero.jsx';
import Journey from './components/Journey.jsx';

function Home() {
  return (
    <ParticleBackground>
      <main className="pp-page">
        <ParticleHero />
        <Journey />
      </main>
    </ParticleBackground>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/projects/:slug" element={<CaseStudy />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
