# Builds 2026 Race Data/*.js from the official timing CSVs and the track sheet pit log.
# Run from the site folder:  python tools/build_race_data.py   (needs pandas)
import pandas as pd, json, re, os, statistics as st
# Put the raw timing CSVs and pit_stops.csv in a folder that is NOT published (they contain driver names)
IN='race-data-raw/'
OUT='2026 Race Data/'
os.makedirs(OUT,exist_ok=True)
# 2026 season order
RACES=[
 ('barber-1','Barber 26 Race 1.csv','Barber','Barber Motorsports Park','Race 1','barber'),
 ('barber-2','Barber 26 Race 2.csv','Barber','Barber Motorsports Park','Race 2','barber'),
 ('vir','VIR 26 12 hour.csv','VIR','Virginia International Raceway','12 Hour','vir'),
 ('road-america-1','Road America 26 Race 1.csv','Road America','Road America','Race 1','road-america'),
 ('road-america-2','Road America 26 Race 2.csv','Road America','Road America','Race 2','road-america'),
 ('watkins-1','Watkins G 26 race 1.csv','Watkins Glen','Watkins Glen International','Race 1','watkins-glen'),
 ('watkins-2','Watkins G 26 race 2.csv','Watkins Glen','Watkins Glen International','Race 2','watkins-glen'),
 ('miami','Miami 26 12 hour.csv','Homestead-Miami','Homestead-Miami Speedway','12 Hour','homestead-miami'),
 ('daytona','Daytona 26 12 hour.csv','Daytona','Daytona International Speedway','12 Hour','daytona'),
]
# Pit Stop Log rows from the track sheets (fuel, tires, issues, notes)
SHEET=pd.read_csv(os.environ.get('PIT_LOG','race-data-raw/pit_stops.csv'))
SHEET['used']=False
def sheet_match(event,car,lap,dur):
    c=SHEET[(SHEET.event_id==event)&(SHEET.car.astype(str)==car)&(~SHEET.used)]
    if not len(c): return None
    d=(c.pit_duration_s-dur).abs()
    best=d.idxmin() if d.notna().any() else None
    if best is not None and d[best]<1.0 and abs(c.lap[best]-lap)<=3: i=best
    else:
        l=(c.lap-lap).abs()
        i=l.idxmin()
        if l[i]>1: return None
    SHEET.loc[i,'used']=True
    return SHEET.loc[i]
def note_of(r):
    parts=[str(x).strip() for x in (r.issues,r.notes) if isinstance(x,str) and x.strip() and x.strip()!='Added from official time card']
    return '; '.join(parts) or None
TEAM=['177','178']
def secs(s):
    if not isinstance(s,str) or not s.strip(): return None
    p=s.strip().split(':'); v=0.0
    for x in p: v=v*60+float(x)
    return v
def norm(n): return re.sub(r'\s+(III|II|Jr\.?)$','',n.replace('*','').strip())
drivers={}  # season-wide anonymous names for team drivers
def anon(n):
    k=norm(n)
    if k not in drivers: drivers[k]=f'Driver {len(drivers)+1}'
    return drivers[k]
