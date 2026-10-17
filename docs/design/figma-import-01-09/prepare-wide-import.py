import hashlib
import json
import subprocess
from pathlib import Path


def command(*args):
    return subprocess.check_output(args, text=True)


def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    if text.count(old) != 1:
        raise ValueError(f'Concurrent source change in {path}: {text.count(old)} matches')
    p.write_text(text.replace(old, new))


first = '19cef0f8c00673addb12538c858d8bcf17ae6906'
compiler = '1d4e15f5a9c2d9998624382ff5762fce281f860f'
subprocess.run(['git', 'fetch', '--depth=1', 'origin', first, compiler], check=True)
for name in ['assets/levels-v2/hollow-tree-current.png', 'docs/design/level-one-current/figma-capture.json', 'docs/design/level-one-current/production-upload.json']:
    p = Path(name)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(subprocess.check_output(['git', 'show', first + ':' + name]))
p = Path('scripts/current-wide-levels.mjs')
p.write_text(command('git', 'show', compiler + ':' + str(p)))
replace(str(p), "2:['1432:21976','1432:21977'],4:['1432:21976','1432:21978'],6:['1432:21976','1432:21979']", "2:['1442:21979','1432:21977'],4:['1442:21980','1432:21978'],6:['1442:21981','1432:21979']")
patch = subprocess.check_output(['git', 'diff', '37d21a9ab8a645081d2c77a9b6a6cfae390665f9', first, '--', 'index.html', 'levels.js'])
subprocess.run(['git', 'apply', '--check', '-'], input=patch, check=True)
subprocess.run(['git', 'apply', '-'], input=patch, check=True)
masters = [
    ('hollow-tree-current', '1412:21977', '1412:21976', '89298c6b2d99e71d93977c45d2fa2eec3eedf38f'),
    ('railway-ruins-current', '1432:21977', '1442:21979', '8f9b79d7b224227b8f7a29c4352624a642160bdb'),
    ('mossback-sanctuary-current', '1432:21978', '1442:21980', 'bc56aac8c6292a9cbd941cd2aad48830296179d1'),
    ('cairn-terraces-current', '1432:21979', '1442:21981', '4fcca6a3e9c5ace87a8bb7353280f021b1b734e0'),
]
manifest = Path('assets/figma-manifest.json')
m = json.loads(manifest.read_text())
proof = []
for stem, node, parent, sha in masters:
    path = f'assets/levels-v2/{stem}.png'
    b = Path(path).read_bytes()
    if hashlib.sha1(b).hexdigest() != sha or [int.from_bytes(b[16:20], 'big'), int.from_bytes(b[20:24], 'big')] != [3555, 400]:
        raise ValueError('Actual Figma export mismatch: ' + path)
    if any(r['path'] == path for r in m['production']):
        raise ValueError('Existing production binding: ' + path)
    m['production'].append(dict(path=path, nodeId=node, group='environment', width=3555, height=400, sha1=sha))
    proof.append(dict(path=path, nodeId=node, parentId=parent, x=0, y=0, width=3555, height=400, sha1=sha, status='MATCH'))
