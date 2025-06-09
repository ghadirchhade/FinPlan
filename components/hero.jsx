//client component =>use hooks,interactivity
"use client";
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useRef } from 'react'
import { Button } from './ui/button';

const HeroSection = () => {

  const imageRef=useRef();//reference to the image

  useEffect(() => {//executed after the first render
    const imageElement=imageRef.current;//access the dom node

    const handleScroll=()=>{//run whenever the user scrolls the page
      const scrollPosition=window.scrollY;//current vertical scroll
      const scrollThreshold=100;

      if(scrollPosition>scrollThreshold){
        imageElement.classList.add("scrolled");
      }
      else{
        imageElement.classList.remove("scrolled");
      }
    }
    window.addEventListener("scroll",handleScroll);
    return ()=> window.removeEventListener("scroll",handleScroll);
  },[])
   
  return (
    <div  className="pb-20 px-4">
        <div className="container mx-auto text-center">
            <h1 className="text-5xl md:text-8xl lg:text[105px] pb-6 gradient-title">
              Manage Your Finances <br/> with Intelligence
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              An AI-powered financial management that helps you track,
              analyze, and optimize your spending with real-time insights
            </p>
            <div className="flex justify-center space-x-4">
              <Link href="/dashboard">
                <Button size="lg" className="px-8">
                   Get Started
                </Button>
              </Link>
              <Link href="https://youtu.be/CPVa5PBRP3I">
                <Button size="lg" variant="outline" className="px-8">
                   Watch Demo
                </Button>
              </Link>
            </div>
            <div className="hero-image-wrapper">
              <div ref={imageRef} className="hero-image"> {/*we take a ref to the image like document.getElementById*/}
                <Image 
                  src="/banner.jpeg" 
                  width={1280} 
                  height={720} 
                  alt="Dashboard Preview"
                  className="rounded-lg shadow-2xl border mx-auto"
                  priority
                />
              </div>
            </div>
        </div>
    </div>
  );
}

export default HeroSection;
