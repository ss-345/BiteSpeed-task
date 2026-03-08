import React, { useState } from 'react';
import { API_BASE } from './config.ts';

interface ConsolidatedContact {
  primaryContatctId: number;
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

interface HistoryEntry {
  request: { email: string | null; phoneNumber: string | null };
  response: ConsolidatedContact;
  timestamp: string;
}

// ── Small reusable badge ──────────────────────────────────────────────────────
function Badge({ children, color }: { children: React.ReactNode; color: 'blue' | 'green' | 'purple' }) {
  const map = {
    blue:   { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    green:  { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    purple: { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  };
  const c = map[color];
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────
function ContactCard({ contact }: { contact: ConsolidatedContact }) {
  const [showJson, setShowJson] = useState(false);
  return (
    <div style={{
      background: '#fff', border: '1.5px solid #e5e7eb',
      borderRadius: 14, padding: 24, marginTop: 20,
      boxShadow: '0 4px 24px rgba(37,99,235,0.07)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{
          background: '#1d4ed8', color: '#fff', borderRadius: 8,
          padding: '4px 14px', fontSize: 13, fontWeight: 700,
        }}>
          Primary ID: #{contact.primaryContatctId}
        </span>
        <Badge color="green">Reconciled ✓</Badge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Emails */}
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, marginBottom: 10 }}>
            📧 EMAILS
          </div>
          {contact.emails.length === 0
            ? <span style={{ color: '#9ca3af', fontSize: 13 }}>None</span>
            : contact.emails.map((email, i) => (
              <div key={email} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: '#111827', wordBreak: 'break-all' }}>{email}</span>
                {i === 0 && <Badge color="blue">primary</Badge>}
              </div>
            ))
          }
        </div>

        {/* Phone numbers */}
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, marginBottom: 10 }}>
            📱 PHONE NUMBERS
          </div>
          {contact.phoneNumbers.length === 0
            ? <span style={{ color: '#9ca3af', fontSize: 13 }}>None</span>
            : contact.phoneNumbers.map((phone, i) => (
              <div key={phone} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: '#111827' }}>{phone}</span>
                {i === 0 && <Badge color="blue">primary</Badge>}
              </div>
            ))
          }
        </div>
      </div>

      {/* Secondary IDs */}
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: 1, marginBottom: 10 }}>
          🔗 SECONDARY CONTACT IDS
        </div>
        {contact.secondaryContactIds.length === 0
          ? <span style={{ color: '#9ca3af', fontSize: 13 }}>None — this is a brand new contact</span>
          : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {contact.secondaryContactIds.map(id => (
                <span key={id} style={{
                  background: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff',
                  borderRadius: 6, padding: '3px 12px', fontSize: 13, fontWeight: 600,
                }}>
                  #{id}
                </span>
              ))}
            </div>
          )
        }
      </div>

      {/* Raw JSON toggle */}
      <button
        onClick={() => setShowJson(v => !v)}
        style={{
          background: 'none', border: '1px solid #e5e7eb', borderRadius: 8,
          padding: '6px 14px', fontSize: 12, color: '#6b7280', cursor: 'pointer',
        }}
      >
        {showJson ? '▲ Hide' : '▼ Show'} raw JSON
      </button>
      {showJson && (
        <pre style={{
          background: '#0f172a', color: '#7dd3fc', borderRadius: 10,
          padding: 16, fontSize: 12, marginTop: 10, overflow: 'auto', lineHeight: 1.7,
        }}>
          {JSON.stringify({ contact }, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [email,       setEmail]       = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [result,      setResult]      = useState<ConsolidatedContact | null>(null);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [history,     setHistory]     = useState<HistoryEntry[]>([]);

  const handleSubmit = async () => {
    setError('');
    setResult(null);

    if (!email.trim() && !phoneNumber.trim()) {
      setError('Please enter at least an email or phone number.');
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (email.trim())       payload.email       = email.trim();
      if (phoneNumber.trim()) payload.phoneNumber = phoneNumber.trim();

      const res = await fetch(`${API_BASE}/identify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      console.log("base url:", API_BASE);

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      console.log('API response:', data);
      setResult(data.contact);
      setHistory(prev => [{
        request: {
          email:       payload.email       || null,
          phoneNumber: payload.phoneNumber || null,
        },
        response:  data.contact,
        timestamp: new Date().toLocaleTimeString(),
      }, ...prev].slice(0, 8));
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const examples = [
    { label: '1. New customer',          email: 'lorraine@hillvalley.edu', phoneNumber: '123456' },
    { label: '2. Same phone, new email', email: 'mcfly@hillvalley.edu',    phoneNumber: '123456' },
    { label: '3. Email only',            email: 'lorraine@hillvalley.edu', phoneNumber: '' },
    { label: '4. Phone only',            email: '',                        phoneNumber: '123456' },
    { label: '5. New cluster A',         email: 'george@hillvalley.edu',   phoneNumber: '919191' },
    { label: '6. New cluster B',         email: 'biff@hillvalley.edu',     phoneNumber: '717171' },
    { label: '7. Merge clusters',        email: 'george@hillvalley.edu',   phoneNumber: '717171' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #4f46e5 100%)',
        color: '#fff', padding: '36px 0 30px', textAlign: 'center',
        boxShadow: '0 4px 24px rgba(30,58,138,0.3)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>⚡</div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5 }}>Bitespeed Identity Reconciliation</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>
          Link customer identities across multiple purchases
        </div>
      </div>

      <div style={{ maxWidth: 740, margin: '0 auto', padding: '32px 16px' }}>

        {/* Form card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <code style={{
              background: '#f1f5f9', border: '1px solid #e2e8f0',
              borderRadius: 6, padding: '4px 10px', fontSize: 13, color: '#374151',
            }}>
              POST /identify
            </code>
          </div>

          {/* Quick-fill examples */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 1, marginBottom: 8 }}>
              TRY THESE EXAMPLES IN ORDER ↓
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {examples.map(ex => (
                <button
                  key={ex.label}
                  onClick={() => { setEmail(ex.email); setPhoneNumber(ex.phoneNumber); setResult(null); setError(''); }}
                  style={{
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
                    padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: '#374151', fontWeight: 500,
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {[
              { label: 'EMAIL',        value: email,       setter: setEmail,       type: 'email', placeholder: 'e.g. lorraine@hillvalley.edu' },
              { label: 'PHONE NUMBER', value: phoneNumber, setter: setPhoneNumber, type: 'text',  placeholder: 'e.g. 123456' },
            ].map(({ label, value, setter, type, placeholder }) => (
              <div key={label}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>
                  {label} <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type={type}
                  value={value}
                  onChange={e => setter(e.target.value)}
                  placeholder={placeholder}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  style={{
                    width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb',
                    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16,
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#93c5fd' : 'linear-gradient(135deg, #1d4ed8, #4f46e5)',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '13px', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: 0.3,
            }}
          >
            {loading ? '⏳ Identifying...' : '🔍 Identify Contact'}
          </button>
        </div>

        {/* Result */}
        {result && <ContactCard contact={result} />}

        {/* History */}
        {history.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>
              📋 Request History
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((entry, i) => (
                <div
                  key={i}
                  onClick={() => setResult(entry.response)}
                  style={{
                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
                    padding: '11px 16px', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', fontSize: 13, cursor: 'pointer',
                  }}
                >
                  <div style={{ color: '#374151' }}>
                    {entry.request.email || <em style={{ color: '#9ca3af' }}>no email</em>}
                    <span style={{ color: '#d1d5db', margin: '0 8px' }}>·</span>
                    {entry.request.phoneNumber || <em style={{ color: '#9ca3af' }}>no phone</em>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge color="blue">#{entry.response.primaryContatctId}</Badge>
                    <span style={{ color: '#9ca3af', fontSize: 11 }}>{entry.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: 24,
          marginTop: 32, boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
            🧠 Reconciliation Rules
          </div>
          {[
            ['🆕', 'No match found',          'Creates a brand new primary contact.'],
            ['➕', 'New info on existing',     'Creates a secondary contact linked to the primary.'],
            ['🔀', 'Two clusters linked',      'Older primary stays. Newer primary is demoted to secondary.'],
            ['✅', 'All info already exists',  'Returns the existing consolidated contact, no DB write.'],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{title}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
