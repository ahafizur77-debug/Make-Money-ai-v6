let token=localStorage.mmToken||"";
const $=id=>document.getElementById(id);
function headers(){return {"Content-Type":"application/json","Authorization":"Bearer "+token}}
async function api(url,method="GET",body){
 const r=await fetch(url,{method,headers:method==="GET"?{"Authorization":"Bearer "+token}:headers(),body:body?JSON.stringify(body):undefined});
 const d=await r.json(); if(!r.ok)throw new Error(d.error||"Request failed");return d;
}
function show(s){$("msg").textContent=s}
async function register(){try{
 const d=await api("/api/auth/register","POST",{name:$("name").value,email:$("email").value,password:$("password").value});
 token=d.token;localStorage.mmToken=token;start(d.user);
}catch(e){show(e.message)}}
async function login(){try{
 const d=await api("/api/auth/login","POST",{email:$("email").value,password:$("password").value});
 token=d.token;localStorage.mmToken=token;start(d.user);
}catch(e){show(e.message)}}
async function start(user){
 $("auth").hidden=true;$("app").hidden=false;$("who").textContent=user.name+" • "+user.email;
 const names=["payment","kyc","sms","email","push"];
 const results=await Promise.all(names.map(n=>fetch("/api/"+n+"/status").then(r=>r.json()).catch(()=>({enabled:false}))));
 $("status").innerHTML=names.map((n,i)=>`<div class="badge">${n.toUpperCase()}: ${results[i].enabled?"configured":"not configured"}</div>`).join("");
}
async function chat(){try{
 $("result").textContent="Thinking...";
 const d=await api("/api/chat","POST",{message:$("message").value});
 $("result").textContent=d.reply+"\n\nPLAN:\n"+JSON.stringify(d.plan,null,2);
}catch(e){$("result").textContent=e.message}}
function logout(){localStorage.removeItem("mmToken");token="";location.reload()}
(async()=>{if(token){try{const d=await api("/api/me");if(d.user)start(d.user)}catch(e){logout()}}})();