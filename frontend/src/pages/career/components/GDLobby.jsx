import React, { useState, useEffect } from 'react';
import GDVideoRoom from './GDVideoRoom';
import { useSocket } from '../../../context/SocketContext';
import { User } from 'lucide-react';

export default function GDLobby({ config, eduData, onEndGd }) {
  const socket = useSocket();
  const [matchData, setMatchData] = useState(null);
  const [isSearching, setIsSearching] = useState(true);
  const [waitlist, setWaitlist] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const reqSize = config.gdParticipants || 4;
    const topicDesc = config.subject || 'General Tech';
    const uName = eduData?.name || 'Student';

    // emit join
    socket.emit('join_gd_lobby', {
      name: uName,
      requestedSize: reqSize,
      topic: topicDesc
    });

    const handleMatch = (data) => {
      setMatchData(data);
      setIsSearching(false);
    };

    const handleUpdate = (newList) => {
      // Filter list purely to visual people who are looking for the same bucket size for clarity, or just show all
      setWaitlist(newList);
    };

    socket.on('gd_match_found', handleMatch);
    socket.on('lobby_update', handleUpdate);

    return () => {
      socket.emit('leave_gd_lobby');
      socket.off('gd_match_found', handleMatch);
      socket.off('lobby_update', handleUpdate);
    };
  }, [socket, config, eduData]);

  if (matchData) {
    return (
      <GDVideoRoom 
        roomId={matchData.roomId} 
        participants={matchData.participants} 
        duration={config.duration}
        topic={config.subject || 'General Tech'}
        onEnd={onEndGd}
      />
    );
  }

  const matchingQueue = waitlist.filter(w => w.requestedSize === config.gdParticipants);

  return (
    <div className="flex flex-col items-center justify-center p-12 text-white min-h-[60vh]">
      <div className="relative mb-8">
         <div className="animate-spin h-24 w-24 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
         <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <span className="text-xl">⏳</span>
         </div>
      </div>
      <h2 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
         Finding GD Partners...
      </h2>
      <p className="text-gray-400 mb-8 max-w-md text-center">
         Waiting for {config.gdParticipants} participants to join. Once the room is full, you will be automatically redirected to the Live Video Room.
      </p>
      
      <div className="w-full max-w-md bg-white/[0.03] border border-white/10 rounded-2xl p-6 mb-8">
         <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-4">Live Queue ({matchingQueue.length} / {config.gdParticipants})</h3>
         
         <div className="flex flex-col gap-3">
           {matchingQueue.length === 0 ? (
             <div className="text-center py-4 text-white/40 text-sm">You are the first one here.</div>
           ) : (
             matchingQueue.map((user, idx) => (
               <div key={idx} className="flex items-center gap-3 bg-white/[0.04] rounded-lg p-3 border border-white/[0.05]">
                 <div className="h-10 w-10 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400">
                   <User size={18} />
                 </div>
                 <div>
                   <div className="text-sm font-bold text-white/90">{user.name}</div>
                   <div className="text-xs text-white/40">{user.topic}</div>
                 </div>
               </div>
             ))
           )}
           {/* Render empty slots */}
           {Array.from({ length: Math.max(0, config.gdParticipants - matchingQueue.length) }).map((_, idx) => (
               <div key={`empty-${idx}`} className="flex items-center gap-3 bg-white/[0.01] border border-dashed border-white/10 rounded-lg p-3 opacity-50">
                 <div className="h-10 w-10 bg-white/5 rounded-full flex items-center justify-center text-white/20">
                   <User size={18} />
                 </div>
                 <div className="text-sm font-medium text-white/30 italic">Waiting...</div>
               </div>
           ))}
         </div>
      </div>

      <div className="px-6 py-3 bg-gray-800 rounded-lg text-sm text-gray-300 shadow-xl border border-gray-700">
         Socket Connected: <span className={socket ? "text-green-400 font-medium" : "text-yellow-400 font-medium"}>{socket ? 'Yes' : 'Connecting...'}</span>
      </div>
    </div>
  );
}
