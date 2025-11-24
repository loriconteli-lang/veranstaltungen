
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Activity, Student, ClassGroup } from '../types';

export const generatePDF = (activities: Activity[], students: Student[], assignmentsPerStudent: number) => {
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString('de-DE');

  doc.setFontSize(18);
  doc.text(`Zuteilung Aktivitäten - ${date}`, 14, 20);
  doc.setFontSize(10);
  doc.text(`Ziel: ${assignmentsPerStudent} Kurse pro Kind`, 14, 26);

  // Helper to get time label
  const getTimeLabel = (slot: string) => {
    if (slot === 'G') return 'Ganztags';
    if (slot === 'V') return 'Vormittag';
    if (slot === 'N') return 'Nachmittag';
    return slot;
  };

  // Iterate through activities and create a table for each
  // Sort by Public ID then TimeSlot
  const sortedActivities = [...activities].sort((a,b) => {
    if (a.publicId !== b.publicId) return a.publicId - b.publicId;
    return a.timeSlot.localeCompare(b.timeSlot);
  });

  let yPos = 35;

  sortedActivities.forEach((activity) => {
    // Check if student has this activity UUID in their list
    const participants = students.filter(s => s.assignedActivityIds.includes(activity.id));
    
    // Add a page break if we are too low on the page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    // Title with Public ID and Name
    doc.text(`${activity.publicId}. ${activity.name}`, 14, yPos);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    
    let infoText = `Zeit: ${getTimeLabel(activity.timeSlot)} | Leitung: ${activity.leader}`;
    if (activity.location) infoText += ` | Ort: ${activity.location}`;
    infoText += ` | Auslastung: ${participants.length}/${activity.maxParticipants}`;

    doc.text(infoText, 14, yPos + 5);

    const tableData = participants.map(p => [
        p.name, 
        p.className, 
        p.isMorningOnly ? '(Nur Vormittag)' : ''
    ]);

    autoTable(doc, {
      startY: yPos + 8,
      head: [['Name', 'Klasse', 'Info']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }, // Tailwind blue-500
      styles: { fontSize: 10 },
      margin: { left: 14 },
    });

    // Update Y position based on the table height
    // @ts-ignore
    yPos = doc.lastAutoTable.finalY + 15;
  });

  // Unassigned or Partially Assigned Students Section
  const incompleteStudents = students.filter(s => s.assignedActivityIds.length < assignmentsPerStudent);

  if (incompleteStudents.length > 0) {
    if (yPos > 240) {
        doc.addPage();
        yPos = 20;
    }
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38); // Red
    doc.text(`Nicht vollständig zugeteilt (Soll: ${assignmentsPerStudent})`, 14, yPos);
    
    const tableData = incompleteStudents.map(p => [
        p.name, 
        p.className, 
        `${p.assignedActivityIds.length} / ${assignmentsPerStudent}`,
        p.isMorningOnly ? 'Nur Vormittag' : '-',
        p.priorities.join(', ')
    ]);

    autoTable(doc, {
        startY: yPos + 10,
        head: [['Name', 'Klasse', 'Status', 'Verfügbarkeit', 'Wünsche (Kurs Nr.)']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38] },
        styles: { fontSize: 10 },
        margin: { left: 14 },
    });
  }

  doc.save(`schulaktiv-zuteilung-${Date.now()}.pdf`);
};

export const generateOverviewPDF = (classes: ClassGroup[], activities: Activity[]) => {
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString('de-DE');

  // Header
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59);
  doc.text(`SchulAktiv Referenzlisten`, 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Erstellt am: ${date}`, 14, 26);

  // 1. Classes Table
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('1. Klassen-Übersicht (Klassen-Codes)', 14, 40);
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Verwenden Sie diese Buchstaben für den Import der Schülerdaten.', 14, 45);
  
  const classData = classes
    .sort((a, b) => a.letter.localeCompare(b.letter))
    .map(c => [c.letter, c.name]);

  autoTable(doc, {
    startY: 50,
    head: [['Buchstabe', 'Klassenbezeichnung']],
    body: classData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 11, cellPadding: 4 },
    margin: { left: 14 },
  });

  // Calculate Y position for next table
  // @ts-ignore
  let finalY = doc.lastAutoTable.finalY + 20;

  // Check page break
  if (finalY > 240) {
    doc.addPage();
    finalY = 20;
  }

  // 2. Activities Table
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('2. Aktivitäten-Übersicht', 14, finalY);
  
  const activityData = activities
    .sort((a, b) => a.publicId - b.publicId)
    .map(a => [
        a.publicId, 
        a.name, 
        a.timeSlot === 'G' ? 'Ganztags' : (a.timeSlot === 'V' ? 'Vormittag' : 'Nachmittag'),
        a.leader, 
        a.location || '-',
        a.maxParticipants, 
    ]);

  autoTable(doc, {
    startY: finalY + 10,
    head: [['Nr.', 'Aktivität', 'Zeit', 'Leitung', 'Ort', 'Max']],
    body: activityData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 15, fontStyle: 'bold', halign: 'center' }, // Nr
      1: { cellWidth: 40 }, // Name
      2: { cellWidth: 25 }, // Zeit
      3: { cellWidth: 35 }, // Leader
      4: { cellWidth: 35 }, // Location
      5: { cellWidth: 15, halign: 'center' }, // Max
    },
    margin: { left: 14 },
  });

  doc.save(`schulaktiv-referenzlisten-${Date.now()}.pdf`);
};
