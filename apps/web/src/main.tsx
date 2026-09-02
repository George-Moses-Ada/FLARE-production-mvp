import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import { ArrowRight, Check, ChevronRight, Flame, Play, Radio, ShieldCheck, Wallet, Zap } from "lucide-react";
import { getDefaultConfig, RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineChain, parseUnits } from "viem";
import "@rainbow-me/rainbowkit/styles.css";
import "./styles.css";

gsap.registerPlugin(ScrollTrigger);

const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Robinhood Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
  testnet: true
});

const config = getDefaultConfig({
  appName: "FLARE",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "REPLACE_WITH_WALLETCONNECT_PROJECT_ID",
  chains: [robinhoodTestnet],
  ssr: false
});
const queryClient = new QueryClient();

const ERC20_ABI = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{name:"spender",type:"address"},{name:"amount",type:"uint256"}], outputs: [{type:"bool"}] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{name:"account",type:"address"}], outputs: [{type:"uint256"}] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{type:"uint8"}] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{type:"string"}] }
] as const;

const FACTORY_ABI = [
  { type:"function", name:"createFlare", stateMutability:"nonpayable", inputs:[
    {name:"token",type:"address"},{name:"targetHolders",type:"uint256"},{name:"recipient",type:"address"},{name:"amount",type:"uint256"},{name:"expiresAt",type:"uint64"}
  ], outputs:[{name:"flare",type:"address"}] },
  { type:"event", name:"FlareCreated", inputs:[{indexed:true,name:"flare",type:"address"},{indexed:true,name:"creator",type:"address"},{indexed:true,name:"token",type:"address"},{indexed:false,name:"targetHolders",type:"uint256"},{indexed:false,name:"recipient",type:"address"},{indexed:false,name:"amount",type:"uint256"}], anonymous:false }
] as const;

function ParticleField() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
    camera.position.z = 8;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    ref.current.appendChild(renderer.domElement);
    const count = 1100;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i=0;i<count;i++) {
      const r = 8 + Math.random()*10;
      const a = Math.random()*Math.PI*2;
      const z = (Math.random()-0.5)*10;
      positions[i*3] = Math.cos(a)*r;
      positions[i*3+1] = Math.sin(a)*r*0.48;
      positions[i*3+2] = z;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions,3));
    const material = new THREE.PointsMaterial({ color: 0xff5a1f, size: 0.028, transparent: true, opacity: 0.72 });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      points.rotation.y += 0.00035;
      points.rotation.x = Math.sin(performance.now()/6000)*0.025;
      renderer.render(scene,camera);
    };
    animate();
    const resize = () => {
      camera.aspect = innerWidth/innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth,innerHeight);
    };
    addEventListener("resize",resize);
    return () => { cancelAnimationFrame(frame); removeEventListener("resize",resize); renderer.dispose(); geometry.dispose(); material.dispose(); ref.current?.removeChild(renderer.domElement); };
  },[]);
  return <div className="particle-field" aria-hidden="true"/>;
}

const phases = ["ACTIVE","TRIGGERED","EXECUTING","COMPLETED"] as const;

function LiveDemo() {
  const [holders,setHolders] = useState(842);
  const [phase,setPhase] = useState<typeof phases[number]>("ACTIVE");
  const [running,setRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!running) return;
    let n = 842;
    timerRef.current = setInterval(() => {
      n += n < 997 ? 13 : 1;
      if (n >= 1000) {
        n = 1000;
        setHolders(n);
        setPhase("TRIGGERED");
        setTimeout(()=>setPhase("EXECUTING"),700);
        setTimeout(()=>setPhase("COMPLETED"),1500);
        setTimeout(()=>{setRunning(false); setPhase("ACTIVE"); setHolders(842);},2800);
      } else setHolders(n);
    },65);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  },[running]);
  return <div className="console-card reveal">
    <div className="console-top"><span><Radio size={14}/> LIVE AUTOMATION</span><span><span className="status-dot"/> TESTNET</span></div>
    <div className="console-main">
      <div><small>HOLDER COUNT</small><strong>{holders.toLocaleString()}</strong><span>/ 1,000</span></div>
      <div className="ring" data-phase={phase}><div>{phase}</div></div>
    </div>
    <div className="progress"><i style={{width:`${Math.min(100,holders/10)}%`}}/></div>
    <div className="console-foot"><span>TRIGGER: ≥ 1,000 UNIQUE HOLDERS</span><button onClick={()=>setRunning(true)} disabled={running}><Play size={14}/>{running ? "RUNNING" : "REPLAY"}</button></div>
  </div>
}

