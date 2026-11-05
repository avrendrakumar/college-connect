import React, { useState } from 'react';
import { DoorOpen, Edit, Plus, Trash2, Wrench, X, Check, Users } from 'lucide-react';
import { Room, RoomType } from '../../types';

interface RoomManagerProps {
  rooms: Room[];
  onSaveRooms: (updated: Room[]) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const RoomManager: React.FC<RoomManagerProps> = ({
  rooms,
  onSaveRooms,
  onShowToast
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const [roomId, setRoomId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<RoomType>('classroom');
  const [capacity, setCapacity] = useState(60);
  const [floor, setFloor] = useState<number>(0);
  const [building, setBuilding] = useState('Academic Block A');

  const openAdd = () => {
    setEditingRoom(null);
    setRoomId('');
    setName('');
    setType('classroom');
    setCapacity(60);
    setFloor(0);
    setBuilding('Academic Block A');
    setShowModal(true);
  };

  const openEdit = (room: Room) => {
    setEditingRoom(room);
    setRoomId(room.id);
    setName(room.name);
    setType(room.type);
    setCapacity(room.capacity);
    setFloor(typeof room.floor === 'number' ? room.floor : parseInt(room.floor, 10) || 0);
    setBuilding(room.building || 'Academic Block A');
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !name.trim()) return;

    if (editingRoom) {
      const updated = rooms.map((r) =>
        r.id === editingRoom.id
          ? {
              ...r,
              name: name.trim(),
              type,
              capacity: Number(capacity),
              floor: Number(floor),
              building: building.trim()
            }
          : r
      );
      onSaveRooms(updated);
      onShowToast(`Updated room ${name}`, 'success');
    } else {
      // Check duplicate ID
      if (rooms.some((r) => r.id.toLowerCase() === roomId.trim().toLowerCase())) {
        onShowToast(`Room ID "${roomId}" already exists`, 'error');
        return;
      }
      const newRoom: Room = {
        id: roomId.trim().toUpperCase(),
        name: name.trim(),
        type,
        capacity: Number(capacity),
        floor: Number(floor),
        building: building.trim(),
        isMaintenance: false
      };
      onSaveRooms([...rooms, newRoom]);
      onShowToast(`Added new room ${newRoom.name}`, 'success');
    }

    setShowModal(false);
  };

  const toggleMaintenance = (id: string) => {
    const updated = rooms.map((r) =>
      r.id === id
        ? {
            ...r,
            // keep both spellings in step: rooms loaded from the database use is_under_maintenance
            isMaintenance: !(r.isMaintenance || r.is_under_maintenance),
            is_under_maintenance: !(r.isMaintenance || r.is_under_maintenance)
          }
        : r
    );
    onSaveRooms(updated);
    const room = rooms.find((r) => r.id === id);
    onShowToast(
      `${room?.name} is now ${!(room?.isMaintenance || room?.is_under_maintenance) ? 'UNDER MAINTENANCE' : 'ACTIVE'}`,
      'info'
    );
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this room? Classes scheduled in it are removed from the database as well.')) return;
    onSaveRooms(rooms.filter((r) => r.id !== id));
    onShowToast('Room deleted from catalog', 'info');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <DoorOpen className="w-5 h-5 text-indigo-600" />
            <span>Campus Room Management ({rooms.length} facilities)</span>
          </h3>
          <p className="text-xs text-slate-500">
            Define classrooms, labs, capacities and toggle maintenance states
          </p>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Facility</span>
        </button>
      </div>

      {/* Rooms Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500">
            <tr>
              <th className="py-2.5 px-4 font-bold">Room Code</th>
              <th className="py-2.5 px-4 font-bold">Name &amp; Building</th>
              <th className="py-2.5 px-4 font-bold">Type</th>
              <th className="py-2.5 px-4 font-bold">Capacity</th>
              <th className="py-2.5 px-4 font-bold">Floor</th>
              <th className="py-2.5 px-4 font-bold">Status</th>
              <th className="py-2.5 px-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rooms.map((room) => (
              <tr key={room.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-3 px-4 font-bold font-mono text-indigo-600 dark:text-indigo-400">
                  {room.id}
                </td>
                <td className="py-3 px-4">
                  <div className="font-bold text-slate-900 dark:text-white">{room.name}</div>
                  <div className="text-[11px] text-slate-400">{room.building}</div>
                </td>
                <td className="py-3 px-4 capitalize">{room.type}</td>
                <td className="py-3 px-4 font-mono font-medium">{room.capacity} seats</td>
                <td className="py-3 px-4">
                  {room.floor === 0 ? 'Ground' : `Floor ${room.floor}`}
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => toggleMaintenance(room.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition ${
                      room.isMaintenance
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    <Wrench className="w-3 h-3" />
                    <span>{room.isMaintenance ? 'Under Maintenance' : 'Operational'}</span>
                  </button>
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    onClick={() => openEdit(room)}
                    className="p-1 text-slate-500 hover:text-indigo-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(room.id)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingRoom ? 'Edit Facility' : 'Add New Room / Lab'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="p-1 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 my-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Room ID / Code *</label>
                <input
                  type="text"
                  required
                  disabled={!!editingRoom}
                  placeholder="e.g. R205 or LAB-ROBOTICS"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Advanced Robotics Lab"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as RoomType)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="classroom">Classroom</option>
                    <option value="lab">Laboratory</option>
                    <option value="hall">Seminar / Drawing Hall</option>
                    <option value="workshop">Workshop</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Capacity</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Floor</label>
                  <select
                    value={floor}
                    onChange={(e) => setFloor(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value={0}>Ground Floor (0)</option>
                    <option value={1}>1st Floor</option>
                    <option value={2}>2nd Floor</option>
                    <option value={3}>3rd Floor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Building</label>
                  <input
                    type="text"
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white"
                >
                  Save Facility
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
