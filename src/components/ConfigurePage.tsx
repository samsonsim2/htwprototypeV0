import React, { useState } from 'react';
import { ArrowLeft, Save, RotateCcw, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getStoredPins, savePins, resetPins, LocationPin } from '../config';

export default function ConfigurePage() {
  const [pins, setPins] = useState<LocationPin[]>(getStoredPins());
  const navigate = useNavigate();

  const handleInputChange = (id: string, field: keyof LocationPin, value: string | number) => {
    setPins(prev => prev.map(pin => pin.id === id ? { ...pin, [field]: value } : pin));
  };

  const handleSave = () => {
    savePins(pins);
    alert('Locations saved successfully!');
    navigate('/');
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all locations to default?')) {
      resetPins();
      setPins(getStoredPins());
      alert('Reset to defaults.');
    }
  };

  return (
    <div className="w-full h-full bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="p-6 border-bottom border-white/5 bg-zinc-900/50 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <Link to="/" className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-white/80 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-white font-bold text-lg">Configure Pins</h1>
          <div className="w-10" />
        </div>
        <p className="text-zinc-400 text-xs text-center">Update the coordinates for your 5 audio guide locations.</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {pins.map((pin, index) => (
          <div key={pin.id} className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 font-bold text-sm">
                {index + 1}
              </div>
              <h3 className="text-white font-semibold">{pin.name}</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 ml-1">Latitude</label>
                <input 
                  type="number" 
                  step="any"
                  value={pin.lat}
                  onChange={(e) => handleInputChange(pin.id, 'lat', parseFloat(e.target.value))}
                  className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 ml-1">Longitude</label>
                <input 
                  type="number" 
                  step="any"
                  value={pin.lng}
                  onChange={(e) => handleInputChange(pin.id, 'lng', parseFloat(e.target.value))}
                  className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 ml-1">Radius (m)</label>
                <input 
                  type="number" 
                  value={pin.radius}
                  onChange={(e) => handleInputChange(pin.id, 'radius', parseInt(e.target.value) || 0)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 ml-1">Label</label>
                <input 
                  type="text" 
                  value={pin.buttonLabel}
                  onChange={(e) => handleInputChange(pin.id, 'buttonLabel', e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      <div className="p-6 bg-zinc-900 border-t border-white/5 space-y-3">
        <button 
          onClick={handleSave}
          className="w-full bg-emerald-500 text-zinc-950 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 active:scale-[0.98] transition-all"
        >
          <Save className="w-5 h-5" />
          Save Changes
        </button>
        <button 
          onClick={handleReset}
          className="w-full bg-zinc-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 border border-white/5 active:scale-[0.98] transition-all"
        >
          <RotateCcw className="w-5 h-5" />
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
