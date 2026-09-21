"""Pack generated review art at the game's native pixel scale.

Sources are already nearest-neighbour reductions of the generated masters.
This pass only quantises colours/alpha, removes detached resampling specks,
registers player feet to original poses, and packs fixed cells/metadata.
Requires Pillow and numpy. No runtime/gameplay code is modified.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SKINS = ROOT / 'assets/max-skins-v1'
ENEMIES = ROOT / 'assets/enemies-v1'
NEAREST = Image.Resampling.NEAREST
COMMON = ['10141c','1e1e26','302d35','b08469','dbba97','f2d8b1',
          '283f40','486662','738e78','d8ad50','806846']
COLOURS = {
 'moss': COMMON + ['25311e','404d2b','667241','8d9559','b5ac70'],
 'tide': COMMON + ['102934','173f4c','285d6b','4d8190','90b4b0'],
 'ember': COMMON + ['382426','663d35','95523c','b77754','d4b78c'],
 'moon': COMMON + ['29283d','45405d','6d607e','94849c','b2a6b5'],
 'seed-thief': ['111819','16282a','1d3b38','2e4a3b','415540','686445','ae8950','d4bd78','d9aa4b','e3be72'],
 'spore-caster': ['161a26','35283d','493650','665071','847088','a38b9c','303a2f','485844','758164','d6af55','edc878'],
 'shield-beetle': ['121a1b','29382f','3c4a35','4f5c3e','666d46','858457','c0b789','d9aa4b','edc878'],
 'healing-moth': ['172222','294745','46625b','68867a','839c8b','a6b5a0','d4cfaa','79b7b0','acd6c5','d9aa4b'],
 'hollow-crown': ['10171c','1d2b34','2b4645','3d5146','536448','605047','82725b','b5b190',
                  '795526','ab7833','d4a64e','f1cd79','4b8e92','77bbb9'],
}

def save_json(path, value):
 path.parent.mkdir(parents=True, exist_ok=True)
 path.write_text(json.dumps(value, indent=2) + '\n')

def components(mask):
 h,w=mask.shape; seen=set(); result=[]
 for y,x in zip(*np.where(mask)):
  if (x,y) in seen: continue
  stack=[(int(x),int(y))]; seen.add((x,y)); part=[]
  while stack:
   p=stack.pop(); part.append(p)
   for dy in [-1,0,1]:
    for dx in [-1,0,1]:
     q=(p[0]+dx,p[1]+dy)
     if 0<=q[0]<w and 0<=q[1]<h and mask[q[1],q[0]] and q not in seen:
      seen.add(q);stack.append(q)
  result.append(part)
 return sorted(result, key=len, reverse=True)

def bbox(points):
 if not points:return None
 xs,ys=zip(*points);return [min(xs),min(ys),max(xs)+1,max(ys)+1]

def clean(cell, ident, row, boss=False):
 a=np.array(cell.convert('RGBA')); mask=a[:,:,3]>=128
 groups=components(mask)
 if groups:
  keep=groups[0][:]
  for g in groups[1:]:
   if ident in ['moss','tide','ember','moon']:
    if len(g)>=2:keep+=g
   elif boss:
    # Keep the floating amber/cyan core inside the trunk; reject an adjacent
    # frame's disconnected root tip. Death legitimately contains fragments.
    if row==15 or any(10<=x<=23 and 10<=y<=28 for x,y in g):keep+=g
   elif len(g)>=2 or row in [3,6,7]:keep+=g
  mask[:]=False
  for x,y in keep:mask[y,x]=True
 palette=np.array([tuple(bytes.fromhex(c)) for c in COLOURS[ident]],dtype=np.int32)
 rgb=a[:,:,:3].astype(np.int32)
 distances=((rgb[:,:,None,:]-palette[None,None,:,:])**2).sum(axis=3)
 a[:,:,:3]=palette[distances.argmin(axis=2)]
 a[:,:,3]=mask.astype(np.uint8)*255;a[~mask,:3]=0
 return Image.fromarray(a), bbox(groups[0]) if groups else None

def shift(cell, dy):
 out=Image.new('RGBA',cell.size);out.paste(cell,(0,dy));return out

def frame_record(image, col, row, cell, anchor, sheet):
 tile=image.crop((col*cell,row*cell,(col+1)*cell,(row+1)*cell))
 return {'sheet':sheet,'rect':[col*cell,row*cell,cell,cell],
         'anchor':anchor,'opaqueBounds':list(tile.getbbox()) if tile.getbbox() else None}

def stamp(draw,xy,text,fill='#bccbc1'):
 draw.text(xy,text,fill=fill,font=ImageFont.load_default(size=9))

def previews(pack, assets, is_skin):
 # 1x and exact 4x contact sheets plus a timed animation of the actual PNGs.
 names=list(assets)
 columns=['idle','walk','run','crouch','water','lampHold','rest'] if is_skin else ['idle','move','windup','attack','recover','hurt','special']
 cell=32;slot=46;width=100+len(columns)*slot;height=24+len(names)*50
 contact=Image.new('RGB',(width,height),'#1c242b');d=ImageDraw.Draw(contact)
 for i,col in enumerate(columns):stamp(d,(100+i*slot,5),col)
 for y,name in enumerate(names):
  stamp(d,(4,35+y*50),name)
  for x,col in enumerate(columns):
   data=assets[name];anims=data['manifest']['animations'];key=col
   if not is_skin:
    key=data['special'] if col=='special' else col
    if name=='hollow-crown':key='phase1/'+('vulnerable' if col=='special' else ('idle' if col=='move' else 'recover' if col=='hurt' else col))
   if key not in anims:continue
   c=anims[key];num=c['frames'][min(3,len(c['frames'])-1)]
   f=data['manifest']['frames'][num];image=data['images'][f['sheet']];r=f['rect']
   tile=image.crop((r[0],r[1],r[0]+r[2],r[1]+r[3]));ax,ay=f['anchor']
   contact.paste(tile,(100+x*slot+16-ax,25+y*50+31-ay),tile)
 folder=pack/'preview';folder.mkdir(exist_ok=True)
 contact.save(folder/'contact-1x.png');contact.resize((width*4,height*4),NEAREST).save(folder/'contact-4x.png')
 gif=[]
 for tick in range(80):
  frame=Image.new('RGB',(max(256,len(names)*62+12),86),'#1c242b');dr=ImageDraw.Draw(frame)
  for i,name in enumerate(names):
   data=assets[name];anims=data['manifest']['animations']
   key=(['walk','run','water','lampHold'][tick//20] if is_skin else ['move','windup','attack','special'][tick//20])
   if not is_skin:
    if key=='special':key=data['special']
    if name=='hollow-crown':key='phase'+str(1+(tick//28)%3)+'/'+('idle' if key=='move' else 'vulnerable' if key=='vulnerable' else key)
   if key not in anims:key=next(iter(anims))
   c=anims[key];local=(tick%20)/10;step=int(local*c['fps'])
   step=step%len(c['frames']) if c['loop'] else min(step,len(c['frames'])-1)
   f=data['manifest']['frames'][c['frames'][step]];r=f['rect'];tile=data['images'][f['sheet']].crop((r[0],r[1],r[0]+r[2],r[1]+r[3]))
   x=i*62+31;frame.paste(tile,(x-f['anchor'][0],48-f['anchor'][1]),tile)
   stamp(dr,(i*62+3,59),name[:11]);stamp(dr,(i*62+3,72),key.split('/')[-1])
  gif.append(frame.resize((frame.width*4,frame.height*4),NEAREST))
 gif[0].save(folder/'animations-4x.gif',save_all=True,append_images=gif[1:],duration=100,loop=0,disposal=2,optimize=True)

def build_skins():
 reference=json.loads((SKINS/'source/original-poses.json').read_text())
 original_anims=json.loads((SKINS/'source/animations.json').read_text())
 assets={}; summary=[]; shifts={}
 for ident in ['moss','tide','ember','moon']:
  src=Image.open(SKINS/'source'/f'{ident}.png').convert('RGBA');assert src.size==(256,512)
  images={};frames=[];shiftlog=[]
  for sheet,offset in [('main',0),('interaction',8)]:
   out=Image.new('RGBA',(256,256))
   for row in range(8):
    for col in range(8):
     y=(row+offset)*32;cell,body=clean(src.crop((col*32,y,(col+1)*32,y+32)),ident,row)
     target=reference[sheet][row*8+col]['bodyBounds'];dy=target[3]-body[3] if body and target else 0
     cell=shift(cell,dy);out.paste(cell,(col*32,row*32))
     shiftlog.append(dy)
   (SKINS/ident).mkdir(exist_ok=True);out.save(SKINS/ident/f'{sheet}.png');images[sheet]=out
   for row in range(8):
    for col in range(8):frames.append(frame_record(out,col,row,32,[16,31],sheet))
  anims={}
  for name,a in original_anims.items():
   offset=0 if a['sheet']=='main' else 64
   anims[name]={'frames':[offset+a['row']*8+c for c in a['f']],
                'fps':a['fps'],'loop':a['loop']}
   for k in ['hit','pour']:
    if k in a:anims[name][k]=a[k]
  manifest={'schema':'max-native-atlas/v1','id':ident,'kind':'player-skin','cell':[32,32],
   'anchor':[16,31],'cosmeticOnly':True,'facing':'right','palette':['#'+c for c in COLOURS[ident]],
   'sheets':{'main':{'image':'main.png','size':[256,256]},'interaction':{'image':'interaction.png','size':[256,256]}},
   'frames':frames,'animations':anims}
  save_json(SKINS/ident/'atlas.json',manifest)
  assets[ident]={'manifest':manifest,'images':images};summary.append({'id':ident,'manifest':ident+'/atlas.json'})
  shifts[ident]={'min':min(shiftlog),'max':max(shiftlog),'perFrameY':shiftlog}
 save_json(SKINS/'manifest.json',{'schema':'max-native-pack/v1','id':'max-skins-v1','assets':summary})
 save_json(SKINS/'registration.json',shifts)
 previews(SKINS,assets,True)
 return assets

def build_enemies():
 assets={};summary=[]
 specials={'seed-thief':'carry','spore-caster':'channel','shield-beetle':'guard','healing-moth':'heal','hollow-crown':'vulnerable'}
 for ident in specials:
  boss=ident=='hollow-crown';sz=32 if boss else 16;rows=16 if boss else 8
  src=Image.open(ENEMIES/'source'/f'{ident}.png').convert('RGBA');assert src.size==(sz*8,sz*rows)
  out=Image.new('RGBA',src.size)
  for row in range(rows):
   for col in range(8):
    tile,body=clean(src.crop((col*sz,row*sz,(col+1)*sz,(row+1)*sz)),ident,row,boss)
    if not boss and ident!='healing-moth' and body:
     tile=shift(tile,sz-body[3])
    # The authored beetle hurt row has seven poses; return to idle at its end.
    if ident=='shield-beetle' and row==5 and col==7:
     tile=out.crop((0,0,sz,sz))
    if (boss and row==15 and col==7) or (not boss and row==6 and col==7):tile=Image.new('RGBA',(sz,sz))
    out.paste(tile,(col*sz,row*sz))
  (ENEMIES/ident).mkdir(exist_ok=True);out.save(ENEMIES/ident/'sprites.png')
  frames=[frame_record(out,col,row,sz,[sz//2,sz-1],'sprites') for row in range(rows) for col in range(8)]
  anims={}
  if boss:
   for phase in range(1,4):
    for j,name in enumerate(['idle','windup','attack','recover','vulnerable']):
     row=(phase-1)*5+j
     anims[f'phase{phase}/{name}']={'frames':list(range(row*8,row*8+8)),
      'fps':8/1.4 if name=='windup' else 8,'loop':name in ['idle','vulnerable']}
    # A hurt flash belongs to the game's damage renderer, not a new timeline.
    anims[f'phase{phase}/hurt']={'frames':[(phase-1)*40+24], 'fps':10,'loop':False}
   anims['death']={'frames':list(range(120,128)),'fps':8,'loop':False}
  else:
   for row,name in enumerate(['idle','move','windup','attack','recover','hurt','death',specials[ident]]):
    fps=8/.95 if ident=='spore-caster' and name=='windup' else 8
    anims[name]={'frames':list(range(row*8,row*8+8)),'fps':fps,'loop':name in ['idle','move',specials[ident]]}
   if ident=='shield-beetle':anims['exposed']={'frames':list(range(32,40)),'fps':8,'loop':True}
  manifest={'schema':'max-native-atlas/v1','id':ident,'kind':'boss' if boss else 'enemy','cell':[sz,sz],
   'anchor':[sz//2,sz-1],'facing':'right','palette':['#'+c for c in COLOURS[ident]],
   'sheets':{'sprites':{'image':'sprites.png','size':list(out.size)}},'frames':frames,'animations':anims,
   'signals':{'windup':'amber','vulnerable':'cyan'} if boss else {'windup':'amber'}}
  if boss:manifest['phases']=[{'phase':1,'healthAbove':2/3},{'phase':2,'healthAbove':1/3},{'phase':3,'healthAbove':0}]
  save_json(ENEMIES/ident/'atlas.json',manifest)
  assets[ident]={'manifest':manifest,'images':{'sprites':out},'special':specials[ident]};summary.append({'id':ident,'manifest':ident+'/atlas.json'})
 save_json(ENEMIES/'manifest.json',{'schema':'max-native-pack/v1','id':'enemies-v1','assets':summary})
 previews(ENEMIES,assets,False)
 return assets

if __name__=='__main__':
 build_skins();build_enemies();print('Built four player skins, four enemies and Hollow Crown at native resolution.')
