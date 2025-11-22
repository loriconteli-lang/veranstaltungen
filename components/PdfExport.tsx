import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Activity, Student, ClassGroup } from '../types';

export const generatePDF = (activities: Activity[], students: Student[]) => {
  const doc = new jsPDF();
  const date = new Date().toLocaleDateString('de-DE');

  doc.setFontSize(18);
  doc.text(`Zuteilung Aktivitäten - ${date}`, 14, 20);

  // Get all assignments
  const assignedStudents = students.filter(s => s.assignedActivityId !== null);
  const unassignedStudents = students.filter(s => s.assignedActivityId === null);

  // Iterate through activities and create a table for each
  let yPos = 30;

  activities.forEach((activity) => {
    const participants = assignedStudents.filter(s => s.assignedActivityId === activity.id);
    
    // Add a page break if we are too low on the page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text(`${activity.id}. ${activity.name} (${participants.length}/${activity.maxParticipants})`, 14, yPos);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Leitung: ${activity.leader}`, 14, yPos + 6);

    const tableData = participants.map(p => [p.name, p.className]);

    autoTable(doc, {
      startY: yPos + 10,
      head: [['Name', 'Klasse']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] }, // Tailwind blue-500
      styles: { fontSize: 10 },
      margin: { left: 14 },
    });

    // Update Y position based on the table height
    // @ts-ignore - lastAutoTable exists on the doc object extended by autotable plugin
    yPos = doc.lastAutoTable.finalY + 20;
  });

  // Unassigned Students Section
  if (unassignedStudents.length > 0) {
    if (yPos > 240) {
        doc.addPage();
        yPos = 20;
    }
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38); // Red
    doc.text(`Nicht zugeteilt (${unassignedStudents.length})`, 14, yPos);
    
    const tableData = unassignedStudents.map(p => [p.name, p.className, p.priorities.join(', ')]);

    autoTable(doc, {
        startY: yPos + 10,
        head: [['Name', 'Klasse', 'Wünsche (IDs)']],
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
    .sort((a, b) => a.id - b.id)
    .map(a => [a.id, a.name, a.leader, a.maxParticipants, a.description || '-']);

  autoTable(doc, {
    startY: finalY + 10,
    head: [['ID', 'Aktivität', 'Leitung', 'Max', 'Info']],
    body: activityData,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 15, fontStyle: 'bold' }, // ID
      1: { cellWidth: 60 }, // Name
      2: { cellWidth: 40 }, // Leader
      3: { cellWidth: 15, halign: 'center' }, // Max
      4: { cellWidth: 'auto' } // Info
    },
    margin: { left: 14 },
  });

  doc.save(`schulaktiv-referenzlisten-${Date.now()}.pdf`);
};