
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  Settings, 
  Download, 
  Plus, 
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  LayoutDashboard,
  HelpCircle,
  Lock,
  Unlock,
  Printer,
  Filter,
  UserPlus,
  GripVertical,
  Clock,
  Sun,
  MapPin
} from 'lucide-react';
import { Activity, ClassGroup, Student, AppState, TimeSlot } from './types';
import { ActivityCard } from './components/ActivityCard';
import { generatePDF, generateOverviewPDF } from './components/PdfExport';

// --- Helpers ---
const parseCSV = (
  text: string, 
  existingClasses: ClassGroup[], 
  forcedClassId?: string
): Student[] => {
  const lines = text.split(/\r?\n/);
  const students: Student[] = [];
  
  lines.forEach((line) => {
    if (!line.trim()) return;
    
    const parts = line.split(/[,;]/).map(p => p.trim());
    
    let name = '';
    let className = '';
    let classLetter = '';
    let priorities: number[] = [];
    let isMorningOnly = false;

    // Helper to check for trailing X
    const checkAndRemoveMorningFlag = (arr: string[]) => {
        if (arr.length > 0 && arr[arr.length - 1].toUpperCase() === 'X') {
            isMorningOnly = true;
            return arr.slice(0, -1);
        }
        return arr;
    };

    // Mode 1: Single Class Import (forcedClassId is present)
    // Format: Name, Prio1, Prio2..., [X]
    if (forcedClassId) {
        const matchedClass = existingClasses.find(c => c.id === forcedClassId);
        if (!matchedClass) return;

        name = parts[0];
        classLetter = matchedClass.letter;
        className = matchedClass.name;
        
        let prioParts = parts.slice(1);
        prioParts = checkAndRemoveMorningFlag(prioParts);
        
        priorities = prioParts
          .map(p => parseInt(p, 10))
          .filter(p => !isNaN(p));

    } else {
        // Mode 2: Bulk Import
        // Format: Name, ClassLetter, Prio1, Prio2..., [X]
        if (parts.length < 3) return; 

        name = parts[0];
        const letterInput = parts[1].toUpperCase();
        
        const matchedClass = existingClasses.find(c => c.letter === letterInput);
        if (matchedClass) {
            className = matchedClass.name;
            classLetter = matchedClass.letter;
        } else {
            className = `${letterInput} (Unbekannt)`;
            classLetter = letterInput;
        }

        let prioParts = parts.slice(2);
        prioParts = checkAndRemoveMorningFlag(prioParts);

        priorities = prioParts
          .map(p => parseInt(p, 10))
          .filter(p => !isNaN(p));
    }

    if (name) {
      students.push({
        id: crypto.randomUUID(),
        name,
        className,
        classLetter,
        priorities,
        assignedActivityIds: [],
        isMorningOnly,
        isLocked: false
      });
    }
  });

  return students;
};

