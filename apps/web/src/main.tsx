import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import { ArrowRight, Check, ChevronRight, Flame, Play, Radio, ShieldCheck, Wallet, Zap } from "lucide-react";
import { getDefaultConfig, RainbowKitProvider, ConnectButton } from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { BaseError } from "viem";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineChain, parseUnits, formatUnits } from "viem";
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

const EXECUTOR_ABI = [
  { type:"function", name:"markTriggered", stateMutability:"nonpayable", inputs:[{name:"flare",type:"address"},{name:"holderCount",type:"uint256"}] },
  { type:"function", name:"execute", stateMutability:"nonpayable", inputs:[{name:"flare",type:"address"}] },
  { type:"function", name:"cancel", stateMutability:"nonpayable", inputs:[{name:"flare",type:"address"}] },
  { type:"event", name:"Triggered", inputs:[{indexed:true,name:"flare",type:"address"},{indexed:false,name:"holderCount",type:"uint256"}] },
  { type:"event", name:"Executed", inputs:[{indexed:true,name:"flare",type:"address"},{indexed:true,name:"recipient",type:"address"},{indexed:false,name:"amount",type:"uint256"}] },
  { type:"event", name:"Cancelled", inputs:[{indexed:true,name:"flare",type:"address"}] }
] as const;

const VAULT_ABI = [
  { type:"function", name:"fund", stateMutability:"nonpayable", inputs:[{name:"token",type:"address"},{name:"amount",type:"uint256"}] },
  { type:"function", name:"balance", stateMutability:"view", inputs:[{name:"token",type:"address"}], outputs:[{type:"uint256"}] },
  { type:"event", name:"Funded", inputs:[{indexed:true,name:"token",type:"address"},{indexed:true,name:"from",type:"address"},{indexed:false,name:"amount",type:"uint256"}] },
  { type:"event", name:"Released", inputs:[{indexed:true,name:"token",type:"address"},{indexed:true,name:"recipient",type:"address"},{indexed:false,name:"amount",type:"uint256"}] }
] as const;

