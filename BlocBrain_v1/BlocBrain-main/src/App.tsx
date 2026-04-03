import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Menu, 
  Plus, 
  Trash2, 
  Settings as SettingsIcon, 
  BookOpen, 
  Undo2, 
  Redo2, 
  X, 
  ChevronLeft,
  Brain as BrainIcon,
  ExternalLink,
  Image as ImageIcon,
  Target,
  Mail,
  HelpCircle,
  ArrowRight,
  Clock,
  Bell,
  ZoomIn,
  ZoomOut,
  Maximize,
  Move,
  FileText,
  CheckSquare,
  Activity,
  MessageSquare
} from 'lucide-react';
import { useBrainStore, Brain, Node, Priority, TodoItem, Habit, User as StoreUser } from './store';
import { v4 as uuidv4 } from 'uuid';
import { cn } from './lib/utils';
import { auth, signInWithGoogle, logout, db, OperationType, handleFirestoreError } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  query, 
  where,
  writeBatch
} from 'firebase/firestore';
import { 
  format, 
  addDays, 
  isAfter, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  isToday,
  addMonths, 
  subMonths,
  subDays
} from 'date-fns';

// --- Components ---

const Sidebar = ({ isOpen, onClose, onOpenSettings, onOpenGuide, onOpenTrash }: { 
  isOpen: boolean, 
  onClose: () => void,
  onOpenSettings: () => void,
  onOpenGuide: () => void,
  onOpenTrash: () => void
}) => {
  const { user, brains, activeBrainId, setActiveBrain, addBrain, reorderBrains, deleteBrain, setUser, resetStore } = useBrainStore();
  const [isAdding, setIsAdding] = useState(false);
  const [newBrainName, setNewBrainName] = useState('');

  const activeBrains = brains.filter(b => !b.isDeleted);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      resetStore();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const moveBrain = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < activeBrains.length) {
      // Find original indices in brains array
      const originalIndex = brains.findIndex(b => b.id === activeBrains[index].id);
      const targetOriginalIndex = brains.findIndex(b => b.id === activeBrains[newIndex].id);
      reorderBrains(originalIndex, targetOriginalIndex);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 h-full w-full sm:w-72 bg-mc-black z-50 mc-border border-l-0 border-t-0 border-b-0 flex flex-col"
          >
            <div className="p-4 border-b-4 border-black flex justify-between items-center bg-mc-gray">
              <h2 className="font-minecraft text-2xl text-mc-orange">BLOC BRAIN</h2>
              <button onClick={onClose} className="p-1 hover:bg-mc-light-gray rounded">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* User Profile / Login */}
              <div className="mc-border bg-mc-gray p-4 mb-4">
                {user ? (
                  <div className="flex items-center gap-3">
                    <img 
                      src={user.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.email}`} 
                      alt="Profile" 
                      className="w-10 h-10 mc-border border-black"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-minecraft text-sm truncate">{user.displayName || 'User'}</p>
                      <button 
                        onClick={handleLogout}
                        className="text-xs text-mc-orange hover:underline font-minecraft"
                      >
                        LOGOUT
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={handleLogin}
                    className="w-full mc-button-orange flex items-center justify-center gap-2 py-2"
                  >
                    <Mail size={18} />
                    <span className="font-minecraft">LOGIN WITH GOOGLE</span>
                  </button>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-minecraft text-lg text-gray-400 uppercase tracking-wider">My Brains</h3>
                  <button 
                    onClick={() => setIsAdding(true)}
                    className="p-1 hover:text-mc-orange"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                
                {isAdding && (
                  <div className="mb-2 space-y-2">
                    <input 
                      autoFocus
                      className="w-full bg-black border-2 border-mc-gray p-2 font-minecraft text-white outline-none focus:border-mc-orange"
                      placeholder="Brain Name..."
                      value={newBrainName}
                      onChange={(e) => setNewBrainName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newBrainName) {
                          addBrain(newBrainName);
                          setNewBrainName('');
                          setIsAdding(false);
                        }
                        if (e.key === 'Escape') setIsAdding(false);
                      }}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  {activeBrains.map((brain, index) => (
                    <div key={brain.id} className="group flex items-center gap-1">
                      <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveBrain(index, 'up')} className="hover:text-mc-orange p-0.5"><ChevronLeft size={14} className="rotate-90" /></button>
                        <button onClick={() => moveBrain(index, 'down')} className="hover:text-mc-orange p-0.5"><ChevronLeft size={14} className="-rotate-90" /></button>
                      </div>
                      <button
                        onClick={() => {
                          setActiveBrain(brain.id);
                          if (window.innerWidth < 768) onClose();
                        }}
                        className={cn(
                          "flex-1 flex items-center gap-3 p-3 font-minecraft text-lg transition-colors border-2 border-transparent",
                          activeBrainId === brain.id ? "bg-mc-gray border-mc-orange text-mc-orange" : "hover:bg-mc-gray/50"
                        )}
                      >
                        <BrainIcon size={20} />
                        <span className="truncate">{brain.name}</span>
                      </button>
                      <button 
                        onClick={() => deleteBrain(brain.id)}
                        className="p-2 text-red-500 hover:bg-red-500/20 transition-colors mc-border border-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="font-minecraft text-lg text-gray-400 uppercase tracking-wider mb-2">System</h3>
                <button onClick={onOpenSettings} className="w-full flex items-center gap-3 p-3 font-minecraft text-lg hover:bg-mc-gray/50 transition-colors">
                  <SettingsIcon size={20} />
                  <span>Settings</span>
                </button>
                <button onClick={onOpenGuide} className="w-full flex items-center gap-3 p-3 font-minecraft text-lg hover:bg-mc-gray/50 transition-colors">
                  <BookOpen size={20} />
                  <span>Guide</span>
                </button>
                <button onClick={onOpenTrash} className="w-full flex items-center gap-3 p-3 font-minecraft text-lg hover:bg-mc-gray/50 transition-colors text-red-400">
                  <Trash2 size={20} />
                  <span>Trash</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-mc-gray border-t-4 border-black">
              <p className="text-xs text-gray-500 font-minecraft text-center">v1.0.0 - Minecraft Edition</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden" 
          onClick={onClose}
        />
      )}
    </>
  );
};

const NodeComponent = ({ 
  node, 
  isSelected, 
  isConnecting,
  onSelect, 
  onDrag, 
  onDragStart,
  onUpdate,
  onOpenModal
}: { 
  node: Node, 
  isSelected: boolean, 
  isConnecting: boolean,
  onSelect: (e: React.MouseEvent | React.TouchEvent) => void,
  onDrag: (id: string, x: number, y: number) => void,
  onDragStart: () => void,
  onUpdate: (id: string, updates: Partial<Node>) => void,
  onOpenModal: (node: Node) => void,
  key?: string
}) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

  const bubbleSize = node.priority === 'high' ? 1.4 : node.priority === 'medium' ? 1.2 : 1;

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!dragRef.current.isDragging) return;
    const dx = Math.abs(e.clientX - dragRef.current.startX);
    const dy = Math.abs(e.clientY - dragRef.current.startY);
    
    // If it was a click (moved less than 5px), open modal
    // BUT NOT if shift/ctrl/meta is held (those are for selection)
    // AND NOT if we are in connection mode (as that handles the click)
    if (dx < 5 && dy < 5 && !e.shiftKey && !e.ctrlKey && !e.metaKey && !isConnecting) {
      onOpenModal(node);
    }
    
    dragRef.current.isDragging = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (moveEvent: MouseEvent) => {
    if (!dragRef.current.isDragging) return;
    const dx = moveEvent.clientX - dragRef.current.startX;
    const dy = moveEvent.clientY - dragRef.current.startY;
    onDrag(node.id, dragRef.current.initialX + dx, dragRef.current.initialY + dy);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    onSelect(e);
    onDragStart();
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialX: node.x,
      initialY: node.y
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp as any);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!dragRef.current.isDragging) return;
    const touch = e.changedTouches[0];
    const dx = Math.abs(touch.clientX - dragRef.current.startX);
    const dy = Math.abs(touch.clientY - dragRef.current.startY);
  
    dragRef.current.isDragging = false;
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd as any);

    if (dx < 8 && dy < 8 && !isConnecting) {
      const n=node;
      setTimeout(() => onOpenModal(n),10);
    }
  };

  const handleTouchMove = (moveEvent: TouchEvent) => {
    if (!dragRef.current.isDragging) return;
    const touch = moveEvent.touches[0];
    const dx = touch.clientX - dragRef.current.startX;
    const dy = touch.clientY - dragRef.current.startY;
    onDrag(node.id, dragRef.current.initialX + dx, dragRef.current.initialY + dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    onSelect(e);
    onDragStart();
    dragRef.current = {
      isDragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      initialX: node.x,
      initialY: node.y
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd as any);
  };

  return (
    <div
      ref={nodeRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={(e) => e.stopPropagation()}
      style={{ 
        left: node.x, 
        top: node.y, 
        width: node.width || 200,
        height: node.height || 200,
        transform: `scale(${bubbleSize})`,
        zIndex: isSelected ? 10 : 1,
        borderColor: node.color || '#ff9800'
      }}
      className={cn(
        "absolute p-4 mc-border cursor-move transition-shadow bg-mc-gray flex flex-col overflow-hidden",
        isSelected ? "ring-4 ring-white shadow-2xl" : "shadow-lg",
        node.shape === 'circle' ? "rounded-full" : 
        node.shape === 'rounded' ? "rounded-3xl" : 
        node.type === 'board' ? "rounded-none" : "rounded-none"
      )}
    >
      <div className="flex flex-col gap-2 h-full">
        <div className="font-minecraft text-xl text-mc-orange truncate text-center border-b border-black/20 pb-1">
          {node.title || 'Untitled'}
        </div>
        <div className="font-minecraft text-sm break-words text-center flex-1 overflow-hidden line-clamp-4">
          {node.type === 'todo' ? (node.content || 'To-Do List') : node.type === 'tracker' ? (node.content || 'Habit Tracker') : node.content}
        </div>

        {node.type === 'todo' && node.todoList && (
          <div className="text-[10px] font-minecraft opacity-80 text-left space-y-0.5 mt-1 border-t border-black/10 pt-1">
            {node.todoList.slice(0, 3).map(t => (
              <div key={t.id} className="flex items-center gap-1 truncate">
                <div className={cn("w-2 h-2 border border-black/20", t.completed ? "bg-mc-orange" : "bg-black/20")} />
                <span className={t.completed ? "line-through opacity-50" : ""}>{t.text || '...'}</span>
              </div>
            ))}
            {node.todoList.length > 3 && <div className="text-center opacity-50">+{node.todoList.length - 3} more</div>}
          </div>
        )}

        {node.type === 'tracker' && node.habits && (
          <div className="text-[10px] font-minecraft opacity-80 text-left space-y-2 mt-1 border-t border-black/10 pt-1">
            {node.habits.slice(0, 2).map(habit => {
              const last7Days = Array.from({ length: 7 }, (_, i) => {
                const date = subDays(new Date(), i);
                const dateStr = format(date, 'yyyy-MM-dd');
                return habit.entries?.[dateStr]?.completed || false;
              }).reverse();

              return (
                <div key={habit.id} className="space-y-0.5">
                  <div className="truncate opacity-70">{habit.name || '...'}</div>
                  <div className="flex gap-0.5">
                    {last7Days.map((completed, i) => (
                      <div 
                        key={i} 
                        className={cn(
                          "w-2 h-2 border border-black/10", 
                          completed ? "bg-mc-orange" : "bg-black/20"
                        )} 
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {node.habits.length > 2 && <div className="text-center opacity-50">+{node.habits.length - 2} more</div>}
          </div>
        )}

        {node.type === 'link' && node.targetUrl && (
          <a 
            href={node.targetUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs underline opacity-80 hover:opacity-100"
          >
            <ExternalLink size={12} /> Visit Link
          </a>
        )}

        {node.type === 'image' && node.imageUrl && (
          <img 
            src={node.imageUrl} 
            alt="Node" 
            className="w-full h-24 object-cover border-2 border-black/20"
            referrerPolicy="no-referrer"
          />
        )}

        {node.deadline && (
          <div className="text-[10px] font-minecraft opacity-70 text-center">
            Due: {format(new Date(node.deadline), 'MMM dd')}
          </div>
        )}

        {node.tracker !== undefined && (
          <div className="w-full bg-black/30 h-2 rounded-full overflow-hidden border border-black/20">
            <div 
              className="bg-mc-orange h-full transition-all" 
              style={{ width: `${node.tracker}%`, backgroundColor: node.color }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const ConnectionLine: React.FC<{ from: Node, to: Node, color?: string, onClick?: () => void }> = ({ from, to, color, onClick }) => {
  // Calculate center points
  const x1 = from.x + (from.width || 200) / 2;
  const y1 = from.y + (from.height || 200) / 2;
  const x2 = to.x + (to.width || 200) / 2;
  const y2 = to.y + (to.height || 200) / 2;

  // Curved path calculation
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = x1 + dx / 2;
  const cy = y1 + dy / 2 - Math.abs(dx) * 0.2; // Curve upwards based on distance

  const path = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  const strokeColor = color || from.color || '#ff9800';

  return (
    <g className="group cursor-pointer pointer-events-auto" onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
      {/* Invisible thick path for easier clicking */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="20"
        className="transition-all"
      />
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth="4"
        strokeDasharray="8,4"
        className="transition-all duration-300 group-hover:stroke-white group-hover:stroke-[6px]"
      />
    </g>
  );
};

const HabitCalendar = ({ habit, onSetDayStatus, onUpdateFeedback, onDeleteHabit }: { 
  habit: Habit, 
  onSetDayStatus: (date: string, completed: boolean) => void,
  onUpdateFeedback: (date: string, feedback: string) => void,
  onDeleteHabit: () => void
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const selectedEntry = selectedDate ? habit.entries?.[selectedDate] : null;

  return (
    <div className="space-y-4 mc-panel bg-black/40 p-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <h4 className="text-mc-orange font-minecraft text-lg uppercase truncate max-w-[150px]">{habit.name || 'Unnamed Habit'}</h4>
          <button onClick={onDeleteHabit} className="text-red-500 hover:text-red-400"><Trash2 size={14} /></button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="mc-button p-1"><ChevronLeft size={16} /></button>
          <span className="font-minecraft text-[10px] w-24 text-center">{format(currentMonth, 'MMM yyyy')}</span>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="mc-button p-1"><ChevronLeft size={16} className="rotate-180" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div key={`${day}-${i}`} className="text-center font-minecraft text-[10px] opacity-50">{day}</div>
        ))}
        {calendarDays.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const entry = habit.entries?.[dateStr];
          const isCurrentMonth = isSameDay(startOfMonth(day), monthStart);
          
          return (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={cn(
                "aspect-square mc-border text-[10px] font-minecraft flex items-center justify-center transition-all",
                !isCurrentMonth ? "opacity-20" : "opacity-100",
                entry?.completed === true ? "bg-green-500 text-white" : entry?.completed === false ? "bg-red-500 text-white" : "bg-black/20 text-white",
                selectedDate === dateStr ? "ring-2 ring-white scale-110 z-10" : "",
                isToday(day) ? "border-mc-orange border-2" : ""
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-mc-gray mc-border space-y-3"
        >
          <div className="flex justify-between items-center">
            <span className="font-minecraft text-xs text-mc-orange">{format(new Date(selectedDate), 'MMMM dd, yyyy')}</span>
            <button onClick={() => setSelectedDate(null)}><X size={14} /></button>
          </div>
          
          <div className="flex items-center gap-3">
            <span className="font-minecraft text-sm">Did you show up?</span>
            <div className="flex gap-2">
              <button 
                onClick={() => onSetDayStatus(selectedDate, true)}
                className={cn(
                  "mc-button px-4 py-1 text-xs transition-all",
                  selectedEntry?.completed ? "bg-green-500 text-white" : "opacity-50 hover:opacity-100"
                )}
              >
                YES
              </button>
              <button 
                onClick={() => onSetDayStatus(selectedDate, false)}
                className={cn(
                  "mc-button px-4 py-1 text-xs transition-all",
                  selectedEntry?.completed === false ? "bg-red-500 text-white" : "opacity-50 hover:opacity-100"
                )}
              >
                NO
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-minecraft opacity-70">Daily Feedback</label>
            <textarea
              className="w-full bg-black border border-mc-gray p-2 font-minecraft text-white outline-none focus:border-mc-orange min-h-[60px] resize-none text-xs"
              value={selectedEntry?.feedback || ''}
              onChange={(e) => onUpdateFeedback(selectedDate, e.target.value)}
              placeholder="How did it go? Any notes?"
            />
          </div>
        </motion.div>
      )}
    </div>
  );
};

// --- Main App ---

export default function App() {
  const { 
    user,
    brains, 
    activeBrainId, 
    setActiveBrain,
    addBrain,
    addNode, 
    updateNode, 
    deleteNode,
    addConnection,
    deleteConnection,
    undo,
    redo,
    history,
    saveHistory,
    deleteBrain,
    restoreBrain,
    permanentlyDeleteBrain,
    updateSettings,
    settings,
    setUser,
    setBrains
  } = useBrainStore();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [deletingConnectionId, setDeletingConnectionId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [zoomInput, setZoomInput] = useState('100');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pendingFontSize, setPendingFontSize] = useState(settings.fontSize);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData: StoreUser = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || undefined,
          photoURL: firebaseUser.photoURL || undefined,
        };
        setUser(userData);

        // Sync user to Firestore
        try {
          await setDoc(doc(db, 'users', firebaseUser.uid), userData, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
        }
      } else {
        setUser(null);
        setIsInitialLoad(false);
      }
    });
    return () => unsubscribe();
  }, [setUser]);

  // Firestore Sync - Fetch Brains
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'brains'), where('userId', '==', user.id));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const remoteBrains: Brain[] = [];
      snapshot.forEach((doc) => {
        remoteBrains.push(doc.data() as Brain);
      });

      if (remoteBrains.length > 0) {
        // Simple merge: if remote has data, use it
        setBrains(remoteBrains);
        
        // Set active brain if not set or if current one doesn't exist anymore
        if (!activeBrainId || !remoteBrains.find(b => b.id === activeBrainId)) {
          setActiveBrain(remoteBrains[0].id);
        }
      }
      setIsInitialLoad(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'brains');
    });

    return () => unsubscribe();
  }, [user, setBrains, setActiveBrain]);

  // Firestore Sync - Save Changes
  useEffect(() => {
    if (!user || isInitialLoad) return;

    const syncToFirestore = async () => {
      try {
        const batch = writeBatch(db);
        brains.forEach(brain => {
          const brainRef = doc(db, 'brains', brain.id);
          batch.set(brainRef, { ...brain, userId: user.id }, { merge: true });
        });
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'brains (batch)');
      }
    };

    const timeoutId = setTimeout(syncToFirestore, 2000); // 2s debounce
    return () => clearTimeout(timeoutId);
  }, [brains, user, isInitialLoad]);

  // Sync pending font size when settings opens
  useEffect(() => {
    if (isSettingsOpen) {
      setPendingFontSize(settings.fontSize);
    }
  }, [isSettingsOpen, settings.fontSize]);

  const handleCloseSettings = () => {
    updateSettings({ fontSize: pendingFontSize });
    setIsSettingsOpen(false);
  };

  useEffect(() => {
    setZoomInput(Math.round(zoom * 100).toString());
  }, [zoom]);

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setZoomInput(e.target.value);
  };

  const handleZoomInputBlur = () => {
    const val = parseInt(zoomInput);
    if (!isNaN(val)) {
      setZoom(Math.max(0.1, Math.min(5, val / 100)));
    } else {
      setZoomInput(Math.round(zoom * 100).toString());
    }
  };

  const handleZoomInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleZoomInputBlur();
      (e.target as HTMLInputElement).blur();
    }
  };
  const [isPanning, setIsPanning] = useState(false);
  const [hasMovedDuringPan, setHasMovedDuringPan] = useState(false);

  // Handle Escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingNodeId(null);
        setDeletingConnectionId(null);
        if (isSettingsOpen) {
          handleCloseSettings();
        }
        setIsGuideOpen(false);
        setIsTrashOpen(false);
        setIsConnecting(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Apply global font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.fontSize}px`;
  }, [settings.fontSize]);
  
  const activeBrain = brains.find(b => b.id === activeBrainId);
  const editingNode = activeBrain?.nodes.find(n => n.id === editingNodeId);
  const boardRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.1));
  const handleRecenter = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleBoardWheel = (e: React.WheelEvent) => {
    // If Ctrl is held, zoom instead of scroll
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.1, Math.min(5, prev + delta)));
    } else {
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const handleBoardMouseDown = (e: React.MouseEvent) => {
    // Allow panning on left click (0) or middle click (1)
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      setHasMovedDuringPan(false);
    }
  };

  const handleBoardMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      if (Math.abs(e.movementX) > 1 || Math.abs(e.movementY) > 1) {
        setHasMovedDuringPan(true);
      }
      setOffset(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
    }
  };

  const handleBoardMouseUp = () => {
    setIsPanning(false);
  };

  const handleBoardTouchStart = (e: React.TouchEvent) => {
  if (e.touches.length === 1 && e.target === boardRef.current) {
    const touch = e.touches[0];
    setIsPanning(true);
    setHasMovedDuringPan(false);
    (boardRef.current as any)._touchStart = { x: touch.clientX, y: touch.clientY };
  }
};