export default function App() {
  // --- Auth State ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- App State ---
  const [currentTab, setCurrentTab] = useState<AppState>(AppState.SETUP);
  
  // Data
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Settings
  const [assignmentsPerStudent, setAssignmentsPerStudent] = useState<number>(1);
  
  // Forms & Inputs
  const [newClassInput, setNewClassInput] = useState('');
  
  // Import State
  const [importMode, setImportMode] = useState<'bulk' | 'single'>('single');
  const [selectedClassIdForImport, setSelectedClassIdForImport] = useState<string>('');
  const [studentCsvInput, setStudentCsvInput] = useState('');
  
  // Allocation State
  const [activeClassLetters, setActiveClassLetters] = useState<string[]>([]);
  
  // Drag and Drop State
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (activeClassLetters.length === 0 && classes.length > 0) {
      setActiveClassLetters(classes.map(c => c.letter));
    }
  }, [classes.length]);

  // Manual Activity Form
  const [manualActivity, setManualActivity] = useState({
    name: '', leader: '', max: 20, desc: '', location: '', timeSlot: 'G' as TimeSlot
  });

  // --- Handlers: Login ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'Glarus' || passwordInput === 'Ncc1701e') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Falsches Passwort. Zugriff verweigert.');
    }
  };

  // --- Handlers: Classes ---
  const getNextClassLetter = (currentClasses: ClassGroup[]) => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const existingLetters = new Set(currentClasses.map(c => c.letter));
    
    for (const char of alphabet) {
      if (!existingLetters.has(char)) {
        return char;
      }
    }
    return "?";
  };

  const addClass = () => {
    if (!newClassInput.trim()) return;
    
    const letter = getNextClassLetter(classes);
    const newClass = { 
      id: crypto.randomUUID(), 
      name: newClassInput.trim(),
      letter: letter
    };

    setClasses([...classes, newClass]);
    setActiveClassLetters(prev => [...prev, letter]);
    setNewClassInput('');
    
    if (!selectedClassIdForImport) {
        setSelectedClassIdForImport(newClass.id);
    }
  };
  
  const removeClass = (id: string) => {
    const cls = classes.find(c => c.id === id);
    if (cls) {
        setActiveClassLetters(prev => prev.filter(l => l !== cls.letter));
    }
    setClasses(classes.filter(c => c.id !== id));
  };

  // --- Handlers: Activities ---
  const addManualActivity = () => {
    if (!manualActivity.name || !manualActivity.leader) return;
    
    // Check if activity with same name/leader exists to reuse Public ID
    const existingMatch = activities.find(
        a => a.name.toLowerCase() === manualActivity.name.toLowerCase() && 
             a.leader.toLowerCase() === manualActivity.leader.toLowerCase()
    );

    let publicId: number;
    if (existingMatch) {
        publicId = existingMatch.publicId;
    } else {
        // Find max public ID
        const maxId = activities.length > 0 ? Math.max(...activities.map(a => a.publicId)) : 0;
        publicId = maxId + 1;
    }

    setActivities([...activities, {
      id: crypto.randomUUID(),
      publicId,
      name: manualActivity.name,
      leader: manualActivity.leader,
      maxParticipants: manualActivity.max,
      description: manualActivity.desc,
      location: manualActivity.location,
      timeSlot: manualActivity.timeSlot
    }]);
    
    // Keep common fields, reset optional
    setManualActivity({ ...manualActivity, desc: '', location: '' });
  };

  const deleteActivity = (id: string) => {
    setActivities(activities.filter(a => a.id !== id));
    // Remove assignment from students
    setStudents(prev => prev.map(s => ({
        ...s,
        assignedActivityIds: s.assignedActivityIds.filter(aid => aid !== id)
    })));
  };

  // --- Handlers: Students ---
  const handleImportStudents = () => {
    if (classes.length === 0) {
      alert("Bitte erstellen Sie zuerst Klassen im 'Setup' Bereich.");
      return;
    }

    if (importMode === 'single' && !selectedClassIdForImport) {
      alert("Bitte wählen Sie eine Klasse aus.");
      return;
    }

    const forcedClass = importMode === 'single' ? selectedClassIdForImport : undefined;
    const parsed = parseCSV(studentCsvInput, classes, forcedClass);
    
    if (parsed.length === 0) {
      alert("Keine gültigen Schülerdaten gefunden. Bitte Format prüfen.");
      return;
    }

    setStudents(prev => [...prev, ...parsed]);
    setStudentCsvInput('');
    alert(`${parsed.length} Schüler erfolgreich hinzugefügt!`);
  };

  const clearAllStudents = () => {
    if (confirm("Möchten Sie wirklich alle Schülerdaten löschen?")) {
      setStudents([]);
    }
  };

  const toggleStudentLock = (studentId: string) => {
    setStudents(prev => prev.map(s => 
        s.id === studentId ? { ...s, isLocked: !s.isLocked } : s
    ));
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, studentId: string) => {
    e.dataTransfer.setData('studentId', studentId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedStudentId(studentId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Dropping into an Activity
  const handleDropOnActivity = (e: React.DragEvent, targetActivityId: string) => {
    e.preventDefault();
    const studentId = e.dataTransfer.getData('studentId');
    const targetActivity = activities.find(a => a.id === targetActivityId);
    
    if (studentId && targetActivity) {
      setStudents(prev => prev.map(s => {
        if (s.id !== studentId) return s;

        // Constraint check: Morning Only vs Activity Time
        if (s.isMorningOnly && targetActivity.timeSlot !== 'V') {
            alert(`Dieser Schüler ist nur vormittags anwesend und kann nicht zu '${targetActivity.timeSlot === 'G' ? 'Ganztags' : 'Nachmittag'}' zugeteilt werden.`);
            return s;
        }

        // Avoid duplicates
        if (s.assignedActivityIds.includes(targetActivityId)) return s;

        // If trying to add assignment to a locked student via drag, we assume manual override is desired.
        // We do NOT toggle lock here, but we allow the move.

        return { 
            ...s, 
            assignedActivityIds: [...s.assignedActivityIds, targetActivityId] 
        };
      }));
    }
    setDraggedStudentId(null);
  };

  const handleDropOnUnassigned = (e: React.DragEvent) => {
    e.preventDefault();
    const studentId = e.dataTransfer.getData('studentId');
    if (studentId) {
        if (confirm("Alle Zuteilungen für diesen Schüler entfernen?")) {
            setStudents(prev => prev.map(s => 
                s.id === studentId ? { ...s, assignedActivityIds: [] } : s
            ));
        }
    }
    setDraggedStudentId(null);
  };
  
  const removeAssignment = (studentId: string, activityId: string) => {
      setStudents(prev => prev.map(s => 
        s.id === studentId 
            ? { ...s, assignedActivityIds: s.assignedActivityIds.filter(id => id !== activityId) }
            : s
      ));
  };

  // --- Algorithm: Allocation ---
  const runAllocation = () => {
    if (activities.length === 0) {
        alert("Bitte erstellen Sie zuerst Aktivitäten.");
        return;
    }

    if (activeClassLetters.length === 0) {
        alert("Bitte wählen Sie Klassen in der Misch-Konfiguration aus.");
        return;
    }

    // 1. Separate Active (Selected Classes) vs Inactive (Unselected)
    const activeStudents = students.filter(s => activeClassLetters.includes(s.classLetter));
    const inactiveStudents = students.filter(s => !activeClassLetters.includes(s.classLetter));

    if (activeStudents.length === 0) {
        alert("Keine Schüler in den ausgewählten Klassen.");
        return;
    }

    // 2. Identify Locked vs Unlocked within Active
    const lockedActiveStudents = activeStudents.filter(s => s.isLocked);
    const unlockedActiveStudents = activeStudents.filter(s => !s.isLocked);

    // 3. Initialize counts based on INACTIVE students AND LOCKED Active students
    // These slots are already "taken" and cannot be used by the algorithm
    const activityCounts: Record<string, number> = {};
    activities.forEach(a => activityCounts[a.id] = 0);
    
    // Count assignments from inactive students
    inactiveStudents.forEach(s => {
        s.assignedActivityIds.forEach(aid => {
            if (activityCounts[aid] !== undefined) {
                activityCounts[aid]++;
            }
        });
    });

    // Count assignments from locked active students
    lockedActiveStudents.forEach(s => {
        s.assignedActivityIds.forEach(aid => {
            if (activityCounts[aid] !== undefined) {
                activityCounts[aid]++;
            }
        });
    });

    // 4. Reset assignments for UNLOCKED active students only
    let workingStudents = unlockedActiveStudents.map(s => ({ ...s, assignedActivityIds: [] as string[] }));

    // 5. SORTING STRATEGY
    // CRITICAL: Morning-only students must be processed FIRST to ensure they get Vormittag slots.
    workingStudents.sort((a, b) => {
        if (a.isMorningOnly && !b.isMorningOnly) return -1;
        if (!a.isMorningOnly && b.isMorningOnly) return 1;
        return 0; 
    });

    // 6. Loop for Number of Assignments needed
    for (let round = 1; round <= assignmentsPerStudent; round++) {
        
        // Fisher-Yates shuffle
        for (let i = workingStudents.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [workingStudents[i], workingStudents[j]] = [workingStudents[j], workingStudents[i]];
        }
        // Re-apply sort priority: Morning Only First
        workingStudents.sort((a, b) => (a.isMorningOnly === b.isMorningOnly) ? 0 : a.isMorningOnly ? -1 : 1);

        // Iterate students to find a slot
        workingStudents.forEach(student => {
            // Skip if student already has enough assignments
            if (student.assignedActivityIds.length >= assignmentsPerStudent) return;

            // Iterate priorities (These are Public IDs)
            for (const wantedPublicId of student.priorities) {
                // Find all instances of this activity (e.g. Vormittag and Nachmittag versions)
                const potentialActivities = activities.filter(a => a.publicId === wantedPublicId);

                // Check if already assigned to ANY instance of this public ID
                const alreadyHasThisPublicId = potentialActivities.some(a => student.assignedActivityIds.includes(a.id));
                if (alreadyHasThisPublicId) continue;

                // Find a valid instance
                const validInstances = potentialActivities.filter(activity => {
                    // Constraint: Morning Only
                    if (student.isMorningOnly && activity.timeSlot !== 'V') return false;
                    
                    // Constraint: Capacity
                    if (activityCounts[activity.id] >= activity.maxParticipants) return false;

                    return true;
                });

                if (validInstances.length > 0) {
                    const chosenActivity = validInstances[0]; // Simple pick first available
                    student.assignedActivityIds.push(chosenActivity.id);
                    activityCounts[chosenActivity.id]++;
                    break; // Move to next student after assignment in this round
                }
            }
        });
    }

    // 7. Merge results: Inactive + Locked Active + Newly Assigned Active
    const allStudents = [...inactiveStudents, ...lockedActiveStudents, ...workingStudents];
    allStudents.sort((a, b) => a.name.localeCompare(b.name));
    setStudents(allStudents);
  };

  // --- Render Helpers ---
  const getStats = () => {
    const total = students.length;
    const fullyAssigned = students.filter(s => s.assignedActivityIds.length >= assignmentsPerStudent).length;
    const partiallyAssigned = students.filter(s => s.assignedActivityIds.length > 0 && s.assignedActivityIds.length < assignmentsPerStudent).length;
    const unassigned = students.filter(s => s.assignedActivityIds.length === 0).length;
    return { total, fullyAssigned, partiallyAssigned, unassigned };
  };

  // --- LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <Lock className="text-blue-600" size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">SchulAktiv Login</h1>
            <p className="text-slate-500 mt-2 text-center">Bitte authentifizieren Sie sich.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Passwort eingeben..."
              autoFocus
            />
            {loginError && <div className="text-red-600 text-sm text-center">{loginError}</div>}
            <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800">Anmelden</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col no-print">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <LayoutDashboard className="text-blue-400" />
            SchulAktiv
          </h1>
          <p className="text-xs text-slate-400 mt-1">Verwaltung & Zuteilung</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setCurrentTab(AppState.SETUP)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentTab === AppState.SETUP ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
            <Settings size={20} /> <span>Setup & Klassen</span>
          </button>
          <button onClick={() => setCurrentTab(AppState.IMPORT)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentTab === AppState.IMPORT ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
            <Users size={20} /> <span>SuS Importieren</span>
          </button>
          <button onClick={() => setCurrentTab(AppState.ASSIGNMENT)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentTab === AppState.ASSIGNMENT ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
            <Calendar size={20} /> <span>Zuteilung & Export</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-10">
        
        {/* VIEW: SETUP */}
        {currentTab === AppState.SETUP && (
          <div className="space-y-8 max-w-6xl mx-auto animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
               <div>
                 <h2 className="text-lg font-bold text-slate-800">System-Einstellungen</h2>
                 <p className="text-sm text-slate-500">Globale Konfigurationen.</p>
               </div>
               <button onClick={() => generateOverviewPDF(classes, activities)} className="mt-3 md:mt-0 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2 shadow-sm text-sm font-medium">
                 <Printer size={18} className="text-slate-500" /> Referenzlisten
               </button>
            </div>

            {/* Global Settings */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Settings size={18} className="text-blue-600"/> Globale Parameter</h3>
                <div className="flex items-center gap-4">
                    <label className="text-sm font-medium text-slate-700">Anzahl Kurse pro Kind:</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="range" 
                            min="1" 
                            max="5" 
                            value={assignmentsPerStudent} 
                            onChange={(e) => setAssignmentsPerStudent(parseInt(e.target.value))}
                            className="w-32 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-md">{assignmentsPerStudent}</span>
                    </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">Bestimmt, an wie vielen unterschiedlichen Aktivitäten ein Schüler teilnehmen soll.</p>
            </div>

            {/* Classes Section */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="text-blue-600" /> Klassen verwalten
              </h2>
              <div className="flex gap-4 mb-4">
                <input 
                  type="text" 
                  value={newClassInput}
                  onChange={(e) => setNewClassInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addClass()}
                  placeholder="Neue Klasse (z.B. '4. Klasse')"
                  className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button onClick={addClass} className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 flex items-center gap-2">
                  <Plus size={18} /> Hinzufügen
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {classes.map(c => (
                    <div key={c.id} className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex justify-between items-center group">
                      <div className="flex items-center gap-3">
                        <span className="bg-blue-600 text-white font-bold w-10 h-10 flex items-center justify-center rounded-lg">{c.letter}</span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700">{c.name}</span>
                        </div>
                      </div>
                      <button onClick={() => removeClass(c.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2"><Trash2 size={18} /></button>
                    </div>
                  ))}
              </div>
            </section>

            {/* Activities Section */}
            <section className="space-y-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="text-blue-600" /> Aktivitäten ({activities.length})
              </h2>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-4">Neue Aktivität</h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-3">
                    <input placeholder="Name (Gleicher Name=gleiche ID)" className="w-full border rounded p-2 text-sm" value={manualActivity.name} onChange={e => setManualActivity({...manualActivity, name: e.target.value})} />
                  </div>
                  <div className="md:col-span-3">
                    <input placeholder="Leitung" className="w-full border rounded p-2 text-sm" value={manualActivity.leader} onChange={e => setManualActivity({...manualActivity, leader: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <input type="number" placeholder="Max" className="w-full border rounded p-2 text-sm" value={manualActivity.max} onChange={e => setManualActivity({...manualActivity, max: parseInt(e.target.value) || 0})} />
                  </div>
                   <div className="md:col-span-2">
                    <input placeholder="Ort (Optional)" className="w-full border rounded p-2 text-sm" value={manualActivity.location} onChange={e => setManualActivity({...manualActivity, location: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <select 
                        className="w-full border rounded p-2 text-sm bg-white"
                        value={manualActivity.timeSlot}
                        onChange={e => setManualActivity({...manualActivity, timeSlot: e.target.value as TimeSlot})}
                    >
                        <option value="G">Ganztags (G)</option>
                        <option value="V">Vormittag (V)</option>
                        <option value="N">Nachmittag (N)</option>
                    </select>
                  </div>
                  <div className="md:col-span-10">
                     <input placeholder="Beschreibung" className="w-full border rounded p-2 text-sm" value={manualActivity.desc} onChange={e => setManualActivity({...manualActivity, desc: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <button onClick={addManualActivity} className="w-full bg-slate-800 text-white p-2 rounded hover:bg-slate-700 text-sm">Hinzufügen</button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activities.map(activity => (
                  <ActivityCard key={activity.id} activity={activity} onDelete={deleteActivity} />
                ))}
              </div>
            </section>
          </div>
        )}

        {/* VIEW: IMPORT */}
        {currentTab === AppState.IMPORT && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FileSpreadsheet className="text-blue-600" /> Schülerdaten importieren
              </h2>

              <div className="flex gap-4 mb-6">
                 <button onClick={() => setImportMode('single')} className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium ${importMode === 'single' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}>1. Einzelne Klasse</button>
                 <button onClick={() => setImportMode('bulk')} className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium ${importMode === 'bulk' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'}`}>2. Alle (CSV)</button>
              </div>

              {importMode === 'single' && (
                <div className="mb-4">
                    <select value={selectedClassIdForImport} onChange={(e) => setSelectedClassIdForImport(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none bg-white">
                        <option value="">-- Klasse wählen --</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name} ({c.letter})</option>)}
                    </select>
                </div>
              )}
              
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800 mb-4">
                  <p className="font-bold mb-1">Format (mit 'X' für nur Vormittag):</p>
                  <code className="bg-white px-2 py-1 rounded border border-blue-200 block mb-2 font-mono text-xs">
                    {importMode === 'single' ? "Name, KursNr1, KursNr2..., [X]" : "Name, Klasse(Bst), KursNr1, KursNr2..., [X]"}
                  </code>
                  <p className="text-xs">
                      Verwenden Sie die <strong>Kurs-Nummer (Nr.)</strong>, nicht die UUID. <br/>
                      Ein 'X' am Ende bedeutet: Kind ist nur am <strong>Vormittag</strong> anwesend. <br/>
                      Beispiel: <code>Anna, 5, 2, 1, X</code> (Anna will Kurs 5,2,1 und kann nur Vormittags)
                  </p>
              </div>

              <textarea
                className="w-full h-64 p-4 border border-slate-300 rounded-lg font-mono text-sm"
                placeholder={importMode === 'single' ? "Marco, 5, 2, 1\nAnna, 2, 1, 3, X" : "Marco, A, 5, 2, 1\nAnna, B, 5, 3, 1, X"}
                value={studentCsvInput}
                onChange={(e) => setStudentCsvInput(e.target.value)}
              />

              <div className="mt-4 flex justify-between items-center">
                <button onClick={clearAllStudents} className="text-red-400 hover:text-red-600 text-sm flex items-center gap-1"><Trash2 size={16} /> Liste leeren</button>
                <button onClick={handleImportStudents} className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"><UserPlus size={20} /> SuS hinzufügen</button>
              </div>
            </div>

            {students.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg mb-4">Schülerliste ({students.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="p-3">Name</th>
                        <th className="p-3">Klasse</th>
                        <th className="p-3">Verfügbarkeit</th>
                        <th className="p-3">Wünsche (Nr.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.slice(-10).reverse().map(s => (
                        <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3">{s.name}</td>
                          <td className="p-3">{s.className}</td>
                          <td className="p-3">
                              {s.isMorningOnly ? <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-bold flex w-fit items-center gap-1"><Sun size={12}/> Nur VM</span> : <span className="text-slate-400 text-xs">Immer</span>}
                          </td>
                          <td className="p-3"><span className="text-xs bg-slate-100 px-2 py-1 rounded">{s.priorities.join(', ')}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: ASSIGNMENT */}
        {currentTab === AppState.ASSIGNMENT && (
          <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle2 className="text-green-600" /> Zuteilung
                  </h2>
                  <p className="text-slate-500 mt-1">Ziel: {assignmentsPerStudent} Kurse pro Kind.</p>
                  <div className="flex gap-4 mt-2 text-xs">
                      <span className="text-green-600 font-bold">{getStats().fullyAssigned} Fertig</span>
                      <span className="text-orange-500 font-bold">{getStats().partiallyAssigned} Teilweise</span>
                      <span className="text-red-500 font-bold">{getStats().unassigned} Offen</span>
                  </div>
                </div>
                <button onClick={() => generatePDF(activities, students, assignmentsPerStudent)} className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 flex items-center gap-2">
                  <Download size={18} /> Exportieren
                </button>
             </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                 <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                    <Filter size={18} className="text-blue-600" />
                    <h3 className="font-bold text-slate-800">Misch-Konfiguration</h3>
                 </div>
                 <div className="flex flex-wrap gap-3 mb-4">
                    {classes.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setActiveClassLetters(prev => prev.includes(c.letter) ? prev.filter(l => l !== c.letter) : [...prev, c.letter])}
                            className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 ${activeClassLetters.includes(c.letter) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200'}`}
                        >
                            {activeClassLetters.includes(c.letter) && <CheckCircle2 size={14} />} {c.name}
                        </button>
                    ))}
                 </div>
                  <div className="flex items-center gap-4">
                      <button onClick={runAllocation} className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 font-bold shadow-sm transition-transform active:scale-95">
                        <RefreshCw size={18} /> Zuteilung starten
                      </button>
                      <p className="text-xs text-slate-500 max-w-sm">
                          Startet die Verteilung für die gewählten Klassen. Schüler mit dem <Lock size={10} className="inline"/> Symbol werden <strong>nicht</strong> verändert.
                      </p>
                  </div>
            </div>

             {/* Unassigned Drop Zone */}
             <div 
               onDragOver={handleDragOver}
               onDrop={handleDropOnUnassigned}
               className={`border-2 border-dashed rounded-lg p-4 transition-colors ${draggedStudentId ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}
             >
               <h4 className="font-bold text-red-800 flex items-center gap-2"><AlertCircle size={16}/> Nicht / Teilweise Zugeteilt</h4>
               <p className="text-xs text-red-600 mb-3">Schüler hierhin ziehen, um <strong>alle</strong> Zuteilungen zu löschen.</p>
               
               <div className="flex flex-wrap gap-2">
                 {students.filter(s => s.assignedActivityIds.length < assignmentsPerStudent).map(s => (
                   <div 
                       key={s.id}
                       draggable
                       onDragStart={(e) => handleDragStart(e, s.id)}
                       className={`border px-2 py-1 rounded text-sm shadow-sm flex items-center gap-2 cursor-move ${s.isLocked ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-white border-red-200 text-red-800 hover:bg-red-50'}`}
                   >
                       <GripVertical size={14} className="text-slate-300" />
                       <span className={s.isLocked ? "line-through decoration-slate-400" : ""}>{s.name} ({s.assignedActivityIds.length}/{assignmentsPerStudent})</span>
                       {s.isMorningOnly && <Sun size={12} className="text-yellow-600"/>}
                       <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleStudentLock(s.id); }} className="hover:bg-slate-200 rounded p-0.5">
                           {s.isLocked ? <Lock size={12} className="text-slate-600"/> : <Unlock size={12} className="text-slate-300"/>}
                       </button>
                   </div>
                 ))}
                 {students.every(s => s.assignedActivityIds.length >= assignmentsPerStudent) && <span className="text-xs text-slate-400">Alle Schüler vollständig verteilt.</span>}
               </div>
             </div>

             {/* Activity Grid */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activities.map(activity => {
                  const assignedHere = students.filter(s => s.assignedActivityIds.includes(activity.id));
                  const isFull = assignedHere.length >= activity.maxParticipants;
                  
                  return (
                    <div 
                        key={activity.id} 
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropOnActivity(e, activity.id)}
                        className={`bg-white rounded-xl border shadow-sm flex flex-col ${draggedStudentId ? 'ring-2 ring-blue-100 cursor-copy' : ''} ${isFull ? 'border-orange-200' : 'border-slate-200'}`}
                    >
                      <div className={`p-4 border-b ${isFull ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'} rounded-t-xl flex justify-between items-center`}>
                        <div>
                          <div className="flex items-center gap-2">
                              <span className="bg-slate-800 text-white text-xs px-2 py-0.5 rounded font-mono">Nr.{activity.publicId}</span>
                              <h3 className="font-bold text-slate-800">{activity.name}</h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                             <span className={`text-xs px-1.5 rounded border font-bold ${activity.timeSlot === 'G' ? 'bg-purple-100 text-purple-700 border-purple-200' : activity.timeSlot === 'V' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}>
                                  {activity.timeSlot === 'G' ? 'Ganztags' : activity.timeSlot === 'V' ? 'Vormittag' : 'Nachmittag'}
                              </span>
                             <span className="text-xs text-slate-500">{activity.leader}</span>
                             {activity.location && <span className="text-xs text-slate-400 flex items-center"><MapPin size={10} className="mr-0.5"/> {activity.location}</span>}
                          </div>
                        </div>
                        <span className={`text-sm font-bold ${isFull ? 'text-orange-600' : 'text-green-600'}`}>
                             {assignedHere.length} / {activity.maxParticipants}
                        </span>
                      </div>
                      <div className="p-0 max-h-64 overflow-y-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr>
                                <th className="p-2 pl-4 w-8"></th>
                                <th className="p-2 font-medium text-slate-500">Name</th>
                                <th className="p-2 text-right w-16"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {assignedHere.map(s => (
                                <tr 
                                    key={s.id} 
                                    className={`hover:bg-blue-50 group cursor-grab ${s.isLocked ? 'bg-slate-50' : ''}`}
                                    draggable={true} // Enabled dragging
                                    onDragStart={(e) => handleDragStart(e, s.id)}
                                >
                                  <td className="p-2 pl-4 text-slate-300"><GripVertical size={14} /></td>
                                  <td className="p-2 text-slate-700 font-medium flex items-center gap-2">
                                      {s.name}
                                      {s.isMorningOnly && (
                                        <span title="Nur Vormittag" className="flex items-center">
                                          <Sun size={12} className="text-yellow-500" />
                                        </span>
                                      )}
                                      {s.isLocked && <Lock size={12} className="text-slate-400" />}
                                  </td>
                                  <td className="p-2 text-right flex items-center justify-end gap-1">
                                      <button onClick={() => toggleStudentLock(s.id)} className="text-slate-300 hover:text-blue-500 p-1">
                                          {s.isLocked ? <Lock size={14} className="text-blue-500"/> : <Unlock size={14}/>}
                                      </button>
                                      {!s.isLocked && (
                                        <button onClick={() => removeAssignment(s.id, activity.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={14}/></button>
                                      )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