// Contract addresses (configured via environment variables)
const CONTRACT_ADDRESSES = {
  factory: (import.meta.env.VITE_FACTORY_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  executor: (import.meta.env.VITE_EXECUTOR_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  vault: (import.meta.env.VITE_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  token: (import.meta.env.VITE_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`
};

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

type BuilderStep = "wallet" | "token" | "trigger" | "action" | "approve" | "fund" | "monitor" | "execute" | "completed";

function FlareBuilder() {
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<BuilderStep>("wallet");
  const [tokenAddress, setTokenAddress] = useState("");
  const [targetHolders, setTargetHolders] = useState("1000");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [holderCount, setHolderCount] = useState(0);
  const [txHash, setTxHash] = useState("");
  const [flareAddress, setFlareAddress] = useState("");
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);
  
  const { writeContract: approveToken } = useWriteContract({
    mutation: {
      onError: (error) => {
        setError(error instanceof BaseError ? error.shortMessage : "Transaction failed");
        setIsPending(false);
      },
      onSuccess: () => {
        setError("");
        setIsPending(false);
      }
    }
  });
  
  const { writeContract: createFlare } = useWriteContract({
    mutation: {
      onError: (error) => {
        setError(error instanceof BaseError ? error.shortMessage : "Transaction failed");
        setIsPending(false);
      },
      onSuccess: () => {
        setError("");
        setIsPending(false);
      }
    }
  });
  
  const { writeContract: fundVault } = useWriteContract({
    mutation: {
      onError: (error) => {
        setError(error instanceof BaseError ? error.shortMessage : "Transaction failed");
        setIsPending(false);
      },
      onSuccess: () => {
        setError("");
        setIsPending(false);
      }
    }
  });
  
  const { writeContract: markTriggered } = useWriteContract({
    mutation: {
      onError: (error) => {
        setError(error instanceof BaseError ? error.shortMessage : "Transaction failed");
        setIsPending(false);
      },
      onSuccess: () => {
        setError("");
        setIsPending(false);
      }
    }
  });
  
  const { writeContract: executeFlare } = useWriteContract({
    mutation: {
      onError: (error) => {
        setError(error instanceof BaseError ? error.shortMessage : "Transaction failed");
        setIsPending(false);
      },
      onSuccess: () => {
        setError("");
        setIsPending(false);
      }
    }
  });
  
  const { data: tokenBalance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!tokenAddress }
  });
  
  const { data: tokenDecimals } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!tokenAddress }
  });
  
  const { data: vaultBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.vault,
    abi: VAULT_ABI,
    functionName: "balance",
    args: tokenAddress as `0x${string}`,
    query: { enabled: !!tokenAddress && step === "fund" }
  });

  const handleApprove = async () => {
    if (!tokenAddress || !amount || !tokenDecimals) return;
    setIsPending(true);
    setError("");
    const amountInWei = parseUnits(amount, tokenDecimals);
    approveToken({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACT_ADDRESSES.vault, amountInWei]
    });
    setTimeout(() => setStep("fund"), 1000);
  };

  const handleCreateFlare = async () => {
    if (!tokenAddress || !targetHolders || !recipient || !amount || !tokenDecimals) return;
    setIsPending(true);
    setError("");
    const amountInWei = parseUnits(amount, tokenDecimals);
    const expiresAtTimestamp = expiresAt ? Math.floor(new Date(expiresAt).getTime() / 1000) : 0;
    
    createFlare({
      address: CONTRACT_ADDRESSES.factory,
      abi: FACTORY_ABI,
      functionName: "createFlare",
      args: [
        tokenAddress as `0x${string}`,
        BigInt(targetHolders),
        recipient as `0x${string}`,
        amountInWei,
        BigInt(expiresAtTimestamp)
      ]
    });
    setTimeout(() => setStep("approve"), 1000);
  };

  const handleFund = async () => {
    if (!tokenAddress || !amount || !tokenDecimals) return;
    setIsPending(true);
    setError("");
    const amountInWei = parseUnits(amount, tokenDecimals);
    fundVault({
      address: CONTRACT_ADDRESSES.vault,
      abi: VAULT_ABI,
      functionName: "fund",
      args: [tokenAddress as `0x${string}`, amountInWei]
    });
    setTimeout(() => setStep("monitor"), 1000);
  };

  const handleTrigger = async () => {
    if (!flareAddress) return;
    setIsPending(true);
    setError("");
    markTriggered({
      address: CONTRACT_ADDRESSES.executor,
      abi: EXECUTOR_ABI,
      functionName: "markTriggered",
      args: [flareAddress as `0x${string}`, BigInt(holderCount)]
    });
    setTimeout(() => setStep("execute"), 1000);
  };

  const handleExecute = async () => {
    if (!flareAddress) return;
    setIsPending(true);
    setError("");
    executeFlare({
      address: CONTRACT_ADDRESSES.executor,
      abi: EXECUTOR_ABI,
      functionName: "execute",
      args: [flareAddress as `0x${string}`]
    });
    setTimeout(() => setStep("completed"), 1000);
  };

  // Simulate holder count monitoring (in real app, this would query blockchain)
  useEffect(() => {
    if (step === "monitor") {
      const interval = setInterval(() => {
        setHolderCount(prev => {
          if (prev >= parseInt(targetHolders)) {
            clearInterval(interval);
            return parseInt(targetHolders);
          }
          return prev + Math.floor(Math.random() * 10) + 1;
        });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [step, targetHolders]);

  const steps = [
    { id: "wallet", label: "WALLET" },
    { id: "token", label: "TOKEN" },
    { id: "trigger", label: "TRIGGER" },
    { id: "action", label: "ACTION" },
    { id: "approve", label: "APPROVE" },
    { id: "fund", label: "FUND" },
    { id: "monitor", label: "MONITOR" },
    { id: "execute", label: "EXECUTE" },
    { id: "completed", label: "DONE" }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  return <div className="builder-card reveal">
    <div className="builder-head">
      <span>FLARE BUILDER</span>
      <span>TESTNET · 46630</span>
    </div>
    <div className="steps">
      {steps.map((s, i) => (
        <div key={s.id} className={`step ${i === currentStepIndex ? "active" : ""} ${i < currentStepIndex ? "completed" : ""}`}>
          <b>{i + 1}</b>{s.label}
        </div>
      ))}
    </div>
    
    <div className="builder-body">
      {step === "wallet" && (
        <div className="builder-step">
          <div><small>CONNECT WALLET</small><strong>{isConnected ? "CONNECTED" : "NOT CONNECTED"}</strong></div>
          <div className="builder-icon"><Wallet size={26}/></div>
          {isConnected && <button className="primary" onClick={() => setStep("token")} disabled={isPending}>CONTINUE</button>}
        </div>
      )}

      {step === "token" && (
        <div className="builder-step">
          <div><small>TOKEN ADDRESS</small><input type="text" placeholder="0x..." value={tokenAddress} onChange={e => setTokenAddress(e.target.value)}/></div>
          <div><small>TARGET HOLDERS</small><input type="number" placeholder="1000" value={targetHolders} onChange={e => setTargetHolders(e.target.value)}/></div>
          <button className="primary" onClick={() => setStep("trigger")} disabled={isPending}>CONTINUE</button>
        </div>
      )}

      {step === "trigger" && (
        <div className="builder-step">
          <div><small>TRIGGER CONDITION</small><strong>≥ {targetHolders} UNIQUE HOLDERS</strong></div>
          <div><small>EXPIRATION (OPTIONAL)</small><input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}/></div>
          <button className="primary" onClick={() => setStep("action")} disabled={isPending}>CONTINUE</button>
        </div>
      )}

      {step === "action" && (
        <div className="builder-step">
          <div><small>RECIPIENT ADDRESS</small><input type="text" placeholder="0x..." value={recipient} onChange={e => setRecipient(e.target.value)}/></div>
          <div><small>AMOUNT TO TRANSFER</small><input type="text" placeholder="1000" value={amount} onChange={e => setAmount(e.target.value)}/></div>
          <button className="primary" onClick={handleCreateFlare} disabled={isPending}>{isPending ? "CREATING..." : "CREATE FLARE"}</button>
        </div>
      )}

      {step === "approve" && (
        <div className="builder-step">
          <div><small>APPROVE TOKEN SPENDING</small><strong>APPROVE {CONTRACT_ADDRESSES.vault.slice(0,6)}...{CONTRACT_ADDRESSES.vault.slice(-4)}</strong></div>
          <div className="builder-icon"><ShieldCheck size={26}/></div>
          <button className="primary" onClick={handleApprove} disabled={isPending}>{isPending ? "APPROVING..." : "APPROVE"}</button>
        </div>
      )}

      {step === "fund" && (
        <div className="builder-step">
          <div><small>FUND VAULT</small><strong>DEPOSIT {amount} TOKENS</strong></div>
          <div><small>VAULT BALANCE</small><strong>{vaultBalance ? formatUnits(vaultBalance as bigint, tokenDecimals || 18) : "0"}</strong></div>
          <button className="primary" onClick={handleFund} disabled={isPending}>{isPending ? "FUNDING..." : "FUND"}</button>
        </div>
      )}

      {step === "monitor" && (
        <div className="builder-step">
          <div><small>CURRENT HOLDERS</small><strong>{holderCount} / {targetHolders}</strong></div>
          <div className="progress"><i style={{width:`${Math.min(100, (holderCount/parseInt(targetHolders)) * 100)}%`}}/></div>
          {holderCount >= parseInt(targetHolders) && (
            <button className="primary" onClick={handleTrigger} disabled={isPending}>{isPending ? "TRIGGERING..." : "TRIGGER FLARE"}</button>
          )}
        </div>
      )}

      {step === "execute" && (
        <div className="builder-step">
          <div><small>FLARE TRIGGERED</small><strong>READY TO EXECUTE</strong></div>
          <div><small>TRANSFER DETAILS</small><strong>{amount} TOKENS → {recipient.slice(0,6)}...{recipient.slice(-4)}</strong></div>
          <button className="primary" onClick={handleExecute} disabled={isPending}>{isPending ? "EXECUTING..." : "EXECUTE FLARE"}</button>
        </div>
      )}

      {step === "completed" && (
        <div className="builder-step">
          <div><small>FLARE EXECUTED</small><strong>SUCCESS!</strong></div>
          <div><small>TRANSACTION</small><strong>{txHash || "PENDING..."}</strong></div>
          <div className="builder-icon"><Check size={26}/></div>
          <button className="primary" onClick={() => setStep("wallet")}>CREATE NEW FLARE</button>
        </div>
      )}
    </div>
    
    <div className="builder-note">
      <ShieldCheck size={17}/> FLARE never receives custody of your wallet. Automation funds live in a controlled vault.
    </div>
    
    {error && (
      <div className="builder-error">
        <span>{error}</span>
        <button onClick={() => setError("")}>×</button>
      </div>
    )}
  </div>;
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
        <FlareBuilder/>
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
