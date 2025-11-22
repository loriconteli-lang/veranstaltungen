import React from 'react';
import { Activity } from '../types';
import { Trash2, Users, User } from 'lucide-react';

interface ActivityCardProps {
  activity: Activity;
  onDelete: (id: number) => void;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({ activity, onDelete }) => {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col relative group hover:shadow-md transition-shadow">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => onDelete(activity.id)}
          className="text-red-400 hover:text-red-600 p-1"
          title="Löschen"
        >
          <Trash2 size={18} />
        </button>
      </div>
      
      <div className="flex justify-between items-start mb-2">
        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
          ID: {activity.id}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-slate-800 mb-1">{activity.name}</h3>
      <p className="text-sm text-slate-500 mb-4 line-clamp-2">{activity.description}</p>

      <div className="mt-auto space-y-2">
        <div className="flex items-center text-sm text-slate-600">
          <User size={16} className="mr-2 text-slate-400" />
          <span>{activity.leader}</span>
        </div>
        <div className="flex items-center text-sm text-slate-600">
          <Users size={16} className="mr-2 text-slate-400" />
          <span>Max. {activity.maxParticipants} SuS</span>
        </div>
      </div>
    </div>
  );
};