const handleBoardTouchMove = (e: React.TouchEvent) => {
  if (!isPanning || e.touches.length !== 1) return;
  const touch = e.touches[0];
  const prev = (boardRef.current as any)._touchStart;
  if (!prev) return;
  const dx = touch.clientX - prev.x;
  const dy = touch.clientY - prev.y;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) setHasMovedDuringPan(true);
  setOffset(p => ({ x: p.x + dx, y: p.y + dy }));
  (boardRef.current as any)._touchStart = { x: touch.clientX, y: touch.clientY };
};

const handleBoardTouchEnd = () => {
  setIsPanning(false);
};

  // Notification system
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const checkDeadlines = () => {
      if (!brains) return;
      const now = new Date();
      
      brains.forEach(brain => {
        brain.nodes.forEach(node => {
          if (!node.deadline) return;
          
          const deadline = new Date(node.deadline);
          const timeDiff = deadline.getTime() - now.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
          const hoursDiff = Math.ceil(timeDiff / (1000 * 60 * 60));
          
          const lastNotified = node.lastNotified ? new Date(node.lastNotified) : null;
          let shouldNotify = false;
          let message = "";

          // Last day: every 1 hour
          if (daysDiff <= 1 && hoursDiff > 0) {
            if (!lastNotified || (now.getTime() - lastNotified.getTime() >= 1000 * 60 * 60)) {
              shouldNotify = true;
              message = `Deadline approaching for "${node.content.slice(0, 20)}...": ${hoursDiff} hour(s) left!`;
            }
          } 
          // Coming closer: everyday (within 7 days)
          else if (daysDiff <= 7 && daysDiff > 1) {
            if (!lastNotified || (now.getTime() - lastNotified.getTime() >= 1000 * 60 * 60 * 24)) {
              shouldNotify = true;
              message = `Deadline approaching for "${node.content.slice(0, 20)}...": ${daysDiff} day(s) left.`;
            }
          }

          if (shouldNotify && Notification.permission === "granted") {
            new Notification("BlockBrain Deadline", {
              body: message,
              icon: "/favicon.ico"
            });
            updateNode(node.id, { lastNotified: now.toISOString() });
          }
        });
      });
    };

    const interval = setInterval(checkDeadlines, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [brains, updateNode]);

  // Auto-clean trash (older than 14 days)
  useEffect(() => {
    const now = new Date();
    brains.forEach(brain => {
      if (brain.isDeleted && brain.deletedAt) {
        const deletedAt = new Date(brain.deletedAt);
        if (isAfter(now, addDays(deletedAt, 14))) {
          permanentlyDeleteBrain(brain.id);
        }
      }
    });
  }, [brains, permanentlyDeleteBrain]);

  const handleBoardClick = (e: React.MouseEvent) => {
    if (hasMovedDuringPan) return;
    // Only clear if clicking the background directly
    if (e.target === boardRef.current) {
      setSelectedNodeIds([]);
      setIsConnecting(null);
    }
  };

  const handleNodeSelect = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    
    if (isConnecting) {
      if (isConnecting !== id) {
        const fromNode = activeBrain?.nodes.find(n => n.id === isConnecting);
        addConnection(isConnecting, id, fromNode?.color);
      }
      setIsConnecting(null);
      return;
    }

    // Only select if Shift, Ctrl, or Meta is held
    const isModifierHeld = ('shiftKey' in e && (e.shiftKey || e.ctrlKey || e.metaKey));
    if (isModifierHeld) {
      setSelectedNodeIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    } else {
      // Normal click: clear selection so the bulk actions bar doesn't show up
      setSelectedNodeIds([]);
    }
  };

  const handleNodeDrag = (id: string, x: number, y: number) => {
    // If multiple selected, drag all
    if (selectedNodeIds.includes(id)) {
      const node = activeBrain?.nodes.find(n => n.id === id);
      if (!node) return;
      const dx = x - node.x;
      const dy = y - node.y;
      
      selectedNodeIds.forEach(selectedId => {
        const n = activeBrain?.nodes.find(node => node.id === selectedId);
        if (n) updateNode(selectedId, { x: n.x + dx, y: n.y + dy }, true);
      });
    } else {
      updateNode(id, { x, y }, true);
    }
  };

  const handleAddNode = (type: Node['type'] = 'text') => {
    const nodeData: Partial<Node> = { type, x: 200, y: 200 };
    if (type === 'todo') {
      nodeData.title = 'To-Do List';
      nodeData.todoList = [];
    } else if (type === 'tracker') {
      nodeData.title = 'Daily Tracker';
      nodeData.habits = [];
    }
    addNode(nodeData);
  };

  const handleFeedback = () => {
    window.location.href = `mailto:yadav.shekhar.9901@gmail.com?subject=BlockBrain Feedback`;
  };

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden select-none">
      {/* Header */}
      <header className="h-16 bg-mc-gray border-b-4 border-black flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="mc-button p-2"
          >
            <Menu size={24} />
          </button>
          <h1 className="font-minecraft text-2xl text-mc-orange hidden sm:block">
            {activeBrain?.name || 'Second Brain'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={undo} 
            disabled={history.past.length === 0}
            className="mc-button p-2 disabled:opacity-50"
          >
            <Undo2 size={20} />
          </button>
          <button 
            onClick={redo} 
            disabled={history.future.length === 0}
            className="mc-button p-2 disabled:opacity-50"
          >
            <Redo2 size={20} />
          </button>
          <div className="w-px h-8 bg-black mx-2" />
          <div className="relative">
            <button 
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className="mc-button-orange p-2"
              title="Add Node"
            >
              <Plus size={24} />
            </button>
            {isAddMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsAddMenuOpen(false)} 
                />
                <div className="absolute top-full right-0 mt-2 w-48 mc-panel bg-mc-gray z-50 shadow-2xl">
                  <button 
                    onClick={() => { handleAddNode('text'); setIsAddMenuOpen(false); }} 
                    className="w-full text-left p-3 hover:bg-mc-orange hover:text-white flex items-center gap-3 transition-colors font-minecraft"
                  >
                    <FileText size={18} /> Add Note
                  </button>
                  <button 
                    onClick={() => { handleAddNode('todo'); setIsAddMenuOpen(false); }} 
                    className="w-full text-left p-3 hover:bg-mc-orange hover:text-white flex items-center gap-3 transition-colors font-minecraft"
                  >
                    <CheckSquare size={18} /> To-Do List
                  </button>
                  <button 
                    onClick={() => { handleAddNode('tracker'); setIsAddMenuOpen(false); }} 
                    className="w-full text-left p-3 hover:bg-mc-orange hover:text-white flex items-center gap-3 transition-colors font-minecraft"
                  >
                    <Activity size={18} /> Daily Tracker
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Board Area */}
      <main 
        ref={boardRef}
        onClick={handleBoardClick}
        onWheel={handleBoardWheel}
        onMouseDown={handleBoardMouseDown}
        onMouseMove={handleBoardMouseMove}
        onMouseUp={handleBoardMouseUp}
        onMouseLeave={handleBoardMouseUp}
        onTouchStart={handleBoardTouchStart}
        onTouchMove={handleBoardTouchMove}
        onTouchEnd={handleBoardTouchEnd}
        className={cn(
          "flex-1 relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] bg-mc-black",
          isPanning ? "cursor-grabbing" : "cursor-default"
        )}
        style={{ 
          backgroundImage: settings.wallpaper ? `url(${settings.wallpaper})` : undefined,
          backgroundSize: 'cover'
        }}
      >
        <div 
          className="absolute inset-0 transition-transform duration-75 ease-out"
          style={{ 
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: '0 0'
          }}
        >
          <div className="absolute inset-0 pointer-events-none opacity-10" 
            style={{ 
              backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
              backgroundSize: '40px 40px',
              width: '5000px',
              height: '5000px',
              left: '-2500px',
              top: '-2500px'
            }} 
          />
          
          <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible" style={{ zIndex: 0 }}>
            {activeBrain?.connections.map(conn => {
              const from = activeBrain.nodes.find(n => n.id === conn.fromId);
              const to = activeBrain.nodes.find(n => n.id === conn.toId);
              if (from && to) return (
                <ConnectionLine 
                  key={conn.id} 
                  from={from} 
                  to={to} 
                  color={conn.color} 
                  onClick={() => setDeletingConnectionId(conn.id)}
                />
              );
              return null;
            })}
          </svg>

          {activeBrain?.nodes.map(node => (
            <NodeComponent 
              key={node.id} 
              node={node} 
              isSelected={selectedNodeIds.includes(node.id)}
              isConnecting={!!isConnecting}
              onSelect={(e) => handleNodeSelect(node.id, e)}
              onDrag={handleNodeDrag}
              onDragStart={saveHistory}
              onUpdate={updateNode}
              onOpenModal={(n) => setEditingNodeId(n.id)}
            />
          ))}
        </div>

        {/* Navigation Controls */}
        <div 
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed bottom-8 left-8 flex flex-col gap-1.5 z-40"
        >
          <div className="flex gap-1.5">
            <button onClick={handleZoomIn} className="mc-button w-9 h-9 !p-0 flex items-center justify-center text-mc-orange" title="Zoom In"><ZoomIn size={20} /></button>
            <button onClick={handleZoomOut} className="mc-button w-9 h-9 !p-0 flex items-center justify-center text-mc-orange" title="Zoom Out"><ZoomOut size={20} /></button>
            <button onClick={handleRecenter} className="mc-button w-9 h-9 !p-0 flex items-center justify-center text-mc-orange" title="Recenter"><Maximize size={20} /></button>
            <div className="flex items-center bg-black/50 mc-border px-2 py-0 gap-1 h-9">
              <input 
                type="text"
                value={zoomInput}
                onChange={handleZoomInputChange}
                onBlur={handleZoomInputBlur}
                onKeyDown={handleZoomInputKeyDown}
                className="w-8 bg-transparent text-white font-minecraft text-xs outline-none text-right"
              />
              <span className="text-white font-minecraft text-xs">%</span>
            </div>
          </div>
          <div className="text-white font-minecraft text-[10px] opacity-60 leading-none">
            Scroll or Drag to Pan, Ctrl+Scroll to Zoom
          </div>
        </div>

        {isConnecting && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-mc-orange text-black px-4 py-2 font-minecraft mc-border animate-pulse z-40 text-center max-w-[90vw]">
            Select target node to connect...
          </div>
        )}
      </main>

      {/* Floating Action Menu (Bottom Right) */}
      <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 flex flex-col gap-2 sm:gap-4 z-30">
        <AnimatePresence>
          {selectedNodeIds.length > 0 && (
            <motion.div 
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="flex items-center gap-2 bg-mc-gray p-2 mc-border shadow-2xl"
            >
              <div className="text-xs font-minecraft text-white px-2 border-r border-black/20 mr-2">
                {selectedNodeIds.length} SELECTED
              </div>
              <button 
                onClick={() => setSelectedNodeIds([])}
                className="p-2 hover:text-mc-orange"
                title="Clear Selection"
              >
                <X size={16} />
              </button>
              <button 
                onClick={() => {
                  if (selectedNodeIds.length === 1) {
                    const node = activeBrain?.nodes.find(n => n.id === selectedNodeIds[0]);
                    if (node?.type === 'board') {
                      const existingBrain = brains.find(b => b.name === node.content);
                      if (existingBrain) {
                        setActiveBrain(existingBrain.id);
                      } else {
                        addBrain(node.content);
                        const newBrain = brains.find(b => b.name === node.content);
                        if (newBrain) setActiveBrain(newBrain.id);
                      }
                      setSelectedNodeIds([]);
                    } else {
                      setIsConnecting(selectedNodeIds[0]);
                    }
                  }
                }}
                disabled={selectedNodeIds.length !== 1}
                className="p-2 hover:text-mc-orange disabled:opacity-30"
                title="Connect/Open"
              >
                <ArrowRight size={20} />
              </button>
              <button 
                onClick={() => {
                  selectedNodeIds.forEach(id => deleteNode(id));
                  setSelectedNodeIds([]);
                }}
                className="p-2 hover:text-red-500"
                title="Delete Selected"
              >
                <Trash2 size={20} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex gap-2">
          <button 
            onClick={() => handleAddNode('board')}
            className="mc-button"
            title="Add Sub-Board"
          >
            <BrainIcon size={20} />
          </button>
          <button 
            onClick={() => handleAddNode('image')}
            className="mc-button"
            title="Add Image"
          >
            <ImageIcon size={20} />
          </button>
          <button 
            onClick={() => handleAddNode('link')}
            className="mc-button"
            title="Add Link"
          >
            <ExternalLink size={20} />
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenTrash={() => setIsTrashOpen(true)}
      />

      {/* Modals */}
      <AnimatePresence>
        {editingNode && (
          <Modal title="Edit Note" onClose={() => setEditingNodeId(null)}>
            <div className="space-y-6 font-minecraft">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-mc-orange text-xl">Title</label>
                  <input 
                    className="w-full bg-black border-2 border-mc-gray p-2 font-minecraft text-white outline-none focus:border-mc-orange"
                    value={editingNode.title || ''}
                    onFocus={saveHistory}
                    onChange={(e) => updateNode(editingNode.id, { title: e.target.value }, true)}
                    placeholder="Note Title..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-mc-orange text-xl">Shape</label>
                  <select 
                    className="w-full bg-black border-2 border-mc-gray p-2 text-white"
                    value={editingNode.shape || 'square'}
                    onFocus={saveHistory}
                    onChange={(e) => updateNode(editingNode.id, { shape: e.target.value as any })}
                  >
                    <option value="square">Square</option>
                    <option value="circle">Circle</option>
                    <option value="rounded">Rounded</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-mc-orange text-xl flex justify-between items-center">
                  {editingNode.type === 'todo' ? 'General Notes' : 'Content'}
                  <button 
                    onClick={() => {
                      setIsConnecting(editingNode.id);
                      setEditingNodeId(null);
                    }}
                    className="text-white hover:text-mc-orange flex items-center gap-1 text-sm"
                  >
                    <div className="flex gap-0.5"><div className="w-1 h-1 bg-current rounded-full"/><div className="w-1 h-1 bg-current rounded-full"/><div className="w-1 h-1 bg-current rounded-full"/></div>
                    Connect
                  </button>
                </label>
                <textarea
                  autoFocus={False}
                  className="w-full bg-black border-2 border-mc-gray p-3 font-minecraft text-white outline-none focus:border-mc-orange min-h-[150px] resize-none"
                  value={editingNode.content}
                  onFocus={saveHistory}
                  onChange={(e) => updateNode(editingNode.id, { content: e.target.value }, true)}
                  placeholder={editingNode.type === 'todo' ? 'Add some notes about your list...' : 'Write something...'}
                />
              </div>

              {editingNode.type === 'todo' && (
                <div className="space-y-2">
                  <label className="text-mc-orange text-xl flex justify-between items-center">
                    To-Do List
                    <button 
                      onClick={() => {
                        const newTodo: TodoItem = { id: uuidv4(), text: '', completed: false };
                        updateNode(editingNode.id, { todoList: [...(editingNode.todoList || []), newTodo] });
                      }}
                      className="mc-button p-1 text-xs"
                    >
                      <Plus size={12} /> Add Item
                    </button>
                  </label>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                    {(editingNode.todoList || []).map((todo, idx) => (
                      <div key={todo.id} className="flex gap-2 items-center">
                        <input 
                          type="checkbox" 
                          checked={todo.completed}
                          onChange={(e) => {
                            const newList = [...(editingNode.todoList || [])];
                            newList[idx] = { ...todo, completed: e.target.checked };
                            updateNode(editingNode.id, { todoList: newList });
                          }}
                          className="w-5 h-5 accent-mc-orange"
                        />
                        <input 
                          type="text"
                          value={todo.text}
                          onChange={(e) => {
                            const newList = [...(editingNode.todoList || [])];
                            newList[idx] = { ...todo, text: e.target.value };
                            updateNode(editingNode.id, { todoList: newList });
                          }}
                          className="flex-1 bg-black border border-mc-gray p-1 text-sm text-white outline-none focus:border-mc-orange"
                          placeholder="What needs to be done?"
                        />
                        <button 
                          onClick={() => {
                            const newList = (editingNode.todoList || []).filter(t => t.id !== todo.id);
                            updateNode(editingNode.id, { todoList: newList });
                          }}
                          className="text-red-500 hover:text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {(editingNode.todoList || []).length === 0 && (
                      <p className="text-xs opacity-50 text-center py-4">No items yet. Add one above!</p>
                    )}
                  </div>
                </div>
              )}

              {editingNode.type === 'tracker' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <label className="text-mc-orange text-xl">Habit Tracking</label>
                    <button 
                      onClick={() => {
                        const newHabit: Habit = { id: uuidv4(), name: '', entries: {} };
                        updateNode(editingNode.id, { habits: [...(editingNode.habits || []), newHabit] });
                      }}
                      className="mc-button p-2 text-xs flex items-center gap-2"
                    >
                      <Plus size={14} /> Add New Habit
                    </button>
                  </div>

                  <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {(editingNode.habits || []).map((habit, hIdx) => (
                      <div key={habit.id} className="space-y-2">
                        <div className="flex gap-2 items-center">
                          <input 
                            type="text"
                            value={habit.name}
                            onChange={(e) => {
                              const newHabits = [...(editingNode.habits || [])];
                              newHabits[hIdx] = { ...habit, name: e.target.value };
                              updateNode(editingNode.id, { habits: newHabits });
                            }}
                            className="flex-1 bg-black border-2 border-mc-gray p-2 text-sm text-white outline-none focus:border-mc-orange font-minecraft"
                            placeholder="Habit name (e.g., Exercise, Read, Meditate)"
                          />
                        </div>
                        
                        <HabitCalendar 
                          habit={habit}
                          onSetDayStatus={(date, completed) => {
                            const newHabits = [...(editingNode.habits || [])];
                            const entries = { ...(habit.entries || {}) };
                            const entry = entries[date] || { completed: false };
                            entries[date] = { ...entry, completed };
                            newHabits[hIdx] = { ...habit, entries };
                            updateNode(editingNode.id, { habits: newHabits });
                          }}
                          onUpdateFeedback={(date, feedback) => {
                            const newHabits = [...(editingNode.habits || [])];
                            const entries = { ...(habit.entries || {}) };
                            const entry = entries[date] || { completed: false };
                            entries[date] = { ...entry, feedback };
                            newHabits[hIdx] = { ...habit, entries };
                            updateNode(editingNode.id, { habits: newHabits });
                          }}
                          onDeleteHabit={() => {
                            const newHabits = (editingNode.habits || []).filter(h => h.id !== habit.id);
                            updateNode(editingNode.id, { habits: newHabits });
                          }}
                        />
                      </div>
                    ))}
                    {(editingNode.habits || []).length === 0 && (
                      <div className="text-center py-10 opacity-50 border-2 border-dashed border-mc-gray">
                        <p className="font-minecraft">No habits added yet.</p>
                        <p className="text-[10px] mt-1">Click "Add New Habit" to start tracking!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-mc-orange text-xl">Width</label>
                  <input 
                    type="range" min="100" max="500" step="10"
                    className="w-full accent-mc-orange"
                    value={editingNode.width || 200}
                    onFocus={saveHistory}
                    onChange={(e) => updateNode(editingNode.id, { width: parseInt(e.target.value) }, true)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-mc-orange text-xl">Height</label>
                  <input 
                    type="range" min="100" max="500" step="10"
                    className="w-full accent-mc-orange"
                    value={editingNode.height || 200}
                    onFocus={saveHistory}
                    onChange={(e) => updateNode(editingNode.id, { height: parseInt(e.target.value) }, true)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-mc-orange text-xl flex items-center gap-2">
                    <Target size={20} /> Priority
                  </label>
                  <select 
                    className="w-full bg-black border-2 border-mc-gray p-2 text-white"
                    value={editingNode.priority}
                    onFocus={saveHistory}
                    onChange={(e) => updateNode(editingNode.id, { priority: e.target.value as Priority })}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-mc-orange text-xl flex items-center gap-2">
                    <Clock size={20} /> Deadline
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="datetime-local"
                      className="flex-1 bg-black border-2 border-mc-gray p-2 text-white font-minecraft outline-none focus:border-mc-orange"
                      value={editingNode.deadline ? editingNode.deadline.slice(0, 16) : ''}
                      onFocus={saveHistory}
                      onChange={(e) => updateNode(editingNode.id, { deadline: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-mc-orange text-xl">Color</label>
                <div className="flex gap-2 flex-wrap items-center">
                    {['#ff9800', '#f44336', '#2196f3', '#4caf50', '#9c27b0', '#ffffff'].map(c => (
                      <button
                        key={c}
                        onClick={() => {
                          saveHistory();
                          updateNode(editingNode.id, { color: c });
                        }}
                        className={cn(
                          "w-10 h-10 border-2 border-black transition-transform hover:scale-110",
                          editingNode.color === c ? "ring-2 ring-white scale-110" : ""
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  <div className="relative w-10 h-10">
                    <input 
                      type="color" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      value={editingNode.color || '#ff9800'}
                      onFocus={saveHistory}
                      onChange={(e) => updateNode(editingNode.id, { color: e.target.value }, true)}
                    />
                    <div 
                      className="w-full h-full border-2 border-black flex items-center justify-center bg-mc-gray"
                      style={{ backgroundColor: editingNode.color }}
                    >
                      <Plus size={16} className="text-white mix-blend-difference" />
                    </div>
                  </div>
                </div>
              </div>

              {editingNode.type === 'link' && (
                <div className="space-y-2">
                  <label className="text-mc-orange text-xl">Target URL</label>
                  <input 
                    className="w-full bg-black border-2 border-mc-gray p-2 font-minecraft text-white outline-none focus:border-mc-orange"
                    value={editingNode.targetUrl || ''}
                    onChange={(e) => updateNode(editingNode.id, { targetUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              )}

              {editingNode.type === 'image' && (
                <div className="space-y-2">
                  <label className="text-mc-orange text-xl">Image URL</label>
                  <input 
                    className="w-full bg-black border-2 border-mc-gray p-2 font-minecraft text-white outline-none focus:border-mc-orange"
                    value={editingNode.imageUrl || ''}
                    onChange={(e) => updateNode(editingNode.id, { imageUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="pt-4 border-t-2 border-black flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => {
                      deleteNode(editingNode.id);
                      setEditingNodeId(null);
                    }}
                    className="flex items-center gap-2 text-red-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} /> Delete Note
                  </button>
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  {isConnecting && isConnecting !== editingNode.id && (
                    <button 
                      onClick={() => {
                        const fromNode = activeBrain?.nodes.find(n => n.id === isConnecting);
                        addConnection(isConnecting, editingNode.id, fromNode?.color);
                        setIsConnecting(null);
                        setEditingNodeId(null);
                      }}
                      className="mc-button-orange flex-1 sm:flex-none"
                    >
                      Connect Here
                    </button>
                  )}
                  <button onClick={() => setEditingNodeId(null)} className="mc-button flex-1 sm:flex-none">Done</button>
                </div>
              </div>
            </div>
          </Modal>
        )}
        {isSettingsOpen && (
          <Modal title="Settings" onClose={handleCloseSettings}>
            <div className="space-y-6 font-minecraft">
              <section className="space-y-2">
                <h3 className="text-mc-orange text-xl">Personal Preferences</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm opacity-70 flex justify-between items-center">
                      Font Size 
                      <div className="flex items-center gap-1">
                        <input 
                          type="number" 
                          value={pendingFontSize}
                          onChange={(e) => setPendingFontSize(parseInt(e.target.value) || 12)}
                          className="w-12 bg-black border border-mc-gray text-center text-xs p-0.5"
                          min="12"
                          max="48"
                        />
                        <span>px</span>
                      </div>
                    </label>
                    <input 
                      type="range" min="12" max="48" 
                      value={pendingFontSize}
                      onChange={(e) => setPendingFontSize(parseInt(e.target.value))}
                      className="w-full accent-mc-orange"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm opacity-70">Theme</label>
                    <select 
                      className="w-full bg-black border-2 border-mc-gray p-1"
                      value={settings.theme}
                      onChange={(e) => updateSettings({ theme: e.target.value as any })}
                    >
                      <option value="minecraft">Minecraft</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-mc-orange text-xl">Feedback</h3>
                <p className="text-sm opacity-70">Help us improve BlockBrain!</p>
                <button onClick={handleFeedback} className="mc-button-orange w-full flex items-center justify-center gap-2">
                  <Mail size={20} /> Send Feedback
                </button>
              </section>

              <div className="flex justify-end pt-4 border-t-2 border-black">
                <button onClick={handleCloseSettings} className="mc-button-orange">Done</button>
              </div>
            </div>
          </Modal>
        )}

        {isGuideOpen && (
          <Modal title="The Guide" onClose={() => setIsGuideOpen(false)}>
            <div className="space-y-4 font-minecraft text-lg">
              <div className="mc-panel bg-black/30 border-mc-orange">
                <h3 className="text-mc-orange mb-1">1. Focus on less to do more</h3>
                <p className="text-sm opacity-80">Complexity is the enemy of execution. Strip away the non-essential.</p>
              </div>
              <div className="mc-panel bg-black/30 border-mc-orange">
                <h3 className="text-mc-orange mb-1">2. Go all in one thing at a time</h3>
                <p className="text-sm opacity-80">Multitasking is a myth. Give your full obsession to your current node.</p>
              </div>
              <div className="mc-panel bg-black/30 border-mc-orange">
                <h3 className="text-mc-orange mb-1">3. Default to action</h3>
                <p className="text-sm opacity-80">Planning is useful, but action is transformative. Create systems that force you to move.</p>
              </div>
              <div className="mc-panel bg-black/30 border-mc-orange">
                <h3 className="text-mc-orange mb-1">4. Proof Of Work</h3>
                <p className="text-sm opacity-80">Maintain a brain named "Proof Of Work" to track what you DID, not what you want to do.</p>
              </div>
              <div className="mc-panel bg-black/30 border-mc-orange">
                <h3 className="text-mc-orange mb-1">5. Your 'Why'</h3>
                <p className="text-sm opacity-80">Inspired by 'Purpose Driven Life'. Keep your core vision visible at all times.</p>
              </div>
              <p className="text-xs italic text-center opacity-60 mt-4">
                "Don't lose momentum. Write your next action step before you sleep."
              </p>
            </div>
          </Modal>
        )}

        {isTrashOpen && (
          <Modal title="Trash Bin" onClose={() => setIsTrashOpen(false)}>
            <div className="space-y-4 font-minecraft">
              <p className="text-xs text-red-400 italic">Items are permanently deleted after 14 days.</p>
              <div className="space-y-2">
                {brains.filter(b => b.isDeleted).map(brain => (
                  <div key={brain.id} className="mc-panel flex items-center justify-between bg-black/20">
                    <div>
                      <p className="text-lg">{brain.name}</p>
                      <p className="text-[10px] opacity-50">Deleted: {format(new Date(brain.deletedAt!), 'MMM dd, HH:mm')}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => restoreBrain(brain.id)}
                        className="p-2 hover:text-mc-orange"
                        title="Restore"
                      >
                        <Undo2 size={20} />
                      </button>
                      <button 
                        onClick={() => permanentlyDeleteBrain(brain.id)}
                        className="p-2 hover:text-red-500"
                        title="Delete Permanently"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
                {brains.filter(b => b.isDeleted).length === 0 && (
                  <p className="text-center opacity-50 py-8">Trash is empty.</p>
                )}
              </div>
            </div>
          </Modal>
        )}

        {deletingConnectionId && (
          <Modal title="Unconnect?" onClose={() => setDeletingConnectionId(null)}>
            <div className="space-y-6 text-center">
              <p className="font-minecraft text-xl">Are you sure you want to remove this connection?</p>
              <div className="flex gap-4 justify-center">
                <button 
                  onClick={() => setDeletingConnectionId(null)}
                  className="mc-button flex-1"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    deleteConnection(deletingConnectionId);
                    setDeletingConnectionId(null);
                  }}
                  className="mc-button-orange flex-1 bg-red-600 border-red-800 hover:bg-red-500"
                >
                  Unconnect
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

const Modal = ({ title, children, onClose }: { title: string, children: React.ReactNode, onClose: () => void }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/80" 
      onClick={onClose} 
    />
    <motion.div 
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      className="mc-panel w-full sm:max-w-lg relative z-10 max-h-[90vh] overflow-y-auto m-2 sm:m-0"
    >
      <div className="flex justify-between items-center mb-6 border-b-2 border-black pb-2">
        <h2 className="font-minecraft text-xl sm:text-3xl text-mc-orange uppercase">{title}</h2>
        <button onClick={onClose} className="hover:text-mc-orange">
          <X size={24} />
        </button>
      </div>
      {children}
    </motion.div>
  </div>
);
