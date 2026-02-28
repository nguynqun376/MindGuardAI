import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  BookOpen, 
  MessageCircle, 
  Heart, 
  AlertCircle, 
  ChevronRight,
  Smile,
  Meh,
  Frown,
  CloudRain,
  Zap,
  Send,
  Loader2
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { analyzeJournal, getChatResponse, getProactiveGreeting } from './services/aiService';

// --- Types ---
interface Mood {
  id?: number;
  date: string;
  level: number;
  tags?: string;
}

interface Journal {
  id?: number;
  content: string;
  sentiment_score: number;
  risk_label: string;
  advice: string;
  timestamp: string;
}

interface Message {
  role: 'user' | 'model';
  content: string;
}

// --- Components ---

const MoodIcon = ({ level, size = 32 }: { level: number, size?: number }) => {
  const style = { fontSize: `${size}px`, lineHeight: '1', display: 'block' };
  switch (level) {
    case 5: return <span style={style}>🤩</span>;
    case 4: return <span style={style}>😊</span>;
    case 3: return <span style={style}>😐</span>;
    case 2: return <span style={style}>😔</span>;
    case 1: return <span style={style}>😫</span>;
    default: return <span style={style}>😐</span>;
  }
};

const SafetyModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl border border-coral/10"
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-coral/10 rounded-full flex items-center justify-center mb-6">
              <AlertCircle size={48} className="text-coral" />
            </div>
            <h2 className="text-2xl font-bold text-text-main mb-4">Bạn không cô đơn</h2>
            <p className="text-text-muted mb-8 leading-relaxed">
              Chúng mình nhận thấy bạn đang trải qua những cảm xúc rất khó khăn. Hãy nhớ rằng luôn có người sẵn sàng lắng nghe và giúp đỡ bạn bất cứ lúc nào.
            </p>
            <div className="w-full space-y-4">
              <a href="tel:1900599930" className="flex items-center justify-center gap-3 w-full py-5 bg-coral text-white rounded-2xl font-bold text-lg shadow-xl shadow-coral/20 transition-transform active:scale-95">
                Gọi Tổng đài 1900 599 930
              </a>
              <button 
                onClick={onClose}
                className="w-full py-4 text-text-muted font-semibold hover:text-text-main transition-colors"
              >
                Quay lại ứng dụng
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'journal' | 'chat'>('dashboard');
  const [moods, setMoods] = useState<Mood[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSafetyOpen, setIsSafetyOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const initUser = async () => {
      // Fetch user info first
      try {
        const res = await fetch('/api/user');
        const data = await res.json();
        if (data.email) {
          setUserEmail(data.email);
          // Use email as userId if logged in
          localStorage.setItem('mindguard_user_id', data.email);
          setUserId(data.email);
          return;
        }
      } catch (e) {
        console.error("Failed to fetch user info", e);
      }

      // Fallback to localStorage
      let id = localStorage.getItem('mindguard_user_id');
      if (!id) {
        id = Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('mindguard_user_id', id);
      }
      setUserId(id);
    };

    initUser();
  }, []);

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const id = localStorage.getItem('mindguard_user_id');
    const headers = {
      ...options.headers,
      'x-user-id': id || '',
    };
    return fetch(url, { ...options, headers });
  };

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchData = async () => {
    const [moodRes, journalRes, chatRes] = await Promise.all([
      apiFetch('/api/moods'),
      apiFetch('/api/journals'),
      apiFetch('/api/chat-history')
    ]);
    setMoods(await moodRes.json());
    setJournals(await journalRes.json());
    setMessages(await chatRes.json());
  };

  const handleMoodSelect = async (level: number) => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // Optimistic update
    const newMood: Mood = { date, level };
    setMoods(prev => {
      const filtered = prev.filter(m => m.date !== date);
      return [newMood, ...filtered];
    });

    try {
      await apiFetch('/api/moods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, date })
      });
      fetchData();
    } catch (e) {
      console.error("Failed to save mood", e);
    }

    if (level <= 2) {
      const sortedMoods = [...moods].sort((a, b) => b.date.localeCompare(a.date));
      if (sortedMoods.length >= 2) {
        const lastTwo = sortedMoods.slice(0, 2);
        if (lastTwo.every(m => m.level <= 2)) {
          setActiveTab('chat');
        }
      }
    }
  };

  const handleSaveJournal = async (content: string) => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const analysis = await analyzeJournal(content);
      if (analysis.isEmergency) {
        setIsSafetyOpen(true);
      }
      
      const res = await apiFetch('/api/journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          sentiment_score: analysis.sentimentScore || 0,
          risk_label: analysis.riskLabel || 'Low',
          advice: JSON.stringify(analysis.advice || []),
          timestamp: new Date().toISOString() // Keep full ISO for DB, but we'll parse locally
        })
      });

      if (!res.ok) {
        throw new Error('Failed to save journal');
      }

      fetchData();
    } catch (error) {
      console.error("Journal save error:", error);
      alert("Có lỗi xảy ra khi lưu nhật ký. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    const newUserMsg: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    
    await apiFetch('/api/chat-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUserMsg)
    });

    setIsTyping(true);
    try {
      const todayMood = moods.find(m => m.date === new Date().toISOString().split('T')[0]);
      const aiResponse = await getChatResponse(
        updatedMessages, 
        text, 
        todayMood?.level.toString()
      );
      
      const newAiMsg: Message = { role: 'model', content: aiResponse || "Xin lỗi, mình đang gặp chút trục trặc." };
      setMessages(prev => [...prev, newAiMsg]);
      
      await apiFetch('/api/chat-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAiMsg)
      });
    } finally {
      setIsTyping(false);
    }
  };

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // Explicit mood rating
    const mood = moods.find(m => m.date === dateStr);
    
    // Journal sentiment
    const dayJournals = journals.filter(j => {
      try {
        const d = new Date(j.timestamp);
        const jDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return jDate === dateStr;
      } catch (e) {
        return false;
      }
    });
    const journalMood = dayJournals.length > 0 
      ? dayJournals.reduce((acc, j) => acc + (5 - (j.sentiment_score / 25)), 0) / dayJournals.length
      : null;
    
    // Combine both sources if available
    let finalLevel: number | null = null;
    if (mood && journalMood !== null) {
      finalLevel = (mood.level + journalMood) / 2;
    } else if (mood) {
      finalLevel = mood.level;
    } else if (journalMood !== null) {
      finalLevel = journalMood;
    }
    
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    
    return {
      name: dayNames[date.getDay()],
      level: finalLevel !== null ? Number(finalLevel.toFixed(1)) : null,
    };
  });

  return (
    <div className="min-h-screen pb-32 max-w-md mx-auto relative overflow-x-hidden bg-bg">
      {/* Header */}
      <header className="p-8 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center shadow-lg shadow-brand/20">
            <Heart className="text-white fill-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-text-main tracking-tight">
              MindGuard AI
            </h1>
            <p className="text-text-muted text-xs font-medium">
              {userEmail ? `Chào buổi sáng, ${userEmail.split('@')[0]}` : 'Chào buổi sáng'}
            </p>
          </div>
        </div>
        <button className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-brand/5">
          <Zap className="text-brand" size={20} />
        </button>
      </header>

      {/* Main Content */}
      <main className="px-6">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Mood Widget */}
              <section className="glass-card p-8">
                <h3 className="text-lg font-bold text-text-main mb-6 text-center">Hôm nay bạn cảm thấy thế nào?</h3>
                <div className="relative">
                  <div className="flex justify-between items-center gap-2">
                    {[5, 4, 3, 2, 1].map(level => {
                      const todayMood = moods.find(m => m.date === new Date().toISOString().split('T')[0]);
                      const isActive = todayMood?.level === level;
                      const isLocked = !!todayMood;
                      
                      return (
                        <button 
                          key={level}
                          onClick={() => handleMoodSelect(level)}
                          className={`mood-btn flex-1 min-w-0 flex flex-col items-center justify-center p-3 rounded-2xl transition-all cursor-pointer ${
                            isActive ? 'bg-brand/10 border-2 border-brand scale-110 shadow-lg' : 
                            isLocked ? 'opacity-40 grayscale' : 'hover:bg-slate-50 border-2 border-transparent'
                          }`}
                        >
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                            transition={{ duration: 0.5 }}
                            className="flex items-center justify-center pointer-events-none"
                          >
                            <MoodIcon level={level} size={44} />
                          </motion.div>
                        </button>
                      );
                    })}
                  </div>
                  
                  <AnimatePresence>
                    {moods.find(m => m.date === new Date().toISOString().split('T')[0]) && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 flex items-center justify-center gap-3 text-emerald font-bold text-sm bg-emerald/5 py-4 rounded-2xl border border-emerald/10 shadow-sm"
                      >
                        <div className="w-8 h-8 bg-emerald/10 rounded-full flex items-center justify-center">
                          <Zap size={18} className="fill-emerald text-emerald" />
                        </div>
                        Ghi nhận thành công! Hẹn gặp bạn mai nhé.
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>

              {/* Stats Widget */}
              <section className="glass-card p-8">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-lg font-bold text-text-main">Tổng Quan Cảm Xúc</h3>
                  <div className="flex items-center gap-1 text-text-muted text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-full">
                    7 ngày qua <ChevronRight size={12} />
                  </div>
                </div>
                
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorLevel" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7B89F4" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#7B89F4" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94A3B8' }}
                        dy={10}
                        interval={0}
                      />
                      <YAxis hide domain={[0, 5]} />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length && payload[0].value !== null) {
                            return (
                              <div className="bg-white p-3 rounded-xl shadow-xl border border-brand/5">
                                <p className="text-xs font-bold text-text-main mb-1">{label}</p>
                                <p className="text-sm font-extrabold text-brand">
                                  Chỉ số: {payload[0].value}
                                </p>
                                <p className="text-[10px] text-text-muted mt-1">
                                  (Kết hợp từ tâm trạng và nhật ký)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="level" 
                        stroke="#7B89F4" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorLevel)" 
                        animationDuration={1500}
                        connectNulls={true}
                        dot={{ r: 4, fill: '#7B89F4', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-8 p-4 bg-brand/5 rounded-2xl border border-brand/10">
                  <p className="text-xs text-text-main font-medium leading-relaxed">
                    {moods.length > 0 && moods[0].level <= 2 
                      ? "Xu hướng cảm xúc thấp 3 ngày gần đây. Bạn có muốn nói chuyện không?" 
                      : "Chỉ số cảm xúc của bạn được tổng hợp từ các đánh giá hàng ngày và nội dung nhật ký của bạn."}
                  </p>
                </div>
              </section>

              {/* Recent Journals on Dashboard */}
              <section className="space-y-4">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-lg font-bold text-text-main">Nhật Ký Gần Đây</h3>
                  <button onClick={() => setActiveTab('journal')} className="text-brand text-xs font-bold hover:underline">
                    Xem tất cả
                  </button>
                </div>
                {journals.length === 0 ? (
                  <div className="glass-card p-8 text-center border-dashed border-2 border-brand/10 bg-brand/[0.02]">
                    <p className="text-sm text-text-muted font-medium">Bạn chưa có nhật ký nào. Hãy viết điều gì đó nhé!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {journals.slice(0, 2).map(j => (
                      <div key={j.id} className="glass-card p-5 flex items-center gap-4 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setActiveTab('journal')}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${j.risk_label === 'High' ? 'bg-coral/10 text-coral' : 'bg-emerald/10 text-emerald'}`}>
                          <BookOpen size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-text-main truncate">{j.content}</p>
                          <p className="text-[10px] text-text-muted font-medium mt-0.5">
                            {new Date(j.timestamp).toLocaleDateString('vi-VN')} • Nguy cơ: {j.risk_label === 'High' ? 'Cao' : 'Thấp'}
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-text-muted/30" />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Shortcuts */}
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setActiveTab('journal')} className="glass-card p-6 flex flex-col items-center gap-3 text-brand hover:bg-brand/5 transition-colors group">
                  <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <BookOpen size={24} />
                  </div>
                  <span className="text-sm font-bold">Viết Nhật Ký</span>
                </button>
                <button onClick={() => setActiveTab('chat')} className="glass-card p-6 flex flex-col items-center gap-3 text-brand hover:bg-brand/5 transition-colors group">
                  <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageCircle size={24} />
                  </div>
                  <span className="text-sm font-bold">Trò Chuyện AI</span>
                </button>
              </div>

              <div className="glass-card p-5 flex items-center gap-4 bg-slate-900 text-white">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <Zap size={20} className="text-brand-light" />
                </div>
                <p className="text-xs font-medium opacity-90">Dữ liệu của bạn được mã hóa và bảo mật tuyệt đối.</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'journal' && (
            <JournalView onSave={handleSaveJournal} journals={journals} loading={loading} />
          )}

          {activeTab === 'chat' && (
            <ChatView 
              messages={messages} 
              onSend={handleSendMessage} 
              mood={moods.find(m => m.date === new Date().toISOString().split('T')[0])} 
              isTyping={isTyping}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-6 left-6 right-6 max-w-md mx-auto bg-white/90 backdrop-blur-xl border border-white/40 px-10 py-5 flex justify-between items-center z-40 rounded-[2.5rem] shadow-2xl shadow-slate-200/50">
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard />} label="Trang chủ" />
        <NavButton active={activeTab === 'journal'} onClick={() => setActiveTab('journal')} icon={<BookOpen />} label="Nhật ký" />
        <NavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageCircle />} label="Trò chuyện" />
      </nav>

      <SafetyModal isOpen={isSafetyOpen} onClose={() => setIsSafetyOpen(false)} />
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={`nav-item ${active ? 'active' : ''}`}>
      {React.cloneElement(icon as React.ReactElement, { size: 24, strokeWidth: active ? 2.5 : 2 })}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}

function JournalView({ onSave, journals, loading }: { onSave: (c: string) => void, journals: Journal[], loading: boolean }) {
  const [content, setContent] = useState('');

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <div className="glass-card p-8">
        <h3 className="text-xl font-bold text-text-main mb-6">Nhật Ký của Bạn</h3>
        <textarea 
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Hãy viết bất cứ điều gì bạn đang nghĩ..."
          className="w-full h-56 bg-slate-50 rounded-3xl p-6 border-none focus:ring-2 focus:ring-brand/20 resize-none text-text-main placeholder:text-text-muted/40 font-medium leading-relaxed"
        />
        <div className="flex justify-end mt-6">
          <button 
            onClick={() => { onSave(content); setContent(''); }}
            disabled={loading || !content.trim()}
            className="btn-primary w-full flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <Zap className="animate-pulse" /> : <Zap size={20} />}
            {loading ? 'Đang phân tích...' : 'Phân Tích AI'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <h4 className="text-xs font-extrabold text-text-muted uppercase tracking-[0.2em] px-2">Lịch sử nhật ký</h4>
        {journals.length === 0 ? (
          <div className="glass-card p-12 text-center border-dashed border-2 border-brand/10">
            <div className="w-16 h-16 bg-brand/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen size={32} className="text-brand/30" />
            </div>
            <p className="text-sm text-text-muted font-medium">Lịch sử nhật ký của bạn sẽ xuất hiện tại đây.</p>
          </div>
        ) : (
          journals.map(j => {
            let adviceList: string[] = [];
            try {
              adviceList = typeof j.advice === 'string' ? JSON.parse(j.advice) : (Array.isArray(j.advice) ? j.advice : []);
            } catch (e) {
              console.error("Failed to parse advice", e);
            }

            return (
              <div key={j.id} className="glass-card p-6 space-y-5">
                <div className="flex justify-between items-start">
                  <p className="text-sm text-text-main font-medium leading-relaxed line-clamp-3">{j.content}</p>
                  <span className="text-[10px] font-bold text-text-muted bg-slate-100 px-2 py-1 rounded-md ml-4 whitespace-nowrap">
                    {new Date(j.timestamp).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`text-[10px] px-3 py-1.5 rounded-full font-bold uppercase tracking-wider ${j.risk_label === 'High' ? 'bg-coral/10 text-coral' : 'bg-emerald/10 text-emerald'}`}>
                    Nguy cơ: {j.risk_label === 'High' ? 'Cao' : j.risk_label === 'Medium' ? 'Trung bình' : 'Thấp'}
                  </span>
                  <span className="text-[10px] px-3 py-1.5 rounded-full bg-brand/10 text-brand font-bold uppercase tracking-wider">
                    Tiêu cực: {j.sentiment_score}%
                  </span>
                </div>
                {adviceList.length > 0 && (
                  <div className="pt-5 border-t border-slate-100">
                    <p className="text-[10px] font-extrabold text-text-muted uppercase tracking-widest mb-3">Gợi ý từ AI</p>
                    <ul className="space-y-2">
                      {adviceList.map((item: string, idx: number) => (
                        <li key={idx} className="flex gap-3 text-xs text-text-main font-medium leading-relaxed">
                          <div className="w-1.5 h-1.5 bg-brand rounded-full mt-1.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

function ChatView({ messages, onSend, mood, isTyping }: { messages: Message[], onSend: (t: string) => void, mood?: Mood, isTyping: boolean }) {
  const [input, setInput] = useState('');
  const [proactive, setProactive] = useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      getProactiveGreeting(mood?.level.toString()).then(setProactive);
    }
  }, [mood]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      className="flex flex-col h-[calc(100vh-220px)]"
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 pb-6 scrollbar-hide px-2">
        {proactive && messages.length === 0 && (
          <div className="flex justify-start">
            <div className="chat-bubble-ai italic text-text-muted">
              {proactive}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
              <p className="text-sm font-medium leading-relaxed">{m.content}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-3 items-center bg-white p-3 rounded-[2rem] shadow-xl border border-brand/5">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && input.trim() && (onSend(input), setInput(''))}
          placeholder="Nhắn tin cho MindGuard..."
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-4 font-medium"
        />
        <button 
          onClick={() => { if (input.trim()) { onSend(input); setInput(''); } }}
          className="w-12 h-12 bg-brand text-white rounded-2xl shadow-lg shadow-brand/20 flex items-center justify-center transition-transform active:scale-90"
        >
          <Send size={20} />
        </button>
      </div>
    </motion.div>
  );
}
