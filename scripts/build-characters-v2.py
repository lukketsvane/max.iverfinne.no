from pathlib import Path
import hashlib
import json
import importlib.util
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/asset-review/characters-v2/source'
PACK = ROOT / 'assets/characters-v2'
REVIEW = SOURCE.parent
NEAREST = Image.Resampling.NEAREST
SPECS = {
 'rattle-norvegicus-pink': {
  'skin': 'moss-pink', 'class': 'runner', 'scale': .17, 'keepParts': True, 'sourceAlpha': 240,
  'sourceLabel': 'five image_gen grey-rat magenta-and-gold ring-gear sheets, no hat or cape',
  'palette': ['0b1017','362f3d','586369','a3acaf','d7c8cb','9d7336','efd17e','8b174b','cf1769','ed5599','ffc0c7','3b1e18','9f3b1f','df763a','f59945','ce6f89'],
  'sources': {'ground': 'rattus-ring-v4-01.png', 'aerial': 'rattus-ring-v4-02.png', 'sweep': 'rattus-ring-v4-03.png', 'kicks': 'rattus-ring-v4-04.png', 'recovery': 'rattus-ring-v6-05.png'},
  'prompts': 'rattus-ring-v6-prompts.json',
  'sourceRowCenters': {
   'ground': [89,244,400,561,706,883,1053,1196],
   'aerial': [100,263,428,585,743,897,1051,1180],
   'sweep': [118,275,439,598,751,907,1057,1192],
   'kicks': [101,257,415,574,730,878,1025,1176],
   'recovery': [89,241,402,587,737,871,1023,1153],
  },
  'main': [
   [('ground',0,c) for c in range(8)],
   [('recovery',0,c) for c in range(8)],
   [('recovery',1,c) for c in range(8)],
   [('recovery',7,c) for c in range(8)],
   [('kicks',2,c) for c in [0,1,2,3,4,5,6,7]],
   [('sweep',7,1),('sweep',7,2),('recovery',3,6),('ground',7,0),('ground',3,2),('ground',3,6),('ground',0,0),('ground',0,0)],
   [('aerial',0,c) for c in range(8)],
   [('recovery',4,c) for c in range(8)],
  ],
  'interaction': [
   [('ground',0,0),('ground',3,6),('ground',3,2),('ground',7,0),('ground',7,0),('ground',7,6),('ground',3,2),('ground',7,0)],
   [('sweep',3,c) for c in range(8)],
   [('ground',0,0),('ground',3,2),('ground',7,0),('ground',7,1),('ground',7,2),('ground',7,1),('ground',7,2),('ground',7,0)],
   [('ground',3,c) for c in [0,2,1,3,4,5,6,7]],
   [('sweep',3,c) for c in [0,1,5,3,4,2,6,7]],
   [('ground',5,c) for c in [1,2,3,5]] + [('recovery',3,c) for c in [2,3,4,5]],
   [('ground',0,0),('ground',6,1),('ground',6,2),('ground',0,7),('ground',6,1),('ground',6,2),('ground',6,1),('ground',6,2)],
   [('recovery',6,c) for c in [7,0,1,2,3,3,3,3]],
  ],
 },
 'cairn': {
  'skin': 'ember', 'class': 'bulwark', 'scale': .18,
  'palette': ['131823','222b3b','344258','4b5062','696a79','858797','aea69d','d4bfa3','f6e3bd','f5b846','d98025','9b5a26','4c5030','788143','245762','5facb3'],
  'rows': [[42,172],[188,328],[341,475],[483,616],[617,799],[811,964],[996,1160]],
  'careRows': [[36,192],[194,341],[342,489],[490,635],[636,784],[788,938],[945,1094],[1096,1238]],
  'attack': [0,1,3,5,6,7,2,0],
 },
 'mycel': {
  'skin': 'moon', 'class': 'herbalist', 'scale': .18,
  'palette': ['191423','392032','642438','932a43','bd3a51','df5b62','f19381','f6dfb4','fff0d0','a88a64','68503b','244845','23756e','36aca0','70deba','c4f0cc'],
  'rows': [[40,176],[189,329],[336,486],[490,642],[643,813],[831,990],[1013,1186]],
  'careRows': [[13,177],[179,332],[334,491],[493,650],[656,808],[815,977],[980,1115],[1118,1244]],
  'attack': [1,2,4,6,7,0,3,1],
 },
}

