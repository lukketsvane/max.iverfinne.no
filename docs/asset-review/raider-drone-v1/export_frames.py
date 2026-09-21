#!/usr/bin/env python3
"""Validate native sheets, then export untrimmed/trimmed PNGs and animation strips.
Run: python export_frames.py [--check-only]
Requires Pillow. Does not resize artwork or write outside this asset directory.
"""
from pathlib import Path
from PIL import Image
import argparse, hashlib, json

ROOT=Path(__file__).resolve().parent

def run(check_only=False):
    atlas=json.loads((ROOT/'atlas.json').read_text())
    colors={tuple(bytes.fromhex(c[1:])) for c in atlas['palette']}
    loaded={}
    for key,sheet in atlas['sheets'].items():
        im=Image.open(ROOT/sheet['image']).convert('RGBA')
        assert im.size==(512,64),f'Wrong size: {key}'
        values=set(im.getdata())
        assert all(a in (0,255) for *_,a in values),f'Soft alpha: {key}'
        assert all((r,g,b) in colors for r,g,b,a in values if a),f'Foreign palette: {key}'
        assert all((r,g,b)==(0,0,0) for r,g,b,a in values if not a),f'Hidden RGB: {key}'
        loaded[key]=im
    rebuilt=loaded['airframe'].copy()
    rebuilt.alpha_composite(loaded['payloadFx'])
    assert rebuilt.tobytes()==loaded['drone2'].tobytes(),'Layer composition differs'
    assert all(not (a[3] and b[3]) for a,b in zip(loaded['airframe'].getdata(),loaded['payloadFx'].getdata())),'Overlapping layers'
    unique=set()
    for key,frame in atlas['frames'].items():
        x,y,w,h=frame['rect']; assert all(isinstance(n,int) for n in frame['rect'])
        assert w==h==64 and 0<=x<=448 and y==0
        assert frame['anchor']==[32,32]
        im=loaded[frame['sheet']].crop((x,y,x+w,y+h));bounds=im.getbbox()
        assert bounds and bounds[0]>0 and bounds[1]>0 and bounds[2]<64 and bounds[3]<64, key
        assert im.getpixel((32,32))[3]==255,'Missing anchor core'
        assert frame['trimmed']['offset']==list(bounds[:2])
        trim=im.crop(bounds);reassembled=Image.new('RGBA',(64,64))
        reassembled.paste(trim,tuple(frame['trimmed']['offset']))
        assert im.tobytes()==reassembled.tobytes(),key
        unique.add(hashlib.sha256(im.tobytes()).hexdigest())
        if not check_only:
            for folder in ['frames','trimmed','frames/airframe','frames/payload-fx']:(ROOT/folder).mkdir(parents=True,exist_ok=True)
            im.save(ROOT/'frames'/f'{key}.png');trim.save(ROOT/'trimmed'/f'{key}.png')
            if frame['sheet']=='drone2':
                for sheet,folder in [('airframe','airframe'),('payloadFx','payload-fx')]:
                    loaded[sheet].crop((x,y,x+w,y+h)).save(ROOT/'frames'/folder/f'{key}.png')
    assert len(unique)==len(atlas['frames'])==32,'Duplicate/absent source poses'
    for name,clip in atlas['animations'].items():
        assert clip['fps']>0 and isinstance(clip['loop'],bool)
        assert clip['frames'] and all(k in atlas['frames'] for k in clip['frames'])
        if not check_only:
            (ROOT/'strips').mkdir(exist_ok=True);strip=Image.new('RGBA',(64*len(clip['frames']),64))
            for i,key in enumerate(clip['frames']):
                frame=atlas['frames'][key];x,y,w,h=frame['rect'];strip.paste(loaded[frame['sheet']].crop((x,y,x+w,y+h)),(64*i,0))
            strip.save(ROOT/'strips'/f'{name}.png')
    if not check_only:
        master=Image.new('RGBA',(512,256))
        for row in range(4):master.paste(loaded[f'drone{row}'],(0,row*64))
        master.save(ROOT/'sprites.png')
    assert not atlas['animations']['death']['loop']
    report={'ok':True,'sourcePoses':32,'uniquePoses':len(unique),'clips':len(atlas['animations']),'sheetSize':[512,64],'cell':[64,64],'anchor':[32,32],'sourcePixelStep':5,'alpha':[0,255],'opaquePaletteColors':len(colors),'layerReassembly':'pixel-identical','nativeTrimReassembly':'pixel-identical','sha256':{s['image']:hashlib.sha256((ROOT/s['image']).read_bytes()).hexdigest() for s in atlas['sheets'].values()}}
    (ROOT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check-only',action='store_true')
    run(parser.parse_args().check_only)