function App() {
  const { isConnected } = useAccount();
  const hero = useRef<HTMLDivElement>(null);
  
  const smoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  useEffect(() => {
    gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
      gsap.fromTo(el,{opacity:0,y:55},{opacity:1,y:0,duration:0.9,ease:"power3.out",scrollTrigger:{trigger:el,start:"top 88%"}});
    });
    gsap.to(".hero-title",{yPercent:-10,ease:"none",scrollTrigger:{trigger:hero.current,scrub:true}});
  },[]);
  return <div className="app">
    <ParticleField/>
    <header className="nav">
      <a className="brand" href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Flame size={20}/> FLARE</a>
      <div className="nav-links"><a href="#how" onClick={(e) => smoothScroll(e, 'how')}>HOW IT WORKS</a><a href="#architecture" onClick={(e) => smoothScroll(e, 'architecture')}>ARCHITECTURE</a><a href="#create" onClick={(e) => smoothScroll(e, 'create')}>CREATE</a></div>
      <ConnectButton showBalance={false}/>
    </header>

    <main>
      <section className="hero" ref={hero}>
        <div className="grid-glow"/>
        <div className="hero-copy reveal">
          <div className="eyebrow"><span/> ONCHAIN AUTOMATION PROTOCOL</div>
          <h1 className="hero-title">MAKE YOUR<br/><em>TOKEN</em><br/>PROGRAMMABLE.</h1>
          <p>Turn on-chain events into deterministic actions. Build automation directly around your token.</p>
          <div className="hero-actions"><a className="primary" href="#create" onClick={(e) => smoothScroll(e, 'create')}>CREATE A FLARE <ArrowRight size={17}/></a><a className="secondary" href="#how" onClick={(e) => smoothScroll(e, 'how')}>EXPLORE PROTOCOL <ChevronRight size={16}/></a></div>
          <LiveDemo/>
          <div className="signal-line"/>
        </div>
      </section>

      <section className="marquee"><div>EVENTS → CONDITIONS → EXECUTION → TOKENS → EVENTS → CONDITIONS → EXECUTION → TOKENS →</div></section>

      <section id="how" className="section manifesto">
        <div className="section-kicker reveal">01 / THE PRIMITIVE</div>
        <h2 className="reveal">A TOKEN SHOULD<br/><span>DO MORE.</span></h2>
        <p className="lead reveal">FLARE turns simple token state into programmable infrastructure. Define what should happen, define when it should happen, then let the protocol execute.</p>
        <div className="flow-grid reveal">
          {["TOKEN","TRIGGER","ACTION"].map((x,i)=><React.Fragment key={x}><div className="flow-card"><small>0{i+1}</small><strong>{x}</strong><span>{i===0?"Your ERC-20":"A deterministic rule"}</span></div>{i<2&&<ArrowRight className="flow-arrow"/>}</React.Fragment>)}
        </div>
      </section>

      <section className="section system" id="architecture">
        <div className="section-kicker reveal">02 / THE SYSTEM</div>
        <h2 className="reveal">FROM SIGNAL<br/><span>TO ACTION.</span></h2>
        <div className="architecture reveal">
          {["TOKEN EVENT","MONITOR","CONDITION","EXECUTOR","VAULT","ACTION"].map((x,i)=><div className="node" key={x}><i>{String(i+1).padStart(2,"0")}</i><strong>{x}</strong><small>{["Transfer detected","State indexed","Threshold evaluated","Authorized call","Funds isolated","Transfer executed"][i]}</small>{i<5&&<b/>}</div>)}
        </div>
      </section>

      <section id="create" className="section builder">
        <div className="section-kicker reveal">03 / CREATE</div>
        <h2 className="reveal">BUILD YOUR<br/><span>FIRST FLARE.</span></h2>
        <div className="builder-card reveal">
          <div className="builder-head"><span>FLARE BUILDER</span><span>TESTNET · 46630</span></div>
          <div className="steps">{["TOKEN","TRIGGER","ACTION","REVIEW"].map((x,i)=><div className={i===0?"step active":"step"} key={x}><b>{i+1}</b>{x}</div>)}</div>
          <div className="builder-body">
            <div><small>CONNECTED WALLET</small><strong>{isConnected?"WALLET CONNECTED":"CONNECT WALLET TO BEGIN"}</strong></div>
            <div className="builder-icon"><Wallet size={26}/></div>
          </div>
          <div className="builder-note"><ShieldCheck size={17}/> FLARE never receives custody of your wallet. Automation funds live in a controlled vault.</div>
        </div>
      </section>

      <section className="section final-cta">
        <div className="cta-orbit"/>
        <div className="reveal"><div className="eyebrow"><span/> ROBINHOOD CHAIN TESTNET</div><h2>PROGRAM THE<br/><em>BEHAVIOR.</em></h2><p>Deploy the first programmable-token primitive on Robinhood Chain.</p><a className="primary" href="#create" onClick={(e) => smoothScroll(e, 'create')}>START BUILDING <Zap size={17}/></a></div>
      </section>
    </main>
    <footer><span>FLARE © 2026</span><span>MAKE YOUR TOKEN PROGRAMMABLE.</span><span>TESTNET BUILD</span></footer>
  </div>
}

createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider>
        <App/>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
