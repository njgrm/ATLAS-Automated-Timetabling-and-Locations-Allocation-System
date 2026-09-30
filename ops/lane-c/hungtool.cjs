// Prints "HUNG <session> <tool> <min>" for any tool call still running for more than 20 min in a session updated in the last 6 h.
const base='http://127.0.0.1:4097', dir='directory=D%3A%5CATLAS';
(async()=>{const now=Date.now();const ss=await (await fetch(`${base}/session?${dir}`)).json();
const IGN=['ses_f17a82ceeffe3yDjOehZfD7r24']; // dead part left 'running' in storage
for(const s of ss){if(now-s.time.updated>6*3600e3||IGN.includes(s.id))continue;
 const ms=await (await fetch(`${base}/session/${s.id}/message?${dir}`)).json();const last=ms[ms.length-1];if(!last)continue;
 for(const p of last.parts){if(p.type==='tool'&&p.tool!=='task'&&p.state&&p.state.status==='running'){const st=p.state.time&&p.state.time.start;const m=st?Math.round((now-st)/60000):-1;
  if(m>30)console.log(`HUNG ${s.id} ${p.tool} ${m}min ${(s.title||'').slice(0,40)}`)}}}})().catch(e=>console.log('hungtool error',e.message));
