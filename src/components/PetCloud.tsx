import { memo } from 'react';
import type { FloatingPetSeed } from '../types';

export const PetCloud = memo(function PetCloud({ pets }: { pets: FloatingPetSeed[] }) {
  return (
    <div className="pet-cloud" aria-hidden="true">
      {pets.map((pet) => (
        <div
          className="floating-pet"
          key={pet.id}
          style={{
            left: `${pet.left}%`,
            top: `${pet.top}%`,
            fontSize: `${pet.size}px`,
            animationDelay: `${pet.delay}s`,
            animationDuration: `${pet.duration}s`,
            rotate: `${pet.rotate}deg`
          }}
        >
          <span>{pet.emoji}</span>
          {pet.id % 7 === 0 && <em>{pet.phrase}</em>}
        </div>
      ))}
    </div>
  );
});
