'use strict';
const { copyFileSync, cpSync, mkdirSync, rmSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const root=join(__dirname,'..'), output=join(root,'dist');
const files=['index.html','run-results.js','run-results.css','native-assets.html'];
rmSync(output,{recursive:true,force:true});mkdirSync(output,{recursive:true});
for(const file of files)copyFileSync(join(root,file),join(output,file));
if(existsSync(join(root,'assets/native')))cpSync(join(root,'assets/native'),join(output,'assets/native'),{recursive:true});
console.log(`Built ${files.length} static pages/scripts and native sprite kit in dist/`);