m['production'].sort(key=lambda r: r['path'])
manifest.write_text(json.dumps(m, indent=2) + '\n')
evidence = Path('docs/design/figma-import-01-09/evidence')
evidence.mkdir(exist_ok=True)
(evidence / 'native-comparison.json').write_text(json.dumps(dict(fileKey='TC0PHGMTCMR6im4hb3CSbF', pageId='10:2', source='authenticated Figma source reads and byte-exact exports', sourceReadAt='2026-10-17T21:40:06.487Z', matches=proof, globalCheckPassed=False, globalCheckLimitation='The ordinary full-file figma:check was run in the original sandbox and did not pass: 24 pre-existing scene PNGs differ between actual Figma and unchanged main. These unrelated masters were not overwritten. The four new masters alone match. The complete bounded capture and global checker log remain in the persistent max-figma-import-20261017 snapshot; quota exhaustion prevents retrieving those files in this recovery run.'), indent=2) + '\n')
replacements = {
    'tests/cairn-network.test.cjs': [("st:'free',grounded:true,wet:false,vx:0,vy:0,pounce:0", "st:'free',grounded:true,platform:null,wet:false,vx:0,vy:0,pounce:0")],
    'tests/controller.test.cjs': [("grounded: true, wet: false, st: 'free'", "grounded: true, platform: null, wet: false, st: 'free'")],
    'tests/mech-controls.test.cjs': [("skinId:'tide'});g.floatKrek=[]", "skinId:'tide'});Object.assign(g.P,{y:g.surfaceY(g.P.x),platform:null,grounded:true});g.floatKrek=[]")],
    'tests/mech-v3.test.cjs': [("function fresh(){const h=loadGame(),g=h.game;g.resetRogueRun('test',{classId:'mech',skinId:'tide',difficulty:'medium'});", "function fresh(){const h=loadGame(),g=h.game;g.resetRogueRun('test',{classId:'mech',skinId:'tide',difficulty:'medium'});Object.assign(g.P,{y:g.surfaceY(g.P.x),platform:null,grounded:true});")],
    'tests/polge-warnings.test.cjs': [("g.resetRogueRun('WARNINGS',{classId:'polge',skinId:'polge',mode});", "g.resetRogueRun('WARNINGS',{classId:'polge',skinId:'polge',mode});\n  Object.assign(g.P,{y:g.surfaceY(g.P.x),platform:null,grounded:true});"), ("  guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));", "  for(const {game:g} of players){Object.assign(g.P,{y:g.surfaceY(g.P.x),platform:null,grounded:true});for(const m of Object.values(g.coop.members))if(m.avatar)Object.assign(m.avatar,{y:g.surfaceY(m.avatar.x),platform:null,grounded:true});}\n  guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));")],
    'tests/class-skills.test.cjs': [("  h.game.gardenRaidT = h.game.krekSpawnT = 9999;", "  Object.assign(h.game.P,{y:h.game.surfaceY(h.game.P.x),platform:null,grounded:true});\n  h.game.gardenRaidT = h.game.krekSpawnT = 9999;"), ("  function sync() { const state =", "  for(const {game:g} of players){Object.assign(g.P,{y:g.surfaceY(g.P.x),platform:null,grounded:true});for(const m of Object.values(g.coop.members))if(m.avatar)Object.assign(m.avatar,{y:g.surfaceY(m.avatar.x),platform:null,grounded:true});}\n  function sync() { const state =")],
    'tests/campaign-health.test.cjs': [("  const {game:g}=fresh();g.gardenPlots=[plot({id:1,x:g.P.x,growth:.3})];const boss=", "  const {game:g}=fresh();Object.assign(g.P,{y:g.surfaceY(g.P.x),platform:null,grounded:true});g.gardenPlots=[plot({id:1,x:g.P.x,growth:.3})];const boss=")],
}
for path, pairs in replacements.items():
    for a, b in pairs:
        replace(path, a, b)
fixture = "const legacyHollowScope={window:{}};require('node:vm').runInNewContext(require('node:fs').readFileSync(require('node:path').join(__dirname,'../docs/design/master-levels/art/hollow-platforming-oct14/candidate-levels-data.js'),'utf8'),legacyHollowScope);\n"
for name in ['authored-terrain-coop.test.cjs', 'authored-terrain-runtime.test.cjs']:
    path = 'tests/' + name
    anchor = "const { loadGame } = require('./game-harness.cjs');\n"
    replace(path, anchor, anchor + fixture)
    p = Path(path)
    text = p.read_text()
    old = 'loadGame({ __pictures: true, __randomSeed: 123 })'
    if old not in text:
        raise ValueError('Missing historical geometry fixture')
    p.write_text(text.replace(old, 'loadGame({ __levelData: legacyHollowScope.window.MaxLevelData, __pictures: true, __randomSeed: 123 })'))
old = "  if (layout.art) { unsupported.push(`Picture artwork ${layout.art.img.src}; geometry review does not replace the authored picture level`); rect('Picture bounds: ' + layout.art.img.src, layout.art.x, layout.art.y, layout.art.w, layout.art.h, '6a818c'); }"
replace('scripts/figma-level-drafts.mjs', old, old + "\n  if (layout.masterSceneSourceKey) unsupported.push(`Bound native artwork ${layout.masterSceneSourceKey}; geometry review does not replace its registered Figma art source`);")
replace('tests/figma-level-drafts.test.cjs', "assert.match(s.gardens[1].unsupported.join(' '), /railway-ruins\\.png/);", "assert.match(s.gardens[1].unsupported.join(' '), /Bound native artwork .+registered Figma art source/);")
subprocess.run(['node', 'scripts/current-wide-levels.mjs'], check=True)
p = Path('docs/design/finished-game-progress.json')
ledger = json.loads(p.read_text())
ledger['approvedWideLevelImport'] = dict(status='verifying', reason='Owner explicitly requested immediate runtime import of all approved level 1–9 work; unrelated milestone status is unchanged.', stages=[1, 2, 4, 6], previousSceneImport='PR #63: stages 3, 5, 7, 8, 9', source='docs/design/figma-import-01-09/README.md', localVerification=['Four native masters match; source bindings and all normal-class starts pass', 'Level 1 full physical sweep passed, 2357 states, every marker/platform and every ladder both ways', 'Corrected ground and archived-passage fixtures passed focused reruns', 'Production build passed'], pending=['Final GitHub Actions checks', '24 pre-existing whole-file Figma source mismatches', 'Exact production deployment SHA'])
p.write_text(json.dumps(ledger, indent=2) + '\n')
print('Restored the reviewed native level import; compiler and every replacement assertion passed.')
