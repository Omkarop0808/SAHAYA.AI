import React, { useEffect, useState, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import { Users, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GlobalNotifications() {
  const socket = useSocket();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const lastMsgRef = useRef({ text: '', ts: 0 });

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data) => {
      // Dedup: ignore identical messages arriving within 2 seconds
      const now = Date.now();
      if (data.message === lastMsgRef.current.text && now - lastMsgRef.current.ts < 2000) {
        return;
      }
      lastMsgRef.current = { text: data.message, ts: now };

      const id = now;
      setNotifications(prev => [...prev, { id, ...data }]);
      
      // Auto dismiss after 10 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 10000);
    };

    socket.on('gd_lobby_notification', handleNotification);

    return () => {
      socket.off('gd_lobby_notification', handleNotification);
    };
  }, [socket]);

  const handleJoin = (n) => {
    setNotifications(prev => prev.filter(x => x.id !== n.id));
    navigate('/career/interview', { 
      state: { autoJoinGD: true, gdTopic: n.inviteTopic, gdSize: n.inviteSize } 
    });
  };

  const dismiss = (e, id) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3">
      <AnimatePresence>
        {notifications.map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, x: 50 }}
            className="bg-[rgba(139,92,246,0.15)] backdrop-blur-xl border border-[rgba(139,92,246,0.4)] shadow-2xl rounded-xl p-4 flex items-start gap-4 max-w-sm cursor-pointer hover:bg-[rgba(139,92,246,0.25)] transition-colors"
            onClick={() => handleJoin(n)}
          >
            <div className="bg-[var(--career-accent)] bg-opacity-20 p-2 rounded-lg text-[var(--career-accent2)] shrink-0">
               <Users size={20} />
            </div>
            <div className="flex-1">
               <h3 className="text-sm font-bold text-white mb-1">Group Discussion</h3>
               <p className="text-xs text-white/70 line-clamp-2">{n.message}</p>
            </div>
            <button 
              onClick={(e) => dismiss(e, n.id)}
              className="text-white/40 hover:text-white shrink-0 cursor-pointer p-1"
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
