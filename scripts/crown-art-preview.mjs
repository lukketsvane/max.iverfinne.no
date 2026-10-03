#!/usr/bin/env node
// Offline native-scale art review. It never changes the runtime master.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [candidateRoot, output = '/workspace/scratch/crown-native-art-preview.html'] = process.argv.slice(2);
if (!candidateRoot) throw Error('Usage: node scripts/crown-art-preview.mjs <candidate-root> [output.html]');
const pack = repository => {
  const directory = join(repository, 'assets/crown-ascendant-v1'), atlas = JSON.parse(readFileSync(join(directory, 'atlas.json')));
  return { atlas, sheets: Object.fromEntries(Object.entries(atlas.sheets).map(([key, sheet]) => [key, 'data:image/png;base64,' + readFileSync(join(directory, sheet.image)).toString('base64')])) };
};
const data = { current: pack(root), candidate: pack(resolve(candidateRoot)), player: 'data:image/png;base64,' + readFileSync(join(root, 'assets/characters-v2/cairn/main.png')).toString('base64') };
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Hollow Crown native art comparison</title>
<style>body{margin:24px;background:#0b111b;color:#e8f0f4;font:16px system-ui}h1{font-size:24px}label{display:inline-flex;gap:8px;align-items:center;margin:0 16px 16px 0}select,button,input{font:inherit}section{display:flex;gap:24px;flex-wrap:wrap}h2{font-size:18px}canvas{width:768px;height:384px;max-width:100%;image-rendering:pixelated;background:#182531;border:1px solid #405566}.note{max-width:900px;color:#a7becb}small{display:block;margin-top:8px}</style>
<h1>Hollow Crown · native art comparison</h1><p class="note">Both characters use their native pixels and fixed foot anchors. Only the whole review canvas is enlarged. The reference player uses its actual 32×32 source cell.</p>
<label>Clip <select id="clip"></select></label><label><button id="play">Pause</button></label><label>Pose <input id="pose" type="range" min="0" max="5" value="0"></label>
<section><article><h2>Previous master</h2><canvas id="current" width="256" height="128"></canvas><small id="current-info"></small></article><article><h2>Candidate master</h2><canvas id="candidate" width="256" height="128"></canvas><small id="candidate-info"></small></article></section>
<script>const data=${JSON.stringify(data)},images={},player=new Image();let playing=true,frame=0;const select=document.querySelector('#clip'),pose=document.querySelector('#pose');
for(const name of Object.keys(data.candidate.atlas.animations)){const option=document.createElement('option');option.value=option.textContent=name;select.append(option)}
async function load(){player.src=data.player;await player.decode();for(const key of ['current','candidate']){images[key]={};for(const[sheet,url]of Object.entries(data[key].sheets)){const image=new Image();image.src=url;await image.decode();images[key][sheet]=image}}requestAnimationFrame(draw)}
function draw(time){frame=playing?Math.floor(time/160)%6:Number(pose.value);if(playing)pose.value=frame;for(const key of ['current','candidate']){const canvas=document.querySelector('#'+key),ctx=canvas.getContext('2d'),atlas=data[key].atlas,clip=atlas.animations[select.value]??atlas.animations.idle,f=atlas.frames[clip.frames[frame]];ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,256,128);ctx.fillStyle='#253846';ctx.fillRect(0,116,256,12);ctx.fillStyle='#53616a';ctx.fillRect(0,116,256,1);ctx.drawImage(player,0,0,32,32,39,85,32,32);const[sx,sy,w,h]=f.rect,[ax,ay]=f.anchor;ctx.drawImage(images[key][f.sheet],sx,sy,w,h,156-ax,116-ay,w,h);ctx.strokeStyle='#405663';ctx.setLineDash([2,3]);ctx.strokeRect(156-ax+.5,116-ay+.5,w-1,h-1);ctx.setLineDash([]);const box=f.opaqueBounds;document.querySelector('#'+key+'-info').textContent='Pose '+(frame+1)+' / 6 · native cell '+w+'×'+h+' · visible '+(box?(box[2]-box[0])+'×'+(box[3]-box[1]):'empty')+' · anchor '+ax+','+ay}requestAnimationFrame(draw)}
document.querySelector('#play').onclick=()=>{playing=!playing;document.querySelector('#play').textContent=playing?'Pause':'Play'};pose.oninput=()=>{playing=false;document.querySelector('#play').textContent='Play'};load().catch(error=>document.body.append(document.createTextNode(error.stack)));
</script></html>`;
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, html); console.log(output);
