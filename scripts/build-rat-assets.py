#!/usr/bin/env python3
"""Rebuild exact native rat PNGs from the committed isolated indexed pixels.
Standard library only. No resizing, network access, fonts, or source-image dependency.
"""
import base64, json, struct, zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]/'assets/rat-enemies-v1'
def chunk(kind,data):
    return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
def png(path,w,h,pixels,palette):
    raw=b''.join(b'\0'+pixels[y*w:(y+1)*w] for y in range(h))
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,3,0,0,0))+chunk(b'PLTE',b''.join(bytes.fromhex(c[1:]) for c in palette))+chunk(b'tRNS',bytes([0]+[255]*(len(palette)-1)))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b''))
def main():
    data=json.loads((ROOT/'source-poses.json').read_text());w,h=data['cell'];names=data['names'];pixels=zlib.decompress(base64.b64decode(data['framesZlibBase64']));assert len(pixels)==len(names)*w*h
    variants={'common':data['palette'],'black':data['palette'][:],'albino':data['palette'][:],'plague':data['palette'][:]}
    variants['black'][2:8]=['#20232c','#2e323c','#3c424d','#505866','#69707b','#89929c']
    variants['albino'][2:8]=['#747280','#9c97a2','#b7b2bc','#d0c9d0','#e4dcd9','#f1e8dd']
    variants['plague'][2:8]=['#25352c','#374b36','#4b6042','#68774b','#8a905d','#abb679']
    animations={}
    for state,fps,loop in [('idle',6,True),('walk',8,True),('run',12,True),('jump',10,False),('attack',18,False),('hurt',12,False),('death',10,False)]:
        animations[state]={'frames':[n for n in names if n.startswith(state+'-')],'fps':fps,'loop':loop}
    animations['move']=animations['run'];animations['windup']={'frames':['idle-00','idle-01','idle-02','attack-00'],'fps':7,'loop':False};animations['recover']={'frames':['attack-03','attack-04','attack-05'],'fps':10,'loop':False}
    for variant,palette in variants.items():
        frames={};sheet=bytearray(w*8*h*5)
        for i,name in enumerate(names):
            f=pixels[i*w*h:(i+1)*w*h];x=(i%8)*w;y=(i//8)*h
            points=[(p%w,p//w) for p,c in enumerate(f) if c]
            bounds=[min(a for a,b in points),min(b for a,b in points),max(a for a,b in points)+1,max(b for a,b in points)+1] if points else [0,0,0,0]
            frames[name]={'sheet':'main','rect':[x,y,w,h],'anchor':data['anchor'],'opaqueBounds':bounds}
            for row in range(h):sheet[(y+row)*w*8+x:(y+row)*w*8+x+w]=f[row*w:(row+1)*w]
            png(ROOT/variant/'frames'/f'{name}.png',w,h,f,palette)
        png(ROOT/variant/'sprites.png',w*8,h*5,sheet,palette)
        atlas={'schema':'max-rat/1','id':'rat-'+variant,'palette':palette[1:],'sheets':{'main':{'image':'sprites.png','width':w*8,'height':h*5,'cell':[w,h]}},'frames':frames,'animations':animations,'pixelPolicy':{'scale':1,'alpha':[0,255],'filter':'nearest','anchor':data['anchor']}}
        (ROOT/variant/'atlas.json').write_text(json.dumps(atlas,separators=(',',':'))+'\n')
    (ROOT/'manifest.json').write_text(json.dumps({'schema':'max-rats/1','kind':8,'variants':{v:f'{v}/atlas.json' for v in variants},'sourcePoses':38,'isolatedFrames':156,'cell':[w,h],'anchor':data['anchor'],'footOffset':8},indent=2)+'\n')
    print('Rat assets: 4 atlases; 156 isolated PNGs; binary alpha; exact 48x32 cells.')
if __name__=='__main__':main()
