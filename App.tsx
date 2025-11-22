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
  Printer,
  Filter,
  UserPlus,
  GripVertical
} from 'lucide-react';
import { Activity, ClassGroup, Student, AppState } from './types';
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

    // Mode 1: Single Class Import (forcedClassId is present)
    // Format: Name, Prio1, Prio2...
    if (forcedClassId) {
        const matchedClass = existingClasses.find(c => c.id === forcedClassId);
        if (!matchedClass) return;

        name = parts[0];
        classLetter = matchedClass.letter;
        className = matchedClass.name;
        
        // All remaining parts are priorities
        priorities = parts.slice(1)
          .map(p => parseInt(p, 10))
          .filter(p => !isNaN(p));

    } else {
        // Mode 2: Bulk Import
        // Format: Name, ClassLetter, Prio1, Prio2...
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

        priorities = parts.slice(2)
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
        assignedActivityId: null
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
  
  // Forms & Inputs
  const [newClassInput, setNewClassInput] = useState('');
  
  // Import State
  const [importMode, setImportMode] = useState<'bulk' | 'single'>('single');
  const [selectedClassIdForImport, setSelectedClassIdForImport] = useState<string>('');
  const [studentCsvInput, setStudentCsvInput] = useState('');
  
  // Allocation State
  // Initialize with all available class letters when classes change
  const [activeClassLetters, setActiveClassLetters] = useState<string[]>([]);
  
  // Drag and Drop State
  const [draggedStudentId, setDraggedStudentId] = useState<string | null>(null);

  useEffect(() => {
    // When classes update, ensure new classes are selected by default if the list was empty
    // or just keep user selection. To simplify: we default to selecting all on first load.
    if (activeClassLetters.length === 0 && classes.length > 0) {
      setActiveClassLetters(classes.map(c => c.letter));
    }
  }, [classes.length]);

  // Manual Activity Form
  const [manualActivity, setManualActivity] = useState({
    name: '', leader: '', max: 20, desc: ''
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
    // Add to active mixing list automatically
    setActiveClassLetters(prev => [...prev, letter]);
    
    setNewClassInput('');
    
    // If using single import and nothing selected, select this one
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
    const newId = activities.length > 0 ? Math.max(...activities.map(a => a.id)) + 1 : 1;
    setActivities([...activities, {
      id: newId,
      name: manualActivity.name,
      leader: manualActivity.leader,
      maxParticipants: manualActivity.max,
      description: manualActivity.desc
    }]);
    setManualActivity({ name: '', leader: '', max: 20, desc: '' });
  };

  const deleteActivity = (id: number) => {
    setActivities(activities.filter(a => a.id !== id));
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

    // Append logic: Add new students to existing list
    // Optionally: remove existing students from that class if re-importing?
    // For now, we just append. User can delete all if needed.
    setStudents(prev => [...prev, ...parsed]);
    setStudentCsvInput(''); // Clear input for next batch
    alert(`${parsed.length} Schüler erfolgreich hinzugefügt!`);
  };

  const clearAllStudents = () => {
    if (confirm("Möchten Sie wirklich alle Schülerdaten löschen?")) {
      setStudents([]);
    }
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, studentId: string) => {
    e.dataTransfer.setData('studentId', studentId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedStudentId(studentId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetActivityId: number | null) => {
    e.preventDefault();
    const studentId = e.dataTransfer.getData('studentId');
    
    if (studentId) {
      setStudents(prev => prev.map(s => 
        s.id === studentId ? { ...s, assignedActivityId: targetActivityId } : s
      ));
    }
    setDraggedStudentId(null);
  };

  // --- Algorithm: Allocation ---
  const runAllocation = () => {
    if (activities.length === 0) {
        alert("Bitte erstellen Sie zuerst Aktivitäten.");
        return;
    }

    if (activeClassLetters.length === 0) {
        alert("Bitte wählen Sie mindestens eine Klasse in der Misch-Konfiguration aus.");
        return;
    }

    // 1. Separate students into "Active" (to be processed) and "Inactive" (keep existing assignment)
    const activeStudents = students.filter(s => activeClassLetters.includes(s.classLetter));
    const inactiveStudents = students.filter(s => !activeClassLetters.includes(s.classLetter));

    if (activeStudents.length === 0) {
        alert("Keine Schüler in den ausgewählten Klassen gefunden.");
        return;
    }

    // 2. Initialize counts based on INACTIVE students who are already assigned
    // This respects capacity taken by classes not currently being mixed
    const activityCounts: Record<number, number> = {};
    activities.forEach(a => activityCounts[a.id] = 0);
    
    inactiveStudents.forEach(s => {
        if (s.assignedActivityId !== null) {
            if (activityCounts[s.assignedActivityId] !== undefined) {
                activityCounts[s.assignedActivityId]++;
            }
        }
    });

    // 3. Reset assignments for ACTIVE students only
    let workingStudents = activeStudents.map(s => ({ ...s, assignedActivityId: null }));

    // 4. Shuffle (Fisher-Yates)
    for (let i = workingStudents.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [workingStudents[i], workingStudents[j]] = [workingStudents[j], workingStudents[i]];
    }

    // 5. Iterate priorities
    const maxPrioDepth = Math.max(...workingStudents.map(s => s.priorities.length), 0);

    for (let pIndex = 0; pIndex < maxPrioDepth; pIndex++) {
      workingStudents.forEach(student => {
        if (student.assignedActivityId !== null) return;

        const wantedActivityId = student.priorities[pIndex];
        const activity = activities.find(a => a.id === wantedActivityId);
        
        if (!activity) return; 

        if (activityCounts[wantedActivityId] < activity.maxParticipants) {
          student.assignedActivityId = wantedActivityId;
          activityCounts[wantedActivityId]++;
        }
      });
    }

    // 6. Merge results
    // Combine the newly processed students with the untouched inactive students
    const allStudents = [...inactiveStudents, ...workingStudents];
    
    // Sort by Name for display
    allStudents.sort((a, b) => a.name.localeCompare(b.name));
    setStudents(allStudents);
  };

  // --- Render Helpers ---
  const getStats = () => {
    const total = students.length;
    const assigned = students.filter(s => s.assignedActivityId !== null).length;
    const unassigned = total - assigned;
    return { total, assigned, unassigned };
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
            <p className="text-slate-500 mt-2 text-center">Bitte authentifizieren Sie sich, um auf den Schul-Adminbereich zuzugreifen.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Passwort eingeben..."
                autoFocus
              />
            </div>
            
            {loginError && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg text-center font-medium border border-red-100 flex items-center justify-center gap-2">
                <AlertCircle size={16} />
                {loginError}
              </div>
            )}
            
            <button 
              type="submit"
              className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200 mt-2"
            >
              Anmelden
            </button>
          </form>
          
          <div className="mt-8 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} SchulAktiv Manager
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0 flex flex-col no-print">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <LayoutDashboard className="text-blue-400" />
            SchulAktiv
          </h1>
          <p className="text-xs text-slate-400 mt-1">Verwaltung & Zuteilung</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setCurrentTab(AppState.SETUP)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentTab === AppState.SETUP ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Settings size={20} />
            <span>Setup & Klassen</span>
          </button>

          <button 
            onClick={() => setCurrentTab(AppState.IMPORT)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentTab === AppState.IMPORT ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Users size={20} />
            <span>SuS Importieren</span>
          </button>

          <button 
            onClick={() => setCurrentTab(AppState.ASSIGNMENT)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${currentTab === AppState.ASSIGNMENT ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
          >
            <Calendar size={20} />
            <span>Zuteilung & Export</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
          v1.1.0 (DnD)
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-10">
        
        {/* VIEW: SETUP */}
        {currentTab === AppState.SETUP && (
          <div className="space-y-8 max-w-6xl mx-auto animate-fade-in">
            
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
               <div>
                 <h2 className="text-lg font-bold text-slate-800">System-Daten</h2>
                 <p className="text-sm text-slate-500">Verwalten Sie hier Klassen und Aktivitäten.</p>
               </div>
               <button 
                 onClick={() => generateOverviewPDF(classes, activities)}
                 className="mt-3 md:mt-0 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 flex items-center gap-2 shadow-sm text-sm font-medium"
                 title="Druckt eine Übersicht aller Klassen und Aktivitäten für die Lehrpersonen"
               >
                 <Printer size={18} className="text-slate-500" /> Referenzlisten drucken
               </button>
            </div>

            {/* Classes Section */}
            <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Users className="text-blue-600" /> Klassen verwalten
              </h2>
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-6 text-sm text-blue-800 flex items-start gap-3">
                 <HelpCircle className="flex-shrink-0 mt-0.5" size={18} />
                 <div>
                   <p>Erstellen Sie hier Ihre Schulklassen. Jede Klasse erhält automatisch einen <strong>Buchstaben (A, B, C...)</strong> für die interne Verwaltung.</p>
                 </div>
              </div>

              <div className="flex gap-4 mb-4">
                <input 
                  type="text" 
                  value={newClassInput}
                  onChange={(e) => setNewClassInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addClass()}
                  placeholder="Klassenbezeichnung (z.B. '3. Klasse Meier')"
                  className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button 
                  onClick={addClass}
                  className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 flex items-center gap-2"
                >
                  <Plus size={18} /> Hinzufügen
                </button>
              </div>
              
              <div className="space-y-2">
                {classes.length === 0 && <span className="text-slate-400 text-sm italic">Keine Klassen definiert.</span>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {classes.map(c => (
                    <div key={c.id} className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex justify-between items-center group hover:border-blue-300 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="bg-blue-600 text-white font-bold w-10 h-10 flex items-center justify-center rounded-lg shadow-sm text-lg">
                          {c.letter}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700">{c.name}</span>
                          <span className="text-xs text-slate-400">ID: {c.letter}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeClass(c.id)} 
                        className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2"
                        title="Klasse löschen"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Activities Section */}
            <section className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="text-blue-600" /> Aktivitäten ({activities.length})
                </h2>
              </div>

              {/* Manual Add */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-4">Neue Aktivität hinzufügen</h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4">
                    <input 
                      placeholder="Name der Aktivität" 
                      className="w-full border border-slate-300 rounded p-2 text-sm"
                      value={manualActivity.name}
                      onChange={e => setManualActivity({...manualActivity, name: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <input 
                      placeholder="Leitung" 
                      className="w-full border border-slate-300 rounded p-2 text-sm"
                      value={manualActivity.leader}
                      onChange={e => setManualActivity({...manualActivity, leader: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input 
                      type="number" 
                      placeholder="Max SuS" 
                      className="w-full border border-slate-300 rounded p-2 text-sm"
                      value={manualActivity.max}
                      onChange={e => setManualActivity({...manualActivity, max: parseInt(e.target.value) || 0})}
                    />
                  </div>
                   <div className="md:col-span-3">
                    <button 
                      onClick={addManualActivity}
                      className="w-full bg-slate-800 text-white p-2 rounded hover:bg-slate-700 text-sm"
                    >
                      Hinzufügen
                    </button>
                  </div>
                  <div className="md:col-span-12">
                     <input 
                      placeholder="Beschreibung (Optional)" 
                      className="w-full border border-slate-300 rounded p-2 text-sm"
                      value={manualActivity.desc}
                      onChange={e => setManualActivity({...manualActivity, desc: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* List */}
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

              {/* Import Mode Switch */}
              <div className="flex gap-4 mb-6">
                 <button 
                   onClick={() => setImportMode('single')}
                   className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${importMode === 'single' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                 >
                   1. Einzelne Klasse (Empfohlen)
                 </button>
                 <button 
                   onClick={() => setImportMode('bulk')}
                   className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${importMode === 'bulk' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                 >
                   2. Alle (CSV mit Klassenbuchstabe)
                 </button>
              </div>

              {importMode === 'single' ? (
                /* Single Class Mode */
                <div className="mb-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ziel-Klasse auswählen:</label>
                        <select 
                            value={selectedClassIdForImport}
                            onChange={(e) => setSelectedClassIdForImport(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        >
                            <option value="">-- Bitte Klasse wählen --</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name} ({c.letter})</option>
                            ))}
                        </select>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                        <p className="font-bold mb-1">Format:</p>
                        <code className="bg-white px-2 py-1 rounded border border-blue-200 block mb-2 font-mono text-xs md:text-sm">
                        Name, Prio1, Prio2, Prio3...
                        </code>
                        <p className="text-xs">Beispiel: <code>Marco, 5, 4, 3, 1</code></p>
                    </div>
                </div>
              ) : (
                /* Bulk Mode */
                 <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                    <p className="font-bold mb-1">Format:</p>
                    <code className="bg-white px-2 py-1 rounded border border-blue-200 block mb-2 font-mono text-xs md:text-sm">
                    Name, Klassen-Buchstabe, Prio1, Prio2...
                    </code>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {classes.map(c => (
                        <span key={c.id} className="bg-white border border-blue-200 px-2 py-1 rounded text-xs font-bold">
                            {c.letter}: {c.name}
                        </span>
                        ))}
                    </div>
                </div>
              )}

              <textarea
                className="w-full h-64 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                placeholder={importMode === 'single' ? "Marco, 5, 2, 1\nLisa, 2, 1, 3" : "Marco, A, 5, 2, 1\nTom, B, 5, 3, 1"}
                value={studentCsvInput}
                onChange={(e) => setStudentCsvInput(e.target.value)}
              />

              <div className="mt-4 flex justify-between items-center">
                <button 
                  onClick={clearAllStudents}
                  className="text-red-400 hover:text-red-600 text-sm flex items-center gap-1"
                >
                  <Trash2 size={16} /> Liste leeren
                </button>

                <button 
                  onClick={handleImportStudents}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 shadow-sm transition-transform active:scale-95"
                >
                  <UserPlus size={20} /> 
                  SuS zur Liste hinzufügen
                </button>
              </div>
            </div>

            {students.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg mb-4">Gesamtliste ({students.length} SuS)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-900 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Name</th>
                        <th className="p-3">Klasse</th>
                        <th className="p-3">Wünsche (IDs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.slice(-10).reverse().map(s => (
                        <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 animate-fade-in">
                          <td className="p-3">{s.name}</td>
                          <td className="p-3">{s.className}</td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              {s.priorities.map((p, idx) => (
                                <span key={idx} className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                                  {p}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs text-slate-400 mt-2 text-center">Zeigt die letzten 10 Importe. Alle Daten gespeichert.</p>
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
                    <CheckCircle2 className="text-green-600" /> Zuteilung & Ergebnis
                  </h2>
                  <p className="text-slate-500 mt-1">Status: {getStats().assigned} von {getStats().total} Schülern zugeteilt.</p>
                  <p className="text-xs text-blue-500 mt-1 flex items-center gap-1"><GripVertical size={12}/> Drag & Drop aktiviert</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => generatePDF(activities, students)}
                    disabled={getStats().assigned === 0}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                  >
                    <Download size={18} /> PDF Exportieren
                  </button>
                </div>
             </div>

            {/* CONFIGURATION SECTION */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                 <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                    <Filter size={18} className="text-blue-600" />
                    <h3 className="font-bold text-slate-800">Misch-Konfiguration</h3>
                 </div>
                 <p className="text-sm text-slate-500 mb-4">
                    Wählen Sie, welche Klassen bei diesem Durchlauf gemischt und zugeteilt werden sollen.
                    <br/>
                    <span className="text-xs text-slate-400">Hinweis: Bereits zugeteilte Schüler in <strong>nicht</strong> ausgewählten Klassen belegen weiterhin ihre Plätze.</span>
                 </p>
                 
                 <div className="flex flex-wrap gap-3 mb-4">
                    {classes.map(c => {
                        const isActive = activeClassLetters.includes(c.letter);
                        return (
                            <button
                                key={c.id}
                                onClick={() => {
                                    if (isActive) {
                                        setActiveClassLetters(prev => prev.filter(l => l !== c.letter));
                                    } else {
                                        setActiveClassLetters(prev => [...prev, c.letter]);
                                    }
                                }}
                                className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 transition-colors ${isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}
                            >
                                {isActive && <CheckCircle2 size={14} />}
                                {c.name}
                            </button>
                        );
                    })}
                    {classes.length === 0 && <span className="text-sm text-slate-400 italic">Keine Klassen vorhanden.</span>}
                 </div>

                  <button 
                    onClick={runAllocation}
                    className="w-full md:w-auto bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 shadow-sm transition-all font-bold"
                  >
                    <RefreshCw size={18} /> 
                    Algorithmus für Auswahl starten
                  </button>
            </div>


            {/* Unassigned Students Drop Zone */}
             <div 
               onDragOver={handleDragOver}
               onDrop={(e) => handleDrop(e, null)}
               className={`border-2 border-dashed rounded-lg p-4 transition-colors ${draggedStudentId ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}
             >
               <div className="flex items-start gap-3 mb-2">
                 <AlertCircle className="text-red-500 mt-0.5" />
                 <div>
                   <h4 className="font-bold text-red-800">Nicht zugeteilt ({getStats().unassigned})</h4>
                   <p className="text-xs text-red-600">Ziehen Sie Schüler hierher, um sie aus einer Gruppe zu entfernen, oder ziehen Sie sie von hier in eine Gruppe.</p>
                 </div>
               </div>
               
               {getStats().unassigned > 0 ? (
                 <div className="flex flex-wrap gap-2 mt-2">
                   {students.filter(s => s.assignedActivityId === null).map(s => (
                     <div 
                       key={s.id}
                       draggable
                       onDragStart={(e) => handleDragStart(e, s.id)}
                       className="bg-white border border-red-200 text-red-800 px-2 py-1 rounded text-sm shadow-sm cursor-move hover:bg-red-50 flex items-center gap-2 active:opacity-50"
                     >
                       <GripVertical size={14} className="text-red-300" />
                       <span>{s.name}</span>
                       <span className="text-xs text-red-400">({s.className})</span>
                     </div>
                   ))}
                 </div>
               ) : (
                 <p className="text-xs text-slate-400 italic mt-2">Alle Schüler sind zugeteilt.</p>
               )}
             </div>

             {/* Activity Grid - Drop Zones */}
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activities.map(activity => {
                  const assignedHere = students.filter(s => s.assignedActivityId === activity.id);
                  const isFull = assignedHere.length >= activity.maxParticipants;
                  
                  return (
                    <div 
                        key={activity.id} 
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, activity.id)}
                        className={`bg-white rounded-xl border shadow-sm flex flex-col transition-all ${draggedStudentId ? 'ring-2 ring-offset-2 ring-blue-100 cursor-copy' : ''} ${isFull ? 'border-orange-200' : 'border-slate-200'}`}
                    >
                      <div className={`p-4 border-b ${isFull ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100'} rounded-t-xl flex justify-between items-center`}>
                        <div>
                          <h3 className="font-bold text-slate-800">{activity.name}</h3>
                          <p className="text-xs text-slate-500">Ltg: {activity.leader}</p>
                        </div>
                        <div className="text-right">
                           <span className={`text-sm font-bold ${isFull ? 'text-orange-600' : 'text-green-600'}`}>
                             {assignedHere.length} / {activity.maxParticipants}
                           </span>
                        </div>
                      </div>
                      <div className="p-0 max-h-64 overflow-y-auto">
                        {assignedHere.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-sm italic">
                            Leer - Ziehen Sie Schüler hierher
                          </div>
                        ) : (
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr>
                                <th className="p-2 pl-4 font-medium text-slate-500 w-8"></th>
                                <th className="p-2 font-medium text-slate-500">Name</th>
                                <th className="p-2 font-medium text-slate-500">Klasse</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {assignedHere.map(s => (
                                <tr 
                                  key={s.id}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, s.id)}
                                  className="hover:bg-blue-50 cursor-move transition-colors active:opacity-50 group"
                                >
                                  <td className="p-2 pl-4 text-slate-300 group-hover:text-blue-400">
                                    <GripVertical size={14} />
                                  </td>
                                  <td className="p-2 text-slate-700 font-medium">{s.name}</td>
                                  <td className="p-2 text-slate-500 text-xs">{s.className}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
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