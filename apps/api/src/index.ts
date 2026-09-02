import "dotenv/config";
import express from "express";
import cors from "cors";
import { Pool } from "pg";
import { Contract, JsonRpcProvider, WebSocketProvider } from "ethers";

const RPC = process.env.RH_RPC_URL || "https://rpc.testnet.chain.robinhood.com";
const WS = process.env.RH_WS_URL || "wss://feed.testnet.chain.robinhood.com";
const TOKEN = process.env.TOKEN_ADDRESS || "";
const FLARE = process.env.FLARE_ADDRESS || "";
const START_BLOCK = Number(process.env.START_BLOCK || 0);
const PORT = Number(process.env.PORT || 8080);

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;
const provider = new JsonRpcProvider(RPC);
const transferAbi = ["event Transfer(address indexed from,address indexed to,uint256 value)"];
const flareAbi = [
  "event FlareCreated(address indexed flare,address indexed creator,address indexed token,uint256 targetHolders,address recipient,uint256 amount)",
  "event Triggered(address indexed flare,uint256 holderCount)",
  "event Executed(address indexed flare,address indexed recipient,uint256 amount)"
];

async function db(sql:string, params:any[]=[]){ if(!pool) return {rows:[]}; return pool.query(sql,params); }

async function initDb(){
  if(!pool) return;
  await db(`create table if not exists token_balances(
    token text not null, holder text not null, balance numeric not null default 0,
    updated_block bigint not null default 0, primary key(token, holder)
  )`);
  await db(`create table if not exists flare_state(
    flare text primary key, creator text, token text, target_holders numeric,
    recipient text, amount numeric, status text default 'ACTIVE',
    holder_count numeric default 0, last_block bigint default 0
  )`);
  await db(`create table if not exists indexed_events(
    tx_hash text primary key, block_number bigint not null, log_index integer not null, kind text not null
  )`);
}

async function holderCount(token:string){
  const r = await db(`select count(*)::int as count from token_balances where token=$1 and balance > 0`,[token.toLowerCase()]);
  return Number(r.rows[0]?.count || 0);
}

async function applyTransfer(from:string,to:string,value:bigint,block:number){
  if(!TOKEN || !pool) return;
  const t=TOKEN.toLowerCase(), f=from.toLowerCase(), tt=to.toLowerCase();
  if(f !== "0x0000000000000000000000000000000000000000"){
    await db(`insert into token_balances(token,holder,balance,updated_block) values($1,$2,0,$3)
      on conflict(token,holder) do nothing`,[t,f,block]);
    await db(`update token_balances set balance=greatest(balance-$1,0),updated_block=$2 where token=$3 and holder=$4`,[value.toString(),block,t,f]);
  }
  if(tt !== "0x0000000000000000000000000000000000000000"){
    await db(`insert into token_balances(token,holder,balance,updated_block) values($1,$2,$3,$4)
      on conflict(token,holder) do update set balance=token_balances.balance+$3,updated_block=$4`,[t,tt,value.toString(),block]);
  }
}

async function backfill(){
  if(!TOKEN || !pool) return;
  const token = new Contract(TOKEN, transferAbi, provider);
  const latest = await provider.getBlockNumber();
  const from = START_BLOCK || Math.max(0, latest-50000);
  const logs = await token.queryFilter(token.filters.Transfer(), from, latest);
  for(const log of logs){
    const e = log as any;
    const txHash = e.transactionHash || e.txHash;
    const block = e.blockNumber;
    const exists = await db(`select 1 from indexed_events where tx_hash=$1`,[txHash]);
    if(exists.rows.length) continue;
    await applyTransfer(e.args.from,e.args.to,e.args.value,block);
    await db(`insert into indexed_events(tx_hash,block_number,log_index,kind) values($1,$2,$3,'TRANSFER') on conflict do nothing`,[txHash,block,e.index ?? 0]);
  }
}

async function checkFlares(){
  if(!pool) return;
  const r = await db(`select * from flare_state where status='ACTIVE'`);
  const count = TOKEN ? await holderCount(TOKEN) : 0;
  for(const flare of r.rows){
    await db(`update flare_state set holder_count=$1 where flare=$2`,[count,flare.flare]);
    if(count >= Number(flare.target_holders)){
      // Execution is intentionally separated: the keeper must submit the transaction
      // using the configured EXECUTOR_PRIVATE_KEY, never a creator wallet.
      await db(`update flare_state set status='TRIGGERED' where flare=$1`,[flare.flare]);
    }
  }
}

const app = express();
app.use(cors());
app.use(express.json());
app.get("/health", async(_req,res)=>res.json({ok:true,chainId:46630,network:"Robinhood Chain Testnet",token:TOKEN||null,flare:FLARE||null}));
app.get("/holders", async(_req,res)=>res.json({count:TOKEN ? await holderCount(TOKEN) : 0}));
app.get("/flares", async(_req,res)=>res.json((await db(`select * from flare_state order by last_block desc`)).rows));

async function main(){
  await initDb();
  await backfill();
  if(TOKEN && pool){
    const token = new Contract(TOKEN, transferAbi, provider);
    token.on("Transfer", async(from,to,value,event)=>{
      try {
        await applyTransfer(from,to,value,Number((event as any).log?.blockNumber || await provider.getBlockNumber()));
      } catch(e){ console.error("transfer index error",e); }
    });
  }
  setInterval(checkFlares, 5000);
  app.listen(PORT,()=>console.log(`FLARE API listening on ${PORT}`));
}
main().catch(err=>{console.error(err);process.exit(1)});
