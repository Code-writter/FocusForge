import { useState } from 'react';

// 1. Tell TypeScript exactly what data to expect from Bedrock
interface Task {
  task: string;
  priority: string;
  impact: string;
  immediateNextStep: string;
}

function App() {
  const [input, setInput] = useState('');
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');

  // ⚠️ PASTE YOUR AWS API GATEWAY URL HERE:
  const API_ENDPOINT = "https://0ifogwu7dc.execute-api.eu-north-1.amazonaws.com/prioritize";

  const handlePrioritize = async () => {
    setLoading(true);
    setError(null);
    setTasks([]);
    setStatusText('Requesting AI analysis from Amazon Nova...');

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        // Notice: headers intentionally omitted to bypass CORS preflight
        body: JSON.stringify({ rawTasks: input }),
      });

      if (!response.ok) throw new Error('Failed to connect to the AI engine.');
      
      setStatusText('Connection successful, parsing AI response...');
      
      // 1. Get raw text first because the AI might include conversational text (Markdown)
      const rawText = await response.text();
      
      // 2. Extract just the JSON array using a Regular Expression
      // This isolates everything from the first '[' to the last ']'
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        throw new Error("AI did not return a valid JSON array.");
      }
      
      // 3. Parse the extracted JSON string safely
      const parsedTasks = JSON.parse(jsonMatch[0]);
      
      setTasks(parsedTasks);
      setStatusText('Tasks triaged successfully!');
    } catch (err) {
      console.error("Error details:", err);
      setError('Failed to process the AI strategy. Check the browser console.');
      setStatusText('Error occurred during processing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#020817', color: '#f8fafc', padding: '4rem 1rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        <header style={{ textAlign: 'center', marginBottom: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem' }}>⚙️⚡</span>
            <h1 style={{ fontSize: '3rem', fontWeight: '800', margin: 0, background: 'linear-gradient(135deg, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textShadow: '0px 0px 20px rgba(96, 165, 250, 0.2)' }}>
              FocusForge
            </h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem', margin: 0 }}>AI-Powered Task Triage via Amazon Bedrock</p>
        </header>
        
        <div style={{ backgroundColor: '#0f172a', padding: '2px', borderRadius: '16px', backgroundImage: 'linear-gradient(to bottom, #1e293b, #0f172a)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
          <div style={{ backgroundColor: '#0f172a', padding: '2rem', borderRadius: '15px' }}>
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4} 
              style={{ width: '100%', padding: '1.25rem', borderRadius: '10px', border: '1px solid #1e293b', backgroundColor: '#020817', color: '#e2e8f0', fontSize: '1.1rem', boxSizing: 'border-box', outline: 'none', resize: 'vertical', transition: 'border-color 0.2s' }}
              placeholder="Brain dump everything here... e.g., fix the login bug, call the client, get groceries, finish AWS article..."
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#1e293b'}
            />
            
            <button 
              onClick={handlePrioritize} 
              disabled={loading || !input.trim()}
              style={{ width: '100%', marginTop: '1.5rem', padding: '1.25rem', background: loading ? '#1e293b' : 'linear-gradient(to right, #2563eb, #3b82f6)', color: loading ? '#94a3b8' : 'white', border: 'none', borderRadius: '10px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: loading ? 'none' : '0 10px 15px -3px rgba(59, 130, 246, 0.3)', transition: 'all 0.2s' }}
            >
              {loading ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span> Forging AI Strategy...
                </>
              ) : 'Forge My Strategy'}
            </button>
            
            {error && <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'rgba(127, 29, 29, 0.2)', border: '1px solid #7f1d1d', color: '#fca5a5', borderRadius: '8px', textAlign: 'center' }}>{error}</div>}
          </div>
        </div>

        {(tasks.length > 0 || statusText) && (
          <div style={{ marginTop: '3rem' }}>
            
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
              <span style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#1e293b', color: '#cbd5e1', border: '1px solid #334155' }}>
                {statusText || 'Awaiting input...'}
              </span>
              {tasks.length > 0 && (
                <span style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'rgba(20, 83, 45, 0.3)', color: '#86efac', border: '1px solid #14532d' }}>
                  Tasks triaged! Hover rows for details.
                </span>
              )}
            </div>

            {tasks.length > 0 && (
              <div style={{ overflowX: 'auto', backgroundColor: '#0f172a', borderRadius: '16px', border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #0f172a' }}>
                      <th style={{ padding: '1.5rem', fontWeight: '600', color: '#f8fafc', width: '35%' }}>Task</th>
                      <th style={{ padding: '1.5rem', fontWeight: '600', color: '#f8fafc' }}>Priority</th>
                      <th style={{ padding: '1.5rem', fontWeight: '600', color: '#f8fafc' }}>Impact</th>
                      <th style={{ padding: '1.5rem', fontWeight: '600', color: '#f8fafc', width: '35%' }}>Next Step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((item, index) => (
                      <tr key={index} style={{ borderBottom: index !== tasks.length - 1 ? '1px solid #1e293b' : 'none', transition: 'background-color 0.2s', backgroundColor: '#0f172a' }}>
                        <td style={{ padding: '1.5rem', color: '#e2e8f0', lineHeight: '1.5' }}>{item.task}</td>
                        <td style={{ padding: '1.5rem' }}>
                          <span style={{ 
                            padding: '6px 14px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em',
                            backgroundColor: item.priority.toLowerCase() === 'high' ? '#7f1d1d' : item.priority.toLowerCase() === 'medium' ? '#78350f' : '#14532d',
                            color: item.priority.toLowerCase() === 'high' ? '#fca5a5' : item.priority.toLowerCase() === 'medium' ? '#fcd34d' : '#86efac',
                            border: `1px solid ${item.priority.toLowerCase() === 'high' ? '#991b1b' : item.priority.toLowerCase() === 'medium' ? '#92400e' : '#166534'}`
                          }}>
                            {item.priority}
                          </span>
                        </td>
                        <td style={{ padding: '1.5rem', color: '#94a3b8' }}>{item.impact}</td>
                        <td style={{ padding: '1.5rem', color: '#cbd5e1', fontStyle: 'italic', lineHeight: '1.5' }}>{item.immediateNextStep}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;