def save_json(path, data):
 path.parent.mkdir(parents=True, exist_ok=True)
 text=json.dumps(data, indent=2) + '\n'
 if not path.exists() or path.read_text()!=text:path.write_bytes(text.encode('utf-8'))

def components(mask):
 """Eight-connected pixel groups; source matte and detached glow are rejected."""
 h,w = mask.shape
 seen=np.zeros_like(mask); result=[]
 for y,x in zip(*np.where(mask)):
  if seen[y,x]: continue
  todo=[(int(x),int(y))];seen[y,x]=True;group=[]
  while todo:
   px,py=todo.pop();group.append((px,py))
   for dy in (-1,0,1):
    for dx in (-1,0,1):
     xx,yy=px+dx,py+dy
     if 0<=xx<w and 0<=yy<h and mask[yy,xx] and not seen[yy,xx]:
      seen[yy,xx]=True;todo.append((xx,yy))
  result.append(group)
 return sorted(result,key=len,reverse=True)

def reduce_pose(cell, spec):
 # One fixed source-to-native scale per character, no per-frame stretch.
 native=cell.resize((round(cell.width*spec['scale']),round(cell.height*spec['scale'])),NEAREST)
 a=np.array(native);mask=a[:,:,3]>=210
 groups=components(mask)
 assert groups, 'empty source pose'
 # Keep the authored body and significant disconnected limb/tool pixels; reject
 # single-pixel reduction dust, stray glows and neighbouring projectile-only art.
 mask[:]=False
 for group in groups if spec.get('keepParts') else groups[:1]:
  for x,y in group: mask[y,x]=True
 palette=np.array([tuple(bytes.fromhex(c)) for c in spec['palette']],dtype=np.int32)
 distance=((a[:,:,:3].astype(np.int32)[:,:,None,:]-palette[None,None,:,:])**2).sum(axis=3)
 a[:,:,:3]=palette[distance.argmin(axis=2)]
 a[:,:,3]=mask.astype(np.uint8)*255;a[~mask,:3]=0
 out=Image.fromarray(a)
 return out.crop(out.getbbox())

def row_poses(image, bounds, spec, joined=False):
 row=image.crop((0,bounds[0],image.width,bounds[1])).convert('RGBA')
 a=np.array(row); groups=components(a[:,:,3]>=210)[:8]
 if joined:
  # Cairn's generated punch drawings overlap into one connected mass. Its
  # reviewed cell boundaries separate the successive complete-body poses.
  return [reduce_pose(row.crop((round(c*image.width/8),0,round((c+1)*image.width/8),row.height)),spec) for c in range(8)]
 assert len(groups)==8
 groups.sort(key=lambda g:sum(x for x,y in g)/len(g))
 poses=[]
 for group in groups:
  mask=np.zeros(a.shape[:2],dtype=bool)
  for x,y in group:mask[y,x]=True
  selected=a.copy();selected[~mask]=0
  cell=Image.fromarray(selected);cell=cell.crop(cell.getbbox())
  poses.append(reduce_pose(cell,spec))
 return poses

