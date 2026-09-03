let token=localStorage');-center">MoneyMind AI V6</h1>
        {!
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
