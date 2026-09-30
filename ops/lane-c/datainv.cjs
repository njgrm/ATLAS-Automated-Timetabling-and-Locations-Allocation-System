// Live-data invariants: exactly 1 active non-archived school-year mirror; 0 fixture ids (900000-999999). Prints DATA-OK or DATA-BAD.
const fs=require('fs');const line=fs.readFileSync('D:/ATLAS-runtime-config/atlas-server.env','utf8').split(/\r?\n/).find(l=>l.startsWith('DATABASE_URL='));
process.env.DATABASE_URL=line.slice(13).replace(/^["']|["']$/g,'');
const {PrismaClient}=require('D:/ATLAS/atlas-server/node_modules/@prisma/client');const p=new PrismaClient();
(async()=>{const a=(await p.$queryRawUnsafe(`select count(*)::int n from enrollpro_school_year_mirrors where is_active and not is_archived`))[0].n;
const f=(await p.$queryRawUnsafe(`select (select count(*) from enrollpro_school_year_mirrors where enrollpro_school_year_id between 900000 and 999999)+(select count(*) from section_mirrors where external_id between 900000 and 999999)+(select count(*) from faculty_mirrors where external_id between 900000 and 999999) n`))[0].n;
console.log(a===1&&Number(f)===0?'DATA-OK':`DATA-BAD active=${a} fixtures=${f}`);await p.$disconnect()})().catch(e=>console.log('DATA-ERR',e.message.slice(0,120)));
