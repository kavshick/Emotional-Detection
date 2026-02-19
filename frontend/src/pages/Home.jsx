import React, { useEffect, useRef } from 'react';import { Link } from 'react-router-dom';import { ScanFace, BrainCircuit, Activity, ArrowRight } from 'lucide-react';import gsap from 'gsap';const FeatureCard = ({ icon: Icon, title, description, delay }) => (  <div className="feature-card opacity-0 bg-card/50 border border-primary/20 hover:border-primary rounded-xl p-6 transition-all duration-300 shadow-[0_0_10px_rgba(0,0,0,0.5)] hover:shadow-neon backdrop-blur-sm group">    <div className="w-12 h-12 rounded-lg bg-secondary/50 flex items-center justify-center mb-4 text-primary group-hover:scale-110 transition-transform duration-300">      <Icon size={24} />    </div>    <h3 className="text-lg font-bold mb-2 text-foreground tracking-wide group-hover:text-primary transition-colors">{title}</h3>    <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>  </div>);const Home = () => {    const containerRef = useRef(null);    const titleRef = useRef(null);    const subtitleRef = useRef(null);    const buttonsRef = useRef(null);    useEffect(() => {        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });        tl.fromTo(titleRef.current,             { y: 50, opacity: 0 },            { y: 0, opacity: 1, duration: 1 }        )        .fromTo(subtitleRef.current,             { y: 30, opacity: 0 },            { y: 0, opacity: 1, duration: 1 },            "-=0.6"        )        .fromTo(buttonsRef.current,             { scale: 0.8, opacity: 0 },            { scale: 1, opacity: 1, duration: 0.8 },            "-=0.6"        )        .fromTo(".feature-card",             { y: 50, opacity: 0 },            { y: 0, opacity: 1, duration: 0.8, stagger: 0.2 },            "-=0.4"        );    }, []);  return (    <div ref={containerRef} className="max-w-5xl mx-auto py-12 px-4 text-center relative overflow-hidden">      {/* Background Decor */}      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>      <div className="mb-10 inline-flex items-center px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium shadow-neon">        <span className="flex w-2 h-2 rounded-full bg-primary mr-2 animate-pulse shadow-[0_0_5px_currentColor]"></span>        System Online v2.0      </div>            <h1 ref={titleRef} className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 drop-shadow-sm">        Emotion <span className="text-primary drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]">AI</span><br />        Recognition      </h1>            <p ref={subtitleRef} className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">        Next-generation computer vision for real-time facial expression analysis.         Powered by <span className="text-foreground font-semibold">DeepFace</span> and <span className="text-foreground font-semibold">Mediapipe</span>.      </p>            <div ref={buttonsRef} className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-24">        <Link           to="/live_detector"           className="group relative inline-flex items-center justify-center px-8 py-4 rounded-lg bg-primary text-black font-bold hover:bg-primary/90 transition-all shadow-neon hover:scale-105 active:scale-95 duration-200"
        >
          <span className="relative z-10 flex items-center">
            Launch Detector
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </Link>
        <Link 
          to="/about_project" 
          className="inline-flex items-center justify-center px-8 py-4 rounded-lg border border-white/10 hover:border-primary/50 hover:bg-white/5 transition-all font-medium text-foreground hover:text-primary"
        >
          System Details
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6 text-left">
        <FeatureCard 
          icon={ScanFace}
          title="Neural Analysis"
          description="High-frequency video stream processing using optimized CNN architectures for micro-expression detection."
        />
        <FeatureCard 
          icon={BrainCircuit}
          title="Deep Learning"
          description="Hybrid architecture utilizing DeepFace ensembles with OpenCV cascades for robust face tracking in low light."
        />
        <FeatureCard 
          icon={Activity}
          title="Temporal Data"
          description="Session-based telemetry recording with granular timeline visualization and emotional trend analysis."
        />
      </div>
    </div>
  );
};

export default Home;
