"""Compile generated district architecture into fixed native prop atlases.

Only the image_gen master supplies the artwork. Processing consists of reviewed
cell extraction, pair-consistent nearest-neighbour reduction, palette/alpha
normalization and integer ground registration. No runtime resizing is required.
"""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
PACK=ROOT/'assets/district-props-v1'
REVIEW=ROOT/'docs/asset-review/district-props-v1'
SOURCE=REVIEW/'source/master.png'
PALETTE=['121820','1c2a31','2b4146','3b5b5f','547c78','7e9d8c','b9bfa0','e6d6aa',
         '9a7136','cfa54e','f5d784','215964','408d91','70c8bc','b8f0d2','533d39']
NAMES=['relay','bells','salvage','watch','altar','cache']
LANDMARKS=['pump','arch','bell']
ROW_BOUNDS=[(8,246),(250,483),(485,691),(691,1086)]

def write_json(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(value,indent=2)+'\n')

def source_cell(image,row,col):
 y0,y1=ROW_BOUNDS[row]
 # The pump's broad foundation crosses the source's nominal first column.
 # Measured landmark cuts retain it without leaking a fragment into the arch.
 edges=[0,394,750,1086] if row==3 else [0,362,724,1086,1448]
 raw=image.crop((edges[col],y0,edges[col+1],y1)).convert('RGBA')
 a=np.array(raw);a[a[:,:,3]<210]=0
 a[a[:,:,3]>=210,3]=255
 raw=Image.fromarray(a)
 return raw.crop(raw.getbbox())

def native_cell(source,scale,size,anchor):
 small=source.resize((max(1,round(source.width*scale)),max(1,round(source.height*scale))),Image.Resampling.NEAREST)
 a=np.array(small);mask=a[:,:,3]>=210
 palette=np.array([tuple(bytes.fromhex(c)) for c in PALETTE],dtype=np.int32)
 distance=((a[:,:,:3].astype(np.int32)[:,:,None,:]-palette[None,None,:,:])**2).sum(axis=3)
 a[:,:,:3]=palette[distance.argmin(axis=2)];a[:,:,3]=mask.astype(np.uint8)*255;a[~mask,:3]=0
 small=Image.fromarray(a)
 # Centre the planted base, not an asymmetrical lamp head or opening pod lid.
 foot=np.where(mask[-min(3,small.height):].any(axis=0))[0]
 cx=round((int(foot.min())+int(foot.max()))/2) if len(foot) else small.width//2
 x=max(0,min(size[0]-small.width,anchor[0]-cx))
 y=anchor[1]+1-small.height
 out=Image.new('RGBA',size);out.paste(small,(x,y))
 assert out.getbbox() and out.getbbox()[3]==anchor[1]+1
 return out

def atlas(identifier,sheet,cell,anchor,images,names,columns,rows):
 out=Image.new('RGBA',(columns*cell[0],rows*cell[1]));frames=[];animations={}
 for index,(im,name) in enumerate(zip(images,names)):
  x=(index%columns)*cell[0];y=(index//columns)*cell[1]
  out.paste(im,(x,y))
  frames.append({'name':name,'sheet':sheet,'rect':[x,y,*cell],'anchor':anchor,'opaqueBounds':list(im.getbbox())})
  animations[name]={'frames':[index],'fps':1,'loop':True}
 data={'schema':'max-native-atlas/v1','id':identifier,'kind':'world-prop','cell':cell,'anchor':anchor,
       'palette':['#'+c for c in PALETTE],'sheets':{sheet:{'image':sheet+'.png','size':list(out.size)}},
       'frames':frames,'animations':animations}
 out.save(PACK/(sheet+'.png'),optimize=True);write_json(PACK/(sheet+'.json'),data)
 return out,data

def main():
 PACK.mkdir(parents=True,exist_ok=True)
 master=Image.open(SOURCE).convert('RGBA');assert master.size==(1448,1086)
 props={};scales={}
 for index,name in enumerate(NAMES):
  row=index//2;column=(index%2)*2
  pair=[source_cell(master,row,column+state) for state in range(2)]
  # Both states use exactly the same reduction; opening a pod never changes its
  # body scale. A 2 px side and 3 px top margin remains inside every 32 px cell.
  scale=min(28/max(im.width for im in pair),29/max(im.height for im in pair));scales[name]=scale
  props[name]=[native_cell(im,scale,(32,32),(16,31)) for im in pair]
 names=[name+'/'+state for state in ['idle','lit'] for name in NAMES]
 images=[props[name][state] for state in range(2) for name in NAMES]
 propsheet,propdata=atlas('district-props-v1','props',[32,32],[16,31],images,names,6,2)
 landmarks=[]
 for col,name in enumerate(LANDMARKS):
  src=source_cell(master,3,col);scale=min(46/src.width,62/src.height);scales[name]=scale
  landmarks.append(native_cell(src,scale,(48,64),(24,63)))
 landmarkSheet,landmarkData=atlas('district-landmarks-v1','landmarks',[48,64],[24,63],landmarks,LANDMARKS,3,1)
 write_json(PACK/'manifest.json',{'schema':'max-native-pack/v1','id':'district-props-v1','assets':[
  {'id':'district-props','manifest':'props.json'},{'id':'district-landmarks','manifest':'landmarks.json'}]})
 write_json(REVIEW/'source/provenance.json',{'tool':'built-in image_gen','source':str(SOURCE.relative_to(ROOT)),
  'sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'sourceSize':list(master.size),'sourceRows':ROW_BOUNDS,
  'reductionByObject':scales,'compiler':'scripts/build-district-props.py'})
 contact=Image.new('RGB',(256,187),'#1b2431');d=ImageDraw.Draw(contact)
 for i,name in enumerate(NAMES):
  x=7+i*41;d.text((x,2),name,fill='#e6d6aa')
  contact.paste(props[name][0],(x,17),props[name][0]);contact.paste(props[name][1],(x,53),props[name][1])
 for i,name in enumerate(LANDMARKS):
  x=15+i*81;d.text((x,98),name,fill='#e6d6aa');contact.paste(landmarks[i],(x,114),landmarks[i])
 contact.save(REVIEW/'contact-1x.png');contact.resize((1024,748),Image.Resampling.NEAREST).save(REVIEW/'contact-4x.png')
 pendingFile=ROOT/'assets/figma-pending.json';pending=json.loads(pendingFile.read_text())
 pending['files']=[f for f in pending['files'] if not f['path'].startswith('assets/district-props-v1/')]
 for sheet in ['props','landmarks']:
  file=PACK/(sheet+'.png');im=Image.open(file)
  pending['files'].append({'path':str(file.relative_to(ROOT)),'sha1':hashlib.sha1(file.read_bytes()).hexdigest(),
    'width':im.width,'height':im.height,'note':'Original generated district machinery and architecture; scripts/build-district-props.py. Figma local MCP unavailable; source and prompt retained.'})
 write_json(pendingFile,pending)
 print('Built 12 district prop states and three arena landmarks: native 32x32 / 48x64, 16-colour binary alpha.')

if __name__=='__main__':main()
