
export type TimeSlot = 'G' | 'V' | 'N'; // Ganztags, Vormittags, Nachmittags

export interface Activity {
  id: string; // Internal UUID
  publicId: number; // User facing ID (e.g. 1, 2, 3...)
  name: string;
  leader: string;
  location?: string; // New: Ort
  maxParticipants: number;
  description?: string;
  timeSlot: TimeSlot;
}

export interface Student {
  id: string;
  name: string;
  className: string;
  classLetter: string;
  priorities: number[]; // Refers to publicId
  assignedActivityIds: string[]; // Refers to internal UUIDs
  isMorningOnly: boolean;
  isLocked?: boolean; // New: Prevents reallocation
}

export interface ClassGroup {
  id: string;
  name: string;
  letter: string;
}

export enum AppState {
  SETUP = 'SETUP',
  IMPORT = 'IMPORT',
  ASSIGNMENT = 'ASSIGNMENT'
}
