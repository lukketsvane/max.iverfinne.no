"""Validate exported sprites against the real game animation and pixel contracts."""
from pathlib import Path
import base64, io, json, re, subprocess, importlib.util
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
source=(ROOT/'index.html').read_text()

def game_animations():
 code=[]
 for name in ['ANIM','ANIM2']:
  match=re.search(r'var\s+'+name+r'\s*=\s*(\{.*?\n\});',source,re.S)
  assert match, f'Missing original {name}'
  code.append(f'const {name} = {match[1]};')
 code.append('console.log(JSON.stringify(Object.fromEntries([...Object.entries(ANIM).map(([k,v])=>[k,{...v,sheet:"main"}]), ...Object.entries(ANIM2).map(([k,v])=>[k,{...v,sheet:"interaction"}])])));')
 return json.loads(subprocess.check_output(['node','-e','\n'.join(code)],text=True))

def original_sheets():
 result={}
 for name,key in [('SHEET_SRC','main'),('SHEET2_SRC','interaction')]:
  match=re.search(name+r'\s*=\s*[\'\"]data:image/png;base64,([^\'\"]+)',source)
  assert match, f'Missing original {name}'
  result[key]=Image.open(io.BytesIO(base64.b64decode(match[1]))).convert('RGBA')
 return result

def main():
 originals=game_animations()
 sheets=original_sheets()
 spec=importlib.util.spec_from_file_location('compiler',ROOT/'scripts/build-native-art.py')
 compiler=importlib.util.module_from_spec(spec);spec.loader.exec_module(compiler)
 expected=json.loads((ROOT/'assets/max-skins-v1/source/animations.json').read_text())
 for name,a in originals.items():
  assert {k:v for k,v in a.items() if k!='sh'} == expected[name], f'Original animation changed: {name}'
 assert originals.keys()==expected.keys()
 count=0;clip_count=0;png_bytes=0
 paths=list((ROOT/'assets').glob('*-v1/*/atlas.json'))
 paths += [ROOT/'assets/boss-milestones-v1/native'/f'{name}.json' for name in ['05-mossback','10-bellkeeper','15-moon-moth']]
 for path in sorted(paths):
  d=json.loads(path.read_text());ident=d['id'];w,h=d['cell'];ax,ay=d['anchor']
  assert d['schema']=='max-native-atlas/v1' and 0<=ax<w and 0<=ay<h
  images={};palette={tuple(bytes.fromhex(c[1:])) for c in d['palette']}
  for key,sheet in d['sheets'].items():
   p=path.parent/sheet['image'];im=Image.open(p).convert('RGBA');a=np.array(im)
   assert list(im.size)==sheet['size'] and im.width%w==0 and im.height%h==0
   assert set(np.unique(a[:,:,3]))<={0,255}, f'Nonbinary alpha: {ident}'
   colours={tuple(p[:3]) for p in a.reshape(-1,4) if p[3]}
   assert colours<=palette, f'Off-palette pixels: {ident}'
   assert np.all(a[a[:,:,3]==0,:3]==0), f'Hidden RGB: {ident}'
   images[key]=im;png_bytes+=p.stat().st_size
  for f in d['frames']:
   x,y,fw,fh=f['rect'];im=images[f['sheet']]
   assert (fw,fh)==(w,h) and x%w==0 and y%h==0
   assert x>=0 and y>=0 and x+fw<=im.width and y+fh<=im.height
   assert f['anchor']==d['anchor']
   cell=im.crop((x,y,x+fw,y+fh));box=cell.getbbox()
   assert (list(box) if box else None)==f['opaqueBounds']
   if path.parent.name=='native':
    individual=Image.open(path.parent/f['image']).convert('RGBA')
    assert individual.size==(32,32) and np.array_equal(np.array(cell),np.array(individual)), f'Individual frame mismatch: {ident}'
    if box:assert box[3] in ([31,32] if ident=='moon-moth' else [32]), f'Foot mismatch: {ident}'
  for name,clip in d['animations'].items():
   assert clip['fps']>0 and type(clip['loop']) is bool and clip['frames']
   for index in clip['frames']:assert 0<=index<len(d['frames'])
   for key in ['hit','pour']:
    if key in clip:
     for value in (clip[key] if isinstance(clip[key],list) else [clip[key]]):assert 0<=value<len(clip['frames'])
   if name!='death':
    assert all(d['frames'][i]['opaqueBounds'] for i in clip['frames']), f'Empty {ident}/{name}'
  if d['kind']=='player-skin':
   assert (w,h,ax,ay)==(32,32,16,31) and len(d['frames'])==128
   assert d['animations'].keys()==expected.keys()
   for name,original in expected.items():
    a=d['animations'][name];offset=0 if original['sheet']=='main' else 64
    assert a['frames']==[offset+original['row']*8+i for i in original['f']]
    for key in ['fps','loop','hit','pour']:assert a.get(key)==original.get(key)
   for f in d['frames']:
    x,y,fw,fh=f['rect'];box=(x,y,x+fw,y+fh)
    old=compiler.components(np.array(sheets[f['sheet']].crop(box))[:,:,3]>=128)
    new=compiler.components(np.array(images[f['sheet']].crop(box))[:,:,3]>=128)
    if old and new:assert compiler.bbox(old[0])[3]==compiler.bbox(new[0])[3], f'Foot mismatch: {ident}/{f["sheet"]}/{x}/{y}'
  else:
   assert (w,h)==((32,32) if d['kind']=='boss' else (16,16))
   death=d['animations']['death'];assert not death['loop'] and not d['frames'][death['frames'][-1]]['opaqueBounds']
   if d['kind']=='boss' and path.parent.name=='native':
    assert (w,h,ax,ay)==(32,32,16,31) and len(d['frames'])==64
    for row,name in enumerate(['idle','move','windup','attack','recover','vulnerable','hurt','death']):
     clip=d['animations'][name]
     assert clip['frames']==list(range(row*8,row*8+8))
     assert clip['loop']==(name in ['idle','move','vulnerable'])
     for index in clip['frames']:
      frame=d['frames'][index];x,y,fw,fh=frame['rect']
      pixels=np.array(images[frame['sheet']].crop((x,y,x+fw,y+fh)))
      visible={tuple(p[:3]) for p in pixels.reshape(-1,4) if p[3]}
      for signal,state in [('cyanColors','vulnerable'),('amberColors','windup')]:
       signal_colors={tuple(bytes.fromhex(c[1:])) for c in d['signals'][signal]}
       if name!=state:assert not visible&signal_colors, f'Incorrect {signal} in {ident}/{name}'
       elif signal=='cyanColors':assert visible&signal_colors, f'Missing exposure signal: {ident}/{index}'
   elif d['kind']=='boss':
    for phase in range(1,4):
     for state in ['idle','windup','attack','recover','vulnerable','hurt']:assert f'phase{phase}/{state}' in d['animations']
   else:
    for state in ['idle','move','windup','attack','recover','hurt','death']:assert state in d['animations']
  count+=len(d['frames']);clip_count+=len(d['animations'])
 print(f'PASS: {count} cells, {clip_count} clips; binary alpha, fixed palettes, bounds, anchors, original gameplay markers. {png_bytes:,} bytes of runtime PNGs.')

if __name__=='__main__':main()
