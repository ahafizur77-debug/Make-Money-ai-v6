require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Razorpay = require("razorpay");
const twilio = require("twilio");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 10000;
const DATA_FILE = path.join(__dirname, "data", "db.json");
const SECRET = process.env.APP_SECRET || "development-secret-change-me";

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// DB helpers
function db() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { users:[], plans:[], notifications:[], audit:[], payments:[], kyc:[] };
  }
}
function save(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function id(prefix="id") { return `${prefix}_${crypto.randomUUID()}`; }
function audit(userId, action, meta={}) {
  const d=db(); d.audit.push({id:id("audit"),userId,action,meta,at:new Date().toISOString()}); save(d);
}
function token(user) {
  return jwt.sign({id:user.id,email:user.email,role:user.role||"user"}, SECRET, {expiresIn:"7d"});
}
function auth(req,res,next) {
  const h=req.headers.authorization||"";
  const t=h.startsWith("Bearer ")?h.slice(7):null;
  if(!t) return res.status(401).json({error:"Authentication required"});
  try { req.user=jwt.verify(t,SECRET); next(); }
  catch { return res.status(401).json({error:"Invalid or expired token"}); }
}
function admin(req,res,next) {
  if(req.user.role!=="admin") return res.status(403).json({error:"Admin only"});
  next();
}
function publicUser(u){ return {id:u.id,name:u.name,email:u.email,phone:u.phone||null,role:u.role||"user",createdAt:u.createdAt}; }

const AGENTS = {
  mentor:"Creates practical earning and learning plans without guaranteeing income.",
  opportunity:"Finds opportunities from approved data supplied to the platform.",
  career:"Analyzes skills and suggests career paths.",
  resume:"Improves CV and application drafts.",
  finance:"Explains budgets and business planning; does not execute money movement.",
  marketing:"Creates marketing ideas and campaigns.",
  proposal:"Drafts proposals and client responses.",
  safety:"Checks for scam, fraud and unrealistic earning claims.",
  support:"Helps troubleshoot and answer product questions."
};

function orchestrate(message) {
  const m=(message||"").toLowerCase();
  let selected=["mentor","opportunity"];
  if(/cv|resume|job|interview/.test(m)) selected=["career","resume","opportunity","safety"];
  else if(/money|income|budget|business/.test(m)) selected=["mentor","finance","marketing","safety"];
  else if(/client|proposal|freelance/.test(m)) selected=["proposal","marketing","mentor"];
  return {
    selectedAgents:selected,
    plan:selected.map((a,i)=>({step:i+1,agent:a,task:AGENTS[a]}))
  };
}

async function aiReply(message, plan) {
  if(!process.env.OPENAI_API_KEY) {
    return `AI provider key is not configured. Planner selected: ${plan.selectedAgents.join(", ")}. Add OPENAI_API_KEY to enable a real AI provider response.`;
  }
  return `AI integration is configured at environment level. Your request was planned across: ${plan.selectedAgents.join(", ")}.`;
}

// Health
app.get("/api/health",(req,res)=>res.json({ok:true,version:"6.0.0",time:new Date().toISOString()}));

// Root route
app.get('/', (req, res) => {
  res.json({
    message: "MoneyMind AI V6 Backend is Running 🚀",
    status: "live",
    version: "6.0.0"
  });
});

// Auth
app.post("/api/auth/register", async(req,res)=>{
  const {name,email,password,phone}=req.body;
  if(!name||!email||!password) return res.status(400).json({error:"name, email and password are required"});
  const d=db();
  if(d.users.some(u=>u.email.toLowerCase()===email.toLowerCase())) return res.status(409).json({error:"Email already registered"});
  const user={id:id("usr"),name,email:email.toLowerCase(),phone:phone||null,passwordHash:await bcrypt.hash(password,12),role:"user",createdAt:new Date().toISOString()};
  d.users.push(user); save(d); audit(user.id,"REGISTER");
  res.status(201).json({user:publicUser(user),token:token(user)});
});

app.post("/api/auth/login", async(req,res)=>{
  const {email,password}=req.body; const d=db();
  const user=d.users.find(u=>u.email===String(email||"").toLowerCase());
  if(!user||!(await bcrypt.compare(password||"",user.passwordHash))) return res.status(401).json({error:"Invalid email or password"});
  audit(user.id,"LOGIN"); res.json({user:publicUser(user),token:token(user)});
});

app.get("/api/me",auth,(req,res)=>{
  const user=db().users.find(u=>u.id===req.user.id);
  res.json({user:user?publicUser(user):null});
});

// AI and plans
app.post("/api/chat",auth,async(req,res)=>{
  const {message}=req.body;
  if(!message) return res.status(400).json({error:"message required"});
  const plan=orchestrate(message);
  const reply=await aiReply(message,plan);
  const d=db(); d.plans.push({id:id("plan"),userId:req.user.id,message,plan,reply,createdAt:new Date().toISOString()}); save(d);
  audit(req.user.id,"AI_CHAT",{agents:plan.selectedAgents});
  res.json({reply,plan});
});

app.get("/api/plans",auth,(req,res)=>{
  res.json(db().plans.filter(p=>p.userId===req.user.id).slice(-50).reverse());
});

// Notifications
app.get("/api/notifications",auth,(req,res)=>{
  res.json(db().notifications.filter(n=>n.userId===req.user.id).reverse());
});

app.post("/api/notifications",auth,(req,res)=>{
  const {title,body}=req.body; if(!title) return res.status(400).json({error:"title required"});
  const d=db(); const n={id:id("note"),userId:req.user.id,title,body:body||"",read:false,createdAt:new Date().toISOString()};
  d.notifications.push(n); save(d); res.status(201).json(n);
});

// Payment: Razorpay
app.get("/api/payment/status",(req,res)=>res.json({enabled:Boolean(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET),provider:"razorpay"}));

app.post("/api/payment/order",auth,async(req,res)=>{
  if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({error:"Razorpay is not configured"});
  const {amount,currency="INR",receipt}=req.body;
  if(!Number.isInteger(amount)||amount<100) return res.status(400).json({error:"amount must be an integer in the smallest currency unit"});
  try{
    const rz=new Razorpay({key_id:process.env.RAZORPAY_KEY_ID,key_secret:process.env.RAZORPAY_KEY_SECRET});
    const order=await rz.orders.create({amount,currency,receipt:receipt||id("receipt")});
    const d=db(); d.payments.push({id:id("pay"),userId:req.user.id,provider:"razorpay",orderId:order.id,amount,currency,status:"created",createdAt:new Date().toISOString()}); save(d);
    audit(req.user.id,"PAYMENT_ORDER_CREATED",{orderId:order.id,amount,currency});
    res.json({order,keyId:process.env.RAZORPAY_KEY_ID});
  }catch(e){res.status(502).json({error:"Payment provider request failed"});}
});

app.post("/api/payment/verify",auth,(req,res)=>{
  const {razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body;
  if(!process.env.RAZORPAY_KEY_SECRET) return res.status(503).json({error:"Razorpay is not configured"});
  const expected=crypto.createHmac("sha256",process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
  if(expected!==razorpay_signature) return res.status(400).json({error:"Invalid payment signature"});
  const d=db(); const p=d.payments.find(x=>x.orderId===razorpay_order_id&&x.userId===req.user.id);
  if(p){p.status="verified";p.paymentId=razorpay_payment_id;save(d);}
  audit(req.user.id,"PAYMENT_VERIFIED",{orderId:razorpay_order_id});
  res.json({ok:true,status:"verified"});
});

// KYC - FIXED VERSION
app.get("/api/kyc/status",auth,(req,res)=>{
  const item = db().kyc.find(k => k.userId === req.user.id);
  res.json(item || {status:"not_started", providerConfigured:Boolean(process.env.KYC_PROVIDER_URL && process.env.KYC_PROVIDER_API_KEY)});
});

app.post("/api/kyc/start",auth,async(req,res)=>{
  if(!process.env.KYC_PROVIDER_URL||!process.env.KYC_PROVIDER_API_KEY) return res.status(503).json({error:"A verified KYC provider is not configured"});
  try{
    const r=await axios.post(process.env.KYC_PROVIDER_URL,{user_reference:req.user.id},{
      headers:{Authorization:`Bearer ${process.env.KYC_PROVIDER_API_KEY}`},timeout:15000
    });
    const d=db(); const record={id:id("kyc"),userId:req.user.id,status:"pending",providerResponse:r.data,createdAt:new Date().toISOString()};
    d.kyc=d.kyc.filter(x=>x.userId!==req.user.id);d.kyc.push(record);save(d);
    audit(req.user.id,"KYC_STARTED");res.json({status:"pending",provider:r.data});
  }catch(e){res.status(502).json({error:"KYC provider request failed"});}
});

// SMS
app.get("/api/sms/status",(req,res)=>res.json({enabled:Boolean(process.env.TWILIO_ACCOUNT_SID&&process.env.TWILIO_AUTH_TOKEN&&process.env.TWILIO_PHONE_NUMBER),provider:"twilio"}));

app.post("/api/sms/send",auth,async(req,res)=>{
  const {to,message}=req.body;
  if(!to||!message)return res.status(400).json({error:"to and message required"});
  if(!process.env.TWILIO_ACCOUNT_SID)return res.status(503).json({error:"Twilio is not configured"});
  try{
    const client=twilio(process.env.TWILIO_ACCOUNT_SID,process.env.TWILIO_AUTH_TOKEN);
    const result=await client.messages.create({to,from:process.env.TWILIO_PHONE_NUMBER,body:message});
    audit(req.user.id,"SMS_SENT",{sid:result.sid});res.json({ok:true,sid:result.sid});
  }catch(e){res.status(502).json({error:"SMS provider request failed"});}
});

// Email
app.get("/api/email/status",(req,res)=>res.json({enabled:Boolean(process.env.RESEND_API_KEY&&process.env.EMAIL_FROM),provider:"resend"}));

app.post("/api/email/send",auth,async(req,res)=>{
  const {to,subject,text}=req.body;
  if(!to||!subject||!text)return res.status(400).json({error:"to, subject and text required"});
  if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return res.status(503).json({error:"Email provider is not configured"});
  try{
    const r=await axios.post("https://api.resend.com/emails",{from:process.env.EMAIL_FROM,to:[to],subject,text},{
      headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},timeout:15000
    });
    audit(req.user.id,"EMAIL_SENT",{emailId:r.data.id||null});res.json({ok:true,id:r.data.id||null});
  }catch(e){res.status(502).json({error:"Email provider request failed"});}
});

// Push
app.get("/api/push/status",(req,res)=>res.json({enabled:Boolean(process.env.FCM_SERVER_KEY||process.env.FCM_PROJECT_ID),provider:"firebase"}));

app.post("/api/push/send",auth,async(req,res)=>{
  const {title,body}=req.body;
  const d=db(); const n={id:id("note"),userId:req.user.id,title:title||"MoneyMind AI",body:body||"",read:false,createdAt:new Date().toISOString(),channel:"push"};
  d.notifications.push(n);save(d);
  res.status(202).json({queued:true,message:"Notification stored. Configure Firebase Admin credentials/server integration for device delivery."});
});

// Legal
app.get("/privacy",(req,res)=>res.type("text/plain").send("MoneyMind AI Privacy Policy: data is processed only for providing the service, security, support and legal obligations. Configure your final jurisdiction-specific policy before public launch."));
app.get("/terms",(req,res)=>res.type("text/plain").send("MoneyMind AI Terms: no earnings are guaranteed. Users must not use the service for fraud, illegal activity or deceptive claims. Payment and identity services depend on verified providers."));

// Admin
app.get("/api/admin/stats",auth,admin,(req,res)=>{
  const d=db();
  res.json({users:d.users.length,plans:d.plans.length,notifications:d.notifications.length,payments:d.payments.length,auditEvents:d.audit.length,kyc:d.kyc.length});
});

app.get("/api/admin/audit",auth,admin,(req,res)=>res.json(db().audit.slice(-200).reverse()));

app.use((req,res)=>res.status(404).json({error:"Route not found"}));
app.listen(PORT,()=>console.log(`MoneyMind AI V6 running on http://localhost:${PORT}`));
