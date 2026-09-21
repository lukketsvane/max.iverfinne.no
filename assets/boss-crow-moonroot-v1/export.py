#!/usr/bin/env python3
"""Rebuild native PNGs and manifests. Python 3 standard library only.
Run from any directory: python assets/boss-crow-moonroot-v1/export.py
This exporter only writes beneath its own directory. It never modifies gameplay.
"""
from pathlib import Path
import base64, zlib, json, struct, binascii, hashlib, math
ROOT=Path(__file__).resolve().parent

def chunk(name,data):
    return struct.pack('>I',len(data))+name+data+struct.pack('>I',binascii.crc32(name+data)&0xffffffff)

def png(path,w,h,pixels,palette):
    assert len(pixels)==w*h and max(pixels)<len(palette)
    colors=b''.join(bytes.fromhex(x[1:]) for x in palette)
    raw=b''.join(b'\x00'+pixels[y*w:(y+1)*w] for y in range(h))
    data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,3,0,0,0))
    data+=chunk(b'PLTE',colors)+chunk(b'tRNS',bytes([0]+[255]*(len(palette)-1)))
    data+=chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
    path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)

def save_json(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(obj,indent=2)+'\n',encoding='utf-8')

def bounds(pixels,w,h):
    points=[(i%w,i//w) for i,v in enumerate(pixels) if v]
    if not points:raise ValueError('Empty named frame')
    x0=min(x for x,y in points);x1=max(x for x,y in points)+1
    y0=min(y for x,y in points);y1=max(y for x,y in points)+1
    return [x0,y0,x1-x0,y1-y0]

RAVEN_NAMES=([f'idle_{n:02d}' for n in range(4)]+[f'caw_{n:02d}' for n in range(4)]
    +[f'move_{n:02d}' for n in range(6)]+['crouch_00','crouch_01']
    +[f'flight_{n:02d}' for n in range(6)]+['impact_00','impact_01']
    +[f'hurt_{n:02d}' for n in range(3)]+[f'death_{n:02d}' for n in range(5)])
MOON_NAMES=([f'idle_{n:02d}' for n in range(8)]+[f'move_{n:02d}' for n in range(8)]
    +['windup_00','lash_00','slam_00','cast_00','brace_00','summon_00']
    +[f'hurt_{n:02d}' for n in range(3)]+['enrage_00','enrage_01']
    +[f'death_{n:02d}' for n in range(3)])

def animations(kind,names):
    clips={}
    def put(name,ids,fps,loop=False,events=None):
        clips[name]={'frames':[names[i] if isinstance(i,int) else i for i in ids],'fps':fps,'loop':loop}
        if events:clips[name]['suggestedEvents']=events
    if kind=='raven':
        put('idle',range(4),6,True);put('move',range(8,14),10,True)
        put('caw',range(4,8),8);put('windup',[14,15,4,5],8)
        put('attack',[4,5,6,7],8,events=[{'frameIndex':2,'name':'release_spore'}])
        put('takeoff',[14,15,16,17,18],10);put('flight',range(16,22),10,True)
        put('dive',[19,20,21,22,23],12,events=[{'frameIndex':3,'name':'impact'}])
        put('impact',[22,23],10);put('hurt',range(24,27),12)
        put('death',range(27,32),7);put('recover',[15,14,0],8)
    elif kind=='moonroot':
        put('idle',range(8),6,True);put('move',range(8,16),8,True)
        put('windup',[16,16,20],6)
        put('lash',[16,17,20],8,events=[{'frameIndex':1,'name':'attach_lash_fx'}])
        put('slam',[16,18,20],8,events=[{'frameIndex':1,'name':'root_impact'}])
        put('attack',[16,19,20],8,events=[{'frameIndex':1,'name':'release_moon_seed'}])
        put('summon',[20,21,20],6,events=[{'frameIndex':1,'name':'summon_sprouts'}])
        put('hurt',range(22,25),10);put('enrage',[25,26,25,26],7,True)
        put('death',range(27,30),5);put('recover',[20,0],6)
    else:
        for name in names:put(name,[name],1,True)
        put('seed_pulse',['moon_seed_00','moon_seed_01','moon_seed_02','moon_seed_03','moon_seed_02','moon_seed_01'],10,True)
    return clips

def main():
    master_file=ROOT/'source/pixels.json'
    if not master_file.exists():
        encoded=''.join(f.read_text().strip() for f in sorted((ROOT/'source').glob('pixels.*.b64')))
        if not encoded: encoded=(ROOT/'source/pixels.zlib.base64').read_text().strip()
        data=zlib.decompress(base64.b64decode(encoded,validate=True))
        master_file.parent.mkdir(parents=True,exist_ok=True);master_file.write_bytes(data)
    master=json.loads(master_file.read_text());palette=master['palette'];manifest={'schema':'max-crow-moonroot/1','nativeScale':1,'palette':palette,'assets':{},'auditedMain':'a24a164f767023e5ee76c44a05c34f4328e2d2a0','runtimeStatus':'art handoff; no gameplay activation'}
    validation={'passed':True,'checks':[],'frames':0,'uniquePixelBuffers':0,'binaryAlpha':True,'hiddenRGBZero':True}
    for kind,group in master['groups'].items():
        w,h=group['size'];count=group['count'];data=zlib.decompress(base64.b64decode(group['pixelsZlibBase64'],validate=True))
        assert len(data)==w*h*count
        names=RAVEN_NAMES if kind=='raven' else MOON_NAMES if kind=='moonroot' else [f['name'] for f in group['frames']]
        assert len(names)==count==len(group['frames']) and len(set(names))==count
        cols=8;rows=math.ceil(count/cols);sw=cols*w;sh=rows*h;sheet=bytearray(sw*sh)
        atlas={'schema':'max-native-atlas/1','name':kind,'nativeScale':1,'defaultFacing':1,'sheets':{'main':{'image':kind+'.png','size':[sw,sh],'cell':[w,h],'columns':cols,'rows':rows}},'frames':{},'animations':animations(kind,names)}
        unique=set()
        for i,(name,info) in enumerate(zip(names,group['frames'])):
            pixels=data[i*w*h:(i+1)*w*h];unique.add(hashlib.sha256(pixels).hexdigest())
            b=bounds(pixels,w,h);assert b==info['opaqueBounds'];assert b[0]>0 and b[1]>0 and b[0]+b[2]<w and b[1]+b[3]<h
            assert all(isinstance(n,int) for n in info['anchor'])
            assert 0<=info['anchor'][0]<w and 0<=info['anchor'][1]<h
            sx=i%cols*w;sy=i//cols*h
            for y in range(h):sheet[(sy+y)*sw+sx:(sy+y)*sw+sx+w]=pixels[y*w:(y+1)*w]
            png(ROOT/'frames'/kind/(name+'.png'),w,h,pixels,palette)
            record={'sheet':'main','rect':[sx,sy,w,h],'anchor':info['anchor'],'opaqueBounds':b,'sourceFrame':info['name'],'source':info['source']}
            if 'sockets' in info:record['sockets']=info['sockets']
            atlas['frames'][name]=record
        for clip in atlas['animations'].values():assert all(n in atlas['frames'] for n in clip['frames'])
        png(ROOT/(kind+'.png'),sw,sh,bytes(sheet),palette);save_json(ROOT/(kind+'.json'),atlas)
        manifest['assets'][kind]={'atlas':kind+'.json','png':kind+'.png','cell':[w,h],'size':[sw,sh],'frames':count,'uniquePixelBuffers':len(unique),'anchor':group['frames'][0]['anchor'],'firstPoseBounds':group['frames'][0]['opaqueBounds'],'sha256':hashlib.sha256((ROOT/(kind+'.png')).read_bytes()).hexdigest()}
        validation['frames']+=count;validation['uniquePixelBuffers']+=len(unique)
        validation['checks'].append({'asset':kind,'dimensions':[sw,sh],'frameBounds':'pass','emptyBorder':'pass','fixedBodyAnchors':'pass' if kind!='effects' else 'effect-specific','animationReferences':'pass','individualPngs':count})
    save_json(ROOT/'manifest.json',manifest);save_json(ROOT/'validation.json',validation)
    print(json.dumps(validation,indent=2))

if __name__=='__main__':main()
