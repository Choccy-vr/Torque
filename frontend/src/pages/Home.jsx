import React from 'react'
import flag from '../assets/flag-orpheus-top.png'


export default function Home() {
    return (
        <>
            <div className="fixed inset-0 -z-10 bg-[#070707] bg-[linear-gradient(#ffffff10_1px,transparent_1px),linear-gradient(90deg,#ffffff10_2px,transparent_2px)] bg-size-[50px_50px]"></div>
            <img src={flag} alt="Flag" className="fixed top-0 left-6 h-20" />
            <button className="fixed top-8 right-10 bg-white px-12 py-2 text-black rounded-md hover:opacity-80 transition-all duration-300 ease">Log In</button>
        </>
    )
}