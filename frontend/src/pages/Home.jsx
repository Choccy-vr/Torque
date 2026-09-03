import React from 'react'
import flag from '../assets/flag-orpheus-top.png'
import motor from '../assets/motor.png'
import {ChevronDown, ChevronUp} from 'lucide-react'
import {ReactLenis, useLenis } from 'lenis/react'
import {useEffect, useState} from 'react'

function handleSubmit() {
  console.log('Form submitted');
}

export default function Home() {

  const [hideArrow, setHideArrow] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const faq = [
    {question: "What is Torque?", answer: "Torque is a program where you build hardware projects with motors, and get funding and prizes for your projects."},
    {question: "Who can participate?", answer: "You have to be a teen, ages 13-18."},
    {question: "Can I join if I'm a beginner?", answer: "Yes! You don't need prior hardware experience to join. We have guides and a helpful community."},
    {question: "Is this free?", answer: "Yes, Torque is completely free to join."},
    {question: "What is Hack Club?", answer: "Hack Club is a 501(c)(3) nonprofit and network of 100k+ technical high schoolers who believe you learn best by building."},
    {question: "How many projects can I build?", answer: "There's no limit to the number of projects you can build! We encourage you to explore your creativity and build as many projects as you want."},
  ]

  const handleAnswerClick = () => {
    setHideAnswer(!hideAnswer);
  }

  const lenis = useLenis((lenis) => {
    console.log(window.scrollY);
  })

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
    <>
      <ReactLenis root/>
      <div className="fixed inset-0 z-0 bg-[#d48300] [background-image:linear-gradient(#f7ff0040_1px,transparent_1px),linear-gradient(90deg,#f7ff0040_1px,transparent_1px)] [background-size:50px_50px]" />
      <div className="fixed inset-0 z-0 bg-black opacity-20" />

      <div>
        <img
          src={flag}
          alt="Hack Club Flag"
          className="fixed top-0 left-6 z-50 h-20 hover:opacity-75 cursor-pointer transition-all duration-300 ease"
          onClick={() => window.open('https://hackclub.com', '_blank')}
        />

        <button className="fixed top-8 right-10 z-50 rounded-md bg-white px-12 py-2 text-black transition-all duration-300 ease hover:opacity-80">
          Log In
        </button>
      </div>

      <div className="relative min-h-screen w-full">

        <div className="font-phantom absolute top-0 left-0 right-0 flex items-center justify-center min-h-full z-20 pointer-events-none">
          <div className="w-full max-w-7xl mx-auto px-6 md:px-4 pointer-events-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center">

              <div className="space-y-4 md:space-y-5 text-center md:text-left">
                <h1 className="text-6xl md:text-8xl font-phantom font-bold text-white">TORQUE</h1>
                <p className="lg:w-3/4 text-2xl md:text-3xl text-white">Build hardware projects with motors. Get funding and prizes.</p>
                <form onSubmit={handleSubmit}>
                  <input type="text" placeholder="orpheus@hackclub.com" className="font-semibold pl-6 pr-20 py-2 rounded-xl text-black placeholder:text-gray-500 focus:outline-none"></input>
                  {/* <input type="submit" value="Get Started" className="outline-none ml-2 px-6 py-2 mt-2 rounded-xl bg-white text-black font-semibold cursor-pointer hover:opacity-80 transition-all duration-300 ease"></input> */}
                </form>
              </div>

              <div className="justify-center hidden md:flex md:justify-end group z-10 wobble-1">
                <img src={motor} alt="Motor" className="w-96 h-auto transition-all duration-300 ease group-hover:scale-105"/>
              </div>

            </div>
          </div>
        </div>
      
        <div className="absolute bottom-4 left-0 right-0">
          <ChevronDown 
            className={`mx-auto w-16 h-16 text-white animate-bounce transition-all duration-300 ease ${hideArrow ? "opacity-0 pointer-events-none" : "opacity-100 hover:opacity-80 cursor-pointer"}`} 

            onClick={() => {
              const section = document.querySelector('.section1');
              section?.scrollIntoView({ behavior: 'smooth', block: "center" });
              console.log("clicked");
            }}
          />
        </div>

      </div>

      <section className="section1 w-full z-20 mt-10 pt-20">
          <div className="font-phantom relative flex items-center justify-center flex-col pointer-events-auto z-20">
            <h1 className="text-4xl md:text-6xl font-bold text-white z-20">How It Works</h1>
            <div className="grid grid-cols-1 mt-20 md:grid-cols-2 lg:grid-cols-4 gap-8 px-20 md:gap-16 max-w-screen-2xl mx-auto">
              <div className="bg-black p-6 md:p-8 text-center text-white">
                <h1 className="md:text-lg">Design</h1>
                <p className="md:text-lg">Design your hardware project — pick a motor-powered idea and plan how it'll work.</p>
              </div>
              <div className="bg-black p-6 md:p-8 text-center text-white">
                <h1 className="md:text-lg">Build</h1>
                <p className="md:text-lg">Get a grant to pay for the parts, then build your design into something real.</p>
              </div>
              <div className="bg-black p-6 md:p-8 text-center text-white">
                <h1 className="md:text-lg">Revise</h1>
                <p className="md:text-lg">Test what you built and make any revisions it needs to work better.</p>
              </div>
              <div className="bg-black p-6 md:p-8 text-center text-white">
                <h1 className="md:text-lg">Ship</h1>
                <p className="md:text-lg">Ship a finished, working project and unlock more prizes in the shop.</p>
              </div>
            </div>
          </div>
      </section>

      <section className="section2 w-full z-20 mt-10 pt-20">
        <div className="font-phantom relative flex items-center justify-center flex-col pointer-events-auto z-20">
          <h1 className="text-4xl md:text-6xl font-bold text-white z-20">FAQ</h1>
          <div className="text-white w-full max-w-2xl px-10 m-20 mx-auto gap-5 flex flex-col">
            {faq.map((item, index) => (
              <div key={index} className="w-full">
                <div 
                  className="bg-white rounded-md text-black p-4 flex w-full flex-col cursor-pointer transition-all duration-300 ease hover:opacity-85"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}  
                >
                  <div className="flex flex-row w-full items-center justify-between transition-all duration-300 ease">
                    <h1>{item.question}</h1>
                    {openFaq === index ? <ChevronUp /> : <ChevronDown />}
                  </div>


                  <p className={`transition-all duration-500 ease text-md ${openFaq === index ? 'max-h-20 opacity-50 mt-4 ' : 'mt-0 opacity-0 max-h-0 overflow-hidden'}`}>{item.answer}</p>

                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="w-full flex items-center justify-center z-50 relative h-32 mt-20 bg-black text-white">
        <h1>Made with ❤️ by the Hack Club community</h1>
      </footer>
    </>
  )
}