def register(pose, bottom):
 out=Image.new('RGBA',(32,32))
 assert pose.width<=32 and pose.height<=32, f'pose outside cell: {pose.size}'
 assert pose.height<=bottom, f'pose above cell: height {pose.height}, foot {bottom}'
 out.paste(pose,(16-pose.width//2,bottom-pose.height))
 return out

def rattle_poses(spec):
 poses={}
 for name,file in spec['sources'].items():
  pixels=np.array(Image.open(SOURCE/file).convert('RGBA'));found={}
  if spec.get('matte'):
   pixels[np.min(pixels[:,:,:3],axis=2)>=235]=0
  for group in components(pixels[:,:,3]>=spec.get('sourceAlpha',210)):
   if len(group)<1000:continue
   xs,ys=zip(*group)
   if max(ys)-min(ys)+1>185:continue
   cx,cy=sum(xs)/len(xs),sum(ys)/len(ys)
   row=min(range(len(spec['sourceRowCenters'][name])),key=lambda r:abs(cy-spec['sourceRowCenters'][name][r]))
   col=min(range(8),key=lambda c:abs(cx-(c+.5)*pixels.shape[1]/8))
   assert (row,col) not in found, f'{name} duplicate source cell {(row,col)}'
   found[row,col]=group
  used={(r,c) for sheet in ['main','interaction'] for cells in spec[sheet] for source,r,c in cells if source==name}
  for row,col in used:
   group=found[row,col];xs,ys=zip(*group)
   assert min(xs)>0 and min(ys)>0 and max(xs)<pixels.shape[1]-1 and max(ys)<pixels.shape[0]-1, f'{name} cropped source cell {(row,col)}'
   selected=np.zeros_like(pixels)
   for x,y in group:selected[y,x]=pixels[y,x]
   cell=Image.fromarray(selected);cell=cell.crop(cell.getbbox())
   poses[name,row,col]=reduce_pose(cell,spec)
 return {sheet:[[poses[source,row,col] for source,row,col in cells] for cells in spec[sheet]] for sheet in ['main','interaction']}

def main():
 PACK.mkdir(parents=True,exist_ok=True)
 original=json.loads((ROOT/'assets/max-skins-v1/source/original-poses.json').read_text())
 clips=json.loads((ROOT/'assets/max-skins-v1/source/animations.json').read_text())
 assets={};manifest=[];provenance=json.loads((SOURCE/'provenance.json').read_text());registration={}
 for ident,spec in SPECS.items():
  folder=PACK/ident;folder.mkdir(exist_ok=True)
  if 'sources' in spec:
   sourcefiles={name:SOURCE/file for name,file in spec['sources'].items()}
   if 'prompts' in spec:sourcefiles['prompts']=SOURCE/spec['prompts']
   rows=rattle_poses(spec);mainrows=rows['main'];carerows=rows['interaction']
  else:
   sourcefiles={sheet:SOURCE/f'{ident}-{sheet}.png' for sheet in ['main','interaction']}
   masters={sheet:Image.open(file).convert('RGBA') for sheet,file in sourcefiles.items()}
   poses=[row_poses(masters['main'],bounds,spec,ident=='cairn' and r==5) for r,bounds in enumerate(spec['rows'])]
   care=[row_poses(masters['interaction'],bounds,spec,ident=='cairn' and r==5) for r,bounds in enumerate(spec['careRows'])]
   attack=[care[5][c] for c in spec['attack']]
   landing=[poses[4][7],care[0][3],care[0][3],care[0][2],care[0][2],care[0][1],poses[0][0],poses[0][1]]
   mainrows=[poses[0],poses[1],poses[2],poses[3],poses[4],landing,attack,poses[3]]
   carerows=care[:];carerows[5]=attack
  images={};frames=[];reg=[]
  for sheet,rows in [('main',mainrows),('interaction',carerows)]:
   out=Image.new('RGBA',(256,256))
   for row,poseset in enumerate(rows):
    for col,pose in enumerate(poseset):
     ref=original[sheet][row*8+col]['bodyBounds']
     # Foot position is identical to the matching original gameplay cell.
     bottom=ref[3] if ref else 31
     tile=register(pose,bottom)
     out.paste(tile,(col*32,row*32))
     frames.append({'sheet':sheet,'rect':[col*32,row*32,32,32],'anchor':[16,31],'opaqueBounds':list(tile.getbbox())})
     entry={'sheet':sheet,'row':row,'column':col,'footBottom':bottom}
     if 'sources' in spec:
      source,sourceRow,sourceCol=spec[sheet][row][col]
      entry['sourceCell']=[sourceRow,sourceCol]
      entry['sourceFile']=spec['sources'][source]
     reg.append(entry)
   images[sheet]=out
   file=folder/f'{sheet}.png'
   if not file.exists() or Image.open(file).convert('RGBA').tobytes()!=out.tobytes():out.save(file,optimize=True)
  animations={}
  for name,a in clips.items():
   offset=0 if a['sheet']=='main' else 64
   animations[name]={'frames':[offset+a['row']*8+c for c in a['f']],'fps':a['fps'],'loop':a['loop']}
   for marker in ['hit','pour']:
    if marker in a:animations[name][marker]=a[marker]
  atlas={'schema':'max-native-atlas/v1','id':ident,'kind':'player-skin','classId':spec['class'],'compatibilitySkin':spec['skin'],
   'cell':[32,32],'anchor':[16,31],'cosmeticOnly':True,'facing':'right','palette':['#'+c for c in spec['palette']],
   'sheets':{s:{'image':s+'.png','size':[256,256]} for s in images},'frames':frames,'animations':animations,
   'presentation':{'attack':{'sheet':'interaction','row':5,'frames':[0,1,2,2,1]},'source':'image_gen original creature artwork'}}
  if 'sources' in spec:
   atlas['presentation']['source']=spec.get('sourceLabel',atlas['presentation']['source'])
   atlas['presentation']['wrestling']={
    'dropkick':{'sheet':'interaction','row':5,'frames':[0,1,2,3]},
    'salto':{'sheet':'main','row':6,'frames':list(range(8))},
    'splits':{'sheet':'interaction','row':5,'frames':[4,5,6,7]},
    'recovery':{'sheet':'main','row':5,'frames':list(range(8))},
   }
  save_json(folder/'atlas.json',atlas)
  assets[ident]={'manifest':atlas,'images':images};manifest.append({'id':ident,'manifest':ident+'/atlas.json'})
  registration[ident]=reg
  provenance[ident]={**provenance.get(ident,{}),**{s:{'path':file.relative_to(ROOT).as_posix(), 'sha256':hashlib.sha256(file.read_bytes()).hexdigest()} for s,file in sourcefiles.items()}}
 save_json(PACK/'manifest.json',{'schema':'max-native-pack/v1','id':'characters-v2','assets':manifest})
 save_json(REVIEW/'registration.json',registration);save_json(SOURCE/'provenance.json',provenance)
 preview(assets)
 # Preserve pending entries owned by other generators/agents.
 pendingPath=ROOT/'assets/figma-pending.json';pending=json.loads(pendingPath.read_text())
 production={f['path']:f['sha1'] for f in json.loads((ROOT/'assets/figma-manifest.json').read_text())['production']}
 position=next((i for i,f in enumerate(pending['files']) if f['path'].replace('\\','/').startswith('assets/characters-v2/')),len(pending['files']))
 pending['files']=[f for f in pending['files'] if not f['path'].replace('\\','/').startswith('assets/characters-v2/')]
 generated=[]
 for ident in SPECS:
  for sheet in ['main','interaction']:
   file=PACK/ident/f'{sheet}.png'
   path=file.relative_to(ROOT).as_posix();sha1=hashlib.sha1(file.read_bytes()).hexdigest()
   if production.get(path)==sha1:continue
   generated.append({'path':path,'sha1':sha1,'width':256,'height':256,
    'note':f'{ident.replace("-", " ").title()} original creature {sheet} poses; scripts/build-characters-v2.py. Generated source and full prompts retained; awaiting Figma production synchronization.'})
 pending['files'][position:position]=generated
 save_json(pendingPath,pending)
 print(f'Built {len(SPECS)} native character packs: {len(SPECS)*128} cells, {len(SPECS)*25} clips, {len(SPECS)*2} 256x256 sheets.')

def preview(assets):
 pink=assets['rattle-norvegicus-pink']
 sheets=Image.new('RGBA',(256,512))
 for i,sheet in enumerate(['main','interaction']):sheets.paste(pink['images'][sheet],(0,i*256))
 sheets.save(REVIEW/'rattle-pink-sheets-1x.png');sheets.resize((1024,2048),NEAREST).save(REVIEW/'rattle-pink-sheets-4x.png')
 planting=Image.new('RGB',(256,48),'#1b2431')
 for col in range(8):
  tile=pink['images']['interaction'].crop((col*32,64,col*32+32,96))
  planting.paste(tile,(col*32,0),tile)
 ImageDraw.Draw(planting).text((3,35),'pink planting / splits',fill='#d5d0bb')
 planting.save(REVIEW/'pink-planting-1x.png');planting.resize((1024,192),NEAREST).save(REVIEW/'pink-planting-4x.png')
 rattle=Image.new('RGBA',(256,512))
 for i,sheet in enumerate(['main','interaction']):rattle.paste(pink['images'][sheet],(0,i*256))
 rattle.save(REVIEW/'rattle-sheets-1x.png');rattle.resize((1024,2048),NEAREST).save(REVIEW/'rattle-sheets-4x.png')
 a=pink;moves=a['manifest']['presentation']['wrestling']
 planting=Image.new('RGB',(256,48),'#1b2431')
 for col in range(8):
  tile=a['images']['interaction'].crop((col*32,64,col*32+32,96))
  planting.paste(tile,(col*32,0),tile)
 ImageDraw.Draw(planting).text((3,35),'planting / splits',fill='#d5d0bb')
 planting.save(REVIEW/'planting-1x.png');planting.resize((1024,192),NEAREST).save(REVIEW/'planting-4x.png')
 combat=Image.new('RGB',(384,205),'#1b2431');d=ImageDraw.Draw(combat)
 for row,(name,clip) in enumerate(moves.items()):
  d.text((3,25+row*47),name,fill='#d5d0bb')
  for col,frame in enumerate(clip['frames']):
   tile=a['images'][clip['sheet']].crop((frame*32,clip['row']*32,frame*32+32,clip['row']*32+32))
   combat.paste(tile,(68+col*39,12+row*47),tile)
 combat.save(REVIEW/'wrestling-1x.png');combat.resize((1536,820),NEAREST).save(REVIEW/'wrestling-4x.png')
 animation=[]
 for tick in range(96):
  name=list(moves)[tick//24];clip=moves[name];frame=clip['frames'][(tick%24)*len(clip['frames'])//24]
  image=Image.new('RGB',(64,64),'#1b2431');d=ImageDraw.Draw(image)
  tile=a['images'][clip['sheet']].crop((frame*32,clip['row']*32,frame*32+32,clip['row']*32+32))
  image.paste(tile,(16,8),tile);d.text((3,49),name,fill='#d5d0bb')
  animation.append(image.resize((256,256),NEAREST))
 animation[0].save(REVIEW/'wrestling-4x.gif',save_all=True,append_images=animation[1:],duration=90,loop=0,disposal=2)
 labels=['idle','walk','run','rise','water','toss','lampHold','rest']
 im=Image.new('RGB',(384,158),'#1b2431');draw=ImageDraw.Draw(im)
 for i,label in enumerate(labels):draw.text((68+i*39,3),'lamp' if label=='lampHold' else label,fill='#d5d0bb')
 for y,(ident,a) in enumerate(assets.items()):
  draw.text((3,31+y*47),ident.split('-')[0],fill='#d5d0bb')
  for x,label in enumerate(labels):
   c=a['manifest']['animations'][label];idx=c['frames'][min(2,len(c['frames'])-1)]
   if label=='toss':idx=64+5*8+2
   f=a['manifest']['frames'][idx];sx,sy,w,h=f['rect'];tile=a['images'][f['sheet']].crop((sx,sy,sx+w,sy+h))
   im.paste(tile,(68+x*39,19+y*47),tile)
 im.save(REVIEW/'contact-1x.png');im.resize((im.width*4,im.height*4),NEAREST).save(REVIEW/'contact-4x.png')
 animation=[]
 for tick in range(96):
  image=Image.new('RGB',(192,68),'#1b2431');d=ImageDraw.Draw(image)
  name=['walk','run','water','toss'][tick//24]
  for i,(ident,a) in enumerate(assets.items()):
   c=a['manifest']['animations'][name];idx=c['frames'][int((tick%24)*.09*c['fps'])%len(c['frames'])]
   if name=='toss':idx=64+5*8+[0,1,2,2,1][int((tick%24)*.09*18)%5]
   f=a['manifest']['frames'][idx];x,y,w,h=f['rect'];tile=a['images'][f['sheet']].crop((x,y,x+w,y+h))
   image.paste(tile,(i*64+16,11),tile);d.text((i*64+7,48),ident.split('-')[0],fill='#d5d0bb')
  animation.append(image.resize((768,272),NEAREST))
 animation[0].save(REVIEW/'animations-4x.gif',save_all=True,append_images=animation[1:],duration=90,loop=0,disposal=2)

if __name__=='__main__':main()
