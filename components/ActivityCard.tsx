
import React from 'react';
import { Activity, TimeSlot } from '../types';
import { Trash2, Users, User, Clock, MapPin } from 'lucide-react';

interface ActivityCardProps {
  activity: Activity;
  onDelete: (id: string) => void;
}

const TimeSlotBadge: React.FC<{ slot: TimeSlot }> = ({ slot }) => {
  const configs = {
    'G': { label: 'Ganztags', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    'V': { label: 'Vormittag', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    'N': { label: 'Nachmittag', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  };

  const config = configs[slot];

  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${config.color}`}>
      <Clock size={12} />
      {config.label}
    </span>
  );
};

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
          Nr. {activity.publicId}
        </span>
        <TimeSlotBadge slot={activity.timeSlot} />
      </div>

      <h3 className="text-lg font-semibold text-slate-800 mb-1">{activity.name}</h3>
      <p className="text-sm text-slate-500 mb-2 line-clamp-2">{activity.description}</p>
      
      {activity.location && (
        <div className="flex items-center text-sm text-slate-500 mb-3">
          <MapPin size={14} className="mr-1.5" />
          <span>{activity.location}</span>
        </div>
      )}

      <div className="mt-auto space-y-2 border-t border-slate-50 pt-3">
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
