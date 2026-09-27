import { SCHEMA_VERSION } from '../../src/core/schema.js';
import { bi } from '../../src/core/bi.js';

export function buildPerfModel({ resources=120, sites=60, days=90, restarts=12, lnsIterations=40 } = {}) {
  const roles = [{id:'r_a',name:bi('A','A'),short:'A',color:'--role-1'},{id:'r_b',name:bi('B','B'),short:'B',color:'--role-2'}];
  const res = [];
  for (let i=0;i<resources;i++){
    const roleId = i%2===0?'r_a':'r_b';
    res.push({id:`res_${i}`,name:bi(`R${i}`,`R${i}`),roles:[roleId],tags:[],attrs:{km:i%50},
      avail:{weekdays:[1,1,1,1,1,1,0],off:[],only:[],patternId:null},
      caps:{maxPerDay:1,maxPerWeek:null,minRestDays:0}, prefs:[{attr:'km',dir:'low',strength:1}], weight:1, active:true});
  }
  const siteArr = [];
  for (let i=0;i<sites;i++){
    siteArr.push({id:`site_${i}`,name:bi(`S${i}`,`S${i}`),classId:'c_main',tags:[],attrs:{km:i%80},weight:1,active:true,
      cadence:{minGapDays:0,targetPerHorizon:null,maxPerHorizon:null}});
  }
  const start='2026-01-05';
  const d=new Date(2026,0,5); d.setDate(d.getDate()+days-1);
  const end=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return {
    schema: SCHEMA_VERSION,
    lexicon:{resource:bi('R','R'),site:bi('S','S'),engagement:bi('V','V'),run:bi('Run','Run')},
    attributes:[{id:'km',label:bi('Distance','Distance'),unit:'km',domain:[0,999],agg:'sum'}],
    roles,
    siteClasses:[{id:'c_main',name:bi('Main','Main'),planned:true,demand:[{roleId:'r_a',min:1,max:1},{roleId:'r_b',min:1,max:1}],runLength:1,cohesion:'full'}],
    sites: siteArr,
    resources: res,
    patterns: [],
    calendar:{
      horizon:{start,end},
      weekdayDefaults: Array.from({length:7},(_,i)=>({on: i!==5 && i!==6, blocks: (i!==5&&i!==6) ? [{blockId:'b_day',slots:3,bias:'auto'}] : []})),
      dateOverrides:{},
      blocks:[{id:'b_day',name:bi('Day','Day'),order:0}]
    },
    rules:[
      {id:'r_no_consec',type:'min-rest-days',enabled:true,severity:'hard',weight:100,scope:{roles:[],tags:[],resources:[]},params:{days:1}},
      {id:'r_one_per_day',type:'max-per-day',enabled:true,severity:'hard',weight:100,scope:{roles:[],tags:[],resources:[]},params:{n:1}},
      {id:'r_pref',type:'attribute-affinity',enabled:true,severity:'soft',weight:50,scope:{roles:[],tags:[],resources:[]},params:{attr:'km'}}
    ],
    objectives:[{id:'fairness',enabled:true,weight:50}],
    engine:{seed:1,restarts,lnsIterations,timeBudgetMs:1500,relaxMode:'relaxed'},
    locks:[],
    ui:{lang:'en',view:'plan'}
  };
}
