#!/usr/bin/env python3
"""Build MAX's small robot kit directly on the game's 1x pixel grid.

Requires Pillow. No screenshot sampling, image rescaling, antialiasing, or random art.
All artwork colours must already occur in index.html. Outputs use alpha 0 or 255.
"""
from pathlib import Path
import hashlib, json, math, re
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/native'
OUT.mkdir(parents=True,exist_ok=True)
SOURCE=ROOT/'index.html'
COLORS={
 'ink':'#0e1e1d','deep':'#262938','metal':'#405054','edge':'#5e6781',
 'tank_dark':'#0a2628','tank':'#1e4852','water_mid':'#315f6a','water':'#5f9fe0',
 'leaf_dark':'#294321','leaf':'#3b5a2e','leaf_light':'#62744e',
 'soil':'#3b2d21','ochre':'#585633','lamp':'#d9c760','amber':'#e09a4d',
}
text=SOURCE.read_text()
assert all(c.lower() in text.lower() for c in COLORS.values()),'Palette drift: not a source-game colour'
P={key:tuple(bytes.fromhex(value[1:]))+(255,) for key,value in COLORS.items()}
TRANS=(0,0,0,0)

def canvas(size=(32,32)):
 return Image.new('RGBA',size,TRANS)

def rect(d,b,c): d.rectangle(b,fill=P[c])
def line(d,pts,c,w=1): d.line(pts,fill=P[c],width=w)
def dot(d,x,y,c): d.point((x,y),fill=P[c])

# Rigid arm poses: pivot and pixel-registered elbow/nozzle positions. The
# mechanical joints, not the whole sprite, change during deployment.
ARM=[]
for n in range(6):
 t=n/5; a=math.radians(-60-45*t); b=math.radians(-150-50*t)
 elbow=(round(9+8*math.cos(a)),round(22+8*math.sin(a)))
 nozzle=(round(elbow[0]+6*math.cos(b)),round(elbow[1]+6*math.sin(b)))
 ARM.append((elbow,nozzle))

