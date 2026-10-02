import flag from '../assets/flag-orpheus-top.png'
import { ChevronDown } from 'lucide-react'
import { ReactLenis } from 'lenis/react'
import { useEffect, useState } from 'react'
import '../App.css'
import Footer from '../components/Footer'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth.js'

const steps = [
  { title: "Design", text: "Design your hardware project — pick a motor-powered idea and plan how it'll work." },
  { title: "Build", text: "Get a grant to pay for the parts, then build your design into something real." },
  { title: "Revise", text: "Test what you built and make any revisions it needs to work better." },
  { title: "Ship", text: "Ship a finished, working project and unlock more prizes in the shop." },
]

const faq = [
  { question: "What is Torque?", answer: "Torque is a program where you build hardware projects with motors, and get funding and prizes for your projects." },
  { question: "Who can participate?", answer: "You have to be a teen, ages 13–18." },
  { question: "Can I join if I'm a beginner?", answer: "Yes! You don't need prior hardware experience to join. We have guides and a helpful community." },
  { question: "Is this free?", answer: "Yes, Torque is completely free to join." },
  { question: "What is Hack Club?", answer: "Hack Club is a 501(c)(3) nonprofit and network of 100k+ technical high schoolers who believe you learn best by building." },
  { question: "How many projects can I build?", answer: "There's no limit to the number of projects you can build! We encourage you to explore your creativity and build as many projects as you want." },
]

export default function Home() {

  const [hideArrow, setHideArrow] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const { session, signIn } = useAuth();
  const navigate = useNavigate();

  const handleLogIn = () => {
    if (session) navigate('/home');
    else signIn('/home');
  };

  useEffect(() => {
    const handleScroll = () => {
      setHideArrow(window.scrollY >= 5);
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="t-landing">
      <title>Torque</title>
      <ReactLenis root/>
      <div className="t-bg fixed inset-0 z-0" />
      <div className="fixed inset-0 z-0 bg-black opacity-(--overlay) transition-opacity duration-300" />

      <a
        href="https://hackclub.com"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed top-0 left-4 md:left-6 z-50 transition-all duration-300 ease hover:opacity-75"
      >
        <img src={flag} alt="Hack Club" className="h-16 md:h-20" />
      </a>

      <button
        onClick={handleLogIn}
        className="t-btn t-hover rounded-(--radius) font-bold text-lg fixed top-6 right-4 md:top-12 md:right-14 z-50 min-h-11 px-8 md:px-11"
      >
        {session ? 'Dashboard' : 'Log in'}
      </button>

      <div id="top" className="relative min-h-screen w-full">

        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="w-full max-w-7xl mx-auto px-6 md:px-4 flex flex-col items-center text-center">
            <h1 className="t-heading text-7xl md:text-8xl font-bold leading-none tracking-[0.02em]">TORQUE</h1>
            <p className="text-xl md:text-2xl leading-snug my-6 max-w-[22ch] sm:max-w-none text-(--text) [text-wrap:balance]">
              Build hardware projects with motors. Get funding and prizes.
            </p>
            <form className="flex w-full max-w-md items-stretch pt-2">
              <label htmlFor="hero-email" className="sr-only">Email address</label>
              <input
                id="hero-email"
                type="text"
                placeholder="orpheus@hackclub.com"
                className="min-w-0 flex-1 bg-white font-semibold pl-4 pr-2 sm:pl-6 sm:pr-4 rounded-l-(--radius) border-r-2 border-black min-h-11 text-black placeholder:text-gray-600"
              />
              <input
                type="submit"
                value="Get Started"
                className="t-btn t-hover shrink-0 px-3 sm:px-4 md:px-6 rounded-r-(--radius) font-bold"
              />
            </form>
          </div>
        </div>

        <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center">
          <button
            aria-label="Scroll to How It Works"
            tabIndex={hideArrow ? -1 : 0}
            onClick={() => {
              document.querySelector('#how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className={`rounded-full p-1 text-(--text) transition-all duration-300 ease ${hideArrow ? "opacity-0 pointer-events-none" : "opacity-100 hover:opacity-80"}`}
          >
            <ChevronDown aria-hidden="true" className="size-16 motion-safe:animate-bounce" />
          </button>
        </div>

      </div>

      <section id="how-it-works" aria-labelledby="how-it-works-title" className="relative z-20 w-full py-20 md:py-28">
        <h2 id="how-it-works-title" className="t-heading text-center text-4xl md:text-6xl font-bold">How It Works</h2>
        <ol className="grid grid-cols-1 mt-12 md:mt-16 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 lg:gap-10 px-6 sm:px-10 lg:px-20 max-w-(--breakpoint-2xl) mx-auto">
          {steps.map((step) => (
            <li key={step.title} className="t-card p-6 md:p-8 text-center">
              <h3 className="text-2xl md:text-3xl font-bold text-(--text) mb-3 md:mb-4">{step.title}</h3>
              <p className="md:text-lg leading-relaxed text-(--text)/80">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="relative z-20 w-full py-20 md:py-28">
        <h2 id="faq-title" className="t-heading text-center text-4xl md:text-6xl font-bold">FAQ</h2>
        <div className="w-full max-w-2xl px-6 sm:px-10 mt-12 md:mt-16 mx-auto flex flex-col gap-4">
          {faq.map((item, index) => {
            const open = openFaq === index;
            return (
              <div key={item.question} className="t-card">
                <h3>
                  <button
                    id={`faq-q-${index}`}
                    aria-expanded={open}
                    aria-controls={`faq-a-${index}`}
                    onClick={() => setOpenFaq(open ? null : index)}
                    className="t-hover flex w-full min-h-14 items-center justify-between gap-4 rounded-(--card-radius) px-5 py-3 text-left font-bold md:text-lg text-(--text)"
                  >
                    {item.question}
                    <ChevronDown
                      aria-hidden="true"
                      className={`size-6 shrink-0 motion-safe:transition-transform motion-safe:duration-300 ${open ? 'rotate-180' : ''}`}
                    />
                  </button>
                </h3>
                <div
                  id={`faq-a-${index}`}
                  role="region"
                  aria-labelledby={`faq-q-${index}`}
                  inert={!open}
                  className={`grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-500 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 leading-relaxed text-(--text)/80">{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Footer />
    </div>
  )
}
