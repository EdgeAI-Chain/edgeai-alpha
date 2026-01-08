import { useState, useEffect, useRef } from 'react';
import { ALL_GLOBE_MARKERS } from '@/lib/globeData';

export interface SimulatedTransaction {
  id: string;
  location: [number, number];
  amount: number;
  timestamp: number;
  type: 'transfer' | 'contract' | 'iot';
}

export function useTransactionSimulator(enabled: boolean = true) {
  const [activeTransactions, setActiveTransactions] = useState<SimulatedTransaction[]>([]);
  const [markers, setMarkers] = useState(ALL_GLOBE_MARKERS);
  
  // Ref to track active pulses to avoid re-renders just for logic
  const activePulsesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      // 1. Pick a random region based on weight (simulating activity hotspots)
      // North America and Europe have higher weights
      const regionWeights = [
        { region: 'North America', weight: 0.35 },
        { region: 'Europe', weight: 0.30 },
        { region: 'Asia', weight: 0.25 },
        { region: 'South America', weight: 0.05 },
        { region: 'Oceania', weight: 0.03 },
        { region: 'Africa', weight: 0.02 }
      ];
      
      const rand = Math.random();
      let sum = 0;
      let selectedRegion = regionWeights[0].region;
      
      for (const item of regionWeights) {
        sum += item.weight;
        if (rand < sum) {
          selectedRegion = item.region;
          break;
        }
      }
      
      // 2. Find markers in that region
      // This is a simple approximation, in a real app we'd filter by lat/lon bounds
      // For now we just pick a random marker from the full list
      // To make it more realistic, we could map markers to regions in globeData
      
      const targetMarkerIndex = Math.floor(Math.random() * markers.length);
      const targetMarker = markers[targetMarkerIndex];
      
      // 3. Trigger a pulse on that marker
      // We update the markers state to trigger a re-render in Globe3D
      // But we only update the specific marker that needs to pulse
      
      setMarkers(prevMarkers => {
        const newMarkers = [...prevMarkers];
        // Reset pulse on all markers (optional, or let them fade)
        // For performance, we might want to keep pulses active for a bit
        
        // Set pulse on target
        newMarkers[targetMarkerIndex] = {
          ...newMarkers[targetMarkerIndex],
          pulse: true,
          size: newMarkers[targetMarkerIndex].size * 1.5 // Temporary size increase
        };
        
        // Clear pulse after a delay
        setTimeout(() => {
          setMarkers(currentMarkers => {
            const resetMarkers = [...currentMarkers];
            if (resetMarkers[targetMarkerIndex]) {
              resetMarkers[targetMarkerIndex] = {
                ...resetMarkers[targetMarkerIndex],
                pulse: false,
                size: ALL_GLOBE_MARKERS[targetMarkerIndex].size // Restore original size
              };
            }
            return resetMarkers;
          });
        }, 500); // 500ms pulse duration
        
        return newMarkers;
      });
      
      // 4. Add to active transactions list (for other UI feeds)
      const newTx: SimulatedTransaction = {
        id: Math.random().toString(36).substring(7),
        location: targetMarker.location,
        amount: Math.random() * 1000,
        timestamp: Date.now(),
        type: Math.random() > 0.7 ? 'contract' : (Math.random() > 0.5 ? 'iot' : 'transfer')
      };
      
      setActiveTransactions(prev => [newTx, ...prev].slice(0, 10));
      
    }, 800); // New transaction every 800ms on average
    
    return () => clearInterval(interval);
  }, [enabled]);

  return { markers, activeTransactions };
}