def robot(state,phase):
 im=canvas();d=ImageDraw.Draw(im)
 if state=='deploy': arm=phase
 elif state=='retract': arm=5-phase
 elif state in ('water','dry'): arm=5
 else: arm=0
 elbow,nozzle=ARM[arm]
 # Arm is behind the chassis. No arbitrary rotation/resampling of full frames.
 line(d,[(9,22),elbow,nozzle],'ink',3)
 line(d,[(9,22),elbow,nozzle],'metal',1)
 dot(d,*elbow,'edge')
 x,y=nozzle
 rect(d,(max(0,x-1),y,x+2,y+1),'deep');rect(d,(max(0,x-1),y,x+1,y),'edge')
 # Boxy, low chassis with the same two/three-tone outline logic as the plants.
 d.polygon([(5,21),(26,21),(28,23),(28,27),(4,27),(4,23)],fill=P['ink'])
 rect(d,(5,22,26,25),'metal');rect(d,(6,22,25,22),'edge')
 rect(d,(6,25,26,26),'deep')
 rect(d,(7,23,10,24),'ink');dot(d,8,23,'tank')
 light='ochre' if state=='sleep' else ('amber' if state=='dry' else 'lamp')
 if phase%4 in (0,1):dot(d,26,24,light)
 else:dot(d,26,24,'ochre')
 # Water tank, opaque discrete colours: no baked translucency, bloom or halo.
 rect(d,(21,15,27,21),'ink');rect(d,(22,16,26,20),'tank_dark')
 fill=0 if state=='dry' else (phase+1 if state=='refill' else 7)
 top=21-math.ceil(fill*5/8)
 if fill:
  rect(d,(22,top,26,20),'tank');line(d,[(22,top),(26,top)],'water_mid')
  dot(d,23+phase%3,top,'water')
 rect(d,(21,14,27,15),'deep');rect(d,(22,14,26,14),'edge')
 # The tiny planter reads as part of the rover, not a second full-size plant.
 rect(d,(12,18,19,21),'ink');rect(d,(13,19,18,20),'soil')
 line(d,[(15,18),(15,14)],'leaf_dark');dot(d,16,15,'leaf')
 sway=(phase//2)%2 if state in ('drive','water') else 0
 line(d,[(15,16),(13-sway,14)],'leaf')
 rect(d,(12-sway,13,13-sway,14),'leaf_dark');dot(d,12-sway,13,'leaf_light')
 line(d,[(15,16),(17+sway,13)],'leaf')
 rect(d,(17+sway,12,18+sway,13),'leaf_dark');dot(d,18+sway,12,'leaf_light')
 # Pivots and wheel phase are independent of ground registration.
 rect(d,(8,21,10,23),'deep');dot(d,9,22,'edge')
 rim=[(0,-2),(1,-1),(2,0),(1,1),(0,2),(-1,1),(-2,0),(-1,-1)]
 wheel_phase=phase%8 if state=='drive' else 0
 for cx in (8,16,24):
  d.polygon([(cx-2,25),(cx+2,25),(cx+3,26),(cx+3,30),(cx+2,31),(cx-2,31),(cx-3,30),(cx-3,26)],fill=P['ink'])
  d.ellipse((cx-2,26,cx+2,30),fill=P['deep'])
  dot(d,cx,28,'metal');ox,oy=rim[wheel_phase];dot(d,cx+ox,28+oy,'edge')
  if state=='drive':dot(d,cx-ox,28-oy,'metal')
 return im,{'emitter':{'x':max(0,nozzle[0]),'y':nozzle[1]+2},'tankInlet':{'x':24,'y':14}}

ANIMS=[('idle',4,250,True),('drive',8,80,True),('deploy',6,100,False),
       ('water',8,100,True),('retract',6,100,False),('dry',4,250,True),
       ('refill',8,150,False),('sleep',4,500,True)]

def save_sheet(name,images,cell,columns,names,anchor,anims=None,extras=None):
 rows=math.ceil(len(images)/columns);w,h=cell
 sheet=canvas((w*columns,h*rows));frames={};frame_order=[]
 dest=OUT/'frames'/name;dest.mkdir(parents=True,exist_ok=True)
 for i,(im,n) in enumerate(zip(images,names)):
  assert im.size==cell
  x=i%columns*w;y=i//columns*h
  sheet.paste(im,(x,y));im.save(dest/(n+'.png'))
  frame={'index':i,'frame':{'x':x,'y':y,'w':w,'h':h},'anchor':{'x':anchor[0],'y':anchor[1]},'opaqueBounds':list(im.getbbox()) if im.getbbox() else None}
  if extras:frame.update(extras[i])
  frames[n]=frame;frame_order.append(n)
 sheet.save(OUT/(name+'.png'),optimize=True)
 meta={'meta':{'image':name+'.png','size':{'w':sheet.width,'h':sheet.height},'cell':{'w':w,'h':h},'columns':columns,'rows':rows,'scale':1,'filter':'nearest','alpha':'binary','facing':'left' if name=='rover' else None,'source':'Drawn at native resolution; source-game palette only'},'order':frame_order,'frames':frames,'animations':anims or {}}
 (OUT/(name+'.json')).write_text(json.dumps(meta,indent=2)+'\n')
 return meta

frames=[];names=[];extras=[];anims={}
for state,count,ms,loop in ANIMS:
 ids=[]
 for k in range(count):
  im,ex=robot(state,k);name=f'{state}_{k:02}'
  ids.append(name);frames.append(im);names.append(name);extras.append(ex)
 anims[state]={'frames':ids,'frameDurationMs':ms,'loop':loop}
rover=save_sheet('rover',frames,(32,32),8,names,(16,31),anims,extras)

# Water is separate from the robot; place the spray's origin on frame.emitter.
def effect(kind,k):
 im=canvas((16,16));d=ImageDraw.Draw(im)
 if kind=='spray':
  for lane in range(3):
   for j in range(3):
    t=((k+3*j+2*lane)%12)/12
    x=round(14-(6+lane*3)*t);y=round(1+13*t*t)
    dot(d,x,y,'water_mid' if j==2 else 'water')
    if t>.5 and y<15:dot(d,x,y+1,'water_mid')
 elif kind=='splash':
  for sx in (-1,1):
   x=7+sx*(k+1);y=13-(3-k)
   dot(d,x,y,'water');dot(d,x+sx,min(15,y+2),'water_mid')
  if k<2:line(d,[(6,14),(9,14)],'water_mid')
 else:
  for j in range(3):
   y=(k*3+j*5)%15;dot(d,7,y,'water');dot(d,7,min(15,y+1),'water_mid')
 return im
fx=[];fn=[];fa={}
for kind,n in [('spray',8),('splash',4),('refill',4)]:
 ids=[]
 for i in range(n):fx.append(effect(kind,i));fn.append(f'{kind}_{i:02}');ids.append(fn[-1])
 fa[kind]={'frames':ids,'frameDurationMs':100,'loop':kind!='splash','origin':{'x':14,'y':0} if kind=='spray' else {'x':7,'y':14}}
save_sheet('water-fx',fx,(16,16),8,fn,(7,14),fa)

# A compact refill post and charging pads; same ground anchor as actors.
def prop(kind,k):
 im=canvas();d=ImageDraw.Draw(im)
 if kind=='refill-post':
  rect(d,(10,5,23,27),'ink');rect(d,(11,6,22,26),'deep')
  rect(d,(12,8,21,22),'tank_dark')
  level=23-k*4
  if k>0:rect(d,(13,level,20,21),'tank');line(d,[(13,level),(20,level)],'water_mid')
  for y in [10,14,18]:line(d,[(20,y),(21,y)],'metal')
  rect(d,(10,4,23,6),'metal');line(d,[(11,4),(22,4)],'edge')
  line(d,[(11,11),(7,11),(7,14)],'ink',3);line(d,[(11,11),(7,11),(7,14)],'metal')
  rect(d,(10,27,12,30),'metal');rect(d,(21,27,23,30),'metal')
  rect(d,(9,31,24,31),'ink');dot(d,18,25,'lamp' if k>0 else 'ochre')
 elif kind=='dock':
  d.polygon([(3,28),(7,25),(25,25),(29,28),(29,31),(3,31)],fill=P['ink'])
  rect(d,(6,28,26,29),'metal');line(d,[(7,27),(25,27)],'deep')
  for x in [9,13,17,21]:dot(d,x,29,'tank' if k==0 else 'water_mid')
  dot(d,26,28,'lamp' if k else 'ochre')
 else:
  rect(d,(10,23,21,31),'ink');rect(d,(11,24,20,29),'soil');rect(d,(12,25,19,27),'ochre')
  if k:line(d,[(15,26),(15,21)],'leaf');line(d,[(15,23),(12,21)],'leaf_light');line(d,[(15,23),(18,20)],'leaf')
 return im
pr=[];pn=[]
for kind,n in [('refill-post',4),('dock',2),('seed-crate',2)]:
 for i in range(n):pr.append(prop(kind,i));pn.append(f'{kind}_{i:02}')
save_sheet('props',pr,(32,32),4,pn,(16,31))

# Pixel-native UI symbols. These are UI assets, not world objects.
ICONS={
 'water':['...##...','..####..','.######.','.######.','..####..','...##...'],
 'seed':['...#....','##.#.##.','.####...','...#....','..###...'],
 'pause':['.##..##.','.##..##.','.##..##.','.##..##.','.##..##.'],
 'return':['...#....','..#.....','.#######','..#....#','...#...#','.....###'],
 'refill':['.######.','.#....#.','.#.##.#.','.#.##.#.','.#.##.#.','.######.'],
 'dock':['........','........','..####..','.######.','##.##.##'],
 'rover':['.#......','##..###.','.#..#.#.','.######.','.#.##.#.'],
 'inspect':['..###...','.#...#..','.#...#..','..###...','.....#..','......#.']}
ui=[];un=[]
for name,rows in ICONS.items():
 im=canvas((16,16));d=ImageDraw.Draw(im);oy=(16-len(rows))//2
 for yy,row in enumerate(rows):
  for xx,v in enumerate(row):
   if v=='#':dot(d,4+xx,oy+yy,'water' if name=='water' else 'leaf_light')
 ui.append(im);un.append(name)
save_sheet('ui',ui,(16,16),8,un,(8,8))

palette={'source':'index.html C, FLOWER and PLANT_STEM (no external palette)','colors':COLORS}
(OUT/'palette.json').write_text(json.dumps(palette,indent=2)+'\n')

# Hard validation. Inspect the exported PNG pixels, not only source geometry.
report={'sourceCommit':'cca0f5c46ca2a2e55bdae52569984f44499d4b11','sourceFileSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'paletteAllFromSource':True,'atlases':{},'checks':[]}
allowed=set(P.values())|{TRANS}
for name in ['rover','water-fx','props','ui']:
 atlas=Image.open(OUT/(name+'.png')).convert('RGBA');md=json.loads((OUT/(name+'.json')).read_text())
 colors=set(zip(*[iter(atlas.tobytes())]*4));assert colors<=allowed,(name,colors-allowed)
 assert {c[3] for c in colors}<={0,255}
 for key,f in md['frames'].items():
  r=f['frame'];im=atlas.crop((r['x'],r['y'],r['x']+r['w'],r['y']+r['h']))
  ref=Image.open(OUT/'frames'/name/(key+'.png')).convert('RGBA')
  assert im.tobytes()==ref.tobytes(),key
  if name=='rover':
   assert im.getbbox()[3]==32,key
   assert all(im.getpixel((x,31))[3]==255 for x in (8,16,24)),key
   assert f['anchor']=={'x':16,'y':31}
 report['atlases'][name]={'width':atlas.width,'height':atlas.height,'frames':len(md['frames']),'visibleColors':len(colors)-1,'sha256':hashlib.sha256((OUT/(name+'.png')).read_bytes()).hexdigest()}
report['checks']=['binary alpha','source palette membership','integer source rectangles','exact PNG frame round-trip','stable (16,31) rover anchor','three grounded wheels in every pose','1x native PNGs; no full-frame resampling']
(OUT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
