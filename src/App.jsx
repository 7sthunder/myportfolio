import ParticleBackground from './components/ParticleBackground.jsx';
import ParticleHero from './components/ParticleHero.jsx';
import Journey from './components/Journey.jsx';

export default function App() {
  return (
    <ParticleBackground>
      <main className="pp-page">
        <ParticleHero />
        <Journey />
      </main>
    </ParticleBackground>
  );
}
