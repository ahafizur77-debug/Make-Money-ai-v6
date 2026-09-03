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
const { useState, useEffect } = React;

const API_URL = 'https://tera-app.onrender.com'; // ← Yaha apna Render URL daal

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [page, setPage] = useState('login');
  const [user, setUser] = useState(null);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      fetch(`${API_URL}/api/me`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json()).then(d => {
        if (d.user) { setUser(d.user); setPage('chat'); }
        else logout();
      });
    }
  }, [token]);

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null); setUser(null); setPage('login');
  };

  const login = async (email, password) => {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    setLoading(false);
    if (data.token) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
    } else alert(data.error);
  };

  const register = async (name, email, password) => {
    setLoading(true);
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    setLoading(false);
    if (data.token) {
      localStorage.setItem('token', data.token);
      setToken(data.token);
    } else alert(data.error);
  };

  const sendChat = async () => {
    if (!message) return;
    setLoading(true);
    const res = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    setChat([...chat, { q: message, a: data.reply, plan: data.plan.selectedAgents }]);
    setMessage(''); setLoading(false);
  };

  if (!token) return <AuthPage onLogin={login} onRegister={register} loading={loading} />;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="bg-gray-800 p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">MoneyMind AI V6 🚀</h1>
        <div>
          <span className="mr-4">Hi, {user?.name}</span>
          <button onClick={logout} className="bg-red-600 px-3 py-1 rounded">Logout</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-gray-800 rounded-lg p-4 mb-4 h-96 overflow-y-auto">
          {chat.map((c, i) => (
            <div key={i} className="mb-4">
              <div className="text-blue-400 font-semibold">You: {c.q}</div>
              <div className="text-green-400 mt-1">AI: {c.a}</div>
              <div className="text-xs text-gray-500 mt-1">Agents: {c.plan.join(', ')}</div>
            </div>
          ))}
          {loading && <div className="text-yellow-400">Thinking...</div>}
        </div>

        <div className="flex gap-2">
          <input
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && sendChat()}
            placeholder="Ask: I want to earn money online..."
            className="flex-1 bg-gray-800 p-3 rounded text-white"
          />
          <button
            onClick={sendChat}
            disabled={loading}
            className="bg-blue-600 px-6 py-3 rounded font-semibold disabled:opacity-50">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function AuthPage({ onLogin, onRegister, loading }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => {
    if (isLogin) onLogin(email, password);
    else onRegister(name, email, password);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 p-8 rounded-lg w-96">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">MoneyMind AI V6</h1>
        {!isLogin && (
          <input
            placeholder="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-gray-700 p-3 rounded mb-3 text-white"
          />
        )}
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-gray-700 p-3 rounded mb-3 text-white"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full bg-gray-700 p-3 rounded mb-4 text-white"
        />
        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-blue-600 p-3 rounded font-semibold text-white disabled:opacity-50">
          {loading? 'Loading...' : isLogin? 'Login' : 'Register'}
        </button>
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="w-full text-gray-400 mt-3 text-sm">
          {isLogin? 'Need account? Register' : 'Have account? Login'}
        </button>
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));
