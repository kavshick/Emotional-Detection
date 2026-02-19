import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Camera, FileText, BarChart2, Info, Home as HomeIcon, Menu, X } from 'lucide-react';
import Home from './pages/Home';
import LiveDetector from './pages/LiveDetector';
import SessionReports from './pages/SessionReports';
import AboutProject from './pages/AboutProject';

const NavItem = ({ to, icon: Icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link 
      to={to} 
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
        isActive 
          ? 'bg-secondary text-primary-foreground font-medium' 
          : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  );
};

const Sidebar = () => {
  return (
    <div className="w-64 border-r border-border h-screen bg-[#050508] fixed left-0 top-0 flex flex-col z-20">
      <div className="p-6 border-b border-white/5 bg-gradient-to-r from-transparent to-primary/5">
        <h1 className="text-xl font-bold text-white tracking-widest uppercase flex items-center">
          <span className="text-primary mr-2">◈</span> 
          Bio<span className="text-primary">Sync</span>
        </h1>
        <p className="text-[10px] text-muted-foreground mt-1 font-mono tracking-widest pl-5">EMOTION SUITE v2.0</p>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        <NavItem to="/" icon={HomeIcon} label="Dashboard" />
        
        <div className="pt-6 pb-2 px-4 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
          Core Modules
        </div>
        <NavItem to="/live_detector" icon={Camera} label="Live Inference" />
        <NavItem to="/session_reports" icon={FileText} label="Analysis Logs" />
        
        <div className="pt-6 pb-2 px-4 text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
          System
        </div>
        <NavItem to="/about_project" icon={Info} label="Architecture" />
      </nav>
      
      <div className="p-4 border-t border-white/5 text-[10px] text-center text-muted-foreground/30 font-mono">
        SYSTEM STATUS: ONLINE
      </div>
    </div>
  );
};

const MobileNav = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-secondary rounded-md"
      >
        <Menu size={24} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-64 bg-card border-r border-border p-4">
             <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold">Menu</h2>
                <button onClick={() => setIsOpen(false)}><X size={24}/></button>
             </div>
             <nav className="space-y-2">
                <Link to="/" onClick={() => setIsOpen(false)} className="block py-2">Home</Link>
                <Link to="/live_detector" onClick={() => setIsOpen(false)} className="block py-2">Live Detector</Link>
                <Link to="/session_reports" onClick={() => setIsOpen(false)} className="block py-2">Session Reports</Link>
                <Link to="/about_project" onClick={() => setIsOpen(false)} className="block py-2">About Project</Link>
             </nav>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-background text-foreground font-sans antialiased">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        
        <MobileNav />

        <main className="flex-1 lg:ml-64 p-4 lg:p-8 overflow-x-hidden">
          <div className="max-w-6xl mx-auto">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/live_detector" element={<LiveDetector />} />
              <Route path="/session_reports" element={<SessionReports />} />
              <Route path="/about_project" element={<AboutProject />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  )
}

export default App
