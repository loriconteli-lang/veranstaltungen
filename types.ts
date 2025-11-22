export interface Activity {
  id: number;
  name: string;
  leader: string; // Who is leading the group
  maxParticipants: number;
  description?: string;
}

export interface Student {
  id: string;
  name: string;
  className: string;
  classLetter: string; // The letter ID (A, B, C...) for filtering
  priorities: number[]; // Array of Activity IDs
  assignedActivityId: number | null;
}

export interface ClassGroup {
  id: string;
  name: string;
  letter: string; // 'A', 'B', 'C', etc.
}

export enum AppState {
  SETUP = 'SETUP',
  IMPORT = 'IMPORT',
  ASSIGNMENT = 'ASSIGNMENT'
}