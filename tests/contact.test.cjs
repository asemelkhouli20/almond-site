const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync('google-apps-script/Code.gs', 'utf8');
const rows = [];
let released = 0;
const context = {
  ContentService: {MimeType: {JSON: 'json'}, createTextOutput: text => ({setMimeType: () => JSON.parse(text)})},
  PropertiesService: {getScriptProperties: () => ({getProperty: key => key === 'CONTACT_RELAY_TOKEN' ? 'secret' : 'sheet'})},
  LockService: {getScriptLock: () => ({tryLock: () => true, hasLock: () => true, releaseLock: () => released++})},
  SpreadsheetApp: {openById: () => ({getSheetByName: () => ({getLastRow: () => rows.length, appendRow: row => rows.push(row), getRange: () => ({getValues: () => [rows[0]]})})}), flush: () => {}}
};
vm.createContext(context); vm.runInContext(code, context);
const valid = {relay_token: 'secret', name: 'Test', company: 'Almond', email: 'test@example.com', phone: '+966500000000', type: 'Project', message: 'A sufficiently detailed message.', _gotcha: ''};
function send(overrides) {return context.doPost({parameter: {...valid, ...overrides}});}
assert.equal(send({}).saved, true); assert.equal(rows.length, 2); assert.equal(released, 1);
for (const field of ['name', 'company', 'email', 'phone', 'type', 'message']) assert.equal(send({[field]: ''}).code, 'validation');
assert.equal(send({email: 'bad-email'}).code, 'validation');
assert.equal(send({phone: 'abcdefghi'}).code, 'validation');
for (const [field, limit] of Object.entries({name:180, company:180, email:180, phone:40, type:180, message:4000})) assert.equal(send({[field]: 'x'.repeat(limit + 1)}).code, 'validation');
assert.equal(send({_gotcha: 'bot'}).code, 'spam'); assert.equal(send({relay_token: 'wrong'}).code, 'unauthorized');
assert.equal(rows.length, 2);
assert.equal(send({name: '=IMPORTXML()'}).saved, true); assert.equal(rows[2][1], "'=IMPORTXML()");

async function frontend(ar, outcome) {
 const errors = {}; const listeners = {}; let calls = 0; let reset = 0; let layout = 0;
 const fields = Object.entries(valid).filter(([key]) => !['relay_token','_gotcha'].includes(key)).map(([name,value]) => ({name,value,required:true,type:name === 'email' ? 'email' : 'text',minLength:name === 'message' ? 15 : ['name','company'].includes(name) ? 2 : -1,maxLength:name === 'message' ? 4000 : name === 'phone' ? 40 : 180, attrs:{},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},removeAttribute(k){delete this.attrs[k]},addEventListener(){},focus(){}}));
 fields.forEach(f => errors['error-'+f.name]={textContent:''});
 const trap={value:''}; const label={textContent:'Send'}; const button={disabled:false,querySelector:()=>label}; const status={textContent:'',dataset:{}};
 const form={action:'/api/contact.php',querySelectorAll:()=>fields,querySelector:()=>trap,addEventListener:(event,fn)=>listeners[event]=fn,setAttribute(){},removeAttribute(){},reset(){reset++}};
 let resolve; const delayed=new Promise(r=>resolve=r);
 const ctx={document:{documentElement:{lang:ar?'ar':'en'},querySelector:selector=>({'#briefForm':form,'#formStatus':status,'#submitEnquiry':button})[selector],getElementById:id=>errors[id],dispatchEvent:()=>layout++},Event:class{},FormData:class{},AbortController,setTimeout,clearTimeout,fetch:async()=>{calls++; await delayed; if(outcome==='network')throw Error();return {ok:outcome==='success',status:outcome==='success'?200:502,json:async()=>outcome==='success'?{ok:true,saved:true}:outcome==='unconfirmed'?{ok:true}:{ok:false}}}};
 vm.runInNewContext(fs.readFileSync('contact-form.js','utf8'),ctx);
 const submit=()=>listeners.submit({preventDefault(){}});
 fields[0].value=''; await submit(); assert.equal(calls,0); fields[0].value='Test';
 fields[2].value='bad'; await submit(); assert.equal(calls,0); fields[2].value=valid.email;
 fields[5].value='x'.repeat(4001); await submit(); assert.equal(calls,0); fields[5].value=valid.message;
 trap.value='bot'; await submit(); assert.equal(calls,0); trap.value='';
 const pending=submit(); assert.equal(button.disabled,true); await submit(); assert.equal(calls,1);
 resolve(); await pending; assert.equal(button.disabled,false); assert.equal(label.textContent,'Send');
 assert.equal(reset,outcome==='success'?1:0); assert.equal(status.dataset.state,outcome==='success'?'success':'error'); assert.ok(layout>0);
 if(ar) assert.match(status.textContent,/[\u0600-\u06ff]/);
}
(async()=>{for(const ar of [true,false])for(const outcome of ['success','failure','network','unconfirmed'])await frontend(ar,outcome);console.log('Apps Script validation, sanitization, honeypot and frontend lifecycle checks passed.');})().catch(e=>{console.error(e);process.exitCode=1});