season=[]; rnd=0
for rid,f,event,track,label,sheet_event in RACES:
    rnd+=1
    d=pd.read_csv(IN+f,sep=';',encoding='utf-8-sig',skipinitialspace=True,dtype=str)
    d.columns=[c.strip() for c in d.columns]
    d['t']=d.LAP_TIME.map(secs); d['e']=d.ELAPSED.map(secs); d['lap']=d.LAP_NUMBER.astype(int)
    for s in ['S1','S2','S3']: d[s+'s']=d[s].map(secs)
    d['pit']=d.PIT_TIME.map(secs)
    race={'id':rid,'event':event,'track':track,'label':label,'round':rnd,'cars':{},'classes':{}}
    team_classes={}
    for n in TEAM:
        c=d[d.NUMBER==n]
        if len(c): team_classes[n]=c.CLASS.iloc[0]
    for n,cls in team_classes.items(): race['classes'].setdefault(cls,[])
    for cls in race['classes']:
        cd=d[d.CLASS==cls].copy()
        # class position at each lap: order of crossing the line on that lap
        cd['pos']=cd.groupby('lap')['e'].rank(method='first').astype(int)
        cars=[]
        for n,g in cd.groupby('NUMBER'):
            g=g.sort_values('lap')
            isteam=n in TEAM
            laps=[]
            for _,r in g.iterrows():
                L=[r.lap, round(r.t,3) if r.t else None, round(r.e,1), int(r.pos),
                   1 if r.CROSSING_FINISH_LINE_IN_PIT=='B' else 0,
                   {'FCY':1,'RF':2}.get(r.FLAG_AT_FL,0)]
                if isteam: L.append(anon(r.DRIVER_NAME))
                laps.append(L)
            stops=[]
            if isteam:
                rows=g.reset_index(drop=True)
                k=0
                for i,r in rows.iterrows():
                    if pd.notna(r.pit):
                        prev=rows.iloc[i-1] if i>0 else r
                        # timing sometimes credits the new driver one lap late, so read the lap after the out-lap
                        nxt=rows.iloc[i+1] if i+1<len(rows) else r
                        k+=1
                        stops.append({'n':k,'lap':int(prev.lap) if i>0 else int(r.lap),
                          'clock':r.HOUR, 'raceTime':round(prev.e,1) if i>0 else 0,
                          'dur':round(r.pit,3),'driverIn':anon(prev.DRIVER_NAME),'driverOut':anon(nxt.DRIVER_NAME),
                          'swap': norm(prev.DRIVER_NAME)!=norm(nxt.DRIVER_NAME)})
                        m=sheet_match(sheet_event,n,stops[-1]['lap'],r.pit)
                        st_=stops[-1]
                        st_['logged']=m is not None
                        if m is not None:
                            st_['fuel']=None if pd.isna(m.fuel_added_gal) else float(m.fuel_added_gal)
                            st_['tires']=bool(m.tires_changed)
                            st_['note']=note_of(m)
            pits=g.pit.dropna().tolist()
            green=g[(g.FLAG_AT_FL=='GF')&(g.CROSSING_FINISH_LINE_IN_PIT!='B')&g.pit.isna()]
            car={'number':n,'class':cls,'make':g.MANUFACTURER.iloc[0],'team':isteam,
                 'laps':laps,'lapCount':int(g.lap.max()),'finalTime':round(g.e.max(),1),
                 'best':round(g.t.min(),3),
                 'ideal':round(sum(g[s+'s'].min() for s in ['S1','S2','S3']),3) if g.S1s.notna().any() else None,
                 'stopCount':len(pits),'pitTotal':round(sum(pits),1),
                 'medianStop':round(st.median(pits),1) if pits else None}
            if isteam: car['stops']=stops; car['drivers']=sorted({anon(x) for x in g.DRIVER_NAME})
            cars.append(car)
        cars.sort(key=lambda c:(-c['lapCount'],c['finalTime']))
        for i,c in enumerate(cars): c['finish']=i+1
        clsbest=min(c['best'] for c in cars)
        for c in cars:
            c['gapPct']=round((c['best']/clsbest-1)*100,2)
        race['classes'][cls]=[c['number'] for c in cars]
        for c in cars: race['cars'][c['number']]=c
        race.setdefault('classInfo',{})[cls]={'starters':len(cars),'winnerLaps':cars[0]['lapCount'],'bestLap':clsbest}
    race['durationHrs']=round(d.e.max()/3600,1)
    # write per-race file
    with open(OUT+rid+'.js','w') as fh:
        fh.write('/* Lap timing for '+event+' '+label+'. Generated from official timing files. Rival drivers removed; team drivers anonymised. */\n')
        fh.write('RaceData.add('+json.dumps(race,separators=(',',':'))+');\n')
    summ={'id':rid,'event':event,'track':track,'label':label,'round':rnd,'durationHrs':race['durationHrs'],'entries':[]}
    for n,cls in team_classes.items():
        c=race['cars'][n]; ci=race['classInfo'][cls]
        summ['entries'].append({'number':n,'class':cls,'finish':c['finish'],'starters':ci['starters'],
          'laps':c['lapCount'],'winnerLaps':ci['winnerLaps'],'best':c['best'],'classBest':ci['bestLap'],
          'gapPct':c['gapPct'],'stops':c['stopCount'],'pitTotal':c['pitTotal'],'drivers':c['drivers']})
    season.append(summ)
    print(rid, {n:(e['class'],f"P{e['finish']}/{e['starters']}",e['laps'],e['winnerLaps'],e['stops'],e['pitTotal']) for n,e in [(x['number'],x) for x in summ['entries']]}, os.path.getsize(OUT+rid+'.js')//1024,'KB')
with open(OUT+'season.js','w') as fh:
    fh.write('/* Season summary for the race data explorer. "round" order is set by hand. */\n')
    fh.write('RaceData.season('+json.dumps(season,indent=1)+');\n')
print('drivers',drivers)
print('sheet rows used',int(SHEET.used.sum()),'of',len(SHEET))
print(SHEET[~SHEET.used][['event_id','car','lap','pit_duration_s','fuel_added_gal','issues']].to_string())
