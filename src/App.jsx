import ParticleBackground from './components/ParticleBackground.jsx';
import ParticleHero from './components/ParticleHero.jsx';
import FeaturedWorks from './components/FeaturedWorks.jsx';

export default function App() {
  return (
    <ParticleBackground>
      <main className="pp-page">
        <ParticleHero />
        <FeaturedWorks />
      </main>
    </ParticleBackground>
  );
}
