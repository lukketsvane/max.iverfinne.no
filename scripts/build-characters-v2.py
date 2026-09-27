"""Reproduce Kestrel, Cairn and Mycel from six image_gen source masters.

Generated masters are source artwork, never runtime atlases. This deterministic
compiler cuts their reviewed poses, reduces every pose at a fixed scale, applies
the character palette/binary alpha, and registers feet to the original 25 clips.
It does not trace Max or synthesize replacement creature silhouettes.
"""
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
 'kestrel': {
  'skin': 'moss', 'class': 'runner', 'scale': .165,
  'palette': ['14141e','282030','493044','643536','8e3c29','b94c2f','d8703b','e59f4b','f2ca75','f6e5ba','cbc49c','847550','35494c','32737a','60adb0','a7ded3'],
  'rows': [[30,164],[170,304],[308,447],[452,602],[603,773],[786,921],[930,1071],[1073,1236]],
  'careRows': [[28,174],[180,328],[330,480],[486,626],[627,789],[791,936],[942,1101],[1110,1240]],
  'attack': [0,1,3,5,6,7,2,0],
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
 path.write_text(json.dumps(data, indent=2) + '\n')

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
 for group in groups[:1]:
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
 out.paste(pose,(16-pose.width//2,bottom-pose.height))
 return out

def main():
 PACK.mkdir(parents=True,exist_ok=True)
 original=json.loads((ROOT/'assets/max-skins-v1/source/original-poses.json').read_text())
 clips=json.loads((ROOT/'assets/max-skins-v1/source/animations.json').read_text())
 assets={};manifest=[];provenance={};registration={}
 for ident,spec in SPECS.items():
  folder=PACK/ident;folder.mkdir(exist_ok=True)
  masters={sheet:Image.open(SOURCE/f'{ident}-{sheet}.png').convert('RGBA') for sheet in ['main','interaction']}
  poses=[row_poses(masters['main'],bounds,spec,ident=='cairn' and r==5) for r,bounds in enumerate(spec['rows'])]
  care=[row_poses(masters['interaction'],bounds,spec,ident=='cairn' and r==5) for r,bounds in enumerate(spec['careRows'])]
  attack=[care[5][c] for c in spec['attack']]
  # Landing uses the actual compression and recovery poses. The unused main row
  # previews the attack; the production interaction row 5 contains that attack.
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
     reg.append({'sheet':sheet,'row':row,'column':col,'footBottom':bottom})
   images[sheet]=out;out.save(folder/f'{sheet}.png',optimize=True)
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
  save_json(folder/'atlas.json',atlas)
  assets[ident]={'manifest':atlas,'images':images};manifest.append({'id':ident,'manifest':ident+'/atlas.json'})
  registration[ident]=reg
  provenance[ident]={s:{'path':str((SOURCE/f'{ident}-{s}.png').relative_to(ROOT)), 'sha256':hashlib.sha256((SOURCE/f'{ident}-{s}.png').read_bytes()).hexdigest()} for s in masters}
 save_json(PACK/'manifest.json',{'schema':'max-native-pack/v1','id':'characters-v2','assets':manifest})
 save_json(REVIEW/'registration.json',registration);save_json(SOURCE/'provenance.json',provenance)
 preview(assets)
 # Preserve pending entries owned by other generators/agents.
 pendingPath=ROOT/'assets/figma-pending.json';pending=json.loads(pendingPath.read_text())
 pending['files']=[f for f in pending['files'] if not f['path'].startswith('assets/characters-v2/')]
 for ident in SPECS:
  for sheet in ['main','interaction']:
   file=PACK/ident/f'{sheet}.png'
   pending['files'].append({'path':str(file.relative_to(ROOT)),'sha1':hashlib.sha1(file.read_bytes()).hexdigest(),'width':256,'height':256,
    'note':f'{ident.title()} original creature {sheet} poses; scripts/build-characters-v2.py. Figma MCP unavailable; generated source and full prompts retained.'})
 save_json(pendingPath,pending)
 print('Built three original characters: 384 native cells, 75 clips, six 256x256 sheets.')

def preview(assets):
 labels=['idle','walk','run','rise','water','toss','lampHold','rest']
 im=Image.new('RGB',(384,158),'#1b2431');draw=ImageDraw.Draw(im)
 for i,label in enumerate(labels):draw.text((68+i*39,3),'lamp' if label=='lampHold' else label,fill='#d5d0bb')
 for y,(ident,a) in enumerate(assets.items()):
  draw.text((3,31+y*47),ident,fill='#d5d0bb')
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
   image.paste(tile,(i*64+16,11),tile);d.text((i*64+7,48),ident,fill='#d5d0bb')
  animation.append(image.resize((768,272),NEAREST))
 animation[0].save(REVIEW/'animations-4x.gif',save_all=True,append_images=animation[1:],duration=90,loop=0,disposal=2)

if __name__=='__main__':main()
