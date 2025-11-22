import React, { useState } from 'react';
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
  Printer
} from 'lucide-react';
import { Activity, ClassGroup, Student, AppState } from './types';
import { ActivityCard } from './components/ActivityCard';
import { generatePDF, generateOverviewPDF } from './components/PdfExport';

// --- Helpers ---
const parseCSV = (text: string, existingClasses: ClassGroup[]): Student[] => {
  const lines = text.split(/\r?\n/);
  const students: Student[] = [];
  
  lines.forEach((line) => {
    if (!line.trim()) return;
    
    // Handles "Name, ClassLetter, P1, P2, P3"
    // Example: "Marco, A, 5, 2, 1"
    const parts = line.split(/[,;]/).map(p => p.trim());
    
    if (parts.length < 3) return; // Need at least Name, Class, 1 Prio

    const name = parts[0];
    const classLetter = parts[1].toUpperCase(); // Normalize to uppercase 'A', 'B'
    
    // Find the full class name based on the letter
    const matchedClass = existingClasses.find(c => c.letter === classLetter);
    const className = matchedClass ? matchedClass.name : `${classLetter} (Unbekannt)`;

    // Parse remaining parts as priorities
    const priorities = parts.slice(2)
      .map(p => parseInt(p, 10))
      .filter(p => !isNaN(p)); // Filter out bad numbers

    if (name) {
      students.push({
        id: crypto.randomUUID(),
        name,
        className,
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
  const [studentCsvInput, setStudentCsvInput] = useState('');
  
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
    return "?"; // Fallback if > 26 classes
  };

  const addClass = () => {
    if (!newClassInput.trim()) return;
    
    const letter = getNextClassLetter(classes);

    setClasses([...classes, { 
      id: crypto.randomUUID(), 
      name: newClassInput.trim(),
      letter: letter
    }]);
    setNewClassInput('');
  };
  
  const removeClass = (id: string) => {
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

    const parsed = parseCSV(studentCsvInput, classes);
    if (parsed.length === 0) {
      alert("Keine gültigen Schülerdaten gefunden. Bitte Format prüfen.");
      return;
    }
    setStudents(parsed);
    alert(`${parsed.length} Schüler erfolgreich importiert!`);
  };

  // --- Algorithm: Allocation ---
  const runAllocation = () => {
    if (activities.length === 0) {
        alert("Bitte erstellen Sie zuerst Aktivitäten.");
        return;
    }

    // 1. Reset all assignments
    let workingStudents = students.map(s => ({ ...s, assignedActivityId: null }));
    const activityCounts: Record<number, number> = {};
    activities.forEach(a => activityCounts[a.id] = 0);

    // 2. Shuffle (Fisher-Yates) to ensure fairness for same-priority conflicts.
    // This ensures that "Aaron" doesn't always get priority over "Zoe" just because of the name.
    for (let i = workingStudents.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [workingStudents[i], workingStudents[j]] = [workingStudents[j], workingStudents[i]];
    }

    // 3. Iterate priorities (Priority 1 -> Priority N)
    // The requirement is: "Try to fulfill priority 1, if not possible, then priority 2..."
    // This loop structure guarantees exactly that. We process ALL Priority 1 wishes first.
    const maxPrioDepth = Math.max(...workingStudents.map(s => s.priorities.length), 0);

    for (let pIndex = 0; pIndex < maxPrioDepth; pIndex++) {
      workingStudents.forEach(student => {
        // If already assigned in a previous (higher) priority round, skip
        if (student.assignedActivityId !== null) return;

        // Get the activity ID at this priority level (0 = 1st choice, 1 = 2nd choice...)
        const wantedActivityId = student.priorities[pIndex];
        
        // Check if this activity exists in our list
        const activity = activities.find(a => a.id === wantedActivityId);
        
        // Skip if ID is invalid or not found
        if (!activity) return; 

        // Check capacity
        if (activityCounts[wantedActivityId] < activity.maxParticipants) {
          student.assignedActivityId = wantedActivityId;
          activityCounts[wantedActivityId]++;
        }
      });
    }

    // 4. Update State
    // Sort back by Name for display
    workingStudents.sort((a, b) => a.name.localeCompare(b.name));
    setStudents(workingStudents);
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
          v1.0.4
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
                   <p>Erstellen Sie hier Ihre Schulklassen. Jede Klasse erhält automatisch einen <strong>Buchstaben (A, B, C...)</strong>.</p>
                   <p className="mt-1">Diesen Buchstaben benötigen Sie später beim Import der Schülerdaten, um die Schüler der korrekten Klasse zuzuordnen.</p>
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
              
              <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                <p className="font-bold mb-2">Erforderliches Format:</p>
                <code className="bg-white px-2 py-1 rounded border border-blue-200 block mb-4 font-mono text-xs md:text-sm">
                  Name, Klassen-Buchstabe, Prio1, Prio2, Prio3...
                </code>
                
                <div className="mb-4">
                  <h4 className="font-bold mb-1">Ihre Klassen-Codes:</h4>
                  {classes.length === 0 ? (
                    <p className="text-red-500 italic">Noch keine Klassen angelegt.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {classes.map(c => (
                        <span key={c.id} className="bg-white border border-blue-200 px-2 py-1 rounded text-xs flex items-center gap-1 shadow-sm">
                          <span className="font-bold bg-blue-600 text-white w-5 h-5 flex items-center justify-center rounded text-[10px]">{c.letter}</span>
                          <span>{c.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <p className="mt-2 text-xs">
                  <span className="font-semibold">Beispiel:</span><br/>
                  Marco, A, 5, 4, 3, 2, 1<br/>
                  (Marco geht in die Klasse A und wünscht sich Aktivität 5 am meisten.)
                </p>
              </div>

              <textarea
                className="w-full h-64 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                placeholder={`Marco, A, 1, 5, 2\nLisa, A, 2, 1, 3\nTom, B, 5, 3, 1`}
                value={studentCsvInput}
                onChange={(e) => setStudentCsvInput(e.target.value)}
              />

              <div className="mt-4 flex justify-end">
                <button 
                  onClick={handleImportStudents}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2 shadow-sm transition-transform active:scale-95"
                >
                  <CheckCircle2 size={20} /> Daten verarbeiten
                </button>
              </div>
            </div>

            {students.length > 0 && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg mb-4">Vorschau ({students.length} SuS)</h3>
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
                      {students.slice(0, 10).map(s => (
                        <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3">{s.name}</td>
                          <td className="p-3">{s.className}</td>
                          <td className="p-3">
                            <div className="flex gap-1">
                              {s.priorities.map((p, idx) => (
                                <span key={idx} className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                                  {idx === 0 && <span className="text-[10px] text-slate-500 font-bold">#1</span>}
                                  {p}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {students.length > 10 && (
                    <p className="p-3 text-center text-slate-400 text-xs">... und {students.length - 10} weitere</p>
                  )}
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
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={runAllocation}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-sm"
                  >
                    <RefreshCw size={18} /> Algorithmus starten
                  </button>
                  <button 
                    onClick={() => generatePDF(activities, students)}
                    disabled={getStats().assigned === 0}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                  >
                    <Download size={18} /> PDF Exportieren
                  </button>
                </div>
             </div>

             <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg text-sm text-indigo-800 mb-6">
                <strong>Algorithmus-Logik:</strong> Zuerst wird versucht, jedem Kind den 1. Wunsch zu erfüllen. Sind Plätze belegt, wird der 2. Wunsch geprüft, usw.
                Die Reihenfolge der Schüler wird zufällig gemischt, um Fairness zu gewährleisten.
             </div>

             {getStats().unassigned > 0 && getStats().assigned > 0 && (
               <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
                 <AlertCircle className="text-red-500 mt-0.5" />
                 <div>
                   <h4 className="font-bold text-red-800">Achtung: {getStats().unassigned} Schüler nicht zugeteilt</h4>
                   <p className="text-sm text-red-700">Diese Schüler konnten keinem ihrer Prioritäten zugeteilt werden, da die Gruppen voll sind. Bitte weisen Sie sie manuell zu oder erhöhen Sie die Kapazitäten.</p>
                 </div>
               </div>
             )}

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activities.map(activity => {
                  const assignedHere = students.filter(s => s.assignedActivityId === activity.id);
                  const isFull = assignedHere.length >= activity.maxParticipants;
                  
                  return (
                    <div key={activity.id} className={`bg-white rounded-xl border shadow-sm flex flex-col ${isFull ? 'border-orange-200' : 'border-slate-200'}`}>
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
                          <div className="p-8 text-center text-slate-400 text-sm italic">Leer</div>
                        ) : (
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 sticky top-0">
                              <tr>
                                <th className="p-2 pl-4 font-medium text-slate-500">Name</th>
                                <th className="p-2 font-medium text-slate-500">Klasse</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {assignedHere.map(s => (
                                <tr key={s.id}>
                                  <td className="p-2 pl-4 text-slate-700">{s.name}</td>
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