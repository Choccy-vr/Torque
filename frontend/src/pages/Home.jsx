import React from 'react'
import flag from '../assets/flag-orpheus-top.png'


export default function Home() {
  return (
    <>
      <div className="fixed inset-0 z-0 bg-[#d48300] [background-image:linear-gradient(#f7ff0040_1px,transparent_1px),linear-gradient(90deg,#f7ff0040_1px,transparent_1px)] [background-size:50px_50px]" />

      <div>
        <img
          src={flag}
          alt="Hack Club Flag"
          className="fixed top-0 left-6 z-10 h-20 hover:opacity-75 cursor-pointer transition-all duration-300 ease"
          onClick={() => window.open('https://hackclub.com', '_blank')}
        />

        <button className="fixed top-8 right-10 z-10 rounded-md bg-white px-12 py-2 text-black transition-all duration-300 ease hover:opacity-80">
          Log In
        </button>
      </div>

      <div className="absolute top-0 left-0 right-0 flex items-center justify-center min-h-screen z-50" data-landing-target="heroContent">
        <div className="w-full max-w-6xl mx-auto px-6 md:px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center">
            <div className="space-y-2 md:space-y-4 text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-phantom font-bold text-white">Torque</h1>
              <p className="font-phantom text-2xl text-white">Build hardware projects with motors.<br/> Get funding and prizes.</p>

            </div>
          </div>
        </div>
      </div>
      
    </>
  )
}