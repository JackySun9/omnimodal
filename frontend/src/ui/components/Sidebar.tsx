import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊', color: '#6366f1' },
  { to: '/chat', label: 'Chat', icon: '💬', color: '#6366f1' },
  { to: '/image', label: 'Image', icon: '🎨', color: '#ec4899' },
  { to: '/audio', label: 'Audio', icon: '🎤', color: '#3b82f6' },
  { to: '/models', label: 'Models', icon: '🤖', color: '#8b5cf6' },
  { to: '/settings', label: 'Settings', icon: '⚙️', color: '#64748b' }
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header" style={{ position: 'relative' }}>
        <div style={{ 
          fontSize: '2.5rem', 
          marginBottom: '0.75rem',
          filter: 'drop-shadow(0 2px 8px rgba(99, 102, 241, 0.3))',
          animation: 'pulse 2s ease-in-out infinite',
        }}>
          🎯
        </div>
        <h1 className="gradient-text" style={{ 
          fontSize: '1.25rem', 
          fontWeight: 700, 
          marginBottom: '0.25rem',
          letterSpacing: '-0.02em',
        }}>
          Multimodal AI
        </h1>
        <p style={{ 
          fontSize: '0.75rem', 
          color: 'var(--text-secondary)', 
          margin: 0,
          fontWeight: 500,
        }}>
          Unified Platform
        </p>
      </div>
      
      <nav className="sidebar-nav">
        <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink 
                to={item.to}
                className={({ isActive }) => isActive ? 'active' : ''}
                end={item.to === '/'}
                style={({ isActive }) => ({
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.875rem',
                  padding: '0.875rem 1rem',
                  borderRadius: 'var(--radius-lg)',
                  background: isActive 
                    ? 'linear-gradient(135deg, var(--primary-color), var(--secondary-color))'
                    : 'transparent',
                  color: isActive ? 'white' : 'var(--text-primary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.9375rem',
                  textDecoration: 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none',
                  position: 'relative',
                  overflow: 'hidden',
                })}
              >
                {({ isActive }) => (
                  <>
                    <span style={{ 
                      fontSize: '1.375rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-md)',
                      background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'var(--bg-tertiary)',
                      transition: 'var(--transition)',
                    }}>
                      {item.icon}
                    </span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        
        {/* Quick Stats */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
          border: '1px solid rgba(99, 102, 241, 0.2)',
        }}>
          <div style={{ 
            fontSize: '0.75rem', 
            color: 'var(--text-secondary)', 
            fontWeight: 600,
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            System Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--success)',
              boxShadow: '0 0 8px var(--success)',
              animation: 'pulse 2s ease-in-out infinite',
            }}></div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500 }}>
              All Systems Online
            </span>
          </div>
        </div>
      </nav>
      
      {/* Footer */}
      <div style={{ 
        marginTop: 'auto', 
        paddingTop: '1.5rem', 
        borderTop: '1px solid var(--border-color)',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '0.75rem',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-tertiary)',
        }}>
          <p style={{ 
            margin: 0, 
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}>
            Version 0.1.0
          </p>
          <p style={{ 
            margin: '0.25rem 0 0 0',
            fontSize: '0.8125rem',
            color: 'var(--text-primary)',
            fontWeight: 600,
          }}>
            Built with ❤️
          </p>
        </div>
      </div>
    </aside>
  );
}
